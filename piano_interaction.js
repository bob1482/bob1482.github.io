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

// --- GLOBAL MOUSE TRACKING ---
window.isMouseDown = false;

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) window.isMouseDown = true;
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) window.isMouseDown = false;
});

// --- HIGHLIGHT RESET ---

function resetHighlights() {
    // 1. Release any physically stuck notes (stops audio and removes the base 'active' class)
    if (typeof releaseAllStuckNotes === 'function') {
        releaseAllStuckNotes();
    }
    
    // 2. Clear all persistent scale markers (the blue/pink borders)
    if (typeof clearAllHighlights === 'function') {
        clearAllHighlights();
    }
    
    // 3. Clear manual visual notes rising on the canvas
    if (typeof visualNotes !== 'undefined' && typeof recycleNote === 'function') {
        for (let i = visualNotes.length - 1; i >= 0; i--) {
            recycleNote(visualNotes[i]);
        }
        visualNotes.length = 0; // Empty the array
    }
    
    console.log("Keys and visuals reset!");
}

// --- TOUCH ENGINE ---
let activeTouches = {}; 

function handleTouchStart(e) {
    e.preventDefault(); 
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (target && (target.classList.contains('key') || target.classList.contains('p-key'))) {
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

        if (target && (target.classList.contains('key') || target.classList.contains('p-key'))) {
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
const stripContainer = document.getElementById('piano-strip');

function bindTouchEvents(element) {
    if (element) {
        element.addEventListener('touchstart', handleTouchStart, {passive: false});
        element.addEventListener('touchmove', handleTouchMove, {passive: false});
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd);
    }
}

bindTouchEvents(boardContainer);
bindTouchEvents(stripContainer);

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
    if (transposeLeft < -50) transposeLeft = -50;
    if (transposeLeft > 50) transposeLeft = 50;
  } else {
    transposeRight += delta;
    if (transposeRight < -50) transposeRight = -50;
    if (transposeRight > 50) transposeRight = 50;
  }
  renderBoard(); 
  updateUI();
  saveSettings();
}

// --- ZOOM CONTROLS ---

function changeZoom(delta) {
    mobileZoom += delta;
    // Clamp the zoom so they can't make it too tiny or absurdly huge
    if (mobileZoom < 0.3) mobileZoom = 0.3;
    if (mobileZoom > 1.5) mobileZoom = 1.5;
    
    applyZoom();
    updateUI();
    saveSettings();
}

function applyZoom() {
    const boardWrapper = document.getElementById("board-wrapper");
    if (boardWrapper) {
        const isMobile = typeof isMobileMode === 'function' ? isMobileMode() : false;
        if (isMobile) {
            boardWrapper.style.transform = `translate(-50%, -50%) scale(${mobileZoom})`;
        } else {
            boardWrapper.style.transform = `translate(-50%, -50%) scale(0.85)`; // Default desktop scale
        }
    }
}

// --- MOBILE STRIP CONTROLS ---

function toggleMobileStrip() {
    showMobileStrip = !showMobileStrip;
    
    applyMobileStripState();
    if (typeof applyStripHeight === 'function') applyStripHeight();
    
    // Re-render to physically draw the DOM keys, and resize the canvas
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof resizeCanvas === 'function') resizeCanvas();
    
    updateUI();
    saveSettings();
}

function applyMobileStripState() {
    const body = document.body;
    const btn = document.getElementById("btn-mobile-strip");
    
    if (showMobileStrip) {
        body.classList.add("force-strip");
        if (btn) btn.innerText = "HIDE";
    } else {
        body.classList.remove("force-strip");
        if (btn) btn.innerText = "SHOW";
    }
}

// --- STRIP HEIGHT CONTROLS ---

function changeStripRange(side, delta) {
    if (typeof releaseAllStuckNotes === 'function') releaseAllStuckNotes();

    if (side === 'left') {
        stripRangeLeft -= delta;
        if (stripRangeLeft > 0) stripRangeLeft = 0;
        if (stripRangeLeft < -50) stripRangeLeft = -50;
    } else {
        stripRangeRight += delta;
        if (stripRangeRight < 0) stripRangeRight = 0;
        if (stripRangeRight > 70) stripRangeRight = 70;
    }

    if (stripRangeLeft > stripRangeRight) stripRangeLeft = stripRangeRight;

    if (typeof renderBoard === 'function') renderBoard();
    updateUI();
    saveSettings();
}

function changeStripHeight(delta) {
    stripHeight += delta;
    
    if (stripHeight < 5) stripHeight = 5;
    if (stripHeight > 50) stripHeight = 50;
    
    applyStripHeight();
    
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
    
    updateUI();
    saveSettings();
}

function applyStripHeight() {
    const strip = document.getElementById("piano-strip");
    const canvas = document.getElementById("synthesia-canvas");
    const progCont = document.getElementById("progress-container");
    const progBar = document.getElementById("progress-bar");
    const body = document.body;
    
    const canvasHeight = 100 - stripHeight;
    const isMobileStripHidden = strip && window.getComputedStyle(strip).display === "none";
    const shouldApplyDynamic = !isMobileStripHidden;
    
    if (!shouldApplyDynamic) {
        if (strip) strip.style.removeProperty("height");
        if (canvas) canvas.style.removeProperty("height");
        if (progCont) progCont.style.removeProperty("height");
        if (progBar) progBar.style.removeProperty("width");
        return;
    }
    
    const importantFlag = body.classList.contains("force-strip") ? "important" : "";
    if (strip) strip.style.setProperty("height", `${stripHeight}vh`, importantFlag);
    if (canvas) canvas.style.setProperty("height", `${canvasHeight}vh`, importantFlag);
    if (progCont) progCont.style.setProperty("height", `${canvasHeight}vh`, importantFlag);
    if (progBar) progBar.style.setProperty("width", `calc(${canvasHeight}vh - 10px)`, importantFlag);
}

function cycleLabels() {
  labelMode = (labelMode + 1) % 4;
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

// --- LAYOUT MODE CONTROLS ---

const LAYOUT_LABELS = ["AUTO", "DESKTOP", "MOBILE"];

function cycleLayout() {
    layoutMode = (layoutMode + 1) % 3;
    
    // Apply the CSS class
    if (typeof applyLayoutModeClass === 'function') applyLayoutModeClass();
    
    // Force a redraw of the keys and canvas
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
    
    updateUI();
    saveSettings();
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
      if (transposeLeft < -50) transposeLeft = -50;
      if (transposeLeft > 50) transposeLeft = 50;
      if (transposeRight < -50) transposeRight = -50;
      if (transposeRight > 50) transposeRight = 50;

      renderBoard();
      updateUI();
      sequenceIndex++;
    }
    return;
  }

  // --- NUMPAD PLAYBACK CONTROLS ---
  
  // Numpad 5: Play / Pause
  if (e.code === "Numpad5") {
      e.preventDefault();
      if (isPlaying) {
          if (isPaused) resumePlayback();
          else pausePlayback();
      } else {
          startPlayback();
      }
      return;
  }

  // Numpad 0: Reset Highlights
  if (e.code === "Numpad0") {
      e.preventDefault();
      if (typeof resetHighlights === 'function') resetHighlights();
      return;
  }

  // Numpad 8 (Forward) & Numpad 2 (Backward): Seek 5 seconds
  if (e.code === "Numpad8" || e.code === "Numpad2") {
      e.preventDefault();
      if (!isPlaying) return;
      
      const currentAudioTime = Tone.now();
      const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
      let targetSeconds = elapsed + (e.code === "Numpad8" ? 5 : -5);

      // Clamp to beginning and end boundaries
      if (targetSeconds < 0) targetSeconds = 0;
      if (targetSeconds > playbackTotalDuration) targetSeconds = playbackTotalDuration;

      const targetPercent = (targetSeconds / playbackTotalDuration) * 100;
      seekToTime(targetPercent);
      return;
  }

  // Numpad 6 (Faster) & Numpad 4 (Slower): Speed Control
  if (e.code === "Numpad6" || e.code === "Numpad4") {
      e.preventDefault();
      const delta = (e.code === "Numpad6") ? 0.1 : -0.1;
      changePlaybackSpeed(delta);
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

// --- MEMORY RESET BUTTON ---
document.getElementById('btn-reset-memory')?.addEventListener('click', resetBrowserMemory);

renderBoard();
updateUI();

function deleteCurrentRecording() {
    // If there is no active recording and the buffer is empty, do nothing
    if (currentRecordingIndex === -1 && recordedEvents.length === 0) {
        return;
    }

    // Stop audio if it's currently playing
    if (isPlaying) {
        stopPlayback();
    }

    if (currentRecordingIndex >= 0) {
        // Remove the currently selected recording from the array
        recordingsList.splice(currentRecordingIndex, 1);
        
        if (recordingsList.length === 0) {
            // If that was the last recording, reset everything
            currentRecordingIndex = -1;
            recordedEvents = [];
        } else {
            // Otherwise, shift to the previous recording (or the first one)
            currentRecordingIndex = Math.max(0, currentRecordingIndex - 1);
            recordedEvents = [...recordingsList[currentRecordingIndex].events];
        }
    } else {
        // If it's just the unsaved buffer, clear it
        recordedEvents = [];
    }
    
    // Refresh the dropdown and UI states
    updateRecordSelectUI();
    updateUI();
}

function updateUI() {
  document.getElementById("disp-trans-l").innerText = transposeLeft;
  document.getElementById("disp-trans-r").innerText = transposeRight;
  document.getElementById("btn-labels").innerText = LABEL_MODES[labelMode];
  document.getElementById("btn-fkeys").innerText = F_KEY_LABELS[fKeyMode];

  const dispZoom = document.getElementById("disp-zoom");
  if (dispZoom) dispZoom.innerText = Math.round(mobileZoom * 100);
  
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
  const progressContainer = document.getElementById('progress-container');
  
  if (isPlaying) {
    btnPlay.innerText = "■"; 
    btnPlay.classList.add("playing");
    btnPause.disabled = false;
    
    // Show the progress bar when playing
    if (progressContainer) progressContainer.style.display = "block";
    
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
    
    // Hide the progress bar when stopped
    if (progressContainer) progressContainer.style.display = "none";
  }

  // Update the Layout button text
  const btnLayout = document.getElementById("btn-layout");
  if (btnLayout) btnLayout.innerText = LAYOUT_LABELS[layoutMode];
  
  // Ensure the body has the correct CSS class on load
  if (typeof applyLayoutModeClass === 'function') applyLayoutModeClass();

  if (typeof applyMobileStripState === 'function') applyMobileStripState();
  if (typeof applyStripHeight === 'function') applyStripHeight();
  
  const dispStrip = document.getElementById("disp-strip-height");
  if (dispStrip) dispStrip.innerText = stripHeight;

  const dispStripL = document.getElementById("disp-strip-l");
  if (dispStripL) dispStripL.innerText = stripRangeLeft;

  const dispStripR = document.getElementById("disp-strip-r");
  if (dispStripR) dispStripR.innerText = stripRangeRight;
}
