const ROWS = 5;
const COLS = 11;
const BASE_NOTE_FREQ = 130.81; // Approx C3

// --- SETTINGS STATE ---
let transposeLeft = 0;
let transposeRight = 0;
let globalVolume = 0.5;
let sustainMultiplier = 1.0;
let isLoaded = false; 

// --- KEY MAP CONFIGURATION ---
const KEY_MAPS = [
  ["F3","F4","F5","F6","F7","F9","F10","F11","F12"],
  ["2","3","4","5","6","7","8","9","0","-","="],
  ["w","e","r","t","y","u","i","o","p","[","]"],
  ["a","s","d","f","g","h","j","k","l",";","'"],
  ["z","x","c","v","b","n","m",",",".","/","ShiftRight"]
];

const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");

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
    }
}).connect(reverb);

Tone.Destination.volume.value = Tone.gainToDb(globalVolume);

// --- HELPER: UPDATE UI ---
function updateUI() {
  document.getElementById("disp-vol").innerText = Math.round(globalVolume * 10);
  document.getElementById("disp-sus").innerText = sustainMultiplier.toFixed(2) * 5;
  document.getElementById("disp-trans-l").innerText = transposeLeft;
  document.getElementById("disp-trans-r").innerText = transposeRight;
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

// --- RENDER TRADITIONAL PIANO (88 KEYS, FIXED) ---
function renderTraditionalPiano() {
  const strip = document.getElementById("piano-strip");
  strip.innerHTML = ""; 

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

      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));
      wrapper.appendChild(key);
  }
}

// --- RENDER SPLIT WICKI BOARD ---
function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";

  const SPLIT_COL = 5; // Columns 0-4 = Left, 5-10 = Right

  for (let r = 0; r < ROWS; r++) {
    // Create Row containers for both sides
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

      // --- CUSTOM ROW SHIFT LOGIC ---
      let rowManualShift = 0;
      if (r === 4) {
        rowManualShift = 4; 
      } else if (r === 3) {
        rowManualShift = 2; 
      } else if (r === 2) {
        rowManualShift = 2; 
      }
      
      // Determine side and apply specific transpose
      let activeTranspose = (c < SPLIT_COL) ? transposeLeft : transposeRight;

      let semitoneOffset = r * 5 + c * 2 + activeTranspose + rowManualShift;
      let freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
      let noteIndex = ((semitoneOffset % 12) + 12) % 12;
      let isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      const freqStr = freq.toFixed(2);

      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}`;
      key.setAttribute("data-note", freqStr);
      
      if (keyMapChar) {
        key.setAttribute("data-key", keyMapChar.toLowerCase());
      }

      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));

      // Append to correct board side
      if (c < SPLIT_COL) {
        rowDivL.appendChild(key);
      } else {
        rowDivR.appendChild(key);
      }
    }
    boardLeft.appendChild(rowDivL);
    boardRight.appendChild(rowDivR);
  }
}

// --- UNIFIED TRIGGER & HIGHLIGHT ---
async function triggerNoteByFreq(freq) {
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }

  if (!isLoaded) return;

  const freqStr = freq.toFixed(2);
  playSound(freq);

  // Highlight Keys (both Wicki and Piano strip)
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  allKeys.forEach(k => {
    k.classList.add("active");
    setTimeout(() => k.classList.remove("active"), 200);
  });
}

// --- SOUND ENGINE ---
function playSound(frequency) {
  let baseDuration = 2;
  const duration = Math.min(baseDuration * sustainMultiplier, 4); 
  sampler.triggerAttackRelease(frequency, duration);
}

// --- INPUT LISTENERS ---
window.addEventListener("keydown", (e) => {
  // Arrow keys control Right Hand Transpose (Melody)
  if (e.key.startsWith("Arrow")) {
    if (e.repeat) return;
    if (e.key === "ArrowRight") changeTranspose('right', 1);
    else if (e.key === "ArrowLeft") changeTranspose('right', -1);
    else if (e.key === "ArrowUp") changeTranspose('right', 12);
    else if (e.key === "ArrowDown") changeTranspose('right', -12);
    return;
  }

  let searchKey = e.key.toLowerCase();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    searchKey = e.code.toLowerCase();
  }

  // Helper function to find key in either board
  // We search globally for the data-key
  const key = document.querySelector(
    `.key[data-key="${CSS.escape(searchKey)}"]`
  );

  if (key && key.offsetParent !== null) { // offsetParent checks visibility
    e.preventDefault();
    if (!e.repeat) {
      const freq = parseFloat(key.getAttribute("data-note"));
      triggerNoteByFreq(freq);
    }
  }
});

window.addEventListener('click', async () => {
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
}, { once: true });

// Initial Render
renderBoard();
renderTraditionalPiano();
updateUI();