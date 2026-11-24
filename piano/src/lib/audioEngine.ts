/**
 * Lightweight Audio Engine powered by Tone.js
 *
 * - Salamander Grand Piano (Tone.Sampler)
 * - Hardcoded Reverb (50% wet) & Low-Pass Filter (2000 Hz)
 * - Sustain pedal handling
 */

import * as Tone from 'tone';
import { PIANO_KEYS_BY_MIDI } from './pianoGeometry';

const SALAMANDER_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

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

export type NoteSide = 'left' | 'right' | 'global';

class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  private reverb: Tone.Reverb | null = null;
  private lowPassFilter: Tone.Filter | null = null;

  private isInitialized = false;
  private isSamplerLoaded = false;
  private sustainState: Record<NoteSide, boolean> = {
    left: false,
    right: false,
    global: false,
  };
  private heldNotesBySide: Record<NoteSide, Map<number, number>> = {
    left: new Map(),
    right: new Map(),
    global: new Map(),
  };
  private sustainedNotesBySide: Record<NoteSide, Set<number>> = {
    left: new Set(),
    right: new Set(),
    global: new Set(),
  };
  private samplerReadyCallbacks: Array<() => void> = [];

  private initNodes() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.5 }).toDestination();
    this.lowPassFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2000,
      rolloff: -12,
    }).connect(this.reverb);

    this.sampler = new Tone.Sampler({
      urls: SAMPLE_MAP,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1.2,
      onload: () => {
        this.isSamplerLoaded = true;
        this.samplerReadyCallbacks.forEach((cb) => cb());
        this.samplerReadyCallbacks = [];
      },
    }).connect(this.lowPassFilter);
  }

  public preload(): void {
    if (typeof window === 'undefined') return;
    this.initNodes();
  }

  public async ensureAudioStarted(): Promise<void> {
    if (typeof window === 'undefined') return;
    this.initNodes();
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
  }

  public getIsSamplerLoaded(): boolean {
    return this.isSamplerLoaded;
  }

  public onSamplerReady(cb: () => void): () => void {
    if (this.isSamplerLoaded) {
      cb();
      return () => {};
    }
    this.samplerReadyCallbacks.push(cb);
    return () => {
      this.samplerReadyCallbacks = this.samplerReadyCallbacks.filter((c) => c !== cb);
    };
  }

  private getNoteName(midi: number): string {
    return PIANO_KEYS_BY_MIDI[midi]?.name ?? Tone.Frequency(midi, 'midi').toNote();
  }

  private isMidiActiveAnywhere(midi: number): boolean {
    const sides: NoteSide[] = ['left', 'right', 'global'];
    return sides.some(
      (s) => (this.heldNotesBySide[s].get(midi) ?? 0) > 0 || this.sustainedNotesBySide[s].has(midi)
    );
  }

  private triggerReleaseAudio(midi: number) {
    const noteName = this.getNoteName(midi);
    if (this.isSamplerLoaded && this.sampler) {
      this.sampler.triggerRelease(noteName, Tone.now());
    }
  }

  public noteOn(midi: number, velocity = 0.8, side: NoteSide = 'global') {
    if (typeof window === 'undefined') return;
    this.initNodes();
    if (Tone.getContext().state !== 'running') {
      void Tone.start();
    }

    const noteName = this.getNoteName(midi);
    const vel = Math.max(0.05, Math.min(1, velocity));

    const heldCount = this.heldNotesBySide[side].get(midi) ?? 0;
    this.heldNotesBySide[side].set(midi, heldCount + 1);
    this.sustainedNotesBySide[side].delete(midi);

    if (this.isSamplerLoaded && this.sampler) {
      this.sampler.triggerAttack(noteName, Tone.now(), vel);
    }
  }

  public noteOff(midi: number, side: NoteSide = 'global') {
    if (!this.isInitialized) return;
    const heldCount = this.heldNotesBySide[side].get(midi) ?? 0;
    if (heldCount > 1) {
      this.heldNotesBySide[side].set(midi, heldCount - 1);
      return;
    }
    this.heldNotesBySide[side].delete(midi);

    const isSustained = this.sustainState.global || this.sustainState[side];
    if (isSustained) {
      if (heldCount > 0) {
        this.sustainedNotesBySide[side].add(midi);
      }
      return;
    }

    if (!this.isMidiActiveAnywhere(midi)) {
      this.triggerReleaseAudio(midi);
    }
  }

  public setSustainPedal(active: boolean, side: NoteSide = 'global') {
    this.sustainState[side] = active;
    if (active) return;

    const sidesToFlush: NoteSide[] = side === 'global' ? ['left', 'right', 'global'] : [side];
    for (const targetSide of sidesToFlush) {
      if (this.sustainState.global || this.sustainState[targetSide]) continue;
      if (this.sustainedNotesBySide[targetSide].size === 0) continue;

      const notesToRelease = Array.from(this.sustainedNotesBySide[targetSide]);
      this.sustainedNotesBySide[targetSide].clear();
      for (const midi of notesToRelease) {
        if (!this.isMidiActiveAnywhere(midi)) {
          this.triggerReleaseAudio(midi);
        }
      }
    }
  }

  public releaseAll() {
    (['left', 'right', 'global'] as NoteSide[]).forEach((s) => {
      this.heldNotesBySide[s].clear();
      this.sustainedNotesBySide[s].clear();
    });
    this.sampler?.releaseAll();
  }
}

export const audioEngine = new AudioEngine();
