export interface HexKey {
  col: number;
  row: number;
  midi: number;
  noteName: string;
  hasSample: boolean;
  isPressed: boolean;
  centerX: number;
  centerY: number;
}

export const LONG_PRESS_MS = 500;