// ==========================================
// PIANO RENDER: DOM, Views, UI Updates
// ==========================================

// --- DOM ELEMENTS ---
const board = document.getElementById("board");
const boardWrapper = document.getElementById("board-wrapper"); 

// --- VISUAL SETTINGS ---
const KEY_COLOR = '#00d2ff';
const RIGHT_KEY_COLOR = '#c87ad1';

// --- CACHE ---
let domKeyCache = {};   
let playedFrequencies = new Set(); // Tracks played notes across redraws   

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
function highlightKey(freq, color) {
  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  // Auto-detect color from the right-side class if not explicitly provided
  if (color === undefined) {
    let hasRightSide = false;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].classList.contains('right-side')) { hasRightSide = true; break; }
    }
    color = hasRightSide ? RIGHT_KEY_COLOR : KEY_COLOR;
  }
  for (let i = 0; i < keys.length; i++) {
      keys[i].classList.add("active");
      if (keys[i].classList.contains("key")) createRipple(keys[i], color);
  }
}

function unhighlightKey(freq) {
  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
}

function createRipple(keyElement, color = KEY_COLOR) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';

    const parent = keyElement.closest('.wicki-board');
    ripple.style.borderColor = color;

    keyElement.appendChild(ripple);

    setTimeout(() => {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 500);
}

function clearAllHighlights() {
    const activeKeys = document.querySelectorAll('.active');
    activeKeys.forEach(k => k.classList.remove('active'));
    
    // Clear the persistent scale markers
    const playedKeys = document.querySelectorAll('.played-note');
    playedKeys.forEach(k => k.classList.remove('played-note'));
    
    // Clear the tracking memory
    if (typeof playedFrequencies !== 'undefined') playedFrequencies.clear();
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
window.freqToKeyMap = {};

function renderBoard() {
  board.innerHTML = "";
  
  // Clear Maps
  window.freqToKeyMap = {};
  window.boardFrequencies = new Set(); // Track all frequencies currently on the Wicki board
  domKeyCache = {}; 
  
  // Always use desktop layout (5 rows)
  const currentRows = KEY_MAPS.length;
  const currentCols = 12;

  for (let r = 0; r < currentRows; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.className = `row ${r % 2 === 0 ? 'even-row' : 'odd-row'}`;

    for (let c = 0; c < currentCols; c++) {
      const mapRowIndex = currentRows - 1 - r;
      let keyCode = "";
      
      // Apply PC Keyboard mappings
      if (KEY_MAPS[mapRowIndex] && KEY_MAPS[mapRowIndex][c]) {
        keyCode = KEY_MAPS[mapRowIndex][c];
      }

      // Calculate Pitch
      let rowManualShift = 0;
      
      rowManualShift = r + r % 2;

      let semitoneOffset = r * 5 + c * 2 + transpose + rowManualShift;
      
      let freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
      let noteIndex = ((semitoneOffset % 12) + 12) % 12;
      let isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      const freqStr = freq.toFixed(2);
      window.boardFrequencies.add(freqStr); // Save this note to our tracking set
      
      // --- MAP KEYCODE TO FREQUENCY ---
      if (keyCode) {
          window.freqToKeyMap[freqStr] = keyCode;
      }

      const isRightSide = c >= 6;
      const key = document.createElement("div");
      key.className = `key ${isNatural ? "natural" : "accidental"}${isRightSide ? " right-side" : ""}`;
      
      // Restore played marker if it exists in our memory
      if (typeof playedFrequencies !== 'undefined' && playedFrequencies.has(freqStr)) {
          key.classList.add("played-note");
      }
      
      key.setAttribute("data-note", freqStr);
      if (keyCode) key.setAttribute("data-key", keyCode); 

      key.innerHTML = getLabelText(semitoneOffset, keyCode);

      // Upgraded Mouse Events (Touch is now handled globally)
      key.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          if(typeof pressNote === 'function') pressNote(freq, false, key);
      });
      key.addEventListener("mouseenter", () => {
          if(window.isMouseDown && typeof pressNote === 'function') pressNote(freq, false, key);
      });
      key.addEventListener("mouseleave", () => {
          if(typeof releaseNote === 'function') releaseNote(freq, false, key);
      });
      key.addEventListener("mouseup", (e) => {
          if (e.button !== 0) return;
          if(typeof releaseNote === 'function') releaseNote(freq, false, key);
      });

      rowDiv.appendChild(key);
    }
    
    board.appendChild(rowDiv);
  }
  
  // Render bottom piano strip
  renderTraditionalPiano();
  
  if(typeof updateKeyCoordinates === 'function') updateKeyCoordinates();

  // Apply the proper zoom scale immediately after rendering
  if(typeof applyZoom === 'function') applyZoom();
}

function renderTraditionalPiano() {
  const strip = document.getElementById("piano-strip");
  strip.innerHTML = ""; 
  keyCoordinates = {}; 
  
  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  strip.appendChild(wrapper);

  const startOffset = typeof stripRangeLeft !== 'undefined' ? stripRangeLeft : -27;
  const endOffset = typeof stripRangeRight !== 'undefined' ? stripRangeRight : 60;
  const totalNotes = endOffset - startOffset + 1;

  let totalWhiteKeys = 0;
  for (let i = 0; i < totalNotes; i++) {
      const noteIndex = (((startOffset + i) % 12) + 12) % 12;
      if ([0, 2, 4, 5, 7, 9, 11].includes(noteIndex)) {
          totalWhiteKeys++;
      }
  }

  if (totalWhiteKeys === 0) totalWhiteKeys = 1;

  const whiteKeyWidthPercent = 100 / totalWhiteKeys;
  const blackKeyWidthPercent = whiteKeyWidthPercent * 0.7; 
  let whiteKeyCount = 0;

  for(let i = 0; i < totalNotes; i++) {
      const currentSemitone = startOffset + i; 
      const freq = BASE_NOTE_FREQ * Math.pow(2, currentSemitone / 12);
      const freqStr = freq.toFixed(2);
      
      const noteIndex = ((currentSemitone % 12) + 12) % 12;
      
      const isWhite = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      const key = document.createElement("div");
      key.setAttribute("data-note", freqStr);
      
      // --- SINGLE LABEL LOGIC ---
      const keyCode = window.freqToKeyMap[freqStr];
      

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

      // Dim the key if it is NOT currently on the Wicki board
      if (window.boardFrequencies && !window.boardFrequencies.has(freqStr)) {
          key.classList.add("out-of-range");
      }

      // Upgraded Mouse Events (Touch is now handled globally)
      key.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          pressNote(freq, false, key);
      });
      key.addEventListener("mouseenter", () => {
          if (window.isMouseDown) pressNote(freq, false, key);
      });
      key.addEventListener("mouseleave", () => releaseNote(freq, false, key));
      key.addEventListener("mouseup", (e) => {
          if (e.button !== 0) return;
          releaseNote(freq, false, key);
      });

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
  if (labelMode === 3) return ""; // 3 is now NONE
  
  if (labelMode === 1) { // KEYS MODE
    if (!keyCode) return "";
    
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
  
  if (labelMode === 2) { // NUMERIC MODE (Jianpu)
    const noteIndex = ((semitoneOffset % 12) + 12) % 12; 
    const octave = Math.floor(semitoneOffset / 12) + 3; 
    const numNames = ["1", "1#", "2", "2#", "3", "4", "4#", "5", "5#", "6", "6#", "7"];
    
    // Octave 4 has no dots. Higher = dots above, Lower = dots below.
    const dotsTop = octave > 4 ? "•".repeat(octave - 4) : "";
    const dotsBottom = octave < 4 ? "•".repeat(4 - octave) : "";
    
    // Wrap in a tiny flexbox to stack the dots vertically
    return `<div style="display:flex; flex-direction:column; align-items:center; line-height: 1; margin-top: -2px;">
               <span style="font-size: 8px; height: 8px; display: block; letter-spacing: 1px;">${dotsTop}</span>
               <span>${numNames[noteIndex]}</span>
               <span style="font-size: 8px; height: 8px; display: block; letter-spacing: 1px;">${dotsBottom}</span>
            </div>`;
  }
  
  // NOTES MODE (labelMode === 0)
  const totalSteps = semitoneOffset;
  const noteIndex = ((totalSteps % 12) + 12) % 12; 
  const octave = Math.floor(totalSteps / 12) + 3; 
  return NOTE_NAMES[noteIndex] + octave;
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