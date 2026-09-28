export type SustainMode = 'off' | 'half' | 'full';

export type ColorMode = 'track' | 'gradient' | 'outline';

export type TargetFps = 72 | 144;

export type WickiBoardMode = 'off' | 'fade' | 'always';
export type WickiTextMode = 'mapping' | 'keys' | 'notes' | 'simplified' | 'off';

export type SoundInstrument = 'salamander' | 'string_ensemble_1';

export type BackgroundFit = 'cover' | 'contain';
export type HudPosition = 'top' | 'right';

export interface HotkeyBindings {
  playPause: string;
  forward: string;
  rewind: string;
  transposeUp: string;
  transposeDown: string;
  leftOctaveToggle: string;
}

export const DEFAULT_HOTKEYS: HotkeyBindings = {
  playPause: 'Space',
  forward: 'ArrowRight',
  rewind: 'ArrowLeft',
  transposeUp: 'Backslash',
  transposeDown: 'Tab',
  leftOctaveToggle: 'Digit1',
};

export interface UserSettings {
  colorMode: ColorMode;
  soundInstrument: SoundInstrument;
  stringAttack: number;
  stringRelease: number;
  fallSpeed: number;
  reverbWet: number;
  lowPassFilterActive: boolean;
  lowPassCutoff: number;
  sustainPedal: SustainMode;
  lastPianoSustainPedal?: SustainMode;
  volume: number;
  isMuted: boolean;
  keyboardVolume: number;
  isKeyboardMuted: boolean;
  midiInputVolume: number;
  isMidiInputMuted: boolean;
  speedMultiplier: number;
  seekSeconds: number;
  isPinned: boolean;
  showNoteBlocks: boolean;
  showSustainButton: boolean;
  hideWickiText: boolean;
  wickiTextMode: WickiTextMode;
  wickiBoardMode: WickiBoardMode;
  wickiFadeDuration: number;
  wickiHighlightOnlyPressed: boolean;
  inputTranspose: number;
  midiTranspose: number;
  maxVoices: number;
  targetFps: TargetFps;
  metronomeBpm: number;
  metronomeActive: boolean;
  metronomeBeats: number;
  metronomeSound: boolean;
  metronomeVolume: number;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  backgroundFit: BackgroundFit;
  pianoRetracted: boolean;
  hudPosition: HudPosition;
  hotkeys: HotkeyBindings;
}

export const DEFAULT_SETTINGS: UserSettings = {
  colorMode: 'track',
  soundInstrument: 'salamander',
  stringAttack: 0.1,
  stringRelease: 1.2,
  fallSpeed: 300,
  reverbWet: 0.35,
  lowPassFilterActive: false,
  lowPassCutoff: 2200,
  sustainPedal: 'half',
  lastPianoSustainPedal: 'half',
  volume: 0,
  isMuted: false,
  keyboardVolume: 0,
  isKeyboardMuted: false,
  midiInputVolume: 0,
  isMidiInputMuted: false,
  speedMultiplier: 1.0,
  seekSeconds: 5,
  isPinned: true,
  showNoteBlocks: true,
  showSustainButton: true,
  hideWickiText: false,
  wickiTextMode: 'keys',
  wickiBoardMode: 'off',
  wickiFadeDuration: 1.5,
  wickiHighlightOnlyPressed: false,
  inputTranspose: 0,
  midiTranspose: 0,
  maxVoices: 64,
  targetFps: 72,
  metronomeBpm: 120,
  metronomeActive: false,
  metronomeBeats: 4,
  metronomeSound: true,
  metronomeVolume: 0,
  backgroundImage: '',
  backgroundOpacity: 0.8,
  backgroundBlur: 0,
  backgroundFit: 'cover',
  pianoRetracted: false,
  hudPosition: 'top',
  hotkeys: DEFAULT_HOTKEYS,
};

const STORAGE_KEY = 'synthesia_piano_settings_v1';

/**
 * Safely load stored settings from localStorage with fallback to defaults
 */
export function loadStoredSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_SETTINGS };
    }

    const resolvedInstrument: SoundInstrument =
      parsed.soundInstrument === 'string_ensemble_1' || parsed.soundInstrument === 'salamander'
        ? parsed.soundInstrument
        : DEFAULT_SETTINGS.soundInstrument;

    const resolvedLastPianoSustain: SustainMode =
      parsed.lastPianoSustainPedal === 'half' || parsed.lastPianoSustainPedal === 'full'
        ? parsed.lastPianoSustainPedal
        : parsed.sustainPedal === 'half' || parsed.sustainPedal === 'full'
          ? parsed.sustainPedal
          : 'half';

    const resolvedSustain: SustainMode =
      resolvedInstrument === 'string_ensemble_1'
        ? 'off'
        : parsed.sustainPedal === 'off' || parsed.sustainPedal === 'half' || parsed.sustainPedal === 'full'
          ? parsed.sustainPedal
          : parsed.sustainPedal === true
            ? 'full'
            : parsed.sustainPedal === false
              ? 'off'
              : DEFAULT_SETTINGS.sustainPedal;

    const settings: UserSettings = {
      colorMode:
        parsed.colorMode === 'track' || parsed.colorMode === 'gradient' || parsed.colorMode === 'outline'
          ? parsed.colorMode
          : DEFAULT_SETTINGS.colorMode,
      soundInstrument: resolvedInstrument,
      stringAttack:
        typeof parsed.stringAttack === 'number' && parsed.stringAttack >= 0 && parsed.stringAttack <= 2.0
          ? parsed.stringAttack
          : DEFAULT_SETTINGS.stringAttack,
      stringRelease:
        typeof parsed.stringRelease === 'number' && parsed.stringRelease >= 0.05 && parsed.stringRelease <= 5.0
          ? parsed.stringRelease
          : DEFAULT_SETTINGS.stringRelease,
      fallSpeed:
        typeof parsed.fallSpeed === 'number' && parsed.fallSpeed >= 120 && parsed.fallSpeed <= 480
          ? parsed.fallSpeed
          : DEFAULT_SETTINGS.fallSpeed,
      reverbWet:
        typeof parsed.reverbWet === 'number' && parsed.reverbWet >= 0 && parsed.reverbWet <= 1
          ? parsed.reverbWet
          : DEFAULT_SETTINGS.reverbWet,
      lowPassFilterActive:
        typeof parsed.lowPassFilterActive === 'boolean'
          ? parsed.lowPassFilterActive
          : DEFAULT_SETTINGS.lowPassFilterActive,
      lowPassCutoff:
        typeof parsed.lowPassCutoff === 'number' && parsed.lowPassCutoff >= 400 && parsed.lowPassCutoff <= 12000
          ? parsed.lowPassCutoff
          : DEFAULT_SETTINGS.lowPassCutoff,
      sustainPedal: resolvedSustain,
      lastPianoSustainPedal: resolvedLastPianoSustain,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= -10 && parsed.volume <= 10
          ? parsed.volume
          : DEFAULT_SETTINGS.volume,
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : DEFAULT_SETTINGS.isMuted,
      keyboardVolume:
        typeof parsed.keyboardVolume === 'number' && parsed.keyboardVolume >= -10 && parsed.keyboardVolume <= 10
          ? parsed.keyboardVolume
          : DEFAULT_SETTINGS.keyboardVolume,
      isKeyboardMuted:
        typeof parsed.isKeyboardMuted === 'boolean' ? parsed.isKeyboardMuted : DEFAULT_SETTINGS.isKeyboardMuted,
      midiInputVolume:
        typeof parsed.midiInputVolume === 'number' && parsed.midiInputVolume >= -10 && parsed.midiInputVolume <= 10
          ? parsed.midiInputVolume
          : DEFAULT_SETTINGS.midiInputVolume,
      isMidiInputMuted:
        typeof parsed.isMidiInputMuted === 'boolean' ? parsed.isMidiInputMuted : DEFAULT_SETTINGS.isMidiInputMuted,
      speedMultiplier:
        typeof parsed.speedMultiplier === 'number' && parsed.speedMultiplier >= 0.25 && parsed.speedMultiplier <= 3.0
          ? parsed.speedMultiplier
          : DEFAULT_SETTINGS.speedMultiplier,
      seekSeconds:
        typeof parsed.seekSeconds === 'number' && parsed.seekSeconds >= 1 && parsed.seekSeconds <= 10
          ? parsed.seekSeconds
          : DEFAULT_SETTINGS.seekSeconds,
      isPinned: typeof parsed.isPinned === 'boolean' ? parsed.isPinned : DEFAULT_SETTINGS.isPinned,
      showNoteBlocks:
        typeof parsed.showNoteBlocks === 'boolean' ? parsed.showNoteBlocks : DEFAULT_SETTINGS.showNoteBlocks,
      showSustainButton:
        typeof parsed.showSustainButton === 'boolean' ? parsed.showSustainButton : DEFAULT_SETTINGS.showSustainButton,
      hideWickiText:
        typeof parsed.hideWickiText === 'boolean'
          ? parsed.hideWickiText
          : parsed.wickiTextMode === 'off',
      wickiTextMode:
        parsed.wickiTextMode === 'mapping' ||
        parsed.wickiTextMode === 'keys' ||
        parsed.wickiTextMode === 'notes' ||
        parsed.wickiTextMode === 'simplified' ||
        parsed.wickiTextMode === 'off'
          ? (parsed.wickiTextMode === 'notes' ? 'keys' : parsed.wickiTextMode)
          : parsed.hideWickiText === true
            ? 'off'
            : DEFAULT_SETTINGS.wickiTextMode,
      wickiBoardMode:
        parsed.wickiBoardMode === 'off' || parsed.wickiBoardMode === 'fade' || parsed.wickiBoardMode === 'always'
          ? parsed.wickiBoardMode
          : parsed.wickiBoardMode === true
            ? 'always'
            : parsed.wickiBoardMode === false
              ? 'off'
              : DEFAULT_SETTINGS.wickiBoardMode,
      wickiFadeDuration:
        typeof parsed.wickiFadeDuration === 'number' && parsed.wickiFadeDuration >= 0.2 && parsed.wickiFadeDuration <= 10
          ? parsed.wickiFadeDuration
          : DEFAULT_SETTINGS.wickiFadeDuration,
      wickiHighlightOnlyPressed:
        typeof parsed.wickiHighlightOnlyPressed === 'boolean'
          ? parsed.wickiHighlightOnlyPressed
          : DEFAULT_SETTINGS.wickiHighlightOnlyPressed,
      inputTranspose:
        typeof parsed.inputTranspose === 'number' && parsed.inputTranspose >= -36 && parsed.inputTranspose <= 36
          ? parsed.inputTranspose
          : DEFAULT_SETTINGS.inputTranspose,
      midiTranspose:
        typeof parsed.midiTranspose === 'number' && parsed.midiTranspose >= -36 && parsed.midiTranspose <= 36
          ? parsed.midiTranspose
          : DEFAULT_SETTINGS.midiTranspose,
      maxVoices:
        typeof parsed.maxVoices === 'number' && parsed.maxVoices >= 0 && parsed.maxVoices <= 512
          ? parsed.maxVoices
          : DEFAULT_SETTINGS.maxVoices,
      targetFps:
        parsed.targetFps === 144 || parsed.targetFps === 72
          ? parsed.targetFps
          : DEFAULT_SETTINGS.targetFps,
      metronomeBpm:
        typeof parsed.metronomeBpm === 'number' && parsed.metronomeBpm >= 20 && parsed.metronomeBpm <= 300
          ? parsed.metronomeBpm
          : DEFAULT_SETTINGS.metronomeBpm,
      metronomeActive:
        typeof parsed.metronomeActive === 'boolean'
          ? parsed.metronomeActive
          : DEFAULT_SETTINGS.metronomeActive,
      metronomeBeats:
        typeof parsed.metronomeBeats === 'number' && parsed.metronomeBeats >= 1 && parsed.metronomeBeats <= 12
          ? parsed.metronomeBeats
          : DEFAULT_SETTINGS.metronomeBeats,
      metronomeSound:
        typeof parsed.metronomeSound === 'boolean'
          ? parsed.metronomeSound
          : DEFAULT_SETTINGS.metronomeSound,
      metronomeVolume:
        typeof parsed.metronomeVolume === 'number' && parsed.metronomeVolume >= -10 && parsed.metronomeVolume <= 10
          ? parsed.metronomeVolume
          : DEFAULT_SETTINGS.metronomeVolume,
      backgroundImage:
        typeof parsed.backgroundImage === 'string'
          ? parsed.backgroundImage
          : DEFAULT_SETTINGS.backgroundImage,
      backgroundOpacity:
        typeof parsed.backgroundOpacity === 'number' && parsed.backgroundOpacity >= 0.05 && parsed.backgroundOpacity <= 1
          ? parsed.backgroundOpacity
          : DEFAULT_SETTINGS.backgroundOpacity,
      backgroundBlur:
        typeof parsed.backgroundBlur === 'number' && parsed.backgroundBlur >= 0 && parsed.backgroundBlur <= 30
          ? parsed.backgroundBlur
          : DEFAULT_SETTINGS.backgroundBlur,
      backgroundFit:
        parsed.backgroundFit === 'contain' || parsed.backgroundFit === 'cover'
          ? parsed.backgroundFit
          : DEFAULT_SETTINGS.backgroundFit,
      pianoRetracted:
        typeof parsed.pianoRetracted === 'boolean'
          ? parsed.pianoRetracted
          : DEFAULT_SETTINGS.pianoRetracted,
      hudPosition:
        parsed.hudPosition === 'right' || parsed.hudPosition === 'top'
          ? parsed.hudPosition
          : DEFAULT_SETTINGS.hudPosition,
      hotkeys: {
        playPause:
          typeof parsed.hotkeys?.playPause === 'string' && parsed.hotkeys.playPause
            ? parsed.hotkeys.playPause
            : DEFAULT_HOTKEYS.playPause,
        forward:
          typeof parsed.hotkeys?.forward === 'string' && parsed.hotkeys.forward
            ? parsed.hotkeys.forward
            : DEFAULT_HOTKEYS.forward,
        rewind:
          typeof parsed.hotkeys?.rewind === 'string' && parsed.hotkeys.rewind
            ? parsed.hotkeys.rewind
            : DEFAULT_HOTKEYS.rewind,
        transposeUp:
          typeof parsed.hotkeys?.transposeUp === 'string' && parsed.hotkeys.transposeUp
            ? parsed.hotkeys.transposeUp
            : DEFAULT_HOTKEYS.transposeUp,
        transposeDown:
          typeof parsed.hotkeys?.transposeDown === 'string' && parsed.hotkeys.transposeDown
            ? parsed.hotkeys.transposeDown
            : DEFAULT_HOTKEYS.transposeDown,
        leftOctaveToggle:
          typeof parsed.hotkeys?.leftOctaveToggle === 'string' && parsed.hotkeys.leftOctaveToggle
            ? parsed.hotkeys.leftOctaveToggle
            : DEFAULT_HOTKEYS.leftOctaveToggle,
      },
    };

    return settings;
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Safely save settings to localStorage
 */
export function saveStoredSettings(settings: Partial<UserSettings>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = loadStoredSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e);
  }
}

/**
 * Safely reset stored settings in localStorage to defaults
 */
export function resetStoredSettings(): UserSettings {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.warn('Failed to reset settings in localStorage:', e);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

