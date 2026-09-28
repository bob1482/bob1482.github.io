'use client';

import React from 'react';
import { Keyboard, Eye, EyeOff, Sparkles, Check, RotateCcw, Target, Layers, Type, ListOrdered } from 'lucide-react';
import { WickiBoardMode, WickiTextMode } from '@/lib/settings';
import { KeyboardLayoutType } from '@/lib/pianoGeometry';

export interface WickiSettingsTabProps {
  layoutType: KeyboardLayoutType;
  currentWickiMode: WickiBoardMode;
  wickiFadeDuration: number;
  hideWickiText: boolean;
  wickiTextMode?: WickiTextMode;
  wickiHighlightOnlyPressed?: boolean;
  isMobile: boolean;
  resetKeysSuccess: boolean;
  onSwitchToLayout: (targetType: KeyboardLayoutType) => void;
  onSetWickiMode: (mode: WickiBoardMode) => void;
  onWickiFadeDurationChange?: (sec: number) => void;
  onHideWickiTextChange?: (hide: boolean) => void;
  onWickiTextModeChange?: (mode: WickiTextMode) => void;
  onWickiHighlightOnlyPressedChange?: (onlyPressed: boolean) => void;
  onResetKeysClick: () => void;
}

export const WickiSettingsTab: React.FC<WickiSettingsTabProps> = React.memo(({
  layoutType,
  currentWickiMode,
  wickiFadeDuration,
  hideWickiText,
  wickiTextMode,
  wickiHighlightOnlyPressed = false,
  isMobile,
  resetKeysSuccess,
  onSwitchToLayout,
  onSetWickiMode,
  onWickiFadeDurationChange,
  onHideWickiTextChange,
  onWickiTextModeChange,
  onWickiHighlightOnlyPressedChange,
  onResetKeysClick,
}) => {
  const currentTextMode: WickiTextMode = wickiTextMode ?? (hideWickiText ? 'off' : 'keys');

  const handleModeChange = (nextMode: WickiTextMode) => {
    if (onWickiTextModeChange) {
      onWickiTextModeChange(nextMode);
    } else if (onHideWickiTextChange) {
      onHideWickiTextChange(nextMode === 'off');
    }
  };
  return (
    <div className="flex flex-col gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-200 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-zinc-400" /> Keyboard Mapping &amp; Wicki
        </span>
        <span className="font-mono text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-semibold">
          {layoutType === '8x12' ? '8 × 12' : layoutType === '9x18' ? '9 × 18' : layoutType === '6x4' ? '6 × 4' : '6 × 12'}
        </span>
      </div>

      {/* Matrix Layout Size */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <span className="text-zinc-300 font-medium">Layout Matrix</span>
          <span className="text-[10px] text-zinc-500">{isMobile ? '6×4 recommended for touch' : 'Grid size'}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onSwitchToLayout('6x4')}
            className={`py-2 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
              layoutType === '6x4'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            6 × 4
          </button>
          <button
            type="button"
            onClick={() => onSwitchToLayout('6x12')}
            className={`py-2 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
              layoutType === '6x12'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            6 × 12
          </button>
          <button
            type="button"
            onClick={() => onSwitchToLayout('8x12')}
            className={`py-2 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
              layoutType === '8x12'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            8 × 12
          </button>
          <button
            type="button"
            onClick={() => onSwitchToLayout('9x18')}
            className={`py-2 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
              layoutType === '9x18'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            9 × 18
          </button>
        </div>
      </div>

      {/* Wicki Board Display Mode */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Wicki Board Display</span>
            <span className="text-[10px] text-zinc-500">
              Hidden • Fade out on press • Always visible
            </span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              currentWickiMode !== 'off'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 font-semibold'
                : 'bg-zinc-800/60 text-zinc-400 border-white/[0.08]'
            }`}
          >
            {currentWickiMode === 'always' ? 'Always' : currentWickiMode === 'fade' ? 'Fade Out' : 'Off'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onSetWickiMode('off')}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentWickiMode === 'off'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            <span>Off</span>
          </button>
          <button
            type="button"
            onClick={() => onSetWickiMode('fade')}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentWickiMode === 'fade'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Fade</span>
          </button>
          <button
            type="button"
            onClick={() => onSetWickiMode('always')}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentWickiMode === 'always'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Always</span>
          </button>
        </div>
      </div>

      {/* Fade Out Duration */}
      <div className={`flex flex-col gap-1.5 transition-opacity ${currentWickiMode === 'fade' ? 'opacity-100' : 'opacity-60'}`}>
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300">Fade Duration</span>
            <span className="text-[10px] text-zinc-500">Key dissipation speed</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-zinc-800/60 text-cyan-300 border-white/[0.08]">
            {Number.isInteger(wickiFadeDuration) ? `${wickiFadeDuration}s` : `${wickiFadeDuration.toFixed(1)}s`}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[1, 2, 3, 4].map(sec => (
            <button
              key={sec}
              type="button"
              onClick={() => onWickiFadeDurationChange?.(sec)}
              title={`${sec} second${sec > 1 ? 's' : ''} fade out`}
              className={`py-2 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
                Math.abs(wickiFadeDuration - sec) < 0.1
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Key Highlight Mode: Pressed Only vs All Same Notes */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Highlight Mode</span>
            <span className="text-[10px] text-zinc-500">Only pressed key vs all matching notes</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              wickiHighlightOnlyPressed
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 font-semibold'
                : 'bg-zinc-800/60 text-zinc-400 border-white/[0.08]'
            }`}
          >
            {wickiHighlightOnlyPressed ? 'Pressed Only' : 'All Same Notes'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onWickiHighlightOnlyPressedChange?.(true)}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
              wickiHighlightOnlyPressed
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span>Pressed Only</span>
          </button>
          <button
            type="button"
            onClick={() => onWickiHighlightOnlyPressedChange?.(false)}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
              !wickiHighlightOnlyPressed
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>All Same Notes</span>
          </button>
        </div>
      </div>

      {/* Button Text Visibility & Notation Mode */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Button Text</span>
            <span className="text-[10px] text-zinc-500">Key labels &amp; notation style</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              currentTextMode === 'mapping'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 font-semibold'
                : currentTextMode === 'keys' || currentTextMode === 'notes'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                  : currentTextMode === 'simplified'
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20 font-semibold'
                    : 'bg-zinc-800/60 text-zinc-400 border-white/[0.08]'
            }`}
          >
            {currentTextMode === 'mapping'
              ? 'Keyboard Mapping'
              : currentTextMode === 'keys' || currentTextMode === 'notes'
                ? 'Keys'
                : currentTextMode === 'simplified'
                  ? 'Simplified (1 2 3)'
                  : 'Hidden'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => handleModeChange('mapping')}
            title="Display computer keyboard mapping keys (e.g. Q, W, E)"
            className={`py-2 px-1 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentTextMode === 'mapping'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 shrink-0" />
            <span>Mapping</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('keys')}
            title="Display musical note names / keys (e.g. C4, D#4)"
            className={`py-2 px-1 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentTextMode === 'keys' || currentTextMode === 'notes'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <Type className="w-3.5 h-3.5 shrink-0" />
            <span>Keys</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('simplified')}
            title="Display simplified numbered musical notation with octave dots (Jianpu 1 2 3)"
            className={`py-2 px-1 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentTextMode === 'simplified'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span>Simplified</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('off')}
            title="Hide all button text"
            className={`py-2 px-1 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer ${
              currentTextMode === 'off'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Reset Key Bindings */}
      <button
        type="button"
        onClick={onResetKeysClick}
        title={`Reset keys to default ${layoutType === '8x12' ? '8x12' : layoutType === '9x18' ? '9x18' : layoutType === '6x4' ? '6x4' : '6x12'} layout`}
        className={`w-full py-2.5 px-3 rounded-xl text-[11px] font-medium border transition-all flex items-center justify-center gap-2 cursor-pointer ${
          resetKeysSuccess
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'text-zinc-300 hover:text-zinc-100 bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.06] hover:border-white/15'
        }`}
      >
        {resetKeysSuccess ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Keys Reset!</span>
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4 text-zinc-400" />
            <span>Reset Key Bindings</span>
          </>
        )}
      </button>
    </div>
  );
});

WickiSettingsTab.displayName = 'WickiSettingsTab';
