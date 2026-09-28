'use client';

import React, { memo, useCallback, useRef, useEffect } from 'react';
import {
  WHITE_KEYS,
  BLACK_KEYS,
  MIDDLE_WHITE_KEYS,
  MIDDLE_BLACK_KEYS,
  PIANO_KEYS_BY_MIDI,
  getKeyLayoutPercent,
  getNoteColorHex,
  mixColors,
} from '@/lib/pianoGeometry';
import { midiManager } from '@/lib/midiEngine';
import { ColorMode } from '@/lib/settings';

interface PianoKeyboardProps {
  colorMode?: ColorMode;
  isMobilePortrait?: boolean;
  onNoteOn: (midi: number, velocity?: number, color?: string, inputId?: string) => void;
  onNoteOff: (midi: number, inputId?: string) => void;
  activeMidiNotes?: Set<number>;
  activeColors?: Map<number, string>;
  isRetracted?: boolean;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = memo(({
  colorMode = 'track',
  isMobilePortrait = false,
  onNoteOn,
  onNoteOff,
  isRetracted = false,
}) => {
  const keyElementsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const activeInputsPerMidiRef = useRef<Map<number, Map<string, string>>>(new Map());
  const activePointersRef = useRef<Map<number, number>>(new Map());
  const isMouseDownRef = useRef(false);
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;

  const resetAllKeys = useCallback(() => {
    activeInputsPerMidiRef.current.clear();
    keyElementsRef.current.forEach((el, midi) => {
      const keyData = PIANO_KEYS_BY_MIDI[midi];
      if (keyData && el) {
        el.style.backgroundColor = keyData.isBlack ? '#111115' : '#c8c8cf';
        el.removeAttribute('data-active');
      }
    });
  }, []);

  // Direct Single-Key DOM Updates from MIDI Engine (Zero React Re-renders)
  useEffect(() => {
    const handleNoteOn = (
      midi: number,
      _velocity: number,
      isLiveInput: boolean,
      color?: string,
      inputId?: string
    ) => {
      const keyEl = keyElementsRef.current.get(midi);
      if (!keyEl) return;

      const resolvedColor = color || getNoteColorHex(midi, 0, colorModeRef.current);
      const keyId = inputId || (isLiveInput ? `live-anon-${Date.now()}-${Math.random()}` : `song-anon-${Date.now()}-${Math.random()}`);

      let inputsMap = activeInputsPerMidiRef.current.get(midi);
      if (!inputsMap) {
        inputsMap = new Map();
        activeInputsPerMidiRef.current.set(midi, inputsMap);
      }
      inputsMap.set(keyId, resolvedColor);

      const colors = Array.from(inputsMap.values());
      const mixedColor = colors.length === 1 ? colors[0] : mixColors(colors);
      keyEl.style.backgroundColor = mixedColor;
      keyEl.setAttribute('data-active', 'true');
    };

    const handleNoteOff = (midi: number, isLiveInput: boolean, inputId?: string) => {
      const keyEl = keyElementsRef.current.get(midi);
      if (!keyEl) return;
      const keyData = PIANO_KEYS_BY_MIDI[midi];
      if (!keyData) return;

      const inputsMap = activeInputsPerMidiRef.current.get(midi);
      if (inputsMap) {
        if (inputId) {
          if (inputsMap.has(inputId)) {
            inputsMap.delete(inputId);
          } else {
            return;
          }
        } else {
          // If no specific inputId provided, look for an entry matching the event type (song vs live)
          let targetKey: string | undefined;
          if (!isLiveInput) {
            for (const k of inputsMap.keys()) {
              if (k.startsWith('song')) {
                targetKey = k;
                break;
              }
            }
          } else {
            for (const k of inputsMap.keys()) {
              if (!k.startsWith('song')) {
                targetKey = k;
                break;
              }
            }
          }
          if (!targetKey) {
            targetKey = inputsMap.keys().next().value;
          }
          if (targetKey !== undefined) {
            inputsMap.delete(targetKey);
          }
        }

        if (inputsMap.size === 0) {
          activeInputsPerMidiRef.current.delete(midi);
        }
      }

      const remaining = activeInputsPerMidiRef.current.get(midi);
      if (remaining && remaining.size > 0) {
        const colors = Array.from(remaining.values());
        keyEl.style.backgroundColor = colors.length === 1 ? colors[0] : mixColors(colors);
      } else {
        keyEl.style.backgroundColor = keyData.isBlack ? '#111115' : '#c8c8cf';
        keyEl.removeAttribute('data-active');
      }
    };

    const unsubNoteOn = midiManager.onNoteOn(handleNoteOn);
    const unsubNoteOff = midiManager.onNoteOff(handleNoteOff);

    return () => {
      unsubNoteOn?.();
      unsubNoteOff?.();
    };
  }, []);

  // Update active key colors when colorMode changes
  useEffect(() => {
    colorModeRef.current = colorMode;
    activeInputsPerMidiRef.current.forEach((inputsMap, midi) => {
      const keyEl = keyElementsRef.current.get(midi);
      if (keyEl && inputsMap.size > 0) {
        inputsMap.forEach((_, keyId) => {
          if (keyId.startsWith('pointer:') || keyId.startsWith('touch:')) {
            inputsMap.set(keyId, colorMode === 'outline' ? '#ffffff' : getNoteColorHex(midi, 0, 'gradient'));
          } else {
            inputsMap.set(keyId, getNoteColorHex(midi, 0, colorMode));
          }
        });
        const colors = Array.from(inputsMap.values());
        keyEl.style.backgroundColor = colors.length === 1 ? colors[0] : mixColors(colors);
      }
    });
  }, [colorMode]);

  // Helper to extract MIDI note from DOM coordinates
  const getMidiFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const keyEl = el?.closest('[data-midi]');
    if (!keyEl) return null;
    const midiAttr = keyEl.getAttribute('data-midi');
    return midiAttr ? parseInt(midiAttr, 10) : null;
  }, []);

  // Pointer / Mouse interaction handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    if (e.pointerType === 'mouse') {
      isMouseDownRef.current = true;
    }

    const midi = getMidiFromPoint(e.clientX, e.clientY);
    if (midi !== null) {
      activePointersRef.current.set(e.pointerId, midi);
      const color = colorModeRef.current === 'outline' ? '#ffffff' : getNoteColorHex(midi, 0, 'gradient');
      const inputId = `pointer:${e.pointerId}`;
      onNoteOn(midi, 0.85, color, inputId);
    } else {
      activePointersRef.current.set(e.pointerId, -1);
    }
  }, [getMidiFromPoint, onNoteOn]);

  // Window pointer listeners for movement, release, blur, and tab switching
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const hasPointer = activePointersRef.current.has(e.pointerId);
      if (!hasPointer) {
        if (e.pointerType === 'mouse' && (e.buttons & 1) === 1 && isMouseDownRef.current) {
          // Allow mouse drag into keys
        } else {
          return;
        }
      }

      const previousMidi = activePointersRef.current.get(e.pointerId);
      const newMidi = getMidiFromPoint(e.clientX, e.clientY);
      const effectiveNewMidi = newMidi ?? -1;

      if (effectiveNewMidi !== (previousMidi ?? -1)) {
        const inputId = `pointer:${e.pointerId}`;
        if (previousMidi !== undefined && previousMidi !== -1) {
          onNoteOff(previousMidi, inputId);
        }
        if (effectiveNewMidi !== -1) {
          activePointersRef.current.set(e.pointerId, effectiveNewMidi);
          const color = colorModeRef.current === 'outline' ? '#ffffff' : getNoteColorHex(effectiveNewMidi, 0, 'gradient');
          onNoteOn(effectiveNewMidi, 0.85, color, inputId);
        } else {
          activePointersRef.current.set(e.pointerId, -1);
        }
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        isMouseDownRef.current = false;
      }
      const previousMidi = activePointersRef.current.get(e.pointerId);
      if (previousMidi !== undefined) {
        if (previousMidi !== -1) {
          onNoteOff(previousMidi, `pointer:${e.pointerId}`);
        }
        activePointersRef.current.delete(e.pointerId);
      }
    };

    const handleWindowBlur = () => {
      isMouseDownRef.current = false;
      activePointersRef.current.forEach((midi, pointerId) => {
        if (midi !== -1) {
          onNoteOff(midi, `pointer:${pointerId}`);
        }
      });
      activePointersRef.current.clear();
      resetAllKeys();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        handleWindowBlur();
      }
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

  return (
    <nav
      aria-label="Piano keyboard"
      suppressHydrationWarning
      onPointerDown={handlePointerDown}
      onContextMenu={e => e.preventDefault()}
      className={`relative w-full bg-[#08080b] select-none touch-none overflow-hidden z-30 shrink-0 transition-all duration-300 ease-in-out ${
        isRetracted ? 'h-0 opacity-0 pointer-events-none' : 'h-[20%] opacity-100'
      }`}
    >
      {/* White Keys */}
      {(isMobilePortrait ? MIDDLE_WHITE_KEYS : WHITE_KEYS).map(key => {
        const { leftPercent, widthPercent } = getKeyLayoutPercent(key.midi, isMobilePortrait);
        return (
          <div
            key={key.midi}
            ref={el => {
              if (el) keyElementsRef.current.set(key.midi, el);
              else keyElementsRef.current.delete(key.midi);
            }}
            role="button"
            tabIndex={-1}
            aria-label={`Key ${key.name}`}
            data-midi={key.midi}
            className="absolute top-0 h-full select-none cursor-pointer border-r border-[#1c1c21] rounded-t-[3px] rounded-b-[4px] transition-colors duration-75 flex flex-col justify-end items-center pb-1.5"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              backgroundColor: '#c8c8cf',
              zIndex: 1,
            }}
          />
        );
      })}

      {/* Black Keys */}
      {(isMobilePortrait ? MIDDLE_BLACK_KEYS : BLACK_KEYS).map(key => {
        const { leftPercent, widthPercent } = getKeyLayoutPercent(key.midi, isMobilePortrait);
        return (
          <div
            key={key.midi}
            ref={el => {
              if (el) keyElementsRef.current.set(key.midi, el);
              else keyElementsRef.current.delete(key.midi);
            }}
            role="button"
            tabIndex={-1}
            aria-label={`Key ${key.name}`}
            data-midi={key.midi}
            className="absolute top-0 h-[64%] select-none cursor-pointer rounded-b-[5px] transition-colors duration-75 border-b border-l border-r border-[#09090b]"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              backgroundColor: '#111115',
              zIndex: 10,
            }}
          />
        );
      })}
    </nav>
  );
});

PianoKeyboard.displayName = 'PianoKeyboard';
