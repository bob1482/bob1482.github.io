/**
 * Piano Geometry and Note Utilities
 * 
 * Key Range: Exactly C1 (MIDI 24) to B7 (MIDI 107)
 * Total keys: 84 (49 White keys, 35 Black keys)
 */

import type { ColorMode } from './settings';

export interface PianoKey {
  midi: number;
  name: string;
  noteNameWithoutOctave: string;
  octave: number;
  isBlack: boolean;
  whiteIndex?: number; // 0 to 48 for white keys
  blackIndex?: number; // 0 to 34 for black keys
  whiteSeamIndex?: number; // Which white key index this black key is to the right of
}

export const MIN_MIDI = 24; // C1
export const MAX_MIDI = 107; // B7
export const TOTAL_KEYS = 84;
export const TOTAL_WHITE_KEYS = 49;
export const TOTAL_BLACK_KEYS = 35;

// Middle 3 Octaves (C3 to B5, 36 keys: 21 White, 15 Black) for Mobile Portrait Mode
export const MIDDLE_OCTAVES_MIN_MIDI = 48; // C3
export const MIDDLE_OCTAVES_MAX_MIDI = 83; // B5
export const MIDDLE_OCTAVES_TOTAL_KEYS = 36;
export const MIDDLE_OCTAVES_TOTAL_WHITE_KEYS = 21;
export const MIDDLE_OCTAVES_TOTAL_BLACK_KEYS = 15;
export const MIDDLE_OCTAVES_WHITE_KEY_OFFSET = 14; // White keys before C3 (7 keys * 2 octaves)

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const IS_BLACK_PATTERN = [false, true, false, true, false, false, true, false, true, false, true, false];

// Build full list of 84 keys
export const PIANO_KEYS: PianoKey[] = [];

let whiteCount = 0;
let blackCount = 0;

for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
  const noteInOctave = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteNameWithoutOctave = NOTE_NAMES[noteInOctave];
  const name = `${noteNameWithoutOctave}${octave}`;
  const isBlack = IS_BLACK_PATTERN[noteInOctave];

  if (isBlack) {
    PIANO_KEYS.push({
      midi,
      name,
      noteNameWithoutOctave,
      octave,
      isBlack: true,
      blackIndex: blackCount,
      whiteSeamIndex: whiteCount, // Sits between whiteCount-1 and whiteCount
    });
    blackCount++;
  } else {
    PIANO_KEYS.push({
      midi,
      name,
      noteNameWithoutOctave,
      octave,
      isBlack: false,
      whiteIndex: whiteCount,
    });
    whiteCount++;
  }
}

// Map for O(1) lookup
export const PIANO_KEYS_BY_MIDI: Record<number, PianoKey> = {};
PIANO_KEYS.forEach(k => {
  PIANO_KEYS_BY_MIDI[k.midi] = k;
});

export const WHITE_KEYS = PIANO_KEYS.filter(k => !k.isBlack);
export const BLACK_KEYS = PIANO_KEYS.filter(k => k.isBlack);

// Filtered lists for middle 3 octaves (C3 to B5)
export const MIDDLE_PIANO_KEYS = PIANO_KEYS.filter(
  k => k.midi >= MIDDLE_OCTAVES_MIN_MIDI && k.midi <= MIDDLE_OCTAVES_MAX_MIDI
);
export const MIDDLE_WHITE_KEYS = WHITE_KEYS.filter(
  k => k.midi >= MIDDLE_OCTAVES_MIN_MIDI && k.midi <= MIDDLE_OCTAVES_MAX_MIDI
);
export const MIDDLE_BLACK_KEYS = BLACK_KEYS.filter(
  k => k.midi >= MIDDLE_OCTAVES_MIN_MIDI && k.midi <= MIDDLE_OCTAVES_MAX_MIDI
);

/**
 * Proportional black key offsets for natural acoustic piano feel
 * In standard piano geometry:
 * C# is shifted slightly left of center
 * D# is shifted slightly right of center
 * F# is shifted slightly left
 * G# is centered
 * A# is shifted slightly right
 */
export function getBlackKeyOffsetRatio(noteInOctave: number): number {
  switch (noteInOctave) {
    case 1: return -0.07; // C# slightly left
    case 3: return 0.07;  // D# slightly right
    case 6: return -0.10; // F# slightly left
    case 8: return 0.0;   // G# centered
    case 10: return 0.10; // A# slightly right
    default: return 0.0;
  }
}

/**
 * Returns exact X pixel coordinate for a note across total width W
 */
export function getKeyX(
  midi: number,
  totalWidth: number,
  isMiddleOctavesOnly: boolean = false
): number {
  const key = PIANO_KEYS_BY_MIDI[midi];
  if (!key) return 0;

  if (isMiddleOctavesOnly) {
    const whiteKeyWidth = totalWidth / MIDDLE_OCTAVES_TOTAL_WHITE_KEYS;
    const relativeWhiteIndex = (key.whiteIndex ?? 0) - MIDDLE_OCTAVES_WHITE_KEY_OFFSET;

    if (!key.isBlack) {
      return relativeWhiteIndex * whiteKeyWidth;
    } else {
      const relativeSeamIndex = (key.whiteSeamIndex ?? 0) - MIDDLE_OCTAVES_WHITE_KEY_OFFSET;
      const seamX = relativeSeamIndex * whiteKeyWidth;
      const blackKeyWidth = whiteKeyWidth * 0.64;
      const noteInOctave = midi % 12;
      const offset = getBlackKeyOffsetRatio(noteInOctave) * whiteKeyWidth;
      return seamX - (blackKeyWidth / 2) + offset;
    }
  }

  const whiteKeyWidth = totalWidth / TOTAL_WHITE_KEYS;

  if (!key.isBlack) {
    return (key.whiteIndex ?? 0) * whiteKeyWidth;
  } else {
    const seamX = (key.whiteSeamIndex ?? 0) * whiteKeyWidth;
    const blackKeyWidth = whiteKeyWidth * 0.64;
    const noteInOctave = midi % 12;
    const offset = getBlackKeyOffsetRatio(noteInOctave) * whiteKeyWidth;
    return seamX - (blackKeyWidth / 2) + offset;
  }
}

/**
 * Returns exact width in pixels for a note across total width W
 */
export function getKeyWidth(
  midi: number,
  totalWidth: number,
  isMiddleOctavesOnly: boolean = false
): number {
  const key = PIANO_KEYS_BY_MIDI[midi];
  if (!key) return 0;

  const totalWhiteKeys = isMiddleOctavesOnly ? MIDDLE_OCTAVES_TOTAL_WHITE_KEYS : TOTAL_WHITE_KEYS;
  const whiteKeyWidth = totalWidth / totalWhiteKeys;
  if (!key.isBlack) {
    return whiteKeyWidth;
  } else {
    return whiteKeyWidth * 0.64;
  }
}

/**
 * Returns exact percentage coordinates for DOM layout
 */
export function getKeyLayoutPercent(
  midi: number,
  isMiddleOctavesOnly: boolean = false
): { leftPercent: number; widthPercent: number } {
  const key = PIANO_KEYS_BY_MIDI[midi];
  if (!key) return { leftPercent: 0, widthPercent: 0 };

  if (isMiddleOctavesOnly) {
    if (midi < MIDDLE_OCTAVES_MIN_MIDI || midi > MIDDLE_OCTAVES_MAX_MIDI) {
      return { leftPercent: -100, widthPercent: 0 };
    }

    const whiteKeyPercent = 100 / MIDDLE_OCTAVES_TOTAL_WHITE_KEYS; // 100 / 21 = ~4.7619%
    const relativeWhiteIndex = (key.whiteIndex ?? 0) - MIDDLE_OCTAVES_WHITE_KEY_OFFSET;

    if (!key.isBlack) {
      return {
        leftPercent: relativeWhiteIndex * whiteKeyPercent,
        widthPercent: whiteKeyPercent,
      };
    } else {
      const relativeSeamIndex = (key.whiteSeamIndex ?? 0) - MIDDLE_OCTAVES_WHITE_KEY_OFFSET;
      const seamPercent = relativeSeamIndex * whiteKeyPercent;
      const blackKeyPercent = whiteKeyPercent * 0.64;
      const noteInOctave = midi % 12;
      const offsetPercent = getBlackKeyOffsetRatio(noteInOctave) * whiteKeyPercent;
      return {
        leftPercent: seamPercent - (blackKeyPercent / 2) + offsetPercent,
        widthPercent: blackKeyPercent,
      };
    }
  }

  const whiteKeyPercent = 100 / TOTAL_WHITE_KEYS; // ~2.0408%

  if (!key.isBlack) {
    return {
      leftPercent: (key.whiteIndex ?? 0) * whiteKeyPercent,
      widthPercent: whiteKeyPercent,
    };
  } else {
    const seamPercent = (key.whiteSeamIndex ?? 0) * whiteKeyPercent;
    const blackKeyPercent = whiteKeyPercent * 0.64;
    const noteInOctave = midi % 12;
    const offsetPercent = getBlackKeyOffsetRatio(noteInOctave) * whiteKeyPercent;
    return {
      leftPercent: seamPercent - (blackKeyPercent / 2) + offsetPercent,
      widthPercent: blackKeyPercent,
    };
  }
}

/**
 * Pitch-based sleek minimalist color palette generator (RGB / Hex)
 */
export const NOTE_PALETTE_HEX = [
  '#38bdf8', // C  - Ice Sky
  '#0ea5e9', // C# - Ocean
  '#6366f1', // D  - Iris Indigo
  '#818cf8', // D# - Periwinkle
  '#a855f7', // E  - Purple
  '#c084fc', // F  - Lavender
  '#e879f9', // F# - Soft Orchid
  '#f472b6', // G  - Muted Rose
  '#fb7185', // G# - Coral
  '#f97316', // A  - Warm Apricot
  '#fbbf24', // A# - Amber
  '#34d399', // B  - Mint
];

export const NOTE_PALETTE_INT = [
  0x38bdf8, // C
  0x0ea5e9, // C#
  0x6366f1, // D
  0x818cf8, // D#
  0xa855f7, // E
  0xc084fc, // F
  0xe879f9, // F#
  0xf472b6, // G
  0xfb7185, // G#
  0xf97316, // A
  0xfbbf24, // A#
  0x34d399, // B
];

export const CYAN_HEX = '#3a7cffff';
export const MAGENTA_HEX = '#a734ffff';

export const CYAN_INT = 0x3a7cff;
export const MAGENTA_INT = 0xa734ff;

export const TRACK_PALETTE_HEX = [
  CYAN_HEX,    // Track 0 - Light Cyan
  MAGENTA_HEX, // Track 1 - Soft Lilac / Pink
  '#34d399',   // Track 2 - Emerald Mint
  '#fb923c',   // Track 3 - Warm Orange / Amber
  '#818cf8',   // Track 4 - Iris / Indigo
  '#f472b6',   // Track 5 - Rose Pink
  '#facc15',   // Track 6 - Bright Gold
  '#2dd4bf',   // Track 7 - Teal / Aqua
  '#a78bfa',   // Track 8 - Violet
  '#fb7185',   // Track 9 - Coral Red
  '#4ade80',   // Track 10 - Lime Green
  '#60a5fa',   // Track 11 - Sky Blue
];

export const TRACK_PALETTE_INT = [
  CYAN_INT,
  MAGENTA_INT,
  0x34d399,
  0xfb923c,
  0x818cf8,
  0xf472b6,
  0xfacc15,
  0x2dd4bf,
  0xa78bfa,
  0xfb7185,
  0x4ade80,
  0x60a5fa,
];

export function getNoteColorHex(midi: number, trackIndex: number = 0, colorMode: ColorMode = 'track'): string {
  if (colorMode === 'outline') {
    return '#ffffff';
  }
  if (colorMode === 'gradient') {
    const ratio = Math.max(0, Math.min(1, (midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)));
    const hue = Math.floor(190 + ratio * 150) % 360;
    return `hsl(${hue}, 80%, 65%)`;
  }
  return TRACK_PALETTE_HEX[trackIndex % TRACK_PALETTE_HEX.length];
}

export function getNoteColorInt(midi: number, trackIndex: number = 0, colorMode: ColorMode = 'track'): number {
  if (colorMode === 'outline') {
    return 0xffffff;
  }
  if (colorMode === 'gradient') {
    const ratio = Math.max(0, Math.min(1, (midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)));
    const hue = Math.floor(190 + ratio * 150) % 360;
    return hslToInt(hue, 0.8, 0.65);
  }
  return TRACK_PALETTE_INT[trackIndex % TRACK_PALETTE_INT.length];
}

function hslToInt(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
  const rInt = Math.round((r + m) * 255);
  const gInt = Math.round((g + m) * 255);
  const bInt = Math.round((b + m) * 255);
  return (rInt << 16) | (gInt << 8) | bInt;
}

/**
 * Keyboard Event Matrix (6x12 physical key codes with bottom blank layer)
 */
export const KEYBOARD_EVENT_MATRIX: string[][] = [
  ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"],
  ["Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"],
  ["", "", "", "", "", "", "", "", "", "", "", ""]
];

export const KEYBOARD_EVENT_MATRIX_6X12 = KEYBOARD_EVENT_MATRIX;

/**
 * Compact Keyboard Event Matrix (6x4 physical key codes with bottom blank layer)
 */
export const KEYBOARD_EVENT_MATRIX_6X4: string[][] = [
  ["F1", "F2", "F3", "F4"],
  ["Digit2", "Digit3", "Digit4", "Digit5"],
  ["KeyQ", "KeyW", "KeyE", "KeyR"],
  ["KeyA", "KeyS", "KeyD", "KeyF"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC"],
  ["", "", "", ""]
];

/**
 * Extended Keyboard Event Matrix (9 rows x 18 cols with split physical keys on left/right and 6 empty center cols)
 */
export const KEYBOARD_EVENT_MATRIX_9X18: string[][] = [
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["F1", "F2", "F3", "F4", "F5", "F6", "", "", "", "", "", "", "F7", "F8", "F9", "F10", "F11", "F12"],
  ["Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "", "", "", "", "", "", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "", "", "", "", "", "", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "", "", "", "", "", "", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "", "", "", "", "", "", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
];

/**
 * 8x12 Keyboard Event Matrix (8 rows x 12 cols with physical key bindings in rows 4 to 7)
 */
export const KEYBOARD_EVENT_MATRIX_8X12: string[][] = [
  ["", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", "", "", ""],
  ["Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"]
];

// Backwards compatibility aliases
export const KEYBOARD_EVENT_MATRIX_7X18 = KEYBOARD_EVENT_MATRIX_9X18;
export const KEYBOARD_EVENT_MATRIX_6X18 = KEYBOARD_EVENT_MATRIX_9X18;
export const KEYBOARD_EVENT_MATRIX_9X12 = KEYBOARD_EVENT_MATRIX_9X18;

/**
 * Notes Matrix (6x12 notes mapped directly to key codes)
 */
export const NOTES_MATRIX: string[][] = [
  ["A#4", "C5", "D5", "E5", "F#5", "G#5", "A#5", "C6", "D6", "E6", "F#6", "G#6"],
  ["F4", "G4", "A4", "B4", "C#5", "D#5", "F5", "G5", "A5", "B5", "C#6", "D#6"],
  ["A#3", "C4", "D4", "E4", "F#4", "G#4", "A#4", "C5", "D5", "E5", "F#5", "G#5"],
  ["F3", "G3", "A3", "B3", "C#4", "D#4", "F4", "G4", "A4", "B4", "C#5", "D#5"],
  ["A#2", "C3", "D3", "E3", "F#3", "G#3", "A#3", "C4", "D4", "E4", "F#4", "G#4"],
  ["F2", "G2", "A2", "B2", "C#3", "D#3", "F3", "G3", "A3", "B3", "C#4", "D#4"]
];

export const NOTES_MATRIX_6X12 = NOTES_MATRIX;

/**
 * Compact Notes Matrix (6x4 whole-tone alternating isomorphic layout)
 */
export const NOTES_MATRIX_6X4: string[][] = [
  ["A#4", "C5", "D5", "E5"],
  ["F4", "G4", "A4", "B4"],
  ["A#3", "C4", "D4", "E4"],
  ["F3", "G3", "A3", "B3"],
  ["A#2", "C3", "D3", "E3"],
  ["F2", "G2", "A2", "B2"]
];

/**
 * Extended Notes Matrix (9x18 whole-tone alternating isomorphic layout)
 */
export const NOTES_MATRIX_9X18: string[][] = [
  ["F6", "G6", "A6", "B6", "C#7", "D#7", "F7", "G7", "A7", "B7", "C#8", "D#8", "F8", "G8", "A8", "B8", "C#9", "D#9"],
  ["A#5", "C6", "D6", "E6", "F#6", "G#6", "A#6", "C7", "D7", "E7", "F#7", "G#7", "A#7", "C8", "D8", "E8", "F#8", "G#8"],
  ["F5", "G5", "A5", "B5", "C#6", "D#6", "F6", "G6", "A6", "B6", "C#7", "D#7", "F7", "G7", "A7", "B7", "C#8", "D#8"],
  ["A#4", "C5", "D5", "E5", "F#5", "G#5", "A#5", "C6", "D6", "E6", "F#6", "G#6", "A#6", "C7", "D7", "E7", "F#7", "G#7"],
  ["F4", "G4", "A4", "B4", "C#5", "D#5", "F5", "G5", "A5", "B5", "C#6", "D#6", "F6", "G6", "A6", "B6", "C#7", "D#7"],
  ["A#3", "C4", "D4", "E4", "F#4", "G#4", "A#4", "C5", "D5", "E5", "F#5", "G#5", "A#5", "C6", "D6", "E6", "F#6", "G#6"],
  ["F3", "G3", "A3", "B3", "C#4", "D#4", "F4", "G4", "A4", "B4", "C#5", "D#5", "F5", "G5", "A5", "B5", "C#6", "D#6"],
  ["A#2", "C3", "D3", "E3", "F#3", "G#3", "A#3", "C4", "D4", "E4", "F#4", "G#4", "A#4", "C5", "D5", "E5", "F#5", "G#5"],
  ["F2", "G2", "A2", "B2", "C#3", "D#3", "F3", "G3", "A3", "B3", "C#4", "D#4", "F4", "G4", "A4", "B4", "C#5", "D#5"]
];

/**
 * 8x12 Notes Matrix (8 rows x 12 cols whole-tone alternating isomorphic layout)
 */
export const NOTES_MATRIX_8X12: string[][] = [
  ["F6", "G6", "A6", "B6", "C#7", "D#7", "F7", "G7", "A7", "B7", "C#8", "D#8"],
  ["A#5", "C6", "D6", "E6", "F#6", "G#6", "A#6", "C7", "D7", "E7", "F#7", "G#7"],
  ["F5", "G5", "A5", "B5", "C#6", "D#6", "F6", "G6", "A6", "B6", "C#7", "D#7"],
  ["A#4", "C5", "D5", "E5", "F#5", "G#5", "A#5", "C6", "D6", "E6", "F#6", "G#6"],
  ["F4", "G4", "A4", "B4", "C#5", "D#5", "F5", "G5", "A5", "B5", "C#6", "D#6"],
  ["A#3", "C4", "D4", "E4", "F#4", "G#4", "A#4", "C5", "D5", "E5", "F#5", "G#5"],
  ["F3", "G3", "A3", "B3", "C#4", "D#4", "F4", "G4", "A4", "B4", "C#5", "D#5"],
  ["A#2", "C3", "D3", "E3", "F#3", "G#3", "A#3", "C4", "D4", "E4", "F#4", "G#4"]
];

// Backwards compatibility aliases
export const NOTES_MATRIX_7X18 = NOTES_MATRIX_9X18;
export const NOTES_MATRIX_6X18 = NOTES_MATRIX_9X18;
export const NOTES_MATRIX_9X12 = NOTES_MATRIX_9X18;

export const ROW_STAGGERS_6X12 = [0, 0.5, 0, 0.5, 0, 0.5];
export const ROW_STAGGERS_6X4 = [0, 0.5, 0, 0.5, 0, 0.5];
export const ROW_STAGGERS_9X18 = [0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5];
export const ROW_STAGGERS_8X12 = [0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0];

// Backwards compatibility aliases
export const ROW_STAGGERS_5X12 = ROW_STAGGERS_6X12;
export const ROW_STAGGERS_7X18 = ROW_STAGGERS_9X18;
export const ROW_STAGGERS_6X18 = ROW_STAGGERS_9X18;
export const ROW_STAGGERS_9X12 = ROW_STAGGERS_9X18;

export type KeyboardLayoutType = '6x4' | '6x12' | '8x12' | '9x18';

export function getKeyboardLayoutType(matrix: string[][]): KeyboardLayoutType {
  if (!matrix || matrix.length === 0) return '6x12';
  const rows = matrix.length;
  const cols = matrix[0]?.length || 12;
  if (rows === 8) return '8x12';
  if (rows === 9 || cols === 18 || rows === 7) return '9x18';
  if (cols === 4) return '6x4';
  return '6x12';
}

export function getNotesMatrixForMatrix(matrix: string[][]): string[][] {
  const type = getKeyboardLayoutType(matrix);
  if (type === '8x12') return NOTES_MATRIX_8X12;
  if (type === '9x18') return NOTES_MATRIX_9X18;
  if (type === '6x4') return NOTES_MATRIX_6X4;
  return NOTES_MATRIX_6X12;
}

export function getRowStaggersForMatrix(matrix: string[][]): number[] {
  const type = getKeyboardLayoutType(matrix);
  if (type === '8x12') return ROW_STAGGERS_8X12;
  if (type === '9x18') return ROW_STAGGERS_9X18;
  if (type === '6x4') return ROW_STAGGERS_6X4;
  return ROW_STAGGERS_6X12;
}

/**
 * Converts a note name like "C4", "A#2", "F#5" to a MIDI note number (C4 = 60)
 */
export function noteNameToMidi(note: string): number {
  const match = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 0;
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  if (noteIndex === -1) return 0;
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Converts a MIDI note number to a note name (e.g. 60 -> "C4", 61 -> "C#4")
 */
export function midiToNoteName(midi: number): string {
  const noteInOctave = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteInOctave]}${octave}`;
}

export interface SimplifiedNote {
  number: string;     // '1' to '7'
  accidental: string; // '' or '♯'
  dotsAbove: number;  // 0, 1, 2, ...
  dotsBelow: number;  // 0, 1, 2, ...
  text: string;       // Formatted unicode representation e.g. "1", "♯1̇", "1̣"
}

const JIANPU_SCALE: Array<{ number: string; accidental: string }> = [
  { number: '1', accidental: '' },   // 0: C
  { number: '1', accidental: '♯' },  // 1: C#
  { number: '2', accidental: '' },   // 2: D
  { number: '2', accidental: '♯' },  // 3: D#
  { number: '3', accidental: '' },   // 4: E
  { number: '4', accidental: '' },   // 5: F
  { number: '4', accidental: '♯' },  // 6: F#
  { number: '5', accidental: '' },   // 7: G
  { number: '5', accidental: '♯' },  // 8: G#
  { number: '6', accidental: '' },   // 9: A
  { number: '6', accidental: '♯' },  // 10: A#
  { number: '7', accidental: '' },   // 11: B
];

/**
 * Converts a MIDI note number to Simplified Numbered Musical Notation (Jianpu / 简谱).
 * Reference pitch: C4 (MIDI 60) is "1" (middle register, 0 dots).
 * Higher octaves (C5+) have vertical dots above the number (1 dot for C5, 2 for C6, etc.).
 * Lower octaves (C3-) have vertical dots below the number (1 dot for C3, 2 for C2, etc.).
 */
export function midiToSimplifiedNotation(midi: number): SimplifiedNote {
  const noteInOctave = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const item = JIANPU_SCALE[noteInOctave];

  let dotsAbove = 0;
  let dotsBelow = 0;
  if (octave > 4) {
    dotsAbove = octave - 4;
  } else if (octave < 4) {
    dotsBelow = 4 - octave;
  }

  // Unicode text presentation (combining dot above \u0307, combining dot below \u0323)
  let text = item.accidental + item.number;
  if (dotsAbove === 1) text += '\u0307';
  else if (dotsAbove === 2) text += '\u0308';
  else if (dotsAbove > 2) text += '^'.repeat(dotsAbove);
  else if (dotsBelow === 1) text += '\u0323';
  else if (dotsBelow === 2) text += '\u0324';
  else if (dotsBelow > 2) text += '.'.repeat(dotsBelow);

  return {
    number: item.number,
    accidental: item.accidental,
    dotsAbove,
    dotsBelow,
    text,
  };
}


/**
 * Map of KeyboardEvent.code -> MIDI number
 */
export const KEYBOARD_EVENT_MAP: Record<string, number> = {};

/**
 * Map of KeyboardEvent.code -> Note Name ("A#4", etc.)
 */
export const KEYBOARD_EVENT_NOTE_NAME_MAP: Record<string, string> = {};
export const KEYBOARD_EVENT_COL_MAP: Record<string, number> = {};
export const KEYBOARD_EVENT_COLOR_MAP: Record<string, string> = {};

for (let r = 0; r < KEYBOARD_EVENT_MATRIX.length; r++) {
  const rowCodes = KEYBOARD_EVENT_MATRIX[r];
  const rowNotes = NOTES_MATRIX[r];
  for (let c = 0; c < rowCodes.length; c++) {
    const code = rowCodes[c];
    if (!code) continue;
    const noteName = rowNotes[c];
    const midi = noteNameToMidi(noteName);
    KEYBOARD_EVENT_MAP[code] = midi;
    KEYBOARD_EVENT_NOTE_NAME_MAP[code] = noteName;
    KEYBOARD_EVENT_COL_MAP[code] = c;
    KEYBOARD_EVENT_COLOR_MAP[code] = c < 6 ? MAGENTA_HEX : CYAN_HEX;
  }
}

/**
 * Returns color for a physical computer keyboard key code based on column position:
 * Left-most columns = Magenta (#a734ffff)
 * Right-most columns = Cyan (#3a7cffff)
 */
export function getKeyboardKeyColor(code: string, colorMode: 'track' | 'gradient' = 'track', midi?: number): string {
  if (colorMode === 'gradient') {
    const baseMidi = midi !== undefined ? midi : KEYBOARD_EVENT_MAP[code];
    if (baseMidi !== undefined) {
      return getNoteColorHex(baseMidi, 0, 'gradient');
    }
  }
  return KEYBOARD_EVENT_COLOR_MAP[code] || MAGENTA_HEX;
}

/**
 * Display labels for each key code for intuitive UI rendering
 */
export const KEYBOARD_DISPLAY_LABELS: Record<string, string> = {
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
  Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',
  Minus: '-', Equal: '=', Backspace: '⌫',
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y',
  KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H',
  KeyJ: 'J', KeyK: 'K', KeyL: 'L',
  Semicolon: ';', Quote: "'", Enter: '↵',
  ShiftLeft: '⇧L', KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B',
  KeyN: 'N', KeyM: 'M', Comma: ',', Period: '.', Slash: '/', ShiftRight: '⇧R',
  Backquote: '`', Tab: 'Tab', CapsLock: 'Caps', Space: 'Space',
  ControlLeft: 'CtrlL', ControlRight: 'CtrlR', AltLeft: 'AltL', AltRight: 'AltR',
  MetaLeft: 'WinL', MetaRight: 'WinR',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
  Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3',
  Numpad4: 'Num4', Numpad5: 'Num5', Numpad6: 'Num6', Numpad7: 'Num7',
  Numpad8: 'Num8', Numpad9: 'Num9', NumpadAdd: 'Num+', NumpadSubtract: 'Num-',
  NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadEnter: 'Num↵', NumpadDecimal: 'Num.',
  NumpadEqual: 'Num=',
};

/**
 * Returns formatted label for a physical key code
 */
export function getKeyDisplayLabel(code: string): string {
  if (!code) return '';
  if (KEYBOARD_DISPLAY_LABELS[code]) return KEYBOARD_DISPLAY_LABELS[code];
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad') && code.length > 6) return 'Num' + code.slice(6);
  return code;
}

/**
 * Constructs lookup maps from a 6x4, 6x12, 8x12, or 9x18 keyboard matrix
 */
export function buildKeyboardMaps(matrix: string[][]) {
  const keyToMidi: Record<string, number> = {};
  const keyToNoteName: Record<string, string> = {};
  const keyToCol: Record<string, number> = {};
  const keyToColor: Record<string, string> = {};

  const notesMat = getNotesMatrixForMatrix(matrix);

  for (let r = 0; r < matrix.length; r++) {
    const rowCodes = matrix[r];
    const rowNotes = notesMat[r];
    if (!rowCodes || !rowNotes) continue;
    const halfCol = Math.ceil(rowCodes.length / 2);
    for (let c = 0; c < rowCodes.length; c++) {
      const code = rowCodes[c];
      if (!code) continue;
      const noteName = rowNotes[c];
      if (!noteName) continue;
      const midi = noteNameToMidi(noteName);
      keyToMidi[code] = midi;
      keyToNoteName[code] = noteName;
      keyToCol[code] = c;
      keyToColor[code] = c < halfCol ? MAGENTA_HEX : CYAN_HEX;
    }
  }

  return { keyToMidi, keyToNoteName, keyToCol, keyToColor };
}

const STORAGE_KEY = 'piano_custom_keyboard_matrix';

/**
 * Loads custom keyboard matrix from local storage or falls back to default
 */
export function loadCustomKeyboardMatrix(): string[][] {
  if (typeof window === 'undefined') return KEYBOARD_EVENT_MATRIX;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate legacy 7x18 matrices to 9x18 (2 top rows)
      if (
        Array.isArray(parsed) &&
        parsed.length === 7 &&
        parsed.every((row: string[]) => Array.isArray(row) && row.length === 18)
      ) {
        return [Array(18).fill(""), Array(18).fill(""), ...parsed];
      }
      // Migrate legacy 6x18 matrices to 9x18 (3 top rows)
      if (
        Array.isArray(parsed) &&
        parsed.length === 6 &&
        parsed.every((row: string[]) => Array.isArray(row) && row.length === 18)
      ) {
        return [Array(18).fill(""), Array(18).fill(""), Array(18).fill(""), ...parsed];
      }
      // Migrate legacy 9x12 matrices to 9x18
      if (
        Array.isArray(parsed) &&
        parsed.length === 9 &&
        parsed.every((row: string[]) => Array.isArray(row) && row.length === 12)
      ) {
        return parsed.map((row: string[]) => [...row, "", "", "", "", "", ""]);
      }
      // Valid matrices: 6x4, 6x12, 8x12, 9x18
      if (
        Array.isArray(parsed) &&
        (parsed.length === 6 || parsed.length === 8 || parsed.length === 9) &&
        parsed.every((row: string[]) => Array.isArray(row) && (row.length === 12 || row.length === 18 || row.length === 4))
      ) {
        return parsed;
      }
      // Migrate legacy 5x12 matrices by appending blank bottom layer
      if (
        Array.isArray(parsed) &&
        parsed.length === 5 &&
        parsed.every((row: string[]) => Array.isArray(row) && row.length === 12)
      ) {
        return [...parsed, ["", "", "", "", "", "", "", "", "", "", "", ""]];
      }
    }
  } catch (e) {
    console.warn('Failed to parse custom keyboard matrix:', e);
  }
  return KEYBOARD_EVENT_MATRIX;
}

/**
 * Saves custom keyboard matrix to local storage
 */
export function saveCustomKeyboardMatrix(matrix: string[][]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
  } catch (e) {
    console.warn('Failed to save custom keyboard matrix:', e);
  }
}

// Backwards compatibility alias
export const KEYBOARD_KEY_MAP = KEYBOARD_EVENT_MAP;

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function parseColorToRGB(colorStr: string): RGBColor {
  if (!colorStr) return { r: 58, g: 124, b: 255 };
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      };
    }
  }
  if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0], 10),
        g: parseInt(match[1], 10),
        b: parseInt(match[2], 10),
      };
    }
  }
  if (trimmed.startsWith('hsl')) {
    const match = trimmed.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (match) {
      const h = parseInt(match[1], 10);
      const s = parseFloat(match[2]) / 100;
      const l = parseFloat(match[3]) / 100;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (0 <= h && h < 60) { r = c; g = x; b = 0; }
      else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
      else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
      else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
      else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
      else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
      return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
      };
    }
  }
  return { r: 58, g: 124, b: 255 };
}

export function mixColors(colors: string[]): string {
  if (!colors || colors.length === 0) return CYAN_HEX;
  if (colors.length === 1) return colors[0];

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const c of colors) {
    const rgb = parseColorToRGB(c);
    totalR += rgb.r;
    totalG += rgb.g;
    totalB += rgb.b;
  }

  const count = colors.length;
  const r = Math.round(totalR / count);
  const g = Math.round(totalG / count);
  const b = Math.round(totalB / count);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Fast zero-allocation 2-color integer blend using bitwise math
 */
export function mixColorsInt(colorA: number, colorB: number): number {
  const r = (((colorA >> 16) & 0xff) + ((colorB >> 16) & 0xff)) >> 1;
  const g = (((colorA >> 8) & 0xff) + ((colorB >> 8) & 0xff)) >> 1;
  const b = ((colorA & 0xff) + (colorB & 0xff)) >> 1;
  return (r << 16) | (g << 8) | b;
}

/**
 * Fast zero-allocation 3-color integer blend
 */
export function mixColors3Int(colorA: number, colorB: number, colorC: number): number {
  const r = Math.round((((colorA >> 16) & 0xff) + ((colorB >> 16) & 0xff) + ((colorC >> 16) & 0xff)) / 3);
  const g = Math.round((((colorA >> 8) & 0xff) + ((colorB >> 8) & 0xff) + ((colorC >> 8) & 0xff)) / 3);
  const b = Math.round(((colorA & 0xff) + (colorB & 0xff) + (colorC & 0xff)) / 3);
  return (r << 16) | (g << 8) | b;
}

/**
 * Fast conversion from color string (#hex, rgb, hsl) to 24-bit numeric integer
 */
export function parseColorToInt(colorStr: string): number {
  if (!colorStr) return CYAN_INT;
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    const num = parseInt(hex, 16);
    return isNaN(num) ? CYAN_INT : num;
  }
  const rgb = parseColorToRGB(colorStr);
  return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
}


