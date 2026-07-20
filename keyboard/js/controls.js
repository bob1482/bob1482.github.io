// ==========================================
// PIANO INTERACTION: Events, Logic, Controls
// ==========================================

// --- NOTE LOGIC ---
let manualFreqRefCounts = {};
let manualHoldFreqs = {};

function releaseManualHoldFreq(freqStr) {
  if (typeof audioCtx === 'undefined') return false;

  const heldVoice = activeVoices.find((voice) => {
      return voice.freq.toFixed(2) === freqStr && voice.timedTrackerKey === undefined;
  });

  if (!heldVoice) {
      delete manualHoldFreqs[freqStr];
      return false;
  }

  // Stop the source with smooth release
  if (heldVoice.source && typeof stopVoiceSmoothly === 'function') {
    stopVoiceSmoothly(heldVoice, 500);
  } else if (heldVoice.source) {
    try { heldVoice.source.stop(); } catch(e) {}
    try { heldVoice.source.disconnect(); } catch(e) {}
  }
  activeVoices = activeVoices.filter((voice) => voice.freq.toFixed(2) !== freqStr);
  delete manualHoldFreqs[freqStr];
  return true;
}

async function pressNote(freq, isAutomated = false, sourceElement = null) {
  if (audioCtx.state !== 'running') await audioCtx.resume();
  if (!isLoaded) return; 

  const freqStr = freq.toFixed(2);

  // Determine color based on Wicki board side
  const isRightSide = sourceElement && sourceElement.classList.contains('right-side');
  const visualColor = isRightSide ? RIGHT_KEY_COLOR : KEY_COLOR;
  const rippleColor = isRightSide ? RIGHT_KEY_COLOR : KEY_COLOR;

  if (!isAutomated) {
      manualFreqRefCounts[freqStr] = (manualFreqRefCounts[freqStr] || 0) + 1;
      // Track held freqs in both modes so right-click can kill them
      manualHoldFreqs[freqStr] = true;
  }

  if (typeof getCachedKeys === 'function') {
      const keys = getCachedKeys(freqStr);
      for (let i = 0; i < keys.length; i++) {
          keys[i].classList.add("active");
          if (keys[i].classList.contains("key") && typeof createRipple === 'function') {
              // Wicki board keys get ripples with appropriate color
              createRipple(keys[i], rippleColor);
          }
      }
  }
  
  if(!isAutomated && typeof startManualVisualNote === 'function') {
      startManualVisualNote(freqStr, visualColor); 
  }

  if(!isAutomated) triggerSound(freq, 0);
}

function releaseNote(freq, isAutomated = false, sourceElement = null) {
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

  if (shouldReleaseAudio && !isAutomated) {
      const voice = activeVoices.find((activeVoice) => activeVoice.freq.toFixed(2) === freqStr);

      if (sustainMode === 1) {
          // Hold mode: stop the note on key release with smooth release
          if (voice && voice.source) {
            if (typeof stopVoiceSmoothly === 'function') {
                stopVoiceSmoothly(voice, 500);
            } else {
                try { voice.source.stop(); } catch(e) {}
                try { voice.source.disconnect(); } catch(e) {}
            }
          }
          activeVoices = activeVoices.filter((activeVoice) => activeVoice.freq.toFixed(2) !== freqStr);
          delete manualHoldFreqs[freqStr];
      }
      // Sustain mode (0): note continues playing after key release
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

    const currentAudioTime = isPaused ? pauseStartTimestamp : (typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0);
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
        } else if (typeof stopAllAudio === 'function') {
            stopAllAudio();
        }

        if (typeof audioCtx !== 'undefined') {
            Object.keys(manualHoldFreqs).forEach((freqStr) => {
                if ((manualFreqRefCounts[freqStr] || 0) > 0) return;
                releaseManualHoldFreq(freqStr);
            });
        }

        console.log("Right-click released: Audio sustains killed, visuals kept.");
    }
});

// --- HIGHLIGHT RESET ---

function resetHighlights() {
    // 1. Release any physically stuck notes (stops audio and removes the base 'active' class)
    releaseAllStuckNotes();
    
    // 2. Stop all remaining audio (sustained notes that don't belong to active keys)
    if (typeof stopAllAudio === 'function') stopAllAudio();
    
    // 3. Clear all persistent scale markers (the blue/pink borders)
    if (typeof clearAllHighlights === 'function') {
        clearAllHighlights();
    }
    
    // 4. Clear manual visual notes rising on the canvas
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
            activeTouches[touch.identifier] = { freq: freq, element: keyElement };
            pressNote(freq, false, keyElement);
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
                activeTouches[touch.identifier] = { freq: newFreq, element: keyElement };
                pressNote(newFreq, false, keyElement);
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

// --- PLAYBACK BUTTONS ---

function togglePlayback() {
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
    if (currentPlaybackEvents.length === 0) return;

    if (!isPlaying) {
        startPlayback();
        if (typeof seekToTime === 'function') seekToTime(val);
        pausePlayback();
    } else {
        if (typeof seekToTime === 'function') seekToTime(val);
    }
}

function changeTranspose(delta) {
  releaseAllStuckNotes(); 
  transpose += delta;
  if (transpose < -50) transpose = -50;
  if (transpose > 50) transpose = 50;
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
        case 'trans':
            releaseAllStuckNotes();
            transpose = Math.max(-50, Math.min(50, Math.round(val)));
            renderBoard();
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
        case 'reverb': {
            const newReverb = Math.max(0, Math.min(100, parseFloat(value) || 0));
            reverbWet = newReverb / 100;
            reverbGain.gain.value = reverbEnabled ? reverbWet : 0;
            updateUI();
            saveSettings();
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
        default:
            updateUI();
            return;
    }

    updateUI();
    saveSettings();
}

function applyZoom() {
    const boardWrapper = document.getElementById("board-wrapper");
    if (boardWrapper) {
        const scale = mobileZoom;
        boardWrapper.style.transform = `translate(calc(-50% + 30px), -50%) scale(${scale})`;
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

function toggleReverb() {
    reverbEnabled = !reverbEnabled;
    reverbGain.gain.value = reverbEnabled ? reverbWet : 0;
    updateUI();
    saveSettings();
}

function changeReverb(delta) {
    reverbWet = Math.max(0, Math.min(1, reverbWet + delta));
    reverbGain.gain.value = reverbEnabled ? reverbWet : 0;
    updateUI();
    saveSettings();
}

function toggleSustainMode() {
    releaseAllStuckNotes();
    // Stop all audio since releaseNote won't stop notes in sustain mode
    if (typeof stopAllAudio === 'function') stopAllAudio();
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
    
    if (strip) strip.style.setProperty("height", `${stripHeight}dvh`);
    if (canvas) canvas.style.setProperty("height", `${canvasHeight}dvh`);
    if (progCont) progCont.style.setProperty("height", `${canvasHeight}dvh`);
    if (progBar) progBar.style.setProperty("width", `calc(${canvasHeight}dvh - 10px)`);
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

function toggleFKeys() {
  releaseAllStuckNotes(); 
  fKeyMode = (fKeyMode + 1) % F_KEY_LABELS.length;
  applyKeyMapMode();
  renderBoard();
  updateUI();
  saveSettings();
}

// --- SETTINGS PANEL TOGGLE ---

function switchSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    // Update tab content
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === 'tab-' + tabName);
    });
}

function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
        panel.classList.toggle('settings-visible');
        if (!panel.classList.contains('settings-visible')) {
            panel.style.transition = '';
            panel.style.boxShadow = '';
            panel.style.transform = '';
        } else {
            // Reset to first tab when opening
            switchSettingsTab('keyboard');
        }
    }
}

function closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel || !panel.classList.contains('settings-visible')) return;

    panel.classList.remove('settings-visible');
    panel.style.transition = '';
    panel.style.boxShadow = '';
    panel.style.transform = '';
}

// Automatically close the settings if the user clicks/taps outside of it.
window.addEventListener('pointerdown', (e) => {
    const panel = document.getElementById('settings-panel');
    const settingsBtn = document.getElementById('btn-settings');
    
    if (panel && panel.classList.contains('settings-visible')) {
        if (!panel.contains(e.target) && settingsBtn && !settingsBtn.contains(e.target)) {
            closeSettingsPanel();
        }
    }
});

// --- FULLSCREEN TOGGLE ---

function toggleFullScreen() {
    const docEl = document.documentElement;

    if (!document.fullscreenElement) {
        docEl.requestFullscreen({ navigationUI: "hide" }).then(() => {
            console.log("Entered immersive fullscreen mode.");
        }).catch(err => {
            console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen().catch(err => {
            console.warn(`Error attempting to exit fullscreen: ${err.message}`);
        });
    }
}

// Listen for fullscreen changes to update the button text automatically
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('btn-fullscreen');
    if (!btn) return;
    btn.innerText = !!document.fullscreenElement ? "EXIT" : "FULL";
});

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
    
    if (e.code === "ArrowRight") { changeTranspose(smallStep); }
    else if (e.code === "ArrowLeft") { changeTranspose(-smallStep); }
    else if (e.code === "ArrowUp") { changeTranspose(largeStep); }
    else if (e.code === "ArrowDown") { changeTranspose(-largeStep); }
    return;
  }

  if (e.code === "AltLeft") {
    e.preventDefault();
    if (e.repeat) return;
    seekPlaybackBySeconds(-1);
    return;
  }

  if (e.code === "AltRight") {
    e.preventDefault();
    if (e.repeat) return;
    seekPlaybackBySeconds(1);
    return;
  }
  
  if (e.code === "Space") {
    e.preventDefault();
    if (e.repeat) return;
    togglePlaybackPauseState();
    return;
  }

  if (e.repeat) return;

  const key = document.querySelector(`.key[data-key="${CSS.escape(e.code)}"]`);
  if (key) { 
    e.preventDefault();
    const freq = parseFloat(key.getAttribute("data-note"));
    activePhysicalKeys[e.code] = { freq: freq, element: key };
    pressNote(freq, false, key);
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
  if (audioCtx.state !== 'running') await audioCtx.resume();
}, { once: true });
window.addEventListener('touchstart', async () => {
  if (audioCtx.state !== 'running') await audioCtx.resume();
}, { once: true });

window.addEventListener('samplesLoaded', () => {
    updateUI();
    if (typeof initVisualizer === 'function') initVisualizer();
});

updateLockUI();

renderBoard();
updateUI();

function updateUI() {
  // Toggle quick controls visibility based on pointer lock state (mouse disabled)
  const quickControls = document.getElementById("quick-controls");
  if (quickControls) {
    const isPointerLocked = getPointerLockElement() === document.body;
    quickControls.classList.toggle("sustain-active", isPointerLocked);
  }

  const pedalLight = document.getElementById("pedal-light");
  if (pedalLight) {
      if (sustainMode === 0) {
          pedalLight.classList.add("active-light");
      } else {
          pedalLight.classList.remove("active-light");
      }
  }

  const dispTrans = document.getElementById("disp-trans");
  if (dispTrans) dispTrans.value = transpose;

  const dispTransSet = document.getElementById("disp-trans-set");
  if (dispTransSet) dispTransSet.value = transpose;

  document.getElementById("btn-labels").innerText = LABEL_MODES[labelMode];
  document.getElementById("btn-fkeys").innerText = F_KEY_LABELS[fKeyMode];

  const dispSpeed = document.getElementById("disp-speed");
  if (dispSpeed) dispSpeed.value = playbackRate.toFixed(2);

  const dispPlayTrans = document.getElementById("disp-play-trans");
  if (dispPlayTrans) dispPlayTrans.value = playbackTranspose;

  const dispFall = document.getElementById("disp-fall");
  if (dispFall) dispFall.value = fallDuration.toFixed(1);

  const dispManual = document.getElementById("disp-manual-speed");
  if (dispManual) dispManual.value = manualRiseSpeed;

  // Reverb UI
  const btnReverb = document.getElementById("btn-reverb");
  if (btnReverb) {
    btnReverb.innerText = reverbEnabled ? "ON" : "OFF";
    btnReverb.style.color = reverbEnabled ? "white" : "#888";
  }
  const dispReverb = document.getElementById("disp-reverb");
  if (dispReverb) dispReverb.value = (reverbWet * 100).toFixed(0);

  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  
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

  if (typeof applyStripHeight === 'function') applyStripHeight();
  
  const dispStrip = document.getElementById("disp-strip-height");
  if (dispStrip) dispStrip.value = stripHeight;

  const dispStripL = document.getElementById("disp-strip-l");
  if (dispStripL) dispStripL.value = stripRangeLeft;

  const dispStripR = document.getElementById("disp-strip-r");
  if (dispStripR) dispStripR.value = stripRangeRight;
}

// ==========================================
// LOADOUT CONTROLS
// ==========================================

function refreshLoadoutDropdown() {
    const select = document.getElementById('loadout-select');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Loadout --</option>';
    
    const names = typeof getLoadoutNames === 'function' ? getLoadoutNames() : [];
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    
    // Restore selection if it still exists
    if (currentValue && names.includes(currentValue)) {
        select.value = currentValue;
    }
}

function saveCurrentLoadout() {
    const input = document.getElementById('loadout-name-input');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
        console.warn("Please enter a loadout name.");
        return;
    }
    
    if (typeof saveLoadout === 'function') {
        const success = saveLoadout(name);
        if (success) {
            input.value = '';
            refreshLoadoutDropdown();
            // Select the newly saved loadout
            const select = document.getElementById('loadout-select');
            if (select) select.value = name;
        }
    }
}

function applySelectedLoadout() {
    const select = document.getElementById('loadout-select');
    if (!select || !select.value) {
        console.warn("Please select a loadout to apply.");
        return;
    }
    
    if (typeof loadLoadout === 'function') {
        loadLoadout(select.value);
        refreshLoadoutDropdown();
    }
}

function deleteSelectedLoadout() {
    const select = document.getElementById('loadout-select');
    if (!select || !select.value) {
        console.warn("Please select a loadout to delete.");
        return;
    }
    
    if (typeof deleteLoadout === 'function') {
        deleteLoadout(select.value);
        select.value = '';
        refreshLoadoutDropdown();
    }
}

// Populate loadout dropdown on page load
refreshLoadoutDropdown();
