/** Note names in chromatic order starting from C */
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Jianpu (numbered musical notation) scale degrees for chromatic notes (C-based).
 * Index by MIDI % 12.
 */
const JIANPU_DEGREES = ['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7'];

export interface NotationInfo {
  degree: string;
  dotsAbove: number;   // 0, 1, or 2
  dotsBelow: number;   // 0, 1, or 2
}

/** Generate a note name from a MIDI number: e.g. 60 -> "C4" */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = midi % 12;
  return `${CHROMATIC_NOTES[noteIdx]}${octave}`;
}

/** Check if a note name is in our sample map */
export function hasSample(noteName: string, samples: Set<string>): boolean {
  return samples.has(noteName);
}

/**
 * Convert a MIDI number to numbered musical notation (Jianpu/简谱).
 * Returns structured info with separate dot counts for above/below.
 * Middle octave (4, MIDI 60-71) has no dots.
 */
export function toNumberedNotation(midi: number): NotationInfo {
  const noteIdx = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const degree = JIANPU_DEGREES[noteIdx];

  let dotsAbove = 0;
  let dotsBelow = 0;

  if (octave <= 2) {
    dotsBelow = 2;
  } else if (octave === 3) {
    dotsBelow = 1;
  } else if (octave === 5) {
    dotsAbove = 1;
  } else if (octave >= 6) {
    dotsAbove = 2;
  }
  // octave 4: no dots

  return { degree, dotsAbove, dotsBelow };
}