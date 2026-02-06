// ==========================================
// PIANO CORE: Constants, State, Audio Engine
// ==========================================

const ROWS = 5;
const COLS = 12;
const BASE_NOTE_FREQ = 130.81; // Approx C3
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- GLOBAL SETTINGS STATE ---
let transposeLeft = 2;
let transposeRight = 2;
let globalVolume = 0.5;
let sustainMultiplier = 1.0;
let isLoaded = false; 
let sequenceIndex = 0;
let bpm = 120; 
let isMetronomeOn = false; 

// --- PHYSICAL KEY TRACKING ---
let activePhysicalKeys = {}; 

// --- MODES ---
let soundMode = 0; // 0 = Piano, 1 = Wave
const SOUND_MODES = ["PIANO", "WAVE"];

let shiftMode = 1; // 0 = 1/12, 1 = 2/5
const SHIFT_MODES = ["5 / 12", "1 / 2"];

let labelMode = 1; // 0 = Notes, 1 = Keys, 2 = None
const LABEL_MODES = ["NOTES", "KEYS", "NONE"];

let fKeyMode = 0; 
const F_ROW_VARIANTS = [
  ["F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","PrintScreen"], 
  ["F1","F2","F3","F4","","F5","F6","F7","F8","F9","F10","F11"], 
  ["","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"], 
  ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"] 
];
const F_KEY_LABELS = ["laptop","100r","100s","1-1"];

// --- DATA MAPS ---
let freqToKeyMap = {};

const KEY_MAPS = [
  F_ROW_VARIANTS[0], 
  ["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0","Minus","Equal"],
  ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"],
  ["CapsLock","KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote"],
  ["ShiftLeft","KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash","ShiftRight"]
];

// --- RECORDER STATE ---
let isRecording = false;
let isPlaying = false;
let recordedEvents = [];
let recordingStartTime = 0;

// --- AUDIO ENGINE (TONE.JS) ---
Tone.context.lookAhead = 0.05; 

// OPTIMIZATION: Reduced Polyphony Cap to prevent CPU stutter
const MAX_POLYPHONY = 48; 
let activeVoices = []; // Now treated as a simple ring buffer

const reverb = new Tone.Reverb({
    decay: 2.5,
    preDelay: 0.01, 
    wet: 0.3
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

function triggerSound(frequency, when = 0) {
  if (when === 0) when = Tone.now();

  // Mode 0: Sampler (Piano)
  if (soundMode === 0) {
    let baseDuration = 2;
    // Cap duration to prevent extremely long tail calculations
    let duration = Math.min(baseDuration * sustainMultiplier, 5);

    // OPTIMIZATION: FIFO Voice Stealing
    // We don't filter the array (expensive O(N)). 
    // We just remove the oldest voice if we hit the limit.
    if (activeVoices.length >= MAX_POLYPHONY) {
      const stolenVoice = activeVoices.shift(); // Remove oldest (first)
      // Only release if it's still potentially ringing. 
      // It's cheaper to just fire release than to check time.
      sampler.triggerRelease(stolenVoice.freq, when);
    }

    activeVoices.push({
      freq: frequency,
      // We don't track endTime strictly for removal anymore, only for logic if needed
      startTime: when 
    });

    sampler.triggerAttackRelease(frequency, duration, when);
  } 
  
  // Mode 1: Wave (Synthesizer)
  else {
    let baseDuration = 1 + 2000 / frequency;
    let duration = Math.min(baseDuration * sustainMultiplier, 4); 
    playWaveSound(frequency, duration, when);
  }
}

function playWaveSound(frequency, duration, when) {
  // OPTIMIZATION: Use raw context but handle cleanup via Events, not setTimeout
  const ctx = Tone.context.rawContext; 
  
  let volume = 75 / frequency; 
  if(volume > 1) volume = 1;

  const noteGain = ctx.createGain();
  Tone.connect(noteGain, Tone.Destination);

  // Envelope
  noteGain.gain.setValueAtTime(0, when);
  noteGain.gain.linearRampToValueAtTime(volume, when + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(volume * 0.6, when + 0.2 * sustainMultiplier);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  // Filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0;
  filter.connect(noteGain);

  const attackBrightness = Math.max(frequency * 8, 800);
  const sustainBrightness = frequency * 3;
  
  filter.frequency.setValueAtTime(attackBrightness, when);
  filter.frequency.exponentialRampToValueAtTime(sustainBrightness, when + 0.5 * sustainMultiplier);
  filter.frequency.linearRampToValueAtTime(frequency, when + duration);

  // Oscillator
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = frequency;
  osc1.connect(filter);
  
  osc1.start(when);
  osc1.stop(when + duration + 0.1);

  // OPTIMIZATION: Native cleanup
  // 'onended' fires exactly when audio stops, no JS timer drift
  osc1.onended = () => {
      noteGain.disconnect();
      // filter and osc are garbage collected automatically once disconnected
  };
}

function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}