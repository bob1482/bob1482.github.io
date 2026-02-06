// ==========================================
// PIANO INTERACTION: Events, Logic, Controls
// ==========================================

// --- NOTE LOGIC ---

async function pressNote(freq, isAutomated = false, side = 'right') {
  if (Tone.context.state !== 'running') await Tone.start();
  if (!isLoaded && soundMode === 0) return; 

  // RECORDING
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'on', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);

  // DOM HIGHLIGHTING
  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) keys[i].classList.add("active");
  }
  
  // VISUALS
  if(!isAutomated && typeof startManualVisualNote === 'function') {
      const color = (side === 'left') ? COLOR_LEFT : COLOR_RIGHT;
      startManualVisualNote(freqStr, color); 
  }

  // AUDIO
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
  
  // VISUALS
  if(!isAutomated && typeof endManualVisualNote === 'function') {
      endManualVisualNote(freqStr); 
  }
}

// --- HELPER: RELEASE STUCK NOTES ---
function releaseAllStuckNotes() {
    for (const [keyIdentifier, freq] of Object.entries(activePhysicalKeys)) {
        releaseNote(freq);
    }
    activePhysicalKeys = {};
    
    // Also clear touch notes
    for (const [id, freq] of Object.entries(activeTouches)) {
        releaseNote(freq);
    }
    activeTouches = {};
}

// --- TOUCH ENGINE (NEW) ---
// We track which note is currently being held by which finger ID.
let activeTouches = {}; // { touchId: frequency }

function handleTouchStart(e) {
    e.preventDefault(); // Stop mouse emulation
    const touches = e.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (target && target.classList.contains('key')) {
            const freq = parseFloat(target.getAttribute('data-note'));
            
            // Determine side based on parent container
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
        
        // Check if we moved to a NEW key
        if (target && target.classList.contains('key')) {
            const newFreq = parseFloat(target.getAttribute('data-note'));
            const oldFreq = activeTouches[touch.identifier];

            // If we slid to a different note
            if (newFreq !== oldFreq) {
                // Release old note if exists
                if (oldFreq !== undefined) releaseNote(oldFreq);
                
                // Play new note
                const parent = target.closest('.wicki-board');
                const side = (parent && parent.id === 'board-left') ? 'left' : 'right';
                pressNote(newFreq, false, side);
                
                // Update tracker
                activeTouches[touch.identifier] = newFreq;
            }
        } else {
            // Finger slid off ANY key -> release current note
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

// Attach Touch Listeners Globally
// We attach to the board wrapper to catch all drags
const boardContainer = document.getElementById('board-wrapper');
if (boardContainer) {
    boardContainer.addEventListener('touchstart', handleTouchStart, {passive: false});
    boardContainer.addEventListener('touchmove', handleTouchMove, {passive: false});
    boardContainer.addEventListener('touchend', handleTouchEnd);
    boardContainer.addEventListener('touchcancel', handleTouchEnd);
}

// --- BUTTON HANDLERS (UNCHANGED) ---

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
    if(typeof recycleAllNotes === 'function') recycleAllNotes();
    if (isPlaying) stopPlayback();
    updateUI();
}

function togglePlayback() {
    if (isRecording) toggleRecording();
    if (isPlaying) stopPlayback();
    else startPlayback(); 
}

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
  releaseAllStuckNotes(); 
  shiftMode = (shiftMode + 1) % 2;
  updateUI();
}

function toggleFKeys() {
  releaseAllStuckNotes(); 
  fKeyMode = (fKeyMode + 1) % 4;
  KEY_MAPS[0] = F_ROW_VARIANTS[fKeyMode];
  renderBoard();
  updateUI();
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
}

// --- KEYBOARD LISTENERS (UNCHANGED) ---

window.addEventListener("keydown", (e) => {
  if (e.code.startsWith("Arrow")) {
    if (e.repeat) return;
    const smallStep = shiftMode === 0 ? 5 : 1;
    const largeStep = shiftMode === 0 ? 12 : 2;
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

// Audio Context Starter
window.addEventListener('click', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });
window.addEventListener('touchstart', async () => {
  if (Tone.context.state !== 'running') await Tone.start();
}, { once: true });

// --- INITIALIZATION CALLS ---
window.addEventListener('samplesLoaded', () => {
    updateUI();
    if (typeof initVisualizer === 'function') initVisualizer();
});

// Re-attach touch listener on render if needed, but the board-wrapper one persists.
renderBoard();
updateUI();