const ROWS = 5;
const COLS = 14;
const BASE_NOTE_FREQ = 130.81; // Approx C3

// --- OPTIMIZATION: LATENCY SETTINGS ---
Tone.setContext(new Tone.Context({ latencyHint: "interactive" }));
Tone.context.lookAhead = 0;

// --- SETTINGS STATE ---
let globalTranspose = -3;
let globalVolume = 0.5;
let sustainMultiplier = 1.0;
let isLoaded = false; 

// --- KEY MAP CONFIGURATION ---
const KEY_MAPS = [
  ["Esc","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","Delete"],
  ["`","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
  ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["CapsLock","a","s","d","f","g","h","j","k","l",";","'","Enter"],
  ["ShiftLeft","z","x","c","v","b","n","m",",",".","/","ShiftRight","Control"]
];

const board = document.getElementById("board");

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
  document.getElementById("disp-vol").innerText = Math.round(globalVolume * 200);
  document.getElementById("disp-sus").innerText = sustainMultiplier.toFixed(2) * 100;
  document.getElementById("disp-trans").innerText = (globalTranspose + 3) > 0 ? "+" + (globalTranspose + 3) : (globalTranspose + 3);
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

function changeTranspose(delta) {
  globalTranspose += delta;
  if (globalTranspose < -27) globalTranspose = -27;
  if (globalTranspose > 15) globalTranspose = 15;
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

  // 88 keys total (A0 to C8)
  const totalNotes = 88;
  const totalWhiteKeys = 52; 
  
  // A0 is -27 semitones relative to C3
  const startOffset = -27; 
  
  // Calculate widths as pure percentages to fit screen
  const whiteKeyWidthPercent = 100 / totalWhiteKeys;
  const blackKeyWidthPercent = whiteKeyWidthPercent * 0.7; // Slightly narrower than white

  let whiteKeyCount = 0;

  for(let i = 0; i < totalNotes; i++) {
      const currentSemitone = startOffset + i; 
      const freq = BASE_NOTE_FREQ * Math.pow(2, currentSemitone / 12);
      const freqStr = freq.toFixed(2);

      // Determine Note Color
      // Note index relative to A (0): A=0, A#=1, B=2, C=3, C#=4, D=5...
      const noteIndex = i % 12;
      // White keys are at indices: 0(A), 2(B), 3(C), 5(D), 7(E), 8(F), 10(G)
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
          // Center black key on the boundary of the previous white key
          // Logic: (PreviousWhiteCount * WhiteWidth) - (HalfBlackWidth)
          key.style.left = ((whiteKeyCount * whiteKeyWidthPercent) - (blackKeyWidthPercent / 2)) + "%";
      }

      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));
      wrapper.appendChild(key);
  }
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

      key.addEventListener("mousedown", () => triggerNoteByFreq(freq));
      rowDiv.appendChild(key);
    }
    board.appendChild(rowDiv);
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