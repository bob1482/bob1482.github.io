// ==========================================
// PIANO RENDER: DOM, Views, UI Updates
// ==========================================

// --- DOM ELEMENTS ---
const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const boardWrapper = document.getElementById("board-wrapper"); 

// --- VISUAL SETTINGS ---
const COLOR_LEFT = '#00d2ff';  // Cyan
const COLOR_RIGHT = '#9b64b8'; // Purple

// --- CACHE ---
let domKeyCache = {};   

// --- DOM CACHING ---
function getCachedKeys(freqStr) {
    if (!domKeyCache[freqStr]) {
        domKeyCache[freqStr] = document.querySelectorAll(`[data-note="${freqStr}"]`);
    }
    return domKeyCache[freqStr];
}

// --- VISUAL HELPERS ---
function highlightKey(freq) {
  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) keys[i].classList.add("active");
}

function unhighlightKey(freq) {
  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
}

function clearAllHighlights() {
    const activeKeys = document.querySelectorAll('.active');
    activeKeys.forEach(k => k.classList.remove('active'));
}

function hideBoard() {
    boardWrapper.style.display = "none";
    document.getElementById("btn-board").innerText = "SHOW";
}

function showBoard() {
    boardWrapper.style.display = "flex";
    document.getElementById("btn-board").innerText = "HIDE";
}

// --- CORE RENDERERS ---
function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";
  domKeyCache = {}; 
  freqToKeyMap = {}; 
  const SPLIT_COL = 6; 

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
      if (keyMapChar) freqToKeyMap[freqStr] = keyMapChar;

      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}`;
      key.setAttribute("data-note", freqStr);
      if (keyMapChar) key.setAttribute("data-key", keyMapChar.toLowerCase());

      key.innerText = getLabelText(semitoneOffset, keyMapChar);

      // Determine Side for Event Listeners
      const isLeft = c < SPLIT_COL;
      const side = isLeft ? 'left' : 'right';

      // Check if interaction functions exist before attaching
      key.addEventListener("mousedown", () => {
          if(typeof pressNote === 'function') pressNote(freq, false, side);
      });
      key.addEventListener("mouseup", () => {
          if(typeof releaseNote === 'function') releaseNote(freq);
      });
      key.addEventListener("mouseleave", () => {
          if(typeof releaseNote === 'function') releaseNote(freq);
      });

      if (c < SPLIT_COL) rowDivL.appendChild(key);
      else rowDivR.appendChild(key);
    }
    boardLeft.appendChild(rowDivL);
    boardRight.appendChild(rowDivR);
  }
  
  renderTraditionalPiano();
  // Update visualizer coordinates if that module is loaded
  if(typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
}

function renderTraditionalPiano() {
  const strip = document.getElementById("piano-strip");
  strip.innerHTML = ""; 
  keyCoordinates = {}; 
  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  strip.appendChild(wrapper);
  const totalNotes = 88;
  const startOffset = -27; 
  const totalWhiteKeys = 52; 
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

      key.addEventListener("mousedown", () => {
         if(typeof pressNote === 'function') pressNote(freq, false, 'right');
      });
      key.addEventListener("mouseup", () => {
         if(typeof releaseNote === 'function') releaseNote(freq);
      });
      key.addEventListener("mouseleave", () => {
         if(typeof releaseNote === 'function') releaseNote(freq);
      });
      wrapper.appendChild(key);
  }
}

function getLabelText(semitoneOffset, keyChar) {
  if (labelMode === 2) return ""; 
  if (labelMode === 1) { 
    if (!keyChar) return "";
    if (keyChar === "ShiftRight") return "SL";
    if (keyChar === "CapsLock") return "CL";
    if (keyChar === "ShiftLeft") return "SR";
    if (keyChar === "PrintScreen") return "PS";
    return keyChar.toUpperCase();
  }
  const totalSteps = semitoneOffset;
  const noteIndex = ((totalSteps % 12) + 12) % 12; 
  const octave = Math.floor(totalSteps / 12) + 3; 
  return NOTE_NAMES[noteIndex] + octave;
}

function updateUI() {
  document.getElementById("disp-vol").innerText = Math.round(globalVolume * 10);
  document.getElementById("disp-sus").innerText = sustainMultiplier.toFixed(2) * 5;
  document.getElementById("disp-trans-l").innerText = transposeLeft;
  document.getElementById("disp-trans-r").innerText = transposeRight;
  document.getElementById("btn-labels").innerText = LABEL_MODES[labelMode];
  document.getElementById("btn-sound").innerText = SOUND_MODES[soundMode];
  document.getElementById("btn-shift").innerText = SHIFT_MODES[shiftMode];
  document.getElementById("btn-fkeys").innerText = F_KEY_LABELS[fKeyMode];
  
  const btnRecord = document.getElementById("btn-record");
  const btnPlay = document.getElementById("btn-play");
  
  if (isRecording) btnRecord.classList.add("recording");
  else btnRecord.classList.remove("recording");
  
  if (isPlaying) {
    btnPlay.innerText = "■"; 
    btnPlay.classList.add("playing");
  } else {
    btnPlay.innerText = "▶"; 
    btnPlay.classList.remove("playing");
  }
}