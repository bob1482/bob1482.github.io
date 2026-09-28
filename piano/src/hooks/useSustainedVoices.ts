import { useRealVoices, RealVoiceStatus } from './useRealVoices';

export { useRealVoices, type RealVoiceStatus };

/**
 * Legacy alias for useRealVoices
 */
export function useSustainedVoices(): { sustained: number; held: number; total: number; activeVoices: number; maxVoices: number } {
  const { activeVoices, maxVoices } = useRealVoices();
  return {
    sustained: activeVoices,
    held: 0,
    total: activeVoices,
    activeVoices,
    maxVoices,
  };
}
