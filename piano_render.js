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
window.freqToKeyMapLeft = {};
window.freqToKeyMapRight = {};

function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";
  
  // Clear Maps
  window.freqToKeyMapLeft = {}; 
  window.freqToKeyMapRight = {};
  window.boardFrequencies = new Set(); // Track all frequencies currently on the Wicki board
  domKeyCache = {}; 
  
  // Determine if we are on mobile
  const isMobile = typeof isMobileMode === 'function' ? isMobileMode() : false;
  
  // Dynamic dimensions based on screen mode
  const currentRows = isMobile ? 8 : 5;   // 9 rows on mobile, 5 on desktop
  const currentCols = isMobile ? 12 : 12;  // 4 columns on mobile, 12 on desktop
  const SPLIT_COL = isMobile ? currentCols : 6; // Put everything on boardLeft in mobile

  for (let r = 0; r < currentRows; r++) {
    const rowDivL = document.createElement("div");
    rowDivL.className = `row ${r % 2 === 0 ? 'even-row' : 'odd-row'}`;
    
    const rowDivR = document.createElement("div");
    rowDivR.className = `row ${r % 2 === 0 ? 'even-row' : 'odd-row'}`;

    for (let c = 0; c < currentCols; c++) {
      const mapRowIndex = currentRows - 1 - r;
      let keyCode = "";
      
      // Only apply PC Keyboard mappings if we are NOT on mobile
      if (!isMobile && KEY_MAPS[mapRowIndex] && KEY_MAPS[mapRowIndex][c]) {
        keyCode = KEY_MAPS[mapRowIndex][c];
      }

      // Calculate Pitch
      let rowManualShift = 0;
      
      rowManualShift = r + r % 2;

      
      
      let activeTranspose = (c < SPLIT_COL) ? transposeLeft : transposeRight;
      let semitoneOffset = r * 5 + c * 2 + activeTranspose + rowManualShift;
      
      let freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
      let noteIndex = ((semitoneOffset % 12) + 12) % 12;
      let isNatural = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

      const freqStr = freq.toFixed(2);
      window.boardFrequencies.add(freqStr); // Save this note to our tracking set
      
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
      
      // Restore played marker if it exists in our memory
      if (typeof playedFrequencies !== 'undefined' && playedFrequencies.has(freqStr)) {
          key.classList.add("played-note");
      }
      
      key.setAttribute("data-note", freqStr);
      if (keyCode) key.setAttribute("data-key", keyCode); 

      key.innerHTML = getLabelText(semitoneOffset, keyCode);

      // Determine Side for Event Listeners
      const isLeft = c < SPLIT_COL;
      const side = isLeft ? 'left' : 'right';

      // Upgraded Mouse Events (Touch is now handled globally)
      key.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          if(typeof pressNote === 'function') pressNote(freq, false, side);
      });
      key.addEventListener("mouseenter", () => {
          if(window.isMouseDown && typeof pressNote === 'function') pressNote(freq, false, side);
      });
      key.addEventListener("mouseleave", () => {
          if(typeof releaseNote === 'function') releaseNote(freq);
      });
      key.addEventListener("mouseup", (e) => {
          if (e.button !== 0) return;
          if(typeof releaseNote === 'function') releaseNote(freq);
      });

      if (c < SPLIT_COL) {
          rowDivL.appendChild(key);
      } else {
          rowDivR.appendChild(key);
      }
    }
    
    boardLeft.appendChild(rowDivL);
    if (!isMobile) boardRight.appendChild(rowDivR);
  }
  
  // Hide right board entirely on mobile
  boardRight.style.display = isMobile ? "none" : "flex";
  
  // Render bottom piano strip only if not mobile, OR if forced to show
  if (!isMobile || showMobileStrip) {
      renderTraditionalPiano();
  }
  
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
      
      // FIX: Calculate note index strictly relative to C (0 = C, 1 = C#, etc.)
      const noteIndex = ((currentSemitone % 12) + 12) % 12;
      
      // FIX: Use standard C-based layout for white keys
      const isWhite = [0, 2, 4, 5, 7, 9, 11].includes(noteIndex);

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
           // Removed hardcoded grey so it inherits the high-contrast key colors
           
           const octave = Math.floor(currentSemitone / 12) + 3;
           lbl.innerText = NOTE_NAMES[noteIndex] + octave;
           
           key.appendChild(lbl);
      }

      // Numeric Mode for Traditional Piano Strip
      if (labelMode === 2) {
           const lbl = document.createElement("div");
           lbl.className = "key-label";
           // Removed hardcoded grey so it inherits the high-contrast key colors
           
           const octave = Math.floor(currentSemitone / 12) + 3;
           const numNames = ["1", "1#", "2", "2#", "3", "4", "4#", "5", "5#", "6", "6#", "7"];
           const dotsTop = octave > 4 ? "•".repeat(octave - 4) : "";
           const dotsBottom = octave < 4 ? "•".repeat(4 - octave) : "";
           
           lbl.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; line-height: 1;">
                     <span style="font-size: 6px; height: 6px; display: block; letter-spacing: 1px;">${dotsTop}</span>
                     <span>${numNames[noteIndex]}</span>
                     <span style="font-size: 6px; height: 6px; display: block; letter-spacing: 1px;">${dotsBottom}</span>
                  </div>`;
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

      // Dim the key if it is NOT currently on the Wicki board
      if (window.boardFrequencies && !window.boardFrequencies.has(freqStr)) {
          key.classList.add("out-of-range");
      }

      // Upgraded Mouse Events (Touch is now handled globally)
      key.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          pressNote(freq, false, 'right');
      });
      key.addEventListener("mouseenter", () => {
          if (window.isMouseDown) pressNote(freq, false, 'right');
      });
      key.addEventListener("mouseleave", () => releaseNote(freq));
      key.addEventListener("mouseup", (e) => {
          if (e.button !== 0) return;
          releaseNote(freq);
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
