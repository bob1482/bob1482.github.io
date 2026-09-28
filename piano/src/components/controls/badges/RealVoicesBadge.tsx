'use client';

import React from 'react';
import { useRealVoices } from '@/hooks/useRealVoices';

interface RealVoicesBadgeProps {
  maxVoices?: number;
}

export const RealVoicesBadge: React.FC<RealVoicesBadgeProps> = React.memo(({ maxVoices = 64 }) => {
  const { activeVoices } = useRealVoices();

  return (
    <div
      title={`Real In-Use Voices: ${activeVoices}${maxVoices > 0 ? ` (Max Polyphony Cap: ${maxVoices})` : ' (Unlimited)'}`}
      suppressHydrationWarning
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono select-none transition-colors duration-200 ${activeVoices > 0
        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
        : 'bg-white/[0.05] text-zinc-300 border-white/[0.08]'
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 shrink-0 ${activeVoices > 0
          ? 'bg-emerald-400'
          : 'bg-zinc-600'
          }`}
      />
      <span className="tabular-nums font-semibold tracking-tight min-w-[14px] text-center inline-block">
        {activeVoices}
      </span>
      <span className="text-[10px] text-zinc-500 font-sans font-medium">Active</span>
      <span className="text-[10px] text-zinc-400 font-mono">({maxVoices === 0 ? 'Max' : maxVoices})</span>
    </div>
  );
});

RealVoicesBadge.displayName = 'RealVoicesBadge';
