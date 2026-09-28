'use client';

import React, { useState, useEffect } from 'react';
import {
  Command,
  Play,
  FastForward,
  Rewind,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RotateCcw,
  Check,
} from 'lucide-react';
import { HotkeyBindings, DEFAULT_HOTKEYS } from '@/lib/settings';
import { getKeyDisplayLabel } from '@/lib/pianoGeometry';

export interface HotkeysSettingsTabProps {
  hotkeys?: HotkeyBindings;
  onHotkeysChange?: (hotkeys: HotkeyBindings) => void;
  onResetHotkeys?: () => void;
}

interface HotkeyItemDef {
  id: keyof HotkeyBindings;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const HOTKEY_DEFS: HotkeyItemDef[] = [
  {
    id: 'playPause',
    name: 'Play / Pause',
    description: 'Toggle song playback',
    icon: Play,
    accentColor: 'text-emerald-400',
  },
  {
    id: 'forward',
    name: 'Fast Forward',
    description: 'Jump forward by seek interval',
    icon: FastForward,
    accentColor: 'text-cyan-400',
  },
  {
    id: 'rewind',
    name: 'Rewind',
    description: 'Jump backward by seek interval',
    icon: Rewind,
    accentColor: 'text-cyan-400',
  },
  {
    id: 'transposeUp',
    name: 'Transpose Up',
    description: 'Shift live input up 1 octave (+12 semitones)',
    icon: ArrowUp,
    accentColor: 'text-violet-400',
  },
  {
    id: 'transposeDown',
    name: 'Transpose Down',
    description: 'Shift live input down 1 octave (-12 semitones)',
    icon: ArrowDown,
    accentColor: 'text-violet-400',
  },
  {
    id: 'leftOctaveToggle',
    name: 'Left Octave Shift',
    description: 'Toggle +1 octave (+12 semitones) for left board',
    icon: Sparkles,
    accentColor: 'text-pink-400',
  },
];

export const HotkeysSettingsTab: React.FC<HotkeysSettingsTabProps> = ({
  hotkeys = DEFAULT_HOTKEYS,
  onHotkeysChange,
  onResetHotkeys,
}) => {
  const [rebindingId, setRebindingId] = useState<keyof HotkeyBindings | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Capture keyboard input when a hotkey slot is listening
  useEffect(() => {
    if (!rebindingId) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels rebinding
      if (e.key === 'Escape' || e.code === 'Escape') {
        setRebindingId(null);
        return;
      }

      const newCode = e.code;
      if (!newCode) return;

      onHotkeysChange?.({
        ...hotkeys,
        [rebindingId]: newCode,
      });

      setRebindingId(null);
    };

    window.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
    };
  }, [rebindingId, hotkeys, onHotkeysChange]);

  const handleResetClick = () => {
    if (onResetHotkeys) {
      onResetHotkeys();
    } else if (onHotkeysChange) {
      onHotkeysChange(DEFAULT_HOTKEYS);
    }
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 1600);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Overview & Quick Info Card */}
      <div className="flex flex-col gap-2.5 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="font-medium text-zinc-200 flex items-center gap-1.5 text-xs">
            <Command className="w-3.5 h-3.5 text-cyan-400" /> Hotkey Configuration
          </span>
          <button
            type="button"
            onClick={handleResetClick}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
              resetSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200 hover:bg-white/[0.08]'
            }`}
          >
            {resetSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Reset</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Click any button below to remap its shortcut. Press <kbd className="px-1 py-0.5 text-[10px] rounded bg-white/[0.08] border border-white/10 text-zinc-300 font-mono">Esc</kbd> to cancel.
        </p>
      </div>

      {/* Hotkey Remapping Items */}
      <div className="flex flex-col gap-2 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
        {HOTKEY_DEFS.map((item) => {
          const Icon = item.icon;
          const isListening = rebindingId === item.id;
          const currentCode = hotkeys[item.id] || DEFAULT_HOTKEYS[item.id];
          const displayLabel = getKeyDisplayLabel(currentCode) || currentCode;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                isListening
                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-6 h-6 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Icon className={`w-3.5 h-3.5 ${item.accentColor}`} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 truncate">
                    {item.description}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRebindingId(isListening ? null : item.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-cyan-500 text-black border-cyan-400 font-bold animate-pulse shadow-md'
                    : 'bg-white/[0.06] text-zinc-200 border-white/[0.12] hover:bg-white/[0.12] hover:border-cyan-400/50 hover:text-white'
                }`}
              >
                {isListening ? (
                  <span className="text-[11px] tracking-wide">Press key...</span>
                ) : (
                  <kbd className="font-sans font-medium">{displayLabel}</kbd>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
