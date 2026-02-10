// ==========================================
// PIANO RENDER: DOM, Views, UI Updates
// ==========================================

// --- DOM ELEMENTS ---
const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const boardWrapper = document.getElementById("board-wrapper"); 

// --- VISUAL SETTINGS ---
const COLOR_LEFT = '#00d2ff'; 
const COLOR_RIGHT = '#c87ad1';

// --- CACHE ---
let domKeyCache = {};   

// --- DOM CACHING ---
function getCachedKeys(freqStr) {
    if (!domKeyCache[freqStr]) {
        domKeyCache[freqStr] = document.querySelectorAll(`[data-note="${freqStr}"]`);
    }
    return domKeyCache[freqStr];
}

// --- LOADING SCREEN ---
function showLoading() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loader-spinner"></div>
            <div>LOADING SAMPLES...</div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('fade-out');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500); // Remove from DOM after fade
    }
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
// ==========================================
// GLOBALS FOR MAPPING (Window Scope)
// ==========================================
window.freqToKeyMapLeft = {};
window.freqToKeyMapRight = {};

function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";
  
  // Clear Maps
  window.freqToKeyMapLeft = {}; 
  window.freqToKeyMapRight = {};
  
  domKeyCache = {}; 
  const SPLIT_COL = 6; 

  for (let r = 0; r < ROWS; r++) {
    const rowDivL = document.createElement("div");
    rowDivL.className = "row row-" + r;
    const rowDivR = document.createElement("div");
    rowDivR.className = "row row-" + r;

    for (let c = 0; c < COLS; c++) {
      const mapRowIndex = ROWS - 1 - r;
      let keyCode = "";
      if (KEY_MAPS[mapRowIndex] && KEY_MAPS[mapRowIndex][c]) {
        keyCode = KEY_MAPS[mapRowIndex][c];
      }

      // Calculate Pitch
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
      
      // --- MAP KEYCODE TO SPECIFIC SIDE ---
      if (keyCode) {
          if (c < SPLIT_COL) {
              window.freqToKeyMapLeft[freqStr] = keyCode;
          } else {
              window.freqToKeyMapRight[freqStr] = keyCode;
          }
      }

      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}`;
      key.setAttribute("data-note", freqStr);
      if (keyCode) key.setAttribute("data-key", keyCode); 

      key.innerText = getLabelText(semitoneOffset, keyCode);

      // Determine Side for Event Listeners
      const isLeft = c < SPLIT_COL;
      const side = isLeft ? 'left' : 'right';

      // Mouse Events
      key.addEventListener("mousedown", () => {
          if(typeof pressNote === 'function') pressNote(freq, false, side);
      });
      key.addEventListener("mouseup", () => {
          if(typeof releaseNote === 'function') releaseNote(freq);
      });
      key.addEventListener("mouseleave", () => {
          if(typeof releaseNote === 'function') releaseNote(freq);
      });

      // Touch Events
      key.addEventListener("touchstart", (e) => {
          if(e.cancelable) e.preventDefault(); 
          if(typeof pressNote === 'function') pressNote(freq, false, side);
      }, {passive: false});

      key.addEventListener("touchend", (e) => {
          if(e.cancelable) e.preventDefault();
          if(typeof releaseNote === 'function') releaseNote(freq);
      });

      if (c < SPLIT_COL) rowDivL.appendChild(key);
      else rowDivR.appendChild(key);
    }
    boardLeft.appendChild(rowDivL);
    boardRight.appendChild(rowDivR);
  }
  
  renderTraditionalPiano();
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
      
      // --- DUAL LABEL LOGIC ---
      const leftCode = window.freqToKeyMapLeft[freqStr];
      const rightCode = window.freqToKeyMapRight[freqStr];
      
      // Create Label Elements
      if (leftCode && labelMode === 1) { // Mode 1 = KEYS
          const lbl = document.createElement("div");
          lbl.className = "key-label lbl-left";
          lbl.innerText = getFriendlyKeyName(leftCode);
          key.appendChild(lbl);
      }
      
      if (rightCode && labelMode === 1) {
          const lbl = document.createElement("div");
          lbl.className = "key-label lbl-right";
          lbl.innerText = getFriendlyKeyName(rightCode);
          key.appendChild(lbl);
      }
      
      // Fallback for Note Names mode
      if (labelMode === 0) {
           const lbl = document.createElement("div");
           lbl.className = "key-label";
           lbl.style.color = "#555";
           lbl.innerText = NOTE_NAMES[noteIndex];
           key.appendChild(lbl);
      }

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

      // Add Interaction Listeners (Same as before)
      key.addEventListener("mousedown", () => pressNote(freq, false, 'right'));
      key.addEventListener("mouseup", () => releaseNote(freq));
      key.addEventListener("mouseleave", () => releaseNote(freq));
      key.addEventListener("touchstart", (e) => { e.preventDefault(); pressNote(freq, false, 'right'); }, {passive: false});
      key.addEventListener("touchend", (e) => { e.preventDefault(); releaseNote(freq); });

      wrapper.appendChild(key);
  }
}

// Helper to clean up key names (extracted from previous getLabelText)
function getFriendlyKeyName(keyCode) {
    if (!keyCode) return "";
    if (keyCode.startsWith("Key")) return keyCode.replace("Key", "");
    if (keyCode.startsWith("Digit")) return keyCode.replace("Digit", "");
    if (keyCode.startsWith("F") && keyCode.length <= 3) return keyCode;
    
    const specialMap = {
        "Minus": "-", "Equal": "=", "BracketLeft": "[", "BracketRight": "]",
        "Semicolon": ";", "Quote": "'", "Comma": ",", "Period": ".", 
        "Slash": "/", "Backslash": "\\", "ShiftLeft": "SL", "ShiftRight": "SR",
        "CapsLock": "CL", "PrintScreen": "PS"
    };
    return specialMap[keyCode] || keyCode.slice(0, 2);
}

function getLabelText(semitoneOffset, keyCode) {
  if (labelMode === 2) return ""; 
  
  if (labelMode === 1) { // KEYS MODE
    if (!keyCode) return "";
    
    // Convert DOM 'code' to user-friendly text
    if (keyCode.startsWith("Key")) return keyCode.replace("Key", "");
    if (keyCode.startsWith("Digit")) return keyCode.replace("Digit", "");
    if (keyCode.startsWith("F") && keyCode.length <= 3) return keyCode; 
    
    switch(keyCode) {
        case "Minus": return "-";
        case "Equal": return "=";
        case "BracketLeft": return "[";
        case "BracketRight": return "]";
        case "Semicolon": return ";";
        case "Quote": return "'";
        case "Comma": return ",";
        case "Period": return ".";
        case "Slash": return "/";
        case "Backslash": return "\\";
        case "ShiftLeft": return "SL";
        case "ShiftRight": return "SR";
        case "CapsLock": return "CL";
        case "PrintScreen": return "PS";
        default: return keyCode.slice(0, 2); 
    }
  }
  
  // NOTES MODE
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
  document.getElementById("btn-fkeys").innerText = F_KEY_LABELS[fKeyMode];
  
  const btnRecord = document.getElementById("btn-record");
  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  
  // Recording State
  if (isRecording) {
      btnRecord.classList.add("recording");
      btnPlay.disabled = true;
      btnPause.disabled = true;
      document.getElementById('progress-bar').disabled = true;
      document.getElementById('record-select').disabled = true;
  } else {
      btnRecord.classList.remove("recording");
      btnPlay.disabled = false;
      document.getElementById('progress-bar').disabled = false;
      document.getElementById('record-select').disabled = false;
  }
  
  // Playback State
  if (isPlaying) {
    btnPlay.innerText = "■"; 
    btnPlay.classList.add("playing");
    btnPause.disabled = false;
    
    if (isPaused) {
        btnPause.innerText = "▶";
        btnPause.classList.add("paused");
    } else {
        btnPause.innerText = "II";
        btnPause.classList.remove("paused");
    }
  } else {
    btnPlay.innerText = "▶"; 
    btnPlay.classList.remove("playing");
    btnPause.innerText = "II";
    btnPause.disabled = true;
    btnPause.classList.remove("paused");
  }
}


// --- INITIALIZATION ---
// Show loading immediately
showLoading();

// Hide when 'samplesLoaded' event fires
window.addEventListener('samplesLoaded', () => {
    updateUI();
    hideLoading();
    if (typeof initVisualizer === 'function') initVisualizer();
});