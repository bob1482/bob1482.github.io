import { useState, useEffect, useRef, useCallback } from 'react';
import { audioEngine } from '@/lib/audioEngine';

export interface RealVoiceStatus {
  activeVoices: number;
  maxVoices: number;
}

/**
 * Custom React hook that monitors the real in-use Web Audio voices in real-time.
 * Demand-driven: runs animation frames while voices are active (> 0) to monitor
 * natural audio decay, and sleeps (stops RAF) when idle (0 voices).
 */
export function useRealVoices(): RealVoiceStatus {
  const [status, setStatus] = useState<RealVoiceStatus>(() => ({
    activeVoices: typeof window !== 'undefined' ? audioEngine.getActiveVoiceCount() : 0,
    maxVoices: typeof window !== 'undefined' ? audioEngine.getMaxVoices() : 64,
  }));

  const lastVoicesRef = useRef<number>(0);
  const lastMaxRef = useRef<number>(64);
  const rafIdRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const tick = useCallback(() => {
    if (!isMountedRef.current) {
      rafIdRef.current = null;
      return;
    }

    const currentVoices = audioEngine.getActiveVoiceCount();
    const currentMax = audioEngine.getMaxVoices();

    if (currentVoices !== lastVoicesRef.current || currentMax !== lastMaxRef.current) {
      lastVoicesRef.current = currentVoices;
      lastMaxRef.current = currentMax;
      setStatus({
        activeVoices: currentVoices,
        maxVoices: currentMax,
      });
    }

    // While voices are ringing / decaying, continue monitoring; sleep when 0
    if (currentVoices > 0) {
      rafIdRef.current = requestAnimationFrame(tick);
    } else {
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

    // Wake loop whenever audio engine notes/sustain change
    const unsubVoice = audioEngine.onVoiceCountChange(() => {
      wakeLoop();
    });

    // Check initial status
    const initialVoices = audioEngine.getActiveVoiceCount();
    if (initialVoices > 0) {
      wakeLoop();
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      } else {
        const voices = audioEngine.getActiveVoiceCount();
        if (voices > 0) {
          wakeLoop();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      unsubVoice?.();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLoop]);

  return status;
}
