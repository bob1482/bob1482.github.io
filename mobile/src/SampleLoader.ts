/** Maps a filename like "C4.mp3" or "Fs3.mp3" to note names */
export interface SampleMap {
  [noteName: string]: string; // noteName -> file path
}

/** Each sample file information */
const SAMPLE_FILES: string[] = [
  'A0.mp3', 'A1.mp3', 'A2.mp3', 'A3.mp3', 'A4.mp3', 'A5.mp3', 'A6.mp3', 'A7.mp3',
  'C1.mp3', 'C2.mp3', 'C3.mp3', 'C4.mp3', 'C5.mp3', 'C6.mp3', 'C7.mp3', 'C8.mp3',
  'Ds1.mp3', 'Ds2.mp3', 'Ds3.mp3', 'Ds4.mp3', 'Ds5.mp3', 'Ds6.mp3', 'Ds7.mp3',
  'Fs1.mp3', 'Fs2.mp3', 'Fs3.mp3', 'Fs4.mp3', 'Fs5.mp3', 'Fs6.mp3', 'Fs7.mp3',
];

/**
 * Convert filename to a standardized note name.
 * "C4.mp3" → "C4", "Ds3.mp3" → "D#3", "Fs5.mp3" → "F#5"
 */
export function filenameToNoteName(filename: string): string {
  const base = filename.replace('.mp3', '');
  return base
    .replace(/^Ds/, 'D#')
    .replace(/^Fs/, 'F#');
}

export class SampleLoader {
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /**
   * Fetch and decode all sample MP3s.
   * Returns a map of noteName -> AudioBuffer.
   * Reports progress via the callback (0-1).
   */
  async loadAll(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Map<string, AudioBuffer>> {
    const buffers = new Map<string, AudioBuffer>();
    const total = SAMPLE_FILES.length;
    let loaded = 0;

    const promises = SAMPLE_FILES.map(async (file) => {
      const noteName = filenameToNoteName(file);
      const path = `sample/${file}`;
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        buffers.set(noteName, audioBuffer);
      } catch (err) {
        console.warn(`Failed to load sample ${file}:`, err);
      }
      loaded++;
      onProgress?.(loaded, total);
    });

    await Promise.allSettled(promises);
    return buffers;
  }
}