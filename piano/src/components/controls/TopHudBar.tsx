'use client';

import React from 'react';
import {
  Upload,
  Metronome,
  Maximize,
  Minimize,
  Play,
  Pause,
  Trash2,
  Eye,
  EyeOff,
  Keyboard,
  Sliders,
  Pin,
  PinOff,
  Piano,
} from 'lucide-react';
import { SustainMode, WickiBoardMode, ColorMode } from '@/lib/settings';
import { TimelineScrubber } from './TimelineScrubber';
import { SustainButton } from './SustainButton';

export interface TopHudBarProps {
  isSongActive: boolean;
  isPlaying: boolean;
  isMobile: boolean;
  isPinned?: boolean;
  showNoteBlocks?: boolean;
  pianoRetracted?: boolean;
  onTogglePianoRetracted?: () => void;
  showSustainButton?: boolean;
  sustainPedal: SustainMode;
  isMousePedalMode?: boolean;
  isMousePedalPressed?: boolean;
  colorMode: ColorMode;
  currentWickiMode: WickiBoardMode;
  metronomeActive: boolean;
  metronomeBpm: number;
  metronomeSound?: boolean;
  isFlashing: boolean;
  showMetronome: boolean;
  showSettings: boolean;
  isFullscreen: boolean;
  seekSeconds?: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilePicked: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMetronome: () => void;
  onToggleFullscreen: () => void;
  onColorModeChange: (mode: ColorMode) => void;
  onToggleSustain: () => void;
  onEnterMousePedalMode?: () => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onClearSong?: () => void;
  onStop?: () => void;
  onToggleNoteBlocks?: () => void;
  onCycleWickiMode: () => void;
  onToggleSettings: () => void;
  onTogglePin?: () => void;
  hudPosition?: 'top' | 'right';
  isRecording?: boolean;
  recordingDuration?: number;
  onToggleRecord?: () => void;
}


export const TopHudBar: React.FC<TopHudBarProps> = React.memo(({
  isSongActive,
  isPlaying,
  isMobile,
  isPinned = true,
  showNoteBlocks = true,
  pianoRetracted = false,
  onTogglePianoRetracted,
  showSustainButton = true,
  sustainPedal,
  isMousePedalMode = false,
  isMousePedalPressed = false,
  colorMode,
  currentWickiMode,
  metronomeActive,
  metronomeBpm,
  metronomeSound = true,
  isFlashing,
  showMetronome,
  showSettings,
  isFullscreen,
  seekSeconds = 5,
  fileInputRef,
  onFilePicked,
  onToggleMetronome,
  onToggleFullscreen,
  onColorModeChange,
  onToggleSustain,
  onEnterMousePedalMode,
  onTogglePlay,
  onSeek,
  onClearSong,
  onStop,
  onToggleNoteBlocks,
  onCycleWickiMode,
  onToggleSettings,
  onTogglePin,
  hudPosition = 'top',
  isRecording = false,
  recordingDuration = 0,
  onToggleRecord,
}) => {
  if (hudPosition === 'right') {
    return (
      <div
        className="w-11 py-2 px-1 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl pointer-events-auto flex flex-col items-center gap-1 max-h-[calc(100vh-24px)] overflow-y-auto no-scrollbar transition-all duration-200"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFilePicked}
          accept=".mid,.midi"
          className="hidden"
        />

        {/* Top Controls: Settings, Pin, Fullscreen, Color Mode */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {/* Settings / FX Toggle */}
          <button
            onClick={onToggleSettings}
            title="Audio & Visual Settings"
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              showSettings
                ? 'bg-white/[0.15] text-white border-white/[0.15]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Pin / Auto-Hide Sidebar Toggle */}
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Pin Sidebar (Currently Pinned - click to Auto-Hide)' : 'Pin Sidebar (Currently Auto-Hide - click to Pin)'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              isPinned
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 ${
              isFullscreen
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Sustain Button */}
          {showSustainButton && (
            <SustainButton
              sustainPedal={sustainPedal}
              isMousePedalMode={isMousePedalMode}
              isMousePedalPressed={isMousePedalPressed}
              isMobileTopBar={true}
              onToggleSustain={onToggleSustain}
              onEnterMousePedalMode={onEnterMousePedalMode}
            />
          )}
        </div>

        {/* Divider */}
        <div className="w-5 border-t border-white/[0.08] my-0.5 shrink-0" />

        {/* Middle Group: Playback Controls (when song loaded) */}
        {isSongActive && (
          <div className="flex flex-col items-center gap-1 shrink-0 animate-in fade-in duration-150">
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              disabled={!isSongActive}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-25 disabled:pointer-events-none ${
                isPlaying
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
              }`}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            {/* Vertical Timeline Progress Bar */}
            <TimelineScrubber orientation="vertical" isSongActive={isSongActive} onSeek={onSeek} seekSeconds={seekSeconds} />

            {/* Clear Song */}
            <button
              onClick={onClearSong || onStop}
              disabled={!isSongActive}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
              title="Clear Loaded MIDI File"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Divider */}
            <div className="w-5 border-t border-white/[0.08] my-0.5 shrink-0" />
          </div>
        )}

        {/* Bottom Group: Visual & Performance Tools */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {/* Note Blocks Toggle */}
          <button
            onClick={onToggleNoteBlocks}
            title={showNoteBlocks ? 'Note Blocks: ON (click to hide)' : 'Note Blocks: OFF (click to show)'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              showNoteBlocks
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {showNoteBlocks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Retract Piano Toggle */}
          <button
            onClick={onTogglePianoRetracted}
            title={!pianoRetracted ? 'Piano: Visible (click to retract)' : 'Piano: Retracted (click to show)'}
            aria-label={!pianoRetracted ? 'Retract piano keyboard' : 'Show piano keyboard'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              !pianoRetracted
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Piano className="w-3.5 h-3.5" />
          </button>

          {/* Wicki Board Toggle */}
          <button
            onClick={onCycleWickiMode}
            title={
              currentWickiMode === 'off'
                ? 'Wicki Board: Hidden'
                : currentWickiMode === 'fade'
                  ? 'Wicki Board: Reactive Fade'
                  : 'Wicki Board: Always Visible'
            }
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              currentWickiMode !== 'off'
                ? 'bg-white/[0.15] text-white border-white/[0.15]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Metronome */}
          <button
            onClick={onToggleMetronome}
            title={
              metronomeActive
                ? `Metronome: ${metronomeBpm} BPM (${metronomeSound ? 'Sound On' : 'Silent'} - Click to edit)`
                : `Metronome: ${metronomeBpm} BPM (Off - Click to open)`
            }
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 relative ${
              isFlashing
                ? 'bg-sky-400 text-zinc-950 border-sky-300 scale-105 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                : metronomeActive
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                  : showMetronome
                    ? 'bg-white/[0.12] text-zinc-200 border-white/[0.15]'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Metronome className="w-3.5 h-3.5" />
          </button>

          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload .mid / .midi file"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* Record Inputs Button */}
          <button
            onClick={onToggleRecord}
            title={isRecording ? 'Stop Recording' : 'Record Inputs (MIDI, Keyboard, Touch)'}
            aria-label={isRecording ? 'Stop Recording' : 'Record Inputs'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 relative ${
              isRecording
                ? 'bg-white/[0.18] text-white border-white/[0.25] shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full bg-white transition-all ${
                isRecording
                  ? 'animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.9)]'
                  : 'shadow-[0_0_5px_rgba(255,255,255,0.4)]'
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-zinc-950/75 backdrop-blur-xl border border-white/[0.08] pointer-events-auto transition-all duration-200 ${
        isSongActive
          ? isMobile
            ? 'flex flex-col gap-1.5 p-2 sm:p-2.5 rounded-2xl'
            : 'flex flex-col md:flex-row items-stretch md:items-center justify-between gap-1.5 md:gap-2.5 p-2 sm:p-2.5 md:px-3 md:py-1.5 rounded-2xl'
          : 'flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-2xl'
      }`}
    >
      {/* Row 1: Left Actions + (Desktop Center Playback Controls) + Right Actions */}
      <div className="w-full flex items-center justify-between gap-2 min-w-0">
        {/* Left: Upload Button, Record Button, Metronome Button, Fullscreen Button, Mobile Mode & Color Palette */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFilePicked}
            accept=".mid,.midi"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload .mid / .midi file"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* Record Inputs Button */}
          <button
            onClick={onToggleRecord}
            title={isRecording ? 'Stop Recording' : 'Record Performance (MIDI & Keyboard inputs)'}
            aria-label={isRecording ? 'Stop Recording' : 'Record Performance'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 ${
              isRecording
                ? 'bg-white/[0.18] text-white border-white/[0.25] shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full bg-white transition-all ${
                isRecording
                  ? 'animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.9)]'
                  : 'shadow-[0_0_5px_rgba(255,255,255,0.4)]'
              }`}
            />
          </button>

          {/* Metronome Button (Same style as Pin button, icon only, click to set tempo & sound) */}
          <button
            onClick={onToggleMetronome}
            title={
              metronomeActive
                ? `Metronome: ${metronomeBpm} BPM (${metronomeSound ? 'Sound On' : 'Silent'} - Click to edit)`
                : `Metronome: ${metronomeBpm} BPM (Off - Click to open)`
            }
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 relative ${
              isFlashing
                ? 'bg-sky-400 text-zinc-950 border-sky-300 scale-105 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                : metronomeActive
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                  : showMetronome
                    ? 'bg-white/[0.12] text-zinc-200 border-white/[0.15]'
                    : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Metronome className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-75 cursor-pointer active:scale-95 shrink-0 ${
              isFullscreen
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Sustain Button */}
          {showSustainButton && (
            <SustainButton
              sustainPedal={sustainPedal}
              isMousePedalMode={isMousePedalMode}
              isMousePedalPressed={isMousePedalPressed}
              isMobileTopBar={true}
              onToggleSustain={onToggleSustain}
              onEnterMousePedalMode={onEnterMousePedalMode}
            />
          )}
        </div>

        {/* Desktop Center: Playback Controls (Visible only on desktop screens when NOT in mobile mode) */}
        {isSongActive && (
          <div className={`items-center gap-2 flex-1 justify-center max-w-lg mx-2 min-w-0 ${isMobile ? 'hidden' : 'hidden md:flex'}`}>
            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              disabled={!isSongActive}
              suppressHydrationWarning
              className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-25 disabled:pointer-events-none ${
                isPlaying
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
              }`}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            {/* Isolated Timeline Scrubber & Timestamp */}
            <TimelineScrubber isSongActive={isSongActive} onSeek={onSeek} seekSeconds={seekSeconds} />

            {/* Clear Loaded MIDI Button */}
            <button
              onClick={onClearSong || onStop}
              disabled={!isSongActive}
              suppressHydrationWarning
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
              title="Clear Loaded MIDI File"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right: Actions, Status & Popovers */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Note Block Visuals Toggle */}
          <button
            onClick={onToggleNoteBlocks}
            title={showNoteBlocks ? 'Note Block Visuals (Currently ON - click to Hide)' : 'Note Block Visuals (Currently OFF - click to Show)'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              showNoteBlocks
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {showNoteBlocks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Retract Piano Toggle */}
          <button
            onClick={onTogglePianoRetracted}
            title={!pianoRetracted ? 'Retract Piano (Currently Visible - click to Retract)' : 'Retract Piano (Currently Retracted - click to Show)'}
            aria-label={!pianoRetracted ? 'Retract piano keyboard' : 'Show piano keyboard'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              !pianoRetracted
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-500 hover:text-zinc-300 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Piano className="w-3.5 h-3.5" />
          </button>

          {/* QWERTY Keyboard Guide Toggle (Wicki Board) */}
          <button
            onClick={onCycleWickiMode}
            title={
              currentWickiMode === 'off'
                ? 'Wicki Board: Hidden (Click for Reactive Fade)'
                : currentWickiMode === 'fade'
                  ? 'Wicki Board: Reactive Fade (Click for Always Visible)'
                  : 'Wicki Board: Always Visible (Click to Hide)'
            }
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              currentWickiMode !== 'off'
                ? 'bg-white/[0.15] text-white border-white/[0.15]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* Settings / FX Toggle */}
          <button
            onClick={onToggleSettings}
            title="Audio & Visual Settings"
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              showSettings
                ? 'bg-white/[0.15] text-white border-white/[0.15]'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Pin / Auto-Hide Top Panel Toggle */}
          <button
            onClick={onTogglePin}
            title={isPinned ? 'Pin Top Panel (Currently Pinned - click to Auto-Hide)' : 'Pin Top Panel (Currently Auto-Hide - click to Pin)'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 ${
              isPinned
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Mobile Second Row: Playback Controls (Visible in mobile mode OR on screens < 768px when MIDI song is loaded) */}
      {isSongActive && (
        <div
          className={`w-full items-center gap-2 pt-2 border-t border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-150 ${
            isMobile ? 'flex' : 'flex md:hidden'
          }`}
        >
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            disabled={!isSongActive}
            suppressHydrationWarning
            className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-25 disabled:pointer-events-none ${
              isPlaying
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/25'
                : 'bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border-white/[0.06] hover:bg-white/[0.06]'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Isolated Timeline Scrubber & Timestamp */}
          <TimelineScrubber isSongActive={isSongActive} onSeek={onSeek} seekSeconds={seekSeconds} />

          {/* Clear Loaded MIDI Button */}
          <button
            onClick={onClearSong || onStop}
            disabled={!isSongActive}
            suppressHydrationWarning
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 active:scale-95 disabled:opacity-25 disabled:pointer-events-none"
            title="Clear Loaded MIDI File"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
});

TopHudBar.displayName = 'TopHudBar';
