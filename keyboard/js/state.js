// ==========================================
// PIANO CORE: Constants, State, Audio Engine
// ==========================================

const ROWS = 5;
const COLS = 12;
const BASE_NOTE_FREQ = 130.81; // Approx C3
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- GLOBAL SETTINGS STATE ---
let transpose = -3;
let sustainMultiplier = 1.0;
let sustainMode = 0; // 0 = Timed only
let isLoaded = false;
let bpm = 120;
let mobileZoom = 1.0;
let stripHeight = 16;
let stripRangeLeft = -27;
let stripRangeRight = 60;
let sequenceIndex = 0;

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

// --- PLAYBACK STATE ---
let isPlaying = false;
let isPaused = false;

let playbackRate = 1.0;
let playbackTranspose = 0; // Transpose for MIDI files in semitones
let fallDuration = 5.0;
let manualRiseSpeed = 70; // Speed in pixels per second

// --- WEB AUDIO API ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Master gain node
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(audioCtx.destination);

// Global volume constant (can still be set but no UI for it)
let globalVolume = 0.5;

// --- SAMPLER (Local .mp3 files from sample/ folder) ---
// Map from note name to (baseFrequency, sampleUrl)
const SAMPLE_MAP = {
  "A0":  { note: "A0", freq: 27.5 },
  "A1":  { note: "A1", freq: 55 },
  "A2":  { note: "A2", freq: 110 },
  "A3":  { note: "A3", freq: 220 },
  "A4":  { note: "A4", freq: 440 },
  "A5":  { note: "A5", freq: 880 },
  "A6":  { note: "A6", freq: 1760 },
  "A7":  { note: "A7", freq: 3520 },
  "C1":  { note: "C1", freq: 32.703 },
  "C2":  { note: "C2", freq: 65.406 },
  "C3":  { note: "C3", freq: 130.81 },
  "C4":  { note: "C4", freq: 261.63 },
  "C5":  { note: "C5", freq: 523.25 },
  "C6":  { note: "C6", freq: 1046.5 },
  "C7":  { note: "C7", freq: 2093.0 },
  "C8":  { note: "C8", freq: 4186.0 },
  "Ds1": { note: "Ds1", freq: 38.891 },
  "Ds2": { note: "Ds2", freq: 77.782 },
  "Ds3": { note: "Ds3", freq: 155.56 },
  "Ds4": { note: "Ds4", freq: 311.13 },
  "Ds5": { note: "Ds5", freq: 622.25 },
  "Ds6": { note: "Ds6", freq: 1244.5 },
  "Ds7": { note: "Ds7", freq: 2489.0 },
  "Fs1": { note: "Fs1", freq: 46.249 },
  "Fs2": { note: "Fs2", freq: 92.499 },
  "Fs3": { note: "Fs3", freq: 185.0 },
  "Fs4": { note: "Fs4", freq: 369.99 },
  "Fs5": { note: "Fs5", freq: 739.99 },
  "Fs6": { note: "Fs6", freq: 1479.9 },
  "Fs7": { note: "Fs7", freq: 2959.9 },
};

// Audio buffer cache
const sampleBuffers = {};

// OPTIMIZATION: Reduced Polyphony Cap to prevent CPU stutter
const MAX_POLYPHONY = 48;
let activeVoices = [];
let timedSustainTrackers = {};
let nextVoiceId = 1;

// Find the closest loaded sample for a given frequency
function findClosestSample(freq) {
  let closestName = null;
  let closestFreq = Infinity;
  let minDiff = Infinity;
  
  for (const [name, data] of Object.entries(sampleBuffers)) {
    const diff = Math.abs(data.freq - freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestName = name;
      closestFreq = data.freq;
    }
  }
  
  if (!closestName) return null;
  return { buffer: sampleBuffers[closestName].buffer, baseFreq: closestFreq };
}

function loadAllSamples() {
  const entries = Object.entries(SAMPLE_MAP);
  let loaded = 0;
  let total = entries.length;

  entries.forEach(([name, data]) => {
    const url = `sample/${name}.mp3`;
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        sampleBuffers[name] = { buffer: audioBuffer, freq: data.freq };
        loaded++;
        if (loaded >= total) {
          onSamplesLoaded();
        }
      })
      .catch(err => {
        console.error(`Error loading sample ${name}:`, err);
        loaded++;
        if (loaded >= total) {
          onSamplesLoaded();
        }
      });
  });
}

function onSamplesLoaded() {
  isLoaded = true;
  console.log("Samples loaded.");
  window.dispatchEvent(new Event('samplesLoaded'));
}

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
  releaseTime = 0,
  expectedVoiceId = null
) {
  const tracker = timedSustainTrackers[trackerKey];
  if (!tracker) return false;
  if (expectedVoiceId !== null && tracker.voiceId !== expectedVoiceId) return false;

  clearTimeout(tracker.timeoutId);

  if (releaseAudio) {
    stopSampleByFreq(tracker.freq);
  }

  removeActiveVoiceById(tracker.voiceId);
  delete timedSustainTrackers[trackerKey];
  return true;
}

function clearTimedSustainTrackers(releaseAudio = true) {
  Object.keys(timedSustainTrackers).forEach((trackerKey) => {
    clearTimedSustainTrackerByKey(trackerKey, releaseAudio, 0);
  });
}

// Helper to stop a specific frequency's active source
function stopSampleByFreq(freq) {
  // Find any playing source Node for this freq and stop it
  for (let i = activeVoices.length - 1; i >= 0; i--) {
    if (Math.abs(activeVoices[i].freq - freq) < 0.001) {
      if (activeVoices[i].source) {
        try { activeVoices[i].source.stop(); } catch(e) {}
        try { activeVoices[i].source.disconnect(); } catch(e) {}
      }
    }
  }
}

function triggerSound(frequency, when = 0, forceDuration = null) {
  if (when === 0) when = audioCtx.currentTime;
  const voiceId = nextVoiceId++;

  // Find closest sample
  const sampleData = findClosestSample(frequency);
  if (!sampleData) return;

  // Calculate playback rate for pitch shifting
  const playbackRate = frequency / sampleData.baseFreq;

  // Create source node
  const source = audioCtx.createBufferSource();
  source.buffer = sampleData.buffer;
  source.playbackRate.value = playbackRate;

  // Create gain envelope
  const envGain = audioCtx.createGain();
  envGain.gain.setValueAtTime(1.0, when);

  // Connect: source -> envGain -> masterGain -> destination
  source.connect(envGain);
  envGain.connect(masterGain);

  // Start the sample
  source.start(when);

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
      if (stolenVoice.source) {
        try { stolenVoice.source.stop(when); } catch(e) {}
        try { stolenVoice.source.disconnect(); } catch(e) {}
      }
    }
  }

  const voice = {
    id: voiceId,
    freq: frequency,
    source: source,
    envGain: envGain,
    startTime: when
  };
  activeVoices.push(voice);

  if (forceDuration !== null) {
    // Schedule release after forceDuration
    source.stop(Math.max(when, when + forceDuration));
    envGain.gain.setValueAtTime(1.0, when);
    envGain.gain.linearRampToValueAtTime(0, when + forceDuration);
    const cleanupDelay = Math.max(0, ((when - audioCtx.currentTime) + forceDuration) * 1000);
    window.setTimeout(() => {
      removeActiveVoiceById(voiceId);
      try { source.disconnect(); } catch(e) {}
    }, cleanupDelay + 50);
  } else if (sustainMode === 1) {
    // Hold mode - keep playing until released
    // (no auto-release scheduled)
  } else {
    // Timed sustain mode
    const baseDuration = 2;
    const duration = Math.min(baseDuration * sustainMultiplier, 5);
    const releaseDelay = Math.max(0, ((when - audioCtx.currentTime) + duration) * 1000);
    const trackerKey = getTimedSustainTrackerKey(frequency);

    clearTimedSustainTrackerByKey(trackerKey, false, when);

    const timeoutId = window.setTimeout(() => {
      const tracker = timedSustainTrackers[trackerKey];
      if (!tracker || tracker.voiceId !== voiceId) return;

      // Fade out
      try {
        const now = audioCtx.currentTime;
        envGain.gain.setValueAtTime(envGain.gain.value, now);
        envGain.gain.linearRampToValueAtTime(0, now + 0.05);
        source.stop(now + 0.05);
      } catch(e) {}

      removeActiveVoiceById(voiceId);
      delete timedSustainTrackers[trackerKey];
      try { source.disconnect(); } catch(e) {}
    }, releaseDelay);

    voice.timedTrackerKey = trackerKey;
    timedSustainTrackers[trackerKey] = {
      timeoutId,
      freq: frequency,
      voiceId
    };
  }
}

function stopAllAudio() {
  for (let i = activeVoices.length - 1; i >= 0; i--) {
    const v = activeVoices[i];
    if (v.source) {
      try { v.source.stop(); } catch(e) {}
      try { v.source.disconnect(); } catch(e) {}
    }
  }
  activeVoices = [];
  Object.keys(timedSustainTrackers).forEach(key => {
    clearTimeout(timedSustainTrackers[key].timeoutId);
    delete timedSustainTrackers[key];
  });
}

function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ==========================================
// SETTINGS PERSISTENCE (LOCAL STORAGE)
// ==========================================

function saveSettings() {
    const settings = {
        transpose: transpose,
        labelMode: labelMode,
        fKeyMode: fKeyMode,
        isVisualizerOn: typeof isVisualizerOn !== 'undefined' ? isVisualizerOn : true,
        mobileZoom: mobileZoom,
        stripHeight: stripHeight,
        stripRangeLeft: stripRangeLeft,
        stripRangeRight: stripRangeRight,
        playbackRate: playbackRate,
        playbackTranspose: playbackTranspose,
        fallDuration: fallDuration,
        manualRiseSpeed: manualRiseSpeed
    };

    try {
        localStorage.setItem('wickiPianoSettings', JSON.stringify(settings));
    } catch (e) {
        console.warn("Storage full.", e);
    }
}

function loadSettings() {
    const saved = localStorage.getItem('wickiPianoSettings');
    if (!saved) return;

    try {
        const settings = JSON.parse(saved);
        
        if (settings.transpose !== undefined) transpose = settings.transpose;
        if (settings.labelMode !== undefined) labelMode = settings.labelMode;
        if (settings.fKeyMode !== undefined) fKeyMode = settings.fKeyMode;
        if (settings.mobileZoom !== undefined) mobileZoom = settings.mobileZoom;
        if (settings.stripHeight !== undefined) stripHeight = settings.stripHeight;
        stripHeight = parseFloat(stripHeight);
        if (Number.isNaN(stripHeight)) stripHeight = 16;
        if (stripHeight < 0) stripHeight = 0;
        if (stripHeight > 50) stripHeight = 50;
        if (settings.isVisualizerOn !== undefined && typeof isVisualizerOn !== 'undefined') {
            isVisualizerOn = settings.isVisualizerOn;
        }
        if (settings.stripRangeLeft !== undefined) stripRangeLeft = settings.stripRangeLeft;
        if (settings.stripRangeRight !== undefined) stripRangeRight = settings.stripRangeRight;
        if (settings.playbackRate !== undefined) playbackRate = settings.playbackRate;
        if (settings.playbackTranspose !== undefined) playbackTranspose = settings.playbackTranspose;
        if (settings.fallDuration !== undefined) fallDuration = settings.fallDuration;
        if (settings.manualRiseSpeed !== undefined) manualRiseSpeed = settings.manualRiseSpeed;
        playbackRate = Math.max(0.25, Math.min(3.0, Number(playbackRate) || 1.0));
        playbackTranspose = Math.max(-50, Math.min(50, Math.round(Number(playbackTranspose) || 0)));
        fallDuration = Math.max(0.5, Math.min(10.0, Number(fallDuration) || 2.0));
        manualRiseSpeed = Math.max(10, Math.min(1000, Number(manualRiseSpeed) || 100));
        fKeyMode = ((Math.round(Number(fKeyMode) || 0) % F_KEY_LABELS.length) + F_KEY_LABELS.length) % F_KEY_LABELS.length;
        
        if (typeof applyKeyMapMode === 'function') applyKeyMapMode();

        console.log("Settings Loaded");
        
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
}

// Start loading samples
loadAllSamples();