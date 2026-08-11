import { describe, it, expect } from 'vitest';
import { buildGrid, updateLayoutPortrait, updateLayoutLandscapeSingle } from '../src/GridLayout';

// Create a sample set with all notes available
const ALL_SAMPLES = new Set([
  'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
]);

describe('GridLayout', () => {
  describe('buildGrid', () => {
    it('should build a grid with the correct number of keys', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36);
      // 4 cols × 10 rows = 40, but skipFirstRow skips col 0 on even rows
      // Even rows: 0, 2, 4, 6, 8 → 5 rows with 3 keys each = 15
      // Odd rows: 1, 3, 5, 7, 9 → 5 rows with 4 keys each = 20
      // Total: 35 keys
      expect(keys).toHaveLength(35);
    });

    it('should build a grid without skipping first row when skipFirstRow is false', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36, false);
      // 4 cols × 10 rows = 40 keys
      expect(keys).toHaveLength(40);
    });

    it('should assign correct MIDI numbers for Wicki-Heyden layout', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36, false);
      // Row 0 (C octave), col 0: baseMidi + 0*2 - 2 = 34 (A1)
      // But wait, the formula is: midi = rowBase + col * 2 - 2
      // Row 0, rowBase = 36, col 0: midi = 36 + 0 - 2 = 34 (A1)
      // Row 0, col 1: midi = 36 + 2 - 2 = 36 (C2)
      expect(keys[0].midi).toBe(34);
      expect(keys[1].midi).toBe(36);
    });

    it('should set hasSample based on available samples', () => {
      const limitedSamples = new Set(['C2']);
      const keys = buildGrid(limitedSamples, 4, 10, 36, false);
      // Find the C2 key (midi 36)
      const c2Key = keys.find(k => k.midi === 36);
      expect(c2Key).toBeDefined();
      expect(c2Key!.hasSample).toBe(true);

      // Other keys should not have samples
      const otherKey = keys.find(k => k.midi === 38);
      if (otherKey) {
        expect(otherKey.hasSample).toBe(false);
      }
    });

    it('should initialize all keys as not pressed', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36);
      for (const key of keys) {
        expect(key.isPressed).toBe(false);
      }
    });
  });

  describe('updateLayoutPortrait', () => {
    it('should position keys within the screen bounds', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36);
      const result = updateLayoutPortrait(400, 800, keys, 10);

      for (const key of result.activeKeys) {
        expect(key.centerX).toBeGreaterThanOrEqual(0);
        expect(key.centerX).toBeLessThanOrEqual(400);
        expect(key.centerY).toBeGreaterThanOrEqual(0);
        expect(key.centerY).toBeLessThanOrEqual(800);
      }
    });

    it('should compute a positive hex size', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36);
      const result = updateLayoutPortrait(400, 800, keys, 10);
      expect(result.hexSize).toBeGreaterThan(0);
    });

    it('should assign indices to all keys', () => {
      const keys = buildGrid(ALL_SAMPLES, 4, 10, 36);
      const result = updateLayoutPortrait(400, 800, keys, 10);
      for (let i = 0; i < result.activeKeys.length; i++) {
        expect(result.activeKeys[i].index).toBe(i);
      }
    });
  });

  describe('updateLayoutLandscapeSingle', () => {
    it('should position keys within the screen bounds', () => {
      const keys = buildGrid(ALL_SAMPLES, 12, 8, 36, false);
      const result = updateLayoutLandscapeSingle(800, 400, keys, 8);

      for (const key of result.activeKeys) {
        expect(key.centerX).toBeGreaterThanOrEqual(0);
        expect(key.centerX).toBeLessThanOrEqual(800);
        expect(key.centerY).toBeGreaterThanOrEqual(0);
        expect(key.centerY).toBeLessThanOrEqual(400);
      }
    });

    it('should compute a positive hex size', () => {
      const keys = buildGrid(ALL_SAMPLES, 12, 8, 36, false);
      const result = updateLayoutLandscapeSingle(800, 400, keys, 8);
      expect(result.hexSize).toBeGreaterThan(0);
    });

    it('should handle shiftOddColumnsLeft option', () => {
      const keys = buildGrid(ALL_SAMPLES, 12, 8, 36, false);
      const resultWithoutShift = updateLayoutLandscapeSingle(800, 400, keys, 8, false);
      const resultWithShift = updateLayoutLandscapeSingle(800, 400, keys, 8, true);

      // Both should produce valid layouts
      expect(resultWithoutShift.hexSize).toBeGreaterThan(0);
      expect(resultWithShift.hexSize).toBeGreaterThan(0);
      expect(resultWithoutShift.activeKeys).toHaveLength(resultWithShift.activeKeys.length);
    });
  });
});