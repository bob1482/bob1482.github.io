/**
 * Audio Engine powered by Tone.js & Web Audio API
 * 
 * Features:
 * - High-Fidelity Salamander Grand Piano Soundfont (Tone.Sampler)
 * - Immediate fallback PolySynth for zero-latency instant startup
 * - Tone.Reverb with wet/dry and decay controls
 * - Global sustain pedal handling (holding notes until pedal release)
 * - First-interaction audio context unlocking
 */

import * as Tone from 'tone';
import { PIANO_KEYS_BY_MIDI } from './pianoGeometry';
import { SustainMode, SoundInstrument } from './settings';

export interface InstrumentInfo {
  id: SoundInstrument;
  name: string;
  category: 'piano' | 'strings';
  description: string;
}

export const AVAILABLE_INSTRUMENTS: InstrumentInfo[] = [
  {
    id: 'salamander',
    name: 'Grand Piano (Salamander)',
    category: 'piano',
    description: 'High-fidelity acoustic grand piano sample library',
  },
  {
    id: 'string_ensemble_1',
    name: 'String Ensemble 1 (FluidR3 GM)',
    category: 'strings',
    description: 'Lush orchestral string ensemble soundfont',
  },
];

// CDN base for Salamander Grand Piano samples
const SALAMANDER_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

// High quality sample distribution covering the full 84-key range
const SAMPLE_MAP: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
};

export interface VoiceCounts {
  sustained: number;
  held: number;
  total: number;
}

type VoiceCountListener = (counts: VoiceCounts) => void;

class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  private samplers: Map<SoundInstrument, Tone.Sampler> = new Map();
  private loadedInstruments: Set<SoundInstrument> = new Set();
  private loadingPromises: Map<SoundInstrument, Promise<Tone.Sampler>> = new Map();
  private currentInstrument: SoundInstrument = 'salamander';
  private stringAttack: number = 0.10;
  private stringRelease: number = 1.20;

  private fallbackSynth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private lowPassFilter: Tone.Filter | null = null;
  private mainVolume: Tone.Volume | null = null;
  
  private isLowPassFilterActive = false;
  private lowPassCutoff = 2200;
  
  private isAudioUnlocked = false;
  private isSamplerLoaded = false;
  private loadCallbacks: Array<(loaded: boolean) => void> = [];
  private voiceCountListeners: VoiceCountListener[] = [];
  private lastNotifiedSustained = -1;
  private lastNotifiedHeld = -1;
  private voiceNotifyScheduled = false;

  // Maximum Real Voices Cap (Polyphony limit)
  private maxVoices = 64;

  // Sustain Pedal State ('full' | 'half' | 'off')
  private sustainPedal: SustainMode = 'half';
  private halfSustainTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly HALF_SUSTAIN_DECAY_MS = 2200; // ~2.2s gentle decay before damper engages
  private currentVolumeDb = 0;
  private isSongMuted = false;
  private keyboardVolumeDb = 0;
  private isKeyboardMuted = false;
  private midiInputVolumeDb = 0;
  private isMidiInputMuted = false;
  private metronomeGainNode: GainNode | null = null;
  private metronomeVolumeDb = 0;
  private isMetronomeMuted = false;
  private currentReverbWet = 0.35;
  // Notes currently physically pressed down
  private heldNotes = new Set<string>();
  // Notes that have been released by keyup but kept ringing because sustain was ON
  private sustainedNotes = new Set<string>();

  constructor() {
    // Lazy initialize on first interaction or explicitly
  }

  public preload(): void {
    if (typeof window === 'undefined') return;
    if (this.mainVolume) return;

    // Master volume node (fixed at nominal 0dB headroom, source velocities scaled individually)
    this.mainVolume = new Tone.Volume(0).toDestination();

    // Warm & Cozy Low-Pass Filter node
    this.lowPassFilter = new Tone.Filter({
      frequency: this.isLowPassFilterActive ? this.lowPassCutoff : 20000,
      type: 'lowpass',
      rolloff: -12,
      Q: 0.8,
    });
    this.lowPassFilter.connect(this.mainVolume);

    // Metronome dedicated GainNode (dry path directly to audio destination)
    try {
      const rawCtx = (Tone.context.rawContext as AudioContext) || (Tone.context as unknown as AudioContext);
      if (rawCtx) {
        this.metronomeGainNode = rawCtx.createGain();
        this.updateMetronomeGain();
        this.metronomeGainNode.connect(rawCtx.destination);
      }
    } catch {
      // Safe fallback
    }

    // Reverb effect node
    this.reverb = new Tone.Reverb({
      decay: 2.8,
      preDelay: 0.01,
      wet: this.currentReverbWet,
    });
    this.reverb.connect(this.lowPassFilter);

    // Fallback synth for instant playability
    this.fallbackSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.005,
        decay: 1.5,
        sustain: 0.15,
        release: 0.8,
      },
      volume: -4,
    }).connect(this.reverb);
    this.fallbackSynth.maxPolyphony = this.maxVoices || 64;

    // Trigger loading of current instrument
    this.setInstrument(this.currentInstrument);
  }

  private async loadSalamanderSampler(): Promise<Tone.Sampler> {
    return new Promise((resolve, reject) => {
      try {
        const sampler = new Tone.Sampler({
          urls: SAMPLE_MAP,
          baseUrl: SALAMANDER_BASE_URL,
          release: 1.2,
          onload: () => {
            this.loadedInstruments.add('salamander');
            resolve(sampler);
          },
          onerror: (err) => {
            console.warn('Salamander soundfont sample loading error:', err);
            reject(err);
          },
        });
        if (this.reverb) {
          sampler.connect(this.reverb);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  private async loadStringEnsembleSampleMap(): Promise<Record<string, string>> {
    const urls = [
      'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/string_ensemble_1-mp3.js',
      'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/string_ensemble_1-mp3.js',
    ];
    let rawText: string | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          rawText = await res.text();
          break;
        }
      } catch (e) {
        console.warn(`Failed to fetch string_ensemble_1 from ${url}:`, e);
      }
    }
    if (!rawText) {
      throw new Error('Could not fetch string_ensemble_1 soundfont data from CDNs');
    }
    const fn = new Function(`
      var MIDI = { Soundfont: {} };
      ${rawText}
      return MIDI.Soundfont.string_ensemble_1;
    `);
    const sampleMap = fn();
    if (!sampleMap || typeof sampleMap !== 'object') {
      throw new Error('Invalid string_ensemble_1 sample data structure');
    }
    return sampleMap as Record<string, string>;
  }

  private async loadStringEnsembleSampler(): Promise<Tone.Sampler> {
    const sampleMap = await this.loadStringEnsembleSampleMap();
    return new Promise((resolve, reject) => {
      try {
        const sampler = new Tone.Sampler({
          urls: sampleMap,
          attack: this.stringAttack,
          release: this.stringRelease,
          onload: () => {
            this.loadedInstruments.add('string_ensemble_1');
            resolve(sampler);
          },
          onerror: (err) => {
            console.warn('String ensemble soundfont sample loading error:', err);
            reject(err);
          },
        });
        if (this.reverb) {
          sampler.connect(this.reverb);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Set active sound instrument ('salamander' | 'string_ensemble_1')
   */
  public async setInstrument(instrument: SoundInstrument): Promise<boolean> {
    this.currentInstrument = instrument;
    if (instrument === 'string_ensemble_1') {
      this.setSustainPedal('off');
    }

    if (typeof window !== 'undefined' && !this.mainVolume) {
      this.preload();
      return true;
    }

    // If already loaded in cache:
    if (this.samplers.has(instrument) && this.loadedInstruments.has(instrument)) {
      this.sampler = this.samplers.get(instrument)!;
      this.isSamplerLoaded = true;
      this.loadCallbacks.forEach(cb => cb(true));
      return true;
    }

    // Not yet loaded: notify loading status
    this.isSamplerLoaded = false;
    this.loadCallbacks.forEach(cb => cb(false));

    try {
      let promise = this.loadingPromises.get(instrument);
      if (!promise) {
        if (instrument === 'string_ensemble_1') {
          promise = this.loadStringEnsembleSampler();
        } else {
          promise = this.loadSalamanderSampler();
        }
        this.loadingPromises.set(instrument, promise);
      }

      const sampler = await promise;
      this.samplers.set(instrument, sampler);

      if (this.currentInstrument === instrument) {
        this.sampler = sampler;
        this.isSamplerLoaded = true;
        this.loadCallbacks.forEach(cb => cb(true));
      }
      return true;
    } catch (e) {
      console.warn(`Error loading instrument ${instrument}:`, e);
      if (this.currentInstrument === instrument) {
        this.isSamplerLoaded = false;
        this.loadCallbacks.forEach(cb => cb(false));
      }
      return false;
    }
  }

  public getInstrument(): SoundInstrument {
    return this.currentInstrument;
  }

  public async initAudio(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    this.preload();

    if (!this.isAudioUnlocked) {
      await Tone.start();
      Tone.context.lookAhead = 0.03; // Low latency
      this.isAudioUnlocked = true;
    }

    return true;
  }

  public onSamplerLoaded(callback: (loaded: boolean) => void): () => void {
    this.loadCallbacks.push(callback);
    if (this.isSamplerLoaded) {
      callback(true);
    }
    return () => {
      this.loadCallbacks = this.loadCallbacks.filter(cb => cb !== callback);
    };
  }

  public getIsSamplerLoaded(): boolean {
    return this.isSamplerLoaded;
  }

  public getIsAudioUnlocked(): boolean {
    return this.isAudioUnlocked;
  }

  /**
   * Converts MIDI number or note string to standard note name (e.g., 60 -> "C4")
   */
  private resolveNote(noteOrMidi: string | number): string {
    if (typeof noteOrMidi === 'number') {
      const key = PIANO_KEYS_BY_MIDI[noteOrMidi];
      return key ? key.name : Tone.Frequency(noteOrMidi, 'midi').toNote();
    }
    return noteOrMidi;
  }

  /**
   * Trigger note attack (supports live computer keyboard, hardware MIDI, and song playback sources)
   */
  public triggerAttack(
    noteOrMidi: string | number,
    velocity: number = 0.8,
    time?: number,
    source: 'keyboard' | 'midi' | 'song' = 'keyboard'
  ) {
    if (!this.isAudioUnlocked) {
      this.initAudio();
    }

    // Handle Muting and Volume Scaling per distinct source
    if (source === 'keyboard') {
      if (this.isKeyboardMuted || this.keyboardVolumeDb <= -30) {
        return;
      }
      const keyboardGain = Tone.dbToGain(this.keyboardVolumeDb);
      velocity = velocity * keyboardGain;
    } else if (source === 'midi') {
      if (this.isMidiInputMuted || this.midiInputVolumeDb <= -30) {
        return;
      }
      const midiGain = Tone.dbToGain(this.midiInputVolumeDb);
      velocity = velocity * midiGain;
    } else if (source === 'song') {
      if (this.isSongMuted || this.currentVolumeDb <= -30) {
        return;
      }
      const songGain = Tone.dbToGain(this.currentVolumeDb);
      velocity = velocity * songGain;
    }

    const note = this.resolveNote(noteOrMidi);
    const midiNumber = typeof noteOrMidi === 'number' ? noteOrMidi : Tone.Frequency(note).toMidi();

    // Release/damp any existing voices for this specific note before attacking anew
    this.releasePreviousVoices(note, midiNumber, time);

    // Clear any pending half-sustain decay timer for this note
    if (this.halfSustainTimers.has(note)) {
      clearTimeout(this.halfSustainTimers.get(note)!);
      this.halfSustainTimers.delete(note);
    }
    this.heldNotes.add(note);
    // If it was previously sustaining, remove it from sustained so it re-triggers cleanly
    this.sustainedNotes.delete(note);
    this.notifyVoiceCounts();

    const safeVelocity = Math.max(0.01, Math.min(2.0, velocity));

    // Cap maximum real voices before allocating new voice
    this.enforceMaxVoices();

    if (this.sampler && this.isSamplerLoaded) {
      try {
        if (time !== undefined) {
          this.sampler.triggerAttack(note, time, safeVelocity);
        } else {
          this.sampler.triggerAttack(note, Tone.now(), safeVelocity);
        }
      } catch (e) {
        console.warn('Sampler attack error:', e);
      }
    } else if (this.fallbackSynth) {
      try {
        if (time !== undefined) {
          this.fallbackSynth.triggerAttack(note, time, safeVelocity);
        } else {
          this.fallbackSynth.triggerAttack(note, Tone.now(), safeVelocity);
        }
      } catch (e) {
        console.warn('Synth attack error:', e);
      }
    }
  }

  /**
   * Release and damp previous audio voices for a specific note before re-triggering.
   * This ensures that repeatedly striking a note gracefully cuts/damps previous ringing instances of that note,
   * matching real piano physics and preventing runaway polyphony voice leaks.
   */
  private releasePreviousVoices(note: string, midi: number, time?: number): void {
    const triggerTime = time !== undefined ? time : Tone.now();

    if (this.sampler && this.isSamplerLoaded) {
      try {
        const activeSources = (this.sampler as any)._activeSources;
        if (activeSources instanceof Map && activeSources.has(midi)) {
          const sources = activeSources.get(midi);
          if (Array.isArray(sources) && sources.length > 0) {
            sources.forEach((source: any) => {
              try {
                // Apply a fast 40ms dampening fadeOut on repeated note strikes to prevent clicks and polyphony buildup
                if (source && typeof source.stop === 'function') {
                  source.fadeOut = 0.04;
                  source.stop(triggerTime);
                }
              } catch {
                // Safe catch
              }
            });
            activeSources.set(midi, []);
          }
        } else {
          this.sampler.triggerRelease(note, triggerTime);
        }
      } catch (e) {
        // Safe catch
      }
    }

    if (this.fallbackSynth) {
      try {
        const activeVoices = (this.fallbackSynth as any)._activeVoices;
        if (Array.isArray(activeVoices)) {
          activeVoices.forEach((ev: any) => {
            if (ev && ev.midi === midi && !ev.released && ev.voice) {
              try {
                ev.voice.triggerRelease(triggerTime);
                ev.released = true;
              } catch {}
            }
          });
        } else {
          this.fallbackSynth.triggerRelease(note, triggerTime);
        }
      } catch {
        // Safe catch
      }
    }
  }

  /**
   * Trigger note release
   */
  public triggerRelease(noteOrMidi: string | number, time?: number) {
    const note = this.resolveNote(noteOrMidi);
    this.heldNotes.delete(note);

    if (this.sustainPedal === 'full') {
      // Full sustain: keep note ringing indefinitely until pedal release or sample ends
      this.sustainedNotes.add(note);
      this.notifyVoiceCounts();
      return;
    }

    if (this.sustainPedal === 'half') {
      // Half sustain: keep note ringing for moderate decay duration (~2.2s) before dampening
      this.sustainedNotes.add(note);
      this.notifyVoiceCounts();
      this.scheduleHalfSustainRelease(note);
      return;
    }

    // Sustain off: damp note immediately
    this.notifyVoiceCounts();
    this.releaseSingleNote(note, time);
  }

  private scheduleHalfSustainRelease(note: string, delayMs = this.HALF_SUSTAIN_DECAY_MS): void {
    if (typeof window === 'undefined') return;

    if (this.halfSustainTimers.has(note)) {
      clearTimeout(this.halfSustainTimers.get(note)!);
      this.halfSustainTimers.delete(note);
    }

    const timer = setTimeout(() => {
      this.halfSustainTimers.delete(note);
      // Damp only if the key is not currently held down and sustain is still half
      if (!this.heldNotes.has(note) && this.sustainPedal === 'half') {
        this.sustainedNotes.delete(note);
        this.releaseSingleNote(note);
        this.notifyVoiceCounts();
      }
    }, delayMs);

    this.halfSustainTimers.set(note, timer);
  }

  private clearAllHalfSustainTimers(): void {
    this.halfSustainTimers.forEach(timer => clearTimeout(timer));
    this.halfSustainTimers.clear();
  }

  private releaseSingleNote(note: string, time?: number) {
    const triggerTime = time !== undefined ? time : Tone.now();

    if (this.sampler && this.isSamplerLoaded) {
      try {
        this.sampler.triggerRelease(note, triggerTime);
      } catch (e) {
        // Safe catch
      }
    }
    if (this.fallbackSynth) {
      try {
        const activeVoices = (this.fallbackSynth as any)._activeVoices;
        if (Array.isArray(activeVoices)) {
          const midiVal = Tone.Frequency(note).toMidi();
          activeVoices.forEach((ev: any) => {
            if (ev && ev.midi === midiVal && !ev.released && ev.voice) {
              try {
                ev.voice.triggerRelease(triggerTime);
                ev.released = true;
              } catch {}
            }
          });
        } else {
          this.fallbackSynth.triggerRelease(note, triggerTime);
        }
      } catch (e) {
        // Safe catch
      }
    }
  }

  /**
   * Set sustain pedal state ('full' | 'half' | 'off' or boolean)
   */
  public setSustainPedal(modeOrActive: SustainMode | boolean) {
    const mode: SustainMode =
      typeof modeOrActive === 'boolean'
        ? modeOrActive
          ? 'full'
          : 'off'
        : modeOrActive;

    // In string ensemble mode, sustain is disabled and forced to 'off'
    if (this.currentInstrument === 'string_ensemble_1' && mode !== 'off') {
      return;
    }

    this.sustainPedal = mode;

    if (mode === 'off') {
      // Pedal released: damp all notes that are not currently held down
      this.clearAllHalfSustainTimers();
      const notesToRelease = Array.from(this.sustainedNotes);
      this.sustainedNotes.clear();
      this.notifyVoiceCounts(true);

      notesToRelease.forEach(note => {
        if (!this.heldNotes.has(note)) {
          this.releaseSingleNote(note);
        }
      });

      // Ensure any lingering unheld voices in sampler are also cleanly stopped
      if (this.sampler && this.isSamplerLoaded) {
        try {
          const activeSources = (this.sampler as any)._activeSources;
          if (activeSources instanceof Map) {
            activeSources.forEach((sources: any[], midi: number) => {
              const noteName = this.resolveNote(midi);
              if (!this.heldNotes.has(noteName) && Array.isArray(sources) && sources.length > 0) {
                this.releaseSingleNote(noteName);
              }
            });
          }
        } catch {
          // Safe catch
        }
      }
    } else if (mode === 'half') {
      // Switched to Half: schedule decay for any ringing notes not currently physically held
      this.clearAllHalfSustainTimers();
      this.sustainedNotes.forEach(note => {
        if (!this.heldNotes.has(note)) {
          this.scheduleHalfSustainRelease(note);
        }
      });
      this.notifyVoiceCounts();
    } else if (mode === 'full') {
      // Switched to Full: cancel all half decay timers so notes ring out freely
      this.clearAllHalfSustainTimers();
      this.notifyVoiceCounts();
    }
  }

  public getSustainPedal(): SustainMode {
    return this.sustainPedal;
  }

  /**
   * Enforce maximum polyphony voice limit (graceful voice stealing for oldest voices)
   */
  private enforceMaxVoices(): void {
    if (this.maxVoices <= 0) return; // 0 = unlimited

    if (this.sampler && this.isSamplerLoaded) {
      const activeSources = (this.sampler as any)._activeSources;
      if (activeSources instanceof Map) {
        let total = 0;
        const allItems: Array<{ midi: number; source: any }> = [];
        activeSources.forEach((sources: any[], midi: number) => {
          if (Array.isArray(sources)) {
            total += sources.length;
            sources.forEach(s => allItems.push({ midi, source: s }));
          }
        });

        if (total >= this.maxVoices) {
          const excess = total - this.maxVoices + 1;
          for (let i = 0; i < excess && i < allItems.length; i++) {
            const { midi, source } = allItems[i];
            try {
              // Immediately remove from active sources map so the polyphony slot is freed instantly
              const sources = activeSources.get(midi);
              if (Array.isArray(sources)) {
                const idx = sources.indexOf(source);
                if (idx !== -1) {
                  sources.splice(idx, 1);
                }
              }
              // Immediately stop the stolen audio source with quick fade
              if (source && typeof source.stop === 'function') {
                source.fadeOut = 0.03;
                source.stop(Tone.now());
              }
            } catch {
              // Safe catch
            }
          }
        }
      }
    } else if (this.fallbackSynth) {
      try {
        (this.fallbackSynth as any).maxPolyphony = this.maxVoices;
      } catch {
        // Safe catch
      }
    }
  }

  /**
   * Set maximum real voices cap (0 for unlimited)
   */
  public setMaxVoices(limit: number) {
    this.maxVoices = Math.max(0, limit);
    if (this.fallbackSynth) {
      try {
        (this.fallbackSynth as any).maxPolyphony = this.maxVoices || 64;
      } catch {
        // Safe
      }
    }
  }

  public getMaxVoices(): number {
    return this.maxVoices;
  }

  /**
   * Get the count of real in-use Web Audio voices actively generating sound
   */
  public getActiveVoiceCount(): number {
    if (this.sampler && this.isSamplerLoaded) {
      const activeSources = (this.sampler as any)._activeSources;
      if (activeSources instanceof Map) {
        let total = 0;
        activeSources.forEach((sources: any[]) => {
          if (Array.isArray(sources)) {
            total += sources.length;
          }
        });
        return total;
      }
    }
    if (this.fallbackSynth) {
      return (this.fallbackSynth as any).activeVoices || 0;
    }
    return 0;
  }

  /**
   * Notify voice count listeners of changes (batched via RAF for smooth high-rate playback)
   */
  private notifyVoiceCounts(immediate = false): void {
    if (typeof window === 'undefined') return;
    if (this.voiceCountListeners.length === 0) return;

    const currentSustained = this.sustainedNotes.size;
    const currentHeld = this.heldNotes.size;

    if (currentSustained === this.lastNotifiedSustained && currentHeld === this.lastNotifiedHeld) {
      return;
    }

    if (immediate) {
      this.lastNotifiedSustained = currentSustained;
      this.lastNotifiedHeld = currentHeld;
      const counts: VoiceCounts = {
        sustained: currentSustained,
        held: currentHeld,
        total: currentSustained + currentHeld,
      };
      this.voiceCountListeners.forEach(cb => cb(counts));
      return;
    }

    if (!this.voiceNotifyScheduled) {
      this.voiceNotifyScheduled = true;
      const scheduleFn = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(cb, 16);
      scheduleFn(() => {
        this.voiceNotifyScheduled = false;
        const sustained = this.sustainedNotes.size;
        const held = this.heldNotes.size;
        this.lastNotifiedSustained = sustained;
        this.lastNotifiedHeld = held;
        const counts: VoiceCounts = {
          sustained,
          held,
          total: sustained + held,
        };
        this.voiceCountListeners.forEach(cb => cb(counts));
      });
    }
  }

  public getSustainedVoiceCount(): number {
    return this.sustainedNotes.size;
  }

  public getHeldVoiceCount(): number {
    return this.heldNotes.size;
  }

  public getTotalVoiceCount(): number {
    return this.sustainedNotes.size + this.heldNotes.size;
  }

  public onVoiceCountChange(callback: VoiceCountListener): () => void {
    this.voiceCountListeners.push(callback);
    callback({
      sustained: this.sustainedNotes.size,
      held: this.heldNotes.size,
      total: this.sustainedNotes.size + this.heldNotes.size,
    });
    return () => {
      this.voiceCountListeners = this.voiceCountListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Set Reverb wet amount (0.0 to 1.0)
   */
  public setReverbWet(wet: number) {
    this.currentReverbWet = Math.max(0, Math.min(1, wet));
    if (this.reverb) {
      this.reverb.wet.value = this.currentReverbWet;
    }
  }

  public getReverbWet(): number {
    return this.currentReverbWet;
  }

  /**
   * Set Low-Pass Filter Active State (Warm & Cozy tone mode)
   */
  public setLowPassFilterActive(active: boolean) {
    this.isLowPassFilterActive = active;
    if (this.lowPassFilter) {
      const targetFreq = active ? this.lowPassCutoff : 20000;
      try {
        this.lowPassFilter.frequency.rampTo(targetFreq, 0.06);
      } catch {
        this.lowPassFilter.frequency.value = targetFreq;
      }
    }
  }

  public getIsLowPassFilterActive(): boolean {
    return this.isLowPassFilterActive;
  }

  /**
   * Set Low-Pass Filter Cutoff Frequency in Hz (400 Hz to 12000 Hz)
   */
  public setLowPassCutoff(cutoff: number) {
    this.lowPassCutoff = Math.max(200, Math.min(12000, cutoff));
    if (this.lowPassFilter && this.isLowPassFilterActive) {
      try {
        this.lowPassFilter.frequency.rampTo(this.lowPassCutoff, 0.04);
      } catch {
        this.lowPassFilter.frequency.value = this.lowPassCutoff;
      }
    }
  }

  public getLowPassCutoff(): number {
    return this.lowPassCutoff;
  }

  /**
   * Set MIDI File Volume in dB (-30 to +6)
   */
  public setVolume(volumeDb: number) {
    this.currentVolumeDb = volumeDb;
  }

  public getVolume(): number {
    return this.currentVolumeDb;
  }

  public setSongMuted(muted: boolean) {
    this.isSongMuted = muted;
  }

  public getIsSongMuted(): boolean {
    return this.isSongMuted;
  }

  /**
   * Set Computer Keyboard / UI Piano Volume in dB (-30 to +6)
   */
  public setKeyboardVolume(volumeDb: number) {
    this.keyboardVolumeDb = volumeDb;
  }

  public getKeyboardVolume(): number {
    return this.keyboardVolumeDb;
  }

  /**
   * Set Computer Keyboard Mute State
   */
  public setKeyboardMuted(muted: boolean) {
    this.isKeyboardMuted = muted;
  }

  public getIsKeyboardMuted(): boolean {
    return this.isKeyboardMuted;
  }

  /**
   * Set MIDI Hardware / Web MIDI Input Volume in dB (-30 to +6)
   */
  public setMidiInputVolume(volumeDb: number) {
    this.midiInputVolumeDb = volumeDb;
  }

  public getMidiInputVolume(): number {
    return this.midiInputVolumeDb;
  }

  /**
   * Set MIDI Hardware / Web MIDI Input Mute State
   */
  public setMidiInputMuted(muted: boolean) {
    this.isMidiInputMuted = muted;
  }

  public getIsMidiInputMuted(): boolean {
    return this.isMidiInputMuted;
  }

  private updateMetronomeGain(): void {
    if (!this.metronomeGainNode) return;
    try {
      const rawCtx = (Tone.context.rawContext as AudioContext) || (Tone.context as unknown as AudioContext);
      if (rawCtx) {
        const gainVal = this.isMetronomeMuted ? 0 : Math.pow(10, this.metronomeVolumeDb / 20);
        this.metronomeGainNode.gain.setValueAtTime(gainVal, rawCtx.currentTime);
      }
    } catch {
      // Safe fallback
    }
  }

  public setMetronomeMuted(muted: boolean): void {
    this.isMetronomeMuted = muted;
    this.updateMetronomeGain();
  }

  public getIsMetronomeMuted(): boolean {
    return this.isMetronomeMuted;
  }

  public setMetronomeVolume(volumeDb: number): void {
    this.metronomeVolumeDb = Math.max(-10, Math.min(10, volumeDb));
    this.updateMetronomeGain();
  }

  public getMetronomeVolume(): number {
    return this.metronomeVolumeDb;
  }

  /**
   * Synthesizes and plays an authentic crisp metronome click/woodblock sound.
   * Uses Web Audio hardware clock time if provided, or current time.
   * @param isAccent When true, generates a higher-pitched, brighter downbeat tick (Beat 1).
   * @param time Scheduled audio time in seconds (optional).
   */
  public playMetronomeTick(isAccent: boolean, time?: number): void {
    if (this.isMetronomeMuted) return;
    if (typeof window === 'undefined') return;

    try {
      const rawCtx = (Tone.context.rawContext as AudioContext) || (Tone.context as unknown as AudioContext);
      if (!rawCtx || rawCtx.state !== 'running') return;

      if (!this.metronomeGainNode) {
        this.metronomeGainNode = rawCtx.createGain();
        this.updateMetronomeGain();
        this.metronomeGainNode.connect(rawCtx.destination);
      }

      const startTime = time !== undefined ? Math.max(time, rawCtx.currentTime) : rawCtx.currentTime;

      // Frequency parameters: Accent (Beat 1) vs regular beats
      // Beat 1: crisp high transient 1760 Hz (A6) sweeping down to 880 Hz (A5)
      // Off beats: 1175 Hz (D6) sweeping down to 587 Hz (D5)
      const startFreq = isAccent ? 1760 : 1175;
      const endFreq = isAccent ? 880 : 587;
      const decayDuration = isAccent ? 0.035 : 0.025;
      const peakGain = isAccent ? 0.85 : 0.55;

      const osc = rawCtx.createOscillator();
      const envelopeGain = rawCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + 0.018);

      envelopeGain.gain.setValueAtTime(0.0001, startTime);
      envelopeGain.gain.linearRampToValueAtTime(peakGain, startTime + 0.001);
      envelopeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decayDuration);

      osc.connect(envelopeGain);
      envelopeGain.connect(this.metronomeGainNode);

      osc.start(startTime);
      osc.stop(startTime + decayDuration + 0.01);
    } catch {
      // Safe catch for audio glitches
    }
  }

  /**
   * Set String Ensemble Attack Time in seconds (0.00s to 2.00s)
   */
  public setStringAttack(attack: number) {
    this.stringAttack = Math.max(0, Math.min(2.0, attack));
    const stringSampler = this.samplers.get('string_ensemble_1');
    if (stringSampler) {
      try {
        stringSampler.attack = this.stringAttack;
      } catch {
        // Safe catch
      }
    }
  }

  public getStringAttack(): number {
    return this.stringAttack;
  }

  /**
   * Set String Ensemble Release Time in seconds (0.05s to 5.00s)
   */
  public setStringRelease(release: number) {
    this.stringRelease = Math.max(0.05, Math.min(5.0, release));
    const stringSampler = this.samplers.get('string_ensemble_1');
    if (stringSampler) {
      try {
        stringSampler.release = this.stringRelease;
      } catch {
        // Safe catch
      }
    }
  }

  public getStringRelease(): number {
    return this.stringRelease;
  }

  /**
   * Release all currently active notes
   */
  public releaseAll() {
    this.clearAllHalfSustainTimers();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
    this.notifyVoiceCounts(true);
    if (this.sampler && this.isSamplerLoaded) {
      try {
        this.sampler.releaseAll();
      } catch (e) {
        // Safe
      }
    }
    if (this.fallbackSynth) {
      try {
        this.fallbackSynth.releaseAll();
      } catch (e) {
        // Safe
      }
    }
  }
}

// Global Singleton instance
export const audioEngine = new AudioEngine();
