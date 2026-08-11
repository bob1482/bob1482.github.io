import { describe, it, expect } from 'vitest';
import { noteNameToMidi, midiToNoteName, toNumberedNotation, hasSample, CHROMATIC_NOTES } from '../src/NoteUtils';

describe('NoteUtils', () => {
  describe('noteNameToMidi', () => {
    it('should convert C4 to MIDI 60', () => {
      expect(noteNameToMidi('C4')).toBe(60);
    });

    it('should convert A4 to MIDI 69', () => {
      expect(noteNameToMidi('A4')).toBe(69);
    });

    it('should convert C#4 to MIDI 61', () => {
      expect(noteNameToMidi('C#4')).toBe(61);
    });

    it('should convert C0 to MIDI 12', () => {
      expect(noteNameToMidi('C0')).toBe(12);
    });

    it('should convert C-1 to MIDI 0', () => {
      expect(noteNameToMidi('C-1')).toBe(0);
    });

    it('should return -1 for invalid note names', () => {
      expect(noteNameToMidi('H4')).toBe(-1);
      expect(noteNameToMidi('')).toBe(-1);
      expect(noteNameToMidi('abc')).toBe(-1);
    });
  });

  describe('midiToNoteName', () => {
    it('should convert MIDI 60 to C4', () => {
      expect(midiToNoteName(60)).toBe('C4');
    });

    it('should convert MIDI 69 to A4', () => {
      expect(midiToNoteName(69)).toBe('A4');
    });

    it('should convert MIDI 61 to C#4', () => {
      expect(midiToNoteName(61)).toBe('C#4');
    });

    it('should convert MIDI 0 to C-1', () => {
      expect(midiToNoteName(0)).toBe('C-1');
    });

    it('should round-trip note names through MIDI', () => {
      const noteNames = ['C4', 'D#3', 'F#5', 'A0', 'B7'];
      for (const noteName of noteNames) {
        const midi = noteNameToMidi(noteName);
        expect(midiToNoteName(midi)).toBe(noteName);
      }
    });
  });

  describe('toNumberedNotation', () => {
    it('should return degree 1 for C (MIDI 60)', () => {
      const result = toNumberedNotation(60);
      expect(result.degree).toBe('1');
      expect(result.dotsAbove).toBe(0);
      expect(result.dotsBelow).toBe(0);
    });

    it('should return degree 2 for D (MIDI 62)', () => {
      const result = toNumberedNotation(62);
      expect(result.degree).toBe('2');
    });

    it('should return #1 for C# (MIDI 61)', () => {
      const result = toNumberedNotation(61);
      expect(result.degree).toBe('#1');
    });

    it('should return 7 for B (MIDI 71)', () => {
      const result = toNumberedNotation(71);
      expect(result.degree).toBe('7');
    });

    it('should show 1 dot below for octave 3 (MIDI 48-59)', () => {
      const result = toNumberedNotation(48); // C3
      expect(result.dotsBelow).toBe(1);
      expect(result.dotsAbove).toBe(0);
    });

    it('should show 2 dots below for octave 2 (MIDI 36-47)', () => {
      const result = toNumberedNotation(36); // C2
      expect(result.dotsBelow).toBe(2);
      expect(result.dotsAbove).toBe(0);
    });

    it('should show 3 dots below for octave 1 (MIDI 24-35)', () => {
      const result = toNumberedNotation(24); // C1
      expect(result.dotsBelow).toBe(3);
      expect(result.dotsAbove).toBe(0);
    });

    it('should show 3 dots below for octave 0 (MIDI 12-23)', () => {
      const result = toNumberedNotation(12); // C0
      expect(result.dotsBelow).toBe(3);
      expect(result.dotsAbove).toBe(0);
    });

    it('should show no dots for octave 4 (MIDI 60-71)', () => {
      for (let midi = 60; midi <= 71; midi++) {
        const result = toNumberedNotation(midi);
        expect(result.dotsAbove).toBe(0);
        expect(result.dotsBelow).toBe(0);
      }
    });

    it('should show 1 dot above for octave 5 (MIDI 72-83)', () => {
      const result = toNumberedNotation(72); // C5
      expect(result.dotsAbove).toBe(1);
      expect(result.dotsBelow).toBe(0);
    });

    it('should show 2 dots above for octave 6 (MIDI 84-95)', () => {
      const result = toNumberedNotation(84); // C6
      expect(result.dotsAbove).toBe(2);
      expect(result.dotsBelow).toBe(0);
    });

    it('should show 3 dots above for octave 7+ (MIDI 96+)', () => {
      const result = toNumberedNotation(96); // C7
      expect(result.dotsAbove).toBe(3);
      expect(result.dotsBelow).toBe(0);
    });
  });

  describe('hasSample', () => {
    it('should return true if note is in sample set', () => {
      const samples = new Set(['C4', 'D#3']);
      expect(hasSample('C4', samples)).toBe(true);
      expect(hasSample('D#3', samples)).toBe(true);
    });

    it('should return false if note is not in sample set', () => {
      const samples = new Set(['C4']);
      expect(hasSample('D4', samples)).toBe(false);
    });
  });

  describe('CHROMATIC_NOTES', () => {
    it('should have 12 notes starting from C', () => {
      expect(CHROMATIC_NOTES).toHaveLength(12);
      expect(CHROMATIC_NOTES[0]).toBe('C');
    });
  });
});