'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Eraser, X } from 'lucide-react';
import { midiManager } from '@/lib/midiEngine';
import { WickiBoardMode, WickiTextMode, ColorMode } from '@/lib/settings';
import {
  KEYBOARD_EVENT_MATRIX,
  KeyboardLayoutType,
  getNotesMatrixForMatrix,
  getRowStaggersForMatrix,
  getKeyDisplayLabel,
  noteNameToMidi,
  midiToNoteName,
  midiToSimplifiedNotation,
  getNoteColorHex,
  MAGENTA_HEX,
  CYAN_HEX,
} from '@/lib/pianoGeometry';

export interface WickiKeyboardGuideProps {
  isWickiActive: boolean;
  currentWickiMode: WickiBoardMode;
  layoutType: KeyboardLayoutType;
  keyboardMatrix?: string[][];
  onKeyboardMatrixChange?: (matrix: string[][]) => void;
  inputTranspose?: number;
  colorMode: ColorMode;
  hideWickiText?: boolean;
  wickiTextMode?: WickiTextMode;
  wickiFadeDuration?: number;
  wickiHighlightOnlyPressed?: boolean;
  isSongActive?: boolean;
  isMobile?: boolean;
  onNoteOn?: (midi: number, velocity?: number, color?: string, inputId?: string) => void;
  onNoteOff?: (midi: number, inputId?: string) => void;
  pianoRetracted?: boolean;
  isTopBarVisible?: boolean;
  hudPosition?: 'top' | 'right';
}

export const WickiKeyboardGuide: React.FC<WickiKeyboardGuideProps> = React.memo(({
  isWickiActive,
  currentWickiMode,
  layoutType,
  keyboardMatrix,
  onKeyboardMatrixChange,
  inputTranspose = 0,
  colorMode,
  hideWickiText = false,
  wickiTextMode,
  wickiFadeDuration = 1.5,
  wickiHighlightOnlyPressed = false,
  isSongActive = false,
  isMobile = false,
  onNoteOn,
  onNoteOff,
  pianoRetracted = false,
  isTopBarVisible = true,
  hudPosition = 'top',
}) => {
  const effectiveTextMode: WickiTextMode = wickiTextMode ?? (hideWickiText ? 'off' : 'keys');
  const isTextHidden = effectiveTextMode === 'off';

  const [rebindingSlot, setRebindingSlot] = useState<{ rIdx: number; cIdx: number } | null>(null);

  const guideKeyElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const activeGuidePointersRef = useRef<Map<number, { midi: number; code: string; color: string; pointerType?: string }>>(new Map());
  const isGuideMouseDownRef = useRef<boolean>(false);
  const lastPointerDownRef = useRef<Map<string, { pointerType: string; button: number; timestamp: number }>>(new Map());
  const lastGlobalTouchTimeRef = useRef<number>(0);

  const wickiModeRef = useRef<WickiBoardMode>(currentWickiMode);
  wickiModeRef.current = currentWickiMode;
  const colorModeRef = useRef<ColorMode>(colorMode);
  colorModeRef.current = colorMode;
  const wickiFadeDurationRef = useRef<number>(wickiFadeDuration);
  wickiFadeDurationRef.current = wickiFadeDuration;
  const wickiHighlightOnlyPressedRef = useRef<boolean>(wickiHighlightOnlyPressed);
  wickiHighlightOnlyPressedRef.current = wickiHighlightOnlyPressed;
  const fadeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined'
      ? (pianoRetracted ? window.innerHeight : window.innerHeight * 0.8) - (hudPosition === 'top' && isTopBarVisible ? 70 : 20)
      : 600,
  });

  useEffect(() => {
    if (!isWickiActive) return;
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0 && cr.height > 0) {
            setContainerSize({
              width: Math.round(cr.width),
              height: Math.round(cr.height),
            });
          }
        }
      });
      ro.observe(el);
    }

    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [isWickiActive, pianoRetracted, isSongActive, isMobile, isTopBarVisible, hudPosition]);

  // Ensure size is updated when piano retraction or top bar visibility transitions
  useEffect(() => {
    if (!isWickiActive) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    };
    const t1 = setTimeout(updateSize, 60);
    const t2 = setTimeout(updateSize, 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isWickiActive, pianoRetracted, isTopBarVisible, hudPosition]);

  const currentMatrix = keyboardMatrix || KEYBOARD_EVENT_MATRIX;
  const currentNotesMatrix = getNotesMatrixForMatrix(currentMatrix);
  const rowOffsets = getRowStaggersForMatrix(currentMatrix);

  const handleClearSlot = useCallback((rIdx: number, cIdx: number) => {
    const current = keyboardMatrix || KEYBOARD_EVENT_MATRIX;
    const newMatrix = current.map((row, r) =>
      row.map((colCode, c) => {
        if (r === rIdx && c === cIdx) {
          return "";
        }
        return colCode;
      })
    );
    onKeyboardMatrixChange?.(newMatrix);
    setRebindingSlot(null);
  }, [keyboardMatrix, onKeyboardMatrixChange]);

  const handleBindSlot = useCallback((rIdx: number, cIdx: number, newCode: string) => {
    const current = keyboardMatrix || KEYBOARD_EVENT_MATRIX;
    const newMatrix = current.map((row, r) =>
      row.map((colCode, c) => {
        if (r === rIdx && c === cIdx) {
          return newCode;
        }
        return colCode;
      })
    );
    onKeyboardMatrixChange?.(newMatrix);
    setRebindingSlot(null);
  }, [keyboardMatrix, onKeyboardMatrixChange]);

  // Listen for physical key to rebind when right-clicked
  useEffect(() => {
    if (!rebindingSlot) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape' || e.code === 'Escape') {
        setRebindingSlot(null);
        return;
      }

      // Clear key to blank if user presses Delete or Backspace
      if (
        e.code === 'Delete' ||
        e.code === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Backspace'
      ) {
        handleClearSlot(rebindingSlot.rIdx, rebindingSlot.cIdx);
        return;
      }

      const newCode = e.code;
      if (!newCode) return;

      handleBindSlot(rebindingSlot.rIdx, rebindingSlot.cIdx, newCode);
    };

    window.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
    };
  }, [rebindingSlot, handleClearSlot, handleBindSlot]);

  useEffect(() => {
    if (!isWickiActive) {
      setRebindingSlot(null);
    }
  }, [isWickiActive]);

  // Reset all button styles cleanly whenever switching Wicki Board display mode
  useEffect(() => {
    // Clear all pending fade-out timers
    fadeTimeoutsRef.current.forEach(t => clearTimeout(t));
    fadeTimeoutsRef.current.clear();

    // Reset all DOM button visual styles cleanly
    guideKeyElementsRef.current.forEach(el => {
      if (!el) return;
      const visualEl = (el.querySelector('[data-visual]') as HTMLElement | null) || el;
      const defaultColor = el.getAttribute('data-note-color') || '#6fcfff';
      const labelEl = el.querySelector('[data-label]') as HTMLElement | null;
      const noteEl = el.querySelector('[data-note]') as HTMLElement | null;

      el.style.transition = '';
      el.style.opacity = '';
      el.style.backgroundColor = '';
      el.style.borderColor = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.removeAttribute('data-active');

      visualEl.style.transition = '';
      visualEl.style.opacity = '';
      visualEl.style.backgroundColor = '';
      visualEl.style.borderColor = '';
      visualEl.style.transform = '';
      visualEl.style.boxShadow = '';

      if (labelEl) {
        labelEl.style.transition = '';
        labelEl.style.opacity = '';
        labelEl.style.color = el.getAttribute('data-label-color') || '';
        labelEl.style.fontWeight = '';
      }
      if (noteEl) {
        noteEl.style.transition = '';
        noteEl.style.opacity = '';
        noteEl.style.color = defaultColor;
        noteEl.style.fontWeight = '';
      }
    });
  }, [currentWickiMode, colorMode, isWickiActive]);

  // Sync real-time note on/off styling in Keyboard Guide with zero re-renders
  useEffect(() => {
    if (!isWickiActive) {
      // Clear held notes from guide if guide closed
      activeGuidePointersRef.current.forEach(({ midi, code }, pointerId) => {
        if (midi !== -1) {
          onNoteOff?.(midi, `guide:${code}:${pointerId}`);
        }
      });
      activeGuidePointersRef.current.clear();
      fadeTimeoutsRef.current.forEach(t => clearTimeout(t));
      fadeTimeoutsRef.current.clear();
      return;
    }

    const currentMatrix = keyboardMatrix || KEYBOARD_EVENT_MATRIX;
    const currentNotesMatrix = getNotesMatrixForMatrix(currentMatrix);
    const midiToCodes = new Map<number, string[]>();
    const midiToKeyInfo = new Map<number, Array<{ keyId: string; rIdx: number; cIdx: number }>>();
    const keyIdToInfo = new Map<string, { rIdx: number; cIdx: number }>();

    currentMatrix.forEach((row, rIdx) => {
      row.forEach((code, cIdx) => {
        const rawNoteName = currentNotesMatrix[rIdx]?.[cIdx];
        if (!rawNoteName) return;
        const baseMidi = noteNameToMidi(rawNoteName);
        const effectiveMidi = baseMidi + (inputTranspose || 0);
        if (!midiToCodes.has(effectiveMidi)) {
          midiToCodes.set(effectiveMidi, []);
        }
        if (!midiToKeyInfo.has(effectiveMidi)) {
          midiToKeyInfo.set(effectiveMidi, []);
        }
        const keyId = code || `slot:${rIdx}-${cIdx}`;
        midiToCodes.get(effectiveMidi)!.push(keyId);
        midiToKeyInfo.get(effectiveMidi)!.push({ keyId, rIdx, cIdx });
        keyIdToInfo.set(keyId, { rIdx, cIdx });
      });
    });

    const activeKeyVoices = new Map<string, number>();
    const activeInputKeys = new Map<string, string[]>();

    const resolveKeysForEvent = (midi: number, inputId?: string): string[] => {
      const is9x18 = currentMatrix[0]?.length === 18;

      if (wickiHighlightOnlyPressedRef.current) {
        let keys: string[] = [];

        if (inputId) {
          if (inputId.startsWith('key:')) {
            const keyCode = inputId.slice(4);
            if (guideKeyElementsRef.current.has(keyCode)) {
              keys = [keyCode];
            }
          } else if (inputId.startsWith('guide:')) {
            const parts = inputId.split(':');
            const code = parts[1] === 'slot' && parts.length > 2 ? `slot:${parts[2]}` : parts[1];
            if (guideKeyElementsRef.current.has(code)) {
              keys = [code];
            }
          } else if (inputId.startsWith('midi:')) {
            const parts = inputId.split(':');
            const channel = parseInt(parts[1], 10);
            if (channel === 0 || channel === 1) {
              const keyInfos = midiToKeyInfo.get(midi);
              if (keyInfos && keyInfos.length > 0) {
                if (is9x18) {
                  // In 9x18 layout:
                  // Channel 1 (0x91 / Magenta / Right Board) = Left 6 columns (cIdx < 6)
                  // Channel 0 (0x90 / Cyan / Left Board) = Right 6 columns (cIdx >= 12)
                  const filtered = keyInfos.filter(k => (channel === 1 ? k.cIdx < 6 : k.cIdx >= 12));
                  if (filtered.length > 0) {
                    keys = filtered.map(k => k.keyId);
                  }
                } else {
                  const matrixCols = currentMatrix[0]?.length || 12;
                  const halfCol = Math.ceil(matrixCols / 2);
                  const filtered = keyInfos.filter(k => (channel === 1 ? k.cIdx < halfCol : k.cIdx >= halfCol));
                  if (filtered.length > 0) {
                    keys = filtered.map(k => k.keyId);
                  }
                }
              }
            }
          }
        }

        if (keys.length === 0) {
          const keyInfos = midiToKeyInfo.get(midi) || [];
          if (is9x18) {
            // Exclude the middle 6 columns (cIdx 6 to 11) in 9x18 layout
            keys = keyInfos.filter(k => k.cIdx < 6 || k.cIdx >= 12).map(k => k.keyId);
          } else {
            keys = keyInfos.map(k => k.keyId);
          }
        }

        // Ensure middle 6 columns in 9x18 layout are never highlighted when highlight mode is on
        if (is9x18) {
          keys = keys.filter(keyId => {
            const info = keyIdToInfo.get(keyId);
            if (!info) return true;
            return info.cIdx < 6 || info.cIdx >= 12;
          });
        }

        return keys;
      }

      return midiToCodes.get(midi) || [];
    };

    const updateKeyVisuals = (code: string, active: boolean, noteColor?: string) => {
      const el = guideKeyElementsRef.current.get(code);
      if (!el) return;

      const visualEl = (el.querySelector('[data-visual]') as HTMLElement | null) || el;
      const labelEl = el.querySelector('[data-label]') as HTMLElement | null;
      const noteEl = el.querySelector('[data-note]') as HTMLElement | null;
      const defaultColor = el.getAttribute('data-note-color') || '#6fcfff';
      const defaultLabelColor = el.getAttribute('data-label-color') || '';
      const mode = wickiModeRef.current;
      const fadeDur = wickiFadeDurationRef.current || 1.5;
      const isOutline = colorModeRef.current === 'outline';

      if (active) {
        if (fadeTimeoutsRef.current.has(code)) {
          clearTimeout(fadeTimeoutsRef.current.get(code));
          fadeTimeoutsRef.current.delete(code);
        }
        const color = isOutline ? '#ffffff' : (noteColor || defaultColor);
        visualEl.style.transition = 'transform 0.05s ease-out, opacity 0.05s ease-out';
        visualEl.style.opacity = '1';
        visualEl.style.backgroundColor = color;
        visualEl.style.borderColor = 'rgba(255, 255, 255, 0.95)';
        visualEl.style.transform = 'scale(0.93) translateY(1px)';
        visualEl.style.boxShadow = isOutline
          ? '0 0 16px rgba(255, 255, 255, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          : `0 0 16px ${color}b3, inset 0 1px 0 rgba(255, 255, 255, 0.6)`;
        el.setAttribute('data-active', 'true');
        if (labelEl) {
          labelEl.style.transition = 'opacity 0.05s ease-out';
          labelEl.style.opacity = '1';
          labelEl.style.color = '#000000';
          labelEl.style.fontWeight = '900';
        }
        if (noteEl) {
          noteEl.style.transition = 'opacity 0.05s ease-out';
          noteEl.style.opacity = '1';
          noteEl.style.color = '#000000';
          noteEl.style.fontWeight = '900';
        }
      } else {
        if (mode === 'fade') {
          visualEl.style.transform = 'scale(1) translateY(0)';
          visualEl.style.transition = `opacity ${fadeDur}s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow ${fadeDur}s cubic-bezier(0.2, 0.8, 0.2, 1), border-color ${fadeDur}s ease-out`;
          visualEl.style.opacity = '0';
          visualEl.style.boxShadow = '0 0 0px transparent';
          visualEl.style.borderColor = 'transparent';
          el.removeAttribute('data-active');

          // Fade text elements together in lockstep with the button visual!
          // We intentionally preserve the active high-contrast text color during fade
          // so the text doesn't jarringly snap or pop against the fading background.
          if (labelEl) {
            labelEl.style.transition = `opacity ${fadeDur}s cubic-bezier(0.2, 0.8, 0.2, 1)`;
            labelEl.style.opacity = '0';
          }
          if (noteEl) {
            noteEl.style.transition = `opacity ${fadeDur}s cubic-bezier(0.2, 0.8, 0.2, 1)`;
            noteEl.style.opacity = '0';
          }

          if (fadeTimeoutsRef.current.has(code)) {
            clearTimeout(fadeTimeoutsRef.current.get(code));
          }
          const timer = setTimeout(() => {
            visualEl.style.transition = 'none';
            visualEl.style.opacity = '';
            visualEl.style.backgroundColor = '';
            visualEl.style.borderColor = '';
            visualEl.style.boxShadow = '';
            if (labelEl) {
              labelEl.style.transition = '';
              labelEl.style.opacity = '';
              labelEl.style.color = defaultLabelColor;
              labelEl.style.fontWeight = '';
            }
            if (noteEl) {
              noteEl.style.transition = '';
              noteEl.style.opacity = '';
              noteEl.style.color = defaultColor;
              noteEl.style.fontWeight = '';
            }
            fadeTimeoutsRef.current.delete(code);
          }, fadeDur * 1000 + 50);
          fadeTimeoutsRef.current.set(code, timer);
        } else {
          visualEl.style.transition = '';
          visualEl.style.opacity = '1';
          visualEl.style.backgroundColor = '';
          visualEl.style.borderColor = '';
          visualEl.style.transform = '';
          visualEl.style.boxShadow = '';
          el.removeAttribute('data-active');
          if (labelEl) {
            labelEl.style.transition = '';
            labelEl.style.opacity = '';
            labelEl.style.color = defaultLabelColor;
            labelEl.style.fontWeight = '';
          }
          if (noteEl) {
            noteEl.style.transition = '';
            noteEl.style.opacity = '';
            noteEl.style.color = defaultColor;
            noteEl.style.fontWeight = '';
          }
        }
      }
    };

    const handleNoteOn = (midi: number, _velocity: number, _isLive: boolean, color?: string, inputId?: string) => {
      const keysToUpdate = resolveKeysForEvent(midi, inputId);
      if (inputId) {
        activeInputKeys.set(inputId, keysToUpdate);
      }
      keysToUpdate.forEach(code => {
        const current = activeKeyVoices.get(code) || 0;
        activeKeyVoices.set(code, current + 1);
        if (current === 0) {
          updateKeyVisuals(code, true, color);
        }
      });
    };

    const handleNoteOff = (midi: number, _isLive: boolean, inputId?: string) => {
      const keysToUpdate = (inputId && activeInputKeys.get(inputId)) || resolveKeysForEvent(midi, inputId);
      if (inputId) {
        activeInputKeys.delete(inputId);
      }
      keysToUpdate.forEach(code => {
        const current = activeKeyVoices.get(code) || 0;
        if (current <= 1) {
          activeKeyVoices.delete(code);
          updateKeyVisuals(code, false);
        } else {
          activeKeyVoices.set(code, current - 1);
        }
      });
    };

    const unsubNoteOn = midiManager.onNoteOn(handleNoteOn);
    const unsubNoteOff = midiManager.onNoteOff(handleNoteOff);

    return () => {
      unsubNoteOn?.();
      unsubNoteOff?.();
      fadeTimeoutsRef.current.forEach(t => clearTimeout(t));
      fadeTimeoutsRef.current.clear();
      activeKeyVoices.clear();
      activeInputKeys.clear();
    };
  }, [isWickiActive, isMobile, inputTranspose, colorMode, onNoteOff, keyboardMatrix, wickiFadeDuration, wickiHighlightOnlyPressed]);

  // Track global touch interactions so any long-press originating from touchscreens is never mistaken for mouse right-click
  useEffect(() => {
    const handleGlobalTouch = () => {
      lastGlobalTouchTimeRef.current = Date.now();
    };
    const handleGlobalPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        lastGlobalTouchTimeRef.current = Date.now();
      }
    };
    window.addEventListener('touchstart', handleGlobalTouch, { passive: true, capture: true });
    window.addEventListener('pointerdown', handleGlobalPointerDown, { passive: true, capture: true });
    return () => {
      window.removeEventListener('touchstart', handleGlobalTouch, { capture: true });
      window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
    };
  }, []);

  const handleKeyPointerDown = React.useCallback((
    midi: number,
    color: string,
    code: string,
    e: React.PointerEvent
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType === 'mouse') {
      isGuideMouseDownRef.current = true;
    }
    const prev = activeGuidePointersRef.current.get(e.pointerId);
    if (prev && prev.midi !== -1) {
      onNoteOff?.(prev.midi, `guide:${prev.code}:${e.pointerId}`);
    }

    activeGuidePointersRef.current.set(e.pointerId, { midi, code, color, pointerType: e.pointerType });
    onNoteOn?.(midi, 0.85, color, `guide:${code}:${e.pointerId}`);
  }, [onNoteOn, onNoteOff]);

  // Global window pointer listeners & blur cleanup for guide keyboard
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const active = activeGuidePointersRef.current.get(e.pointerId);
      if (!active) {
        if (e.pointerType === 'mouse' && (e.buttons & 1) === 1 && isGuideMouseDownRef.current) {
          // Allow mouse drag
        } else {
          return;
        }
      }

      const target = document.elementFromPoint(e.clientX, e.clientY);
      const keyButton = target?.closest('button[data-guide-code]') as HTMLElement | null;
      if (keyButton) {
        const code = keyButton.getAttribute('data-guide-code');
        const midiStr = keyButton.getAttribute('data-guide-midi');
        const color = keyButton.getAttribute('data-note-color') || '#6fcfff';
        if (code && midiStr) {
          const midi = parseInt(midiStr, 10);
          if (!active || active.code !== code || active.midi !== midi) {
            if (active && active.midi !== -1) {
              onNoteOff?.(active.midi, `guide:${active.code}:${e.pointerId}`);
            }
            activeGuidePointersRef.current.set(e.pointerId, { midi, code, color });
            onNoteOn?.(midi, 0.85, color, `guide:${code}:${e.pointerId}`);
          }
        }
      } else {
        // If pointer is over the gap or edge between keys, check if still within grace perimeter of active key
        if (active && active.code && active.midi !== -1) {
          const activeEl = guideKeyElementsRef.current.get(active.code);
          if (activeEl) {
            const rect = activeEl.getBoundingClientRect();
            // 4px grace margin ensures edge presses never drop or flutter
            if (
              e.clientX >= rect.left - 4 &&
              e.clientX <= rect.right + 4 &&
              e.clientY >= rect.top - 4 &&
              e.clientY <= rect.bottom + 4
            ) {
              return;
            }
          }
          onNoteOff?.(active.midi, `guide:${active.code}:${e.pointerId}`);
          activeGuidePointersRef.current.set(e.pointerId, { midi: -1, code: '', color: '' });
        }
      }
    };

    const handleGlobalRelease = (e?: PointerEvent) => {
      if (e) {
        if (e.pointerType === 'mouse') {
          isGuideMouseDownRef.current = false;
        }
        const active = activeGuidePointersRef.current.get(e.pointerId);
        if (active) {
          if (active.midi !== -1) {
            onNoteOff?.(active.midi, `guide:${active.code}:${e.pointerId}`);
          }
          activeGuidePointersRef.current.delete(e.pointerId);
        }
      } else {
        isGuideMouseDownRef.current = false;
        activeGuidePointersRef.current.forEach(({ midi, code }, pointerId) => {
          if (midi !== -1) {
            onNoteOff?.(midi, `guide:${code}:${pointerId}`);
          }
        });
        activeGuidePointersRef.current.clear();
      }
    };

    const handleBlur = () => handleGlobalRelease();

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalRelease);
    window.addEventListener('pointercancel', handleGlobalRelease);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onNoteOn, onNoteOff]);

  if (!isWickiActive) return null;

  const rowCount = currentMatrix.length || 6;
  const colCount = currentMatrix[0]?.length || 12;

  const isSmallScreen = containerSize.width < 640;
  const paddingX = isSmallScreen ? 8 : 16;
  const paddingY = isSmallScreen ? 8 : 12;
  const availW = Math.max(100, containerSize.width - paddingX);
  const availH = Math.max(100, containerSize.height - paddingY);

  const bannerHeight = rebindingSlot ? 44 : 0;
  const gapPx = layoutType === '9x18' || layoutType === '8x12'
    ? (isSmallScreen ? 1.5 : 2.5)
    : (isSmallScreen ? 2 : 3);

  const verticalGaps = (rowCount - 1) * gapPx;
  const availHForRows = Math.max(60, availH - bannerHeight - verticalGaps);
  const maxBtnH = availHForRows / rowCount;

  const horizontalGaps = (colCount * 2) * gapPx;
  const availWForCols = Math.max(60, availW - horizontalGaps);
  const maxBtnW = (availWForCols / (colCount * 2 + 1)) * 2 + gapPx;

  const buttonCap = layoutType === '6x4' ? 88 : layoutType === '6x12' ? 78 : 70;
  const buttonSize = Math.max(14, Math.min(maxBtnH, maxBtnW, buttonCap));

  const colWidth = Math.max(4, (buttonSize - gapPx) / 2);
  const totalGridCols = colCount * 2 + 1;
  const totalGridWidth = Math.floor(totalGridCols * colWidth + (colCount * 2) * gapPx);

  const labelFontSize = Math.max(7, Math.min(16, Math.round(buttonSize * 0.26)));
  const noteFontSize = Math.max(6, Math.min(12, Math.round(buttonSize * 0.20)));
  const simplifiedFontSize = Math.max(9, Math.min(20, Math.round(buttonSize * 0.32)));
  const mappingFontSize = Math.max(9, Math.min(20, Math.round(buttonSize * 0.32)));
  const keysFontSize = Math.max(8, Math.min(18, Math.round(buttonSize * 0.28)));

  return (
    <div
      ref={containerRef}
      className={`fixed left-0 ${
        hudPosition === 'right'
          ? isTopBarVisible
            ? 'right-[56px] sm:right-[60px] top-2 sm:top-3'
            : 'right-2 sm:right-3 top-2 sm:top-3'
          : isTopBarVisible
            ? isSongActive && isMobile
              ? 'right-0 top-[96px]'
              : 'right-0 top-[58px]'
            : 'right-0 top-2 sm:top-3'
      } ${
        pianoRetracted ? 'bottom-2 sm:bottom-3' : 'bottom-[calc(20%+4px)]'
      } z-20 pointer-events-none flex flex-col items-center justify-center px-1 sm:px-2 py-1 sm:py-2 transition-all duration-300 ease-out`}
    >
      <div
        style={{
          width: `${totalGridWidth}px`,
          maxWidth: '100%',
        }}
        className="relative pointer-events-auto select-none flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-150 transition-all duration-300 ease-out"
      >
        {/* Rebinding Helper Banner */}
        {rebindingSlot && (
          <div
            style={{ width: `${totalGridWidth}px`, maxWidth: '100%' }}
            className="mb-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-zinc-900/95 border border-amber-500/40 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_12px_rgba(245,158,11,0.2)] flex items-center justify-between gap-2 text-xs z-30 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div className="flex items-center gap-1 text-zinc-200 font-medium truncate text-[11px] sm:text-xs">
                <span>Rebinding note</span>
                <span className="font-bold text-amber-300">
                  {(() => {
                    const rMidi = noteNameToMidi(currentNotesMatrix[rebindingSlot.rIdx]?.[rebindingSlot.cIdx] || 'C4') + (inputTranspose || 0);
                    const rName = midiToNoteName(rMidi);
                    return effectiveTextMode === 'simplified' ? `${rName} [${midiToSimplifiedNotation(rMidi).text}]` : rName;
                  })()}
                </span>
                {currentMatrix[rebindingSlot.rIdx]?.[rebindingSlot.cIdx] ? (
                  <span className="text-zinc-400 font-mono text-[10px] sm:text-[11px] ml-1">
                    (Current: <span className="text-zinc-200 font-semibold">{getKeyDisplayLabel(currentMatrix[rebindingSlot.rIdx][rebindingSlot.cIdx])}</span>)
                  </span>
                ) : (
                  <span className="text-zinc-500 italic text-[10px] sm:text-[11px] ml-1">(Currently Blank)</span>
                )}
                <span className="hidden sm:inline text-zinc-500 text-[10px] sm:text-[11px] ml-1.5">• Press any physical key to bind</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleClearSlot(rebindingSlot.rIdx, rebindingSlot.cIdx)}
                className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/35 hover:border-red-500/50 text-[10px] sm:text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                title="Clear key to blank (or press Delete / Backspace on physical keyboard)"
              >
                <Eraser className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Clear (Blank)</span>
                <kbd className="hidden md:inline font-mono text-[9px] bg-red-500/30 px-1 py-0.2 rounded text-red-200 ml-0.5">Del</kbd>
              </button>
              <button
                type="button"
                onClick={() => setRebindingSlot(null)}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-[10px] sm:text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Cancel rebinding (or press Esc)"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Cancel</span>
                <kbd className="hidden md:inline font-mono text-[9px] bg-white/10 px-1 py-0.2 rounded text-zinc-400 ml-0.5">Esc</kbd>
              </button>
            </div>
          </div>
        )}

        {/* Main Keyboard Grid Area */}
        <div className="w-full flex flex-col justify-center min-w-0 touch-none">
          <div
            className="flex flex-col w-full"
            style={{ gap: `${gapPx}px` }}
          >
            {currentMatrix.map((row, rIdx) => {
              const colStart = rowOffsets[rIdx] === 0.5 ? 2 : 1;
              const halfCol = Math.ceil(row.length / 2);

              return (
                <div
                  key={rIdx}
                  className="grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${totalGridCols}, minmax(0, 1fr))`,
                    gap: `${gapPx}px`,
                    height: `${buttonSize}px`,
                  }}
                >
                  {row.map((code, cIdx) => {
                    const rawNoteName = currentNotesMatrix[rIdx]?.[cIdx] || 'C4';
                    const baseMidi = noteNameToMidi(rawNoteName);
                    const effectiveMidi = baseMidi + (inputTranspose || 0);
                    const noteName = midiToNoteName(effectiveMidi);
                    const simplified = midiToSimplifiedNotation(effectiveMidi);
                    const keyId = code || `slot:${rIdx}-${cIdx}`;
                    const label = code ? getKeyDisplayLabel(code) : '—';
                    const isBlackKey = noteName.includes('#');
                    const isRebinding = rebindingSlot?.rIdx === rIdx && rebindingSlot?.cIdx === cIdx;
                    const isUnbound = !code;
                    const outlineTextColor = isBlackKey ? '#ffffff' : '#9ca3af';
                    const noteColor =
                      colorMode === 'outline'
                        ? outlineTextColor
                        : colorMode === 'track'
                          ? cIdx < halfCol
                            ? MAGENTA_HEX
                            : CYAN_HEX
                          : getNoteColorHex(effectiveMidi, 0, colorMode);

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        ref={el => {
                          if (el) guideKeyElementsRef.current.set(keyId, el);
                          else guideKeyElementsRef.current.delete(keyId);
                        }}
                        type="button"
                        tabIndex={-1}
                        data-guide-code={keyId}
                        data-guide-midi={effectiveMidi}
                        data-black={isBlackKey ? 'true' : 'false'}
                        data-note-color={noteColor}
                        data-label-color={colorMode === 'outline' ? outlineTextColor : ''}
                        title={
                          isMobile
                            ? `${label} (${code || 'Blank'}) → ${noteName} [${simplified.text}] (MIDI ${effectiveMidi})`
                            : isRebinding
                              ? `Rebinding ${noteName} [${simplified.text}] • Press any key to bind • Press [Del] / [Backspace] or click 'Clear (Blank)' to make blank • Press [Esc] to cancel`
                              : isUnbound
                                ? `(Blank) → ${noteName} [${simplified.text}] (MIDI ${effectiveMidi}) • Right-click to assign physical key • Click to play`
                                : `${label} (${code}) → ${noteName} [${simplified.text}] (MIDI ${effectiveMidi}) • Right-click to rebind or clear to blank • Click to play`
                        }
                        onContextMenu={e => {
                          e.preventDefault();
                          e.stopPropagation();

                          // 1. Never rebind if explicitly in mobile mode
                          if (isMobile) return;

                          // 2. Detect touch or pen long-press across all touchscreens (tablets, mobile landscape, touch laptops, touch monitors)
                          const lastPress = lastPointerDownRef.current.get(keyId);
                          const nativeEvt = e.nativeEvent as any;
                          const isTouchPointer =
                            lastPress?.pointerType === 'touch' ||
                            lastPress?.pointerType === 'pen' ||
                            nativeEvt?.pointerType === 'touch' ||
                            nativeEvt?.pointerType === 'pen' ||
                            Boolean(nativeEvt?.sourceCapabilities?.firesTouchEvents);

                          const isRecentTouch = Date.now() - lastGlobalTouchTimeRef.current < 2000;
                          const hasActiveTouchPointer = Array.from(activeGuidePointersRef.current.values()).some(
                            p => p.code === keyId && (p.pointerType === 'touch' || p.pointerType === 'pen')
                          );

                          // Completely disable rebinding on any touchscreen long-press or touch/pen interaction
                          if (isTouchPointer || hasActiveTouchPointer || (isRecentTouch && lastPress?.pointerType !== 'mouse')) {
                            return;
                          }

                          // 3. Rebinding is strictly a mouse right-click action (button 2 or macOS ctrlKey)
                          if (lastPress && lastPress.pointerType === 'mouse' && lastPress.button !== 2 && !e.ctrlKey) {
                            return;
                          }

                          setRebindingSlot(prev => (prev?.rIdx === rIdx && prev?.cIdx === cIdx ? null : { rIdx, cIdx }));
                        }}
                        onPointerDown={e => {
                          lastPointerDownRef.current.set(keyId, {
                            pointerType: e.pointerType,
                            button: e.button,
                            timestamp: Date.now(),
                          });
                          if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                            lastGlobalTouchTimeRef.current = Date.now();
                          }

                          if (e.button === 2) return;
                          if (isRebinding) {
                            setRebindingSlot(null);
                            return;
                          }
                          handleKeyPointerDown(effectiveMidi, noteColor, keyId, e);
                        }}
                        style={{
                          gridColumn: cIdx === 0 ? `${colStart} / span 2` : 'span 2',
                          height: `${buttonSize}px`,
                          WebkitTouchCallout: 'none',
                        }}
                        className="group relative flex items-center justify-center w-full h-full select-none touch-none cursor-pointer p-0 bg-transparent border-0 outline-none [-webkit-touch-callout:none]"
                      >
                        <div
                          data-visual="true"
                          className={`w-full h-full flex flex-col items-center justify-center rounded-[20%] border text-center transition-colors duration-75 select-none touch-none ${
                            buttonSize < 34 ? 'p-0' : buttonSize < 48 ? 'p-[1px]' : 'p-0.5'
                          } pointer-events-none ${
                            isRebinding
                              ? 'ring-2 ring-amber-400 bg-amber-500/30 border-amber-400 text-amber-200 scale-105 z-10 animate-pulse shadow-[0_0_16px_rgba(251,191,36,0.6)]'
                              : currentWickiMode === 'fade'
                                ? 'opacity-0 bg-transparent border-transparent text-zinc-100 shadow-none'
                                : isBlackKey
                                  ? 'bg-zinc-900/90 group-hover:bg-zinc-800/90 border-white/[0.16] group-hover:border-white/30 text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.5)]'
                                  : 'bg-zinc-700/65 group-hover:bg-zinc-600/80 border-zinc-500/60 group-hover:border-zinc-400/85 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(0,0,0,0.4)]'
                          }`}
                        >
                          {/* Keyboard mapping key label: shown in 'mapping' mode, or while rebinding */}
                          {(effectiveTextMode === 'mapping' || isRebinding) && (
                            <span
                              data-label="true"
                              className={`font-mono font-bold leading-none pointer-events-none transition-colors ${
                                isTextHidden && !isRebinding ? 'invisible' : ''
                              } ${
                                isRebinding
                                  ? 'text-amber-300'
                                  : colorMode === 'outline'
                                    ? isBlackKey
                                      ? isUnbound
                                        ? 'text-zinc-400 font-medium'
                                        : 'text-white'
                                      : isUnbound
                                        ? 'text-zinc-500 font-medium'
                                        : 'text-zinc-400'
                                    : isBlackKey
                                      ? isUnbound
                                        ? 'text-zinc-500 font-medium'
                                        : 'text-zinc-300 group-hover:text-zinc-100'
                                      : isUnbound
                                        ? 'text-zinc-500 font-medium'
                                        : 'text-zinc-100 group-hover:text-white'
                              }`}
                              style={{
                                fontSize: `${effectiveTextMode === 'mapping' && !isRebinding ? mappingFontSize : labelFontSize}px`,
                                ...(colorMode === 'outline' && !isRebinding
                                  ? { color: outlineTextColor }
                                  : {}),
                              }}
                            >
                              {isRebinding ? '...' : label}
                            </span>
                          )}
                          {effectiveTextMode === 'simplified' ? (
                            <span
                              data-note="true"
                              className={`inline-flex flex-col items-center justify-center font-mono font-bold pointer-events-none transition-colors leading-none select-none ${
                                isTextHidden && !isRebinding ? 'invisible' : ''
                              }`}
                              style={{
                                color: isRebinding ? '#fcd34d' : noteColor,
                                marginTop: isRebinding
                                  ? simplified.dotsAbove > 0 ? '1px' : `${Math.max(1, Math.round(buttonSize * 0.04))}px`
                                  : '0px',
                              }}
                            >
                              {simplified.dotsAbove > 0 && (
                                <span
                                  className="flex flex-col items-center gap-[1px] mb-[1.5px] leading-none"
                                  aria-hidden="true"
                                >
                                  {Array.from({ length: simplified.dotsAbove }).map((_, i) => (
                                    <span
                                      key={i}
                                      className="rounded-full bg-current inline-block"
                                      style={{
                                        width: `${Math.max(1.8, Math.min(3.5, Math.round(simplifiedFontSize * 0.22)))}px`,
                                        height: `${Math.max(1.8, Math.min(3.5, Math.round(simplifiedFontSize * 0.22)))}px`,
                                      }}
                                    />
                                  ))}
                                </span>
                              )}
                              <span
                                className="inline-flex items-center justify-center leading-none"
                                style={{ fontSize: `${simplifiedFontSize}px` }}
                              >
                                {simplified.accidental && (
                                  <span
                                    className="font-sans leading-none font-semibold"
                                    style={{
                                      fontSize: `${Math.max(6, Math.round(simplifiedFontSize * 0.72))}px`,
                                      marginRight: '0.5px',
                                      transform: 'translateY(-0.5px)',
                                    }}
                                  >
                                    {simplified.accidental}
                                  </span>
                                )}
                                <span>{simplified.number}</span>
                              </span>
                              {simplified.dotsBelow > 0 && (
                                <span
                                  className="flex flex-col items-center gap-[1px] mt-[1.5px] leading-none"
                                  aria-hidden="true"
                                >
                                  {Array.from({ length: simplified.dotsBelow }).map((_, i) => (
                                    <span
                                      key={i}
                                      className="rounded-full bg-current inline-block"
                                      style={{
                                        width: `${Math.max(1.8, Math.min(3.5, Math.round(simplifiedFontSize * 0.22)))}px`,
                                        height: `${Math.max(1.8, Math.min(3.5, Math.round(simplifiedFontSize * 0.22)))}px`,
                                      }}
                                    />
                                  ))}
                                </span>
                              )}
                            </span>
                          ) : (effectiveTextMode === 'keys' || effectiveTextMode === 'notes' || isRebinding) ? (
                            <span
                              data-note="true"
                              className={`font-mono font-bold pointer-events-none transition-colors leading-none select-none ${
                                isTextHidden && !isRebinding ? 'invisible' : ''
                              }`}
                              style={{
                                color: isRebinding ? '#fcd34d' : noteColor,
                                fontSize: `${isRebinding ? noteFontSize : keysFontSize}px`,
                                marginTop: isRebinding ? `${Math.max(1, Math.round(buttonSize * 0.04))}px` : '0px',
                              }}
                            >
                              {noteName}
                            </span>
                          ) : null}

                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

WickiKeyboardGuide.displayName = 'WickiKeyboardGuide';
