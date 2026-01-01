// ==========================================
// PIANO UI: High-Precision & Optimized
// ==========================================

// --- DOM ELEMENTS ---
const boardLeft = document.getElementById("board-left");
const boardRight = document.getElementById("board-right");
const boardWrapper = document.getElementById("board-wrapper"); 
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d");

// --- CACHE & POOLS (Anti-Lag) ---
let domKeyCache = {};   
let notePool = [];      
let visualNotes = [];   
let fallingNotes = [];  
let keyCoordinates = {}; 

// SETTINGS
const NOTE_SPEED = 4;      
const FALL_DURATION = 2.0; 

// --- INITIALIZATION ---
window.addEventListener('samplesLoaded', () => {
    updateUI();
    startVisualizerLoop();
});

renderBoard();
updateUI();


// --- INTERACTION ---

async function pressNote(freq, isAutomated = false) {
  if (Tone.context.state !== 'running') await Tone.start();
  if (!isLoaded && soundMode === 0) return; 

  // RECORDING: Use Tone.now() (AudioContext Time)
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'on', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);

  // FAST DOM UPDATE
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) {
      keys[i].classList.add("active");
  }
  
  // VISUALS
  if(!isAutomated) startManualVisualNote(freqStr); 

  // AUDIO (0 = Immediate)
  if(!isAutomated) triggerSound(freq, 0); 
}

function releaseNote(freq, isAutomated = false) {
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'off', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);
  const keys = getCachedKeys(freqStr);
  for (let i = 0; i < keys.length; i++) {
      keys[i].classList.remove("active");
  }
  
  endManualVisualNote(freqStr); 
}

// --- DOM CACHING ---
function getCachedKeys(freqStr) {
    if (!domKeyCache[freqStr]) {
        domKeyCache[freqStr] = document.querySelectorAll(`[data-note="${freqStr}"]`);
    }
    return domKeyCache[freqStr];
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

// --- BUTTONS ---
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
let schedulerTimer = null; 
let playbackStartTime = 0;
let nextEventIndex = 0;
let visualEventIndex = 0;
let currentPlaybackEvents = [];

function toggleRecording() {
  if (isPlaying) stopPlayback();
  if (isRecording) {
    isRecording = false;
  } else {
    isRecording = true;
    recordedEvents = [];
    recordingStartTime = Tone.now(); // PRECISION: Uses AudioContext time
  }
  updateUI();
}

function clearRecording() {
  recordedEvents = [];
  isRecording = false;
  recycleAllNotes(); 
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
  boardWrapper.style.display = "none";
  document.getElementById("btn-board").innerText = "SHOW";
  currentPlaybackEvents = processRecordedEvents();
  nextEventIndex = 0;
  visualEventIndex = 0;
  const now = Tone.now();
  playbackStartTime = now + FALL_DURATION + 0.5; 
  schedulerLoop();
}

function processRecordedEvents() {
    let active = {};
    let processed = [];
    let sorted = [...recordedEvents].sort((a, b) => a.time - b.time);
    sorted.forEach(evt => {
        if (evt.type === 'on') {
            active[evt.freq] = evt;
            evt.duration = 0.5; 
            processed.push(evt);
        } else if (evt.type === 'off') {
            if (active[evt.freq]) {
                const onEvent = active[evt.freq];
                onEvent.duration = evt.time - onEvent.time;
                delete active[evt.freq];
            }
        }
    });
    return processed;
}

// --- AUDIO SCHEDULER (Rule: Use AudioContext) ---
function schedulerLoop() {
    if (!isPlaying) return;
    const scheduleAheadTime = 0.1; 
    const currentContextTime = Tone.now();
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const absolutePlayTime = playbackStartTime + event.time;

        if (absolutePlayTime < currentContextTime + scheduleAheadTime) {
            triggerSound(event.freq, absolutePlayTime);
            Tone.Draw.schedule(() => { highlightKey(event.freq); }, absolutePlayTime);
            Tone.Draw.schedule(() => { unhighlightKey(event.freq); }, absolutePlayTime + event.duration);
            nextEventIndex++;
        } else {
            break; 
        }
    }
    schedulerTimer = setTimeout(schedulerLoop, 25);
    
    if (nextEventIndex >= currentPlaybackEvents.length) {
        const lastEvent = currentPlaybackEvents[currentPlaybackEvents.length - 1];
        const endTime = playbackStartTime + lastEvent.time + lastEvent.duration + 2.0;
        if (currentContextTime > endTime) stopPlayback();
    }
}

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
function stopPlayback() {
  isPlaying = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  Tone.Transport.cancel(); 
  recycleAllNotes(); 
  boardWrapper.style.display = "flex";
  document.getElementById("btn-board").innerText = "HIDE";
  const activeKeys = document.querySelectorAll('.active');
  activeKeys.forEach(k => k.classList.remove('active'));
  updateUI();
}

// --- VISUALIZER ENGINE (Rule: RequestAnimationFrame + Absolute Time) ---
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

// POOLING
function getNoteFromPool() {
    if (notePool.length > 0) return notePool.pop();
    return { freq: 0, x: 0, width: 0, height: 0, y: 0, color: '', targetTime: 0, active: false };
}
function recycleNote(note) {
    note.active = false;
    notePool.push(note);
}
function recycleAllNotes() {
    while(fallingNotes.length > 0) recycleNote(fallingNotes.pop());
    while(visualNotes.length > 0) recycleNote(visualNotes.pop());
}

function spawnFallingNote(freqStr, duration, targetTime) {
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const freqFixed = (typeof freqStr === 'number') ? freqStr.toFixed(2) : freqStr;
  const coords = keyCoordinates[freqFixed];
  if (!coords) return;
  const pixelsPerSecond = canvas.height / FALL_DURATION;
  const noteHeight = duration * pixelsPerSecond;
  const note = getNoteFromPool();
  note.freq = freqFixed;
  note.x = coords.x;
  note.width = coords.width;
  note.height = noteHeight;
  note.color = '#9b64b8ff';
  note.targetTime = targetTime;
  note.active = true;
  fallingNotes.push(note);
}

function startManualVisualNote(freqStr) {
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const coords = keyCoordinates[freqStr];
  if (!coords) return;
  for(let i=0; i<visualNotes.length; i++) {
      if(visualNotes[i].freq === freqStr && visualNotes[i].active) return;
  }
  const note = getNoteFromPool();
  note.freq = freqStr;
  note.x = coords.x;
  note.width = coords.width;
  note.y = canvas.height;
  note.height = 0;
  note.color = '#9b64b8ff';
  note.active = true;
  visualNotes.push(note);
}

function endManualVisualNote(freqStr) {
  for(let i=0; i<visualNotes.length; i++) {
      if(visualNotes[i].freq === freqStr && visualNotes[i].active) {
          visualNotes[i].active = false;
          return;
      }
  }
}

function startVisualizerLoop() {
  resizeCanvas(); 
  
  function loop() {
    // 1. Rule Check: Use requestAnimationFrame (implicit via function structure)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const currentAudioTime = Tone.now(); // 2. Rule Check: Use AudioContext Time

    if (isPlaying) {
        while(visualEventIndex < currentPlaybackEvents.length) {
            const evt = currentPlaybackEvents[visualEventIndex];
            const hitTime = playbackStartTime + evt.time; 
            const spawnTime = hitTime - FALL_DURATION;
            if (currentAudioTime >= spawnTime) {
                spawnFallingNote(evt.freq, evt.duration, hitTime);
                visualEventIndex++;
            } else {
                break; 
            }
        }
        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            
            // 3. Rule Check: Calculate position based on AudioTime
            const timeRemaining = note.targetTime - currentAudioTime;
            const pixelsPerSecond = canvas.height / FALL_DURATION;
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            const drawY = y - note.height;

            if (drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
                continue;
            }
            const grad = ctx.createLinearGradient(note.x, drawY, note.x + note.width, drawY);
            grad.addColorStop(0, note.color);
            grad.addColorStop(0.5, "white"); 
            grad.addColorStop(1, note.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(note.x, drawY, note.width, note.height, 4);
            ctx.fill();
        }
    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    for (let i = visualNotes.length - 1; i >= 0; i--) {
        const note = visualNotes[i];
        if (note.active) {
            note.height += NOTE_SPEED;
            note.y = canvas.height - note.height;
        } else {
            note.y -= NOTE_SPEED;
        }
        if (note.y + note.height < -50) {
            recycleNote(note);
            visualNotes.splice(i, 1);
            continue;
        }
        const grad = ctx.createLinearGradient(note.x, note.y, note.x + note.width, note.y);
        grad.addColorStop(0, note.color);
        grad.addColorStop(0.5, "white");
        grad.addColorStop(1, note.color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(note.x, note.y, note.width, note.height, 4);
        ctx.fill();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
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