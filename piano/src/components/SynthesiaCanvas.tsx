'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics } from 'pixi.js';
import { midiManager } from '@/lib/midiEngine';
import { ColorMode } from '@/lib/settings';
import {
  getKeyX,
  getKeyWidth,
  getNoteColorHex,
  getNoteColorInt,
  mixColorsInt,
  mixColors3Int,
  parseColorToInt,
  MIN_MIDI,
  MAX_MIDI,
  MIDDLE_OCTAVES_MIN_MIDI,
  MIDDLE_OCTAVES_MAX_MIDI,
} from '@/lib/pianoGeometry';

interface LivePlayedNote {
  id: string;
  midi: number;
  inputId?: string;
  startTime: number;
  endTime: number | null; // null while still held
  color: string;
  colorInt: number;
}

interface RenderNoteBlock {
  id?: string;
  midi: number;
  drawX: number;
  drawY: number;
  drawW: number;
  drawH: number;
  radius: number;
  colorInt: number;
}

const TOTAL_MIDI_LANES = MAX_MIDI - MIN_MIDI + 1; // 84

// Preallocated bucket index array to avoid heap allocations
const laneBuckets: number[][] = Array.from({ length: TOTAL_MIDI_LANES }, () => []);

// Renders all visible note blocks in PixiJS v8 using O(N) Spatial Lane Bucketing & Fast Bitwise Color Mixing
function renderAllNoteBlocksPixi(
  graphics: Graphics,
  notes: RenderNoteBlock[],
  isOutlineOnly: boolean = false
) {
  const count = notes.length;
  if (count === 0) return;

  if (isOutlineOnly) {
    for (let i = 0; i < count; i++) {
      const n = notes[i];
      graphics
        .roundRect(n.drawX, n.drawY, n.drawW, n.drawH, n.radius)
        .stroke({ color: 0xffffff, width: 1 });
    }
    return;
  }

  if (count === 1) {
    const n = notes[0];
    graphics
      .roundRect(n.drawX, n.drawY, n.drawW, n.drawH, n.radius)
      .fill(n.colorInt)
      .stroke({ color: 0xffffff, width: 1 });
    return;
  }

  // Clear spatial lane buckets
  for (let b = 0; b < TOTAL_MIDI_LANES; b++) {
    laneBuckets[b].length = 0;
  }

  // 1. Draw base fill for every note and bucket by MIDI lane
  for (let i = 0; i < count; i++) {
    const n = notes[i];
    graphics
      .roundRect(n.drawX, n.drawY, n.drawW, n.drawH, n.radius)
      .fill(n.colorInt);

    const lane = n.midi - MIN_MIDI;
    if (lane >= 0 && lane < TOTAL_MIDI_LANES) {
      laneBuckets[lane].push(i);
    }
  }

  // 2. Spatial Lane Overlap Checks: Check overlaps within same lane and adjacent lanes (O(N) total)
  for (let b = 0; b < TOTAL_MIDI_LANES; b++) {
    const bucket = laneBuckets[b];
    const bLen = bucket.length;
    if (bLen === 0) continue;

    // A. Intersections within the same MIDI lane (e.g. live note overlapping falling song note)
    for (let i = 0; i < bLen; i++) {
      const idxA = bucket[i];
      const nA = notes[idxA];
      const rightA = nA.drawX + nA.drawW;
      const bottomA = nA.drawY + nA.drawH;

      for (let j = i + 1; j < bLen; j++) {
        const idxB = bucket[j];
        const nB = notes[idxB];

        const overlapLeft = Math.max(nA.drawX, nB.drawX);
        const overlapRight = Math.min(rightA, nB.drawX + nB.drawW);
        if (overlapRight - overlapLeft <= 0.5) continue;

        const overlapTop = Math.max(nA.drawY, nB.drawY);
        const overlapBottom = Math.min(bottomA, nB.drawY + nB.drawH);
        if (overlapBottom - overlapTop <= 0.5) continue;

        const overlapW = overlapRight - overlapLeft;
        const overlapH = overlapBottom - overlapTop;
        const mixedColor = mixColorsInt(nA.colorInt, nB.colorInt);
        const radius = Math.min(nA.radius, nB.radius, overlapW / 2, overlapH / 2);

        graphics
          .roundRect(overlapLeft, overlapTop, overlapW, overlapH, radius)
          .fill(mixedColor);

        // Check 3-way overlap in same lane
        for (let k = j + 1; k < bLen; k++) {
          const idxC = bucket[k];
          const nC = notes[idxC];

          const o3Left = Math.max(overlapLeft, nC.drawX);
          const o3Right = Math.min(overlapRight, nC.drawX + nC.drawW);
          if (o3Right - o3Left <= 0.5) continue;

          const o3Top = Math.max(overlapTop, nC.drawY);
          const o3Bottom = Math.min(overlapBottom, nC.drawY + nC.drawH);
          if (o3Bottom - o3Top <= 0.5) continue;

          const o3W = o3Right - o3Left;
          const o3H = o3Bottom - o3Top;
          const mixed3 = mixColors3Int(nA.colorInt, nB.colorInt, nC.colorInt);
          const r3 = Math.min(radius, nC.radius, o3W / 2, o3H / 2);

          graphics
            .roundRect(o3Left, o3Top, o3W, o3H, r3)
            .fill(mixed3);
        }
      }
    }

    // B. Intersections with immediately adjacent next lane (b + 1) if keys physically overlap horizontally
    if (b + 1 < TOTAL_MIDI_LANES) {
      const nextBucket = laneBuckets[b + 1];
      const nextLen = nextBucket.length;
      for (let i = 0; i < bLen; i++) {
        const nA = notes[bucket[i]];
        const rightA = nA.drawX + nA.drawW;
        const bottomA = nA.drawY + nA.drawH;

        for (let j = 0; j < nextLen; j++) {
          const nB = notes[nextBucket[j]];
          const overlapLeft = Math.max(nA.drawX, nB.drawX);
          const overlapRight = Math.min(rightA, nB.drawX + nB.drawW);
          if (overlapRight - overlapLeft <= 0.5) continue;

          const overlapTop = Math.max(nA.drawY, nB.drawY);
          const overlapBottom = Math.min(bottomA, nB.drawY + nB.drawH);
          if (overlapBottom - overlapTop <= 0.5) continue;

          const overlapW = overlapRight - overlapLeft;
          const overlapH = overlapBottom - overlapTop;
          const mixedColor = mixColorsInt(nA.colorInt, nB.colorInt);
          const radius = Math.min(nA.radius, nB.radius, overlapW / 2, overlapH / 2);

          graphics
            .roundRect(overlapLeft, overlapTop, overlapW, overlapH, radius)
            .fill(mixedColor);
        }
      }
    }
  }

  // 3. Stroke every note's border with crisp solid white so all edges are visible
  for (let i = 0; i < count; i++) {
    const n = notes[i];
    graphics
      .roundRect(n.drawX, n.drawY, n.drawW, n.drawH, n.radius)
      .stroke({ color: 0xffffff, width: 1 });
  }
}


interface SynthesiaCanvasProps {
  colorMode?: ColorMode;
  fallSpeed?: number; // Pixels per second (e.g. 260)
  activeMidiNotes?: Set<number>;
  isPlaying?: boolean;
  midiTranspose?: number;
  showNoteBlocks?: boolean;
  targetFps?: 72 | 144;
  isMobilePortrait?: boolean;
}

export const SynthesiaCanvas: React.FC<SynthesiaCanvasProps> = ({
  colorMode = 'track',
  fallSpeed = 120,
  activeMidiNotes,
  isPlaying = false,
  midiTranspose = 0,
  showNoteBlocks = true,
  targetFps = 72,
  isMobilePortrait = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // PixiJS v8 instances
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);

  // Live played notes for visual waterfall trails (supports multiple concurrent notes per MIDI pitch)
  const activeLiveNotesRef = useRef<LivePlayedNote[]>([]);
  const finishedLiveNotesRef = useRef<LivePlayedNote[]>([]);

  // Zero-stale access refs inside high-performance render loop
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;
  const fallSpeedRef = useRef(fallSpeed);
  fallSpeedRef.current = fallSpeed;
  const activeNotesRef = useRef(activeMidiNotes);
  activeNotesRef.current = activeMidiNotes;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const midiTransposeRef = useRef(midiTranspose);
  midiTransposeRef.current = midiTranspose;
  const showNoteBlocksRef = useRef(showNoteBlocks);
  showNoteBlocksRef.current = showNoteBlocks;
  const targetFpsRef = useRef(targetFps);
  targetFpsRef.current = targetFps;
  const isMobilePortraitRef = useRef(isMobilePortrait);
  isMobilePortraitRef.current = isMobilePortrait;

  // Render loop lifecycle refs
  const isLoopRunningRef = useRef<boolean>(false);
  const isDestroyedRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastRenderFrameTimeRef = useRef<number>(0);

  // Core single frame render implementation using PixiJS v8 WebGL batching
  const renderFrame = useCallback((frameTimestamp?: number) => {
    if (isDestroyedRef.current) return false;

    const app = appRef.current;
    const noteGraphics = graphicsRef.current;
    if (!app || !noteGraphics || !app.renderer) return false;

    const width = app.screen?.width ?? 0;
    const height = app.screen?.height ?? 0;
    if (width <= 0 || height <= 0) return false;

    const now = frameTimestamp ?? performance.now();
    lastTimeRef.current = now;

    // Reset graphics instructions for this frame
    noteGraphics.clear();

    const speed = fallSpeedRef.current;
    const currentMode = colorModeRef.current;
    const isMobile = isMobilePortraitRef.current;
    const playbackTime = midiManager.getPlaybackTime(now);
    const song = midiManager.getCurrentSong();

    if (showNoteBlocksRef.current) {
      const visibleNotes: RenderNoteBlock[] = [];

      // 1. Collect Falling Synthesia Notes from Active Song
      if (song && song.notes.length > 0) {
        const notes = song.notes;
        const transpose = midiTransposeRef.current;
        const lookaheadSeconds = height / speed + 1.0;
        const lookbehindSeconds = 1.0;

        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];

          // Culling: notes are sorted chronologically
          if (note.time > playbackTime + lookaheadSeconds) break;
          if (note.time + note.duration < playbackTime - lookbehindSeconds) continue;

          const transposedMidi = note.midi + transpose;
          if (transposedMidi < MIN_MIDI || transposedMidi > MAX_MIDI) continue;
          if (isMobile && (transposedMidi < MIDDLE_OCTAVES_MIN_MIDI || transposedMidi > MIDDLE_OCTAVES_MAX_MIDI)) continue;

          const timeUntilHit = note.time - playbackTime;
          const yBottom = height - timeUntilHit * speed;
          const noteHeight = Math.max(8, note.duration * speed);
          const yTop = yBottom - noteHeight;

          // Viewport clipping
          if (yBottom >= 0 && yTop <= height) {
            const colorInt = getNoteColorInt(transposedMidi, note.trackIndex, currentMode);
            const rawX = getKeyX(transposedMidi, width, isMobile);
            const rawW = getKeyWidth(transposedMidi, width, isMobile);
            const pad = 1.0;
            const drawX = rawX + pad;
            const drawW = Math.max(2, rawW - pad * 2);
            const drawY = yTop;
            const drawH = Math.max(4, noteHeight);
            const radius = Math.min(7, drawW / 2, drawH / 2);

            visibleNotes.push({
              midi: transposedMidi,
              drawX,
              drawY,
              drawW,
              drawH,
              radius,
              colorInt,
            });
          }
        }
      }

      // 2. Collect Live Played Notes Trails (Zero-allocation in-place pruning)
      const nowSec = now / 1000;
      const upwardSpeed = speed * 0.75; // Slower upward speed for smooth, readable live notes
      const maxTrailLifetime = height / upwardSpeed + 1;
      const finishedNotes = finishedLiveNotesRef.current;
      let writeIdx = 0;
      for (let i = 0; i < finishedNotes.length; i++) {
        const n = finishedNotes[i];
        if (nowSec - (n.endTime || 0) < maxTrailLifetime) {
          if (writeIdx !== i) {
            finishedNotes[writeIdx] = n;
          }
          writeIdx++;
        }
      }
      finishedNotes.length = writeIdx;

      const activeLive = activeLiveNotesRef.current;

      const collectLiveNote = (n: LivePlayedNote) => {
        if (n.midi < MIN_MIDI || n.midi > MAX_MIDI) {
          return;
        }
        if (isMobile && (n.midi < MIDDLE_OCTAVES_MIN_MIDI || n.midi > MIDDLE_OCTAVES_MAX_MIDI)) {
          return;
        }

        const startAgo = nowSec - n.startTime;
        const endAgo = n.endTime !== null ? nowSec - n.endTime : 0;
        const rawHeight = (startAgo - endAgo) * upwardSpeed;
        const noteH = n.endTime !== null ? Math.max(10, rawHeight) : Math.max(2, rawHeight);
        const yBottom = height - endAgo * upwardSpeed;
        const yTop = yBottom - noteH;

        if (yBottom >= 0 && yTop <= height && yBottom - yTop > 0) {
          const rawX = getKeyX(n.midi, width, isMobile);
          const rawW = getKeyWidth(n.midi, width, isMobile);
          const pad = 1.0;
          const drawX = rawX + pad;
          const drawW = Math.max(2, rawW - pad * 2);
          const drawY = yTop;
          const drawH = Math.max(4, noteH);
          const radius = Math.min(7, drawW / 2, drawH / 2);

          visibleNotes.push({
            id: n.id,
            midi: n.midi,
            drawX,
            drawY,
            drawW,
            drawH,
            radius,
            colorInt: n.colorInt,
          });
        }
      };

      for (let i = 0; i < activeLive.length; i++) {
        collectLiveNote(activeLive[i]);
      }
      for (let i = 0; i < finishedNotes.length; i++) {
        collectLiveNote(finishedNotes[i]);
      }

      // Render all visible notes with 2D color mixture on overlap and crisp visible outlines for all notes
      renderAllNoteBlocksPixi(noteGraphics, visibleNotes, currentMode === 'outline');
    } else {
      // If note blocks are hidden, still prune old finished notes so memory does not leak
      const nowSec = now / 1000;
      const upwardSpeed = speed * 0.75;
      const maxTrailLifetime = height / upwardSpeed + 1;
      const finishedNotes = finishedLiveNotesRef.current;
      let writeIdx = 0;
      for (let i = 0; i < finishedNotes.length; i++) {
        const n = finishedNotes[i];
        if (nowSec - (n.endTime || 0) < maxTrailLifetime) {
          if (writeIdx !== i) {
            finishedNotes[writeIdx] = n;
          }
          writeIdx++;
        }
      }
      finishedNotes.length = writeIdx;
    }

    // Submit WebGL batched draw call to GPU safely
    try {
      if (app.renderer) {
        app.render();
      }
    } catch {
      isLoopRunningRef.current = false;
      return false;
    }

    // Determine if animation must continue for next frame
    if (!showNoteBlocksRef.current) {
      return false;
    }

    const hasLiveNotes = activeLiveNotesRef.current.length > 0 || finishedLiveNotesRef.current.length > 0;
    const hasActiveNotes = (activeNotesRef.current?.size ?? 0) > 0;
    const isSongPlaying = isPlayingRef.current || midiManager.getIsPlaying();

    return isSongPlaying || hasLiveNotes || hasActiveNotes;
  }, []);

  // Demand-Driven Render Loop Controller
  const renderLoop = useCallback((rafTimestamp?: number) => {
    if (isDestroyedRef.current) {
      isLoopRunningRef.current = false;
      return;
    }

    if (typeof document !== 'undefined' && document.hidden) {
      isLoopRunningRef.current = false;
      return;
    }

    const now = rafTimestamp ?? performance.now();
    const target = targetFpsRef.current;
    const frameInterval = target && target > 0 ? 1000 / target : 0;

    if (frameInterval > 0 && lastRenderFrameTimeRef.current > 0) {
      const elapsed = now - lastRenderFrameTimeRef.current;
      if (elapsed < frameInterval - 1.0) {
        animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      lastRenderFrameTimeRef.current = now;
    } else {
      lastRenderFrameTimeRef.current = now;
    }

    const shouldContinue = renderFrame(now);

    if (shouldContinue) {
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    } else {
      // Idle resting state reached: pause loop and drop CPU/GPU usage to 0%
      isLoopRunningRef.current = false;
      animationFrameIdRef.current = null;
    }
  }, [renderFrame]);

  // Wake the animation loop if dormant
  const wakeLoop = useCallback(() => {
    if (isDestroyedRef.current) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    if (!isLoopRunningRef.current) {
      isLoopRunningRef.current = true;
      lastTimeRef.current = performance.now();
      lastRenderFrameTimeRef.current = 0;
      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    }
  }, [renderLoop]);

  // Request a single static dirty frame redraw when idle
  const requestStaticRender = useCallback(() => {
    if (isDestroyedRef.current) return;
    if (isLoopRunningRef.current) return; // already actively looping
    renderFrame();
  }, [renderFrame]);

  // Initialize PixiJS v8 Application with clean dynamic canvas mounting
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
        autoStart: false, // Controlled via demand-driven loop
      });

      if (isCancelled) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // ignore
        }
        return;
      }

      createdApp = app;
      appRef.current = app;

      // Attach fresh canvas element with new WebGL context
      const canvas = app.canvas;
      canvas.className = 'absolute top-0 left-0 w-full h-full block pointer-events-none';
      container.appendChild(canvas);

      const noteGraphics = new Graphics();
      app.stage.addChild(noteGraphics);
      graphicsRef.current = noteGraphics;

      // Draw initial resting state
      requestStaticRender();
    };

    initPixi();

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
          if (createdApp.canvas && createdApp.canvas.parentNode) {
            createdApp.canvas.parentNode.removeChild(createdApp.canvas);
          }
          createdApp.destroy(true, { children: true });
        } catch {
          // ignore
        }
        appRef.current = null;
        graphicsRef.current = null;
      }
    };
  }, [requestStaticRender]);

  // Listen to MIDI Note Events to trigger waterfall and wake loop
  useEffect(() => {
    const handleNoteOn = (
      midi: number,
      _velocity: number,
      isLiveInput: boolean,
      customColor?: string,
      inputId?: string
    ) => {
      // ONLY generate upward live notes for interactive/live inputs (keyboard, mouse, hardware MIDI)
      if (!isLiveInput) return;
      if (!showNoteBlocksRef.current) return;

      const now = performance.now() / 1000;
      const isMouseOrTouch = inputId?.startsWith('pointer:') || inputId?.startsWith('touch:');
      const color = customColor || (isMouseOrTouch && colorModeRef.current !== 'outline' ? getNoteColorHex(midi, 0, 'gradient') : getNoteColorHex(midi, 0, colorModeRef.current));
      const colorInt = parseColorToInt(color);

      // If an active note already exists for this exact inputId and midi, keep it active without splitting
      if (inputId) {
        const existingActive = activeLiveNotesRef.current.find(
          n => n.midi === midi && n.inputId === inputId
        );
        if (existingActive) {
          if (color) {
            existingActive.color = color;
            existingActive.colorInt = colorInt;
          }
          wakeLoop();
          return;
        }
      }

      activeLiveNotesRef.current.push({
        id: `${midi}-${now}-${Math.random()}`,
        midi,
        inputId,
        startTime: now,
        endTime: null,
        color,
        colorInt,
      });

      // Dynamic interaction: wake the render loop immediately
      wakeLoop();
    };

    const handleNoteOff = (midi: number, isLiveInput: boolean, inputId?: string) => {
      // ONLY handle live inputs
      if (!isLiveInput) return;

      const now = performance.now() / 1000;
      const activeList = activeLiveNotesRef.current;

      let targetIdx = -1;
      if (inputId) {
        targetIdx = activeList.findIndex(n => n.midi === midi && n.inputId === inputId);
        if (targetIdx === -1) {
          // Specific inputId not found in active list; do not release other active inputs!
          return;
        }
      } else {
        targetIdx = activeList.findIndex(n => n.midi === midi);
      }

      if (targetIdx !== -1) {
        const [note] = activeList.splice(targetIdx, 1);
        note.endTime = now;
        finishedLiveNotesRef.current.push(note);
      }

      if (showNoteBlocksRef.current) {
        wakeLoop();
      }
    };

    // Scrubbing / Seek time update listener when paused
    const handleTimeUpdate = () => {
      if (!isPlayingRef.current && showNoteBlocksRef.current) {
        requestStaticRender();
      }
    };

    const unsubNoteOn = midiManager.onNoteOn(handleNoteOn);
    const unsubNoteOff = midiManager.onNoteOff(handleNoteOff);
    const unsubTimeUpdate = midiManager.onTimeUpdate(handleTimeUpdate);

    return () => {
      unsubNoteOn?.();
      unsubNoteOff?.();
      unsubTimeUpdate?.();
    };
  }, [wakeLoop, requestStaticRender]);

  // React to isPlaying changes
  useEffect(() => {
    if (isPlaying && showNoteBlocks) {
      wakeLoop();
    }
  }, [isPlaying, showNoteBlocks, wakeLoop]);

  // React to activeMidiNotes changes (e.g. keyboard press from parent)
  useEffect(() => {
    if (activeMidiNotes && activeMidiNotes.size > 0 && showNoteBlocks) {
      wakeLoop();
    }
  }, [activeMidiNotes, showNoteBlocks, wakeLoop]);

  // React to theme / speed / transpose / layout changes while paused
  useEffect(() => {
    isMobilePortraitRef.current = isMobilePortrait;
    if (showNoteBlocks) {
      requestStaticRender();
    }
  }, [colorMode, fallSpeed, midiTranspose, showNoteBlocks, isMobilePortrait, requestStaticRender]);

  // React to targetFps changes
  useEffect(() => {
    targetFpsRef.current = targetFps;
  }, [targetFps]);

  // Instantly clear all active and finished note block trails when visuals are toggled on/off
  useEffect(() => {
    activeLiveNotesRef.current = [];
    finishedLiveNotesRef.current = [];
    if (showNoteBlocks) {
      wakeLoop();
    } else {
      requestStaticRender();
    }
  }, [showNoteBlocks, wakeLoop, requestStaticRender]);

  // Setup ResizeObserver and Visibility Lifecycle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      const app = appRef.current;
      if (app && container && app.renderer) {
        try {
          app.renderer.resize(container.clientWidth, container.clientHeight);
          requestStaticRender();
        } catch {
          // ignore
        }
      }
    });
    resizeObserver.observe(container);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        isLoopRunningRef.current = false;

        // Finalize any open live notes so they don't stretch into infinite frozen trails
        const now = performance.now() / 1000;
        while (activeLiveNotesRef.current.length > 0) {
          const note = activeLiveNotesRef.current.pop()!;
          note.endTime = now;
          finishedLiveNotesRef.current.push(note);
        }
      } else {
        // When tab is refocused, always wake the loop to allow remaining live trails to animate smoothly offscreen
        lastTimeRef.current = performance.now();
        wakeLoop();
      }
    };

    const handleWindowBlur = () => {
      const now = performance.now() / 1000;
      while (activeLiveNotesRef.current.length > 0) {
        const note = activeLiveNotesRef.current.pop()!;
        note.endTime = now;
        finishedLiveNotesRef.current.push(note);
      }
    };

    const handleWindowFocus = () => {
      lastTimeRef.current = performance.now();
      wakeLoop();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [wakeLoop, requestStaticRender]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-transparent pointer-events-none"
    />
  );
};
