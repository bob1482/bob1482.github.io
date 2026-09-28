/**
 * High-Precision Metronome Engine
 * 
 * Uses Web Audio hardware clock lookahead scheduling to deliver
 * sample-accurate metronome clicks with zero drift and zero UI thread jitter.
 * Synchronizes audio clicks with visual pulse & beat counter callbacks.
 */

import * as Tone from 'tone';
import { audioEngine } from './audioEngine';

export type BeatListener = (beat: number, isAccent: boolean) => void;
export type FlashListener = (isFlashing: boolean) => void;

class MetronomeEngine {
  private bpm: number = 120;
  private beatsPerBar: number = 4;
  private isSoundEnabled: boolean = true;
  private volumeDb: number = 0;

  private isRunning: boolean = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private flashTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Web Audio lookahead scheduler state
  private nextNoteTime: number = 0;
  private currentBeatIndex: number = 0; // 0-indexed internally (0 to beatsPerBar - 1)
  private readonly LOOKAHEAD_MS = 25; // Check interval
  private readonly SCHEDULE_AHEAD_SEC = 0.1; // Schedule window ahead in seconds

  private beatListeners: Set<BeatListener> = new Set();
  private flashListeners: Set<FlashListener> = new Set();

  constructor() {
    // Initialized with default settings
  }

  public onBeat(listener: BeatListener): () => void {
    this.beatListeners.add(listener);
    return () => this.beatListeners.delete(listener);
  }

  public onFlash(listener: FlashListener): () => void {
    this.flashListeners.add(listener);
    return () => this.flashListeners.delete(listener);
  }

  private notifyBeat(beat: number, isAccent: boolean): void {
    this.beatListeners.forEach(listener => {
      try {
        listener(beat, isAccent);
      } catch {
        // Safe
      }
    });
  }

  private notifyFlash(isFlashing: boolean): void {
    this.flashListeners.forEach(listener => {
      try {
        listener(isFlashing);
      } catch {
        // Safe
      }
    });
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      return ((Tone.context.rawContext as AudioContext) || (Tone.context as unknown as AudioContext)) ?? null;
    } catch {
      return null;
    }
  }

  private getCurrentTime(): number {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'running') {
      return ctx.currentTime;
    }
    return performance.now() / 1000;
  }

  /**
   * Lookahead Scheduler Loop: Runs every 25ms and schedules any beats
   * falling into the upcoming 100ms window.
   */
  private scheduler = (): void => {
    if (!this.isRunning) return;

    const ctx = this.getAudioContext();
    const currentTime = this.getCurrentTime();

    while (this.nextNoteTime < currentTime + this.SCHEDULE_AHEAD_SEC) {
      const isAccent = this.currentBeatIndex === 0;
      const beatNumber = this.currentBeatIndex + 1; // 1-indexed for display
      const scheduledTime = this.nextNoteTime;

      // 1. Schedule Audio Click on Web Audio timeline
      if (this.isSoundEnabled && ctx && ctx.state === 'running') {
        audioEngine.playMetronomeTick(isAccent, scheduledTime);
      }

      // 2. Schedule Visual callback to fire at the exact note moment
      const delayMs = Math.max(0, (scheduledTime - currentTime) * 1000);
      const flashDurationMs = Math.min(120, Math.max(50, (60 / this.bpm) * 1000 * 0.25));

      setTimeout(() => {
        if (!this.isRunning) return;
        this.notifyBeat(beatNumber, isAccent);
        this.notifyFlash(true);

        if (this.flashTimeoutId) clearTimeout(this.flashTimeoutId);
        this.flashTimeoutId = setTimeout(() => {
          if (!this.isRunning) return;
          this.notifyFlash(false);
        }, flashDurationMs);
      }, delayMs);

      // Advance to next beat
      const secondsPerBeat = 60.0 / Math.max(20, Math.min(300, this.bpm));
      this.nextNoteTime += secondsPerBeat;
      this.currentBeatIndex = (this.currentBeatIndex + 1) % Math.max(1, this.beatsPerBar);
    }
  };

  /**
   * Start the metronome
   */
  public start(bpm?: number, beats?: number): void {
    if (bpm) this.bpm = bpm;
    if (beats) this.beatsPerBar = beats;

    if (this.isRunning) return;
    this.isRunning = true;

    this.currentBeatIndex = 0;
    const currentTime = this.getCurrentTime();
    // Start immediately on first tick with tiny 20ms lead-in
    this.nextNoteTime = currentTime + 0.02;

    this.scheduler();
    this.timerId = setInterval(this.scheduler, this.LOOKAHEAD_MS);
  }

  /**
   * Stop the metronome
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.flashTimeoutId) {
      clearTimeout(this.flashTimeoutId);
      this.flashTimeoutId = null;
    }
    this.currentBeatIndex = 0;
    this.notifyFlash(false);
  }

  public setBpm(bpm: number): void {
    const clampedBpm = Math.max(20, Math.min(300, bpm));
    if (this.bpm === clampedBpm) return;

    if (this.isRunning) {
      const oldBpm = this.bpm;
      this.bpm = clampedBpm;
      // Adjust nextNoteTime proportionally to avoid sudden skip or long delay
      const currentTime = this.getCurrentTime();
      const timeRemaining = Math.max(0, this.nextNoteTime - currentTime);
      const ratio = oldBpm / clampedBpm;
      this.nextNoteTime = currentTime + (timeRemaining * ratio);
    } else {
      this.bpm = clampedBpm;
    }
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setBeats(beats: number): void {
    const clamped = Math.max(1, Math.min(12, beats));
    this.beatsPerBar = clamped;
    if (this.currentBeatIndex >= this.beatsPerBar) {
      this.currentBeatIndex = 0;
    }
  }

  public getBeats(): number {
    return this.beatsPerBar;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isSoundEnabled = enabled;
    audioEngine.setMetronomeMuted(!enabled);
  }

  public getIsSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  public setVolume(volumeDb: number): void {
    this.volumeDb = Math.max(-10, Math.min(10, volumeDb));
    audioEngine.setMetronomeVolume(this.volumeDb);
  }

  public getVolume(): number {
    return this.volumeDb;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentBeat(): number {
    return this.currentBeatIndex + 1;
  }
}

// Global Singleton Instance
export const metronomeEngine = new MetronomeEngine();
