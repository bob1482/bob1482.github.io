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

// --- NEW: PHYSICAL KEY TRACKING ---
// Maps physical key codes (e.g., "keyq", "keyw") to the frequency they triggered.
// This ensures that even if you transpose while holding, we release the correct sound.
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
  ["1","2","3","4","5","6","7","8","9","0","-","="],
  ["q","w","e","r","t","y","u","i","o","p","[","]"],
  ["CapsLock","a","s","d","f","g","h","j","k","l",";","'"],
  ["ShiftLeft","z","x","c","v","b","n","m",",",".","/","ShiftRight"]
];

// --- RECORDER STATE ---
let isRecording = false;
let isPlaying = false;
let recordedEvents = [];
let recordingStartTime = 0;

// --- AUDIO ENGINE (TONE.JS) ---
Tone.context.lookAhead = 0.05; 

const MAX_POLYPHONY = 64; 
let activeVoices = []; 

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

// --- NEW: METRONOME SYNTH ---
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

// UPDATED: Accepts 'when' (AudioContext Time) for precise scheduling
function triggerSound(frequency, when = 0) {
  if (when === 0) when = Tone.now();

  let duration;

  // Mode 0: Sampler (Piano)
  if (soundMode === 0) {
    let baseDuration = 2;
    duration = Math.min(baseDuration * sustainMultiplier, 4);

    const voiceEndTime = when + duration;
    activeVoices = activeVoices.filter(v => v.endTime > when);

    if (activeVoices.length >= MAX_POLYPHONY) {
      const stolenVoice = activeVoices.shift();
      if (stolenVoice) {
         sampler.triggerRelease(stolenVoice.freq, when);
      }
    }

    activeVoices.push({
      freq: frequency,
      endTime: voiceEndTime
    });

    sampler.triggerAttackRelease(frequency, duration, when);
  } 
  
  // Mode 1: Wave (Synthesizer)
  else {
    let baseDuration = 1 + 2000 / frequency;
    duration = Math.min(baseDuration * sustainMultiplier, 4); 
    playWaveSound(frequency, duration, when);
  }
}

function playWaveSound(frequency, duration, when) {
  const ctx = Tone.context.rawContext; 
  
  let volume = 75 / frequency; 
  if(volume > 1) volume = 1;

  const noteGain = ctx.createGain();
  Tone.connect(noteGain, Tone.Destination);

  noteGain.gain.setValueAtTime(0, when);
  noteGain.gain.linearRampToValueAtTime(volume, when + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(volume * 0.6, when + 0.2 * sustainMultiplier);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0;
  filter.connect(noteGain);

  const attackBrightness = Math.max(frequency * 8, 800);
  const sustainBrightness = frequency * 3;
  
  filter.frequency.setValueAtTime(attackBrightness, when);
  filter.frequency.exponentialRampToValueAtTime(sustainBrightness, when + 0.5 * sustainMultiplier);
  filter.frequency.linearRampToValueAtTime(frequency, when + duration);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = frequency;
  osc1.connect(filter);
  
  osc1.start(when);
  osc1.stop(when + duration + 0.1);

  const timeUntilCleanup = (when + duration + 0.2 - Tone.now()) * 1000;
  if (timeUntilCleanup > 0) {
      setTimeout(() => { noteGain.disconnect(); }, timeUntilCleanup);
  } else {
      noteGain.disconnect();
  }
}

// --- NEW: MIDI HELPER ---
function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}