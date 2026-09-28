import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to measure real-time frames per second (FPS) with high precision.
 * Updates at ~2.5 Hz to provide responsive yet stable visual feedback.
 */
export function useFps(targetFps: number = 72): number {
  const [fps, setFps] = useState<number>(targetFps);
  const frameCountRef = useRef<number>(0);
  const lastCalcTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const targetFpsRef = useRef<number>(targetFps);
  targetFpsRef.current = targetFps;

  useEffect(() => {
    lastCalcTimeRef.current = performance.now();
    lastFrameTimeRef.current = 0;
    frameCountRef.current = 0;

    const tick = (now: number) => {
      const target = targetFpsRef.current;
      const frameInterval = target > 0 ? 1000 / target : 0;

      if (frameInterval > 0 && lastFrameTimeRef.current > 0) {
        const elapsedSinceLastFrame = now - lastFrameTimeRef.current;
        const tolerance = Math.min(1.5, frameInterval * 0.1);
        if (elapsedSinceLastFrame < frameInterval - tolerance) {
          rafIdRef.current = requestAnimationFrame(tick);
          return;
        }
        // Advance frame baseline to avoid phase beat frequency (e.g. 144Hz / 60FPS)
        lastFrameTimeRef.current = Math.max(
          lastFrameTimeRef.current + frameInterval,
          now - frameInterval
        );
      } else {
        lastFrameTimeRef.current = now;
      }

      frameCountRef.current++;

      const calcElapsed = now - lastCalcTimeRef.current;

      // If tab was suspended or throttled in background, reset baseline without glitching FPS
      if (calcElapsed > 1500) {
        frameCountRef.current = 0;
        lastCalcTimeRef.current = now;
      } else if (calcElapsed >= 400) {
        const calculatedFps = Math.round((frameCountRef.current * 1000) / calcElapsed);
        setFps(Math.min(calculatedFps, targetFpsRef.current));
        frameCountRef.current = 0;
        lastCalcTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else {
        lastCalcTimeRef.current = performance.now();
        lastFrameTimeRef.current = 0;
        frameCountRef.current = 0;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(tick);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // When targetFps changes, reset frame baseline for instant smooth measurement
  useEffect(() => {
    lastFrameTimeRef.current = 0;
    frameCountRef.current = 0;
    lastCalcTimeRef.current = performance.now();
  }, [targetFps]);

  return fps;
}
