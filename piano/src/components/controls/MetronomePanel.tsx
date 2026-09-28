'use client';

import React, { useRef } from 'react';
import { Metronome, X, Plus, Minus, Volume2, VolumeX } from 'lucide-react';
import { MidiSong } from '@/lib/midiEngine';
import { getTempoMarking } from './utils';

export interface MetronomePanelProps {
  showMetronome: boolean;
  onClose: () => void;
  isMobile: boolean;
  metronomeActive: boolean;
  metronomeBpm: number;
  metronomeBeats?: number;
  metronomeSound?: boolean;
  metronomeVolume?: number;
  currentBeat?: number;
  isFlashing: boolean;
  currentSong: MidiSong | null;
  onMetronomeActiveChange?: (active: boolean) => void;
  onMetronomeBpmChange?: (bpm: number) => void;
  onMetronomeBeatsChange?: (beats: number) => void;
  onMetronomeSoundChange?: (sound: boolean) => void;
  onMetronomeVolumeChange?: (volume: number) => void;
}

export const MetronomePanel: React.FC<MetronomePanelProps> = React.memo(({
  showMetronome,
  onClose,
  isMobile,
  metronomeActive,
  metronomeBpm,
  metronomeBeats = 4,
  metronomeSound = true,
  metronomeVolume = 0,
  currentBeat = 1,
  isFlashing,
  currentSong,
  onMetronomeActiveChange,
  onMetronomeBpmChange,
  onMetronomeBeatsChange,
  onMetronomeSoundChange,
  onMetronomeVolumeChange,
}) => {
  const tapTimesRef = useRef<number[]>([]);

  const handleTapTempo = React.useCallback(() => {
    const now = performance.now();
    const recentTaps = tapTimesRef.current.filter(t => now - t < 3000);
    recentTaps.push(now);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < recentTaps.length; i++) {
        intervals.push(recentTaps[i] - recentTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      if (avgInterval > 0) {
        const calculatedBpm = Math.round(60000 / avgInterval);
        const clampedBpm = Math.max(20, Math.min(300, calculatedBpm));
        onMetronomeBpmChange?.(clampedBpm);
        if (!metronomeActive) {
          onMetronomeActiveChange?.(true);
        }
      }
    }
  }, [onMetronomeBpmChange, metronomeActive, onMetronomeActiveChange]);

  if (!showMetronome) return null;

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99] pointer-events-auto transition-opacity duration-200"
        />
      )}
      <div
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 max-h-[85dvh] bg-zinc-950/98 backdrop-blur-2xl border-t border-white/[0.15] rounded-t-3xl z-[100] flex flex-col pointer-events-auto shadow-[0_-10px_35px_rgba(0,0,0,0.85)] p-5 pb-10 gap-3.5 text-xs animate-in slide-in-from-bottom duration-200 overflow-y-auto overscroll-contain custom-scrollbar"
            : "fixed top-[62px] left-3 w-84 max-h-[calc(100dvh-80px)] overflow-y-auto bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.12] p-4 rounded-2xl pointer-events-auto flex flex-col gap-3 text-xs shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150 custom-scrollbar"
        }
      >
        {isMobile && (
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-0.5 shrink-0" />
        )}
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
          <span className="font-medium text-zinc-200 flex items-center gap-2 text-sm sm:text-xs">
            <Metronome className="w-4 h-4 text-sky-400 shrink-0" /> Metronome &amp; Tempo
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 sm:p-0.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>

        {/* Metronome Active Power Switch */}
        <div className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
          <div className="flex flex-col">
            <span className="text-zinc-200 font-medium text-sm sm:text-xs">Metronome</span>
            <span className="text-[11px] sm:text-[10px] text-zinc-400">
              {metronomeActive ? `${metronomeBpm} BPM Active` : 'Turn on beat pulse'}
            </span>
          </div>
          <button
            onClick={() => onMetronomeActiveChange?.(!metronomeActive)}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
              metronomeActive
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.1] hover:text-zinc-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                metronomeActive
                  ? isFlashing
                    ? 'bg-sky-300 scale-125 shadow-[0_0_8px_rgba(56,189,248,0.9)]'
                    : 'bg-sky-400'
                  : 'bg-zinc-600'
              }`}
            />
            {metronomeActive ? 'Active' : 'Turn On'}
          </button>
        </div>

        {/* Metronome Sound Toggle & Volume Controls */}
        <div className="flex flex-col gap-2.5 bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {metronomeSound ? (
                <Volume2 className="w-4 h-4 text-sky-400 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-zinc-200 font-medium text-sm sm:text-xs">Audio Sound</span>
                <span className="text-[11px] sm:text-[10px] text-zinc-400">
                  {metronomeSound ? 'Ticking sound on beats' : 'Silent visual flashing only'}
                </span>
              </div>
            </div>

            <button
              onClick={() => onMetronomeSoundChange?.(!metronomeSound)}
              className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                metronomeSound
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25'
                  : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.1] hover:text-zinc-200'
              }`}
              title={metronomeSound ? 'Turn metronome sound off' : 'Turn metronome sound on'}
            >
              {metronomeSound ? 'Sound On' : 'Sound Off'}
            </button>
          </div>

          {/* Volume Slider (Enabled when sound is active) */}
          {metronomeSound && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.05]">
              <div className="flex items-center justify-between text-[11px] sm:text-[10px] text-zinc-400">
                <span>Sound Volume</span>
                <span className="font-mono text-zinc-300">
                  {metronomeVolume > 0 ? `+${metronomeVolume}` : metronomeVolume} dB
                </span>
              </div>
              <input
                type="range"
                min={-10}
                max={10}
                step={1}
                value={metronomeVolume}
                onChange={e => onMetronomeVolumeChange?.(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer accent-sky-400"
              />
            </div>
          )}
        </div>

        {/* Visual Beat Indicator & Time Signature */}
        <div className="flex flex-col gap-2 bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 font-medium text-xs">Beat Pattern</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 6].map(b => (
                <button
                  key={b}
                  onClick={() => onMetronomeBeatsChange?.(b)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono transition cursor-pointer active:scale-95 ${
                    metronomeBeats === b
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40 font-semibold'
                      : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:bg-white/[0.06]'
                  }`}
                  title={b === 1 ? '1 Beat (No accent)' : `${b} Beats per bar`}
                >
                  {b === 1 ? '1/1' : `${b}/4`}
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Beat Indicator Dots */}
          <div className="flex items-center justify-center gap-2 py-1">
            {Array.from({ length: metronomeBeats }).map((_, i) => {
              const beatNum = i + 1;
              const isCurrent = metronomeActive && currentBeat === beatNum;
              const isAccent = beatNum === 1;

              return (
                <div
                  key={beatNum}
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-medium transition-all duration-75 border ${
                    isCurrent
                      ? isAccent
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 scale-115 shadow-[0_0_12px_rgba(251,191,36,0.85)] font-bold'
                        : 'bg-sky-400 text-zinc-950 border-sky-300 scale-110 shadow-[0_0_10px_rgba(56,189,248,0.75)] font-bold'
                      : isAccent
                        ? 'bg-amber-500/10 text-amber-300/70 border-amber-500/20'
                        : 'bg-white/[0.03] text-zinc-500 border-white/[0.06]'
                  }`}
                  title={`Beat ${beatNum}${isAccent ? ' (Accent)' : ''}`}
                >
                  {beatNum}
                </div>
              );
            })}
          </div>
        </div>

        {/* BPM Display & Stepper Controls */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-2xl font-bold font-mono text-white tracking-tight">{metronomeBpm}</span>
                <span className="text-xs font-semibold text-sky-400">BPM</span>
              </div>
              <span className="text-xs sm:text-[10px] text-zinc-400 italic">{getTempoMarking(metronomeBpm)}</span>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center gap-1 sm:gap-1">
              <button
                onClick={() => onMetronomeBpmChange?.(Math.max(20, metronomeBpm - 5))}
                className="px-2.5 py-1.5 sm:px-2 sm:py-1 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 rounded-lg border border-white/[0.06] font-mono text-xs transition active:scale-95 cursor-pointer"
                title="-5 BPM"
              >
                -5
              </button>
              <button
                onClick={() => onMetronomeBpmChange?.(Math.max(20, metronomeBpm - 1))}
                className="p-2 sm:p-1 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 rounded-lg border border-white/[0.06] transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="-1 BPM"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMetronomeBpmChange?.(Math.min(300, metronomeBpm + 1))}
                className="p-2 sm:p-1 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 rounded-lg border border-white/[0.06] transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="+1 BPM"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMetronomeBpmChange?.(Math.min(300, metronomeBpm + 5))}
                className="px-2.5 py-1.5 sm:px-2 sm:py-1 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 rounded-lg border border-white/[0.06] font-mono text-xs transition active:scale-95 cursor-pointer"
                title="+5 BPM"
              >
                +5
              </button>
            </div>
          </div>

          {/* BPM Range Slider */}
          <input
            type="range"
            min={20}
            max={280}
            step={1}
            value={metronomeBpm}
            onChange={e => onMetronomeBpmChange?.(parseInt(e.target.value, 10))}
            className="w-full cursor-pointer accent-sky-400"
          />
        </div>

        {/* Tap Tempo Button */}
        <button
          onClick={handleTapTempo}
          className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-2 px-3 rounded-xl border border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 active:scale-95 transition-all cursor-pointer select-none"
        >
          <span className="font-semibold text-sm sm:text-xs">Tap Tempo</span>
          <span className="text-xs sm:text-[10px] text-sky-400/70">· Tap rhythmically</span>
        </button>

        {/* Quick Tempo Presets */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06]">
          <span className="text-[11px] sm:text-[10px] text-zinc-400 font-medium">Presets</span>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-1">
            {[60, 80, 100, 120, 140].map(bpmPreset => (
              <button
                key={bpmPreset}
                onClick={() => onMetronomeBpmChange?.(bpmPreset)}
                className={`py-2 sm:py-1 rounded-lg text-center font-mono text-xs sm:text-[11px] transition-all cursor-pointer ${
                  metronomeBpm === bpmPreset
                    ? 'bg-white/[0.12] text-white font-semibold border border-white/[0.2]'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:bg-white/[0.06]'
                }`}
              >
                {bpmPreset}
              </button>
            ))}
          </div>
        </div>

        {/* Match Song BPM */}
        {currentSong?.bpm && (
          <button
            onClick={() => onMetronomeBpmChange?.(currentSong.bpm!)}
            className="w-full py-2.5 sm:py-1.5 px-3 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs flex items-center justify-between transition active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-zinc-300">
              Match Song Tempo
            </span>
            <span className="font-mono text-sky-400 font-semibold">{currentSong.bpm} BPM</span>
          </button>
        )}
      </div>
    </>
  );
});

MetronomePanel.displayName = 'MetronomePanel';
