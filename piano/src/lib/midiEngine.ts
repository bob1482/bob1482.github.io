/**
 * Lightweight Web MIDI Hardware Interface & MIDI File Sequencer
 */

import { Midi } from '@tonejs/midi';
import { audioEngine, NoteSide } from './audioEngine';
import { MIN_MIDI, MAX_MIDI } from './pianoGeometry';

export interface ParsedMidiNote {
  midi: number;
  name: string;
  time: number;
  duration: number;
  velocity: number;
  trackIndex: number;
  side: 'left' | 'right';
}

export interface MidiSong {
  id: string;
  title: string;
  duration: number;
  notes: ParsedMidiNote[];
}

interface WebMidiInputPort {
  id: string;
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}

interface WebMidiAccessObject {
  inputs: { values: () => IterableIterator<WebMidiInputPort> };
  onstatechange: (() => void) | null;
}

type NoteListener = (midi: number, velocity: number, isLiveInput: boolean, inputId?: string, side?: NoteSide) => void;
type NoteOffListener = (midi: number, isLiveInput: boolean, inputId?: string) => void;
type SustainListener = (active: boolean, side: NoteSide) => void;
type TimeUpdateListener = (currentTime: number, duration: number) => void;
type PlaybackStateListener = (isPlaying: boolean) => void;
type TransposeListener = (semitones: number) => void;

class MidiManager {
  private midiAccess: WebMidiAccessObject | null = null;

  private noteOnListeners: NoteListener[] = [];
  private noteOffListeners: NoteOffListener[] = [];
  private sustainListeners: SustainListener[] = [];
  private timeUpdateListeners: TimeUpdateListener[] = [];
  private playbackStateListeners: PlaybackStateListener[] = [];
  private transposeListeners: TransposeListener[] = [];

  private activeLiveInputs = new Map<number, Set<string>>();
  private activeMidiInputNotes = new Map<string, { midi: number; side: NoteSide; inputId: string }>();
  private lastMidiNoteOnTime = new Map<number, number>();

  private currentSong: MidiSong | null = null;
  private isPlaying = false;
  private playbackTime = 0;
  private lastTickTime = 0;
  private rafId: number | null = null;
  private songTranspose = 0;
  private midiInputTranspose = 0;

  private nextNoteIndex = 0;
  private activeSongNotes = new Map<string, { note: ParsedMidiNote; playedMidi: number }>();

  public async initWebMidi(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return;
    try {
      const requestMidi = (navigator as unknown as { requestMIDIAccess: () => Promise<WebMidiAccessObject> }).requestMIDIAccess;
      const access = await requestMidi.call(navigator);
      this.midiAccess = access;
      this.bindMidiInputs();
      access.onstatechange = () => this.bindMidiInputs();
    } catch {
      // Web MIDI unavailable or denied
    }
  }

  private bindMidiInputs() {
    if (!this.midiAccess) return;
    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = (event) => this.handleMidiMessage(event.data, input.id);
    }
  }

  private handleMidiMessage(data: Uint8Array, deviceId: string) {
    if (!data || data.length < 2) return;
    const status = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const side: NoteSide = channel === 1 ? 'right' : 'left';
    const data1 = data[1];
    const data2 = data.length > 2 ? data[2] : 0;
    const inputId = `midi:${deviceId}:${side}`;
    const noteKey = `${inputId}:${data1}`;

    if (status === 0x90 && data2 > 0) {
      const now = performance.now();
      const lastTime = this.lastMidiNoteOnTime.get(data1) ?? 0;
      if (now - lastTime < 20) return;
      this.lastMidiNoteOnTime.set(data1, now);
      const transposedMidi = data1 + this.midiInputTranspose;
      if (transposedMidi >= MIN_MIDI && transposedMidi <= MAX_MIDI) {
        this.activeMidiInputNotes.set(noteKey, { midi: transposedMidi, side, inputId });
        this.triggerLiveNoteOn(transposedMidi, data2 / 127, inputId, side);
      }
    } else if (status === 0x80 || (status === 0x90 && data2 === 0)) {
      const active = this.activeMidiInputNotes.get(noteKey);
      if (active) {
        this.activeMidiInputNotes.delete(noteKey);
        this.triggerLiveNoteOff(active.midi, active.inputId, active.side);
      } else {
        this.triggerLiveNoteOff(data1 + this.midiInputTranspose, inputId, side);
      }
    } else if (status === 0xb0 && data1 === 64) {
      const active = data2 >= 64;
      audioEngine.setSustainPedal(active, side);
      this.sustainListeners.forEach((cb) => cb(active, side));
    }
  }

  public triggerLiveNoteOn(midi: number, velocity = 0.8, inputId = 'local', side: NoteSide = 'global') {
    if (midi < MIN_MIDI || midi > MAX_MIDI) return;
    let inputs = this.activeLiveInputs.get(midi);
    if (!inputs) {
      inputs = new Set();
      this.activeLiveInputs.set(midi, inputs);
    }
    inputs.add(inputId);

    audioEngine.noteOn(midi, velocity, side);
    this.noteOnListeners.forEach((cb) => cb(midi, velocity, true, inputId, side));
  }

  public triggerLiveNoteOff(midi: number, inputId = 'local', side: NoteSide = 'global') {
    if (midi < MIN_MIDI || midi > MAX_MIDI) return;
    const inputs = this.activeLiveInputs.get(midi);
    if (inputs) {
      inputs.delete(inputId);
      if (inputs.size === 0) {
        this.activeLiveInputs.delete(midi);
      }
    }
    audioEngine.noteOff(midi, side);
    this.noteOffListeners.forEach((cb) => cb(midi, true, inputId));
  }

  public async parseMidiFile(file: File): Promise<MidiSong> {
    const buffer = await file.arrayBuffer();
    const midi = new Midi(buffer);

    const rawNotes: Array<Omit<ParsedMidiNote, 'side'>> = [];
    const trackPitchSums = new Map<number, { sum: number; count: number }>();

    midi.tracks.forEach((track, trackIndex) => {
      track.notes.forEach((n) => {
        if (n.midi >= MIN_MIDI && n.midi <= MAX_MIDI) {
          rawNotes.push({
            midi: n.midi,
            name: n.name,
            time: n.time,
            duration: Math.max(0.05, n.duration),
            velocity: n.velocity,
            trackIndex,
          });
          const entry = trackPitchSums.get(trackIndex) ?? { sum: 0, count: 0 };
          entry.sum += n.midi;
          entry.count += 1;
          trackPitchSums.set(trackIndex, entry);
        }
      });
    });

    let rightTrackIndex: number | null = null;
    if (trackPitchSums.size >= 2) {
      let highestAvg = -Infinity;
      for (const [idx, stats] of trackPitchSums.entries()) {
        const avg = stats.sum / stats.count;
        if (avg > highestAvg) {
          highestAvg = avg;
          rightTrackIndex = idx;
        }
      }
    }

    const notes: ParsedMidiNote[] = rawNotes.map((n) => ({
      ...n,
      side: rightTrackIndex !== null
        ? (n.trackIndex === rightTrackIndex ? 'right' : 'left')
        : (n.midi >= 60 ? 'right' : 'left'),
    }));

    notes.sort((a, b) => a.time - b.time);

    return {
      id: `upload-${Date.now()}`,
      title: file.name.replace(/\.(mid|midi)$/i, ''),
      duration: midi.duration || (notes.length > 0 ? Math.max(...notes.map((n) => n.time + n.duration)) : 0),
      notes,
    };
  }

  public loadSong(song: MidiSong) {
    this.stop();
    this.currentSong = song;
    this.playbackTime = 0;
    this.nextNoteIndex = 0;
    this.notifyTimeUpdate();
  }

  public clearSong() {
    this.stop();
    this.currentSong = null;
    this.playbackTime = 0;
    this.nextNoteIndex = 0;
    this.notifyTimeUpdate();
  }

  public getCurrentSong(): MidiSong | null {
    return this.currentSong;
  }

  public getPlaybackTime(): number {
    return this.playbackTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getSongTranspose(): number {
    return this.songTranspose;
  }

  public setSongTranspose(semitones: number) {
    const clamped = Math.max(-24, Math.min(24, Math.round(semitones)));
    if (this.songTranspose === clamped) return;
    this.releaseActiveSongNotes();
    this.songTranspose = clamped;
    this.transposeListeners.forEach((cb) => cb(clamped));
  }

  public getMidiInputTranspose(): number {
    return this.midiInputTranspose;
  }

  public setMidiInputTranspose(semitones: number) {
    const clamped = Math.max(-24, Math.min(24, Math.round(semitones)));
    if (this.midiInputTranspose === clamped) return;
    for (const active of this.activeMidiInputNotes.values()) {
      this.triggerLiveNoteOff(active.midi, active.inputId, active.side);
    }
    this.activeMidiInputNotes.clear();
    this.midiInputTranspose = clamped;
  }

  public play() {
    if (!this.currentSong || this.isPlaying) return;
    void audioEngine.ensureAudioStarted();

    if (this.playbackTime >= this.currentSong.duration) {
      this.seek(0);
    }

    this.isPlaying = true;
    this.lastTickTime = performance.now();
    this.playbackStateListeners.forEach((cb) => cb(true));
    this.tick();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.releaseActiveSongNotes();
    this.playbackStateListeners.forEach((cb) => cb(false));
  }

  public stop() {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.releaseActiveSongNotes();
    this.playbackTime = 0;
    this.nextNoteIndex = 0;
    this.playbackStateListeners.forEach((cb) => cb(false));
    this.notifyTimeUpdate();
  }

  public seek(time: number) {
    if (!this.currentSong) return;
    const clamped = Math.max(0, Math.min(this.currentSong.duration, time));
    this.releaseActiveSongNotes();
    this.playbackTime = clamped;

    const notes = this.currentSong.notes;
    let idx = 0;
    while (idx < notes.length && notes[idx].time < clamped) {
      idx++;
    }
    this.nextNoteIndex = idx;
    this.notifyTimeUpdate();
  }

  private releaseActiveSongNotes() {
    for (const [key, entry] of this.activeSongNotes.entries()) {
      audioEngine.noteOff(entry.playedMidi);
      this.noteOffListeners.forEach((cb) => cb(entry.playedMidi, false, `song:${key}`));
    }
    this.activeSongNotes.clear();
  }

  private tick = () => {
    if (!this.isPlaying || !this.currentSong) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;
    this.playbackTime += dt;

    const notes = this.currentSong.notes;

    // Trigger newly started notes
    while (this.nextNoteIndex < notes.length && notes[this.nextNoteIndex].time <= this.playbackTime) {
      const note = notes[this.nextNoteIndex];
      const playedMidi = note.midi + this.songTranspose;
      if (playedMidi >= MIN_MIDI && playedMidi <= MAX_MIDI) {
        const key = `${this.nextNoteIndex}`;
        this.activeSongNotes.set(key, { note, playedMidi });
        audioEngine.noteOn(playedMidi, note.velocity);
        this.noteOnListeners.forEach((cb) => cb(playedMidi, note.velocity, false, `song:${key}`, note.side));
      }
      this.nextNoteIndex++;
    }

    // Release finished notes
    for (const [key, entry] of this.activeSongNotes.entries()) {
      if (entry.note.time + entry.note.duration <= this.playbackTime) {
        this.activeSongNotes.delete(key);
        audioEngine.noteOff(entry.playedMidi);
        this.noteOffListeners.forEach((cb) => cb(entry.playedMidi, false, `song:${key}`));
      }
    }

    this.notifyTimeUpdate();

    if (this.playbackTime >= this.currentSong.duration && this.activeSongNotes.size === 0) {
      this.pause();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private notifyTimeUpdate() {
    const dur = this.currentSong?.duration ?? 0;
    this.timeUpdateListeners.forEach((cb) => cb(this.playbackTime, dur));
  }

  public onNoteOn(cb: NoteListener) {
    this.noteOnListeners.push(cb);
    return () => {
      this.noteOnListeners = this.noteOnListeners.filter((l) => l !== cb);
    };
  }

  public onNoteOff(cb: NoteOffListener) {
    this.noteOffListeners.push(cb);
    return () => {
      this.noteOffListeners = this.noteOffListeners.filter((l) => l !== cb);
    };
  }

  public onSustainChange(cb: SustainListener) {
    this.sustainListeners.push(cb);
    return () => {
      this.sustainListeners = this.sustainListeners.filter((l) => l !== cb);
    };
  }

  public onTimeUpdate(cb: TimeUpdateListener) {
    this.timeUpdateListeners.push(cb);
    return () => {
      this.timeUpdateListeners = this.timeUpdateListeners.filter((l) => l !== cb);
    };
  }

  public onPlaybackStateChange(cb: PlaybackStateListener) {
    this.playbackStateListeners.push(cb);
    return () => {
      this.playbackStateListeners = this.playbackStateListeners.filter((l) => l !== cb);
    };
  }

  public onTransposeChange(cb: TransposeListener) {
    this.transposeListeners.push(cb);
    return () => {
      this.transposeListeners = this.transposeListeners.filter((l) => l !== cb);
    };
  }
}

export const midiManager = new MidiManager();
