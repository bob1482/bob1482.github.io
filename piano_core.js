// ==========================================
// PIANO CORE: Constants, State, Audio Engine
// ==========================================

const ROWS = 5;
const COLS = 12;
const BASE_NOTE_FREQ = 130.81; // Approx C3
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Evaluate initial screen size for intelligent defaults
const initIsMobile = window.innerWidth <= 850 || window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// --- GLOBAL SETTINGS STATE ---
let transposeLeft = initIsMobile ? -22 : -3;
let transposeRight = initIsMobile ? -22 : -3;
let globalVolume = 0.5;
let globalReverb = 0.3;
let sustainMultiplier = 1.0;
let sustainMode = 0; // 0 = Timed, 1 = Hold until released
let isLoaded = false; 
let sequenceIndex = 0;
let bpm = 120; 
let isMetronomeOn = false; 
let mobileZoom = initIsMobile ? 1.30 : 0.65; // 130 on mobile, 65 on desktop
let boardOffsetX = 0;
let boardOffsetY = 0;
let showMobileStrip = true;
let stripHeight = initIsMobile ? 5 : 16; // 5 on mobile, 16 on desktop
let layoutMode = 0; // 0 = Auto, 1 = Desktop, 2 = Mobile
let stripRangeLeft = initIsMobile ? 0 : -27; // 0 on mobile, -27 on desktop
let stripRangeRight = initIsMobile ? 47 : 60; // 47 on mobile, 60 on desktop
let customBackground = null; // Holds the base64 image data
let customKeyIdle = null;
let customKeyPressed = null;
let transposeSequence = "5:5 12:12 -17:-17";

// --- PHYSICAL KEY TRACKING ---
let activePhysicalKeys = {}; 

let labelMode = 1; // 0 = Notes, 1 = Keys, 2 = Numeric, 3 = None
const LABEL_MODES = ["NOTES", "KEYS", "NUMERIC", "NONE"];

let fKeyMode = 0; 
const F_ROW_VARIANTS = [
  ["F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","PrintScreen"], 
  ["F1","F2","F3","F4","","F5","F6","F7","F8","F9","F10","F11"], 
  ["","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"], 
  ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"] 
];
const F_KEY_LABELS = ["laptop","100r","100s","1-1", "8-row"];

// --- DATA MAPS ---
let freqToKeyMap = {};

const BASE_BOTTOM_ROWS = [
  ["Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","Minus","Equal","Backspace"],
  ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"],
  ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote", "Enter"],
  ["ShiftLeft","KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash","ShiftRight"]
];

const SPECIAL_8_ROW_MAP = [
  ["F7","F8","F9","F10","F11","F12","Numpad5","Numpad6","Numpad7","Numpad8","Numpad9","NumpadAdd"],
  ["F1","F2","F3","F4","F5","F6","Numpad0","Numpad1","Numpad2","Numpad3","Numpad4","NumpadSubtract"],
  ["Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace","F7","F8","F9","F10","F11","F12"],
  ["KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft","BracketRight","F1","F2","F3","F4","F5","F6"],
  ["Digit2", "Digit3", "Digit4", "Digit5", "Digit6","Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH","KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
  ["ShiftLeft", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB",  "KeyN", "KeyM", "Comma", "Period", "Slash", "ShiftRight"]
];

let KEY_MAPS = [];

function applyKeyMapMode() {
    if (fKeyMode === 4) {
        KEY_MAPS = [...SPECIAL_8_ROW_MAP];
    } else {
        KEY_MAPS = [F_ROW_VARIANTS[fKeyMode], ...BASE_BOTTOM_ROWS];
    }
}

applyKeyMapMode();

// --- RECORDER & PLAYBACK STATE ---
let isRecording = false;
let isPlaying = false;
let isPaused = false;
let recordedEvents = []; // The current buffer (either being recorded or played)
let recordingStartTime = 0;

// MULTI-RECORDING STORAGE
let recordingsList = []; // Array of objects: { name, events, duration }
let currentRecordingIndex = -1; // -1 means using raw buffer (recordedEvents)

let playbackRate = 1.0;
let playbackTranspose = 0; // Transpose for recordings/MIDI files in semitones
let fallDuration = 2.0;
let manualRiseSpeed = 100; // Speed in pixels per second

// --- AUDIO ENGINE (TONE.JS) ---
Tone.context.lookAhead = 0.05; 

// OPTIMIZATION: Reduced Polyphony Cap to prevent CPU stutter
const MAX_POLYPHONY = 48; 
let activeVoices = []; // Now treated as a simple ring buffer
let timedSustainTrackers = {};
let nextVoiceId = 1;

const reverb = new Tone.Reverb({
    decay: 2.5,
    preDelay: 0.01, 
    wet: globalReverb
}).toDestination();

const sampler = new Tone.Sampler({
    urls: {
        "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", "A1": "A1.mp3",
        "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", "A2": "A2.mp3",
        "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", "A3": "A3.mp3",
        "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", "A4": "A4.mp3",
        "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", "A5": "A5.mp3",
        "C6": "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", "A6": "A6.mp3",
        "C7": "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", "A7": "A7.mp3",
        "C8": "C8.mp3"
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    onload: () => {
        isLoaded = true;
        reverb.generate(); 
        console.log("Samples loaded.");
        window.dispatchEvent(new Event('samplesLoaded'));
    }
}).connect(reverb);

Tone.Destination.volume.value = Tone.gainToDb(globalVolume);

// --- METRONOME ---
const metroSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
}).toDestination();
metroSynth.volume.value = -10;

const metroLoop = new Tone.Loop((time) => {
    metroSynth.triggerAttackRelease("C5", "32n", time);
}, "4n");

Tone.Transport.bpm.value = bpm;

// --- AUDIO FUNCTIONS ---

function removeActiveVoiceById(voiceId) {
  activeVoices = activeVoices.filter((voice) => voice.id !== voiceId);
}

function getTimedSustainTrackerKey(frequency) {
  return frequency.toFixed(5);
}

function clearTimedSustainTrackerByKey(
  trackerKey,
  releaseAudio = true,
  releaseTime = Tone.now(),
  expectedVoiceId = null
) {
  const tracker = timedSustainTrackers[trackerKey];
  if (!tracker) return false;
  if (expectedVoiceId !== null && tracker.voiceId !== expectedVoiceId) return false;

  clearTimeout(tracker.timeoutId);

  if (releaseAudio && typeof sampler !== "undefined") {
    sampler.triggerRelease(tracker.freq, releaseTime);
  }

  removeActiveVoiceById(tracker.voiceId);
  delete timedSustainTrackers[trackerKey];
  return true;
}

function clearTimedSustainTrackers(releaseAudio = true) {
  const releaseTime = Tone.now();

  Object.keys(timedSustainTrackers).forEach((trackerKey) => {
    clearTimedSustainTrackerByKey(trackerKey, releaseAudio, releaseTime);
  });
}

function triggerSound(frequency, when = 0, forceDuration = null) {
  if (when === 0) when = Tone.now();
  const voiceId = nextVoiceId++;

  if (activeVoices.length >= MAX_POLYPHONY) {
    const stolenVoice = activeVoices.shift(); 
    if (stolenVoice) {
      if (stolenVoice.timedTrackerKey !== undefined) {
        clearTimedSustainTrackerByKey(
          stolenVoice.timedTrackerKey,
          false,
          when,
          stolenVoice.id
        );
      }
      sampler.triggerRelease(stolenVoice.freq, when);
    }
  }

  const voice = {
    id: voiceId,
    freq: frequency,
    startTime: when 
  };
  activeVoices.push(voice);

  if (forceDuration !== null) {
    sampler.triggerAttackRelease(frequency, forceDuration, when);
    const cleanupDelay = Math.max(0, ((when - Tone.now()) + forceDuration) * 1000);
    window.setTimeout(() => {
      removeActiveVoiceById(voiceId);
    }, cleanupDelay);
  } else if (sustainMode === 1) {
    sampler.triggerAttack(frequency, when);
  } else {
    const baseDuration = 2;
    const duration = Math.min(baseDuration * sustainMultiplier, 5);
    const releaseDelay = Math.max(0, ((when - Tone.now()) + duration) * 1000);
    const trackerKey = getTimedSustainTrackerKey(frequency);

    // Reset the note's timer so repeated presses do not get cut off by older releases.
    clearTimedSustainTrackerByKey(trackerKey, false, when);

    sampler.triggerAttack(frequency, when);

    const timeoutId = window.setTimeout(() => {
      const tracker = timedSustainTrackers[trackerKey];
      if (!tracker || tracker.voiceId !== voiceId) return;

      if (typeof sampler !== "undefined") {
        sampler.triggerRelease(frequency, Tone.now());
      }

      removeActiveVoiceById(voiceId);
      delete timedSustainTrackers[trackerKey];
    }, releaseDelay);

    voice.timedTrackerKey = trackerKey;
    timedSustainTrackers[trackerKey] = {
      timeoutId,
      freq: frequency,
      voiceId
    };
  }
}

function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ==========================================
// SETTINGS PERSISTENCE (LOCAL STORAGE)
// ==========================================

function saveSettings() {
    const settings = {
        transposeLeft: transposeLeft,
        transposeRight: transposeRight,
        globalVolume: globalVolume,
        globalReverb: globalReverb,
        sustainMultiplier: sustainMultiplier,
        sustainMode: sustainMode,
        bpm: bpm,
        labelMode: labelMode,
        fKeyMode: fKeyMode,
        isVisualizerOn: typeof isVisualizerOn !== 'undefined' ? isVisualizerOn : true,
        mobileZoom: mobileZoom,
        showMobileStrip: showMobileStrip,
        stripHeight: stripHeight,
        layoutMode: layoutMode,
        stripRangeLeft: stripRangeLeft,
        stripRangeRight: stripRangeRight,
        customBackground: customBackground,
        customKeyIdle: customKeyIdle,
        customKeyPressed: customKeyPressed,
        transposeSequence: transposeSequence,
        boardOffsetX: boardOffsetX,
        boardOffsetY: boardOffsetY,
        playbackRate: playbackRate,
        playbackTranspose: playbackTranspose,
        fallDuration: fallDuration,
        manualRiseSpeed: manualRiseSpeed
    };

    try {
        localStorage.setItem('wickiPianoSettings', JSON.stringify(settings));
        console.log("Settings Saved");
    } catch (e) {
        console.warn("Storage full. Could not save background permanently.", e);
    }
}

function loadSettings() {
    const saved = localStorage.getItem('wickiPianoSettings');
    if (!saved) return; // No settings found, keep defaults

    try {
        const settings = JSON.parse(saved);
        
        // Restore values (with fallback to current defaults if undefined)
        if (settings.transposeLeft !== undefined) transposeLeft = settings.transposeLeft;
        if (settings.transposeRight !== undefined) transposeRight = settings.transposeRight;
        if (settings.globalVolume !== undefined) globalVolume = settings.globalVolume;
        if (settings.globalReverb !== undefined) globalReverb = settings.globalReverb;
        if (settings.sustainMultiplier !== undefined) sustainMultiplier = settings.sustainMultiplier;
        if (settings.sustainMode !== undefined) sustainMode = settings.sustainMode;
        if (settings.bpm !== undefined) bpm = settings.bpm;
        if (settings.labelMode !== undefined) labelMode = settings.labelMode;
        if (settings.fKeyMode !== undefined) fKeyMode = settings.fKeyMode;
        if (settings.mobileZoom !== undefined) mobileZoom = settings.mobileZoom;
        if (settings.showMobileStrip !== undefined) showMobileStrip = settings.showMobileStrip;
        if (settings.stripHeight !== undefined) {
            stripHeight = settings.stripHeight;
        } else if (settings.stripHeightMode !== undefined) {
            // Backward compatibility with legacy 3-state strip height setting.
            if (settings.stripHeightMode === 1) stripHeight = 30;
            else if (settings.stripHeightMode === 2) stripHeight = 10;
            else stripHeight = initIsMobile ? 0 : 16;
        }
        stripHeight = parseFloat(stripHeight);
        if (Number.isNaN(stripHeight)) stripHeight = initIsMobile ? 0 : 16;
        if (stripHeight < 0) stripHeight = 0;
        if (stripHeight > 50) stripHeight = 50;
        if (settings.isVisualizerOn !== undefined && typeof isVisualizerOn !== 'undefined') {
            isVisualizerOn = settings.isVisualizerOn;
        }
        if (settings.layoutMode !== undefined) layoutMode = settings.layoutMode;
        if (settings.stripRangeLeft !== undefined) {
            stripRangeLeft = settings.stripRangeLeft;
        } else {
            stripRangeLeft = initIsMobile ? 0 : -27;
        }
        if (settings.stripRangeRight !== undefined) {
            stripRangeRight = settings.stripRangeRight;
        } else {
            stripRangeRight = initIsMobile ? 47 : 60;
        }
        if (settings.customBackground !== undefined) {
            customBackground = settings.customBackground;
            if (typeof applyBackground === 'function') applyBackground();
        }
        if (settings.customKeyIdle !== undefined) customKeyIdle = settings.customKeyIdle;
        if (settings.customKeyPressed !== undefined) customKeyPressed = settings.customKeyPressed;
        if (settings.transposeSequence !== undefined) {
            transposeSequence = settings.transposeSequence;
            const seqInput = document.getElementById("input-sequence");
            if (seqInput) seqInput.value = transposeSequence;
        }
        if (settings.boardOffsetX !== undefined) boardOffsetX = settings.boardOffsetX;
        if (settings.boardOffsetY !== undefined) boardOffsetY = settings.boardOffsetY;
        if (settings.playbackRate !== undefined) playbackRate = settings.playbackRate;
        if (settings.playbackTranspose !== undefined) playbackTranspose = settings.playbackTranspose;
        if (settings.fallDuration !== undefined) fallDuration = settings.fallDuration;
        if (settings.manualRiseSpeed !== undefined) manualRiseSpeed = settings.manualRiseSpeed;
        playbackRate = Math.max(0.25, Math.min(3.0, Number(playbackRate) || 1.0));
        playbackTranspose = Math.max(-50, Math.min(50, Math.round(Number(playbackTranspose) || 0)));
        fallDuration = Math.max(0.5, Math.min(10.0, Number(fallDuration) || 2.0));
        manualRiseSpeed = Math.max(10, Math.min(1000, Number(manualRiseSpeed) || 100));
        globalReverb = Math.max(0, Math.min(1, Number(globalReverb) || 0));
        fKeyMode = ((Math.round(Number(fKeyMode) || 0) % F_KEY_LABELS.length) + F_KEY_LABELS.length) % F_KEY_LABELS.length;
        if (typeof applyKeyImages === 'function') applyKeyImages();
        
        // Apply complex settings
        Tone.Destination.volume.value = Tone.gainToDb(globalVolume);
        if (typeof reverb !== 'undefined') reverb.wet.value = globalReverb;
        Tone.Transport.bpm.value = bpm;
        
        // Update Mappings if F-Keys changed
        if (typeof applyKeyMapMode === 'function') {
             applyKeyMapMode();
        }

        console.log("Settings Loaded");
        
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
}

function resetSettings() {
    localStorage.removeItem('wickiPianoSettings');
    location.reload();
}

// ==========================================
// GRANULAR MEMORY RESET
// ==========================================

function openResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.classList.add('active');

    resetResetModalState();
}

function closeResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.classList.remove('active');

    resetResetModalState();
}

function toggleFullReset(isFull) {
    const subResets = document.querySelectorAll('.sub-reset');
    subResets.forEach((cb) => {
        cb.disabled = isFull;
        if (isFull) cb.checked = true;
    });
}

function resetResetModalState() {
    const resetRecs = document.getElementById('reset-recs');
    if (resetRecs) {
        resetRecs.checked = false;
        resetRecs.disabled = false;
    }

    const resetMedia = document.getElementById('reset-media');
    if (resetMedia) {
        resetMedia.checked = false;
        resetMedia.disabled = false;
    }

    const resetPrefs = document.getElementById('reset-prefs');
    if (resetPrefs) {
        resetPrefs.checked = true;
        resetPrefs.disabled = false;
    }

    const resetFull = document.getElementById('reset-full');
    if (resetFull) resetFull.checked = false;
}

function executeReset() {
    const resetRecs = document.getElementById('reset-recs').checked;
    const resetMedia = document.getElementById('reset-media').checked;
    const resetPrefs = document.getElementById('reset-prefs').checked;
    const resetFull = document.getElementById('reset-full').checked;

    if (!resetRecs && !resetMedia && !resetPrefs && !resetFull) {
        closeResetModal();
        return; // Nothing selected!
    }

    // Safety: Stop audio and release keys during any reset
    if (typeof stopPlayback === 'function') stopPlayback();
    if (typeof releaseAllStuckNotes === 'function') releaseAllStuckNotes();
    if (typeof clearTimedSustainTrackers === 'function') clearTimedSustainTrackers(false);
    if (typeof sampler !== 'undefined') sampler.releaseAll();

    if (resetFull) {
        localStorage.removeItem('wickiPianoSettings');
        location.reload();
        return;
    }

    // 1. Clear Recordings
    if (resetRecs) {
        recordingsList = [];
        recordedEvents = [];
        currentRecordingIndex = -1;
        isRecording = false;
        if (typeof updateRecordSelectUI === 'function') updateRecordSelectUI();
        if (typeof recycleAllNotes === 'function') recycleAllNotes();
    }

    // 2. Manage Local Storage & Preferences
    if (resetMedia || resetPrefs) {
        let saved = localStorage.getItem('wickiPianoSettings');
        let settings = saved ? JSON.parse(saved) : {};

        // Wipe Custom Images
        if (resetMedia) {
            customBackground = null;
            customKeyIdle = null;
            customKeyPressed = null;
            delete settings.customBackground;
            delete settings.customKeyIdle;
            delete settings.customKeyPressed;
            if (typeof applyBackground === 'function') applyBackground();
            if (typeof applyKeyImages === 'function') applyKeyImages();
        }

        // Soft Reset all UI and preferences without reloading
        if (resetPrefs) {
            // Reset live variables to startup defaults
            transposeLeft = initIsMobile ? -22 : -3;
            transposeRight = initIsMobile ? -22 : -3;
            transposeSequence = "5:5 12:12 -17:-17";
            sustainMode = 0;
            sequenceIndex = 0;
            boardOffsetX = 0;
            boardOffsetY = 0;
            globalVolume = 0.5;
            globalReverb = 0.3;
            sustainMultiplier = 1.0;
            bpm = 120;
            playbackRate = 1.0;
            playbackTranspose = 0;
            fallDuration = 2.0;
            manualRiseSpeed = 100;
            mobileZoom = initIsMobile ? 1.30 : 0.65;
            stripHeight = initIsMobile ? 5 : 16;
            showMobileStrip = true;
            layoutMode = 0;
            stripRangeLeft = initIsMobile ? 0 : -27;
            stripRangeRight = initIsMobile ? 47 : 60;
            labelMode = 1;
            fKeyMode = 0;
            if (typeof isVisualizerOn !== 'undefined') isVisualizerOn = true;

            // Delete them from saved settings so they do not persist
            const keysToDelete = [
                'transposeLeft',
                'transposeRight',
                'transposeSequence',
                'sustainMode',
                'boardOffsetX',
                'boardOffsetY',
                'globalVolume',
                'globalReverb',
                'sustainMultiplier',
                'bpm',
                'playbackRate',
                'playbackTranspose',
                'fallDuration',
                'manualRiseSpeed',
                'mobileZoom',
                'showMobileStrip',
                'stripHeight',
                'layoutMode',
                'stripRangeLeft',
                'stripRangeRight',
                'labelMode',
                'fKeyMode',
                'isVisualizerOn'
            ];
            keysToDelete.forEach((key) => delete settings[key]);

            // Reset physical UI inputs and audio parameters
            const seqInput = document.getElementById("input-sequence");
            if (seqInput) seqInput.value = transposeSequence;
            const bpmInput = document.getElementById("input-bpm");
            if (bpmInput) bpmInput.value = bpm;

            if (typeof Tone !== 'undefined' && Tone.Destination) {
                Tone.Destination.volume.value = Tone.gainToDb(globalVolume);
                if (typeof reverb !== 'undefined') reverb.wet.value = globalReverb;
                Tone.Transport.bpm.value = bpm;
            }

            // Re-apply layout and redraw everything
            if (typeof applyKeyMapMode === 'function') applyKeyMapMode();
            if (typeof applyLayoutModeClass === 'function') applyLayoutModeClass();
            if (typeof applyMobileStripState === 'function') applyMobileStripState();
            if (typeof applyStripHeight === 'function') applyStripHeight();
            if (typeof renderBoard === 'function') renderBoard();
            if (typeof applyZoom === 'function') applyZoom();
            if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
        }

        localStorage.setItem('wickiPianoSettings', JSON.stringify(settings));
    }

    closeResetModal();

    // Always update the visible numbers and buttons at the end
    if (typeof updateUI === 'function') updateUI();
}
