'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sliders,
  X,
  RotateCcw,
  Check,
  SlidersHorizontal,
  Volume2,
  Keyboard,
  Sparkles,
  Music,
  Command,
} from 'lucide-react';
import { AudioSettingsTab, AudioSettingsTabProps } from './AudioSettingsTab';
import { WickiSettingsTab, WickiSettingsTabProps } from './WickiSettingsTab';
import { VisualSettingsTab, VisualSettingsTabProps } from './VisualSettingsTab';
import { SongSettingsTab, SongSettingsTabProps } from './SongSettingsTab';
import { HotkeysSettingsTab, HotkeysSettingsTabProps } from './HotkeysSettingsTab';

export type SettingsTabType = 'all' | 'audio' | 'wicki' | 'hotkeys' | 'visuals' | 'song';

export interface SettingsModalProps
  extends AudioSettingsTabProps,
  WickiSettingsTabProps,
  VisualSettingsTabProps,
  SongSettingsTabProps,
  HotkeysSettingsTabProps {
  showSettings: boolean;
  onClose: () => void;
  isMobile: boolean;
  onResetSettings?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = React.memo((props) => {
  const {
    showSettings,
    onClose,
    isMobile,
    onResetSettings,
    // Audio props
    soundInstrument,
    onSoundInstrumentChange,
    stringAttack,
    onStringAttackChange,
    stringRelease,
    onStringReleaseChange,
    volume,
    isMuted,
    onVolumeChange,
    onToggleMute,
    keyboardVolume,
    isKeyboardMuted,
    onKeyboardVolumeChange,
    onToggleKeyboardMute,
    midiInputVolume,
    isMidiInputMuted,
    onMidiInputVolumeChange,
    onToggleMidiInputMute,
    reverbWet,
    onReverbWetChange,
    lowPassFilterActive,
    onLowPassFilterActiveChange,
    lowPassCutoff,
    onLowPassCutoffChange,
    // Wicki props
    layoutType,
    currentWickiMode,
    wickiFadeDuration,
    hideWickiText,
    wickiTextMode,
    wickiHighlightOnlyPressed,
    resetKeysSuccess,
    onSwitchToLayout,
    onSetWickiMode,
    onWickiFadeDurationChange,
    onHideWickiTextChange,
    onWickiTextModeChange,
    onWickiHighlightOnlyPressedChange,
    onResetKeysClick,
    // Hotkey props
    hotkeys,
    onHotkeysChange,
    onResetHotkeys,
    // Visual props
    targetFps,
    onTargetFpsChange,
    onToggleTargetFps,
    fallSpeed,
    onFallSpeedChange,
    showNoteBlocks,
    onToggleNoteBlocks,
    colorMode,
    onColorModeChange,
    backgroundImage,
    onBackgroundImageChange,
    backgroundOpacity,
    onBackgroundOpacityChange,
    backgroundBlur,
    onBackgroundBlurChange,
    backgroundFit,
    onBackgroundFitChange,
    pianoRetracted,
    onPianoRetractedChange,
    onTogglePianoRetracted,
    hudPosition,
    onHudPositionChange,
    // Song props
    inputTranspose,
    onInputTransposeChange,
    midiTranspose,
    onMidiTransposeChange,
    speedMultiplier,
    onSpeedMultiplierChange,
    seekSeconds,
    onSeekSecondsChange,
    maxVoices,
    onMaxVoicesChange,
    recordingSession,
    onOpenRecordingModal,
    onDownloadRecording,
  } = props;

  const [settingsTab, setSettingsTab] = useState<SettingsTabType>('all');
  const [resetSuccess, setResetSuccess] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const handleResetSettingsClick = () => {
    onResetSettings?.();
    setResetSuccess(true);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setResetSuccess(false);
    }, 1800);
  };

  if (!showSettings) return null;

  const isRightSidebar = hudPosition === 'right';

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          className={`fixed top-0 bottom-0 left-0 ${isRightSidebar ? 'right-[60px]' : 'right-0'} bg-black/75 backdrop-blur-sm z-[99] pointer-events-auto transition-opacity duration-200`}
        />
      )}
      <div
        className={
          isMobile
            ? `fixed left-0 ${isRightSidebar ? 'right-[60px] border-r' : 'right-0'} bottom-0 max-h-[88dvh] bg-zinc-950/98 backdrop-blur-2xl border-t border-white/[0.15] rounded-t-3xl z-[100] flex flex-col pointer-events-auto shadow-[0_-10px_35px_rgba(0,0,0,0.85)] animate-in slide-in-from-bottom duration-200 overflow-hidden transition-all duration-300 ease-out`
            : `fixed ${
                isRightSidebar
                  ? 'top-2 sm:top-3 right-[64px] sm:right-[72px] max-h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-24px)]'
                  : 'top-[62px] right-3 max-h-[calc(100dvh-80px)]'
              } w-[500px] sm:w-[540px] max-w-[calc(100vw-24px)] ${
                isRightSidebar ? 'sm:max-w-[calc(100vw-84px)]' : 'sm:max-w-[calc(100vw-32px)]'
              } overflow-y-auto bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.12] p-4 sm:p-5 pr-2.5 sm:pr-3.5 rounded-2xl pointer-events-auto flex flex-col gap-4 text-xs shadow-2xl z-[100] animate-in fade-in duration-150 transition-all duration-300 ease-out custom-scrollbar`
        }
      >
        {isMobile && (
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />
        )}

        {/* Header */}
        <div className={`flex items-center justify-between border-b border-white/[0.06] ${isMobile ? 'px-4 py-2.5 shrink-0' : 'pb-2.5'}`}>
          <span className="font-medium text-zinc-200 flex items-center gap-2 text-sm sm:text-xs">
            <Sliders className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-zinc-400" /> Settings &amp; Effects
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetSettingsClick}
              title={resetSuccess ? 'Preferences reset to default!' : 'Reset all preferences to default'}
              className={`p-2 sm:p-1 rounded-lg transition cursor-pointer flex items-center justify-center ${resetSuccess
                ? 'text-emerald-300 bg-emerald-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                }`}
            >
              {resetSuccess ? (
                <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              ) : (
                <RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-0.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Filter Pills (Multi-Row, Unscrollable) */}
        <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${isMobile ? 'px-4 pt-1.5 pb-2 border-b border-white/[0.04]' : 'pb-1'}`}>
          {[
            { id: 'all' as const, label: 'All', icon: SlidersHorizontal },
            { id: 'audio' as const, label: 'Audio & Mix', icon: Volume2 },
            { id: 'wicki' as const, label: 'Wicki & Keys', icon: Keyboard },
            { id: 'hotkeys' as const, label: 'Hotkeys', icon: Command },
            { id: 'visuals' as const, label: 'Visuals & Speed', icon: Sparkles },
            { id: 'song' as const, label: 'Song & Transpose', icon: Music },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = settingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSettingsTab(tab.id)}
                className={`py-1.5 px-2.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${isActive
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/35 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                  : 'text-zinc-400 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06]'
                  }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Settings Cards Container */}
        <div className={`${isMobile ? 'flex-1 overflow-y-auto overscroll-contain p-4 pb-20 flex flex-col gap-4 text-xs custom-scrollbar' : 'flex flex-col gap-4 text-xs'}`}>
          {/* 1. Volume & Audio Mix Section */}
          {(settingsTab === 'all' || settingsTab === 'audio') && (
            <AudioSettingsTab
              soundInstrument={soundInstrument}
              onSoundInstrumentChange={onSoundInstrumentChange}
              stringAttack={stringAttack}
              onStringAttackChange={onStringAttackChange}
              stringRelease={stringRelease}
              onStringReleaseChange={onStringReleaseChange}
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={onVolumeChange}
              onToggleMute={onToggleMute}
              keyboardVolume={keyboardVolume}
              isKeyboardMuted={isKeyboardMuted}
              onKeyboardVolumeChange={onKeyboardVolumeChange}
              onToggleKeyboardMute={onToggleKeyboardMute}
              midiInputVolume={midiInputVolume}
              isMidiInputMuted={isMidiInputMuted}
              onMidiInputVolumeChange={onMidiInputVolumeChange}
              onToggleMidiInputMute={onToggleMidiInputMute}
              reverbWet={reverbWet}
              onReverbWetChange={onReverbWetChange}
              lowPassFilterActive={lowPassFilterActive}
              onLowPassFilterActiveChange={onLowPassFilterActiveChange}
              lowPassCutoff={lowPassCutoff}
              onLowPassCutoffChange={onLowPassCutoffChange}
            />
          )}

          {/* 2. Wicki & Keyboard Mapping Section */}
          {(settingsTab === 'all' || settingsTab === 'wicki') && (
            <WickiSettingsTab
              layoutType={layoutType}
              currentWickiMode={currentWickiMode}
              wickiFadeDuration={wickiFadeDuration}
              hideWickiText={hideWickiText}
              wickiTextMode={wickiTextMode}
              wickiHighlightOnlyPressed={wickiHighlightOnlyPressed}
              isMobile={isMobile}
              resetKeysSuccess={resetKeysSuccess}
              onSwitchToLayout={onSwitchToLayout}
              onSetWickiMode={onSetWickiMode}
              onWickiFadeDurationChange={onWickiFadeDurationChange}
              onHideWickiTextChange={onHideWickiTextChange}
              onWickiTextModeChange={onWickiTextModeChange}
              onWickiHighlightOnlyPressedChange={onWickiHighlightOnlyPressedChange}
              onResetKeysClick={onResetKeysClick}
            />
          )}

          {/* 3. Hotkeys & Shortcuts Configuration Section */}
          {(settingsTab === 'all' || settingsTab === 'hotkeys') && (
            <HotkeysSettingsTab
              hotkeys={hotkeys}
              onHotkeysChange={onHotkeysChange}
              onResetHotkeys={onResetHotkeys}
            />
          )}

          {/* 4. Visuals & Speed Section */}
          {(settingsTab === 'all' || settingsTab === 'visuals') && (
            <VisualSettingsTab
              soundInstrument={soundInstrument}
              targetFps={targetFps}
              onTargetFpsChange={onTargetFpsChange}
              onToggleTargetFps={onToggleTargetFps}
              fallSpeed={fallSpeed}
              onFallSpeedChange={onFallSpeedChange}
              showNoteBlocks={showNoteBlocks}
              onToggleNoteBlocks={onToggleNoteBlocks}
              colorMode={colorMode}
              onColorModeChange={onColorModeChange}
              backgroundImage={backgroundImage}
              onBackgroundImageChange={onBackgroundImageChange}
              backgroundOpacity={backgroundOpacity}
              onBackgroundOpacityChange={onBackgroundOpacityChange}
              backgroundBlur={backgroundBlur}
              onBackgroundBlurChange={onBackgroundBlurChange}
              backgroundFit={backgroundFit}
              onBackgroundFitChange={onBackgroundFitChange}
              pianoRetracted={pianoRetracted}
              onPianoRetractedChange={onPianoRetractedChange}
              onTogglePianoRetracted={onTogglePianoRetracted}
              hudPosition={hudPosition}
              onHudPositionChange={onHudPositionChange}
            />
          )}

          {/* 5. Song, Transpose & Performance Section */}
          {(settingsTab === 'all' || settingsTab === 'song') && (
            <SongSettingsTab
              inputTranspose={inputTranspose}
              onInputTransposeChange={onInputTransposeChange}
              midiTranspose={midiTranspose}
              onMidiTransposeChange={onMidiTransposeChange}
              speedMultiplier={speedMultiplier}
              onSpeedMultiplierChange={onSpeedMultiplierChange}
              seekSeconds={seekSeconds}
              onSeekSecondsChange={onSeekSecondsChange}
              maxVoices={maxVoices}
              onMaxVoicesChange={onMaxVoicesChange}
              recordingSession={recordingSession}
              onOpenRecordingModal={onOpenRecordingModal}
              onDownloadRecording={onDownloadRecording}
            />
          )}
        </div>
      </div>
    </>
  );
});

SettingsModal.displayName = 'SettingsModal';
