'use client';

import React, { useState, useEffect, useRef } from 'react';
import { midiManager } from '@/lib/midiEngine';
import { formatTime } from './utils';

export interface TimelineScrubberProps {
  isSongActive: boolean;
  onSeek: (time: number) => void;
  seekSeconds?: number;
  orientation?: 'horizontal' | 'vertical';
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = React.memo(({
  isSongActive,
  onSeek,
  seekSeconds = 5,
  orientation = 'horizontal',
}) => {
  const [playbackTime, setPlaybackTime] = useState<number>(() => midiManager.getPlaybackTime());
  const [songDuration, setSongDuration] = useState<number>(() => midiManager.getCurrentSong()?.duration || 0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const unsubTime = midiManager.onTimeUpdate((time, dur) => {
      if (!isDraggingRef.current) {
        setPlaybackTime(time);
      }
      setSongDuration(dur);
    });

    return () => {
      unsubTime?.();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlaybackTime(val);
    onSeek(val);
  };

  const progressPercent = songDuration > 0 ? Math.min(100, Math.max(0, (playbackTime / songDuration) * 100)) : 0;

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-1 py-1 w-full select-none">
        <span className="text-[8px] font-mono text-zinc-400 text-center whitespace-nowrap select-none leading-none" suppressHydrationWarning>
          {formatTime(playbackTime)}
        </span>
        <div
          title={`Progress: ${formatTime(playbackTime)} / ${formatTime(songDuration)}`}
          className="relative w-1.5 h-12 bg-white/15 hover:bg-white/20 rounded-full cursor-pointer overflow-hidden transition-colors"
          onPointerDown={(e) => {
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const updateFromClientY = (clientY: number) => {
              const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
              const newTime = ratio * songDuration;
              setPlaybackTime(newTime);
              onSeek(newTime);
            };
            updateFromClientY(e.clientY);
            const onPointerMove = (ev: PointerEvent) => updateFromClientY(ev.clientY);
            const onPointerUp = () => {
              window.removeEventListener('pointermove', onPointerMove);
              window.removeEventListener('pointerup', onPointerUp);
            };
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-sky-400 rounded-full transition-all duration-75 pointer-events-none"
            style={{ height: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 flex-1 min-w-0">
      <span className="text-[11px] font-mono text-zinc-400 min-w-[34px] text-right whitespace-nowrap select-none" suppressHydrationWarning>
        {formatTime(playbackTime)}
      </span>
      <input
        type="range"
        min={0}
        max={songDuration || 100}
        step={0.1}
        value={playbackTime}
        onPointerDown={() => { isDraggingRef.current = true; }}
        onPointerUp={() => { isDraggingRef.current = false; }}
        onChange={handleChange}
        disabled={!isSongActive}
        title={`Seek position (← Rewind ${seekSeconds}s, → Forward ${seekSeconds}s)`}
        suppressHydrationWarning
        style={{
          background: `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${progressPercent}%, rgba(255, 255, 255, 0.12) ${progressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
        }}
        className="timeline-slider w-full cursor-pointer disabled:opacity-25"
      />
      <span className="text-[11px] font-mono text-zinc-500 min-w-[34px] whitespace-nowrap select-none" suppressHydrationWarning>
        {formatTime(songDuration)}
      </span>
    </div>
  );
});

TimelineScrubber.displayName = 'TimelineScrubber';
