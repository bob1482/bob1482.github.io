/**
 * Low-latency audio engine using Web Audio API.
 * Pre-decoded AudioBuffers are played back with minimal overhead.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private buffers: Map<string, AudioBuffer>;
  /** Active source nodes for polyphonic playback */
  private activeSources: Map<string, AudioBufferSourceNode[]> = new Map();
  /** Sorted MIDI numbers of available samples for nearest-sample lookup */
  private sortedSampleMidis: number[] = [];

  private static readonly CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /** Convert a note name like "C4" to MIDI number (C4 = 60) */
  static noteNameToMidi(noteName: string): number {
    const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return -1;
    const note = match[1];
    const octave = parseInt(match[2], 10);
    const noteIndex = AudioEngine.CHROMATIC_NOTES.indexOf(note);
    if (noteIndex === -1) return -1;
    return (octave + 1) * 12 + noteIndex;
  }

  /** Convert a MIDI number to note name: e.g. 60 -> "C4" */
  static midiToNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    const noteIdx = midi % 12;
    return `${AudioEngine.CHROMATIC_NOTES[noteIdx]}${octave}`;
  }

  constructor(buffers: Map<string, AudioBuffer>) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.buffers = buffers;

    // Pre-sort available MIDI numbers for nearest-sample lookup
    this.sortedSampleMidis = Array.from(buffers.keys())
      .map(n => AudioEngine.noteNameToMidi(n))
      .filter(n => n >= 0)
      .sort((a, b) => a - b);
  }

  /** Ensure the AudioContext is running (required after user gesture) */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Play a note immediately.
   * @param noteName e.g. "C4", "D#3", "F#5"
   * @param velocity 0.0 - 1.0
   */
  playNote(noteName: string, velocity: number = 0.8): void {
    const buffer = this.buffers.get(noteName);
    if (!buffer) return;

    const now = this.ctx.currentTime;

    // Create source node
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Velocity gain
    const gainNode = this.ctx.createGain();
    const vel = Math.max(0.01, Math.min(1.0, velocity));
    // Scale velocity to a nice dynamic range
    gainNode.gain.setValueAtTime(0.3 + vel * 0.7, now);

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Start immediately
    source.start(now);

    // Track active source
    const sources = this.activeSources.get(noteName) || [];
    sources.push(source);
    this.activeSources.set(noteName, sources);

    // Clean up when done
    source.onended = () => {
      const list = this.activeSources.get(noteName);
      if (list) {
        const idx = list.indexOf(source);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) this.activeSources.delete(noteName);
      }
    };
  }

  /**
   * Play a note, falling back to the nearest available sample with pitch shift.
   * @param noteName e.g. "C4", "D#3", "F#5"
   * @param velocity 0.0 - 1.0
   * @returns The actual note name that was played (for visual feedback), or null if nothing could be played
   */
  playNoteWithFallback(noteName: string, velocity: number = 0.8): string | null {
    // Try exact match first
    if (this.buffers.has(noteName)) {
      this.playNote(noteName, velocity);
      return noteName;
    }

    // Find nearest sample by MIDI number
    const targetMidi = AudioEngine.noteNameToMidi(noteName);
    if (targetMidi < 0) return null;

    const sorted = this.sortedSampleMidis;
    if (sorted.length === 0) return null;

    // Linear scan for nearest (sorted list is small, so this is fine)
    let nearest = sorted[0];
    let minDiff = Math.abs(targetMidi - nearest);
    for (const midi of sorted) {
      const diff = Math.abs(targetMidi - midi);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = midi;
      }
    }

    const sourceNoteName = AudioEngine.midiToNoteName(nearest);
    const buffer = this.buffers.get(sourceNoteName);
    if (!buffer) return null;

    // Calculate playback rate for pitch shift: 2^((target - source) / 12)
    const playbackRate = Math.pow(2, (targetMidi - nearest) / 12);

    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, now);

    const gainNode = this.ctx.createGain();
    const vel = Math.max(0.01, Math.min(1.0, velocity));
    gainNode.gain.setValueAtTime(0.3 + vel * 0.7, now);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(now);

    // Track active source under the requested note name
    const sources = this.activeSources.get(noteName) || [];
    sources.push(source);
    this.activeSources.set(noteName, sources);

    source.onended = () => {
      const list = this.activeSources.get(noteName);
      if (list) {
        const idx = list.indexOf(source);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) this.activeSources.delete(noteName);
      }
    };

    return sourceNoteName;
  }

  /** Stop all currently playing notes */
  stopAll(): void {
    const now = this.ctx.currentTime;
    for (const [, sources] of this.activeSources) {
      for (const source of sources) {
        try {
          source.stop(now);
        } catch {
          // Already stopped
        }
      }
    }
    this.activeSources.clear();
  }

  /** Get the underlying AudioContext */
  get context(): AudioContext {
    return this.ctx;
  }
}