'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics } from 'pixi.js';
import { midiManager, ParsedMidiNote } from '@/lib/midiEngine';
import {
  getKeyX,
  getKeyWidth,
  isBlackMidi,
  MIN_MIDI,
  MAX_MIDI,
  TRIMMED_MIN_MIDI,
  TRIMMED_MAX_MIDI,
} from '@/lib/pianoGeometry';

const TARGET_FPS = 72;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const FALL_SPEED = 260; // px/s

interface LivePlayedNote {
  id: string;
  midi: number;
  side: 'left' | 'right';
  inputId?: string;
  startTime: number;
  endTime: number | null;
}

interface SynthesiaCanvasProps {
  isPlaying: boolean;
  trimOuterOctaves?: boolean;
  jankoTranspose?: number;
  leftNoteColor?: string;
  rightNoteColor?: string;
}

function parseHexColor(hex: string): number {
  const cleaned = hex.replace('#', '');
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? 0xffffff : parsed;
}

export const SynthesiaCanvas: React.FC<SynthesiaCanvasProps> = ({
  isPlaying,
  trimOuterOctaves = true,
  jankoTranspose = 0,
  leftNoteColor = '#ffffff',
  rightNoteColor = '#ffffff',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const trimOuterOctavesRef = useRef(trimOuterOctaves);
  trimOuterOctavesRef.current = trimOuterOctaves;

  const jankoTransposeRef = useRef(jankoTranspose);
  jankoTransposeRef.current = jankoTranspose;

  const leftColorRef = useRef(parseHexColor(leftNoteColor));
  leftColorRef.current = parseHexColor(leftNoteColor);

  const rightColorRef = useRef(parseHexColor(rightNoteColor));
  rightColorRef.current = parseHexColor(rightNoteColor);

  const activeLiveNotesRef = useRef<LivePlayedNote[]>([]);
  const finishedLiveNotesRef = useRef<LivePlayedNote[]>([]);

  const isLoopRunningRef = useRef(false);
  const isDestroyedRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastRenderFrameTimeRef = useRef<number>(0);

  const renderFrame = useCallback((nowMs?: number): boolean => {
    const app = appRef.current;
    const noteGraphics = graphicsRef.current;
    if (!app || !noteGraphics || isDestroyedRef.current) return false;

    const width = app.screen.width;
    const height = app.screen.height;
    if (width <= 0 || height <= 0) return false;

    const now = nowMs ?? performance.now();

    noteGraphics.clear();

    // 1. Falling MIDI song notes
    const currentSong = midiManager.getCurrentSong();
    const playbackTime = midiManager.getPlaybackTime();
    const transpose = midiManager.getSongTranspose();
    const boardTranspose = jankoTransposeRef.current;
    const trim = trimOuterOctavesRef.current;
    const minMidi = trim ? TRIMMED_MIN_MIDI : MIN_MIDI;
    const maxMidi = trim ? TRIMMED_MAX_MIDI : MAX_MIDI;

    const drawNoteBlock = (boardMidi: number, isBlack: boolean, yTop: number, noteH: number, side: 'left' | 'right') => {
      const keyX = getKeyX(boardMidi, width, trim);
      const cellW = getKeyWidth(boardMidi, width, trim);
      const color = side === 'right' ? rightColorRef.current : leftColorRef.current;
      const inset = 2;
      const strokeW = 2.5;
      const halfStroke = isBlack ? strokeW / 2 : 0;

      const maxBottom = height - halfStroke;
      const clampedBottom = Math.min(maxBottom, yTop + noteH);
      const clampedTop = Math.max(halfStroke, yTop);
      const visibleH = clampedBottom - clampedTop;
      if (visibleH <= 0) return;

      const drawX = keyX + inset + halfStroke;
      const drawW = Math.max(2, cellW - inset * 2 - (isBlack ? strokeW : 0));
      const drawH = Math.max(2, visibleH);
      const drawY = clampedBottom - drawH;
      const radius = Math.min(drawW * 0.32, drawH / 2);

      noteGraphics.roundRect(drawX, drawY, drawW, drawH, radius);
      if (isBlack) {
        noteGraphics.stroke({ color, width: strokeW });
      } else {
        noteGraphics.fill({ color });
      }
    };

    if (currentSong && currentSong.notes.length > 0) {
      for (let i = 0; i < currentSong.notes.length; i++) {
        const note: ParsedMidiNote = currentSong.notes[i];
        const soundingMidi = note.midi + transpose;
        const boardMidi = soundingMidi - boardTranspose;
        if (boardMidi < minMidi || boardMidi > maxMidi) continue;

        const timeUntilHit = note.time - playbackTime;
        const yBottom = height - timeUntilHit * FALL_SPEED;
        const noteHeight = Math.max(8, note.duration * FALL_SPEED);
        const yTop = yBottom - noteHeight;

        if (yBottom >= 0 && yTop <= height) {
          drawNoteBlock(boardMidi, isBlackMidi(soundingMidi), yTop, noteHeight, note.side);
        }
      }
    }

    // 2. Upward-scrolling live played notes
    const nowSec = now / 1000;
    const upwardSpeed = FALL_SPEED * 0.75;
    const maxTrailLifetime = height / upwardSpeed + 1;

    const finishedNotes = finishedLiveNotesRef.current;
    let writeIdx = 0;
    for (let i = 0; i < finishedNotes.length; i++) {
      const n = finishedNotes[i];
      if (nowSec - (n.endTime || 0) < maxTrailLifetime) {
        if (writeIdx !== i) finishedNotes[writeIdx] = n;
        writeIdx++;
      }
    }
    finishedNotes.length = writeIdx;

    const drawLiveNote = (n: LivePlayedNote) => {
      const boardMidi = n.midi - boardTranspose;
      if (boardMidi < minMidi || boardMidi > maxMidi) return;

      const startAgo = nowSec - n.startTime;
      const endAgo = n.endTime !== null ? nowSec - n.endTime : 0;
      const rawHeight = (startAgo - endAgo) * upwardSpeed;
      const noteH = n.endTime !== null ? Math.max(10, rawHeight) : Math.max(2, rawHeight);
      const yBottom = height - endAgo * upwardSpeed;
      const yTop = yBottom - noteH;

      if (yBottom >= 0 && yTop <= height && yBottom - yTop > 0) {
        drawNoteBlock(boardMidi, isBlackMidi(n.midi), yTop, noteH, n.side);
      }
    };

    for (let i = 0; i < activeLiveNotesRef.current.length; i++) {
      drawLiveNote(activeLiveNotesRef.current[i]);
    }
    for (let i = 0; i < finishedNotes.length; i++) {
      drawLiveNote(finishedNotes[i]);
    }

    try {
      if (app.renderer) {
        app.render();
      }
    } catch {
      isLoopRunningRef.current = false;
      return false;
    }

    const hasLiveNotes = activeLiveNotesRef.current.length > 0 || finishedNotes.length > 0;
    const isSongPlaying = isPlayingRef.current || midiManager.getIsPlaying();
    return isSongPlaying || hasLiveNotes;
  }, []);

  const renderLoop = useCallback((rafTimestamp?: number) => {
    if (isDestroyedRef.current || (typeof document !== 'undefined' && document.hidden)) {
      isLoopRunningRef.current = false;
      return;
    }

    const now = rafTimestamp ?? performance.now();
    if (lastRenderFrameTimeRef.current > 0 && now - lastRenderFrameTimeRef.current < FRAME_INTERVAL - 1.0) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    lastRenderFrameTimeRef.current = now;

    if (renderFrame(now)) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    } else {
      isLoopRunningRef.current = false;
      animationFrameIdRef.current = null;
    }
  }, [renderFrame]);

  const wakeLoop = useCallback(() => {
    if (isDestroyedRef.current || (typeof document !== 'undefined' && document.hidden)) return;
    if (!isLoopRunningRef.current) {
      isLoopRunningRef.current = true;
      lastRenderFrameTimeRef.current = 0;
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  const requestStaticRender = useCallback(() => {
    if (isDestroyedRef.current || isLoopRunningRef.current) return;
    renderFrame();
  }, [renderFrame]);

  useEffect(() => {
    let isCancelled = false;
    let createdApp: Application | null = null;
    isDestroyedRef.current = false;

    const initPixi = async () => {
      const container = containerRef.current;
      if (!container) return;

      const app = new Application();
      await app.init({
        resizeTo: container,
        backgroundAlpha: 0,
        backgroundColor: 0x000000,
        clearBeforeRender: true,
        preserveDrawingBuffer: true,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2),
        preference: 'webgl',
        autoStart: false,
      });

      if (isCancelled) {
        try { app.destroy(true, { children: true }); } catch { /* ignore */ }
        return;
      }

      createdApp = app;
      appRef.current = app;

      const canvas = app.canvas;
      canvas.className = 'absolute top-0 left-0 w-full h-full block pointer-events-none';
      container.appendChild(canvas);

      const noteGraphics = new Graphics();
      app.stage.addChild(noteGraphics);
      graphicsRef.current = noteGraphics;

      requestStaticRender();
    };

    void initPixi();

    return () => {
      isCancelled = true;
      isDestroyedRef.current = true;
      isLoopRunningRef.current = false;

      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      if (createdApp) {
        try {
          createdApp.canvas?.parentNode?.removeChild(createdApp.canvas);
          createdApp.destroy(true, { children: true });
        } catch { /* ignore */ }
        appRef.current = null;
        graphicsRef.current = null;
      }
    };
  }, [requestStaticRender]);

  useEffect(() => {
    const unsubOn = midiManager.onNoteOn((midi, _velocity, isLiveInput, inputId, side) => {
      if (!isLiveInput) return;
      const now = performance.now() / 1000;

      if (inputId && activeLiveNotesRef.current.some((n) => n.midi === midi && n.inputId === inputId)) {
        wakeLoop();
        return;
      }

      const resolvedSide: 'left' | 'right' =
        side === 'left' || side === 'right'
          ? side
          : (midi >= 60 ? 'right' : 'left');

      activeLiveNotesRef.current.push({
        id: `${midi}-${now}-${Math.random()}`,
        midi,
        side: resolvedSide,
        inputId,
        startTime: now,
        endTime: null,
      });
      wakeLoop();
    });

    const unsubOff = midiManager.onNoteOff((midi, isLiveInput, inputId) => {
      if (!isLiveInput) return;
      const now = performance.now() / 1000;
      const activeList = activeLiveNotesRef.current;
      const targetIdx = inputId
        ? activeList.findIndex((n) => n.midi === midi && n.inputId === inputId)
        : activeList.findIndex((n) => n.midi === midi);

      if (targetIdx !== -1) {
        const [finished] = activeList.splice(targetIdx, 1);
        finished.endTime = now;
        finishedLiveNotesRef.current.push(finished);
        wakeLoop();
      }
    });

    return () => {
      unsubOn();
      unsubOff();
    };
  }, [wakeLoop]);

  useEffect(() => {
    if (isPlaying) {
      wakeLoop();
    } else {
      requestStaticRender();
    }
  }, [isPlaying, trimOuterOctaves, jankoTranspose, leftNoteColor, rightNoteColor, wakeLoop, requestStaticRender]);

  useEffect(() => {
    const unsubTime = midiManager.onTimeUpdate(() => {
      if (!isPlayingRef.current) {
        requestStaticRender();
      }
    });
    const unsubTranspose = midiManager.onTransposeChange(() => {
      if (!isPlayingRef.current) {
        requestStaticRender();
      }
    });
    return () => {
      unsubTime();
      unsubTranspose();
    };
  }, [requestStaticRender]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (appRef.current && container) {
        appRef.current.renderer.resize(container.clientWidth, container.clientHeight);
        requestStaticRender();
      }
    });
    resizeObserver.observe(container);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (isPlayingRef.current || activeLiveNotesRef.current.length > 0 || finishedLiveNotesRef.current.length > 0) {
          wakeLoop();
        } else {
          requestStaticRender();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLoop, requestStaticRender]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-transparent select-none"
    />
  );
};
