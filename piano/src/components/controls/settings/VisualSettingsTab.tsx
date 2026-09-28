'use client';

import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Upload,
  Trash2,
  Link as LinkIcon,
  Loader2,
  Check,
  ChevronDown,
  PanelTop,
  PanelRight,
} from 'lucide-react';
import { FpsBadge } from '../badges/FpsBadge';
import { SoundInstrument, BackgroundFit, HudPosition, ColorMode } from '@/lib/settings';
import { compressImageFile, saveCustomBackgroundToDB, removeCustomBackgroundFromDB } from '@/lib/backgroundStorage';

export interface VisualSettingsTabProps {
  soundInstrument?: SoundInstrument;
  targetFps?: 72 | 144;
  onTargetFpsChange?: (fps: 72 | 144) => void;
  onToggleTargetFps?: () => void;
  fallSpeed: number;
  onFallSpeedChange: (speed: number) => void;
  showNoteBlocks?: boolean;
  onToggleNoteBlocks?: () => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  // Background Image Customization
  backgroundImage?: string;
  onBackgroundImageChange?: (img: string) => void;
  backgroundOpacity?: number;
  onBackgroundOpacityChange?: (opacity: number) => void;
  backgroundBlur?: number;
  onBackgroundBlurChange?: (blur: number) => void;
  backgroundFit?: BackgroundFit;
  onBackgroundFitChange?: (fit: BackgroundFit) => void;
  pianoRetracted?: boolean;
  onPianoRetractedChange?: (retracted: boolean) => void;
  onTogglePianoRetracted?: () => void;
  hudPosition?: HudPosition;
  onHudPositionChange?: (position: HudPosition) => void;
}

export const VisualSettingsTab: React.FC<VisualSettingsTabProps> = React.memo(({
  soundInstrument = 'salamander',
  targetFps = 72,
  onTargetFpsChange,
  onToggleTargetFps,
  fallSpeed,
  onFallSpeedChange,
  showNoteBlocks = true,
  onToggleNoteBlocks,
  colorMode,
  onColorModeChange,
  backgroundImage = '',
  onBackgroundImageChange,
  backgroundOpacity = 0.8,
  onBackgroundOpacityChange,
  backgroundBlur = 0,
  onBackgroundBlurChange,
  backgroundFit = 'cover',
  onBackgroundFitChange,
  pianoRetracted = false,
  onPianoRetractedChange,
  onTogglePianoRetracted,
  hudPosition = 'top',
  onHudPositionChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const dataUrl = await compressImageFile(file);
      await saveCustomBackgroundToDB(dataUrl);
      onBackgroundImageChange?.(dataUrl);
    } catch (err) {
      console.error('Failed to load image file:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
  };

  const handleApplyUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setIsUploading(true);
    try {
      await saveCustomBackgroundToDB(trimmed);
      onBackgroundImageChange?.(trimmed);
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      console.error('Failed to apply image URL:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await removeCustomBackgroundFromDB();
      onBackgroundImageChange?.('');
    } catch (err) {
      console.error('Failed to remove background:', err);
      onBackgroundImageChange?.('');
    }
  };

  const hasBackground = Boolean(backgroundImage);

  return (
    <div className="flex flex-col gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
      <span className="font-medium text-zinc-200 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> Visuals &amp; Speed
      </span>

      {/* Visualizer Refresh Rate & Live FPS */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Visualizer Refresh Rate</span>
            <span className="text-[10px] text-zinc-500">Live performance &amp; frame rate cap</span>
          </div>
          <FpsBadge targetFps={targetFps} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {([72, 144] as const).map(rate => (
            <button
              key={rate}
              onClick={() => (onTargetFpsChange ? onTargetFpsChange(rate) : rate !== targetFps && onToggleTargetFps?.())}
              className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium cursor-pointer ${targetFps === rate
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/35 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                }`}
            >
              {rate} Hz
            </button>
          ))}
        </div>
      </div>

      {/* Note Fall Speed */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-zinc-300">
          <span className="text-zinc-400">Note Fall Speed</span>
          <span className="font-mono text-zinc-200">{fallSpeed} px/s</span>
        </div>
        <input
          type="range"
          min={120}
          max={480}
          step={20}
          value={fallSpeed}
          onChange={e => onFallSpeedChange(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[180, 240, 300, 360, 420].map(spd => (
            <button
              key={spd}
              type="button"
              onClick={() => onFallSpeedChange(spd)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${fallSpeed === spd
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                }`}
            >
              {spd}
            </button>
          ))}
        </div>
      </div>

      {/* Note Blocks Visibility */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Falling Note Blocks</span>
            <span className="text-[10px] text-zinc-500">Synthesia waterfall animation</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${showNoteBlocks
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                : 'bg-zinc-800/60 text-zinc-400 border-white/[0.08]'
              }`}
          >
            {showNoteBlocks ? 'Visible' : 'Hidden'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => !showNoteBlocks && onToggleNoteBlocks?.()}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${showNoteBlocks
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Show</span>
          </button>
          <button
            type="button"
            onClick={() => showNoteBlocks && onToggleNoteBlocks?.()}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${!showNoteBlocks
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {/* Color Mode */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <span className="text-zinc-300 font-medium">Color Palette</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-zinc-800/60 text-cyan-300 border-white/[0.08]">
            {colorMode === 'track' ? 'Track Colors' : colorMode === 'gradient' ? 'Pitch Gradient' : 'White Outline'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onColorModeChange('track')}
            className={`py-2 px-1.5 rounded-lg text-center transition-all text-[11px] font-medium cursor-pointer ${colorMode === 'track'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            Track Colors
          </button>
          <button
            type="button"
            onClick={() => onColorModeChange('gradient')}
            className={`py-2 px-1.5 rounded-lg text-center transition-all text-[11px] font-medium cursor-pointer ${colorMode === 'gradient'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            Pitch Gradient
          </button>
          <button
            type="button"
            onClick={() => onColorModeChange('outline')}
            className={`py-2 px-1.5 rounded-lg text-center transition-all text-[11px] font-medium cursor-pointer ${colorMode === 'outline'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            White Outline
          </button>
        </div>
      </div>


      {/* Piano Keyboard Strip Retraction */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Piano Keyboard Strip</span>
            <span className="text-[10px] text-zinc-500">Retract keys to expand visualizer &amp; Wicki board</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${!pianoRetracted
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-semibold'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold'
              }`}
          >
            {pianoRetracted ? 'Retracted' : 'Visible'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onPianoRetractedChange ? onPianoRetractedChange(false) : pianoRetracted && onTogglePianoRetracted?.()}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${!pianoRetracted
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visible</span>
          </button>
          <button
            type="button"
            onClick={() => onPianoRetractedChange ? onPianoRetractedChange(true) : !pianoRetracted && onTogglePianoRetracted?.()}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${pianoRetracted
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Retract</span>
          </button>
        </div>
      </div>

      {/* Control Bar Position (Top or Right Sidebar) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Control Bar Position</span>
            <span className="text-[10px] text-zinc-500">Display navigation along the top or right side</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              hudPosition === 'right'
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-semibold'
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-semibold'
            }`}
          >
            {hudPosition === 'right' ? 'Right Side' : 'Top'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onHudPositionChange?.('top')}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
              hudPosition === 'top'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <PanelTop className="w-3.5 h-3.5" />
            <span>Top</span>
          </button>
          <button
            type="button"
            onClick={() => onHudPositionChange?.('right')}
            className={`py-2 px-2 rounded-lg text-center transition-all text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
              hudPosition === 'right'
                ? 'bg-purple-500/20 text-purple-200 border border-purple-500/35 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span>Right Side</span>
          </button>
        </div>
      </div>

      {/* Background Wallpaper Section */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Background Image
            </span>
            <span className="text-[10px] text-zinc-500">Custom image behind falling notes</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${hasBackground
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-semibold'
                : 'bg-zinc-800/60 text-zinc-400 border-white/[0.08]'
              }`}
          >
            {hasBackground ? 'Custom Image' : 'Default Dark'}
          </span>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Image Status & Actions */}
        {hasBackground ? (
          <div className="flex flex-col gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center gap-3">
              {/* Thumbnail Preview */}
              <div
                className="w-20 h-14 rounded-lg border border-white/20 bg-cover bg-center shrink-0 shadow-inner relative overflow-hidden group"
                style={{ backgroundImage: `url(${backgroundImage})` }}
              >
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-400 drop-shadow" />
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-300 font-medium truncate">
                    Custom Wallpaper Active
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1 px-2 rounded-lg text-[10px] font-medium bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition flex items-center gap-1 cursor-pointer border border-white/[0.08]"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3 text-cyan-400" />
                    )}
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
                    className="py-1 px-2 rounded-lg text-[10px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition flex items-center gap-1 cursor-pointer border border-rose-500/25"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Fitting Mode: Cover vs Contain */}
            <div className="flex flex-col gap-1 pt-2 border-t border-white/[0.06]">
              <div className="flex justify-between items-center text-zinc-300 text-[11px]">
                <span className="text-zinc-400">Fitting Style</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-cyan-300 border border-white/[0.08]">
                  {backgroundFit === 'contain' ? 'Fit (Contain)' : 'Fill (Cover)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-white/[0.02] p-0.5 rounded-lg border border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => onBackgroundFitChange?.('cover')}
                  className={`py-1 rounded text-center text-[10px] font-medium transition-all cursor-pointer ${backgroundFit === 'cover'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                >
                  Fill (Cover)
                </button>
                <button
                  type="button"
                  onClick={() => onBackgroundFitChange?.('contain')}
                  className={`py-1 rounded text-center text-[10px] font-medium transition-all cursor-pointer ${backgroundFit === 'contain'
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                >
                  Fit (Contain)
                </button>
              </div>
            </div>

            {/* Background Dim / Opacity Slider */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-white/[0.06]">
              <div className="flex justify-between text-zinc-300 text-[11px]">
                <span className="text-zinc-400">Dimming / Opacity</span>
                <span className="font-mono text-zinc-200">{Math.round(backgroundOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={backgroundOpacity}
                onChange={e => onBackgroundOpacityChange?.(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1 bg-white/[0.02] p-0.5 rounded-lg border border-white/[0.04]">
                {[0.25, 0.5, 0.75, 1.0].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onBackgroundOpacityChange?.(val)}
                    className={`py-1 rounded text-center font-mono text-[9px] transition-all cursor-pointer ${Math.abs(backgroundOpacity - val) < 0.03
                        ? 'bg-white/[0.12] text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                  >
                    {Math.round(val * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Background Blur Slider */}
            <div className="flex flex-col gap-1 pt-1.5 border-t border-white/[0.06]">
              <div className="flex justify-between text-zinc-300 text-[11px]">
                <span className="text-zinc-400">Ambient Blur</span>
                <span className="font-mono text-zinc-200">{backgroundBlur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={backgroundBlur}
                onChange={e => onBackgroundBlurChange?.(parseInt(e.target.value, 10))}
                className="w-full cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1 bg-white/[0.02] p-0.5 rounded-lg border border-white/[0.04]">
                {[0, 4, 8, 16].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onBackgroundBlurChange?.(val)}
                    className={`py-1 rounded text-center font-mono text-[9px] transition-all cursor-pointer ${backgroundBlur === val
                        ? 'bg-white/[0.12] text-white font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                      }`}
                  >
                    {val === 0 ? 'Off' : `${val}px`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Upload / Select Controls when no background is active */
          <div className="flex flex-col gap-2">
            {/* Drag & Drop or Click to Upload Area */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${isDragOver
                  ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                  : 'border-white/[0.12] hover:border-white/[0.25] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </div>
              <div className="text-center">
                <span className="text-[11px] font-medium text-zinc-200 block">
                  {isUploading ? 'Processing image...' : 'Upload Background Image'}
                </span>
                <span className="text-[9px] text-zinc-500 block mt-0.5">
                  Click or drag &amp; drop (PNG, JPG, WebP, GIF)
                </span>
              </div>
            </div>

            {/* URL Input Accordion Toggle */}
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5 cursor-pointer py-1 self-start"
              >
                <LinkIcon className="w-3 h-3 text-zinc-500" />
                <span>{showUrlInput ? 'Hide URL input' : 'Or paste an image web link'}</span>
              </button>

              {showUrlInput && (
                <div className="flex gap-1.5 items-center animate-in fade-in duration-150">
                  <input
                    type="url"
                    placeholder="https://example.com/wallpaper.jpg"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyUrl()}
                    className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    disabled={!urlInput.trim() || isUploading}
                    className="px-3 py-1.5 bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-200 text-[11px] font-medium rounded-lg transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

VisualSettingsTab.displayName = 'VisualSettingsTab';
