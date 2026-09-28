'use client';

import React from 'react';
import { useNps } from '@/hooks/useNps';

export const NpsBadge: React.FC = React.memo(() => {
  const { nps, peakNps } = useNps();

  return (
    <div
      title={`Notes Per Second: ${nps} NPS (Peak: ${peakNps} NPS)`}
      suppressHydrationWarning
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono select-none transition-colors duration-200 ${nps >= 30
        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
        : nps > 0
          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
          : 'bg-white/[0.05] text-zinc-300 border-white/[0.08]'
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 shrink-0 ${nps >= 30
          ? 'bg-purple-400'
          : nps > 0
            ? 'bg-cyan-400'
            : 'bg-zinc-600'
          }`}
      />
      <span className="tabular-nums font-semibold tracking-tight min-w-[14px] text-center inline-block">
        {nps}
      </span>
      <span className="text-[10px] text-zinc-500 font-sans font-medium">NPS</span>
      <span className="text-[10px] text-zinc-400 font-mono">(Peak: {peakNps})</span>
    </div>
  );
});

NpsBadge.displayName = 'NpsBadge';
