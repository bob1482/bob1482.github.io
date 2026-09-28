'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { MidiSong, MidiDevice } from '@/lib/midiEngine';
import { RecordingSession } from '@/lib/midiRecorder';
import { SustainMode, WickiBoardMode, WickiTextMode, SoundInstrument, HotkeyBindings, BackgroundFit, HudPosition, ColorMode } from '@/lib/settings';
import {
  KEYBOARD_EVENT_MATRIX,
  KEYBOARD_EVENT_MATRIX_6X4,
  KEYBOARD_EVENT_MATRIX_8X12,
  KEYBOARD_EVENT_MATRIX_9X18,
  KEYBOARD_EVENT_MATRIX_7X18,
  KeyboardLayoutType,
  getKeyboardLayoutType,
} from '@/lib/pianoGeometry';

import { TopHudBar } from './controls/TopHudBar';
import { MetronomePanel } from './controls/MetronomePanel';
import { SettingsModal } from './controls/settings/SettingsModal';
import { WickiKeyboardGuide } from './controls/WickiKeyboardGuide';
import { RecordingModal } from './controls/RecordingModal';
import { metronomeEngine } from '@/lib/metronomeEngine';

export interface ControlsOverlayProps {
  isPlaying: boolean;
  playbackTime?: number;
  songDuration?: number;
  currentSong: MidiSong | null;
  soundInstrument?: SoundInstrument;
  onSoundInstrumentChange?: (instrument: SoundInstrument) => void;
  stringAttack?: number;
  onStringAttackChange?: (attack: number) => void;
  stringRelease?: number;
  onStringReleaseChange?: (release: number) => void;
  sustainPedal: SustainMode;
  reverbWet: number;
  lowPassFilterActive?: boolean;
  onLowPassFilterActiveChange?: (active: boolean) => void;
  lowPassCutoff?: number;
  onLowPassCutoffChange?: (cutoff: number) => void;
  colorMode: ColorMode;
  fallSpeed: number;
  volume: number;
  isMuted: boolean;
  keyboardVolume?: number;
  isKeyboardMuted?: boolean;
  midiInputVolume?: number;
  isMidiInputMuted?: boolean;
  speedMultiplier: number;
  seekSeconds?: number;
  isSamplerLoaded: boolean;
  isPinned?: boolean;
  showNoteBlocks?: boolean;
  showSustainButton?: boolean;
  hideWickiText?: boolean;
  wickiTextMode?: WickiTextMode;
  wickiBoardMode?: WickiBoardMode;
  wickiFadeDuration?: number;
  wickiHighlightOnlyPressed?: boolean;
  isMousePedalMode?: boolean;
  isMousePedalPressed?: boolean;
  isMobilePortrait?: boolean;
  midiDevices?: MidiDevice[];
  activeMidiCount?: number;
  inputTranspose?: number;
  midiTranspose?: number;
  maxVoices?: number;
  targetFps?: 72 | 144;
  metronomeBpm?: number;
  metronomeActive?: boolean;
  metronomeBeats?: number;
  metronomeSound?: boolean;
  metronomeVolume?: number;
  onNoteOn?: (midi: number, velocity?: number, color?: string, inputId?: string) => void;
  onNoteOff?: (midi: number, inputId?: string) => void;
  onTogglePlay: () => void;
  onStop?: () => void;
  onClearSong?: () => void;
  onSeek: (time: number) => void;
  onSelectSong?: (song: MidiSong) => void;
  onToggleSustain: () => void;
  onSustainPedalChange?: (mode: SustainMode) => void;
  onEnterMousePedalMode?: () => void;
  onReverbWetChange: (wet: number) => void;
  onColorModeChange: (mode: ColorMode) => void;
  onFallSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onKeyboardVolumeChange?: (volume: number) => void;
  onToggleKeyboardMute?: () => void;
  onMidiInputVolumeChange?: (volume: number) => void;
  onToggleMidiInputMute?: () => void;
  onSpeedMultiplierChange: (speed: number) => void;
  onSeekSecondsChange?: (seconds: number) => void;
  onInputTransposeChange?: (transpose: number) => void;
  onMidiTransposeChange?: (transpose: number) => void;
  onMaxVoicesChange?: (limit: number) => void;
  onToggleTargetFps?: () => void;
  onTargetFpsChange?: (fps: 72 | 144) => void;
  onMetronomeBpmChange?: (bpm: number) => void;
  onMetronomeActiveChange?: (active: boolean) => void;
  onMetronomeBeatsChange?: (beats: number) => void;
  onMetronomeSoundChange?: (sound: boolean) => void;
  onMetronomeVolumeChange?: (vol: number) => void;
  onTogglePin?: () => void;
  onToggleNoteBlocks?: () => void;
  onToggleShowSustainButton?: () => void;
  onShowSustainButtonChange?: (show: boolean) => void;
  onHideWickiTextChange?: (hide: boolean) => void;
  onWickiTextModeChange?: (mode: WickiTextMode) => void;
  onWickiBoardModeChange?: (mode: WickiBoardMode) => void;
  onWickiFadeDurationChange?: (duration: number) => void;
  onWickiHighlightOnlyPressedChange?: (onlyPressed: boolean) => void;
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
  onResetSettings?: () => void;
  hotkeys?: HotkeyBindings;
  onHotkeysChange?: (hotkeys: HotkeyBindings) => void;
  onResetHotkeys?: () => void;
  keyboardMatrix?: string[][];
  onKeyboardMatrixChange?: (matrix: string[][]) => void;
  onFileUpload: (file: File) => void;
  isRecording?: boolean;
  recordingDuration?: number;
  onToggleRecord?: () => void;
  recordingSession?: RecordingSession | null;
  showRecordingModal?: boolean;
  onCloseRecordingModal?: () => void;
  onOpenRecordingModal?: () => void;
  onDownloadRecording?: (fileName: string) => void;
  onPlayRecordingInVisualizer?: (session: RecordingSession, customTitle?: string) => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = React.memo(({
  isPlaying,
  playbackTime,
  songDuration,
  currentSong,
  soundInstrument = 'salamander',
  onSoundInstrumentChange,
  stringAttack = 0.1,
  onStringAttackChange,
  stringRelease = 1.2,
  onStringReleaseChange,
  sustainPedal,
  reverbWet,
  lowPassFilterActive,
  onLowPassFilterActiveChange,
  lowPassCutoff,
  onLowPassCutoffChange,
  colorMode,
  fallSpeed,
  volume,
  isMuted,
  keyboardVolume = 0,
  isKeyboardMuted = false,
  midiInputVolume = 0,
  isMidiInputMuted = false,
  speedMultiplier,
  seekSeconds = 5,
  isSamplerLoaded,
  isPinned = true,
  showNoteBlocks = true,
  showSustainButton = true,
  hideWickiText = false,
  wickiTextMode,
  wickiBoardMode,
  wickiFadeDuration = 1.5,
  wickiHighlightOnlyPressed = false,
  isMousePedalMode = false,
  isMousePedalPressed = false,
  isMobilePortrait = false,
  midiDevices = [],
  activeMidiCount = 0,
  inputTranspose = 0,
  midiTranspose = 0,
  maxVoices = 64,
  targetFps = 72,
  metronomeBpm = 120,
  metronomeActive = false,
  metronomeBeats = 4,
  metronomeSound = true,
  metronomeVolume = 0,
  onNoteOn,
  onNoteOff,
  onTogglePlay,
  onStop,
  onClearSong,
  onSeek,
  onToggleSustain,
  onSustainPedalChange,
  onEnterMousePedalMode,
  onReverbWetChange,
  onColorModeChange,
  onFallSpeedChange,
  onVolumeChange,
  onToggleMute,
  onKeyboardVolumeChange,
  onToggleKeyboardMute,
  onMidiInputVolumeChange,
  onToggleMidiInputMute,
  onSpeedMultiplierChange,
  onSeekSecondsChange,
  onInputTransposeChange,
  onMidiTransposeChange,
  onMaxVoicesChange,
  onToggleTargetFps,
  onTargetFpsChange,
  onMetronomeBpmChange,
  onMetronomeActiveChange,
  onMetronomeBeatsChange,
  onMetronomeSoundChange,
  onMetronomeVolumeChange,
  onTogglePin,
  onToggleNoteBlocks,
  onToggleShowSustainButton,
  onShowSustainButtonChange,
  onHideWickiTextChange,
  onWickiTextModeChange,
  onWickiBoardModeChange,
  onWickiFadeDurationChange,
  onWickiHighlightOnlyPressedChange,
  backgroundImage,
  onBackgroundImageChange,
  backgroundOpacity,
  onBackgroundOpacityChange,
  backgroundBlur,
  onBackgroundBlurChange,
  backgroundFit,
  onBackgroundFitChange,
  pianoRetracted = false,
  onPianoRetractedChange,
  onTogglePianoRetracted,
  hudPosition = 'top',
  onHudPositionChange,
  onResetSettings,
  hotkeys,
  onHotkeysChange,
  onResetHotkeys,
  keyboardMatrix,
  onKeyboardMatrixChange,
  onFileUpload,
  isRecording = false,
  recordingDuration = 0,
  onToggleRecord,
  recordingSession = null,
  showRecordingModal = false,
  onCloseRecordingModal,
  onOpenRecordingModal,
  onDownloadRecording,
  onPlayRecordingInVisualizer,
}) => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const update = () => setIsSmallScreen(mql.matches || window.innerWidth <= 768);
    update();
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
    } else {
      // @ts-ignore
      mql.addListener?.(update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', update);
      } else {
        // @ts-ignore
        mql.removeListener?.(update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const isMobile = Boolean(isMobilePortrait || isSmallScreen);
  const [showSettings, setShowSettings] = useState(false);
  const [showMetronome, setShowMetronome] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchActive, setIsTouchActive] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const touchInactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevPinnedRef = useRef<boolean>(isPinned);
  const [resetKeysSuccess, setResetKeysSuccess] = useState(false);
  const resetKeysTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [localWickiMode, setLocalWickiMode] = useState<WickiBoardMode>('off');
  const currentWickiMode: WickiBoardMode = wickiBoardMode !== undefined ? wickiBoardMode : localWickiMode;
  const isWickiActive = currentWickiMode !== 'off';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentMatrix = keyboardMatrix || KEYBOARD_EVENT_MATRIX;
  const layoutType: KeyboardLayoutType = getKeyboardLayoutType(currentMatrix);

  const handleSetWickiMode = (nextMode: WickiBoardMode) => {
    setLocalWickiMode(nextMode);
    onWickiBoardModeChange?.(nextMode);
  };

  const handleCycleWickiMode = () => {
    const nextMode: WickiBoardMode =
      currentWickiMode === 'off' ? 'fade' : currentWickiMode === 'fade' ? 'always' : 'off';
    handleSetWickiMode(nextMode);
  };

  const handleSwitchToLayout = (targetType: KeyboardLayoutType) => {
    if (targetType === layoutType) return;

    let base6x12: string[][];
    if (currentMatrix.length === 8) {
      const rows4 = currentMatrix.slice(4, 8).map((row, r) => {
        const sliced = row.slice(0, 12);
        while (sliced.length < 12) {
          sliced.push(KEYBOARD_EVENT_MATRIX[r + 1]?.[sliced.length] || "");
        }
        return sliced;
      });
      base6x12 = [KEYBOARD_EVENT_MATRIX[0], ...rows4, KEYBOARD_EVENT_MATRIX[5]];
    } else if (currentMatrix.length === 7) {
      base6x12 = currentMatrix.slice(1).map((row, r) => {
        const sliced = row.slice(0, 12);
        while (sliced.length < 12) {
          sliced.push(KEYBOARD_EVENT_MATRIX[r]?.[sliced.length] || "");
        }
        return sliced;
      });
    } else if (currentMatrix.length === 9) {
      base6x12 = currentMatrix.slice(3, 9).map((row, r) => {
        const left6 = row.slice(0, 6);
        const right6 = row.length >= 18 ? row.slice(12, 18) : row.slice(6, 12);
        const combined = [...left6, ...right6];
        while (combined.length < 12) {
          combined.push(KEYBOARD_EVENT_MATRIX[r]?.[combined.length] || "");
        }
        return combined.slice(0, 12);
      });
    } else if (currentMatrix.length === 6 && currentMatrix[0]?.length === 4) {
      base6x12 = KEYBOARD_EVENT_MATRIX.map((defaultRow, r) =>
        defaultRow.map((code, c) => (c < 4 && currentMatrix[r]?.[c] !== undefined ? currentMatrix[r][c] : code))
      );
    } else if (currentMatrix.length === 6) {
      base6x12 = currentMatrix.map((row, r) => {
        const sliced = row.slice(0, 12);
        while (sliced.length < 12) {
          sliced.push(KEYBOARD_EVENT_MATRIX[r]?.[sliced.length] || "");
        }
        return sliced;
      });
    } else {
      base6x12 = KEYBOARD_EVENT_MATRIX;
    }

    if (targetType === '6x4') {
      const newMat = base6x12.map((row, r) => {
        const sliced = row.slice(0, 4);
        while (sliced.length < 4) {
          sliced.push(KEYBOARD_EVENT_MATRIX_6X4[r]?.[sliced.length] || "");
        }
        return sliced;
      });
      onKeyboardMatrixChange?.(newMat);
    } else if (targetType === '6x12') {
      onKeyboardMatrixChange?.(base6x12);
    } else if (targetType === '8x12') {
      const emptyRow12 = () => Array(12).fill("");
      const top4 = [emptyRow12(), emptyRow12(), emptyRow12(), emptyRow12()];
      const rows4 = base6x12.slice(1, 5);
      onKeyboardMatrixChange?.([...top4, ...rows4]);
    } else if (targetType === '9x18' || (targetType as string) === '7x18') {
      const emptyRow18 = () => Array(18).fill("");
      const top3 = [emptyRow18(), emptyRow18(), emptyRow18()];
      const splitRows = base6x12.map(row => {
        const left6 = row.slice(0, 6);
        while (left6.length < 6) left6.push("");
        const right6 = row.slice(6, 12);
        while (right6.length < 6) right6.push("");
        const empty6 = Array(6).fill("");
        return [...left6, ...empty6, ...right6];
      });
      onKeyboardMatrixChange?.([...top3, ...splitRows]);
    }
  };

  const handleResetKeysClick = () => {
    let defaultMatrix = KEYBOARD_EVENT_MATRIX;
    if (layoutType === '8x12') defaultMatrix = KEYBOARD_EVENT_MATRIX_8X12;
    else if (layoutType === '9x18') defaultMatrix = KEYBOARD_EVENT_MATRIX_9X18;
    else if (layoutType === '6x4') defaultMatrix = KEYBOARD_EVENT_MATRIX_6X4;
    onKeyboardMatrixChange?.(defaultMatrix);
    setResetKeysSuccess(true);
    if (resetKeysTimeoutRef.current) clearTimeout(resetKeysTimeoutRef.current);
    resetKeysTimeoutRef.current = setTimeout(() => {
      setResetKeysSuccess(false);
    }, 1800);
  };

  // Metronome State, Lookahead Scheduling & Visual Flashing
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [currentBeat, setCurrentBeat] = useState<number>(1);

  useEffect(() => {
    metronomeEngine.setBpm(metronomeBpm);
    metronomeEngine.setBeats(metronomeBeats);
    metronomeEngine.setSoundEnabled(metronomeSound);
    metronomeEngine.setVolume(metronomeVolume);

    if (metronomeActive && metronomeBpm > 0) {
      metronomeEngine.start(metronomeBpm, metronomeBeats);
    } else {
      metronomeEngine.stop();
      setIsFlashing(false);
      setCurrentBeat(1);
    }
  }, [metronomeActive, metronomeBpm, metronomeBeats, metronomeSound, metronomeVolume]);

  useEffect(() => {
    const unsubBeat = metronomeEngine.onBeat(beat => {
      setCurrentBeat(beat);
    });
    const unsubFlash = metronomeEngine.onFlash(flashing => {
      setIsFlashing(flashing);
    });
    return () => {
      unsubBeat();
      unsubFlash();
    };
  }, []);

  const handleToggleMetronome = () => {
    setShowMetronome(prev => {
      const next = !prev;
      if (next) {
        setShowSettings(false);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (resetKeysTimeoutRef.current) {
        clearTimeout(resetKeysTimeoutRef.current);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      const isFull = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isFull) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  const triggerTouchReveal = useCallback((durationMs = 4000) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (touchInactivityTimeoutRef.current) {
      clearTimeout(touchInactivityTimeoutRef.current);
      touchInactivityTimeoutRef.current = null;
    }
    setIsTouchActive(true);
    setIsHovered(true);

    if (!isPinned) {
      touchInactivityTimeoutRef.current = setTimeout(() => {
        setIsTouchActive(false);
        setIsHovered(false);
      }, durationMs);
    }
  }, [isPinned]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };

  const handleTouchInside = () => {
    if (!isPinned) {
      triggerTouchReveal(4000);
    }
  };

  // Sync with pin/unpin toggles
  useEffect(() => {
    if (prevPinnedRef.current && !isPinned) {
      // Just unpinned: keep visible for 3.5 seconds so user sees the change, then auto-retract
      triggerTouchReveal(3500);
    } else if (!prevPinnedRef.current && isPinned) {
      // Just pinned: clear auto-hide timer
      if (touchInactivityTimeoutRef.current) {
        clearTimeout(touchInactivityTimeoutRef.current);
        touchInactivityTimeoutRef.current = null;
      }
      setIsTouchActive(false);
    }
    prevPinnedRef.current = isPinned;
  }, [isPinned, triggerTouchReveal]);

  // Outside pointerdown listener to retract smoothly when unpinned and tapping away
  useEffect(() => {
    const handleWindowPointerDown = (e: PointerEvent) => {
      if (isPinned || showSettings || showMetronome) return;

      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        if (touchInactivityTimeoutRef.current) {
          clearTimeout(touchInactivityTimeoutRef.current);
          touchInactivityTimeoutRef.current = null;
        }
        setIsHovered(false);
        setIsTouchActive(false);
      }
    };

    window.addEventListener('pointerdown', handleWindowPointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleWindowPointerDown);
    };
  }, [isPinned, showSettings, showMetronome]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (touchInactivityTimeoutRef.current) clearTimeout(touchInactivityTimeoutRef.current);
    };
  }, []);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  const isSongActive = Boolean(currentSong);
  const isVisible = isPinned || isHovered || isTouchActive || showSettings || showMetronome;

  return (
    <>
      {/* Tap/Hover Sensor Zone & Pull Tab when unpinned and retracted */}
      {!isPinned && !isVisible && (
        hudPosition === 'right' ? (
          <div
            onClick={() => triggerTouchReveal(4000)}
            onTouchStart={() => triggerTouchReveal(4000)}
            onMouseEnter={handleMouseEnter}
            className="fixed top-0 bottom-0 right-0 w-8 sm:w-6 z-30 pointer-events-auto flex items-center justify-end pr-1 cursor-pointer group"
            title="Tap or hover to show sidebar"
          >
            <div className="w-1 h-12 rounded-full bg-white/20 group-hover:bg-white/40 group-active:bg-sky-400/80 transition-all shadow-sm" />
          </div>
        ) : (
          <div
            onClick={() => triggerTouchReveal(4000)}
            onTouchStart={() => triggerTouchReveal(4000)}
            onMouseEnter={handleMouseEnter}
            className="fixed top-0 left-0 right-0 h-10 sm:h-8 z-30 pointer-events-auto flex items-start justify-center pt-1 cursor-pointer group"
            title="Tap or hover to show controls"
          >
            <div className="w-12 h-1 rounded-full bg-white/20 group-hover:bg-white/40 group-active:bg-sky-400/80 transition-all shadow-sm" />
          </div>
        )
      )}

      <header
        ref={headerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchInside}
        className={
          hudPosition === 'right'
            ? `fixed right-0 top-0 bottom-0 z-50 p-2 sm:p-2.5 pointer-events-none flex flex-col items-center justify-center transition-all duration-300 ease-out ${
                isVisible
                  ? 'translate-x-0 opacity-100'
                  : 'translate-x-[calc(100%+24px)] opacity-0 pointer-events-none'
              }`
            : `fixed top-0 left-0 right-0 z-50 p-2 sm:p-3 pointer-events-none flex flex-col gap-2 transition-all duration-300 ease-out ${
                isVisible
                  ? 'translate-y-0 opacity-100'
                  : '-translate-y-[calc(100%+24px)] opacity-0 pointer-events-none'
              }`
        }
      >
        <TopHudBar
          hudPosition={hudPosition}
          isSongActive={isSongActive}
          isPlaying={isPlaying}
          isMobile={isMobile}
          isPinned={isPinned}
          showNoteBlocks={showNoteBlocks}
          pianoRetracted={pianoRetracted}
          showSustainButton={soundInstrument !== 'string_ensemble_1'}
          sustainPedal={sustainPedal}
          isMousePedalMode={isMousePedalMode}
          isMousePedalPressed={isMousePedalPressed}
          colorMode={colorMode}
          currentWickiMode={currentWickiMode}
          metronomeActive={metronomeActive}
          metronomeBpm={metronomeBpm}
          metronomeSound={metronomeSound}
          isFlashing={isFlashing}
          showMetronome={showMetronome}
          showSettings={showSettings}
          isFullscreen={isFullscreen}
          seekSeconds={seekSeconds}
          fileInputRef={fileInputRef}
          onFilePicked={handleFilePicked}
          onToggleMetronome={handleToggleMetronome}
          onToggleFullscreen={handleToggleFullscreen}
          onColorModeChange={onColorModeChange}
          onToggleSustain={onToggleSustain}
          onEnterMousePedalMode={onEnterMousePedalMode}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          onClearSong={onClearSong}
          onStop={onStop}
          onToggleNoteBlocks={onToggleNoteBlocks}
          onTogglePianoRetracted={onTogglePianoRetracted}
          onCycleWickiMode={handleCycleWickiMode}
          onToggleSettings={() => {
            setShowSettings(v => {
              const next = !v;
              if (next) setShowMetronome(false);
              return next;
            });
          }}
          onTogglePin={onTogglePin}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          onToggleRecord={onToggleRecord}
        />
      </header>

      {/* Metronome & Tempo Panel */}
      <MetronomePanel
        showMetronome={showMetronome}
        onClose={() => setShowMetronome(false)}
        isMobile={isMobile}
        metronomeActive={metronomeActive}
        metronomeBpm={metronomeBpm}
        metronomeBeats={metronomeBeats}
        metronomeSound={metronomeSound}
        metronomeVolume={metronomeVolume}
        currentBeat={currentBeat}
        isFlashing={isFlashing}
        currentSong={currentSong}
        onMetronomeActiveChange={onMetronomeActiveChange}
        onMetronomeBpmChange={onMetronomeBpmChange}
        onMetronomeBeatsChange={onMetronomeBeatsChange}
        onMetronomeSoundChange={onMetronomeSoundChange}
        onMetronomeVolumeChange={onMetronomeVolumeChange}
      />

      {/* Settings Panel Modal */}
      <SettingsModal
        showSettings={showSettings}
        onClose={() => setShowSettings(false)}
        isMobile={isMobile}
        onResetSettings={onResetSettings}
        // Audio props
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
        // Wicki props
        layoutType={layoutType}
        currentWickiMode={currentWickiMode}
        wickiFadeDuration={wickiFadeDuration}
        hideWickiText={hideWickiText}
        wickiTextMode={wickiTextMode}
        wickiHighlightOnlyPressed={wickiHighlightOnlyPressed}
        resetKeysSuccess={resetKeysSuccess}
        onSwitchToLayout={handleSwitchToLayout}
        onSetWickiMode={handleSetWickiMode}
        onWickiFadeDurationChange={onWickiFadeDurationChange}
        onHideWickiTextChange={onHideWickiTextChange}
        onWickiTextModeChange={onWickiTextModeChange}
        onWickiHighlightOnlyPressedChange={onWickiHighlightOnlyPressedChange}
        onResetKeysClick={handleResetKeysClick}
        // Visual props
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
        // Song props
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
        // Hotkey props
        hotkeys={hotkeys}
        onHotkeysChange={onHotkeysChange}
        onResetHotkeys={onResetHotkeys}
      />

      {/* MIDI Input Recording Modal */}
      <RecordingModal
        session={recordingSession}
        isOpen={showRecordingModal}
        onClose={onCloseRecordingModal || (() => {})}
        onDownload={onDownloadRecording || (() => {})}
        onPlayInVisualizer={onPlayRecordingInVisualizer || (() => {})}
        isMobile={isMobile}
      />


      {/* Sleek Frameless Isomorphic Keyboard Guide (Wicki Board) */}
      <WickiKeyboardGuide
        isWickiActive={isWickiActive}
        currentWickiMode={currentWickiMode}
        layoutType={layoutType}
        keyboardMatrix={keyboardMatrix}
        onKeyboardMatrixChange={onKeyboardMatrixChange}
        inputTranspose={inputTranspose}
        colorMode={colorMode}
        hideWickiText={hideWickiText}
        wickiTextMode={wickiTextMode}
        wickiFadeDuration={wickiFadeDuration}
        wickiHighlightOnlyPressed={wickiHighlightOnlyPressed}
        isSongActive={isSongActive}
        isMobile={isMobile}
        onNoteOn={onNoteOn}
        onNoteOff={onNoteOff}
        pianoRetracted={pianoRetracted}
        isTopBarVisible={isVisible}
        hudPosition={hudPosition}
      />

      {/* Floating Sampler Loading Indicator (Left Bottom Corner above Piano or Bottom Screen) */}
      {!isSamplerLoaded && (
        <div className={`fixed left-3.5 ${pianoRetracted ? 'bottom-3.5' : 'bottom-[calc(20%+10px)]'} z-40 pointer-events-auto transition-all duration-300 ease-out`}>
          <div
            title={`Downloading ${soundInstrument === 'string_ensemble_1' ? 'String Ensemble 1' : 'Grand Piano'} Soundfont Samples (Synthesizer active)...`}
            suppressHydrationWarning
            className="w-7 h-7 rounded-lg border border-blue-500/30 bg-blue-500/15 text-blue-400 backdrop-blur-md flex items-center justify-center select-none shrink-0"
          >
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
          </div>
        </div>
      )}

    </>
  );
});

ControlsOverlay.displayName = 'ControlsOverlay';
