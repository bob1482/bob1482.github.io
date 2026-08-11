import { describe, it, expect } from 'vitest';
import { hitTestHexagon, keyId } from '../src/HexUtils';

describe('HexUtils', () => {
  describe('hitTestHexagon', () => {
    it('should return true for the center point', () => {
      expect(hitTestHexagon(0, 0, 0, 0, 30)).toBe(true);
    });

    it('should return true for points inside the hexagon', () => {
      // Points well within the hexagon
      expect(hitTestHexagon(5, 5, 0, 0, 30)).toBe(true);
      expect(hitTestHexagon(-5, -5, 0, 0, 30)).toBe(true);
      expect(hitTestHexagon(10, 0, 0, 0, 30)).toBe(true);
    });

    it('should return false for points outside the hexagon', () => {
      // Points clearly outside
      expect(hitTestHexagon(50, 50, 0, 0, 30)).toBe(false);
      expect(hitTestHexagon(-50, -50, 0, 0, 30)).toBe(false);
      expect(hitTestHexagon(0, 50, 0, 0, 30)).toBe(false);
    });

    it('should work with non-zero center', () => {
      expect(hitTestHexagon(105, 105, 100, 100, 30)).toBe(true);
      expect(hitTestHexagon(200, 200, 100, 100, 30)).toBe(false);
    });

    it('should handle the top vertex', () => {
      // Top vertex is at (centerX, centerY - size)
      expect(hitTestHexagon(0, -29, 0, 0, 30)).toBe(true);
    });

    it('should handle the bottom vertex', () => {
      // Bottom vertex is at (centerX, centerY + size)
      expect(hitTestHexagon(0, 29, 0, 0, 30)).toBe(true);
    });
  });

  describe('keyId', () => {
    it('should generate a unique key from midi and index', () => {
      expect(keyId(60, 0)).toBe('60_0');
      expect(keyId(62, 5)).toBe('62_5');
    });

    it('should generate different IDs for different inputs', () => {
      expect(keyId(60, 0)).not.toBe(keyId(60, 1));
      expect(keyId(60, 0)).not.toBe(keyId(61, 0));
    });
  });
});