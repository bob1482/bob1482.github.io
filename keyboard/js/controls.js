// ==========================================
// PIANO INTERACTION: Events, Logic, Controls
// ==========================================

// --- NOTE LOGIC ---
let manualFreqRefCounts = {};
let manualHoldFreqs = {};
let activeMouseKeys = {};

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
        try { heldVoice.source.stop(); } catch (e) { }
        try { heldVoice.source.disconnect(); } catch (e) { }
    }
    activeVoices = activeVoices.filter((voice) => voice.freq.toFixed(2) !== freqStr);
    delete manualHoldFreqs[freqStr];
    return true;
}

async function pressNote(freq, isAutomated = false, sourceElement = null, velocity = null, channel = null, keyId = null) {
    if (audioCtx.state !== 'running') await audioCtx.resume();
    if (!isLoaded) return;

    const freqStr = freq.toFixed(2);

    if (!keyId) {
        if (sourceElement && sourceElement.getAttribute && sourceElement.getAttribute('data-key')) {
            keyId = 'dom_' + sourceElement.getAttribute('data-key');
        } else if (channel !== null && channel !== undefined) {
            const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
            keyId = `midi_${channel}_${midiNote}`;
        } else if (sourceElement) {
            const isRight = sourceElement.classList.contains('right-side');
            keyId = `dom_${isRight ? 'R' : 'L'}_${freqStr}`;
        } else {
            keyId = `key_${freqStr}`;
        }
    }

    if (!isAutomated && sourceElement) {
        activeMouseKeys[keyId] = { freq: freq, element: sourceElement, keyId: keyId };
    }

    // Determine color based on Wicki board side or MIDI channel (Channel 2 = Right Side, Channel 1 = Left Side)
    let isRightSide = false;
    if (sourceElement && sourceElement.classList.contains('right-side')) {
        isRightSide = true;
    } else if (channel === 2) {
        isRightSide = true;
    } else if (!sourceElement && (channel === null || channel === 1)) {
        const keys = typeof getCachedKeys === 'function' ? getCachedKeys(freqStr) : [];
        if (keys && keys.length === 1 && keys[0].classList.contains('right-side')) {
            isRightSide = true;
        }
    }

    const visualColor = isRightSide ? RIGHT_KEY_COLOR : KEY_COLOR;

    if (!isAutomated) {
        manualFreqRefCounts[freqStr] = (manualFreqRefCounts[freqStr] || 0) + 1;
        // Track held freqs in both modes so right-click can kill them
        manualHoldFreqs[freqStr] = true;
    }

    if (sourceElement) {
        sourceElement.classList.add("active");
        if (sourceElement.classList.contains("key") && typeof createRipple === 'function') {
            const keyIsRight = sourceElement.classList.contains('right-side');
            createRipple(sourceElement, keyIsRight ? RIGHT_KEY_COLOR : KEY_COLOR);
        }
    } else if (typeof getCachedKeys === 'function') {
        const keys = getCachedKeys(freqStr);
        for (let i = 0; i < keys.length; i++) {
            const keyEl = keys[i];
            const keyIsRight = keyEl.classList.contains('right-side');

            keyEl.classList.add("active");
            if (keyEl.classList.contains("key") && typeof createRipple === 'function') {
                const rippleColor = keyIsRight ? RIGHT_KEY_COLOR : KEY_COLOR;
                createRipple(keyEl, rippleColor);
            }
        }
    }

    if (!isAutomated && typeof startManualVisualNote === 'function') {
        startManualVisualNote(freqStr, visualColor, isRightSide, keyId);
    }

    if (!isAutomated) triggerSound(freq, 0, null, velocity);
}

function isNoteHeld(freqStr, isRightSide = null) {
    let sideMatchFound = false;

    function checkItem(item, itemIsRight) {
        if (!item || !item.freq) return false;
        if (item.freq.toFixed(2) !== freqStr) return false;
        if (isRightSide === null) return true;
        if (itemIsRight === isRightSide) {
            sideMatchFound = true;
            return true;
        }
        return false;
    }

    if (typeof activePhysicalKeys !== 'undefined') {
        for (const code in activePhysicalKeys) {
            const item = activePhysicalKeys[code];
            const itemIsRight = item && item.element ? item.element.classList.contains('right-side') : false;
            if (checkItem(item, itemIsRight)) return true;
        }
    }
    if (typeof activeTouches !== 'undefined') {
        for (const id in activeTouches) {
            const item = activeTouches[id];
            const itemIsRight = item && item.element ? item.element.classList.contains('right-side') : false;
            if (checkItem(item, itemIsRight)) return true;
        }
    }
    if (typeof activeMouseKeys !== 'undefined') {
        for (const fStr in activeMouseKeys) {
            const item = activeMouseKeys[fStr];
            const itemIsRight = item && item.element ? item.element.classList.contains('right-side') : false;
            if (checkItem(item, itemIsRight)) return true;
        }
    }
    if (typeof activeMidiNotes !== 'undefined') {
        for (const key in activeMidiNotes) {
            const f = activeMidiNotes[key];
            if (typeof f === 'number') {
                const parts = key.split('_');
                const channel = parseInt(parts[0], 10);
                const midiIsRight = (channel === 2);
                const item = { freq: f };
                if (checkItem(item, midiIsRight)) return true;
            }
        }
    }

    if (isRightSide !== null && !sideMatchFound) {
        return isNoteHeld(freqStr, null);
    }

    return false;
}

function releaseNote(freq, isAutomated = false, sourceElement = null, channel = null, keyId = null) {
    const freqStr = freq.toFixed(2);

    if (!keyId) {
        if (sourceElement && sourceElement.getAttribute && sourceElement.getAttribute('data-key')) {
            keyId = 'dom_' + sourceElement.getAttribute('data-key');
        } else if (channel !== null && channel !== undefined) {
            const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
            keyId = `midi_${channel}_${midiNote}`;
        } else if (sourceElement) {
            const isRight = sourceElement.classList.contains('right-side');
            keyId = `dom_${isRight ? 'R' : 'L'}_${freqStr}`;
        } else {
            keyId = `key_${freqStr}`;
        }
    }

    if (!isAutomated) {
        if (activeMouseKeys[keyId]) delete activeMouseKeys[keyId];
        if (activeMouseKeys[freqStr]) delete activeMouseKeys[freqStr];
    }

    let isRightSide = null;
    if (sourceElement && sourceElement.classList.contains('right-side')) {
        isRightSide = true;
    } else if (channel === 2) {
        isRightSide = true;
    } else if (channel === 1) {
        isRightSide = false;
    }

    if (!isAutomated) {
        manualFreqRefCounts[freqStr] = Math.max(0, (manualFreqRefCounts[freqStr] || 0) - 1);
        if (manualFreqRefCounts[freqStr] <= 0) {
            delete manualFreqRefCounts[freqStr];
        }
    }

    // Always release the visual note attached to this activating key
    if (!isAutomated && typeof endManualVisualNote === 'function') {
        endManualVisualNote(freqStr, isRightSide, keyId);
    }

    if (sourceElement) {
        sourceElement.classList.remove("active");
    }

    const stillHeld = !isAutomated && isNoteHeld(freqStr);

    if (!stillHeld && !isAutomated) {
        const voice = activeVoices.find((activeVoice) => activeVoice.freq.toFixed(2) === freqStr);

        if (sustainMode === 1) {
            // Hold mode: stop the note on key release with smooth release
            if (voice && voice.source) {
                if (typeof stopVoiceSmoothly === 'function') {
                    stopVoiceSmoothly(voice, 500);
                } else {
                    try { voice.source.stop(); } catch (e) { }
                    try { voice.source.disconnect(); } catch (e) { }
                }
            }
            activeVoices = activeVoices.filter((activeVoice) => activeVoice.freq.toFixed(2) !== freqStr);
            delete manualHoldFreqs[freqStr];
        }
        // Sustain mode (0): note continues playing after key release

        if (typeof getCachedKeys === 'function') {
            const keys = getCachedKeys(freqStr);
            for (let i = 0; i < keys.length; i++) keys[i].classList.remove("active");
        }
    }
}

function releaseAllStuckNotes() {
    for (const [keyIdentifier, data] of Object.entries(activePhysicalKeys)) {
        if (typeof data === 'object') {
            releaseNote(data.freq, false, data.element, null, data.keyId || ('kbd_' + keyIdentifier));
        } else {
            releaseNote(data);
        }
    }
    activePhysicalKeys = {};
    for (const [id, data] of Object.entries(activeTouches)) {
        if (typeof data === 'object') {
            releaseNote(data.freq, false, data.element, null, data.keyId || ('touch_' + id));
        } else {
            releaseNote(data);
        }
    }
    activeTouches = {};
    activeMouseKeys = {};
    if (typeof activeMidiNotes !== 'undefined') {
        for (const [key, entry] of Object.entries(activeMidiNotes)) {
            const freq = typeof entry === 'object' ? entry.freq : entry;
            const keyId = typeof entry === 'object' && entry.keyId ? entry.keyId : ('midi_' + key);
            releaseNote(freq, false, null, null, keyId);
        }
        activeMidiNotes = {};
    }
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
        for (const kId in activeMouseKeys) {
            const item = activeMouseKeys[kId];
            if (item && item.freq) {
                releaseNote(item.freq, false, item.element, null, item.keyId || kId);
            }
        }
        activeMouseKeys = {};
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

    if (typeof ensureVisualizerLoopRunning === 'function') {
        ensureVisualizerLoopRunning();
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
            const keyId = 'touch_' + touch.identifier;
            activeTouches[touch.identifier] = { freq: freq, element: keyElement, keyId: keyId };
            pressNote(freq, false, keyElement, null, null, keyId);
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
                if (oldData) {
                    delete activeTouches[touch.identifier];
                    releaseNote(oldData.freq, false, oldData.element, null, oldData.keyId);
                }
                const keyId = 'touch_' + touch.identifier;
                activeTouches[touch.identifier] = { freq: newFreq, element: keyElement, keyId: keyId };
                pressNote(newFreq, false, keyElement, null, null, keyId);
            }
        } else {
            const oldData = activeTouches[touch.identifier];
            if (oldData) {
                delete activeTouches[touch.identifier];
                releaseNote(oldData.freq, false, oldData.element, null, oldData.keyId);
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
            delete activeTouches[touch.identifier];
            releaseNote(data.freq, false, data.element, null, data.keyId);
        }
    }
}

const boardContainer = document.getElementById('board-wrapper');
const stripContainer = document.getElementById('piano-strip');

function bindTouchEvents(element) {
    if (element) {
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
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

window.isScrubbingProgressBar = false;

function updateProgressBarUI(pct) {
    const bar = document.getElementById('progress-bar');
    if (bar) {
        bar.value = pct;
        bar.style.setProperty('--progress-pct', `${pct}%`);
    }
}

function scrubProgress(val) {
    if (currentPlaybackEvents.length === 0) return;

    const numVal = parseFloat(val);
    updateProgressBarUI(numVal);

    if (!isPlaying) {
        startPlayback();
        if (typeof seekToTime === 'function') seekToTime(numVal);
        pausePlayback();
    } else {
        if (typeof seekToTime === 'function') seekToTime(numVal);
    }
}

const progressBarEl = document.getElementById('progress-bar');
if (progressBarEl) {
    progressBarEl.addEventListener('mousedown', () => { window.isScrubbingProgressBar = true; });
    progressBarEl.addEventListener('touchstart', () => { window.isScrubbingProgressBar = true; }, { passive: true });
    window.addEventListener('mouseup', () => { window.isScrubbingProgressBar = false; });
    window.addEventListener('touchend', () => { window.isScrubbingProgressBar = false; });
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
        if (progCont) progCont.style.removeProperty("bottom");
        if (progBar) progBar.style.removeProperty("width");
        const btnPedal = document.getElementById("btn-pedal");
        if (btnPedal) btnPedal.style.removeProperty("bottom");
        return;
    }

    if (strip) strip.style.setProperty("height", `${stripHeight}dvh`);
    if (canvas) canvas.style.setProperty("height", `${canvasHeight}dvh`);
    if (progCont) progCont.style.setProperty("bottom", `calc(${stripHeight}dvh + 6px)`);
    if (progBar) progBar.style.removeProperty("width");

    const btnPedal = document.getElementById("btn-pedal");
    if (btnPedal) {
        btnPedal.style.setProperty("bottom", `calc(${stripHeight}dvh + 16px)`);
    }
}

function cycleLabels() {
    labelMode = (labelMode + 1) % 4;
    updateUI();
    renderBoard();
    saveSettings();
}

function toggleBoard() {
    if (isBoardHidden || (typeof boardWrapper !== 'undefined' && boardWrapper && boardWrapper.style.display === "none")) {
        showBoard();
    } else {
        hideBoard();
    }
}

function toggleQuickSettings() {
    isQuickSettingsHidden = !isQuickSettingsHidden;
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

    if (typeof ensureVisualizerLoopRunning === 'function') {
        ensureVisualizerLoopRunning();
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
        const keyId = 'kbd_' + e.code;
        activePhysicalKeys[e.code] = { freq: freq, element: key, keyId: keyId };
        pressNote(freq, false, key, null, null, keyId);
    }
});

window.addEventListener("keyup", (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        return;
    }

    if (activePhysicalKeys[e.code]) {
        const data = activePhysicalKeys[e.code];
        delete activePhysicalKeys[e.code];
        releaseNote(data.freq, false, data.element, null, data.keyId || ('kbd_' + e.code));
        return;
    }
});

window.addEventListener('click', async () => {
    if (audioCtx.state !== 'running') await audioCtx.resume();
}, { once: true });
window.addEventListener('touchstart', async () => {
    if (audioCtx.state !== 'running') await audioCtx.resume();
}, { once: true });



if (typeof loadSettings === 'function') {
    loadSettings();
}

updateLockUI();

renderBoard();
updateUI();

function updateUI() {
    // Toggle quick controls and settings button visibility based on pointer lock state (mouse disabled)
    const isPointerLocked = getPointerLockElement() === document.body;
    const quickControls = document.getElementById("quick-controls");
    if (quickControls) {
        quickControls.classList.toggle("sustain-active", isPointerLocked);
        quickControls.style.display = isQuickSettingsHidden ? "none" : "flex";
    }

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.classList.toggle("sustain-active", isPointerLocked);
    }

    const btnQuickSettings = document.getElementById("btn-quick-settings");
    if (btnQuickSettings) btnQuickSettings.innerText = isQuickSettingsHidden ? "SHOW" : "HIDE";

    const pedalLight = document.getElementById("pedal-light");
    if (pedalLight) {
        if (sustainMode === 0) {
            pedalLight.classList.add("active-light");
        } else {
            pedalLight.classList.remove("active-light");
        }
    }

    const btnPedal = document.getElementById("btn-pedal");
    if (btnPedal) {
        btnPedal.setAttribute("data-tooltip", sustainMode === 0 ? "Sustain: ON" : "Sustain: OFF");
    }

    const dispTrans = document.getElementById("disp-trans");
    if (dispTrans) dispTrans.value = transpose;

    const dispTransBox = document.getElementById("disp-trans-box");
    if (dispTransBox) {
        dispTransBox.setAttribute("data-tooltip", `Transpose: ${transpose > 0 ? '+' + transpose : transpose}`);
    }

    const dispTransSet = document.getElementById("disp-trans-set");
    if (dispTransSet) dispTransSet.value = transpose;

    const btnLabels = document.getElementById("btn-labels");
    if (btnLabels) {
        btnLabels.setAttribute("data-tooltip", `Labels: ${LABEL_MODES[labelMode]}`);
    }

    const btnFKeys = document.getElementById("btn-fkeys");
    if (btnFKeys) btnFKeys.innerText = F_KEY_LABELS[fKeyMode];

    const btnBoard = document.getElementById("btn-board");
    if (btnBoard) btnBoard.innerText = isBoardHidden ? "SHOW" : "HIDE";
    const boardWrp = document.getElementById("board-wrapper");
    if (boardWrp) boardWrp.style.display = isBoardHidden ? "none" : "flex";

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
        if (btnPlay) {
            btnPlay.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
            btnPlay.setAttribute("data-tooltip", "Stop");
            btnPlay.classList.add("playing");
        }
        if (btnPause) {
            btnPause.disabled = false;
            btnPause.classList.remove("disabled");
            if (isPaused) {
                btnPause.innerHTML = `<img src="icon/play.png" class="btn-icon" alt="Resume">`;
                btnPause.setAttribute("data-tooltip", "Resume");
                btnPause.classList.add("paused");
            } else {
                btnPause.innerHTML = `<img src="icon/pause.png" class="btn-icon" alt="Pause">`;
                btnPause.setAttribute("data-tooltip", "Pause");
                btnPause.classList.remove("paused");
            }
        }

        // Show the progress bar when playing
        if (progressContainer) progressContainer.style.display = "block";
    } else {
        if (btnPlay) {
            btnPlay.innerHTML = `<img src="icon/play.png" class="btn-icon" alt="Play">`;
            btnPlay.setAttribute("data-tooltip", "Play");
            btnPlay.classList.remove("playing");
        }
        if (btnPause) {
            btnPause.innerHTML = `<img src="icon/pause.png" class="btn-icon" alt="Pause">`;
            btnPause.setAttribute("data-tooltip", "Pause");
            btnPause.disabled = true;
            btnPause.classList.add("disabled");
            btnPause.classList.remove("paused");
        }

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

    // MIDI UI
    const dispMidiStatus = document.getElementById("disp-midi-status");
    if (dispMidiStatus && typeof midiStatusMessage !== 'undefined') {
        dispMidiStatus.innerText = midiStatusMessage;
        if (midiStatusMessage === "Connected") {
            dispMidiStatus.style.color = "#00d2ff";
        } else if (midiStatusMessage === "Access Denied" || midiStatusMessage === "Not Supported") {
            dispMidiStatus.style.color = "#d9534f";
        } else {
            dispMidiStatus.style.color = "#888";
        }
    }

    const selectDevice = document.getElementById("midi-device-select");
    if (selectDevice) {
        updateMidiDeviceDropdown();
        if (typeof selectedMidiDevice !== 'undefined') selectDevice.value = selectedMidiDevice;
    }

    const selectChannel = document.getElementById("midi-channel-select");
    if (selectChannel && typeof selectedMidiChannel !== 'undefined') {
        selectChannel.value = selectedMidiChannel;
    }
}

// --- MIDI CONTROLS ---

function connectMidiDevices() {
    if (typeof initMidiAccess === 'function') {
        initMidiAccess();
    }
}

function setMidiDevice(val) {
    selectedMidiDevice = val;
    if (typeof saveSettings === 'function') saveSettings();
}

function setMidiChannel(val) {
    selectedMidiChannel = val;
    if (typeof saveSettings === 'function') saveSettings();
}

function updateMidiDeviceDropdown() {
    const select = document.getElementById('midi-device-select');
    if (!select) return;

    const devices = (typeof getMidiInputDevices === 'function') ? getMidiInputDevices() : [];
    const currValue = (typeof selectedMidiDevice !== 'undefined') ? selectedMidiDevice : 'all';

    select.innerHTML = '<option value="all">All Devices</option>';

    devices.forEach(dev => {
        const option = document.createElement('option');
        option.value = dev.id;
        option.textContent = dev.name;
        select.appendChild(option);
    });

    select.value = currValue;
}

window.addEventListener('midiDevicesChanged', () => {
    updateMidiDeviceDropdown();
    if (typeof updateUI === 'function') updateUI();
});


