/**
 * Web MIDI Hardware Interface and MIDI File Sequencer
 * 
 * Features:
 * - Web MIDI API (navigator.requestMIDIAccess) with NoteOn, NoteOff, Velocity, and CC64 Sustain Pedal
 * - @tonejs/midi file parser for user uploaded .mid files
 * - Rich built-in demo songs (Moonlight Sonata, Für Elise, Bach Prelude, Canon in D, Waterfall Challenge)
 * - Synchronized timeline sequencer for audio triggering and waterfall visualization
 */

import { Midi } from '@tonejs/midi';
import { audioEngine } from './audioEngine';
import { MIN_MIDI, MAX_MIDI, CYAN_HEX, MAGENTA_HEX, getNoteColorHex } from './pianoGeometry';
import { SustainMode, ColorMode } from './settings';

// Self-contained Web MIDI API interfaces
export interface WebMidiInputPort {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  onmidimessage: ((event: WebMidiMessageEvent) => void) | null;
}

export interface WebMidiMessageEvent {
  data: Uint8Array;
}

export interface WebMidiAccessObject {
  inputs: {
    values: () => IterableIterator<WebMidiInputPort>;
  };
  onstatechange: (() => void) | null;
}

export interface ParsedMidiNote {
  midi: number;
  name: string;
  time: number; // in seconds
  duration: number; // in seconds
  velocity: number; // 0.0 to 1.0
  trackIndex: number;
}

export interface MidiSong {
  id: string;
  title: string;
  composer: string;
  duration: number;
  notes: ParsedMidiNote[];
  bpm?: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

type NoteListener = (midi: number, velocity: number, isLiveInput: boolean, color?: string, inputId?: string) => void;
type NoteOffListener = (midi: number, isLiveInput: boolean, inputId?: string) => void;
type SustainListener = (mode: SustainMode) => void;
type DeviceListener = (devices: MidiDevice[]) => void;
type TimeUpdateListener = (currentTime: number, duration: number) => void;
type PlaybackStateListener = (isPlaying: boolean) => void;

class MidiManager {
  private midiAccess: WebMidiAccessObject | null = null;
  private connectedDevices: MidiDevice[] = [];
  
  private noteOnListeners: NoteListener[] = [];
  private noteOffListeners: NoteOffListener[] = [];
  private sustainListeners: SustainListener[] = [];
  private deviceListeners: DeviceListener[] = [];
  private timeUpdateListeners: TimeUpdateListener[] = [];
  private playbackStateListeners: PlaybackStateListener[] = [];

  // Track active live inputs per MIDI note to support polyphonic multi-input release
  private activeLiveInputs: Map<number, Set<string>> = new Map();
  // Track active hardware MIDI inputs to release exact transposed notes on note-off
  private activeHardwareNotes: Map<string, number> = new Map();
  // Deduplication map for multi-port composite MIDI controllers broadcasting identical notes
  private recentMidiNoteEvents: Map<string, number> = new Map();

  // Playback Sequencer State
  private currentSong: MidiSong | null = null;
  private isPlaying: boolean = false;
  private playbackTime: number = 0; // Current time in song (seconds)
  private playbackStartPerfTime: number = 0;
  private playbackStartTimeOffset: number = 0;
  private playbackSpeed: number = 1.0;
  private animationFrameId: number | null = null;
  private lastRafTimestamp: number | null = null;
  private lastUiUpdateTime: number = 0;
  private activeScheduledNotes: Map<string, { midi: number; releaseTime: number; inputId: string }> = new Map();
  private nextNoteIndex: number = 0;
  private colorMode: ColorMode = 'track';
  private inputTranspose: number = 0;
  private midiTranspose: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.isPlaying) {
            this.playbackTime = this.getPlaybackTime();
          }
          this.lastRafTimestamp = null;
          // Release active scheduled notes to prevent hanging sounds in background
          this.activeScheduledNotes.forEach(item => {
            const hasLiveInput = this.activeLiveInputs.has(item.midi) && (this.activeLiveInputs.get(item.midi)?.size ?? 0) > 0;
            if (!hasLiveInput) {
              audioEngine.triggerRelease(item.midi);
            }
            this.noteOffListeners.forEach(cb => cb(item.midi, false, item.inputId));
          });
          this.activeScheduledNotes.clear();
        } else {
          if (this.isPlaying && this.currentSong) {
            this.playbackStartPerfTime = performance.now();
            this.playbackStartTimeOffset = this.playbackTime;
            this.updateNextNoteIndex();
            if (this.animationFrameId === null) {
              this.animationFrameId = requestAnimationFrame(this.tick);
            }
          }
        }
      });

      window.addEventListener('focus', () => {
        this.lastRafTimestamp = null;
      });
    }
  }

  public setColorMode(mode: ColorMode) {
    this.colorMode = mode;
  }

  public getColorMode(): ColorMode {
    return this.colorMode;
  }

  public setInputTranspose(transpose: number) {
    this.inputTranspose = transpose;
  }

  public getInputTranspose(): number {
    return this.inputTranspose;
  }

  public setMidiTranspose(transpose: number) {
    if (this.midiTranspose === transpose) return;
    // Release currently active scheduled notes so old pitches don't linger
    this.activeScheduledNotes.forEach(item => {
      const hasLiveInput = this.activeLiveInputs.has(item.midi) && (this.activeLiveInputs.get(item.midi)?.size ?? 0) > 0;
      if (!hasLiveInput) {
        audioEngine.triggerRelease(item.midi);
      }
      this.noteOffListeners.forEach(cb => cb(item.midi, false, item.inputId));
    });
    this.activeScheduledNotes.clear();
    this.midiTranspose = transpose;
  }

  public getMidiTranspose(): number {
    return this.midiTranspose;
  }

  /**
   * Initialize Web MIDI API
   */
  public async initWebMidi(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (!nav.requestMIDIAccess) {
      console.warn('Web MIDI API is not supported in this browser.');
      return false;
    }

    try {
      this.midiAccess = await nav.requestMIDIAccess({ sysex: false });
      this.updateDeviceList();

      if (this.midiAccess) {
        this.midiAccess.onstatechange = () => {
          this.updateDeviceList();
        };
      }

      return true;
    } catch (err) {
      console.warn('Failed to get Web MIDI access:', err);
      return false;
    }
  }

  private updateDeviceList() {
    if (!this.midiAccess) return;

    const devices: MidiDevice[] = [];
    const inputs = this.midiAccess.inputs.values();

    for (const input of inputs) {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown MIDI Keyboard',
        manufacturer: input.manufacturer || 'Generic',
        state: input.state || 'connected',
      });
    }

    this.connectedDevices = devices;
    this.deviceListeners.forEach(cb => cb(devices));
    this.attachMidiInputs();
  }

  private attachMidiInputs() {
    if (!this.midiAccess) return;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: WebMidiMessageEvent) => {
        this.handleMidiMessage(event, input.id);
      };
    }
  }

  private handleMidiMessage(event: WebMidiMessageEvent, portId: string = 'port') {
    const data = event.data;
    if (!data || data.length < 2) return;

    const command = data[0] >> 4;
    const channel = data[0] & 0x0f;
    const rawNote = data[1];
    const velocity = data.length > 2 ? data[2] : 0;
    const inputId = `midi:${channel}:${rawNote}`;

    // Note On
    if (command === 0x9 && velocity > 0) {
      const now = performance.now();
      const dedupKey = `on:${channel}:${rawNote}`;
      const lastTrigger = this.recentMidiNoteEvents.get(dedupKey) || 0;
      if (now - lastTrigger < 35) {
        // Multi-port echo / duplicate broadcast from composite USB device, ignore duplicate voice!
        return;
      }
      this.recentMidiNoteEvents.set(dedupKey, now);

      const transposedNote = rawNote + this.inputTranspose;
      if (transposedNote >= 0 && transposedNote <= 127) {
        this.activeHardwareNotes.set(inputId, transposedNote);
        const normVelocity = velocity / 127;
        const color = getNoteColorHex(transposedNote, channel, this.colorMode);
        this.triggerLiveNoteOn(transposedNote, normVelocity, color, inputId, 'midi');
      }
    }
    // Note Off (or Note On with velocity 0)
    else if (command === 0x8 || (command === 0x9 && velocity === 0)) {
      const now = performance.now();
      const dedupKey = `off:${channel}:${rawNote}`;
      const lastTrigger = this.recentMidiNoteEvents.get(dedupKey) || 0;
      if (now - lastTrigger < 35) {
        return;
      }
      this.recentMidiNoteEvents.set(dedupKey, now);

      const playedNote = this.activeHardwareNotes.get(inputId) ?? (rawNote + this.inputTranspose);
      this.activeHardwareNotes.delete(inputId);
      if (playedNote >= 0 && playedNote <= 127) {
        this.triggerLiveNoteOff(playedNote, inputId);
      }
    }
    // Control Change (CC)
    else if (command === 0xb) {
      const controllerNumber = data[1];
      const controllerValue = data[2];

      // CC 64: Sustain Pedal (supports continuous half-damper and switch pedals)
      if (controllerNumber === 64) {
        let mode: SustainMode = 'off';
        if (controllerValue >= 96) {
          mode = 'full';
        } else if (controllerValue >= 32) {
          mode = 'half';
        } else {
          mode = 'off';
        }
        audioEngine.setSustainPedal(mode);
        this.sustainListeners.forEach(cb => cb(mode));
      }
    }
  }

  public getDevices(): MidiDevice[] {
    return this.connectedDevices;
  }

  /**
   * Trigger live note on (from UI Keyboard / Mouse / Touch / Computer QWERTY / Web MIDI)
   */
  public triggerLiveNoteOn(
    midi: number,
    velocity: number = 0.85,
    color?: string,
    inputId?: string,
    source: 'keyboard' | 'midi' = 'keyboard'
  ) {
    if (midi < 0 || midi > 127) return;
    const keyId = inputId || `live-${Date.now()}-${Math.random()}`;
    if (!this.activeLiveInputs.has(midi)) {
      this.activeLiveInputs.set(midi, new Set());
    }
    this.activeLiveInputs.get(midi)!.add(keyId);

    const isMouseOrTouch = inputId?.startsWith('pointer:') || inputId?.startsWith('touch:');
    const resolvedColor = color || (isMouseOrTouch && this.colorMode !== 'outline' ? getNoteColorHex(midi, 0, 'gradient') : getNoteColorHex(midi, 0, this.colorMode));
    audioEngine.triggerAttack(midi, velocity, undefined, source);
    this.noteOnListeners.forEach(cb => cb(midi, velocity, true, resolvedColor, keyId));
  }

  /**
   * Trigger live note off (from UI Keyboard / Mouse / Touch / Computer QWERTY / Web MIDI)
   */
  public triggerLiveNoteOff(midi: number, inputId?: string) {
    if (midi < 0 || midi > 127) return;
    const inputs = this.activeLiveInputs.get(midi);
    if (inputs) {
      if (inputId) {
        if (inputs.has(inputId)) {
          inputs.delete(inputId);
        } else {
          // If this specific input was not active, do NOT release other inputs or audio!
          return;
        }
      } else {
        const first = inputs.values().next().value;
        if (first !== undefined) inputs.delete(first);
      }

      if (inputs.size === 0) {
        this.activeLiveInputs.delete(midi);
        const hasActiveSongNote = Array.from(this.activeScheduledNotes.values()).some(n => n.midi === midi);
        if (!hasActiveSongNote) {
          audioEngine.triggerRelease(midi);
        }
      }
    } else {
      if (!inputId) {
        audioEngine.triggerRelease(midi);
      } else {
        return;
      }
    }
    this.noteOffListeners.forEach(cb => cb(midi, true, inputId));
  }

  public onNoteOn(cb: NoteListener): () => void {
    this.noteOnListeners.push(cb);
    return () => {
      this.noteOnListeners = this.noteOnListeners.filter(l => l !== cb);
    };
  }
  public onNoteOff(cb: NoteOffListener): () => void {
    this.noteOffListeners.push(cb);
    return () => {
      this.noteOffListeners = this.noteOffListeners.filter(l => l !== cb);
    };
  }
  public onSustain(cb: SustainListener): () => void {
    this.sustainListeners.push(cb);
    return () => {
      this.sustainListeners = this.sustainListeners.filter(l => l !== cb);
    };
  }
  public onDeviceChange(cb: DeviceListener): () => void {
    this.deviceListeners.push(cb);
    return () => {
      this.deviceListeners = this.deviceListeners.filter(l => l !== cb);
    };
  }
  public onTimeUpdate(cb: TimeUpdateListener): () => void {
    this.timeUpdateListeners.push(cb);
    return () => {
      this.timeUpdateListeners = this.timeUpdateListeners.filter(l => l !== cb);
    };
  }
  public onPlaybackStateChange(cb: PlaybackStateListener): () => void {
    this.playbackStateListeners.push(cb);
    return () => {
      this.playbackStateListeners = this.playbackStateListeners.filter(l => l !== cb);
    };
  }

  private notifyPlaybackState(isPlaying: boolean) {
    this.playbackStateListeners.forEach(cb => cb(isPlaying));
  }

  /**
   * Parse an uploaded MIDI ArrayBuffer using @tonejs/midi
   */
  public parseMidiFile(arrayBuffer: ArrayBuffer, fileName: string = 'Uploaded MIDI'): MidiSong {
    const midi = new Midi(arrayBuffer);
    const notes: ParsedMidiNote[] = [];

    // Filter to tracks that have playable notes
    const activeTracks = midi.tracks.filter(t => t.notes && t.notes.length > 0);
    const isMultiTrack = activeTracks.length > 1;

    activeTracks.forEach((track, activeTrackIdx) => {
      track.notes.forEach(note => {
        if (note.midi >= MIN_MIDI && note.midi <= MAX_MIDI) {
          notes.push({
            midi: note.midi,
            name: note.name,
            time: note.time,
            duration: Math.max(0.1, note.duration),
            velocity: note.velocity,
            trackIndex: isMultiTrack ? activeTrackIdx : (note.midi < 60 ? 0 : 1),
          });
        }
      });
    });

    // Sort chronologically
    notes.sort((a, b) => a.time - b.time);

    const song: MidiSong = {
      id: `custom-${Date.now()}`,
      title: midi.name || fileName.replace(/\.[^/.]+$/, ""),
      composer: 'Uploaded File',
      duration: Math.max(midi.duration, notes.length > 0 ? notes[notes.length - 1].time + notes[notes.length - 1].duration : 0),
      notes,
      bpm: midi.header.tempos && midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : undefined,
    };

    return song;
  }

  /**
   * Set Current Song
   */
  public loadSong(song: MidiSong) {
    this.stop();
    this.currentSong = song;
    this.playbackTime = 0;
    this.playbackStartTimeOffset = 0;
    this.playbackStartPerfTime = 0;
    this.nextNoteIndex = 0;
    this.timeUpdateListeners.forEach(cb => cb(0, song.duration));
  }

  public getCurrentSong(): MidiSong | null {
    return this.currentSong;
  }

  public getPlaybackTime(atTimestamp?: number): number {
    if (this.isPlaying && this.currentSong) {
      const now = atTimestamp !== undefined && atTimestamp > 0 ? atTimestamp : performance.now();
      const elapsedSeconds = Math.max(0, (now - this.playbackStartPerfTime) / 1000) * this.playbackSpeed;
      const current = this.playbackStartTimeOffset + elapsedSeconds;
      return Math.min(this.currentSong.duration + 1.0, current);
    }
    return this.playbackTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public setPlaybackSpeed(speed: number) {
    const clampedSpeed = Math.max(0.25, Math.min(3.0, speed));
    if (this.isPlaying) {
      this.playbackStartTimeOffset = this.getPlaybackTime();
      this.playbackStartPerfTime = performance.now();
    }
    this.playbackSpeed = clampedSpeed;
  }

  /**
   * Start or resume playback
   */
  public async play() {
    if (!this.currentSong || this.isPlaying) return;
    
    await audioEngine.initAudio();
    this.isPlaying = true;
    this.playbackStartPerfTime = performance.now();
    this.playbackStartTimeOffset = this.playbackTime;
    this.lastRafTimestamp = null;
    this.lastUiUpdateTime = performance.now();
    this.updateNextNoteIndex();
    this.notifyPlaybackState(true);
    this.tick();
  }

  /**
   * Pause playback
   */
  public pause() {
    const wasPlaying = this.isPlaying;
    if (this.isPlaying) {
      this.playbackTime = this.getPlaybackTime();
    }
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastRafTimestamp = null;
    // Release active notes
    this.activeScheduledNotes.forEach(item => {
      const hasLiveInput = this.activeLiveInputs.has(item.midi) && (this.activeLiveInputs.get(item.midi)?.size ?? 0) > 0;
      if (!hasLiveInput) {
        audioEngine.triggerRelease(item.midi);
      }
      this.noteOffListeners.forEach(cb => cb(item.midi, false, item.inputId));
    });
    this.activeScheduledNotes.clear();
    if (wasPlaying) {
      this.notifyPlaybackState(false);
    }
  }

  /**
   * Stop and rewind
   */
  public stop() {
    this.pause();
    this.playbackTime = 0;
    this.playbackStartTimeOffset = 0;
    this.playbackStartPerfTime = 0;
    this.nextNoteIndex = 0;
    this.activeLiveInputs.clear();
    audioEngine.releaseAll();
    const song = this.currentSong;
    if (song) {
      this.timeUpdateListeners.forEach(cb => cb(0, song.duration));
    }
  }

  /**
   * Clear loaded MIDI song and reset state
   */
  public clearSong() {
    this.stop();
    this.currentSong = null;
    this.playbackTime = 0;
    this.playbackStartTimeOffset = 0;
    this.playbackStartPerfTime = 0;
    this.nextNoteIndex = 0;
    this.timeUpdateListeners.forEach(cb => cb(0, 0));
  }

  /**
   * Seek to specific position in seconds
   */
  public seek(targetTime: number) {
    if (!this.currentSong) return;

    const clamped = Math.max(0, Math.min(this.currentSong.duration, targetTime));
    
    // Release existing notes
    this.activeScheduledNotes.forEach(item => {
      const hasLiveInput = this.activeLiveInputs.has(item.midi) && (this.activeLiveInputs.get(item.midi)?.size ?? 0) > 0;
      if (!hasLiveInput) {
        audioEngine.triggerRelease(item.midi);
      }
      this.noteOffListeners.forEach(cb => cb(item.midi, false, item.inputId));
    });
    this.activeScheduledNotes.clear();
    audioEngine.releaseAll();

    this.playbackTime = clamped;
    this.playbackStartTimeOffset = clamped;
    this.playbackStartPerfTime = performance.now();
    this.updateNextNoteIndex();
    const song = this.currentSong;
    this.timeUpdateListeners.forEach(cb => cb(clamped, song ? song.duration : 0));
  }

  private updateNextNoteIndex() {
    if (!this.currentSong) {
      this.nextNoteIndex = 0;
      return;
    }
    const notes = this.currentSong.notes;
    let idx = 0;
    while (idx < notes.length && notes[idx].time < this.playbackTime) {
      idx++;
    }
    this.nextNoteIndex = idx;
  }

  /**
   * High performance animation frame tick
   */
  private tick = (rafTimestamp?: number) => {
    if (!this.isPlaying || !this.currentSong) return;

    const curTime = this.getPlaybackTime(rafTimestamp);
    this.playbackTime = curTime;
    const song = this.currentSong;

    // Check if song finished
    if (curTime >= song.duration + 1.0) {
      this.stop();
      return;
    }

    // Schedule new notes that reached current playback time
    const notes = song.notes;
    while (this.nextNoteIndex < notes.length && notes[this.nextNoteIndex].time <= curTime) {
      const note = notes[this.nextNoteIndex];
      // If note start time is within recent window
      if (curTime - note.time < 0.25) {
        const transposedMidi = note.midi + this.midiTranspose;
        if (transposedMidi >= 0 && transposedMidi <= 127) {
          const noteKey = `${note.trackIndex}-${note.midi}-${note.time}`;
          const songInputId = `song:${noteKey}`;
          this.activeScheduledNotes.set(noteKey, {
            midi: transposedMidi,
            releaseTime: note.time + note.duration,
            inputId: songInputId,
          });
          audioEngine.triggerAttack(transposedMidi, note.velocity, undefined, 'song');
          const noteColor = getNoteColorHex(transposedMidi, note.trackIndex, this.colorMode);
          this.noteOnListeners.forEach(cb => cb(transposedMidi, note.velocity, false, noteColor, songInputId));
        }
      }
      this.nextNoteIndex++;
    }

    // Check notes that should be released
    this.activeScheduledNotes.forEach((item, key) => {
      if (curTime >= item.releaseTime) {
        const hasLiveInput = this.activeLiveInputs.has(item.midi) && (this.activeLiveInputs.get(item.midi)?.size ?? 0) > 0;
        if (!hasLiveInput) {
          audioEngine.triggerRelease(item.midi);
        }
        this.noteOffListeners.forEach(cb => cb(item.midi, false, item.inputId));
        this.activeScheduledNotes.delete(key);
      }
    });

    // Throttled UI time update (~20Hz = 50ms) to prevent React state render flood
    const now = rafTimestamp ?? performance.now();
    if (now - this.lastUiUpdateTime >= 50) {
      this.lastUiUpdateTime = now;
      this.timeUpdateListeners.forEach(cb => cb(curTime, song.duration));
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

export const midiManager = new MidiManager();
