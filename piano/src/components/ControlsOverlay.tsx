'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Play,
  Pause,
  Trash2,
  Image as ImageIcon,
  X,
  Loader2,
  Settings,
  Minus,
  Plus,
} from 'lucide-react';
import { TimelineScrubber } from './controls/TimelineScrubber';

interface ControlsOverlayProps {
  isSongActive: boolean;
  isPlaying: boolean;
  leftSustain: boolean;
  rightSustain: boolean;
  hasBackground: boolean;
  isSamplerLoaded: boolean;
  renderNoteBlocks: boolean;
  fadeJankoMode: boolean;
  touchscreenMode: boolean;
  leftNoteColor: string;
  rightNoteColor: string;
  jankoBoardColor: string;
  jankoTranspose: number;
  midiTranspose: number;
  midiInputTranspose: number;
  onMidiFileSelected: (file: File) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onClearSong: () => void;
  onToggleLeftSustain: () => void;
  onToggleRightSustain: () => void;
  onBackgroundSelected: (file: File) => void;
  onClearBackground: () => void;
  onToggleNoteBlocks: () => void;
  onToggleFadeJankoMode: () => void;
  onEnableTouchscreenMode: () => void;
  onLeftNoteColorChange: (color: string) => void;
  onRightNoteColorChange: (color: string) => void;
  onJankoBoardColorChange: (color: string) => void;
  onJankoTransposeChange: (semitones: number) => void;
  onMidiTransposeChange: (semitones: number) => void;
  onMidiInputTransposeChange: (semitones: number) => void;
}

interface TransposeRowProps {
  label: string;
  value: number;
  onChange: (semitones: number) => void;
  downLabel: string;
  upLabel: string;
  resetTitle: string;
}

const TransposeRow: React.FC<TransposeRowProps> = ({
  label,
  value,
  onChange,
  downLabel,
  upLabel,
  resetTitle,
}) => (
  <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
    <span className="text-xs font-medium text-white">{label}</span>
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= -24}
        title={downLabel}
        aria-label={downLabel}
        className="p-1 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange(0)}
        disabled={value === 0}
        title={value === 0 ? 'No transpose' : resetTitle}
        className={`min-w-8 px-1.5 py-0.5 rounded-md text-xs font-mono text-center transition-colors ${
          value === 0
            ? 'text-zinc-400 cursor-default'
            : 'text-white bg-white/10 hover:bg-white/20 cursor-pointer'
        }`}
      >
        {value > 0 ? `+${value}` : value}
      </button>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 24}
        title={upLabel}
        aria-label={upLabel}
        className="p-1 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  isSongActive,
  isPlaying,
  leftSustain,
  rightSustain,
  hasBackground,
  isSamplerLoaded,
  renderNoteBlocks,
  fadeJankoMode,
  touchscreenMode,
  leftNoteColor,
  rightNoteColor,
  jankoBoardColor,
  jankoTranspose,
  midiTranspose,
  midiInputTranspose,
  onMidiFileSelected,
  onTogglePlay,
  onSeek,
  onClearSong,
  onToggleLeftSustain,
  onToggleRightSustain,
  onBackgroundSelected,
  onClearBackground,
  onToggleNoteBlocks,
  onToggleFadeJankoMode,
  onEnableTouchscreenMode,
  onLeftNoteColorChange,
  onRightNoteColorChange,
  onJankoBoardColorChange,
  onJankoTransposeChange,
  onMidiTransposeChange,
  onMidiInputTransposeChange,
}) => {
  const midiInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  return (
    <div
      ref={settingsRef}
      className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 select-none"
    >
      {/* Hidden File Inputs */}
      <input
        ref={midiInputRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onMidiFileSelected(file);
          e.target.value = '';
        }}
      />
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onBackgroundSelected(file);
          e.target.value = '';
        }}
      />

      {/* Primary Top Bar */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-950/75 backdrop-blur-md border border-white/10 shadow-xl">
        {/* L / Settings / R Sustain Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleLeftSustain}
            title="Toggle Left Board Sustain (1)"
            aria-label="Toggle Left Board Sustain"
            aria-pressed={leftSustain}
            style={leftSustain ? { backgroundColor: leftNoteColor } : undefined}
            className={`w-5 h-5 rounded-full transition-colors cursor-pointer ${
              leftSustain ? '' : 'bg-zinc-700/60 hover:bg-zinc-600'
            }`}
          />

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            title="Settings"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isSettingsOpen
                ? 'bg-white/15 text-white'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleRightSustain}
            title="Toggle Right Board Sustain (\)"
            aria-label="Toggle Right Board Sustain"
            aria-pressed={rightSustain}
            style={rightSustain ? { backgroundColor: rightNoteColor } : undefined}
            className={`w-5 h-5 rounded-full transition-colors cursor-pointer ${
              rightSustain ? '' : 'bg-zinc-700/60 hover:bg-zinc-600'
            }`}
          />
        </div>

        {!isSamplerLoaded && (
          <div
            title="Loading piano samples..."
            className="p-1.5 text-zinc-400 flex items-center justify-center"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        )}
      </div>

      {/* Second Row: Song Transport & Timeline */}
      {isSongActive && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-950/75 backdrop-blur-md border border-white/10 shadow-xl">
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <div className="w-40 sm:w-56 px-1">
            <TimelineScrubber isSongActive={isSongActive} onSeek={onSeek} />
          </div>

          <button
            type="button"
            onClick={onClearSong}
            title="Clear song"
            className="p-1.5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Centered Settings Popover (automatically sits below second row when a song is loaded) */}
      {isSettingsOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 rounded-2xl bg-zinc-950/95 backdrop-blur-md border border-white/10 shadow-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Render Note Blocks</span>
            <button
              type="button"
              role="switch"
              aria-checked={renderNoteBlocks}
              onClick={onToggleNoteBlocks}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                renderNoteBlocks ? 'bg-white' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                  renderNoteBlocks ? 'translate-x-4.5 bg-black' : 'translate-x-1 bg-zinc-300'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Fade Jankó Keys</span>
            <button
              type="button"
              role="switch"
              aria-checked={fadeJankoMode}
              onClick={onToggleFadeJankoMode}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                fadeJankoMode ? 'bg-white' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                  fadeJankoMode ? 'translate-x-4.5 bg-black' : 'translate-x-1 bg-zinc-300'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Touchscreen Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={touchscreenMode}
              onClick={onEnableTouchscreenMode}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                touchscreenMode ? 'bg-white' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                  touchscreenMode ? 'translate-x-4.5 bg-black' : 'translate-x-1 bg-zinc-300'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Note Colors</span>
            <div className="flex items-center gap-2 shrink-0">
              <label
                title="Left note block color"
                className="flex items-center gap-1 cursor-pointer"
              >
                <span className="text-[10px] font-mono text-zinc-400">L</span>
                <input
                  type="color"
                  value={leftNoteColor}
                  onChange={(e) => onLeftNoteColorChange(e.target.value)}
                  aria-label="Left note block color"
                  className="w-6 h-6 rounded-full border border-white/20 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                />
              </label>
              <label
                title="Right note block color"
                className="flex items-center gap-1 cursor-pointer"
              >
                <span className="text-[10px] font-mono text-zinc-400">R</span>
                <input
                  type="color"
                  value={rightNoteColor}
                  onChange={(e) => onRightNoteColorChange(e.target.value)}
                  aria-label="Right note block color"
                  className="w-6 h-6 rounded-full border border-white/20 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Jankó Board Color</span>
            <input
              type="color"
              value={jankoBoardColor}
              onChange={(e) => onJankoBoardColorChange(e.target.value)}
              aria-label="Jankó board color"
              title="Jankó board color"
              className="w-6 h-6 rounded-full border border-white/20 bg-transparent cursor-pointer p-0 shrink-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
            />
          </div>

          <TransposeRow
            label="MIDI Transpose"
            value={midiTranspose}
            onChange={onMidiTransposeChange}
            downLabel="Transpose down 1 semitone"
            upLabel="Transpose up 1 semitone"
            resetTitle="Reset transpose to 0"
          />

          <TransposeRow
            label="Input Transpose"
            value={midiInputTranspose}
            onChange={onMidiInputTransposeChange}
            downLabel="Transpose MIDI inputs down 1 semitone"
            upLabel="Transpose MIDI inputs up 1 semitone"
            resetTitle="Reset input transpose to 0"
          />

          <TransposeRow
            label="Jankó Transpose"
            value={jankoTranspose}
            onChange={onJankoTransposeChange}
            downLabel="Transpose Jankó board down 1 semitone"
            upLabel="Transpose Jankó board up 1 semitone"
            resetTitle="Reset Jankó board transpose to 0"
          />

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">MIDI File</span>
            <button
              type="button"
              onClick={() => midiInputRef.current?.click()}
              title="Load MIDI file"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>

          <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-white">Background</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                title="Set custom background image"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {hasBackground ? 'Change' : 'Set'}
              </button>
              {hasBackground && (
                <button
                  type="button"
                  onClick={onClearBackground}
                  title="Remove custom background"
                  aria-label="Remove custom background"
                  className="p-1.5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
