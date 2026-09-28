import { useState, useEffect, useRef, useCallback } from 'react';
import { midiManager } from '@/lib/midiEngine';

export interface NpsStatus {
  nps: number;
  peakNps: number;
  totalNotes: number;
}

/**
 * Custom React hook that tracks Notes Per Second (NPS) in real-time.
 * Demand-driven: automatically sleeps (stops RAF) when idle (NPS === 0)
 * and wakes on note attack. Drops idle CPU usage to 0%.
 */
export function useNps(): NpsStatus {
  const [nps, setNps] = useState<number>(0);
  const [peakNps, setPeakNps] = useState<number>(0);
  const [totalNotes, setTotalNotes] = useState<number>(0);

  const timestampsRef = useRef<number[]>([]);
  const peakNpsRef = useRef<number>(0);
  const totalNotesRef = useRef<number>(0);
  const lastNpsRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const tick = useCallback(() => {
    if (!isMountedRef.current) {
      rafIdRef.current = null;
      return;
    }

    const now = performance.now();
    const cutoff = now - 1000;
    const timestamps = timestampsRef.current;

    // Fast prune timestamps older than 1000ms
    let pruneCount = 0;
    while (pruneCount < timestamps.length && timestamps[pruneCount] <= cutoff) {
      pruneCount++;
    }
    if (pruneCount > 0) {
      timestamps.splice(0, pruneCount);
    }

    const currentNps = timestamps.length;

    if (currentNps > peakNpsRef.current) {
      peakNpsRef.current = currentNps;
      setPeakNps(currentNps);
    }

    if (currentNps !== lastNpsRef.current) {
      lastNpsRef.current = currentNps;
      setNps(currentNps);
    }

    // Continue loop only while there are active timestamps in the 1s sliding window
    if (timestamps.length > 0) {
      rafIdRef.current = requestAnimationFrame(tick);
    } else {
      // Idle state reached: sleep and drop CPU to 0%
      rafIdRef.current = null;
    }
  }, []);

  const wakeLoop = useCallback(() => {
    if (!isMountedRef.current) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    isMountedRef.current = true;

    // Listen to all note attacks from live keys, MIDI input, and song sequencer
    const unsubNoteOn = midiManager.onNoteOn(() => {
      const now = performance.now();
      timestampsRef.current.push(now);
      totalNotesRef.current++;
      if (isMountedRef.current) {
        setTotalNotes(totalNotesRef.current);
      }
      wakeLoop();
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else {
        // Clear stale timestamps when returning from background tab
        const now = performance.now();
        const cutoff = now - 1000;
        const timestamps = timestampsRef.current;
        let pruneCount = 0;
        while (pruneCount < timestamps.length && timestamps[pruneCount] <= cutoff) {
          pruneCount++;
        }
        if (pruneCount > 0) {
          timestamps.splice(0, pruneCount);
        }
        lastNpsRef.current = timestamps.length;
        setNps(timestamps.length);

        if (timestamps.length > 0) {
          wakeLoop();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      unsubNoteOn();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLoop]);

  return { nps, peakNps, totalNotes };
}
