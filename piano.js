const ROWS = 5;
const COLS = 11;
const BASE_NOTE_FREQ = 130.81; // Approx C3
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- SETTINGS STATE ---
let transposeLeft = 0;
let transposeRight = 0;
let globalVolume = 0.5;
let sustainMultiplier = 1.0;
let isLoaded = false; 

// --- POLYPHONY STATE ---
const MAX_POLYPHONY = 30; 
let activeVoices = [];    

// --- VISUALIZER STATE ---
let keyCoordinates = {}; // Maps freq string -> {x, width}
let visualNotes = [];    // Array of active/floating note objects
const NOTE_SPEED = 4;    // Pixels per frame (Speed of rising notes)

// Label States: 0 = Notes, 1 = Keys, 2 = None
let labelMode = 0;
const LABEL_MODES = ["NOTES", "KEYS", "NONE"];

// Map to store which frequency is currently mapped to which keyboard key
let freqToKeyMap = {};

// --- KEY MAP CONFIGURATION ---
const KEY_MAPS = [
  //["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11"],
  ["F3","F4","F5","F6","F7","F9","F10","F11","F12"],
  ["2","3","4","5","6","7","8","9","0","-","="],
  ["w","e","r","t","y","u","i","o","p","[","]"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/","ShiftRight"]
];

const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d");

// --- TONE.JS SETUP ---
const reverb = new Tone.Reverb({
    decay: 2.5,
    preDelay: 0.01, 
    wet: 0.3
}).toDestination();

const sampler = new Tone.Sampler({
    urls: {
        "A0": "A0.mp3",
        "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", "A1": "A1.mp3",
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
        updateUI();
        console.log("Samples loaded.");
        startVisualizerLoop(); // Start animation loop
    }
}).connect(reverb);

Tone.Destination.volume.value = Tone.gainToDb(globalVolume);

// --- HELPER: UPDATE UI ---
function updateUI() {
  document.getElementById("disp-vol").innerText = Math.round(globalVolume * 10);
  document.getElementById("disp-sus").innerText = sustainMultiplier.toFixed(2) * 5;
  document.getElementById("disp-trans-l").innerText = transposeLeft;
  document.getElementById("disp-trans-r").innerText = transposeRight;
  document.getElementById("btn-labels").innerText = LABEL_MODES[labelMode];
}

// --- HELPER: GET NOTE LABEL ---
function getLabelText(semitoneOffset, keyChar) {
  if (labelMode === 2) return ""; 

  if (labelMode === 1) { 
    if (!keyChar) return "";
    if (keyChar === "ShiftRight") return "SHF";
    return keyChar.toUpperCase();
  }

  const totalSteps = semitoneOffset;
  const noteIndex = ((totalSteps % 12) + 12) % 12; 
  const octave = Math.floor(totalSteps / 12) + 3; 
  return NOTE_NAMES[noteIndex] + octave;
}

// --- CONTROL FUNCTIONS ---
function changeVolume(delta) {
  globalVolume += delta;
  if (globalVolume > 1.0) globalVolume = 1.0;
  if (globalVolume < 0.1) globalVolume = 0.1;
  Tone.Destination.volume.rampTo(Tone.gainToDb(globalVolume), 0.1);
  updateUI();
}

function changeSustain(delta) {
  sustainMultiplier += delta;
  if (sustainMultiplier < 0.2) sustainMultiplier = 0.2;
  if (sustainMultiplier > 2.0) sustainMultiplier = 2.0;
  updateUI();
}

function changeTranspose(side, delta) {
  if (side === 'left') {
    transposeLeft += delta;
    if (transposeLeft < -36) transposeLeft = -36;
    if (transposeLeft > 24) transposeLeft = 24;
  } else {
    transposeRight += delta;
    if (transposeRight < -36) transposeRight = -36;
    if (transposeRight > 24) transposeRight = 24;
  }
  renderBoard(); 
  updateUI();
}

function cycleLabels() {
  labelMode = (labelMode + 1) % 3;
  updateUI();
  renderBoard(); 
}

// --- RENDER SPLIT WICKI BOARD ---
function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";
  freqToKeyMap = {};

  const SPLIT_COL = 5; 

  for (let r = 0; r < ROWS; r++) {
    const rowDivL = document.createElement("div");
    rowDivL.className = "row row-" + r;
    const rowDivR = document.createElement("div");
    rowDivR.className = "row row-" + r;

    for (let c = 0; c < COLS; c++) {
      const mapRowIndex = ROWS - 1 - r;
      let keyMapChar = "";
      if (KEY_MAPS[mapRowIndex] && KEY_MAPS[mapRowIndex][c]) {
        keyMapChar = KEY_MAPS[mapRowIndex][c];
      }

      let rowManualShift = 0;
      if (r === 4) rowManualShift = 4; 
      else if (r === 3) rowManualShift = 2; 
      else if (r === 2) rowManualShift = 2; 
      
      let activeTranspose = (c < SPLIT_COL) ? transposeLeft : transposeRight;
      let semitoneOffset = r * 5 + c * 2 + activeTranspose + rowManualShift;
      
      let freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
      let noteIndex = ((semitoneOffset % 12) + 12) % 12;
      let isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      const freqStr = freq.toFixed(2);
      
      if (keyMapChar) {
        freqToKeyMap[freqStr] = keyMapChar;
      }

      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}`;
      key.setAttribute("data-note", freqStr);
      
      if (keyMapChar) {
        key.setAttribute("data-key", keyMapChar.toLowerCase());
      }

      key.innerText = getLabelText(semitoneOffset, keyMapChar);

      key.addEventListener("mousedown", () => pressNote(freq));
      key.addEventListener("mouseup", () => releaseNote(freq));
      key.addEventListener("mouseleave", () => releaseNote(freq));

      if (c < SPLIT_COL) rowDivL.appendChild(key);
      else rowDivR.appendChild(key);
    }
    boardLeft.appendChild(rowDivL);
    boardRight.appendChild(rowDivR);
  }

  renderTraditionalPiano();
}

// --- RENDER TRADITIONAL PIANO ---
function renderTraditionalPiano() {
  const strip = document.getElementById("piano-strip");
  strip.innerHTML = ""; 
  keyCoordinates = {}; // Reset coordinates map

  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  strip.appendChild(wrapper);

  const totalNotes = 88;
  const totalWhiteKeys = 52; 
  const startOffset = -27; 
  
  const whiteKeyWidthPercent = 100 / totalWhiteKeys;
  const blackKeyWidthPercent = whiteKeyWidthPercent * 0.7; 

  let whiteKeyCount = 0;

  for(let i = 0; i < totalNotes; i++) {
      const currentSemitone = startOffset + i; 
      const freq = BASE_NOTE_FREQ * Math.pow(2, currentSemitone / 12);
      const freqStr = freq.toFixed(2);

      const noteIndex = i % 12;
      const isWhite = [0, 2, 3, 5, 7, 8, 10].includes(noteIndex);

      const key = document.createElement("div");
      key.setAttribute("data-note", freqStr);
      key.title = freqStr + " Hz";

      const mappedKey = freqToKeyMap[freqStr];
      key.innerText = getLabelText(currentSemitone, mappedKey);

      if (isWhite) {
          key.className = "p-key white";
          key.style.width = whiteKeyWidthPercent + "%";
          key.style.left = (whiteKeyCount * whiteKeyWidthPercent) + "%";
          whiteKeyCount++;
      } else {
          key.className = "p-key black";
          key.style.width = blackKeyWidthPercent + "%";
          key.style.left = ((whiteKeyCount * whiteKeyWidthPercent) - (blackKeyWidthPercent / 2)) + "%";
      }

      key.addEventListener("mousedown", () => pressNote(freq));
      key.addEventListener("mouseup", () => releaseNote(freq));
      key.addEventListener("mouseleave", () => releaseNote(freq));

      wrapper.appendChild(key);
  }
}

// --- UNIFIED PRESS/RELEASE LOGIC ---

// 1. PRESS
async function pressNote(freq) {
  if (Tone.context.state !== 'running') await Tone.start();
  if (!isLoaded) return;

  const freqStr = freq.toFixed(2);
  
  // Visuals: Active Class + Visualizer
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  allKeys.forEach(k => k.classList.add("active"));
  
  startVisualNote(freqStr); // Trigger Canvas Note

  playSound(freq);
}

// 2. RELEASE
function releaseNote(freq) {
  const freqStr = freq.toFixed(2);
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  allKeys.forEach(k => k.classList.remove("active"));
  
  endVisualNote(freqStr); // Release Canvas Note
}

// --- SOUND ENGINE ---
function playSound(frequency) {
  let baseDuration = 2;
  const duration = Math.min(baseDuration * sustainMultiplier, 4); 
  const now = Date.now();

  activeVoices = activeVoices.filter(v => now < (v.timestamp + (v.duration * 1000)));

  if (activeVoices.length >= MAX_POLYPHONY) {
    const stolenVoice = activeVoices.shift();
    if (stolenVoice) {
       sampler.triggerRelease(stolenVoice.freq, Tone.now());
    }
  }

  activeVoices.push({
    freq: frequency,
    timestamp: now,
    duration: duration
  });

  sampler.triggerAttackRelease(frequency, duration);
}

// --- INPUT LISTENERS ---
window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow")) {
    if (e.repeat) return;
    if (e.key === "ArrowRight") { changeTranspose('right', 1); changeTranspose('left', 1); }
    else if (e.key === "ArrowLeft") { changeTranspose('right', -1); changeTranspose('left', -1); }
    else if (e.key === "ArrowUp") { changeTranspose('right', 12); changeTranspose('left', 12); }
    else if (e.key === "ArrowDown") { changeTranspose('right', -12); changeTranspose('left', -12); }
    return;
  }

  let searchKey = e.key.toLowerCase();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") searchKey = e.code.toLowerCase();

  const key = document.querySelector(`.key[data-key="${CSS.escape(searchKey)}"]`);

  if (key && key.offsetParent !== null) { 
    e.preventDefault();
    if (!e.repeat) {
      const freq = parseFloat(key.getAttribute("data-note"));
      pressNote(freq);
    }
  }
});

window.addEventListener("keyup", (e) => {
  let searchKey = e.key.toLowerCase();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") searchKey = e.code.toLowerCase();

  const key = document.querySelector(`.key[data-key="${CSS.escape(searchKey)}"]`);

  if (key && key.offsetParent !== null) { 
    e.preventDefault();
    const freq = parseFloat(key.getAttribute("data-note"));
    releaseNote(freq);
  }
});

window.addEventListener('click', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });


// --- VISUALIZER ENGINE (SYNTHESIA STYLE) ---

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.83; // 83vh
  // Recalculate key positions
  updateKeyCoordinates();
}

window.addEventListener('resize', resizeCanvas);

function updateKeyCoordinates() {
  const keys = document.querySelectorAll('.p-key');
  keys.forEach(key => {
    const freq = key.getAttribute('data-note');
    const rect = key.getBoundingClientRect();
    keyCoordinates[freq] = {
      x: rect.left,
      width: rect.width
    };
  });
}

function getNoteColor(freqStr) {
  // CHANGED: Returns a static gray instead of rainbow HSL
  return '#888888'; 
}

function startVisualNote(freqStr) {
  // If we haven't calculated coordinates yet (e.g., loaded before interaction)
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();

  const coords = keyCoordinates[freqStr];
  if (!coords) return; // Note might be out of range of the piano strip

  // Check if already active, don't duplicate
  const existing = visualNotes.find(n => n.freq === freqStr && n.active);
  if (existing) return;

  visualNotes.push({
    freq: freqStr,
    active: true,
    x: coords.x,
    width: coords.width,
    y: canvas.height, // Start at bottom
    height: 0,
    color: getNoteColor(freqStr)
  });
}

function endVisualNote(freqStr) {
  const note = visualNotes.find(n => n.freq === freqStr && n.active);
  if (note) {
    note.active = false;
  }
}

function startVisualizerLoop() {
  resizeCanvas(); // Initial size
  
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter out notes that have floated off screen (top)
    visualNotes = visualNotes.filter(n => n.y + n.height > -50);

    visualNotes.forEach(note => {
      // 1. Move logic
      if (note.active) {
        // While holding: The bottom is anchored to canvas bottom (canvas.height)
        // The "height" grows upwards.
        note.height += NOTE_SPEED;
        note.y = canvas.height - note.height;
      } else {
        // Released: The whole block moves up
        note.y -= NOTE_SPEED;
      }

      // 2. Draw logic
      // Create gradient for 3D look
      const grad = ctx.createLinearGradient(note.x, note.y, note.x + note.width, note.y);
      grad.addColorStop(0, note.color);
      grad.addColorStop(0.5, "white"); // Shine
      grad.addColorStop(1, note.color);

      ctx.fillStyle = grad;
      
      // Rounded caps
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, note.width, note.height, 4);
      ctx.fill();
    });

    requestAnimationFrame(loop);
  }
  loop();
}

// Initial Render
renderBoard(); 
updateUI();