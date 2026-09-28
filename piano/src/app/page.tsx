'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { audioEngine } from '@/lib/audioEngine';
import { midiManager, MidiSong, MidiDevice } from '@/lib/midiEngine';
import { midiRecorder, RecordingSession } from '@/lib/midiRecorder';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { ControlsOverlay } from '@/components/ControlsOverlay';
import { loadStoredSettings, saveStoredSettings, resetStoredSettings, DEFAULT_SETTINGS, SustainMode, ColorMode, TargetFps, WickiBoardMode, WickiTextMode, SoundInstrument, HotkeyBindings, DEFAULT_HOTKEYS, BackgroundFit, HudPosition } from '@/lib/settings';
import { loadCustomBackgroundFromDB, removeCustomBackgroundFromDB } from '@/lib/backgroundStorage';
import { useIsMobilePortrait } from '@/hooks/useIsMobilePortrait';
import {
  KEYBOARD_EVENT_MATRIX,
  MIN_MIDI,
  MAX_MIDI,
  getNoteColorHex,
  buildKeyboardMaps,
  loadCustomKeyboardMatrix,
  saveCustomKeyboardMatrix,
} from '@/lib/pianoGeometry';

// Dynamically import SynthesiaCanvas to ensure Canvas only runs client-side
const SynthesiaCanvas = dynamic(
  () => import('@/components/SynthesiaCanvas').then(mod => mod.SynthesiaCanvas),
  { ssr: false }
);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

function isHotkeyMatch(e: KeyboardEvent, boundCode: string | undefined): boolean {
  if (!boundCode) return false;
  if (e.code === boundCode) return true;
  // Common physical key aliases
  if (boundCode === 'Space' && (e.key === ' ' || e.code === 'Space')) return true;
  if (boundCode === 'Backslash' && (e.key === '\\' || e.code === 'Backslash')) return true;
  if (boundCode === 'Tab' && (e.key === 'Tab' || e.code === 'Tab')) return true;
  if (boundCode === 'Digit1' && (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1')) return true;
  if (boundCode === 'ArrowLeft' && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) return true;
  if (boundCode === 'ArrowRight' && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) return true;
  return false;
}

export default function Home() {
  const isMobilePortrait = useIsMobilePortrait();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSong, setCurrentSong] = useState<MidiSong | null>(null);
  const [isSamplerLoaded, setIsSamplerLoaded] = useState<boolean>(false);
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [isAudioStarted, setIsAudioStarted] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Persistent User Preferences
  const [colorMode, setColorMode] = useState<ColorMode>(DEFAULT_SETTINGS.colorMode);
  const [soundInstrument, setSoundInstrument] = useState<SoundInstrument>(DEFAULT_SETTINGS.soundInstrument);
  const [stringAttack, setStringAttack] = useState<number>(DEFAULT_SETTINGS.stringAttack);
  const [stringRelease, setStringRelease] = useState<number>(DEFAULT_SETTINGS.stringRelease);
  const [fallSpeed, setFallSpeed] = useState<number>(DEFAULT_SETTINGS.fallSpeed);
  const [reverbWet, setReverbWet] = useState<number>(DEFAULT_SETTINGS.reverbWet);
  const [lowPassFilterActive, setLowPassFilterActive] = useState<boolean>(DEFAULT_SETTINGS.lowPassFilterActive);
  const [lowPassCutoff, setLowPassCutoff] = useState<number>(DEFAULT_SETTINGS.lowPassCutoff);
  const [sustainPedal, setSustainPedal] = useState<SustainMode>(DEFAULT_SETTINGS.sustainPedal);
  const [volume, setVolume] = useState<number>(DEFAULT_SETTINGS.volume);
  const [isMuted, setIsMuted] = useState<boolean>(DEFAULT_SETTINGS.isMuted);
  const [keyboardVolume, setKeyboardVolume] = useState<number>(DEFAULT_SETTINGS.keyboardVolume);
  const [isKeyboardMuted, setIsKeyboardMuted] = useState<boolean>(DEFAULT_SETTINGS.isKeyboardMuted);
  const [midiInputVolume, setMidiInputVolume] = useState<number>(DEFAULT_SETTINGS.midiInputVolume);
  const [isMidiInputMuted, setIsMidiInputMuted] = useState<boolean>(DEFAULT_SETTINGS.isMidiInputMuted);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(DEFAULT_SETTINGS.speedMultiplier);
  const [seekSeconds, setSeekSeconds] = useState<number>(DEFAULT_SETTINGS.seekSeconds);
  const [isPinned, setIsPinned] = useState<boolean>(DEFAULT_SETTINGS.isPinned);
  const [showNoteBlocks, setShowNoteBlocks] = useState<boolean>(DEFAULT_SETTINGS.showNoteBlocks);
  const [showSustainButton, setShowSustainButton] = useState<boolean>(DEFAULT_SETTINGS.showSustainButton);
  const [hideWickiText, setHideWickiText] = useState<boolean>(DEFAULT_SETTINGS.hideWickiText);
  const [wickiTextMode, setWickiTextMode] = useState<WickiTextMode>(DEFAULT_SETTINGS.wickiTextMode);
  const [wickiBoardMode, setWickiBoardMode] = useState<WickiBoardMode>(DEFAULT_SETTINGS.wickiBoardMode);
  const [wickiFadeDuration, setWickiFadeDuration] = useState<number>(DEFAULT_SETTINGS.wickiFadeDuration);
  const [wickiHighlightOnlyPressed, setWickiHighlightOnlyPressed] = useState<boolean>(DEFAULT_SETTINGS.wickiHighlightOnlyPressed);
  const [inputTranspose, setInputTranspose] = useState<number>(DEFAULT_SETTINGS.inputTranspose);
  const [midiTranspose, setMidiTranspose] = useState<number>(DEFAULT_SETTINGS.midiTranspose);
  const [maxVoices, setMaxVoices] = useState<number>(DEFAULT_SETTINGS.maxVoices);
  const [targetFps, setTargetFps] = useState<TargetFps>(DEFAULT_SETTINGS.targetFps);
  const [metronomeBpm, setMetronomeBpm] = useState<number>(DEFAULT_SETTINGS.metronomeBpm);
  const [metronomeActive, setMetronomeActive] = useState<boolean>(DEFAULT_SETTINGS.metronomeActive);
  const [metronomeBeats, setMetronomeBeats] = useState<number>(DEFAULT_SETTINGS.metronomeBeats);
  const [metronomeSound, setMetronomeSound] = useState<boolean>(DEFAULT_SETTINGS.metronomeSound);
  const [metronomeVolume, setMetronomeVolume] = useState<number>(DEFAULT_SETTINGS.metronomeVolume);
  const [backgroundImage, setBackgroundImage] = useState<string>(DEFAULT_SETTINGS.backgroundImage);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(DEFAULT_SETTINGS.backgroundOpacity);
  const [backgroundBlur, setBackgroundBlur] = useState<number>(DEFAULT_SETTINGS.backgroundBlur);
  const [backgroundFit, setBackgroundFit] = useState<BackgroundFit>(DEFAULT_SETTINGS.backgroundFit);
  const [pianoRetracted, setPianoRetracted] = useState<boolean>(DEFAULT_SETTINGS.pianoRetracted);
  const [hudPosition, setHudPosition] = useState<HudPosition>(DEFAULT_SETTINGS.hudPosition);
  const [hotkeys, setHotkeys] = useState<HotkeyBindings>(DEFAULT_SETTINGS.hotkeys);
  const hotkeysRef = useRef<HotkeyBindings>(DEFAULT_SETTINGS.hotkeys);
  hotkeysRef.current = hotkeys;

  // MIDI Input Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState<boolean>(false);

  // Keyboard mapping matrix state
  const [keyboardMatrix, setKeyboardMatrix] = useState<string[][]>(KEYBOARD_EVENT_MATRIX);
  const keyToMidiMapRef = useRef<Record<string, number>>({});
  const keyToColorMapRef = useRef<Record<string, string>>({});
  const keyToColMapRef = useRef<Record<string, number>>({});
  const [leftBoardOctaveShift, setLeftBoardOctaveShift] = useState<number>(0);
  const leftBoardOctaveShiftRef = useRef<number>(0);
  leftBoardOctaveShiftRef.current = leftBoardOctaveShift;

  useEffect(() => {
    const loaded = loadCustomKeyboardMatrix();
    setKeyboardMatrix(loaded);
    const maps = buildKeyboardMaps(loaded);
    keyToMidiMapRef.current = maps.keyToMidi;
    keyToColorMapRef.current = maps.keyToColor;
    keyToColMapRef.current = maps.keyToCol;
  }, []);

  const handleKeyboardMatrixChange = useCallback((newMatrix: string[][]) => {
    setKeyboardMatrix(newMatrix);
    const maps = buildKeyboardMaps(newMatrix);
    keyToMidiMapRef.current = maps.keyToMidi;
    keyToColorMapRef.current = maps.keyToColor;
    keyToColMapRef.current = maps.keyToCol;
    saveCustomKeyboardMatrix(newMatrix);
  }, []);

  // Mouse Pedal Mode (Lock/hide cursor on sustain button right-click, right-click as sustain pedal)
  const [isMousePedalMode, setIsMousePedalMode] = useState<boolean>(false);
  const [isMousePedalPressed, setIsMousePedalPressed] = useState<boolean>(false);
  const isMousePedalModeRef = useRef<boolean>(false);
  const isMousePedalPressedRef = useRef<boolean>(false);
  const prevSustainBeforeMousePedalRef = useRef<SustainMode>(DEFAULT_SETTINGS.sustainPedal);
  const configuredPedalModeRef = useRef<SustainMode>(DEFAULT_SETTINGS.sustainPedal);
  const lastPianoSustainPedalRef = useRef<SustainMode>(DEFAULT_SETTINGS.lastPianoSustainPedal || 'half');
  const soundInstrumentRef = useRef<SoundInstrument>(soundInstrument);
  soundInstrumentRef.current = soundInstrument;

  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;
  const inputTransposeRef = useRef(inputTranspose);
  inputTransposeRef.current = inputTranspose;
  const seekSecondsRef = useRef(seekSeconds);
  seekSecondsRef.current = seekSeconds;

  const handleEnterMousePedalMode = useCallback(() => {
    if (soundInstrumentRef.current === 'string_ensemble_1') return;
    try {
      prevSustainBeforeMousePedalRef.current = sustainPedal;
      if (sustainPedal !== 'off') {
        configuredPedalModeRef.current = sustainPedal;
      }
      const elem = document.body;
      if (elem && elem.requestPointerLock) {
        const res = elem.requestPointerLock();
        if (res && typeof (res as any).catch === 'function') {
          (res as any).catch((err: any) => {
            console.warn('Pointer lock request error:', err);
          });
        }
      }
    } catch (err) {
      console.warn('Pointer lock error:', err);
    }
  }, [sustainPedal]);

  const handleColorModeChange = useCallback((mode: ColorMode) => {
    setColorMode(mode);
    midiManager.setColorMode(mode);
    saveStoredSettings({ colorMode: mode });
  }, []);

  const handleToggleNoteBlocks = useCallback(() => {
    setShowNoteBlocks(prev => {
      const next = !prev;
      saveStoredSettings({ showNoteBlocks: next });
      return next;
    });
  }, []);

  const handleToggleShowSustainButton = useCallback(() => {
    setShowSustainButton(prev => {
      const next = !prev;
      saveStoredSettings({ showSustainButton: next });
      return next;
    });
  }, []);

  const handleShowSustainButtonChange = useCallback((show: boolean) => {
    setShowSustainButton(show);
    saveStoredSettings({ showSustainButton: show });
  }, []);

  const handleHideWickiTextChange = useCallback((hide: boolean) => {
    setHideWickiText(hide);
    if (hide) {
      setWickiTextMode('off');
      saveStoredSettings({ hideWickiText: true, wickiTextMode: 'off' });
    } else {
      setWickiTextMode(prev => (prev === 'off' ? 'keys' : prev));
      saveStoredSettings({ hideWickiText: false });
    }
  }, []);

  const handleWickiTextModeChange = useCallback((mode: WickiTextMode) => {
    setWickiTextMode(mode);
    setHideWickiText(mode === 'off');
    saveStoredSettings({ wickiTextMode: mode, hideWickiText: mode === 'off' });
  }, []);

  const handleWickiBoardModeChange = useCallback((mode: WickiBoardMode) => {
    setWickiBoardMode(mode);
    saveStoredSettings({ wickiBoardMode: mode });
  }, []);

  const handleWickiFadeDurationChange = useCallback((duration: number) => {
    setWickiFadeDuration(duration);
    saveStoredSettings({ wickiFadeDuration: duration });
  }, []);

  const handleWickiHighlightOnlyPressedChange = useCallback((onlyPressed: boolean) => {
    setWickiHighlightOnlyPressed(onlyPressed);
    saveStoredSettings({ wickiHighlightOnlyPressed: onlyPressed });
  }, []);

  const handleFallSpeedChange = useCallback((speed: number) => {
    setFallSpeed(speed);
    saveStoredSettings({ fallSpeed: speed });
  }, []);

  const handleReverbWetChange = useCallback((wet: number) => {
    setReverbWet(wet);
    audioEngine.setReverbWet(wet);
    saveStoredSettings({ reverbWet: wet });
  }, []);

  const handleLowPassFilterActiveChange = useCallback((active: boolean) => {
    setLowPassFilterActive(active);
    audioEngine.setLowPassFilterActive(active);
    saveStoredSettings({ lowPassFilterActive: active });
  }, []);

  const handleLowPassCutoffChange = useCallback((cutoff: number) => {
    setLowPassCutoff(cutoff);
    audioEngine.setLowPassCutoff(cutoff);
    saveStoredSettings({ lowPassCutoff: cutoff });
  }, []);

  const handleToggleSustain = useCallback(() => {
    if (soundInstrumentRef.current === 'string_ensemble_1') return;
    setSustainPedal(prev => {
      let next: SustainMode;
      if (prev === 'full') next = 'half';
      else if (prev === 'half') next = 'off';
      else next = 'full';
      if (next !== 'off') {
        configuredPedalModeRef.current = next;
        lastPianoSustainPedalRef.current = next;
      }
      audioEngine.setSustainPedal(next);
      midiRecorder.recordSustain(next);
      saveStoredSettings({ sustainPedal: next, lastPianoSustainPedal: lastPianoSustainPedalRef.current });
      return next;
    });
  }, []);

  const handleSustainPedalChange = useCallback((mode: SustainMode) => {
    if (soundInstrumentRef.current === 'string_ensemble_1') return;
    setSustainPedal(mode);
    if (mode !== 'off') {
      configuredPedalModeRef.current = mode;
      lastPianoSustainPedalRef.current = mode;
    }
    audioEngine.setSustainPedal(mode);
    midiRecorder.recordSustain(mode);
    saveStoredSettings({ sustainPedal: mode, lastPianoSustainPedal: lastPianoSustainPedalRef.current });
  }, []);

  const handleSoundInstrumentChange = useCallback((inst: SoundInstrument) => {
    setSoundInstrument(inst);
    soundInstrumentRef.current = inst;
    audioEngine.setInstrument(inst);

    if (inst === 'string_ensemble_1') {
      // Turn off sustain when string mode is enabled and hide button
      if (sustainPedal !== 'off') {
        lastPianoSustainPedalRef.current = sustainPedal;
      } else if (configuredPedalModeRef.current !== 'off') {
        lastPianoSustainPedalRef.current = configuredPedalModeRef.current;
      }

      setSustainPedal('off');
      audioEngine.setSustainPedal('off');

      // Release mouse pedal lock if active
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        try {
          document.exitPointerLock();
        } catch { }
      }
      setIsMousePedalMode(false);
      setIsMousePedalPressed(false);
      isMousePedalModeRef.current = false;
      isMousePedalPressedRef.current = false;

      saveStoredSettings({
        soundInstrument: inst,
        sustainPedal: 'off',
        lastPianoSustainPedal: lastPianoSustainPedalRef.current,
      });
    } else {
      // Re-enable sustain when piano mode is enabled
      const restoreSustain: SustainMode =
        lastPianoSustainPedalRef.current && lastPianoSustainPedalRef.current !== 'off'
          ? lastPianoSustainPedalRef.current
          : 'half';

      lastPianoSustainPedalRef.current = restoreSustain;
      configuredPedalModeRef.current = restoreSustain;
      prevSustainBeforeMousePedalRef.current = restoreSustain;

      setSustainPedal(restoreSustain);
      audioEngine.setSustainPedal(restoreSustain);

      saveStoredSettings({
        soundInstrument: inst,
        sustainPedal: restoreSustain,
        lastPianoSustainPedal: restoreSustain,
      });
    }
  }, [sustainPedal]);

  const handleStringAttackChange = useCallback((attack: number) => {
    setStringAttack(attack);
    audioEngine.setStringAttack(attack);
    saveStoredSettings({ stringAttack: attack });
  }, []);

  const handleStringReleaseChange = useCallback((release: number) => {
    setStringRelease(release);
    audioEngine.setStringRelease(release);
    saveStoredSettings({ stringRelease: release });
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    setIsMuted(false);
    audioEngine.setVolume(v);
    audioEngine.setSongMuted(false);
    saveStoredSettings({ volume: v, isMuted: false });
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      audioEngine.setSongMuted(next);
      saveStoredSettings({ isMuted: next });
      return next;
    });
  }, []);

  const handleKeyboardVolumeChange = useCallback((v: number) => {
    setKeyboardVolume(v);
    setIsKeyboardMuted(false);
    audioEngine.setKeyboardVolume(v);
    audioEngine.setKeyboardMuted(false);
    saveStoredSettings({ keyboardVolume: v, isKeyboardMuted: false });
  }, []);

  const handleToggleKeyboardMute = useCallback(() => {
    setIsKeyboardMuted(prev => {
      const next = !prev;
      audioEngine.setKeyboardMuted(next);
      saveStoredSettings({ isKeyboardMuted: next });
      return next;
    });
  }, []);

  const handleMidiInputVolumeChange = useCallback((v: number) => {
    setMidiInputVolume(v);
    setIsMidiInputMuted(false);
    audioEngine.setMidiInputVolume(v);
    audioEngine.setMidiInputMuted(false);
    saveStoredSettings({ midiInputVolume: v, isMidiInputMuted: false });
  }, []);

  const handleToggleMidiInputMute = useCallback(() => {
    setIsMidiInputMuted(prev => {
      const next = !prev;
      audioEngine.setMidiInputMuted(next);
      saveStoredSettings({ isMidiInputMuted: next });
      return next;
    });
  }, []);

  const handleSpeedMultiplierChange = useCallback((spd: number) => {
    setSpeedMultiplier(spd);
    midiManager.setPlaybackSpeed(spd);
    saveStoredSettings({ speedMultiplier: spd });
  }, []);

  const handleSeekSecondsChange = useCallback((seconds: number) => {
    setSeekSeconds(seconds);
    saveStoredSettings({ seekSeconds: seconds });
  }, []);

  const handleInputTransposeChange = useCallback((transpose: number) => {
    setInputTranspose(transpose);
    midiManager.setInputTranspose(transpose);
    saveStoredSettings({ inputTranspose: transpose });
  }, []);

  const handleMidiTransposeChange = useCallback((transpose: number) => {
    setMidiTranspose(transpose);
    midiManager.setMidiTranspose(transpose);
    saveStoredSettings({ midiTranspose: transpose });
  }, []);

  const handleMaxVoicesChange = useCallback((limit: number) => {
    setMaxVoices(limit);
    audioEngine.setMaxVoices(limit);
    saveStoredSettings({ maxVoices: limit });
  }, []);

  const handleToggleTargetFps = useCallback(() => {
    setTargetFps(prev => {
      const next = prev === 72 ? 144 : 72;
      saveStoredSettings({ targetFps: next });
      return next;
    });
  }, []);

  const handleTargetFpsChange = useCallback((fps: TargetFps) => {
    setTargetFps(fps);
    saveStoredSettings({ targetFps: fps });
  }, []);

  const handleMetronomeBpmChange = useCallback((bpm: number) => {
    setMetronomeBpm(bpm);
    saveStoredSettings({ metronomeBpm: bpm });
  }, []);

  const handleMetronomeActiveChange = useCallback(async (active: boolean) => {
    if (active) {
      await audioEngine.initAudio();
      setIsAudioStarted(true);
    }
    setMetronomeActive(active);
    saveStoredSettings({ metronomeActive: active });
  }, []);

  const handleMetronomeBeatsChange = useCallback((beats: number) => {
    setMetronomeBeats(beats);
    saveStoredSettings({ metronomeBeats: beats });
  }, []);

  const handleMetronomeSoundChange = useCallback((sound: boolean) => {
    setMetronomeSound(sound);
    saveStoredSettings({ metronomeSound: sound });
  }, []);

  const handleMetronomeVolumeChange = useCallback((vol: number) => {
    setMetronomeVolume(vol);
    saveStoredSettings({ metronomeVolume: vol });
  }, []);

  const handleBackgroundImageChange = useCallback((img: string) => {
    setBackgroundImage(img);
    if (!img) {
      saveStoredSettings({ backgroundImage: '' });
      removeCustomBackgroundFromDB().catch(() => {});
    } else if (!img.startsWith('data:')) {
      saveStoredSettings({ backgroundImage: img });
    } else {
      saveStoredSettings({ backgroundImage: 'custom' });
    }
  }, []);

  const handleBackgroundOpacityChange = useCallback((opacity: number) => {
    setBackgroundOpacity(opacity);
    saveStoredSettings({ backgroundOpacity: opacity });
  }, []);

  const handleBackgroundBlurChange = useCallback((blur: number) => {
    setBackgroundBlur(blur);
    saveStoredSettings({ backgroundBlur: blur });
  }, []);

  const handleBackgroundFitChange = useCallback((fit: BackgroundFit) => {
    setBackgroundFit(fit);
    saveStoredSettings({ backgroundFit: fit });
  }, []);

  const handlePianoRetractedChange = useCallback((retracted: boolean) => {
    setPianoRetracted(retracted);
    saveStoredSettings({ pianoRetracted: retracted });
  }, []);

  const handleTogglePianoRetracted = useCallback(() => {
    setPianoRetracted(prev => {
      const next = !prev;
      saveStoredSettings({ pianoRetracted: next });
      return next;
    });
  }, []);

  const handleHudPositionChange = useCallback((pos: HudPosition) => {
    setHudPosition(pos);
    saveStoredSettings({ hudPosition: pos });
  }, []);

  const handleTogglePin = useCallback(() => {
    setIsPinned(prev => {
      const next = !prev;
      saveStoredSettings({ isPinned: next });
      return next;
    });
  }, []);

  const handleHotkeysChange = useCallback((newHotkeys: HotkeyBindings) => {
    setHotkeys(newHotkeys);
    saveStoredSettings({ hotkeys: newHotkeys });
  }, []);

  const handleResetHotkeys = useCallback(() => {
    setHotkeys(DEFAULT_HOTKEYS);
    saveStoredSettings({ hotkeys: DEFAULT_HOTKEYS });
  }, []);

  const handleResetSettings = useCallback(() => {
    const defaults = resetStoredSettings();

    // Reset React state
    setColorMode(defaults.colorMode);
    setSoundInstrument(defaults.soundInstrument);
    soundInstrumentRef.current = defaults.soundInstrument;
    setStringAttack(defaults.stringAttack);
    setStringRelease(defaults.stringRelease);
    setFallSpeed(defaults.fallSpeed);
    setReverbWet(defaults.reverbWet);
    setLowPassFilterActive(defaults.lowPassFilterActive);
    setLowPassCutoff(defaults.lowPassCutoff);
    setSustainPedal(defaults.sustainPedal);
    configuredPedalModeRef.current = defaults.sustainPedal;
    prevSustainBeforeMousePedalRef.current = defaults.sustainPedal;
    lastPianoSustainPedalRef.current = defaults.lastPianoSustainPedal || 'half';
    setVolume(defaults.volume);
    setIsMuted(defaults.isMuted);
    setKeyboardVolume(defaults.keyboardVolume);
    setIsKeyboardMuted(defaults.isKeyboardMuted);
    setMidiInputVolume(defaults.midiInputVolume);
    setIsMidiInputMuted(defaults.isMidiInputMuted);
    setSpeedMultiplier(defaults.speedMultiplier);
    setSeekSeconds(defaults.seekSeconds);
    setIsPinned(defaults.isPinned);
    setShowNoteBlocks(defaults.showNoteBlocks);
    setShowSustainButton(defaults.showSustainButton);
    setHideWickiText(defaults.hideWickiText);
    setWickiTextMode(defaults.wickiTextMode);
    setWickiBoardMode(defaults.wickiBoardMode);
    setWickiFadeDuration(defaults.wickiFadeDuration);
    setWickiHighlightOnlyPressed(defaults.wickiHighlightOnlyPressed);
    setInputTranspose(defaults.inputTranspose);
    setMidiTranspose(defaults.midiTranspose);
    setMaxVoices(defaults.maxVoices);
    setTargetFps(defaults.targetFps);
    setMetronomeBpm(defaults.metronomeBpm);
    setMetronomeActive(defaults.metronomeActive);
    setMetronomeBeats(defaults.metronomeBeats);
    setMetronomeSound(defaults.metronomeSound);
    setMetronomeVolume(defaults.metronomeVolume);
    setBackgroundImage(defaults.backgroundImage);
    setBackgroundOpacity(defaults.backgroundOpacity);
    setBackgroundBlur(defaults.backgroundBlur);
    setBackgroundFit(defaults.backgroundFit);
    setPianoRetracted(defaults.pianoRetracted);
    setHudPosition(defaults.hudPosition);
    removeCustomBackgroundFromDB().catch(() => {});
    setHotkeys(defaults.hotkeys || DEFAULT_HOTKEYS);

    // Apply to audio and MIDI engines
    midiManager.setColorMode(defaults.colorMode);
    midiManager.setPlaybackSpeed(defaults.speedMultiplier);
    midiManager.setInputTranspose(defaults.inputTranspose);
    midiManager.setMidiTranspose(defaults.midiTranspose);
    audioEngine.setInstrument(defaults.soundInstrument);
    audioEngine.setStringAttack(defaults.stringAttack);
    audioEngine.setStringRelease(defaults.stringRelease);
    audioEngine.setReverbWet(defaults.reverbWet);
    audioEngine.setLowPassFilterActive(defaults.lowPassFilterActive);
    audioEngine.setLowPassCutoff(defaults.lowPassCutoff);
    audioEngine.setSustainPedal(defaults.sustainPedal);
    audioEngine.setVolume(defaults.volume);
    audioEngine.setSongMuted(defaults.isMuted);
    audioEngine.setKeyboardVolume(defaults.keyboardVolume);
    audioEngine.setKeyboardMuted(defaults.isKeyboardMuted);
    audioEngine.setMidiInputVolume(defaults.midiInputVolume);
    audioEngine.setMidiInputMuted(defaults.isMidiInputMuted);
    audioEngine.setMetronomeMuted(!defaults.metronomeSound);
    audioEngine.setMetronomeVolume(defaults.metronomeVolume);
    audioEngine.setMaxVoices(defaults.maxVoices);
  }, []);

  const pressedComputerNotesRef = useRef<Map<string, number>>(new Map());

  // Synchronously hydrate persistent settings before paint
  useIsomorphicLayoutEffect(() => {
    const stored = loadStoredSettings();
    setColorMode(stored.colorMode);
    setSoundInstrument(stored.soundInstrument);
    soundInstrumentRef.current = stored.soundInstrument;
    setStringAttack(stored.stringAttack);
    setStringRelease(stored.stringRelease);
    setFallSpeed(stored.fallSpeed);
    setReverbWet(stored.reverbWet);
    setLowPassFilterActive(stored.lowPassFilterActive);
    setLowPassCutoff(stored.lowPassCutoff);

    const isStringMode = stored.soundInstrument === 'string_ensemble_1';
    const rememberedPianoSustain =
      stored.lastPianoSustainPedal || (stored.sustainPedal !== 'off' ? stored.sustainPedal : 'half');
    lastPianoSustainPedalRef.current = rememberedPianoSustain;

    const initialSustain: SustainMode = isStringMode ? 'off' : stored.sustainPedal;
    setSustainPedal(initialSustain);
    if (initialSustain !== 'off') {
      configuredPedalModeRef.current = initialSustain;
    } else {
      configuredPedalModeRef.current = rememberedPianoSustain;
    }
    prevSustainBeforeMousePedalRef.current = initialSustain;
    setVolume(stored.volume);
    setIsMuted(stored.isMuted);
    setKeyboardVolume(stored.keyboardVolume);
    setIsKeyboardMuted(stored.isKeyboardMuted);
    setMidiInputVolume(stored.midiInputVolume);
    setIsMidiInputMuted(stored.isMidiInputMuted);
    setSpeedMultiplier(stored.speedMultiplier);
    setSeekSeconds(stored.seekSeconds);
    setIsPinned(stored.isPinned);
    setShowNoteBlocks(stored.showNoteBlocks);
    setShowSustainButton(stored.showSustainButton);
    setHideWickiText(stored.hideWickiText);
    setWickiTextMode(stored.wickiTextMode || (stored.hideWickiText ? 'off' : 'keys'));
    setWickiBoardMode(stored.wickiBoardMode);
    setWickiFadeDuration(stored.wickiFadeDuration);
    setWickiHighlightOnlyPressed(stored.wickiHighlightOnlyPressed);
    setInputTranspose(stored.inputTranspose);
    setMidiTranspose(stored.midiTranspose);
    setMaxVoices(stored.maxVoices);
    setTargetFps(stored.targetFps);
    setMetronomeBpm(stored.metronomeBpm);
    setMetronomeActive(stored.metronomeActive);
    setMetronomeBeats(stored.metronomeBeats);
    setMetronomeSound(stored.metronomeSound);
    setMetronomeVolume(stored.metronomeVolume);
    setBackgroundOpacity(stored.backgroundOpacity);
    setBackgroundBlur(stored.backgroundBlur);
    setBackgroundFit(stored.backgroundFit);
    setPianoRetracted(stored.pianoRetracted);
    setHudPosition(stored.hudPosition || DEFAULT_SETTINGS.hudPosition);
    if (stored.backgroundImage && stored.backgroundImage !== 'custom') {
      setBackgroundImage(stored.backgroundImage);
    }
    loadCustomBackgroundFromDB().then(customBg => {
      if (customBg) {
        setBackgroundImage(customBg);
      }
    }).catch(() => {});
    setHotkeys(stored.hotkeys || DEFAULT_HOTKEYS);

    // Apply stored settings immediately to engines
    midiManager.setColorMode(stored.colorMode);
    midiManager.setPlaybackSpeed(stored.speedMultiplier);
    midiManager.setInputTranspose(stored.inputTranspose);
    midiManager.setMidiTranspose(stored.midiTranspose);
    audioEngine.setInstrument(stored.soundInstrument);
    audioEngine.setStringAttack(stored.stringAttack);
    audioEngine.setStringRelease(stored.stringRelease);
    audioEngine.setReverbWet(stored.reverbWet);
    audioEngine.setLowPassFilterActive(stored.lowPassFilterActive);
    audioEngine.setLowPassCutoff(stored.lowPassCutoff);
    audioEngine.setSustainPedal(initialSustain);
    audioEngine.setVolume(stored.volume);
    audioEngine.setSongMuted(stored.isMuted);
    audioEngine.setKeyboardVolume(stored.keyboardVolume);
    audioEngine.setKeyboardMuted(stored.isKeyboardMuted);
    audioEngine.setMidiInputVolume(stored.midiInputVolume);
    audioEngine.setMidiInputMuted(stored.isMidiInputMuted);
    audioEngine.setMetronomeMuted(!stored.metronomeSound);
    audioEngine.setMetronomeVolume(stored.metronomeVolume);
    audioEngine.setMaxVoices(stored.maxVoices);
  }, []);

  // Initialize Asynchronous Engine Subscriptions on Mount
  useEffect(() => {
    // Preload soundfont sampler immediately
    audioEngine.preload();

    // Check soundfont status
    const unsubSampler = audioEngine.onSamplerLoaded(loaded => {
      setIsSamplerLoaded(loaded);
    });

    // Init Web MIDI
    midiManager.initWebMidi().then(() => {
      setMidiDevices(midiManager.getDevices());
    });

    // MIDI device change listener
    const unsubDevice = midiManager.onDeviceChange(devs => {
      setMidiDevices([...devs]);
    });

    // Sustain listener (e.g. MIDI CC64)
    const unsubSustain = midiManager.onSustain(mode => {
      if (soundInstrumentRef.current === 'string_ensemble_1') {
        return; // Sustain is disabled in string ensemble mode
      }
      setSustainPedal(mode);
    });

    // Playback state listener (e.g. when MIDI song finishes or is stopped)
    const unsubPlayback = midiManager.onPlaybackStateChange(playing => {
      setIsPlaying(playing);
    });

    // Live note listeners for recording
    const unsubRecNoteOn = midiManager.onNoteOn((midi, velocity, isLiveInput, _color, inputId) => {
      if (isLiveInput) {
        midiRecorder.recordNoteOn(midi, velocity, inputId);
      }
    });

    const unsubRecNoteOff = midiManager.onNoteOff((midi, isLiveInput, inputId) => {
      if (isLiveInput) {
        midiRecorder.recordNoteOff(midi, inputId);
      }
    });

    const unsubRecSustain = midiManager.onSustain(mode => {
      midiRecorder.recordSustain(mode);
    });

    return () => {
      unsubSampler?.();
      unsubDevice?.();
      unsubSustain?.();
      unsubPlayback?.();
      unsubRecNoteOn?.();
      unsubRecNoteOff?.();
      unsubRecSustain?.();
    };
  }, []);

  // Unlock Audio on First Click / Touch / Keypress
  const unlockAudio = useCallback(async () => {
    if (!isAudioStarted) {
      await audioEngine.initAudio();
      setIsAudioStarted(true);
    }
  }, [isAudioStarted]);

  // Note Interaction Handlers from UI Piano Keyboard & Computer Keyboard
  const handleNoteOn = useCallback((midi: number, velocity: number = 0.85, color?: string, inputId?: string) => {
    unlockAudio();
    const isMouseOrTouch = inputId?.startsWith('pointer:') || inputId?.startsWith('touch:');
    const resolvedColor = color || (isMouseOrTouch && colorModeRef.current !== 'outline' ? getNoteColorHex(midi, 0, 'gradient') : getNoteColorHex(midi, 0, colorModeRef.current));
    midiManager.triggerLiveNoteOn(midi, velocity, resolvedColor, inputId, 'keyboard');
  }, [unlockAudio]);

  const handleNoteOff = useCallback((midi: number, inputId?: string) => {
    midiManager.triggerLiveNoteOff(midi, inputId);
  }, []);

  // Transport Controls
  const handleTogglePlay = useCallback(async () => {
    if (!currentSong) return;
    await unlockAudio();
    if (isPlaying) {
      midiManager.pause();
      setIsPlaying(false);
    } else {
      midiManager.play();
      setIsPlaying(true);
    }
  }, [isPlaying, unlockAudio, currentSong]);

  const handleStop = useCallback(() => {
    midiManager.stop();
    setIsPlaying(false);
  }, []);

  const handleClearSong = useCallback(() => {
    midiManager.clearSong();
    setCurrentSong(null);
    setIsPlaying(false);
  }, []);

  const handleSeek = useCallback((time: number) => {
    midiManager.seek(time);
  }, []);

  const handleSelectSong = useCallback((song: MidiSong) => {
    setCurrentSong(song);
    midiManager.loadSong(song);
    setIsPlaying(false);
  }, []);

  // MIDI File Upload Handler
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        try {
          const song = midiManager.parseMidiFile(arrayBuffer, file.name);
          setCurrentSong(song);
          midiManager.loadSong(song);
          setIsPlaying(false);
        } catch (err) {
          console.error('Failed to parse MIDI file:', err);
          alert('Could not parse this MIDI file. Please ensure it is a valid .mid file.');
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // MIDI Recording Handlers
  const handleToggleRecord = useCallback(() => {
    if (midiRecorder.getIsRecording()) {
      const session = midiRecorder.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      if (session) {
        setRecordingSession(session);
        setShowRecordingModal(true);
      }
    } else {
      unlockAudio();
      midiRecorder.start(sustainPedal, metronomeBpm, dur => {
        setRecordingDuration(dur);
      });
      setIsRecording(true);
      setRecordingDuration(0);
    }
  }, [sustainPedal, metronomeBpm, unlockAudio]);

  const handleDownloadRecording = useCallback((fileName: string) => {
    if (recordingSession) {
      midiRecorder.downloadMidiFile(recordingSession, fileName);
    }
  }, [recordingSession]);

  const handlePlayRecordingInVisualizer = useCallback((session: RecordingSession, customTitle?: string) => {
    unlockAudio();
    const song = midiRecorder.sessionToMidiSong(session, customTitle);
    setCurrentSong(song);
    midiManager.loadSong(song);
    setIsPlaying(true);
    midiManager.play();
  }, [unlockAudio]);

  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;
  const handleNoteOnRef = useRef(handleNoteOn);
  handleNoteOnRef.current = handleNoteOn;
  const handleNoteOffRef = useRef(handleNoteOff);
  handleNoteOffRef.current = handleNoteOff;
  const handleInputTransposeChangeRef = useRef(handleInputTransposeChange);
  handleInputTransposeChangeRef.current = handleInputTransposeChange;

  // Computer Keyboard Listeners (5x12 Isomorphic Matrix)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in text input, select, or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          (target.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'file'].includes((target as HTMLInputElement).type)))
      ) {
        return;
      }

      const baseMidi = keyToMidiMapRef.current[e.code];
      const hk = hotkeysRef.current;

      const isLeftOctave = isHotkeyMatch(e, hk.leftOctaveToggle) && baseMidi === undefined;
      const isTransposeUp = isHotkeyMatch(e, hk.transposeUp) && baseMidi === undefined;
      const isTransposeDown = isHotkeyMatch(e, hk.transposeDown) && baseMidi === undefined;
      const isPlayPause = isHotkeyMatch(e, hk.playPause) && baseMidi === undefined;
      const isRewind = isHotkeyMatch(e, hk.rewind) && baseMidi === undefined;
      const isForward = isHotkeyMatch(e, hk.forward) && baseMidi === undefined;

      // Prevent browser shortcuts (e.g. Zen/Firefox Quick Find on '/' and "'", focus cycling on F6, horizontal scroll on arrows, etc.)
      // PreventDefault must be called immediately, including during key repeats
      if (
        isLeftOctave ||
        isTransposeUp ||
        isTransposeDown ||
        isPlayPause ||
        isRewind ||
        isForward ||
        baseMidi !== undefined
      ) {
        e.preventDefault();
      }

      // Left Board Octave shift toggle (+12 st)
      if (isLeftOctave) {
        if (!e.repeat) {
          const nextShift = leftBoardOctaveShiftRef.current === 0 ? 12 : 0;
          leftBoardOctaveShiftRef.current = nextShift;
          setLeftBoardOctaveShift(nextShift);
        }
        return;
      }

      // Transpose Up (+12 st / 1 Octave, max +36)
      if (isTransposeUp) {
        if (!e.repeat) {
          const nextTranspose = Math.min(36, inputTransposeRef.current + 12);
          handleInputTransposeChangeRef.current(nextTranspose);
        }
        return;
      }

      // Transpose Down (-12 st / 1 Octave, min -36)
      if (isTransposeDown) {
        if (!e.repeat) {
          const nextTranspose = Math.max(-36, inputTransposeRef.current - 12);
          handleInputTransposeChangeRef.current(nextTranspose);
        }
        return;
      }

      // Play/Pause toggle
      if (isPlayPause) {
        if (!e.repeat) {
          handleTogglePlayRef.current();
        }
        return;
      }

      // Rewind / Forward playback
      if (isRewind || isForward) {
        const song = midiManager.getCurrentSong();
        if (song) {
          const currentTime = midiManager.getPlaybackTime();
          const step = e.repeat ? Math.max(1, Math.min(seekSecondsRef.current, 2)) : seekSecondsRef.current;
          const targetTime = isRewind
            ? Math.max(0, currentTime - step)
            : Math.min(song.duration, currentTime + step);
          midiManager.seek(targetTime);
        }
        return;
      }

      if (e.repeat) return;

      // Check note map by physical key code
      if (baseMidi !== undefined) {
        const col = keyToColMapRef.current[e.code] ?? 0;
        const matrixCols = keyboardMatrix[0]?.length || 12;
        const isLeftBoard = col < Math.ceil(matrixCols / 2);
        const octaveOffset = isLeftBoard ? leftBoardOctaveShiftRef.current : 0;

        const transposedMidi = baseMidi + inputTransposeRef.current + octaveOffset;
        if (transposedMidi >= 0 && transposedMidi <= 127) {
          pressedComputerNotesRef.current.set(e.code, transposedMidi);
          const color = colorModeRef.current === 'track'
            ? (keyToColorMapRef.current[e.code] || getNoteColorHex(transposedMidi, 0, 'track'))
            : getNoteColorHex(transposedMidi, 0, colorModeRef.current);
          const inputId = `key:${e.code}`;
          handleNoteOnRef.current(transposedMidi, 0.85, color, inputId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          (target.tagName === 'INPUT' && !['range', 'button', 'checkbox', 'radio', 'file'].includes((target as HTMLInputElement).type)))
      ) {
        return;
      }

      const baseMidi = keyToMidiMapRef.current[e.code];
      const hk = hotkeysRef.current;
      const isTransposeUp = isHotkeyMatch(e, hk.transposeUp) && baseMidi === undefined;
      const isTransposeDown = isHotkeyMatch(e, hk.transposeDown) && baseMidi === undefined;
      const isPlayPause = isHotkeyMatch(e, hk.playPause) && baseMidi === undefined;
      const isRewind = isHotkeyMatch(e, hk.rewind) && baseMidi === undefined;
      const isForward = isHotkeyMatch(e, hk.forward) && baseMidi === undefined;
      if (isTransposeUp || isTransposeDown || isPlayPause || isRewind || isForward || baseMidi !== undefined) {
        e.preventDefault();
      }

      const playedMidi = pressedComputerNotesRef.current.get(e.code);
      if (playedMidi !== undefined) {
        pressedComputerNotesRef.current.delete(e.code);
        const inputId = `key:${e.code}`;
        handleNoteOffRef.current(playedMidi, inputId);
      }
    };

    const handleBlur = () => {
      pressedComputerNotesRef.current.forEach((playedMidi, code) => {
        handleNoteOffRef.current(playedMidi, `key:${code}`);
      });
      pressedComputerNotesRef.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Pointer Lock & Mouse Sustain Pedal Handler
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement !== null;
      setIsMousePedalMode(isLocked);
      isMousePedalModeRef.current = isLocked;

      if (isLocked) {
        // Entering mouse pedal mode: initial state is pedal UP (off)
        setIsMousePedalPressed(false);
        isMousePedalPressedRef.current = false;
        audioEngine.setSustainPedal('off');
        setSustainPedal('off');
      } else {
        // Exited pointer lock: restore previous sustain pedal mode
        setIsMousePedalPressed(false);
        isMousePedalPressedRef.current = false;
        const restored = prevSustainBeforeMousePedalRef.current || 'half';
        audioEngine.setSustainPedal(restored);
        setSustainPedal(restored);
      }
    };

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (!isMousePedalModeRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.button === 2) {
        if (soundInstrumentRef.current === 'string_ensemble_1') return;
        // Right click down: Engage configured sustain pedal mode ('half' or 'full')
        if (!isMousePedalPressedRef.current) {
          const modeToEngage = configuredPedalModeRef.current === 'off' ? 'half' : (configuredPedalModeRef.current || 'half');
          setIsMousePedalPressed(true);
          isMousePedalPressedRef.current = true;
          audioEngine.setSustainPedal(modeToEngage);
          setSustainPedal(modeToEngage);
        }
      }
    };

    const handlePointerUp = (e: MouseEvent | PointerEvent) => {
      if (!isMousePedalModeRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.button === 2) {
        // Right click up: Release sustain pedal
        if (isMousePedalPressedRef.current) {
          setIsMousePedalPressed(false);
          isMousePedalPressedRef.current = false;
          audioEngine.setSustainPedal('off');
          setSustainPedal('off');
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isMousePedalModeRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('mousedown', handlePointerDown, { capture: true });
    window.addEventListener('mouseup', handlePointerUp, { capture: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('mousedown', handlePointerDown, { capture: true });
      window.removeEventListener('mouseup', handlePointerUp, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  // Drag and drop MIDI files onto window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      handleFileUpload(file);
    }
  };

  return (
    <main
      onClick={unlockAudio}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-0 w-full h-full flex flex-col overflow-hidden bg-[#08080b] select-none"
    >
      {/* Dynamic Custom Background Image (Expands to bottom-0 when piano is retracted) */}
      {backgroundImage && (
        <div
          className={`absolute top-0 left-0 right-0 z-0 pointer-events-none overflow-hidden transition-all duration-300 ease-out ${
            pianoRetracted ? 'bottom-0' : 'bottom-[20%]'
          }`}
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: backgroundFit === 'contain' ? 'contain' : 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: backgroundOpacity,
            filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
          }}
        />
      )}

      {/* Floating Minimalist Controls Overlay */}
      <ControlsOverlay
        isPlaying={isPlaying}
        currentSong={currentSong}
        sustainPedal={sustainPedal}
        reverbWet={reverbWet}
        lowPassFilterActive={lowPassFilterActive}
        onLowPassFilterActiveChange={handleLowPassFilterActiveChange}
        lowPassCutoff={lowPassCutoff}
        onLowPassCutoffChange={handleLowPassCutoffChange}
        colorMode={colorMode}
        soundInstrument={soundInstrument}
        onSoundInstrumentChange={handleSoundInstrumentChange}
        stringAttack={stringAttack}
        onStringAttackChange={handleStringAttackChange}
        stringRelease={stringRelease}
        onStringReleaseChange={handleStringReleaseChange}
        fallSpeed={fallSpeed}
        volume={volume}
        isMuted={isMuted}
        keyboardVolume={keyboardVolume}
        isKeyboardMuted={isKeyboardMuted}
        midiInputVolume={midiInputVolume}
        isMidiInputMuted={isMidiInputMuted}
        speedMultiplier={speedMultiplier}
        seekSeconds={seekSeconds}
        isSamplerLoaded={isSamplerLoaded}
        isPinned={isPinned}
        showNoteBlocks={showNoteBlocks}
        showSustainButton={showSustainButton}
        hideWickiText={hideWickiText}
        wickiTextMode={wickiTextMode}
        wickiBoardMode={wickiBoardMode}
        wickiFadeDuration={wickiFadeDuration}
        wickiHighlightOnlyPressed={wickiHighlightOnlyPressed}
        isMousePedalMode={isMousePedalMode}
        isMousePedalPressed={isMousePedalPressed}
        isMobilePortrait={isMobilePortrait}
        midiDevices={midiDevices}
        inputTranspose={inputTranspose}
        midiTranspose={midiTranspose}
        maxVoices={maxVoices}
        targetFps={targetFps}
        metronomeBpm={metronomeBpm}
        metronomeActive={metronomeActive}
        metronomeBeats={metronomeBeats}
        metronomeSound={metronomeSound}
        metronomeVolume={metronomeVolume}
        keyboardMatrix={keyboardMatrix}
        onKeyboardMatrixChange={handleKeyboardMatrixChange}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onClearSong={handleClearSong}
        onSeek={handleSeek}
        onSelectSong={handleSelectSong}
        onToggleSustain={handleToggleSustain}
        onSustainPedalChange={handleSustainPedalChange}
        onEnterMousePedalMode={handleEnterMousePedalMode}
        onReverbWetChange={handleReverbWetChange}
        onColorModeChange={handleColorModeChange}
        onFallSpeedChange={handleFallSpeedChange}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onKeyboardVolumeChange={handleKeyboardVolumeChange}
        onToggleKeyboardMute={handleToggleKeyboardMute}
        onMidiInputVolumeChange={handleMidiInputVolumeChange}
        onToggleMidiInputMute={handleToggleMidiInputMute}
        onSpeedMultiplierChange={handleSpeedMultiplierChange}
        onSeekSecondsChange={handleSeekSecondsChange}
        onInputTransposeChange={handleInputTransposeChange}
        onMidiTransposeChange={handleMidiTransposeChange}
        onMaxVoicesChange={handleMaxVoicesChange}
        onToggleTargetFps={handleToggleTargetFps}
        onTargetFpsChange={handleTargetFpsChange}
        onMetronomeBpmChange={handleMetronomeBpmChange}
        onMetronomeActiveChange={handleMetronomeActiveChange}
        onMetronomeBeatsChange={handleMetronomeBeatsChange}
        onMetronomeSoundChange={handleMetronomeSoundChange}
        onMetronomeVolumeChange={handleMetronomeVolumeChange}
        onTogglePin={handleTogglePin}
        onToggleNoteBlocks={handleToggleNoteBlocks}
        onToggleShowSustainButton={handleToggleShowSustainButton}
        onShowSustainButtonChange={handleShowSustainButtonChange}
        onHideWickiTextChange={handleHideWickiTextChange}
        onWickiTextModeChange={handleWickiTextModeChange}
        onWickiBoardModeChange={handleWickiBoardModeChange}
        onWickiFadeDurationChange={handleWickiFadeDurationChange}
        onWickiHighlightOnlyPressedChange={handleWickiHighlightOnlyPressedChange}
        backgroundImage={backgroundImage}
        onBackgroundImageChange={handleBackgroundImageChange}
        backgroundOpacity={backgroundOpacity}
        onBackgroundOpacityChange={handleBackgroundOpacityChange}
        backgroundBlur={backgroundBlur}
        onBackgroundBlurChange={handleBackgroundBlurChange}
        backgroundFit={backgroundFit}
        onBackgroundFitChange={handleBackgroundFitChange}
        pianoRetracted={pianoRetracted}
        onPianoRetractedChange={handlePianoRetractedChange}
        onTogglePianoRetracted={handleTogglePianoRetracted}
        hudPosition={hudPosition}
        onHudPositionChange={handleHudPositionChange}
        onResetSettings={handleResetSettings}
        hotkeys={hotkeys}
        onHotkeysChange={handleHotkeysChange}
        onResetHotkeys={handleResetHotkeys}
        onFileUpload={handleFileUpload}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        onToggleRecord={handleToggleRecord}
        recordingSession={recordingSession}
        showRecordingModal={showRecordingModal}
        onCloseRecordingModal={() => setShowRecordingModal(false)}
        onOpenRecordingModal={() => setShowRecordingModal(true)}
        onDownloadRecording={handleDownloadRecording}
        onPlayRecordingInVisualizer={handlePlayRecordingInVisualizer}
      />

      {/* Synthesia Visualizer Canvas (Fills full height above keyboard seamlessly) */}
      <div className="w-full flex-1 min-h-0 relative z-30 pointer-events-none">
        <SynthesiaCanvas
          colorMode={colorMode}
          fallSpeed={fallSpeed}
          isPlaying={isPlaying}
          midiTranspose={midiTranspose}
          showNoteBlocks={showNoteBlocks}
          targetFps={targetFps}
          isMobilePortrait={isMobilePortrait}
        />
      </div>

      {/* Responsive Piano Keyboard (84 keys on desktop/landscape, middle 3 octaves on mobile portrait) */}
      <PianoKeyboard
        colorMode={colorMode}
        isMobilePortrait={isMobilePortrait}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
        isRetracted={pianoRetracted}
      />

      {/* Minimalist Drag and Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl border border-white/20 z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="bg-white/[0.05] border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-3">
            <span className="text-zinc-200 font-medium text-sm">
              Drop .mid or .midi file to open
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
