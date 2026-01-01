// ==========================================
// PIANO UI: DOM, Inputs, Rendering
// ==========================================

// --- DOM ELEMENTS ---
const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const boardWrapper = document.getElementById("board-wrapper"); 

// --- CACHE ---
let domKeyCache = {};   

// --- INITIALIZATION ---
window.addEventListener('samplesLoaded', () => {
    updateUI();
    // Initialize the visualizer engine (in piano_visualizer.js)
    if (typeof initVisualizer === 'function') initVisualizer();
});

renderBoard();
updateUI();

// --- INTERACTION ---

async function pressNote(freq, isAutomated = false) {
  if (Tone.context.state !== 'running') await Tone.start();
  if (!isLoaded && soundMode === 0) return; 

  // RECORDING
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'on', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);

  // DOM
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) keys[i].classList.add("active");
  
  // VISUALS (Call visualizer engine)
  if(!isAutomated && typeof startManualVisualNote === 'function') {
      startManualVisualNote(freqStr); 
  }

  // AUDIO
  if(!isAutomated) triggerSound(freq, 0); 
}

function releaseNote(freq, isAutomated = false) {
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'off', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
  
  // VISUALS
  if(!isAutomated && typeof endManualVisualNote === 'function') {
      endManualVisualNote(freqStr); 
  }
}

// --- DOM CACHING ---
function getCachedKeys(freqStr) {
    if (!domKeyCache[freqStr]) {
        domKeyCache[freqStr] = document.querySelectorAll(`[data-note="${freqStr}"]`);
    }
    return domKeyCache[freqStr];
}

// --- VISUAL HELPERS (Used by Visualizer) ---
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

// --- RENDERERS ---
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
  
  // Inform visualizer that DOM changed
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

      key.addEventListener("mousedown", () => pressNote(freq));
      key.addEventListener("mouseup", () => releaseNote(freq));
      key.addEventListener("mouseleave", () => releaseNote(freq));
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

// --- BUTTON HANDLERS (Called by HTML) ---

// Playback Controls (Proxy to Visualizer)
function toggleRecording() {
    if (isPlaying) stopPlayback();
    if (isRecording) {
        isRecording = false;
    } else {
        isRecording = true;
        recordedEvents = [];
        recordingStartTime = Tone.now(); 
    }
    updateUI();
}

function clearRecording() {
    recordedEvents = [];
    isRecording = false;
    // Call Visualizer cleanup
    if(typeof recycleAllNotes === 'function') recycleAllNotes();
    if (isPlaying) stopPlayback();
    updateUI();
}

function togglePlayback() {
    if (isRecording) toggleRecording();
    if (isPlaying) stopPlayback();
    else startPlayback(); // Call Visualizer engine
}

// Settings Controls
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
    if (transposeLeft < -30) transposeLeft = -30;
    if (transposeLeft > 24) transposeLeft = 24;
  } else {
    transposeRight += delta;
    if (transposeRight < -30) transposeRight = -30;
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
function toggleBoard() {
  const btn = document.getElementById("btn-board");
  if (boardWrapper.style.display === "none") {
    showBoard();
  } else {
    hideBoard();
  }
}
function toggleSoundMode() {
  soundMode = (soundMode + 1) % 2;
  updateUI();
}
function toggleShiftMode() {
  shiftMode = (shiftMode + 1) % 2;
  updateUI();
}
function toggleFKeys() {
  fKeyMode = (fKeyMode + 1) % 4;
  KEY_MAPS[0] = F_ROW_VARIANTS[fKeyMode];
  renderBoard();
  updateUI();
}

// --- INPUT LISTENERS ---
window.addEventListener("keydown", (e) => {
  if (e.key.startsWith("Arrow")) {
    if (e.repeat) return;
    const smallStep = shiftMode === 0 ? 5 : 1;
    const largeStep = shiftMode === 0 ? 12 : 2;
    if (e.key === "ArrowRight") { changeTranspose('right', smallStep); changeTranspose('left', smallStep); }
    else if (e.key === "ArrowLeft") { changeTranspose('right', -smallStep); changeTranspose('left', -smallStep); }
    else if (e.key === "ArrowUp") { changeTranspose('right', largeStep); changeTranspose('left', largeStep); }
    else if (e.key === "ArrowDown") { changeTranspose('right', -largeStep); changeTranspose('left', -largeStep); }
    return;
  }
  if (e.code === "Space") {
    e.preventDefault(); 
    if (e.repeat) return;
    const input = document.getElementById("input-sequence").value;
    const sequence = input.match(/-?\d+/g);
    if (sequence && sequence.length > 0) {
      const targetTranspose = parseInt(sequence[sequenceIndex % sequence.length]);
      transposeLeft = targetTranspose;
      transposeRight = targetTranspose;
      renderBoard();
      updateUI();
      sequenceIndex++;
    }
    return;
  }
  let searchKey = e.key.toLowerCase();
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") searchKey = e.code.toLowerCase();
  const key = document.querySelector(`.key[data-key="${CSS.escape(searchKey)}"]`);
  if (key) { 
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
  if (key) { 
    e.preventDefault();
    const freq = parseFloat(key.getAttribute("data-note"));
    releaseNote(freq);
  }
});

window.addEventListener('click', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });