'use client';

import React, { memo, useCallback, useRef, useEffect } from 'react';
import {
  PIANO_KEYS,
  PIANO_KEYS_BY_MIDI,
  MIN_MIDI,
  MAX_MIDI,
  TRIMMED_MIN_MIDI,
  TRIMMED_MAX_MIDI,
  getTotalWidthUnits,
  getKeyLayoutPercent,
  isBlackMidi,
  getMidiNoteName,
} from '@/lib/pianoGeometry';
import { midiManager } from '@/lib/midiEngine';
import type { NoteSide } from '@/lib/audioEngine';

interface PianoKeyboardProps {
  trimOuterOctaves?: boolean;
  fadeJankoMode?: boolean;
  leftNoteColor?: string;
  rightNoteColor?: string;
  jankoBoardColor?: string;
  jankoTranspose?: number;
  onNoteOn: (midi: number, velocity?: number, inputId?: string) => void;
  onNoteOff: (midi: number, inputId?: string) => void;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = memo(({
  trimOuterOctaves = true,
  fadeJankoMode = false,
  leftNoteColor = '#ffffff',
  rightNoteColor = '#ffffff',
  jankoBoardColor = '#ffffff',
  jankoTranspose = 0,
  onNoteOn,
  onNoteOff,
}) => {
  const keyElementsRef = useRef<Map<number, Set<HTMLDivElement>>>(new Map());
  const activeInputsPerMidiRef = useRef<Map<number, Set<string>>>(new Map());
  const activePointersRef = useRef<Map<number, number>>(new Map());
  const isMouseDownRef = useRef(false);
  const fadeJankoModeRef = useRef(fadeJankoMode);
  fadeJankoModeRef.current = fadeJankoMode;
  const leftColorRef = useRef(leftNoteColor);
  leftColorRef.current = leftNoteColor;
  const rightColorRef = useRef(rightNoteColor);
  rightColorRef.current = rightNoteColor;
  const boardColorRef = useRef(jankoBoardColor);
  boardColorRef.current = jankoBoardColor;
  const jankoTransposeRef = useRef(jankoTranspose);
  jankoTransposeRef.current = jankoTranspose;

  const applyInactiveStyle = useCallback((el: HTMLDivElement, isBlack: boolean, boardColor: string) => {
    el.style.backgroundColor = isBlack ? '' : boardColor;
    el.style.borderColor = boardColor;
  }, []);

  const resetAllKeys = useCallback(() => {
    activeInputsPerMidiRef.current.clear();
    keyElementsRef.current.forEach((elements, midi) => {
      if (!PIANO_KEYS_BY_MIDI[midi]) return;
      const isBlack = isBlackMidi(midi + jankoTransposeRef.current);
      elements.forEach((el) => {
        el.style.transition = '';
        el.style.opacity = fadeJankoModeRef.current ? '0' : '';
        applyInactiveStyle(el, isBlack, boardColorRef.current);
        el.removeAttribute('data-active');
      });
    });
  }, [applyInactiveStyle]);

  useEffect(() => {
    keyElementsRef.current.forEach((elements, midi) => {
      if (activeInputsPerMidiRef.current.has(midi)) return;
      const hasKey = Boolean(PIANO_KEYS_BY_MIDI[midi]);
      const isBlack = isBlackMidi(midi + jankoTranspose);
      elements.forEach((el) => {
        el.style.transition = '';
        el.style.opacity = fadeJankoMode ? '0' : '';
        if (!fadeJankoMode && hasKey) {
          applyInactiveStyle(el, isBlack, jankoBoardColor);
        }
      });
    });
  }, [fadeJankoMode, jankoBoardColor, jankoTranspose, applyInactiveStyle]);

  useEffect(() => {
    resetAllKeys();
  }, [jankoTranspose, resetAllKeys]);

  useEffect(() => {
    const handleNoteOn = (
      midi: number,
      _velocity: number,
      isLiveInput: boolean,
      inputId?: string,
      side?: NoteSide
    ) => {
      const boardMidi = midi - jankoTransposeRef.current;
      const elements = keyElementsRef.current.get(boardMidi);
      if (!elements || elements.size === 0) return;

      const keyId = inputId || (isLiveInput ? `live-${Date.now()}-${Math.random()}` : `song-${Date.now()}-${Math.random()}`);
      let inputs = activeInputsPerMidiRef.current.get(boardMidi);
      if (!inputs) {
        inputs = new Set();
        activeInputsPerMidiRef.current.set(boardMidi, inputs);
      }
      inputs.add(keyId);

      const isBlack = isBlackMidi(midi);
      const resolvedSide = side === 'left' || side === 'right' ? side : (midi >= 60 ? 'right' : 'left');
      const color = resolvedSide === 'right' ? rightColorRef.current : leftColorRef.current;

      elements.forEach((el) => {
        if (fadeJankoModeRef.current) {
          el.style.transition = 'none';
          el.style.borderColor = color;
          if (!isBlack) {
            el.style.backgroundColor = color;
          } else {
            el.style.backgroundColor = '';
          }
          el.style.opacity = '1';
        } else {
          el.style.transition = '';
          el.style.opacity = '0';
        }
        el.setAttribute('data-active', 'true');
      });
    };

    const handleNoteOff = (midi: number, isLiveInput: boolean, inputId?: string) => {
      const boardMidi = midi - jankoTransposeRef.current;
      const elements = keyElementsRef.current.get(boardMidi);
      if (!elements || elements.size === 0 || !PIANO_KEYS_BY_MIDI[boardMidi]) return;

      const inputs = activeInputsPerMidiRef.current.get(boardMidi);
      if (inputs) {
        if (inputId) {
          if (!inputs.delete(inputId)) return;
        } else {
          const target = Array.from(inputs).find((k) => (isLiveInput ? !k.startsWith('song') : k.startsWith('song')))
            ?? inputs.values().next().value;
          if (target !== undefined) inputs.delete(target);
        }
        if (inputs.size === 0) {
          activeInputsPerMidiRef.current.delete(boardMidi);
        }
      }

      if (!activeInputsPerMidiRef.current.has(boardMidi)) {
        const isBlack = isBlackMidi(midi);
        elements.forEach((el) => {
          if (fadeJankoModeRef.current) {
            void el.offsetWidth;
            el.style.transition = 'opacity 900ms ease-out';
            el.style.opacity = '0';
          } else {
            el.style.transition = '';
            el.style.opacity = '';
            applyInactiveStyle(el, isBlack, boardColorRef.current);
          }
          el.removeAttribute('data-active');
        });
      }
    };

    const unsubOn = midiManager.onNoteOn(handleNoteOn);
    const unsubOff = midiManager.onNoteOff(handleNoteOff);
    return () => {
      unsubOn();
      unsubOff();
    };
  }, []);

  const getMidiFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const keyEl = el?.closest('[data-midi]');
    const midiAttr = keyEl?.getAttribute('data-midi');
    return midiAttr ? parseInt(midiAttr, 10) : null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') isMouseDownRef.current = true;

    const boardMidi = getMidiFromPoint(e.clientX, e.clientY);
    const soundingMidi = boardMidi !== null ? boardMidi + jankoTransposeRef.current : -1;
    if (soundingMidi >= 0 && soundingMidi <= 127) {
      activePointersRef.current.set(e.pointerId, soundingMidi);
      onNoteOn(soundingMidi, 0.85, `pointer:${e.pointerId}`);
    } else {
      activePointersRef.current.set(e.pointerId, -1);
    }
  }, [getMidiFromPoint, onNoteOn]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) {
        if (!(e.pointerType === 'mouse' && (e.buttons & 1) === 1 && isMouseDownRef.current)) return;
      }

      const prevMidi = activePointersRef.current.get(e.pointerId) ?? -1;
      const nextBoardMidi = getMidiFromPoint(e.clientX, e.clientY);
      const nextRawMidi = nextBoardMidi !== null ? nextBoardMidi + jankoTransposeRef.current : -1;
      const nextMidi = nextRawMidi >= 0 && nextRawMidi <= 127 ? nextRawMidi : -1;

      if (nextMidi !== prevMidi) {
        const inputId = `pointer:${e.pointerId}`;
        if (prevMidi !== -1) onNoteOff(prevMidi, inputId);
        if (nextMidi !== -1) {
          activePointersRef.current.set(e.pointerId, nextMidi);
          onNoteOn(nextMidi, 0.85, inputId);
        } else {
          activePointersRef.current.set(e.pointerId, -1);
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') isMouseDownRef.current = false;
      const prevMidi = activePointersRef.current.get(e.pointerId);
      if (prevMidi !== undefined) {
        if (prevMidi !== -1) onNoteOff(prevMidi, `pointer:${e.pointerId}`);
        activePointersRef.current.delete(e.pointerId);
      }
    };

    const handleWindowBlur = () => {
      isMouseDownRef.current = false;
      activePointersRef.current.forEach((midi, pointerId) => {
        if (midi !== -1) onNoteOff(midi, `pointer:${pointerId}`);
      });
      activePointersRef.current.clear();
      resetAllKeys();
    };

    const handleVisibility = () => {
      if (document.hidden) handleWindowBlur();
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [getMidiFromPoint, onNoteOn, onNoteOff, resetAllKeys]);

  const minMidi = trimOuterOctaves ? TRIMMED_MIN_MIDI : MIN_MIDI;
  const maxMidi = trimOuterOctaves ? TRIMMED_MAX_MIDI : MAX_MIDI;
  const visibleKeys = PIANO_KEYS.filter((k) => k.midi >= minMidi && k.midi <= maxMidi);
  const totalWidthUnits = getTotalWidthUnits(trimOuterOctaves);

  return (
    <nav
      aria-label="Jankó keyboard"
      suppressHydrationWarning
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full bg-transparent select-none touch-none overflow-hidden z-30 shrink-0"
      style={{ height: `calc((100vw / ${totalWidthUnits}) * 4 + 12px)` }}
    >
      {visibleKeys.flatMap((key) => {
        const { leftPercent, widthPercent, row } = getKeyLayoutPercent(key.midi, trimOuterOctaves);
        const soundingMidi = key.midi + jankoTranspose;
        const isBlack = isBlackMidi(soundingMidi);
        const noteName = getMidiNoteName(soundingMidi);
        return [row, row + 2].map((rowIndex) => (
          <div
            key={`${key.midi}-${rowIndex}`}
            role="button"
            tabIndex={-1}
            aria-label={`Key ${noteName}`}
            data-midi={key.midi}
            className="absolute p-[2px] flex items-center justify-center cursor-pointer select-none"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: `calc(${rowIndex * 25}% + 1px)`,
              height: 'calc(25% - 2px)',
            }}
          >
            <div
              ref={(el) => {
                if (el) {
                  let set = keyElementsRef.current.get(key.midi);
                  if (!set) {
                    set = new Set();
                    keyElementsRef.current.set(key.midi, set);
                  }
                  set.add(el);
                } else {
                  keyElementsRef.current.delete(key.midi);
                }
              }}
              className={`w-full aspect-square rounded-[32%] transition-all duration-75 pointer-events-none ${
                isBlack ? 'bg-transparent border-[3px]' : 'border-2'
              }`}
              style={{
                backgroundColor: isBlack ? undefined : jankoBoardColor,
                borderColor: jankoBoardColor,
                opacity: fadeJankoMode ? 0 : undefined,
              }}
            />
          </div>
        ));
      })}
    </nav>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';
