'use client';

import React from 'react';
import { useFps } from '@/hooks/useFps';

interface FpsBadgeProps {
  targetFps: 72 | 144;
}

export const FpsBadge: React.FC<FpsBadgeProps> = React.memo(({ targetFps }) => {
  const fps = useFps(targetFps);

  return (
    <div
      title={`Visualizer Performance: ${fps} FPS (Target: ${targetFps} Hz)`}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono text-zinc-200 select-none"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 shrink-0 ${fps >= (targetFps === 144 ? 120 : 66)
          ? 'bg-emerald-400'
          : fps >= (targetFps === 144 ? 60 : 36)
            ? 'bg-amber-400'
            : 'bg-rose-400'
          }`}
      />
      <span className="tabular-nums font-semibold tracking-tight min-w-[18px] text-center inline-block">
        {fps}
      </span>
      <span className="text-[10px] text-zinc-500 font-sans font-medium">FPS</span>
      <span className="text-[10px] text-zinc-400 font-mono">({targetFps}Hz)</span>
    </div>
  );
});

FpsBadge.displayName = 'FpsBadge';
