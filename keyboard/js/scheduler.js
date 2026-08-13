// ==========================================
// PLAYBACK ENGINE: Visuals, Scheduler & Time
// ==========================================

// --- VISUALIZER STATE CONTAINERS ---
let keyCoordinates = {};
let notePool = [];
var visualNotes = [];
var fallingNotes = [];
var fallingHeadIndex = 0;

// --- VISUALIZER STATE ---
let isVisualizerOn = true;

// --- VISUALIZER CANVAS ---
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

let resizeTimeout;

// --- VISUALIZER OBJECT POOLING ---
function getNoteFromPool() {
    if (notePool.length > 0) return notePool.pop();
    return { freq: 0, x: 0, width: 0, height: 0, y: 0, color: '', targetTime: 0, duration: 0, active: false };
}

function recycleNote(note) {
    note.active = false;
    note.drawY = undefined;
    note.keyId = undefined;
    notePool.push(note);
}

function recycleAllNotes() {
    while (fallingHeadIndex < fallingNotes.length) recycleNote(fallingNotes[fallingHeadIndex++]);
    fallingNotes.length = 0;
    fallingHeadIndex = 0;
    while (visualNotes.length > 0) recycleNote(visualNotes.pop());
}

// --- VISUALIZER INITIALIZATION ---
let isVisualizerInitialized = false;

function initVisualizer() {
    if (isVisualizerInitialized) return;
    isVisualizerInitialized = true;
    resizeCanvas();
    ensureVisualizerLoopRunning();
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeCanvas();
        ensureVisualizerLoopRunning();
    }, 150);
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    const strip = document.getElementById("piano-strip");
    const stripDisplay = strip ? window.getComputedStyle(strip).display : "";
    const isMobile = stripDisplay === "none";

    const currentStripHeight = typeof stripHeight !== 'undefined' ? stripHeight : 17;
    const canvasViewportRatio = (100 - currentStripHeight) / 100;

    canvas.height = isMobile ? window.innerHeight : window.innerHeight * canvasViewportRatio;
    updateKeyCoordinates();
}

function updateKeyCoordinates() {
    keyCoordinates = {};
    
    // 1. Collect Wicki Board key coordinates (prefer visible keys with width > 0)
    const wickiKeys = document.querySelectorAll('.wicki-board .key');
    wickiKeys.forEach(key => {
        const freq = key.getAttribute('data-note');
        if (!freq) return;
        const rect = key.getBoundingClientRect();
        if (rect.width === 0) return; // Skip hidden elements
        
        const isRight = key.classList.contains('right-side');
        const sideKey = freq + (isRight ? '_right' : '_left');
        const coordObj = { x: rect.left | 0, width: rect.width | 0 };
        
        keyCoordinates[sideKey] = coordObj;
        if (!keyCoordinates[freq] || keyCoordinates[freq].width === 0) {
            keyCoordinates[freq] = coordObj;
        }
    });

    // 2. Collect Piano Strip key coordinates
    const stripKeys = document.querySelectorAll('.p-key');
    stripKeys.forEach(key => {
        const freq = key.getAttribute('data-note');
        if (!freq) return;
        const rect = key.getBoundingClientRect();
        if (rect.width === 0) return; // Skip hidden elements
        
        const coordObj = { x: rect.left | 0, width: rect.width | 0 };
        keyCoordinates[freq + '_strip'] = coordObj;
        keyCoordinates[freq] = coordObj;
        const noteName = key.getAttribute('data-key');
        if (noteName) keyCoordinates[noteName] = coordObj;
    });
}

function getValidCoords(freqStr, isRightSide = null) {
    if (Object.keys(keyCoordinates).length === 0 && typeof updateKeyCoordinates === 'function') {
        updateKeyCoordinates();
    }
    
    const sideKey = isRightSide === true ? (freqStr + '_right') : (isRightSide === false ? (freqStr + '_left') : null);
    
    // 1. Check side-specific key
    if (sideKey && keyCoordinates[sideKey] && keyCoordinates[sideKey].width > 0) {
        return keyCoordinates[sideKey];
    }
    
    // 2. Check generic frequency key
    if (keyCoordinates[freqStr] && keyCoordinates[freqStr].width > 0) {
        return keyCoordinates[freqStr];
    }

    // 3. Check strip key
    if (keyCoordinates[freqStr + '_strip'] && keyCoordinates[freqStr + '_strip'].width > 0) {
        return keyCoordinates[freqStr + '_strip'];
    }

    // 4. Check alternate side key
    const altSideKey = isRightSide === true ? (freqStr + '_left') : (freqStr + '_right');
    if (altSideKey && keyCoordinates[altSideKey] && keyCoordinates[altSideKey].width > 0) {
        return keyCoordinates[altSideKey];
    }

    // 5. Dynamic fallback if cached while elements were hidden or detached
    let el = null;
    if (isRightSide === true) {
        el = document.querySelector(`.wicki-board .key.right-side[data-note="${freqStr}"]`);
    } else if (isRightSide === false) {
        el = document.querySelector(`.wicki-board .key:not(.right-side)[data-note="${freqStr}"]`);
    }
    if (!el) el = document.querySelector(`.p-key[data-note="${freqStr}"]`);
    if (!el) el = document.querySelector(`[data-note="${freqStr}"]`);
    
    if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) {
            const coordObj = { x: rect.left | 0, width: rect.width | 0 };
            if (sideKey) keyCoordinates[sideKey] = coordObj;
            keyCoordinates[freqStr] = coordObj;
            return coordObj;
        }
    }

    return null;
}

// --- VISUALIZER STATE HELPERS ---
function spawnFallingNote(freqStr, duration, targetTime, trackIndex = 0) {
    if (!canvas) return;

    const freqFixed = (typeof freqStr === 'number') ? freqStr.toFixed(2) : freqStr;
    const coords = getValidCoords(freqFixed, null);
    if (!coords) return;

    const pixelsPerSecond = canvas.height / fallDuration;
    let noteColor = 'rgb(93, 0, 150)';

    if (trackIndex === 0) {
        noteColor = '#c87ad1';
    } else if (trackIndex === 1) {
        noteColor = '#00d2ff';
    } else if (trackIndex > 1) {
        const extraColors = ['#5cb85c', '#f0ad4e', '#d9534f'];
        noteColor = extraColors[(trackIndex - 2) % extraColors.length];
    }

    const safeDuration = (typeof duration === 'number' && duration > 0) ? duration : 0.5;
    const note = getNoteFromPool();
    note.freq = freqFixed;
    note.x = coords.x;
    note.width = coords.width;
    note.duration = safeDuration;
    note.height = safeDuration * pixelsPerSecond;
    note.color = noteColor;
    note.targetTime = targetTime;
    note.active = true;

    fallingNotes.push(note);
    ensureVisualizerLoopRunning();
}

function startManualVisualNote(freqStr, color = 'rgb(61, 182, 67)', isRightSide = false, keyId = null) {
    if (!canvas) return;

    const coords = getValidCoords(freqStr, isRightSide);
    if (!coords) return;

    if (keyId) {
        for (let i = 0; i < visualNotes.length; i++) {
            if (visualNotes[i].keyId === keyId && visualNotes[i].active) {
                return;
            }
        }
    }

    const note = getNoteFromPool();
    note.freq = freqStr;
    note.keyId = keyId;
    note.isRightSide = isRightSide;
    note.x = coords.x;
    note.width = coords.width;
    note.y = canvas.height;
    note.height = 0;
    note.color = color;
    note.active = true;

    visualNotes.push(note);
    ensureVisualizerLoopRunning();
}

function endManualVisualNote(freqStr, isRightSide = null, keyId = null) {
    let matched = false;
    if (keyId) {
        for (let i = 0; i < visualNotes.length; i++) {
            const vn = visualNotes[i];
            if (vn.active && vn.keyId === keyId) {
                vn.active = false;
                matched = true;
            }
        }
    }
    if (!matched && freqStr) {
        for (let i = 0; i < visualNotes.length; i++) {
            const vn = visualNotes[i];
            if (vn.active && vn.freq === freqStr) {
                if (isRightSide === null || vn.isRightSide === isRightSide) {
                    vn.active = false;
                }
            }
        }
    }
}

let lastAudioCtxTime = 0;
let lastAudioPerfTime = performance.now();

function getSmoothAudioTime() {
    if (isPaused) return pauseStartTimestamp;
    if (typeof audioCtx === 'undefined') return 0;

    const rawAudioTime = audioCtx.currentTime;
    const now = performance.now();

    if (rawAudioTime !== lastAudioCtxTime) {
        lastAudioCtxTime = rawAudioTime;
        lastAudioPerfTime = now;
    }

    const elapsed = (now - lastAudioPerfTime) / 1000;
    return rawAudioTime + Math.min(elapsed, 0.1);
}

function updatePhysics(dt) {
    if (!canvas) return;

    const currentAudioTime = getSmoothAudioTime();
    const effectiveTime = currentAudioTime - totalPausedTime;
    const pixelsPerSecond = canvas.height / fallDuration;

    if (isPlaying) {
        if (!isPaused) {
            while (visualEventIndex < currentPlaybackEvents.length) {
                const evt = currentPlaybackEvents[visualEventIndex];
                const hitTime = playbackStartTime + evt.time + totalPausedTime;
                const spawnTime = hitTime - fallDuration;

                if (currentAudioTime >= spawnTime) {
                    spawnFallingNote(evt.freq, evt.duration, hitTime, evt.trackIndex);
                    visualEventIndex++;
                } else {
                    break;
                }
            }
        }

        const numFalling = fallingNotes.length;

        // Prune off-screen falling notes from head (GC-free pointer increment)
        while (fallingHeadIndex < numFalling) {
            const note = fallingNotes[fallingHeadIndex];
            const timeRemaining = note.targetTime - currentAudioTime;
            note.height = note.duration * pixelsPerSecond;
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;

            if (!isPaused && note.drawY > canvas.height) {
                recycleNote(note);
                fallingHeadIndex++;
            } else {
                break;
            }
        }

        // Update positions of remaining falling notes
        for (let i = fallingHeadIndex; i < numFalling; i++) {
            const note = fallingNotes[i];
            const timeRemaining = note.targetTime - currentAudioTime;
            note.height = note.duration * pixelsPerSecond;
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;
        }

        // Compact array if head pointer moves significantly
        if (fallingHeadIndex > 64 && fallingHeadIndex > (fallingNotes.length >> 1)) {
            fallingNotes = fallingNotes.slice(fallingHeadIndex);
            fallingHeadIndex = 0;
        }

        if (!isPaused && !window.isScrubbingProgressBar) {
            const elapsed = effectiveTime - playbackStartTime;
            if (playbackTotalDuration > 0) {
                const pct = Math.max(0, Math.min(100, (elapsed / playbackTotalDuration) * 100));
                const bar = document.getElementById('progress-bar');
                if (bar) {
                    bar.value = pct;
                    bar.style.setProperty('--progress-pct', `${pct}%`);
                }
            }
        }
    } else if (fallingNotes.length - fallingHeadIndex > 0) {
        recycleAllNotes();
    }

    // Update manual visual notes with O(1) swap-and-pop removal
    for (let i = visualNotes.length - 1; i >= 0; i--) {
        const note = visualNotes[i];
        if (note.active) {
            note.height += manualRiseSpeed * dt;
            note.y = canvas.height - note.height;
        } else {
            note.y -= manualRiseSpeed * dt;
        }

        if (note.y + note.height < -50) {
            recycleNote(note);
            const lastNote = visualNotes.pop();
            if (i < visualNotes.length) {
                visualNotes[i] = lastNote;
            }
        }
    }
}

// --- VISUALIZER DRAW LOOP ---
let isLoopRunning = false;
let lastFrameTime = performance.now();

// Pre-allocated containers to eliminate GC pause overhead
const colorBuckets = {};
const visibleNotesList = [];

// --- COLOR MIXING HELPERS FOR OVERLAPPING NOTES ---
const parsedColorCache = {};

function parseColor(str) {
    if (parsedColorCache[str]) return parsedColorCache[str];
    let r = 0, g = 0, b = 0, a = 1;
    if (str.startsWith('#')) {
        let hex = str.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        r = parseInt(hex.substring(0, 2), 16) || 0;
        g = parseInt(hex.substring(2, 4), 16) || 0;
        b = parseInt(hex.substring(4, 6), 16) || 0;
    } else if (str.startsWith('rgb')) {
        const match = str.match(/[\d.]+/g);
        if (match && match.length >= 3) {
            r = parseFloat(match[0]);
            g = parseFloat(match[1]);
            b = parseFloat(match[2]);
            if (match.length >= 4) a = parseFloat(match[3]);
        }
    }
    const res = [r, g, b, a];
    parsedColorCache[str] = res;
    return res;
}

const mixedColorCache = {};

function mixColors(color1, color2) {
    const key = color1 < color2 ? color1 + '|' + color2 : color2 + '|' + color1;
    if (mixedColorCache[key]) return mixedColorCache[key];

    const c1 = parseColor(color1);
    const c2 = parseColor(color2);

    // Perceptual square-root color blending for vibrant mixed area
    const r = Math.round(Math.sqrt((c1[0] * c1[0] + c2[0] * c2[0]) / 2));
    const g = Math.round(Math.sqrt((c1[1] * c1[1] + c2[1] * c2[1]) / 2));
    const b = Math.round(Math.sqrt((c1[2] * c1[2] + c2[2] * c2[2]) / 2));
    const a = (c1[3] + c2[3]) / 2;

    const result = a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;
    mixedColorCache[key] = result;
    return result;
}

function ensureVisualizerLoopRunning() {
    if (!isLoopRunning) {
        isLoopRunning = true;
        lastFrameTime = performance.now();
        requestAnimationFrame(visualizerLoop);
    }
}

function startVisualizerLoop() {
    ensureVisualizerLoopRunning();
}

function visualizerLoop(currentTime) {
    if (!isLoopRunning) return;

    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    const activeFallingCount = fallingNotes.length - fallingHeadIndex;

    if (dt > 0.1) {
        const hasActiveVisuals = (isPlaying && !isPaused) || activeFallingCount > 0 || visualNotes.length > 0;
        if (isVisualizerOn && hasActiveVisuals) {
            requestAnimationFrame(visualizerLoop);
        } else {
            isLoopRunning = false;
        }
        return;
    }

    if (typeof updatePhysics === 'function') updatePhysics(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isVisualizerOn) {
        const canvasH = canvas.height;
        let visibleCount = 0;

        // Reset bucket & list lengths without garbage generation
        for (const c in colorBuckets) {
            colorBuckets[c].length = 0;
        }
        visibleNotesList.length = 0;

        // 1. Viewport Culling & Color Batching for Falling Notes
        const numFalling = fallingNotes.length;
        for (let i = fallingHeadIndex; i < numFalling; i++) {
            const note = fallingNotes[i];
            const dY = note.drawY;
            const h = note.height;
            if (dY + h >= 0 && dY <= canvasH) {
                visibleCount++;
                if (!colorBuckets[note.color]) colorBuckets[note.color] = [];
                colorBuckets[note.color].push(note);
                visibleNotesList.push(note);
            }
        }

        // 2. Viewport Culling & Color Batching for Visual Notes
        const numVisual = visualNotes.length;
        for (let i = 0; i < numVisual; i++) {
            const note = visualNotes[i];
            const dY = note.y;
            const h = note.height;
            if (dY + h >= 0 && dY <= canvasH) {
                visibleCount++;
                if (!colorBuckets[note.color]) colorBuckets[note.color] = [];
                colorBuckets[note.color].push(note);
                visibleNotesList.push(note);
            }
        }

        // Efficient Single-Pass Canvas 2D Path Batching & Overlap Color Mixing
        if (visibleCount > 0) {
            // Pass 1: Fill each color bucket in GPU calls
            for (const color in colorBuckets) {
                const bucket = colorBuckets[color];
                const len = bucket.length;
                if (len === 0) continue;

                ctx.fillStyle = color;
                ctx.beginPath();
                for (let k = 0; k < len; k++) {
                    const n = bucket[k];
                    const yPos = (n.drawY !== undefined) ? n.drawY : n.y;
                    const r = (n.drawY !== undefined) ? 4 : 7;
                    ctx.roundRect(n.x | 0, yPos, n.width | 0, Math.max(0.1, n.height), r);
                }
                ctx.fill();
            }

            // Pass 1.5: Fill mixed color for overlapping note blocks of different colors
            const vLen = visibleNotesList.length;
            if (vLen > 1) {
                for (let i = 0; i < vLen; i++) {
                    const nA = visibleNotesList[i];
                    const xA = nA.x | 0;
                    const yA = (nA.drawY !== undefined) ? nA.drawY : nA.y;
                    const wA = nA.width | 0;
                    const hA = Math.max(0.1, nA.height);
                    const rA = (nA.drawY !== undefined) ? 4 : 7;
                    const colorA = nA.color;

                    for (let j = i + 1; j < vLen; j++) {
                        const nB = visibleNotesList[j];
                        const colorB = nB.color;
                        if (colorA === colorB) continue;

                        const xB = nB.x | 0;
                        const yB = (nB.drawY !== undefined) ? nB.drawY : nB.y;
                        const wB = nB.width | 0;
                        const hB = Math.max(0.1, nB.height);

                        // Quick bounding box intersection check
                        if (xA < xB + wB && xA + wA > xB && yA < yB + hB && yA + hA > yB) {
                            const rB = (nB.drawY !== undefined) ? 4 : 7;
                            const mixedColor = mixColors(colorA, colorB);

                            const interX = Math.max(xA, xB);
                            const interY = Math.max(yA, yB);
                            const interW = Math.min(xA + wA, xB + wB) - interX;
                            const interH = Math.min(yA + hA, yB + hB) - interY;

                            ctx.save();
                            ctx.beginPath();
                            ctx.roundRect(xA, yA, wA, hA, rA);
                            ctx.clip();
                            ctx.beginPath();
                            ctx.roundRect(xB, yB, wB, hB, rB);
                            ctx.clip();

                            ctx.fillStyle = mixedColor;
                            ctx.fillRect(interX, interY, interW, interH);

                            ctx.restore();
                        }
                    }
                }
            }

            // Pass 2: Stroke all note outlines in a single stroke call
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const color in colorBuckets) {
                const bucket = colorBuckets[color];
                const len = bucket.length;
                for (let k = 0; k < len; k++) {
                    const n = bucket[k];
                    const yPos = (n.drawY !== undefined) ? n.drawY : n.y;
                    const r = (n.drawY !== undefined) ? 4 : 7;
                    ctx.roundRect(n.x | 0, yPos, n.width | 0, Math.max(0.1, n.height), r);
                }
            }
            ctx.stroke();
        }
    }

    const hasActiveVisuals = (isPlaying && !isPaused) || visualNotes.length > 0;
    const activeFallingRemaining = fallingNotes.length - fallingHeadIndex;

    if (isVisualizerOn && (hasActiveVisuals || (activeFallingRemaining > 0 && isPlaying))) {
        if (hasActiveVisuals) {
            requestAnimationFrame(visualizerLoop);
        } else {
            // Static frame rendered (e.g. paused with falling notes on screen)
            isLoopRunning = false;
        }
    } else {
        // Canvas is clear and nothing active, stop loop
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isLoopRunning = false;
    }
}

// --- PLAYBACK ENGINE STATE ---
let schedulerTimer = null; 
let playbackStartTime = 0;
let playbackTotalDuration = 0;
let nextEventIndex = 0;
let visualEventIndex = 0;
let currentPlaybackEvents = [];
let rawPlaybackEvents = []; // Preserved original MIDI events (unprocessed)

// PAUSE STATE TRACKING
let pauseStartTimestamp = 0;
let totalPausedTime = 0;
let seekedWhilePaused = false;

function startPlayback() {
  if (currentPlaybackEvents.length === 0) {
    // If no events loaded from MIDI, try recordedEvents (for backward compat)
    if (typeof recordedEvents !== 'undefined' && recordedEvents.length > 0) {
      currentPlaybackEvents = processRecordedEvents();
    } else {
      return;
    }
  }
  isPlaying = true;
  isPaused = false;
  totalPausedTime = 0;
  seekedWhilePaused = false;

  playbackTotalDuration = 0;
  if(currentPlaybackEvents.length > 0) {
      const last = currentPlaybackEvents[currentPlaybackEvents.length-1];
      playbackTotalDuration = last.time + last.duration;
  }
  
  nextEventIndex = 0;
  visualEventIndex = 0;
  
  const now = typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0;
  lastAudioCtxTime = now;
  lastAudioPerfTime = performance.now();
  
  playbackStartTime = now + fallDuration;
  
  if (typeof updateUI === 'function') updateUI();
  ensureVisualizerLoopRunning();
  schedulerLoop();
}

function stopPlayback() {
  isPlaying = false;
  isPaused = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  
  if (typeof recycleAllNotes === 'function') recycleAllNotes(); 
  if (typeof clearAllHighlights === 'function') clearAllHighlights(); 
  
  // Reset Progress Bar
  const bar = document.getElementById('progress-bar');
  if(bar) {
      bar.value = 0;
      bar.style.setProperty('--progress-pct', '0%');
  }
  
  if (typeof updateUI === 'function') updateUI();
  ensureVisualizerLoopRunning();
}

function setVisualizerPause(paused) {
    if (paused) {
        pauseStartTimestamp = typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0;
        if(schedulerTimer) clearTimeout(schedulerTimer);
        
        // Stop any notes currently ringing out to prevent hanging sounds
        if (typeof clearTimedSustainTrackers === 'function') clearTimedSustainTrackers(false);
        if (typeof stopAllAudio === 'function') stopAllAudio();

        // Clear any currently active visual highlights so keys don't get stuck
        document.querySelectorAll('.active').forEach(key => key.classList.remove('active'));
    } else {
        const now = typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0;
        lastAudioCtxTime = now;
        lastAudioPerfTime = performance.now();
        const diff = now - pauseStartTimestamp;
        
        // ALWAYS accumulate pause time to prevent the "burst" catch-up bug
        totalPausedTime += diff; 
        
        // Shift falling note targets so they don't jump
        for (let i = fallingHeadIndex; i < fallingNotes.length; i++) {
            fallingNotes[i].targetTime += diff;
        }

        ensureVisualizerLoopRunning();
        schedulerLoop();
    }
}

function seekToTime(percent) {
    if (!isPlaying) return;
    percent = Math.max(0, Math.min(100, percent));
    
    if (schedulerTimer) clearTimeout(schedulerTimer);
    if (typeof clearTimedSustainTrackers === 'function') clearTimedSustainTrackers(false);
    if (typeof stopAllAudio === 'function') stopAllAudio();
    if (typeof activeVoices !== 'undefined') activeVoices = []; 
    
    document.querySelectorAll('.active').forEach(key => key.classList.remove('active'));
    
    const targetSeconds = (percent / 100) * playbackTotalDuration;
    
    if (typeof recycleAllNotes === 'function') recycleAllNotes();
    
    const now = typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0;
    lastAudioCtxTime = now;
    lastAudioPerfTime = performance.now();
    totalPausedTime = 0; 
    playbackStartTime = now - targetSeconds;
    
    if (isPaused) {
        pauseStartTimestamp = now;
    }

    nextEventIndex = 0;
    while(nextEventIndex < currentPlaybackEvents.length && currentPlaybackEvents[nextEventIndex].time < targetSeconds) {
        nextEventIndex++;
    }
    
    visualEventIndex = 0;
    
    // First pass: find the first event whose visual spawn time hasn't passed yet
    for (let i = 0; i < currentPlaybackEvents.length; i++) {
        const spawnTimeRel = currentPlaybackEvents[i].time - fallDuration;
        if (spawnTimeRel > targetSeconds) {
            visualEventIndex = i;
            break;
        }
        if (i === currentPlaybackEvents.length - 1) {
            visualEventIndex = currentPlaybackEvents.length;
        }
    }
    
    // Second pass: spawn "in-air" falling notes for events that are visually on screen
    for (let i = 0; i < visualEventIndex; i++) {
        const evt = currentPlaybackEvents[i];
        if (evt.time + evt.duration >= targetSeconds && evt.time - fallDuration <= targetSeconds) {
            const hitTimeAbs = playbackStartTime + evt.time;
            spawnFallingNote(evt.freq, evt.duration, hitTimeAbs, evt.trackIndex);
        }
    }
    
    // Update progress bar even when paused
    const bar = document.getElementById('progress-bar');
    if (bar) {
        bar.value = percent;
        bar.style.setProperty('--progress-pct', `${percent}%`);
    }

    if (!isPaused) {
        schedulerLoop();
    }
    ensureVisualizerLoopRunning();
}

function processRecordedEvents() {
    // Always process from raw events to prevent compounding errors
    const sourceEvents = (rawPlaybackEvents.length > 0) ? rawPlaybackEvents : currentPlaybackEvents;
    let active = {};
    let processed = [];
    let sorted = [...sourceEvents].sort((a, b) => a.time - b.time);
    const freqMultiplier = Math.pow(2, playbackTranspose / 12);

    sorted.forEach(evt => {
        if (evt.type === 'on') {
            const newEvt = { 
                type: 'on', 
                freq: evt.freq * freqMultiplier,
                time: evt.time / playbackRate, 
                duration: evt.duration / playbackRate,
                trackIndex: evt.trackIndex
            };
            active[evt.freq] = newEvt;
            processed.push(newEvt);
        } else if (evt.type === 'off') {
            if (active[evt.freq]) {
                const onEvent = active[evt.freq];
                onEvent.duration = (evt.time / playbackRate) - onEvent.time;
                delete active[evt.freq];
            }
        }
    });
    return processed;
}

function changePlaybackTranspose(delta) {
    playbackTranspose += delta;

    if (playbackTranspose < -50) playbackTranspose = -50;
    if (playbackTranspose > 50) playbackTranspose = 50;

    if (isPlaying) {
        const currentAudioTime = isPaused ? pauseStartTimestamp : (typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0);
        const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
        const currentPercent = playbackTotalDuration > 0 ? (elapsed / playbackTotalDuration) * 100 : 0;

        currentPlaybackEvents = processRecordedEvents();

        playbackTotalDuration = 0;
        if (currentPlaybackEvents.length > 0) {
            const last = currentPlaybackEvents[currentPlaybackEvents.length - 1];
            playbackTotalDuration = last.time + last.duration;
        }

        seekToTime(Math.max(0, Math.min(100, currentPercent)));
    }

    if (typeof updateUI === 'function') updateUI();
    if (typeof saveSettings === 'function') saveSettings();
}

function changePlaybackSpeed(delta) {
    playbackRate += delta;
    
    // Clamp speed between 0.25x (25%) and 3.0x (300%)
    if (playbackRate < 0.25) playbackRate = 0.25;
    if (playbackRate > 3.0) playbackRate = 3.0;

    console.log(`Playback Speed: ${playbackRate.toFixed(2)}x`);

    if (isPlaying) {
        const currentAudioTime = isPaused ? pauseStartTimestamp : (typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0);
        const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
        const currentPercent = playbackTotalDuration > 0 ? (elapsed / playbackTotalDuration) * 100 : 0;

        currentPlaybackEvents = processRecordedEvents();
        
        playbackTotalDuration = 0;
        if(currentPlaybackEvents.length > 0) {
            const last = currentPlaybackEvents[currentPlaybackEvents.length - 1];
            playbackTotalDuration = last.time + last.duration;
        }

        seekToTime(currentPercent);
    }

    if (typeof updateUI === 'function') updateUI();
    if (typeof saveSettings === 'function') saveSettings();
}

function changeFallDuration(delta) {
    fallDuration += delta;

    if (fallDuration < 0.5) fallDuration = 0.5;
    if (fallDuration > 10.0) fallDuration = 10.0;

    if (isPlaying) {
        const currentAudioTime = isPaused ? pauseStartTimestamp : (typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0);
        const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
        const currentPercent = playbackTotalDuration > 0 ? (elapsed / playbackTotalDuration) * 100 : 0;
        seekToTime(Math.max(0, Math.min(100, currentPercent)));
    }

    if (typeof updateUI === 'function') updateUI();
    if (typeof saveSettings === 'function') saveSettings();
}

function changeManualRiseSpeed(delta) {
    manualRiseSpeed += delta;

    if (manualRiseSpeed < 10) manualRiseSpeed = 10;
    if (manualRiseSpeed > 1000) manualRiseSpeed = 1000;

    if (typeof updateUI === 'function') updateUI();
    if (typeof saveSettings === 'function') saveSettings();
}

function schedulerLoop() {
    if (!isPlaying || isPaused) return;

    const scheduleAheadTime = 0.1; 
    const currentContextTime = typeof audioCtx !== 'undefined' ? audioCtx.currentTime : 0;
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const triggerTime = playbackStartTime + event.time + totalPausedTime;

        if (triggerTime < currentContextTime + scheduleAheadTime) {
            
            // Only process 'on' events (MIDI conversion now produces single events with duration)
            if (event.type !== 'on') {
                nextEventIndex++;
                continue;
            }
            
            const noteDuration = event.duration || 0.5;
            
            // 1. Audio
            if (typeof triggerSound === 'function') {
                if (typeof sustainMode !== 'undefined' && sustainMode === 0) {
                    triggerSound(event.freq, triggerTime, null);
                } else {
                    triggerSound(event.freq, triggerTime, noteDuration);
                }
            }

            // 2. UI Highlight (Note On) - schedule using setTimeout since no Tone.Draw
            const highlightDelay = Math.max(0, (triggerTime - currentContextTime) * 1000);
            window.setTimeout(() => {
                if (typeof highlightKey === 'function') highlightKey(event.freq);
                
                const freqStr = event.freq.toFixed(2);
                
                if (typeof playedFrequencies !== 'undefined') playedFrequencies.add(freqStr);
                
                if (typeof getCachedKeys === 'function') {
                    const keys = getCachedKeys(freqStr);
                    for (let i = 0; i < keys.length; i++) keys[i].classList.add("played-note");
                }
            }, highlightDelay);

            // 3. UI Un-Highlight (Note Off)
            const releaseDelay = Math.max(0, (triggerTime + noteDuration - currentContextTime) * 1000);
            window.setTimeout(() => {
                if (typeof unhighlightKey === 'function') unhighlightKey(event.freq);
            }, releaseDelay);

            nextEventIndex++;
        } else {
            break; 
        }
    }

    schedulerTimer = setTimeout(schedulerLoop, 25);
    
    if (nextEventIndex >= currentPlaybackEvents.length) {
        const lastEvent = currentPlaybackEvents[currentPlaybackEvents.length - 1];
        const endTime = playbackStartTime + lastEvent.time + lastEvent.duration + 2.0 + totalPausedTime;
        if (currentContextTime > endTime) stopPlayback();
    }
}