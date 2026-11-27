/**
 * Jankó Keyboard Geometry and Note Utilities
 *
 * Key Range: F0 (MIDI 17) to E8 (MIDI 112) — 96 keys (2 rows × 48 columns)
 */

export interface PianoKey {
  midi: number;
  name: string;
  row: 0 | 1; // 0 = top row (staggered +0.5 col), 1 = bottom row
  col: number; // 0 to 35
  isBlack: boolean;
}

export const MIN_MIDI = 17; // F0
export const MAX_MIDI = 112; // E8
export const TRIMMED_MIN_MIDI = MIN_MIDI + 12; // F1
export const TRIMMED_MAX_MIDI = MAX_MIDI - 12; // E7
export const JANKO_COLS = 48;
export const JANKO_TOTAL_WIDTH_UNITS = 48.5;

export function getTotalWidthUnits(trimOuterOctaves = false): number {
  return trimOuterOctaves ? JANKO_TOTAL_WIDTH_UNITS - 12 : JANKO_TOTAL_WIDTH_UNITS;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const JIANPU_DEGREES = ['1', '#1', '2', '#2', '3', '4', '#4', '5', '#5', '6', '#6', '7'] as const;
const IS_BLACK_PATTERN = [false, true, false, true, false, false, true, false, true, false, true, false];

export interface JianpuNote {
  degree: string;
  isSharp: boolean;
  number: string;
  octaveOffset: number;
}

export function getJianpuNote(midi: number): JianpuNote {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const degree = JIANPU_DEGREES[pitchClass];
  const isSharp = degree.startsWith('#');
  return {
    degree,
    isSharp,
    number: isSharp ? degree.slice(1) : degree,
    octaveOffset: octave - 4,
  };
}

export function isBlackMidi(midi: number): boolean {
  return IS_BLACK_PATTERN[((midi % 12) + 12) % 12];
}

export function getMidiNoteName(midi: number): string {
  const noteInOctave = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteInOctave]}${octave}`;
}

export const PIANO_KEYS: PianoKey[] = [];

for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
  const offset = midi - MIN_MIDI;
  const noteInOctave = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = `${NOTE_NAMES[noteInOctave]}${octave}`;

  PIANO_KEYS.push({
    midi,
    name,
    row: offset % 2 === 1 ? 0 : 1,
    col: Math.floor(offset / 2),
    isBlack: IS_BLACK_PATTERN[noteInOctave],
  });
}

export const PIANO_KEYS_BY_MIDI: Record<number, PianoKey> = {};
for (const k of PIANO_KEYS) {
  PIANO_KEYS_BY_MIDI[k.midi] = k;
}

export function getKeyX(midi: number, totalWidth: number, trimOuterOctaves = false): number {
  const key = PIANO_KEYS_BY_MIDI[midi];
  if (!key) return 0;
  if (trimOuterOctaves && (midi < TRIMMED_MIN_MIDI || midi > TRIMMED_MAX_MIDI)) return 0;
  const col = trimOuterOctaves ? key.col - 6 : key.col;
  const xUnit = col + (key.row === 0 ? 0.5 : 0);
  return (xUnit / getTotalWidthUnits(trimOuterOctaves)) * totalWidth;
}

export function getKeyWidth(midi: number, totalWidth: number, trimOuterOctaves = false): number {
  if (!PIANO_KEYS_BY_MIDI[midi]) return 0;
  if (trimOuterOctaves && (midi < TRIMMED_MIN_MIDI || midi > TRIMMED_MAX_MIDI)) return 0;
  return totalWidth / getTotalWidthUnits(trimOuterOctaves);
}

export function getKeyLayoutPercent(midi: number, trimOuterOctaves = false): {
  leftPercent: number;
  widthPercent: number;
  row: 0 | 1;
} {
  const key = PIANO_KEYS_BY_MIDI[midi];
  if (!key) return { leftPercent: 0, widthPercent: 0, row: 1 };
  if (trimOuterOctaves && (midi < TRIMMED_MIN_MIDI || midi > TRIMMED_MAX_MIDI)) {
    return { leftPercent: 0, widthPercent: 0, row: key.row };
  }

  const col = trimOuterOctaves ? key.col - 6 : key.col;
  const totalUnits = getTotalWidthUnits(trimOuterOctaves);
  const xUnit = col + (key.row === 0 ? 0.5 : 0);
  return {
    leftPercent: (xUnit / totalUnits) * 100,
    widthPercent: (1 / totalUnits) * 100,
    row: key.row,
  };
}

const KEYBOARD_EVENT_MATRIX: string[][] = [
  ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
];

const WICKI_NOTES_MATRIX: string[][] = [
  ['F4', 'G4', 'A4', 'B4', 'C#5', 'D#5', 'F6', 'G6', 'A6', 'B6', 'C#7', 'D#7'],
  ['A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#5', 'C6', 'D6', 'E6', 'F#6', 'G#6'],
  ['F3', 'G3', 'A3', 'B3', 'C#4', 'D#4', 'F5', 'G5', 'A5', 'B5', 'C#6', 'D#6'],
  ['A#2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A#4', 'C5', 'D5', 'E5', 'F#5', 'G#5'],
];

function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return -1;
  const noteIdx = NOTE_NAMES.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  return noteIdx === -1 ? -1 : (octave + 1) * 12 + noteIdx;
}

const WICKI_TRANSPOSE = -19;

/**
 * Wicki-Hayden isomorphic QWERTY keyboard mapping
 */
export const QWERTY_TO_MIDI: Record<string, number> = {};
export const QWERTY_TO_SIDE: Record<string, 'left' | 'right'> = {};
for (let r = 0; r < KEYBOARD_EVENT_MATRIX.length; r++) {
  for (let c = 0; c < KEYBOARD_EVENT_MATRIX[r].length; c++) {
    const code = KEYBOARD_EVENT_MATRIX[r][c];
    const baseMidi = noteNameToMidi(WICKI_NOTES_MATRIX[r][c]);
    const midi = baseMidi === -1 ? -1 : baseMidi + WICKI_TRANSPOSE;
    if (code && midi >= MIN_MIDI && midi <= MAX_MIDI) {
      QWERTY_TO_MIDI[code] = midi;
      QWERTY_TO_SIDE[code] = c < 6 ? 'left' : 'right';
    }
  }
}

QWERTY_TO_MIDI['AltRight'] = 50; // D3
QWERTY_TO_SIDE['AltRight'] = 'right';

export interface WickiKey {
  midi: number;
  name: string;
  row: number;
  col: number;
  isBlack: boolean;
  leftPercent: number;
  widthPercent: number;
  topPercent: number;
  heightPercent: number;
}

export const WICKI_BOARD_ROWS = 8;
export const WICKI_BOARD_COLS = 6;
export const WICKI_BOARD_WIDTH_UNITS = WICKI_BOARD_COLS + 0.5;

export const WICKI_TOUCH_BOARD_ROWS = WICKI_BOARD_ROWS - 2;
export const WICKI_TOUCH_BOARD_COLS = WICKI_BOARD_COLS - 2;
export const WICKI_TOUCH_BOARD_WIDTH_UNITS = WICKI_TOUCH_BOARD_COLS + 0.5;

export function generateWickiBoardKeys(
  baseMidi: number,
  rows = WICKI_BOARD_ROWS,
  cols = WICKI_BOARD_COLS,
  trimOuter = false
): WickiKey[] {
  const keys: WickiKey[] = [];
  const rowStart = trimOuter ? 1 : 0;
  const rowEnd = trimOuter ? rows - 1 : rows;
  const colStart = trimOuter ? 1 : 0;
  const colEnd = trimOuter ? cols - 1 : cols;
  const visibleRows = rowEnd - rowStart;
  const visibleCols = colEnd - colStart;
  const totalWidthUnits = visibleCols + 0.5;
  const widthPercent = (1 / totalWidthUnits) * 100;
  const heightPercent = (1 / visibleRows) * 100;

  for (let row = rowStart; row < rowEnd; row++) {
    const rowFromBottom = rows - 1 - row;
    const octaveOffset = Math.floor(rowFromBottom / 2) * 12;
    const isStaggered = rowFromBottom % 2 === 1;
    const fifthOffset = isStaggered ? 7 : 0;
    const colStagger = isStaggered ? 0.5 : 0;
    const visibleRow = row - rowStart;

    for (let col = colStart; col < colEnd; col++) {
      const midi = baseMidi + octaveOffset + fifthOffset + col * 2;
      const visibleCol = col - colStart;
      keys.push({
        midi,
        name: getMidiNoteName(midi),
        row: visibleRow,
        col: visibleCol,
        isBlack: isBlackMidi(midi),
        leftPercent: ((visibleCol + colStagger) / totalWidthUnits) * 100,
        widthPercent,
        topPercent: (visibleRow / visibleRows) * 100,
        heightPercent,
      });
    }
  }

  return keys;
}

export const WICKI_LEFT_KEYS = generateWickiBoardKeys(39); // D#2 base
export const WICKI_RIGHT_KEYS = generateWickiBoardKeys(39); // D#2 base
export const WICKI_TOUCH_LEFT_KEYS = generateWickiBoardKeys(39, WICKI_BOARD_ROWS, WICKI_BOARD_COLS, true);
export const WICKI_TOUCH_RIGHT_KEYS = generateWickiBoardKeys(39, WICKI_BOARD_ROWS, WICKI_BOARD_COLS, true);
