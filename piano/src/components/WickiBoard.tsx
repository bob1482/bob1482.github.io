'use client';

import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  WICKI_LEFT_KEYS,
  WICKI_RIGHT_KEYS,
  WICKI_BOARD_ROWS,
  WICKI_BOARD_WIDTH_UNITS,
  isBlackMidi,
  getMidiNoteName,
} from '@/lib/pianoGeometry';
import { midiManager } from '@/lib/midiEngine';
import type { NoteSide } from '@/lib/audioEngine';

interface WickiBoardProps {
  side: 'left' | 'right';
  fadeJankoMode?: boolean;
  leftNoteColor?: string;
  rightNoteColor?: string;
  boardColor?: string;
  midiInputTranspose?: number;
  onNoteOn: (midi: number, velocity?: number, inputId?: string, side?: 'left' | 'right') => void;
  onNoteOff: (midi: number, inputId?: string, side?: 'left' | 'right') => void;
}

export const WickiBoard: React.FC<WickiBoardProps> = memo(({
  side,
  fadeJankoMode = false,
  leftNoteColor = '#ffffff',
  rightNoteColor = '#ffffff',
  boardColor = '#ffffff',
  midiInputTranspose = 0,
  onNoteOn,
  onNoteOff,
}) => {
  const keys = side === 'left' ? WICKI_LEFT_KEYS : WICKI_RIGHT_KEYS;
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
  const boardColorRef = useRef(boardColor);
  boardColorRef.current = boardColor;
  const midiInputTransposeRef = useRef(midiInputTranspose);
  midiInputTransposeRef.current = midiInputTranspose;

  const applyInactiveStyle = useCallback((el: HTMLDivElement, isBlack: boolean, color: string) => {
    el.style.backgroundColor = isBlack ? '' : color;
    el.style.borderColor = color;
  }, []);

  const resetAllKeys = useCallback(() => {
    activeInputsPerMidiRef.current.clear();
    keyElementsRef.current.forEach((elements, midi) => {
      const isBlack = isBlackMidi(midi + midiInputTransposeRef.current);
      elements.forEach((el) => {
        el.style.transition = '';
        el.style.opacity = fadeJankoModeRef.current ? '0' : '';
        applyInactiveStyle(el, isBlack, boardColorRef.current);
        el.removeAttribute('data-active');
      });
    });
  }, [applyInactiveStyle]);

  useEffect(() => {
    resetAllKeys();
  }, [midiInputTranspose, resetAllKeys]);

  useEffect(() => {
    keyElementsRef.current.forEach((elements, midi) => {
      if (activeInputsPerMidiRef.current.has(midi)) return;
      const isBlack = isBlackMidi(midi + midiInputTranspose);
      elements.forEach((el) => {
        el.style.transition = '';
        el.style.opacity = fadeJankoMode ? '0' : '';
        if (!fadeJankoMode) {
          applyInactiveStyle(el, isBlack, boardColor);
        }
      });
    });
  }, [fadeJankoMode, boardColor, midiInputTranspose, applyInactiveStyle]);

  useEffect(() => {
    const handleNoteOn = (
      midi: number,
      _velocity: number,
      isLiveInput: boolean,
      inputId?: string,
      noteSide?: NoteSide
    ) => {
      const resolvedSide = noteSide === 'left' || noteSide === 'right' ? noteSide : (midi >= 60 ? 'right' : 'left');
      if (resolvedSide !== side) return;

      const boardMidi = midi - midiInputTransposeRef.current;
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
      const color = resolvedSide === 'right' ? rightColorRef.current : leftColorRef.current;

      elements.forEach((el) => {
        if (fadeJankoModeRef.current) {
          el.style.transition = 'none';
          el.style.borderColor = color;
          el.style.backgroundColor = isBlack ? '' : color;
          el.style.opacity = '1';
        } else {
          el.style.transition = '';
          el.style.opacity = '0';
        }
        el.setAttribute('data-active', 'true');
      });
    };

    const handleNoteOff = (midi: number, isLiveInput: boolean, inputId?: string) => {
      const boardMidi = midi - midiInputTransposeRef.current;
      const elements = keyElementsRef.current.get(boardMidi);
      if (!elements || elements.size === 0) return;

      const inputs = activeInputsPerMidiRef.current.get(boardMidi);
      if (!inputs) return;

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
  }, [side, applyInactiveStyle]);

  const getMidiFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const keyEl = el?.closest(`[data-wicki-side="${side}"][data-wicki-midi]`);
    const midiAttr = keyEl?.getAttribute('data-wicki-midi');
    return midiAttr ? parseInt(midiAttr, 10) : null;
  }, [side]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') isMouseDownRef.current = true;

    const boardMidi = getMidiFromPoint(e.clientX, e.clientY);
    const soundingMidi = boardMidi !== null ? boardMidi + midiInputTransposeRef.current : -1;
    if (soundingMidi >= 0 && soundingMidi <= 127) {
      activePointersRef.current.set(e.pointerId, soundingMidi);
      onNoteOn(soundingMidi, 0.85, `wicki:${side}:${e.pointerId}`, side);
    } else {
      activePointersRef.current.set(e.pointerId, -1);
    }
  }, [getMidiFromPoint, onNoteOn, side]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!activePointersRef.current.has(e.pointerId)) {
        if (!(e.pointerType === 'mouse' && (e.buttons & 1) === 1 && isMouseDownRef.current)) return;
      }

      const prevMidi = activePointersRef.current.get(e.pointerId) ?? -1;
      const nextBoardMidi = getMidiFromPoint(e.clientX, e.clientY);
      const nextRawMidi = nextBoardMidi !== null ? nextBoardMidi + midiInputTransposeRef.current : -1;
      const nextMidi = nextRawMidi >= 0 && nextRawMidi <= 127 ? nextRawMidi : -1;

      if (nextMidi !== prevMidi) {
        const inputId = `wicki:${side}:${e.pointerId}`;
        if (prevMidi !== -1) onNoteOff(prevMidi, inputId, side);
        if (nextMidi !== -1) {
          activePointersRef.current.set(e.pointerId, nextMidi);
          onNoteOn(nextMidi, 0.85, inputId, side);
        } else {
          activePointersRef.current.set(e.pointerId, -1);
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') isMouseDownRef.current = false;
      const prevMidi = activePointersRef.current.get(e.pointerId);
      if (prevMidi !== undefined) {
        if (prevMidi !== -1) onNoteOff(prevMidi, `wicki:${side}:${e.pointerId}`, side);
        activePointersRef.current.delete(e.pointerId);
      }
    };

    const handleWindowBlur = () => {
      isMouseDownRef.current = false;
      activePointersRef.current.forEach((midi, pointerId) => {
        if (midi !== -1) onNoteOff(midi, `wicki:${side}:${pointerId}`, side);
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
  }, [getMidiFromPoint, onNoteOn, onNoteOff, resetAllKeys, side]);

  return (
    <nav
      aria-label={`${side === 'left' ? 'Left' : 'Right'} Wicki-Hayden keyboard`}
      suppressHydrationWarning
      onPointerDown={handlePointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative bg-transparent select-none touch-none overflow-hidden"
      style={{
        width: 'clamp(260px, 30vw, 440px)',
        aspectRatio: `${WICKI_BOARD_WIDTH_UNITS} / ${WICKI_BOARD_ROWS}`,
      }}
    >
      {keys.map((key) => {
        const soundingMidi = key.midi + midiInputTranspose;
        const isBlack = isBlackMidi(soundingMidi);
        const noteName = getMidiNoteName(soundingMidi);
        return (
          <div
            key={`${key.row}-${key.col}`}
            role="button"
            tabIndex={-1}
            aria-label={`Key ${noteName}`}
            data-wicki-side={side}
            data-wicki-midi={key.midi}
            className="absolute p-[2px] flex items-center justify-center cursor-pointer select-none"
            style={{
              left: `${key.leftPercent}%`,
              width: `${key.widthPercent}%`,
              top: `${key.topPercent}%`,
              height: `${key.heightPercent}%`,
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
                isBlack ? 'bg-transparent border-[4px]' : 'border-[3px]'
              }`}
              style={{
                backgroundColor: isBlack ? undefined : boardColor,
                borderColor: boardColor,
                opacity: fadeJankoMode ? 0 : undefined,
              }}
            />
          </div>
        );
      })}
    </nav>
  );
});

WickiBoard.displayName = 'WickiBoard';
