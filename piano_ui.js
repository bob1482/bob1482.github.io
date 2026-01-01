// ==========================================
// PIANO UI: Rendering, Inputs, Visuals, Interaction
// ==========================================

// --- DOM ELEMENTS ---
const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const boardWrapper = document.getElementById("board-wrapper"); // Cache wrapper
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d");

// --- VISUALIZER & PLAYBACK STATE ---
let keyCoordinates = {}; 
let visualNotes = [];    
let fallingNotes = []; 
let playbackTimeouts = [];
const NOTE_SPEED = 2;    
const FALL_DURATION = 1500; 

// --- INITIALIZATION ---
window.addEventListener('samplesLoaded', () => {
    updateUI();
    startVisualizerLoop();
});

// Run initial render immediately
renderBoard();
updateUI();


// --- CORE INTERACTION (PRESS/RELEASE) ---

// 1. PRESS
async function pressNote(freq, isAutomated = false) {
  if (Tone.context.state !== 'running') await Tone.start();
  if (!isLoaded && soundMode === 0) return; 

  // Record Logic
  if (isRecording && !isAutomated) {
    recordedEvents.push({
      type: 'on',
      freq: freq,
      time: Date.now() - recordingStartTime
    });
  }

  const freqStr = freq.toFixed(2);
  
  // UI: Active Class
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  allKeys.forEach(k => k.classList.add("active"));
  
  // Visuals: Start note rising from bottom
  startVisualNote(freqStr); 

  // Audio: Trigger Sound in Core
  triggerSound(freq);
}

// 2. RELEASE
function releaseNote(freq, isAutomated = false) {
  if (isRecording && !isAutomated) {
    recordedEvents.push({
      type: 'off',
      freq: freq,
      time: Date.now() - recordingStartTime
    });
  }

  const freqStr = freq.toFixed(2);
  const allKeys = document.querySelectorAll(`[data-note="${freqStr}"]`);
  allKeys.forEach(k => k.classList.remove("active"));
  
  endVisualNote(freqStr); 
}

// --- RENDERERS ---

function renderBoard() {
  boardLeft.innerHTML = "";
  boardRight.innerHTML = "";
  freqToKeyMap = {}; // Reset map
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

// --- HELPER: GET LABELS ---
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

// --- UI UPDATER ---
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

// --- BUTTON HANDLERS ---
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
    boardWrapper.style.display = "flex"; btn.innerText = "HIDE";
  } else {
    boardWrapper.style.display = "none"; btn.innerText = "SHOW";
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

// --- RECORDER / PLAYBACK CONTROL ---

function toggleRecording() {
  if (isPlaying) stopPlayback();
  if (isRecording) {
    isRecording = false;
  } else {
    isRecording = true;
    recordedEvents = [];
    recordingStartTime = Date.now();
  }
  updateUI();
}

function clearRecording() {
  recordedEvents = [];
  isRecording = false;
  fallingNotes = [];
  if (isPlaying) stopPlayback();
  updateUI();
}

function togglePlayback() {
  if (isRecording) toggleRecording();
  if (isPlaying) stopPlayback();
  else startPlayback();
}

function startPlayback() {
  if (recordedEvents.length === 0) return;
  isPlaying = true;
  updateUI();

  // HIDE KEYS: Hide the central board during playback
  boardWrapper.style.display = "none";
  document.getElementById("btn-board").innerText = "SHOW";

  // Process Events for Duration
  let activeNotes = {};
  let processedEvents = [];
  recordedEvents.forEach(e => {
    let evt = { ...e };
    if (evt.type === 'on') {
      activeNotes[evt.freq] = evt.time;
      evt.duration = 500; 
      processedEvents.push(evt);
    } else if (evt.type === 'off') {
      for (let i = processedEvents.length - 1; i >= 0; i--) {
        if (processedEvents[i].freq === evt.freq && processedEvents[i].type === 'on' && !processedEvents[i].hasEnd) {
          processedEvents[i].duration = evt.time - processedEvents[i].time;
          processedEvents[i].hasEnd = true;
          break;
        }
      }
      processedEvents.push(evt);
    }
  });

  // Schedule Audio & Visuals
  processedEvents.forEach(event => {
    // Audio (Delayed)
    const audioTime = event.time + FALL_DURATION;
    const audioId = setTimeout(() => {
      if (event.type === 'on') pressNote(event.freq, true); 
      else releaseNote(event.freq, true);
    }, audioTime);
    playbackTimeouts.push(audioId);

    // Visuals (Immediate)
    if (event.type === 'on') {
      const visualId = setTimeout(() => {
        spawnFallingNote(event.freq, event.duration);
      }, event.time);
      playbackTimeouts.push(visualId);
    }
  });

  const lastEvent = recordedEvents[recordedEvents.length - 1];
  const finishId = setTimeout(() => { stopPlayback(); }, lastEvent.time + FALL_DURATION + 1000);
  playbackTimeouts.push(finishId);
}

function stopPlayback() {
  isPlaying = false;
  playbackTimeouts.forEach(id => clearTimeout(id));
  playbackTimeouts = [];
  fallingNotes = [];
  
  // RESTORE KEYS: Show board when done
  boardWrapper.style.display = "flex";
  document.getElementById("btn-board").innerText = "HIDE";

  const activeKeys = document.querySelectorAll('.active');
  activeKeys.forEach(k => k.classList.remove('active'));
  visualNotes.forEach(n => n.active = false);
  
  updateUI();
}


// --- VISUALIZER ENGINE ---

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.83; 
  updateKeyCoordinates();
}
window.addEventListener('resize', resizeCanvas);

function updateKeyCoordinates() {
  const keys = document.querySelectorAll('.p-key');
  keys.forEach(key => {
    const freq = key.getAttribute('data-note');
    const rect = key.getBoundingClientRect();
    keyCoordinates[freq] = { x: rect.left, width: rect.width };
  });
}

function spawnFallingNote(freqStr, duration) {
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const coords = keyCoordinates[freqStr];
  if (!coords) return;
  const speed = canvas.height / FALL_DURATION;
  const barLength = duration * speed;

  fallingNotes.push({
    freq: freqStr,
    x: coords.x,
    width: coords.width,
    y: -barLength,
    height: barLength,
    color: '#00d2ff', // Cyan for playback
    spawnTime: Date.now(),
  });
}

function startVisualNote(freqStr) {
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const coords = keyCoordinates[freqStr];
  if (!coords) return;
  const existing = visualNotes.find(n => n.freq === freqStr && n.active);
  if (existing) return;

  visualNotes.push({
    freq: freqStr,
    active: true,
    x: coords.x,
    width: coords.width,
    y: canvas.height, 
    height: 0,
    color: '#888888' // Grey for manual
  });
}

function endVisualNote(freqStr) {
  const note = visualNotes.find(n => n.freq === freqStr && n.active);
  if (note) note.active = false;
}

function startVisualizerLoop() {
  resizeCanvas(); 
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. FALLING NOTES (Playback)
    fallingNotes = fallingNotes.filter(n => n.y < canvas.height);
    fallingNotes.forEach(note => {
      const now = Date.now();
      const progress = (now - note.spawnTime) / FALL_DURATION;
      const currentBottom = canvas.height * progress;
      note.y = currentBottom - note.height;

      // GRADIENT EFFECT (Same as rising notes)
      const grad = ctx.createLinearGradient(note.x, note.y, note.x + note.width, note.y);
      grad.addColorStop(0, note.color);
      grad.addColorStop(0.5, "white"); // Shine center
      grad.addColorStop(1, note.color);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, note.width, note.height, 4);
      ctx.fill();
    });

    // 2. RISING NOTES (Manual)
    visualNotes = visualNotes.filter(n => n.y + n.height > -50);
    visualNotes.forEach(note => {
      if (note.active) {
        note.height += NOTE_SPEED;
        note.y = canvas.height - note.height;
      } else {
        note.y -= NOTE_SPEED;
      }
      
      const grad = ctx.createLinearGradient(note.x, note.y, note.x + note.width, note.y);
      grad.addColorStop(0, note.color);
      grad.addColorStop(0.5, "white");
      grad.addColorStop(1, note.color);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, note.width, note.height, 4);
      ctx.fill();
    });
    requestAnimationFrame(loop);
  }
  loop();
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