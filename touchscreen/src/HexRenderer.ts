import * as PIXI from 'pixi.js';
import { HexKey } from './HexKey';
import { drawRoundedHexagon, keyId } from './HexUtils';

/** Shared color constants for hex keys */
export const HexColors = {
  // Natural (white) keys
  NATURAL_FILL: 0xf0f0f0,
  NATURAL_BORDER: 0xcccccc,
  NATURAL_PRESSED_FILL: 0xdddddd,
  NATURAL_PRESSED_BORDER: 0xbbbbbb,
  NATURAL_TEXT: 0x666666,

  // Accidental (black) keys
  ACCIDENTAL_FILL: 0x333333,
  ACCIDENTAL_BORDER: 0x444444,
  ACCIDENTAL_PRESSED_FILL: 0x555555,
  ACCIDENTAL_PRESSED_BORDER: 0x444444,
  ACCIDENTAL_TEXT: 0xffffff,

  // No-sample keys (dimmed)
  NO_SAMPLE_OPACITY: 0.25,
} as const;

export interface KeyColors {
  fillColor: number;
  borderColor: number;
  textColor: number;
  alpha: number;
}

/** Determine the colors for a hex key based on its state */
export function getKeyColors(key: HexKey): KeyColors {
  const isAccidental = key.noteName.includes('#');

  if (isAccidental) {
    if (key.isPressed) {
      return {
        fillColor: HexColors.ACCIDENTAL_PRESSED_FILL,
        borderColor: HexColors.ACCIDENTAL_PRESSED_BORDER,
        textColor: HexColors.ACCIDENTAL_TEXT,
        alpha: 1.0,
      };
    } else {
      return {
        fillColor: HexColors.ACCIDENTAL_FILL,
        borderColor: HexColors.ACCIDENTAL_BORDER,
        textColor: HexColors.ACCIDENTAL_TEXT,
        alpha: 1.0,
      };
    }
  } else {
    if (key.isPressed) {
      return {
        fillColor: HexColors.NATURAL_PRESSED_FILL,
        borderColor: HexColors.NATURAL_PRESSED_BORDER,
        textColor: HexColors.NATURAL_TEXT,
        alpha: 1.0,
      };
    } else {
      return {
        fillColor: HexColors.NATURAL_FILL,
        borderColor: HexColors.NATURAL_BORDER,
        textColor: HexColors.NATURAL_TEXT,
        alpha: 1.0,
      };
    }
  }
}

/** Clear and redraw a hex key's graphics with the correct colors */
export function renderHexKey(graphics: PIXI.Graphics, key: HexKey, hexSize: number): void {
  const colors = getKeyColors(key);
  graphics.clear();
  graphics.beginFill(colors.fillColor, colors.alpha);
  graphics.lineStyle(1, colors.borderColor, colors.alpha);
  drawRoundedHexagon(graphics, key.centerX, key.centerY, hexSize, hexSize);
  graphics.endFill();
}

/**
 * Update a hex key's visual state using O(1) lookup.
 * Shared between PointerHandler and KeyboardHandler to avoid duplication.
 *
 * @param key The hex key to update
 * @param hexGraphics Map of key IDs to PIXI.Graphics objects
 * @param hexSize Current hex size for rendering
 */
export function updateKeyVisual(
  key: HexKey,
  hexGraphics: Map<string, PIXI.Graphics>,
  hexSize: number,
): void {
  if (!key) return;

  const id = keyId(key.midi, key.index);
  const graphics = hexGraphics.get(id);
  if (!graphics) return;

  renderHexKey(graphics, key, hexSize);
}
