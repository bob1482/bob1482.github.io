'use client';

import React from 'react';
import { SustainMode } from '@/lib/settings';

export interface SustainButtonProps {
  sustainPedal: SustainMode;
  isMousePedalMode?: boolean;
  isMousePedalPressed?: boolean;
  isMobileTopBar?: boolean;
  onToggleSustain: () => void;
  onEnterMousePedalMode?: () => void;
  className?: string;
}

export const SustainButton: React.FC<SustainButtonProps> = React.memo(({
  sustainPedal,
  isMousePedalMode = false,
  isMousePedalPressed = false,
  isMobileTopBar = false,
  onToggleSustain,
  onEnterMousePedalMode,
  className = '',
}) => {
  return (
    <button
      onClick={onToggleSustain}
      onContextMenu={(e) => {
        e.preventDefault();
        const nativeEvt = e.nativeEvent as any;
        if (
          nativeEvt?.pointerType === 'touch' ||
          nativeEvt?.pointerType === 'pen' ||
          Boolean(nativeEvt?.sourceCapabilities?.firesTouchEvents)
        ) {
          return;
        }
        onEnterMousePedalMode?.();
      }}
      title={
        isMousePedalMode
          ? 'Mouse Sustain Pedal Mode Active • Right-Click: Hold to sustain • Press ESC to exit'
          : sustainPedal === 'full'
            ? 'Sustain Pedal: Full (Click: Cycle mode • Right-Click: Lock mouse as Sustain Pedal)'
            : sustainPedal === 'half'
              ? 'Sustain Pedal: Half (Click: Cycle mode • Right-Click: Lock mouse as Sustain Pedal)'
              : 'Sustain Pedal: Off (Click: Cycle mode • Right-Click: Lock mouse as Sustain Pedal)'
      }
      suppressHydrationWarning
      className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
        isMousePedalMode
          ? isMousePedalPressed
            ? 'bg-sky-500/25 text-sky-300 border-sky-400 scale-105'
            : 'bg-zinc-900/90 text-zinc-400 border-white/10 hover:bg-zinc-800'
          : sustainPedal !== 'off'
            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
            : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
      } ${className}`}
    >
      {isMousePedalMode && !isMousePedalPressed ? (
        <div className="relative flex items-center justify-center w-3.5 h-3.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="7" />
            <path d="M12 6v4" />
          </svg>
        </div>
      ) : sustainPedal === 'full' ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />
          <path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" />
          <path d="M2 19q2.5 2 5 0t5 0 5 0 5 0" />
        </svg>
      ) : sustainPedal === 'half' ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 8.5q2.5 2 5 0t5 0 5 0 5 0" />
          <path d="M2 15.5q2.5 2 5 0t5 0 5 0 5 0" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" opacity="0.35" />
          <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2" />
        </svg>
      )}
    </button>
  );
});

SustainButton.displayName = 'SustainButton';
