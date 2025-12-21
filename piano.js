const ROWS = 5;
const COLS = 14;
const BASE_NOTE_FREQ = 130.81; // Approx C3

// --- SETTINGS STATE ---
let globalTranspose = 3;
let globalVolume = 0.5;
let sustainMultiplier = 1.0;

// --- KEY MAP CONFIGURATION ---
const KEY_MAPS = [
  ["Esc","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","Delete"],
  ["`","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
  ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["CapsLock","a","s","d","f","g","h","j","k","l",";","'","Enter"],
  ["ShiftLeft","z","x","c","v","b","n","m",",",".","/","ShiftRight","Control"]
];

const board = document.getElementById("board");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- GLOBAL MIX BUS ---
const masterOut = audioCtx.createGain();
masterOut.gain.value = globalVolume; 
masterOut.connect(audioCtx.destination);

// --- HELPER: UPDATE UI ---
function updateUI(freq = null) {
  // Update Frequency Display
  const statusDiv = document.getElementById("status-display");
  if (freq) {
    statusDiv.innerText = `Last Note: ${freq.toFixed(0)} Hz`;
  }

  // Update Control Panel Values
  document.getElementById("disp-vol").innerText = Math.round(globalVolume * 100) + "%";
  document.getElementById("disp-sus").innerText = sustainMultiplier.toFixed(2) + "x";
  document.getElementById("disp-trans").innerText = (globalTranspose - 3) > 0 ? "+" + (globalTranspose - 3) : (globalTranspose - 3);
}

// --- CONTROL FUNCTIONS ---
function changeVolume(delta) {
  globalVolume += delta;
  if (globalVolume > 1.0) globalVolume = 1.0;
  if (globalVolume < 0.0) globalVolume = 0.0;
  masterOut.gain.setTargetAtTime(globalVolume, audioCtx.currentTime, 0.02);
  updateUI();
}

function changeSustain(delta) {
  sustainMultiplier += delta;
  if (sustainMultiplier < 0.25) sustainMultiplier = 0.25;
  if (sustainMultiplier > 4.0) sustainMultiplier = 4.0;
  updateUI();
}

function changeTranspose(delta) {
  globalTranspose += delta;
  if (globalTranspose < -9) globalTranspose = -9;
  if (globalTranspose > 15) globalTranspose = 15;
  renderBoard();
  updateUI();
}

// --- RENDER TRADITIONAL PIANO ---
// --- RENDER TRADITIONAL PIANO (6 OCTAVES) ---
// --- RENDER TRADITIONAL PIANO (4 OCTAVES) ---
function renderTraditionalPiano() {
  const strip = document.getElementById("piano-strip");
  strip.innerHTML = ""; // Clear existing

  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  strip.appendChild(wrapper);

  const whiteKeyWidth = 35;
  const blackKeyWidth = 20;
  
  // 4 Octaves (C2 to C6) = 48 semitones + 1 final C = 49 notes
  const startOffset = 0; // Start 1 octave below Base Frequency (C3)
  const totalNotes = 48; 
  
  let whiteKeyCount = 0;

  for(let i = 0; i < totalNotes; i++) {
      // Calculate semitone relative to C3 (0)
      const currentSemitone = startOffset + i;

      // Normalize index for color lookup (handles negative numbers)
      const noteInOctave = ((currentSemitone % 12) + 12) % 12;
      
      const isWhite = [0, 2, 4, 5, 7, 9, 11].includes(noteInOctave);
      const freq = BASE_NOTE_FREQ * Math.pow(2, currentSemitone / 12);
      
      const freqStr = freq.toFixed(2);

      const key = document.createElement("div");
      key.setAttribute("data-note", freqStr);
      
      if (isWhite) {
          key.className = "p-key white";
          key.style.left = (whiteKeyCount * whiteKeyWidth) + "px";
          whiteKeyCount++;
      } else {
          key.className = "p-key black";
          key.style.left = (whiteKeyCount * whiteKeyWidth - (blackKeyWidth / 2)) + "px";
      }

      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));
      wrapper.appendChild(key);
  }
  
  wrapper.style.width = (whiteKeyCount * whiteKeyWidth) + "px";
  
  // Center the view on Middle C (approximate)
  setTimeout(() => {
    // 40px * 15 keys is roughly where C3 starts in this new layout
    strip.scrollLeft = (15 * 40) - (strip.clientWidth / 2);
  }, 100);
}

// --- RENDER WICKI BOARD ---
function renderBoard() {
  board.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.className = "row row-" + r;

    for (let c = 0; c < COLS; c++) {
      const mapRowIndex = ROWS - 1 - r;
      let keyMapChar = "";
      if (KEY_MAPS[mapRowIndex] && KEY_MAPS[mapRowIndex][c]) {
        keyMapChar = KEY_MAPS[mapRowIndex][c];
      }

      const isExplicitlyHidden = ["Esc", "Control", "`", "F1"].includes(keyMapChar);
      const isTrimmedEnd = r < 2 && c === COLS - 1;
      const isHidden = isExplicitlyHidden || isTrimmedEnd;

      let semitoneOffset = r * 5 + c * 2 + globalTranspose;
      let freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
      let noteIndex = ((semitoneOffset % 12) + 12) % 12;
      let isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      // USE TOFIXED(2) for consistency
      const freqStr = freq.toFixed(2);

      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}`;
      key.setAttribute("data-note", freqStr);

      if (isHidden) {
        key.style.visibility = "hidden";
        key.style.pointerEvents = "none";
      }
      if (keyMapChar) {
        key.setAttribute("data-key", keyMapChar.toLowerCase());
      }

      // Click listener
      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));
      rowDiv.appendChild(key);
    }
    board.appendChild(rowDiv);
  }
}

// --- UNIFIED TRIGGER & HIGHLIGHT ---
function triggerNoteByFreq(freq) {
  const freqStr = freq.toFixed(2);
  
  // 1. Play Sound
  playSound(freq);
  updateUI(freq);

  // 2. Highlight ALL keys (Wicki or Piano) with this frequency
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  
  allKeys.forEach(k => {
    k.classList.add("active");
    // Remove active class quickly
    setTimeout(() => k.classList.remove("active"), 200);
  });
}

// --- SOUND ENGINE ---
function playSound(frequency) {
  if(audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;

  let baseDuration = 1 + 500 / frequency;
  const duration = Math.min(baseDuration * sustainMultiplier, 8); 
  let volume = 15 / frequency;

  const noteGain = audioCtx.createGain();
  noteGain.connect(masterOut);

  noteGain.gain.setValueAtTime(0, now);
  noteGain.gain.linearRampToValueAtTime(volume, now + 0.015);
  noteGain.gain.exponentialRampToValueAtTime(volume * 0.6, now + 0.4 * sustainMultiplier);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0;
  filter.connect(noteGain);

  const attackBrightness = Math.max(frequency * 8, 800);
  const sustainBrightness = frequency * 3;
  filter.frequency.setValueAtTime(attackBrightness, now);
  filter.frequency.exponentialRampToValueAtTime(sustainBrightness, now + 0.5 * sustainMultiplier);
  filter.frequency.linearRampToValueAtTime(frequency, now + duration);

  const osc1 = audioCtx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = frequency;
  osc1.connect(filter);
  osc1.start(now);
  osc1.stop(now + duration + 0.1);

  const osc2 = audioCtx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = frequency;
  osc2.detune.value = 2; 
  osc2.connect(filter);
  osc2.start(now);
  osc2.stop(now + duration + 0.1);

  setTimeout(() => { noteGain.disconnect(); }, (duration + 0.2) * 1000);
}

// --- INPUT LISTENERS ---
window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow")) {
    if (e.repeat) return;
    if (e.key === "ArrowRight") changeTranspose(5);
    else if (e.key === "ArrowLeft") changeTranspose(-5);
    else if (e.key === "ArrowUp") changeTranspose(12);
    else if (e.key === "ArrowDown") changeTranspose(-12);
    return;
  }

  let searchKey = e.key.toLowerCase();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    searchKey = e.code.toLowerCase();
  }

  const key = document.querySelector(
    `.wicki-board .key[data-key="${CSS.escape(searchKey)}"]`
  );

  if (key && key.style.visibility !== "hidden") {
    e.preventDefault();
    if (!e.repeat) {
      // Get frequency from the key element and trigger unified system
      const freq = parseFloat(key.getAttribute("data-note"));
      triggerNoteByFreq(freq);
    }
  }
});

// Initial Render
renderBoard();
renderTraditionalPiano();
updateUI();
