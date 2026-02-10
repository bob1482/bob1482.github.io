// ==========================================
// PIANO INTERACTION: Events, Logic, Controls
// ==========================================

// --- NOTE LOGIC ---

async function pressNote(freq, isAutomated = false, side = 'right') {
  if (Tone.context.state !== 'running') await Tone.start();
  // Always check loading since we only have Sample mode now
  if (!isLoaded) return; 

  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'on', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);

  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) keys[i].classList.add("active");
  }
  
  if(!isAutomated && typeof startManualVisualNote === 'function') {
      const color = (side === 'left') ? COLOR_LEFT : COLOR_RIGHT;
      startManualVisualNote(freqStr, color); 
  }

  if(!isAutomated) triggerSound(freq, 0); 
}

function releaseNote(freq, isAutomated = false) {
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'off', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);
  
  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
  }
  
  if(!isAutomated && typeof endManualVisualNote === 'function') {
      endManualVisualNote(freqStr); 
  }
}

function releaseAllStuckNotes() {
    for (const [keyIdentifier, freq] of Object.entries(activePhysicalKeys)) {
        releaseNote(freq);
    }
    activePhysicalKeys = {};
    for (const [id, freq] of Object.entries(activeTouches)) {
        releaseNote(freq);
    }
    activeTouches = {};
}

// --- TOUCH ENGINE ---
let activeTouches = {}; 

function handleTouchStart(e) {
    e.preventDefault(); 
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('key')) {
            const freq = parseFloat(target.getAttribute('data-note'));
            const parent = target.closest('.wicki-board');
            const side = (parent && parent.id === 'board-left') ? 'left' : 'right';
            pressNote(freq, false, side);
            activeTouches[touch.identifier] = freq;
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (target && target.classList.contains('key')) {
            const newFreq = parseFloat(target.getAttribute('data-note'));
            const oldFreq = activeTouches[touch.identifier];
            if (newFreq !== oldFreq) {
                if (oldFreq !== undefined) releaseNote(oldFreq);
                const parent = target.closest('.wicki-board');
                const side = (parent && parent.id === 'board-left') ? 'left' : 'right';
                pressNote(newFreq, false, side);
                activeTouches[touch.identifier] = newFreq;
            }
        } else {
            const oldFreq = activeTouches[touch.identifier];
            if (oldFreq !== undefined) {
                releaseNote(oldFreq);
                delete activeTouches[touch.identifier];
            }
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const freq = activeTouches[touch.identifier];
        if (freq !== undefined) {
            releaseNote(freq);
            delete activeTouches[touch.identifier];
        }
    }
}

const boardContainer = document.getElementById('board-wrapper');
if (boardContainer) {
    boardContainer.addEventListener('touchstart', handleTouchStart, {passive: false});
    boardContainer.addEventListener('touchmove', handleTouchMove, {passive: false});
    boardContainer.addEventListener('touchend', handleTouchEnd);
    boardContainer.addEventListener('touchcancel', handleTouchEnd);
}

// Settings toggle removed

// --- RECORDER / PLAYBACK BUTTONS ---

function toggleRecording() {
    if (isPlaying) stopPlayback();

    if (isRecording) {
        // Stop
        isRecording = false;
        
        if (recordedEvents.length > 0) {
            const duration = recordedEvents[recordedEvents.length - 1].time;
            const newRecord = {
                name: `Rec ${recordingsList.length + 1} (${Math.round(duration)}s)`,
                events: [...recordedEvents],
                duration: duration
            };
            recordingsList.push(newRecord);
            currentRecordingIndex = recordingsList.length - 1;
            updateRecordSelectUI();
        }

    } else {
        // Start
        isRecording = true;
        recordedEvents = [];
        recordingStartTime = Tone.now(); 
        currentRecordingIndex = -1; 
    }
    updateUI();
}

function updateRecordSelectUI() {
    const select = document.getElementById('record-select');
    select.innerHTML = "";
    
    if (recordingsList.length === 0) {
        const opt = document.createElement('option');
        opt.value = -1;
        opt.innerText = "No Records";
        select.appendChild(opt);
        return;
    }

    recordingsList.forEach((rec, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = rec.name;
        if (idx === currentRecordingIndex) opt.selected = true;
        select.appendChild(opt);
    });
}

function changeRecording(val) {
    const idx = parseInt(val);
    if (idx >= 0 && idx < recordingsList.length) {
        stopPlayback(); 
        currentRecordingIndex = idx;
        recordedEvents = [...recordingsList[idx].events]; 
        console.log(`Loaded ${recordingsList[idx].name}`);
    }
}

function togglePlayback() {
    if (isRecording) toggleRecording(); 

    if (isPlaying) {
        if (isPaused) {
            resumePlayback();
        } else {
            stopPlayback(); 
        }
    } else {
        startPlayback(); 
    }
}

function pausePlayback() {
    if (isPlaying && !isPaused) {
        isPaused = true;
        if (typeof setVisualizerPause === 'function') setVisualizerPause(true);
        updateUI();
    } else if (isPlaying && isPaused) {
        resumePlayback();
    }
}

function resumePlayback() {
    if (isPlaying && isPaused) {
        isPaused = false;
        if (typeof setVisualizerPause === 'function') setVisualizerPause(false);
        updateUI();
    }
}

function scrubProgress(val) {
    if (recordingsList.length === 0 && recordedEvents.length === 0) return;
    if (isRecording) return;

    if (!isPlaying) {
        startPlayback();
        if (typeof seekToTime === 'function') seekToTime(val);
        pausePlayback();
    } else {
        if (typeof seekToTime === 'function') seekToTime(val);
    }
}

function clearRecording() {
    recordedEvents = [];
    isRecording = false;
    recordingsList = [];
    currentRecordingIndex = -1;
    updateRecordSelectUI();
    if(typeof recycleAllNotes === 'function') recycleAllNotes();
    if (isPlaying) stopPlayback();
    updateUI();
}

function changeTranspose(side, delta) {
  releaseAllStuckNotes(); 
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
  saveSettings();
}

function cycleLabels() {
  labelMode = (labelMode + 1) % 3;
  updateUI();
  renderBoard();
  saveSettings();
}

function toggleBoard() {
  const btn = document.getElementById("btn-board");
  if (boardWrapper.style.display === "none") {
    showBoard();
  } else {
    hideBoard();
  }
}

function toggleFKeys() {
  releaseAllStuckNotes(); 
  fKeyMode = (fKeyMode + 1) % 4;
  KEY_MAPS[0] = F_ROW_VARIANTS[fKeyMode];
  renderBoard();
  updateUI();
  saveSettings();
}

function toggleMetronome() {
    isMetronomeOn = !isMetronomeOn;
    const btn = document.getElementById("btn-metro");
    
    if (isMetronomeOn) {
        Tone.Transport.start();
        metroLoop.start(0);
        btn.style.background = "#5cb85c"; 
        btn.style.boxShadow = "0 0 5px #5cb85c";
    } else {
        if (!isPlaying) Tone.Transport.stop();
        metroLoop.stop();
        btn.style.background = ""; 
        btn.style.boxShadow = "";
    }
}

function updateBPM(val) {
    bpm = parseInt(val);
    Tone.Transport.bpm.value = bpm;
    saveSettings();
}

// --- VISUALS TOGGLE ---

function toggleVisuals() {
  // Toggle the visualizer state
  isVisualizerOn = !isVisualizerOn;
  
  // Update button UI
  const btn = document.getElementById("btn-visuals");
  if (btn) {
    btn.innerText = isVisualizerOn ? "ON" : "OFF";
    btn.style.color = isVisualizerOn ? "white" : "#888";
  }
  
  saveSettings();
}

// --- KEYBOARD LISTENERS ---

window.addEventListener("keydown", (e) => {
  if (e.code.startsWith("Arrow")) {
    if (e.repeat) return;
    const smallStep = 1;  
    const largeStep = 12; 
    
    if (e.code === "ArrowRight") { changeTranspose('right', smallStep); changeTranspose('left', smallStep); }
    else if (e.code === "ArrowLeft") { changeTranspose('right', -smallStep); changeTranspose('left', -smallStep); }
    else if (e.code === "ArrowUp") { changeTranspose('right', largeStep); changeTranspose('left', largeStep); }
    else if (e.code === "ArrowDown") { changeTranspose('right', -largeStep); changeTranspose('left', -largeStep); }
    return;
  }
  
  if (e.code === "Space") {
    e.preventDefault(); 
    if (e.repeat) return;
    releaseAllStuckNotes();

    const input = document.getElementById("input-sequence").value;
    const steps = input.trim().split(/\s+/);
    
    if (steps.length > 0 && steps[0] !== "") {
      const stepStr = steps[sequenceIndex % steps.length];
      let deltaLeft = 0;
      let deltaRight = 0;

      if (stepStr.includes(':')) {
        const parts = stepStr.split(':');
        deltaLeft = parseInt(parts[0]) || 0;
        deltaRight = parseInt(parts[1]) || 0;
      } else {
        const val = parseInt(stepStr) || 0;
        deltaLeft = val;
        deltaRight = val;
      }

      transposeLeft += deltaLeft;
      transposeRight += deltaRight;
      if (transposeLeft < -30) transposeLeft = -30;
      if (transposeLeft > 24) transposeLeft = 24;
      if (transposeRight < -30) transposeRight = -30;
      if (transposeRight > 24) transposeRight = 24;

      renderBoard();
      updateUI();
      sequenceIndex++;
    }
    return;
  }

  if (e.repeat) return;

  const key = document.querySelector(`.key[data-key="${CSS.escape(e.code)}"]`);
  if (key) { 
    e.preventDefault();
    const freq = parseFloat(key.getAttribute("data-note"));
    const parentBoard = key.closest('.wicki-board');
    const side = (parentBoard && parentBoard.id === 'board-left') ? 'left' : 'right';
    activePhysicalKeys[e.code] = freq;
    pressNote(freq, false, side);
  }
});

window.addEventListener("keyup", (e) => {
  if (activePhysicalKeys[e.code]) {
      const freq = activePhysicalKeys[e.code];
      releaseNote(freq);
      delete activePhysicalKeys[e.code];
      return;
  }
});

window.addEventListener('click', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });
window.addEventListener('touchstart', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });

window.addEventListener('samplesLoaded', () => {
    updateUI();
    if (typeof initVisualizer === 'function') initVisualizer();
});

renderBoard();
updateUI();

function updateUI() {
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

// ==========================================
// AUTO-HIDE CONTROLS LOGIC
// ==========================================

const controlsPanel = document.getElementById('controls');
const HOVER_THRESHOLD = 200; // Pixels from top where controls stay visible

if (controlsPanel) {
    window.addEventListener('mousemove', (e) => {
        // 1. Safety Check: Don't hide if the user is interacting with an input
        // (e.g. typing in the sequencer or dragging the progress bar)
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT') && controlsPanel.contains(active)) {
            return;
        }

        // 2. Position Check
        if (e.clientY < HOVER_THRESHOLD) {
            // Mouse is near the top -> Show
            controlsPanel.classList.remove('hidden');
        } else {
            // Mouse is far away -> Hide
            controlsPanel.classList.add('hidden');
        }
    });
}