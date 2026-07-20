// ==========================================
// PIANO CORE: Constants, State, Audio Engine
// ==========================================

const ROWS = 5;
const COLS = 12;
const BASE_NOTE_FREQ = 130.81; // Approx C3
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- GLOBAL SETTINGS STATE ---
let transpose = -3;
let sustainMode = 0; // 0 = Sustain (notes hold after release), 1 = Hold (notes stop on release)
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

// --- REVERB (convolution reverb with synthetic impulse response) ---
let reverbEnabled = true;
let reverbWet = 0.3;       // 0.0 to 1.0

function generateImpulseResponse(duration = 1.5, decay = 2.0) {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * duration;
    const buffer = audioCtx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            // White noise with exponential decay to simulate room reflections
            const env = Math.exp(-decay * i / length);
            data[i] = (Math.random() * 2 - 1) * env;
        }
    }
    return buffer;
}

const convolverNode = audioCtx.createConvolver();
convolverNode.buffer = generateImpulseResponse(1.5, 2.0);
convolverNode.normalize = true;

const reverbGain = audioCtx.createGain();
reverbGain.gain.value = reverbWet;

// Routing: masterGain -> convolver -> reverbGain -> destination
masterGain.connect(convolverNode);
convolverNode.connect(reverbGain);
reverbGain.connect(audioCtx.destination);

// Also connect masterGain directly for the dry signal
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

// Smooth release: ramps gain to 0 over releaseTimeMs, then stops and cleans up
function stopVoiceSmoothly(voice, releaseTimeMs = 500) {
  if (!voice || !voice.source) return;
  const now = audioCtx.currentTime;
  const releaseSec = releaseTimeMs / 1000;
  // Get current gain value and ramp to 0
  voice.envGain.gain.cancelScheduledValues(now);
  voice.envGain.gain.setValueAtTime(voice.envGain.gain.value, now);
  voice.envGain.gain.linearRampToValueAtTime(0.001, now + releaseSec);
  // Stop source after ramp completes
  try { voice.source.stop(now + releaseSec + 0.01); } catch(e) {}
  // Schedule cleanup after ramp
  setTimeout(() => {
    try { voice.source.disconnect(); } catch(e) {}
    removeActiveVoiceById(voice.id);
  }, (releaseSec + 0.05) * 1000);
}

// Helper to stop a specific frequency's active source with smooth release
function stopSampleByFreq(freq, releaseTimeMs = 500) {
  // Find any playing source Node for this freq and stop it smoothly
  for (let i = activeVoices.length - 1; i >= 0; i--) {
    if (Math.abs(activeVoices[i].freq - freq) < 0.001) {
      stopVoiceSmoothly(activeVoices[i], releaseTimeMs);
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
    // Schedule release after forceDuration (used by MIDI playback)
    source.stop(Math.max(when, when + forceDuration));
    envGain.gain.setValueAtTime(1.0, when);
    envGain.gain.linearRampToValueAtTime(0, when + forceDuration);
    const cleanupDelay = Math.max(0, ((when - audioCtx.currentTime) + forceDuration) * 1000);
    window.setTimeout(() => {
      removeActiveVoiceById(voiceId);
      try { source.disconnect(); } catch(e) {}
    }, cleanupDelay + 50);
  } else {
    // Sustain / Hold mode: play indefinitely until explicitly stopped
    // (no auto-release scheduled)
  }
}

function stopAllAudio(releaseTimeMs = 500) {
  // Use smooth release for all active voices
  for (let i = activeVoices.length - 1; i >= 0; i--) {
    stopVoiceSmoothly(activeVoices[i], releaseTimeMs);
  }
  // Clear activeVoices array
  activeVoices = [];
  // Clear sustain trackers
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
        manualRiseSpeed: manualRiseSpeed,
        reverbEnabled: reverbEnabled,
        reverbWet: reverbWet
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
        if (settings.reverbEnabled !== undefined) reverbEnabled = settings.reverbEnabled;
        if (settings.reverbWet !== undefined) reverbWet = settings.reverbWet;
        reverbGain.gain.value = reverbEnabled ? reverbWet : 0;
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

// ==========================================
// LOADOUTS (PRESET SNAPSHOTS)
// ==========================================

const LOADOUTS_STORAGE_KEY = 'wickiPianoLoadouts';

function getAllLoadouts() {
    try {
        const data = localStorage.getItem(LOADOUTS_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.warn("Failed to read loadouts:", e);
        return {};
    }
}

function getLoadoutNames() {
    return Object.keys(getAllLoadouts());
}

function saveLoadout(name) {
    if (!name || name.trim().length === 0) return false;
    const trimmed = name.trim();
    const loadouts = getAllLoadouts();
    
    const snapshot = {
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
        manualRiseSpeed: manualRiseSpeed,
        reverbEnabled: reverbEnabled,
        reverbWet: reverbWet
    };
    
    loadouts[trimmed] = snapshot;
    
    try {
        localStorage.setItem(LOADOUTS_STORAGE_KEY, JSON.stringify(loadouts));
        console.log(`Loadout "${trimmed}" saved.`);
        return true;
    } catch (e) {
        console.warn("Storage full, could not save loadout:", e);
        return false;
    }
}

function loadLoadout(name) {
    const loadouts = getAllLoadouts();
    const snapshot = loadouts[name];
    if (!snapshot) {
        console.warn(`Loadout "${name}" not found.`);
        return false;
    }
    
    // Apply all settings from the snapshot
    if (snapshot.transpose !== undefined) transpose = snapshot.transpose;
    if (snapshot.labelMode !== undefined) labelMode = snapshot.labelMode;
    if (snapshot.fKeyMode !== undefined) fKeyMode = snapshot.fKeyMode;
    if (snapshot.mobileZoom !== undefined) mobileZoom = snapshot.mobileZoom;
    if (snapshot.stripHeight !== undefined) stripHeight = snapshot.stripHeight;
    stripHeight = parseFloat(stripHeight);
    if (Number.isNaN(stripHeight)) stripHeight = 16;
    if (stripHeight < 0) stripHeight = 0;
    if (stripHeight > 50) stripHeight = 50;
    if (snapshot.isVisualizerOn !== undefined && typeof isVisualizerOn !== 'undefined') {
        isVisualizerOn = snapshot.isVisualizerOn;
    }
    if (snapshot.stripRangeLeft !== undefined) stripRangeLeft = snapshot.stripRangeLeft;
    if (snapshot.stripRangeRight !== undefined) stripRangeRight = snapshot.stripRangeRight;
    if (snapshot.playbackRate !== undefined) playbackRate = snapshot.playbackRate;
    if (snapshot.playbackTranspose !== undefined) playbackTranspose = snapshot.playbackTranspose;
    if (snapshot.fallDuration !== undefined) fallDuration = snapshot.fallDuration;
    if (snapshot.manualRiseSpeed !== undefined) manualRiseSpeed = snapshot.manualRiseSpeed;
    if (snapshot.reverbEnabled !== undefined) reverbEnabled = snapshot.reverbEnabled;
    if (snapshot.reverbWet !== undefined) reverbWet = snapshot.reverbWet;
    
    // Clamp values
    playbackRate = Math.max(0.25, Math.min(3.0, Number(playbackRate) || 1.0));
    playbackTranspose = Math.max(-50, Math.min(50, Math.round(Number(playbackTranspose) || 0)));
    fallDuration = Math.max(0.5, Math.min(10.0, Number(fallDuration) || 2.0));
    manualRiseSpeed = Math.max(10, Math.min(1000, Number(manualRiseSpeed) || 100));
    fKeyMode = ((Math.round(Number(fKeyMode) || 0) % F_KEY_LABELS.length) + F_KEY_LABELS.length) % F_KEY_LABELS.length;
    
    // Apply reverb
    if (typeof reverbGain !== 'undefined') {
        reverbGain.gain.value = reverbEnabled ? reverbWet : 0;
    }
    
    // Apply key map mode
    if (typeof applyKeyMapMode === 'function') applyKeyMapMode();
    
    // Re-render board
    if (typeof renderBoard === 'function') renderBoard();
    
    // Update UI
    if (typeof updateUI === 'function') updateUI();
    
    // Save as current settings
    if (typeof saveSettings === 'function') saveSettings();
    
    console.log(`Loadout "${name}" applied.`);
    return true;
}

function deleteLoadout(name) {
    const loadouts = getAllLoadouts();
    if (!loadouts[name]) return false;
    
    delete loadouts[name];
    
    try {
        localStorage.setItem(LOADOUTS_STORAGE_KEY, JSON.stringify(loadouts));
        console.log(`Loadout "${name}" deleted.`);
        return true;
    } catch (e) {
        console.warn("Failed to delete loadout:", e);
        return false;
    }
}

// Start loading samples
loadAllSamples();
