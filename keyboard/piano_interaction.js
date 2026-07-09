// ==========================================
// PIANO INTERACTION: Events, Logic, Controls
// ==========================================

// --- NOTE LOGIC ---
let manualFreqRefCounts = {};
let manualHoldFreqs = {};

function releaseManualHoldFreq(freqStr) {
  if (typeof sampler === 'undefined') return false;

  const heldVoice = activeVoices.find((voice) => {
      return voice.freq.toFixed(2) === freqStr && voice.timedTrackerKey === undefined;
  });

  if (!heldVoice) {
      delete manualHoldFreqs[freqStr];
      return false;
  }

  sampler.triggerRelease(heldVoice.freq, Tone.now());
  activeVoices = activeVoices.filter((voice) => voice.freq.toFixed(2) !== freqStr);
  delete manualHoldFreqs[freqStr];
  return true;
}

async function pressNote(freq, isAutomated = false, side = 'right', sourceElement = null) {
  if (Tone.context.state !== 'running') await Tone.start();
  // Always check loading since we only have Sample mode now
  if (!isLoaded) return; 

  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'on', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);

  if (!isAutomated) {
      manualFreqRefCounts[freqStr] = (manualFreqRefCounts[freqStr] || 0) + 1;
      if (sustainMode === 1) {
          manualHoldFreqs[freqStr] = true;
      }
  }

  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) {
          keys[i].classList.add("active");
          if (keys[i].classList.contains("key") && typeof createRipple === 'function') {
              createRipple(keys[i]);
          }
      }
  }
  
  if(!isAutomated && typeof startManualVisualNote === 'function') {
      const color = (side === 'left') ? COLOR_LEFT : COLOR_RIGHT;
      startManualVisualNote(freqStr, color); 
  }

  if(!isAutomated) triggerSound(freq, 0);
}

function releaseNote(freq, isAutomated = false, sourceElement = null) {
  if (isRecording && !isAutomated) {
    recordedEvents.push({ type: 'off', freq: freq, time: Tone.now() - recordingStartTime });
  }

  const freqStr = freq.toFixed(2);
  let shouldReleaseAudio = true;

  if (!isAutomated) {
      manualFreqRefCounts[freqStr] = Math.max(0, (manualFreqRefCounts[freqStr] || 0) - 1);
      if (manualFreqRefCounts[freqStr] > 0) {
          shouldReleaseAudio = false;
      } else {
          delete manualFreqRefCounts[freqStr];
      }
  }

  if (shouldReleaseAudio && !isAutomated && typeof sampler !== 'undefined') {
      const voice = activeVoices.find((activeVoice) => activeVoice.freq.toFixed(2) === freqStr);
      const isInfiniteHold = voice && voice.timedTrackerKey === undefined;

      if (sustainMode === 1 || (manualHoldFreqs[freqStr] && isInfiniteHold)) {
          sampler.triggerRelease(freq, Tone.now());
          activeVoices = activeVoices.filter((activeVoice) => activeVoice.freq.toFixed(2) !== freqStr);
          delete manualHoldFreqs[freqStr];
      }
  }
  
  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
  }
  
  if(!isAutomated && typeof endManualVisualNote === 'function') {
      endManualVisualNote(freqStr); 
  }
}

function releaseAllStuckNotes() {
    for (const [keyIdentifier, data] of Object.entries(activePhysicalKeys)) {
        if (typeof data === 'object') {
            releaseNote(data.freq, false, data.element);
        } else {
            releaseNote(data);
        }
    }
    activePhysicalKeys = {};
    for (const [id, data] of Object.entries(activeTouches)) {
        if (typeof data === 'object') {
            releaseNote(data.freq, false, data.element);
        } else {
            releaseNote(data);
        }
    }
    activeTouches = {};
    manualFreqRefCounts = {};
    manualHoldFreqs = {};
}

// --- GLOBAL MOUSE TRACKING ---
window.isMouseDown = false;
let previousSustainMode = 0;
let pointerLockEscapeGuardUntil = 0;
let wasPointerLocked = false;

function getPointerLockElement() {
    return document.pointerLockElement || document.mozPointerLockElement || null;
}

function lockPointer() {
    const target = document.body;
    if (!target) return;

    const requestPointerLock = target.requestPointerLock || target.mozRequestPointerLock;
    if (typeof requestPointerLock !== "function") {
        console.warn("Pointer Lock API not supported in this browser.");
        return;
    }

    if (typeof closeSettingsPanel === "function") {
        closeSettingsPanel();
    } else {
        const panel = document.getElementById("settings-panel");
        if (panel) panel.classList.remove("settings-visible");
    }

    requestPointerLock.call(target);
}

function updateLockUI() {
    const isLocked = getPointerLockElement() === document.body;

    if (!isLocked && sustainMode === 1) {
        sustainMode = 0;
        if (typeof updateUI === 'function') updateUI();
    }

    if (wasPointerLocked && !isLocked) {
        pointerLockEscapeGuardUntil = performance.now() + 250;
    }

    wasPointerLocked = isLocked;
}

document.addEventListener("pointerlockchange", updateLockUI, false);
document.addEventListener("mozpointerlockchange", updateLockUI, false);

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

function togglePlaybackPauseState() {
    if (isPlaying) {
        if (isPaused) resumePlayback();
        else pausePlayback();
    } else {
        startPlayback();
    }
}

function seekPlaybackBySeconds(secondsDelta) {
    if (!isPlaying || typeof seekToTime !== 'function' || !playbackTotalDuration) return;

    const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
    const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
    let targetSeconds = elapsed + secondsDelta;

    if (targetSeconds < 0) targetSeconds = 0;
    if (targetSeconds > playbackTotalDuration) targetSeconds = playbackTotalDuration;

    const targetPercent = (targetSeconds / playbackTotalDuration) * 100;
    seekToTime(targetPercent);
}

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        window.isMouseDown = true;
    } else if (e.button === 1) {
        e.preventDefault();
        togglePlaybackPauseState();
    } else if (e.button === 2) {
        previousSustainMode = sustainMode;
        sustainMode = 0;
        if (typeof updateUI === 'function') updateUI();
    }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        window.isMouseDown = false;
    } else if (e.button === 2) {
        sustainMode = previousSustainMode;
        if (typeof updateUI === 'function') updateUI();

        if (typeof clearTimedSustainTrackers === 'function') {
            clearTimedSustainTrackers();
        } else if (typeof sampler !== 'undefined') {
            sampler.releaseAll();
            activeVoices = [];
        }

        if (typeof sampler !== 'undefined') {
            Object.keys(manualHoldFreqs).forEach((freqStr) => {
                if ((manualFreqRefCounts[freqStr] || 0) > 0) return;
                releaseManualHoldFreq(freqStr);
            });
        }

        console.log("Right-click released: Audio sustains killed, visuals kept.");
    }
});

// --- GLOBAL MOUSE SCROLL TRACKING (SEEKING) ---
window.addEventListener('wheel', (e) => {
    if (!isPlaying) return;

    e.preventDefault();
    if (e.deltaY === 0) return;

    const seekAmount = 1;
    const direction = e.deltaY < 0 ? 1 : -1;
    seekPlaybackBySeconds(seekAmount * direction);
}, { passive: false });

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

function getTouchedKeyElement(touch) {
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    return target ? target.closest('.key, .p-key') : null;
}

function handleTouchStart(e) {
    e.preventDefault(); 
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const keyElement = getTouchedKeyElement(touch);

        if (keyElement) {
            const freq = parseFloat(keyElement.getAttribute('data-note'));
            const parent = keyElement.closest('.wicki-board');
            const side = (parent && parent.id === 'board-left') ? 'left' : 'right';
            activeTouches[touch.identifier] = { freq: freq, element: keyElement };
            pressNote(freq, false, side, keyElement);
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const keyElement = getTouchedKeyElement(touch);

        if (keyElement) {
            const newFreq = parseFloat(keyElement.getAttribute('data-note'));
            const oldData = activeTouches[touch.identifier];
            if (!oldData || keyElement !== oldData.element) {
                if (oldData) releaseNote(oldData.freq, false, oldData.element);
                const parent = keyElement.closest('.wicki-board');
                const side = (parent && parent.id === 'board-left') ? 'left' : 'right';
                activeTouches[touch.identifier] = { freq: newFreq, element: keyElement };
                pressNote(newFreq, false, side, keyElement);
            }
        } else {
            const oldData = activeTouches[touch.identifier];
            if (oldData) {
                releaseNote(oldData.freq, false, oldData.element);
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
        const data = activeTouches[touch.identifier];
        if (data) {
            releaseNote(data.freq, false, data.element);
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

function setDirectValue(type, value) {
    const val = parseFloat(value);
    if (Number.isNaN(val)) {
        updateUI();
        return;
    }

    switch (type) {
        case 'trans-unified': {
            releaseAllStuckNotes();
            const unifiedVal = Math.max(-50, Math.min(50, Math.round(val)));
            transposeLeft = unifiedVal;
            transposeRight = unifiedVal;
            renderBoard();
            break;
        }
        case 'trans-l':
            releaseAllStuckNotes();
            transposeLeft = Math.max(-50, Math.min(50, Math.round(val)));
            renderBoard();
            break;
        case 'trans-r':
            releaseAllStuckNotes();
            transposeRight = Math.max(-50, Math.min(50, Math.round(val)));
            renderBoard();
            break;
        case 'board-x':
            boardOffsetX = Math.round(val);
            applyZoom();
            if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
            break;
        case 'board-y':
            boardOffsetY = Math.round(val);
            applyZoom();
            if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
            break;
        case 'volume':
            globalVolume = Math.max(0, Math.min(1, val / 100));
            if (typeof Tone !== 'undefined' && Tone.Destination) {
                Tone.Destination.volume.value = Tone.gainToDb(globalVolume);
            }
            break;
        case 'reverb':
            globalReverb = Math.max(0, Math.min(1, val / 100));
            if (typeof reverb !== 'undefined') {
                reverb.wet.value = globalReverb;
            }
            break;
        case 'sustain':
            sustainMultiplier = Math.max(0.1, Math.min(5.0, val));
            break;
        case 'speed': {
            const newSpeed = Math.max(0.25, Math.min(3.0, val));
            if (typeof changePlaybackSpeed === 'function') {
                changePlaybackSpeed(newSpeed - playbackRate);
            }
            return;
        }
        case 'play-trans': {
            const newPTrans = Math.max(-50, Math.min(50, Math.round(val)));
            if (typeof changePlaybackTranspose === 'function') {
                changePlaybackTranspose(newPTrans - playbackTranspose);
            }
            return;
        }
        case 'fall': {
            const newFall = Math.max(0.5, Math.min(10.0, val));
            if (typeof changeFallDuration === 'function') {
                changeFallDuration(newFall - fallDuration);
            }
            return;
        }
        case 'manual-speed': {
            const newMSpeed = Math.max(10, Math.min(1000, val));
            if (typeof changeManualRiseSpeed === 'function') {
                changeManualRiseSpeed(newMSpeed - manualRiseSpeed);
            }
            return;
        }
        case 'strip-l':
            releaseAllStuckNotes();
            stripRangeLeft = Math.max(-50, Math.min(0, Math.round(val)));
            if (stripRangeLeft > stripRangeRight) stripRangeLeft = stripRangeRight;
            renderBoard();
            break;
        case 'strip-r':
            releaseAllStuckNotes();
            stripRangeRight = Math.max(0, Math.min(70, Math.round(val)));
            if (stripRangeLeft > stripRangeRight) stripRangeLeft = stripRangeRight;
            renderBoard();
            break;
        case 'strip-height':
            stripHeight = Math.max(0, Math.min(50, Math.round(val)));
            applyStripHeight();
            if (typeof resizeCanvas === 'function') resizeCanvas();
            if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
            break;
        case 'zoom':
            mobileZoom = Math.max(0.3, Math.min(1.5, val / 100));
            applyZoom();
            break;
        default:
            updateUI();
            return;
    }

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

function changeBoardOffset(axis, delta) {
    if (axis === 'x') {
        boardOffsetX += delta;
    } else if (axis === 'y') {
        boardOffsetY += delta;
    }

    applyZoom();

    if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();

    updateUI();
    saveSettings();
}

function applyZoom() {
    const boardWrapper = document.getElementById("board-wrapper");
    if (boardWrapper) {
        const scale = mobileZoom;
        boardWrapper.style.transform = `translate(calc(-50% + ${boardOffsetX}px), calc(-50% + ${boardOffsetY}px)) scale(${scale})`;
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
    
    if (stripHeight < 0) stripHeight = 0;
    if (stripHeight > 50) stripHeight = 50;
    
    applyStripHeight();
    
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
    
    updateUI();
    saveSettings();
}

// --- AUDIO CONTROLS ---

function changeVolume(delta) {
    globalVolume += delta;

    if (globalVolume < 0) globalVolume = 0;
    if (globalVolume > 1) globalVolume = 1;

    if (typeof Tone !== 'undefined' && Tone.Destination) {
        Tone.Destination.volume.value = Tone.gainToDb(globalVolume);
    }

    updateUI();
    saveSettings();
}

function changeReverb(delta) {
    globalReverb += delta;

    if (globalReverb < 0) globalReverb = 0;
    if (globalReverb > 1) globalReverb = 1;

    if (typeof reverb !== 'undefined') {
        reverb.wet.value = globalReverb;
    }

    updateUI();
    saveSettings();
}

function changeSustain(delta) {
    sustainMultiplier += delta;

    if (sustainMultiplier < 0.1) sustainMultiplier = 0.1;
    if (sustainMultiplier > 5.0) sustainMultiplier = 5.0;

    updateUI();
    saveSettings();
}

function toggleSustainMode() {
    releaseAllStuckNotes();
    sustainMode = (sustainMode === 0) ? 1 : 0;

    if (sustainMode === 1) {
        lockPointer();
    } else if (getPointerLockElement() && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock();
    }

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
    if (strip) strip.style.setProperty("height", `${stripHeight}dvh`, importantFlag);
    if (canvas) canvas.style.setProperty("height", `${canvasHeight}dvh`, importantFlag);
    if (progCont) progCont.style.setProperty("height", `${canvasHeight}dvh`, importantFlag);
    if (progBar) progBar.style.setProperty("width", `calc(${canvasHeight}dvh - 10px)`, importantFlag);
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

    // Move quick controls between the top bar and settings panel immediately
    if (typeof rearrangeUI === 'function') rearrangeUI();

    // Keep the mobile resize tracker in sync with manual layout changes
    if (typeof isMobileMode === 'function') {
        wasMobile = isMobileMode();
    }
    
    // Force a redraw of the keys and canvas
    if (typeof renderBoard === 'function') renderBoard();
    if (typeof resizeCanvas === 'function') resizeCanvas();
    if (typeof updateKeyCoordinates === 'function') updateKeyCoordinates();
    
    updateUI();
    saveSettings();
}

function toggleFKeys() {
  releaseAllStuckNotes(); 
  fKeyMode = (fKeyMode + 1) % F_KEY_LABELS.length;
  applyKeyMapMode();
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
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
    return;
  }

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

    const steps = transposeSequence.trim().split(/\s+/);
    
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

  // Escape: exit pointer lock first, otherwise panic timed sustain notes.
  if (e.code === "Escape") {
    e.preventDefault();

    if (
      getPointerLockElement() === document.body ||
      performance.now() < pointerLockEscapeGuardUntil
    ) {
      return;
    }

    if (sustainMode === 0) {
      if (typeof clearTimedSustainTrackers === "function") {
        clearTimedSustainTrackers();
      } else if (typeof sampler !== "undefined") {
        sampler.releaseAll();
        activeVoices = [];
      }

      if (typeof resetHighlights === "function") {
        resetHighlights();
      }

      console.log("Escape pressed: All timer-based sustains cleared.");
    }
    return;
  }

  // --- NUMPAD PLAYBACK CONTROLS ---
  if (fKeyMode !== 4) {
      // Numpad 5: Play / Pause
      if (e.code === "Numpad5") {
          e.preventDefault();
          togglePlaybackPauseState();
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
          seekPlaybackBySeconds(e.code === "Numpad8" ? 5 : -5);
          return;
      }

      // Numpad 6 (Faster) & Numpad 4 (Slower): Speed Control
      if (e.code === "Numpad6" || e.code === "Numpad4") {
          e.preventDefault();
          const delta = (e.code === "Numpad6") ? 0.1 : -0.1;
          changePlaybackSpeed(delta);
          return;
      }

      // Numpad 7 (Pitch Up) & Numpad 1 (Pitch Down): Song Transpose
      if (e.code === "Numpad7" || e.code === "Numpad1") {
          e.preventDefault();
          const delta = (e.code === "Numpad7") ? 1 : -1;

          if (typeof changePlaybackTranspose === 'function') {
              changePlaybackTranspose(delta);
          }
          return;
      }
  }

  if (e.repeat) return;

  const key = document.querySelector(`.key[data-key="${CSS.escape(e.code)}"]`);
  if (key) { 
    e.preventDefault();
    const freq = parseFloat(key.getAttribute("data-note"));
    const parentBoard = key.closest('.wicki-board');
    const side = (parentBoard && parentBoard.id === 'board-left') ? 'left' : 'right';
    activePhysicalKeys[e.code] = { freq: freq, element: key };
    pressNote(freq, false, side, key);
  }
});

window.addEventListener("keyup", (e) => {
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
    return;
  }

  if (activePhysicalKeys[e.code]) {
      const { freq, element } = activePhysicalKeys[e.code];
      releaseNote(freq, false, element);
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
document.getElementById('btn-reset-memory')?.addEventListener('click', openResetModal);
updateLockUI();

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
  const pedalLight = document.getElementById("pedal-light");
  if (pedalLight) {
      if (sustainMode === 0) {
          pedalLight.classList.add("active-light");
      } else {
          pedalLight.classList.remove("active-light");
      }
  }

  const transUnifiedContainer = document.getElementById("trans-unified");
  const transSplitContainer = document.getElementById("trans-split");
  const dispTransUnified = document.getElementById("disp-trans-unified");
  const dispTransL = document.getElementById("disp-trans-l");
  const dispTransR = document.getElementById("disp-trans-r");

  if (transposeLeft === transposeRight) {
      if (transUnifiedContainer) transUnifiedContainer.style.display = "flex";
      if (transSplitContainer) transSplitContainer.style.display = "none";
      if (dispTransUnified) dispTransUnified.value = transposeLeft;
  } else {
      if (transUnifiedContainer) transUnifiedContainer.style.display = "none";
      if (transSplitContainer) transSplitContainer.style.display = "flex";
      if (dispTransL) dispTransL.value = transposeLeft;
      if (dispTransR) dispTransR.value = transposeRight;
  }

  const dispTransLSet = document.getElementById("disp-trans-l-set");
  if (dispTransLSet) dispTransLSet.value = transposeLeft;

  const dispTransRSet = document.getElementById("disp-trans-r-set");
  if (dispTransRSet) dispTransRSet.value = transposeRight;

  document.getElementById("btn-labels").innerText = LABEL_MODES[labelMode];
  document.getElementById("btn-fkeys").innerText = F_KEY_LABELS[fKeyMode];

  const dispZoom = document.getElementById("disp-zoom");
  if (dispZoom) dispZoom.value = Math.round(mobileZoom * 100);

  const dispBoardX = document.getElementById("disp-board-x");
  if (dispBoardX) dispBoardX.value = boardOffsetX;

  const dispBoardY = document.getElementById("disp-board-y");
  if (dispBoardY) dispBoardY.value = boardOffsetY;

  const dispVol = document.getElementById("disp-volume");
  if (dispVol) dispVol.value = Math.round(globalVolume * 100);

  const dispRev = document.getElementById("disp-reverb");
  if (dispRev) dispRev.value = Math.round(globalReverb * 100);

  const dispSus = document.getElementById("disp-sustain");
  if (dispSus) dispSus.value = sustainMultiplier.toFixed(1);

  const dispSpeed = document.getElementById("disp-speed");
  if (dispSpeed) dispSpeed.value = playbackRate.toFixed(2);

  const dispPlayTrans = document.getElementById("disp-play-trans");
  if (dispPlayTrans) dispPlayTrans.value = playbackTranspose;

  const dispFall = document.getElementById("disp-fall");
  if (dispFall) dispFall.value = fallDuration.toFixed(1);

  const dispManual = document.getElementById("disp-manual-speed");
  if (dispManual) dispManual.value = manualRiseSpeed;

  const btnSusMode = document.getElementById("btn-sus-mode");
  if (btnSusMode) {
      btnSusMode.innerText = sustainMode === 1 ? "HOLD" : "TIMED";
  }
  
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
  if (dispStrip) dispStrip.value = stripHeight;

  const dispStripL = document.getElementById("disp-strip-l");
  if (dispStripL) dispStripL.value = stripRangeLeft;

  const dispStripR = document.getElementById("disp-strip-r");
  if (dispStripR) dispStripR.value = stripRangeRight;
}

// ==========================================
// BACKGROUND UPLOAD LOGIC
// ==========================================

function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      customBackground = canvas.toDataURL("image/jpeg", 0.8);
      applyBackground();
      saveSettings();

      event.target.value = "";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearBackground() {
  customBackground = null;
  applyBackground();
  saveSettings();

  const uploadInput = document.getElementById("bg-upload");
  if (uploadInput) uploadInput.value = "";
}

function applyBackground() {
  if (customBackground) {
    document.body.style.backgroundImage = "url('" + customBackground + "')";
  } else {
    document.body.style.backgroundImage = "none";
  }
}

// ==========================================
// WICKI KEY IMAGE UPLOAD LOGIC
// ==========================================

function handleKeyImageUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const MAX_SIZE = 150;
      let width = img.width;
      let height = img.height;

      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/png", 0.9);

      if (type === "idle") {
        customKeyIdle = compressed;
      } else if (type === "press") {
        customKeyPressed = compressed;
      }

      applyKeyImages();
      saveSettings();

      event.target.value = "";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearKeyImages() {
  customKeyIdle = null;
  customKeyPressed = null;
  applyKeyImages();
  saveSettings();

  const idleInput = document.getElementById("key-idle-upload");
  const pressInput = document.getElementById("key-press-upload");
  if (idleInput) idleInput.value = "";
  if (pressInput) pressInput.value = "";
}

function applyKeyImages() {
  let styleTag = document.getElementById("dynamic-key-styles");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "dynamic-key-styles";
    document.head.appendChild(styleTag);
  }

  if (!customKeyIdle && !customKeyPressed) {
    styleTag.innerHTML = "";
    return;
  }

  let css = `
    .wicki-board .key {
      background-size: contain !important;
      background-position: center !important;
      background-repeat: no-repeat !important;
    }
    .wicki-board .key.natural,
    .wicki-board .key.accidental {
      background-color: transparent !important;
    }
  `;

  if (customKeyIdle) {
    css += `
      .wicki-board .key {
        background-image: url('${customKeyIdle}') !important;
      }
    `;
  }

  if (customKeyPressed) {
    css += `
      .wicki-board .key:active,
      .wicki-board .key.active,
      .wicki-board .key.played-note.active {
        background-image: url('${customKeyPressed}') !important;
      }
    `;
  } else if (customKeyIdle) {
    css += `
      .wicki-board .key:active,
      .wicki-board .key.active,
      .wicki-board .key.played-note.active {
        filter: brightness(0.7);
      }
    `;
  }

  styleTag.innerHTML = css;
}

// ==========================================
// TRANSPOSE SEQUENCE LOGIC
// ==========================================

function updateSequence(val) {
    transposeSequence = val;
    sequenceIndex = 0; // Reset the spacebar progression back to the start
    saveSettings();
    console.log("New Transpose Sequence Saved:", transposeSequence);
}
