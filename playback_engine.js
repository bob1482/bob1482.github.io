// ==========================================
// PLAYBACK ENGINE: Visuals, Scheduler & Time
// ==========================================

// --- VISUALIZER STATE CONTAINERS ---
let keyCoordinates = {};
let notePool = [];
let visualNotes = [];
let fallingNotes = [];

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
    notePool.push(note);
}

function recycleAllNotes() {
    while (fallingNotes.length > 0) recycleNote(fallingNotes.pop());
    while (visualNotes.length > 0) recycleNote(visualNotes.pop());
}

// --- VISUALIZER INITIALIZATION ---
function initVisualizer() {
    resizeCanvas();
    startVisualizerLoop();
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 150);
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    const strip = document.getElementById("piano-strip");
    const isMobile = strip && window.getComputedStyle(strip).display === "none";

    const currentStripHeight = typeof stripHeight !== 'undefined' ? stripHeight : 17;
    const canvasViewportRatio = (100 - currentStripHeight) / 100;

    canvas.height = isMobile ? window.innerHeight : window.innerHeight * canvasViewportRatio;
    updateKeyCoordinates();
}

function updateKeyCoordinates() {
    const keys = document.querySelectorAll('.p-key');
    keys.forEach(key => {
        const freq = key.getAttribute('data-note');
        const rect = key.getBoundingClientRect();
        keyCoordinates[freq] = { x: rect.left | 0, width: rect.width | 0 };
    });
}

// --- VISUALIZER STATE HELPERS ---
function spawnFallingNote(freqStr, duration, targetTime, trackIndex = 0) {
    if (!canvas) return;

    if (Object.keys(keyCoordinates).length === 0 && typeof updateKeyCoordinates === 'function') {
        updateKeyCoordinates();
    }

    const freqFixed = (typeof freqStr === 'number') ? freqStr.toFixed(2) : freqStr;
    const coords = keyCoordinates[freqFixed];
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

    const note = getNoteFromPool();
    note.freq = freqFixed;
    note.x = coords.x;
    note.width = coords.width;
    note.duration = duration;
    note.height = duration * pixelsPerSecond;
    note.color = noteColor;
    note.targetTime = targetTime;
    note.active = true;

    fallingNotes.push(note);
}

function startManualVisualNote(freqStr, color = 'rgb(61, 182, 67)') {
    if (!canvas) return;

    if (Object.keys(keyCoordinates).length === 0 && typeof updateKeyCoordinates === 'function') {
        updateKeyCoordinates();
    }

    const coords = keyCoordinates[freqStr];
    if (!coords) return;

    for (let i = 0; i < visualNotes.length; i++) {
        if (visualNotes[i].freq === freqStr && visualNotes[i].active) {
            visualNotes[i].refCount = (visualNotes[i].refCount || 1) + 1;
            return;
        }
    }

    const note = getNoteFromPool();
    note.freq = freqStr;
    note.x = coords.x;
    note.width = coords.width;
    note.y = canvas.height;
    note.height = 0;
    note.color = color;
    note.active = true;
    note.refCount = 1;

    visualNotes.push(note);
}

function endManualVisualNote(freqStr) {
    for (let i = 0; i < visualNotes.length; i++) {
        if (visualNotes[i].freq === freqStr && visualNotes[i].active) {
            visualNotes[i].refCount = (visualNotes[i].refCount || 1) - 1;
            if (visualNotes[i].refCount <= 0) {
                visualNotes[i].active = false;
            }
            return;
        }
    }
}

function updatePhysics(dt) {
    if (!canvas) return;

    const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
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

        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            const timeRemaining = note.targetTime - currentAudioTime;

            note.height = note.duration * pixelsPerSecond;
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;

            if (!isPaused && note.drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
            }
        }

        if (!isPaused) {
            const elapsed = effectiveTime - playbackStartTime;
            if (playbackTotalDuration > 0) {
                const pct = (elapsed / playbackTotalDuration) * 100;
                const bar = document.getElementById('progress-bar');
                if (bar) bar.value = Math.min(pct, 100);
            }
        }
    } else if (fallingNotes.length > 0) {
        recycleAllNotes();
    }

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
            visualNotes.splice(i, 1);
        }
    }
}

// --- VISUALIZER DRAW LOOP ---
function startVisualizerLoop() {
    let lastFrameTime = performance.now();
    const borderStyle = "rgba(255, 255, 255, 0.7)";

    function loop(currentTime) {
        const dt = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;

        if (dt > 0.1) {
            requestAnimationFrame(loop);
            return;
        }

        if (typeof updatePhysics === 'function') updatePhysics(dt);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!isVisualizerOn) {
            requestAnimationFrame(loop);
            return;
        }

        ctx.strokeStyle = borderStyle;
        ctx.lineWidth = 2;

        if (fallingNotes.length > 0) {
            for (let i = 0; i < fallingNotes.length; i++) {
                const note = fallingNotes[i];
                ctx.fillStyle = note.color;
                ctx.beginPath();
                ctx.roundRect(note.x | 0, note.drawY | 0, note.width | 0, note.height | 0, 4);
                ctx.fill();
                ctx.stroke();
            }
        }

        for (let i = 0; i < visualNotes.length; i++) {
            const note = visualNotes[i];
            ctx.fillStyle = note.color;
            ctx.beginPath();
            ctx.roundRect(note.x | 0, note.y | 0, note.width | 0, note.height | 0, 7);
            ctx.fill();
            ctx.stroke();
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}

// --- PLAYBACK ENGINE STATE ---
let schedulerTimer = null; 
let playbackStartTime = 0;
let playbackTotalDuration = 0;
let nextEventIndex = 0;
let visualEventIndex = 0;
let currentPlaybackEvents = [];

// PAUSE STATE TRACKING
let pauseStartTimestamp = 0;
let totalPausedTime = 0;
let seekedWhilePaused = false;

function startPlayback() {
  if (recordedEvents.length === 0) return;
  isPlaying = true;
  isPaused = false;
  totalPausedTime = 0;
  seekedWhilePaused = false; 

  currentPlaybackEvents = processRecordedEvents();
  
  playbackTotalDuration = 0;
  if(currentPlaybackEvents.length > 0) {
      const last = currentPlaybackEvents[currentPlaybackEvents.length-1];
      playbackTotalDuration = last.time + last.duration;
  }
  
  nextEventIndex = 0;
  visualEventIndex = 0;
  
  const now = Tone.now();
  
  playbackStartTime = now + fallDuration;
  
  if(isMetronomeOn) {
      Tone.Transport.start();
      metroLoop.start(0); 
  }
  
  if (typeof updateUI === 'function') updateUI();
  schedulerLoop();
}

function stopPlayback() {
  isPlaying = false;
  isPaused = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  Tone.Transport.stop(); 
  metroLoop.stop();
  
  if (typeof recycleAllNotes === 'function') recycleAllNotes(); 
  if (typeof clearAllHighlights === 'function') clearAllHighlights(); 
  
  // Reset Progress Bar
  const bar = document.getElementById('progress-bar');
  if(bar) bar.value = 0;
  
  if (typeof updateUI === 'function') updateUI();
}

function setVisualizerPause(paused) {
    if (paused) {
        pauseStartTimestamp = Tone.now();
        if(schedulerTimer) clearTimeout(schedulerTimer);
        Tone.Transport.pause();
        
        // Stop any notes currently ringing out to prevent hanging sounds
        if (typeof clearTimedSustainTrackers === 'function') clearTimedSustainTrackers(false);
        if (typeof sampler !== 'undefined') sampler.releaseAll();
        Tone.Draw.cancel(0);

        // Clear any currently active visual highlights so keys don't get stuck
        document.querySelectorAll('.active').forEach(key => key.classList.remove('active'));
    } else {
        const now = Tone.now();
        const diff = now - pauseStartTimestamp;
        
        // ALWAYS accumulate pause time to prevent the "burst" catch-up bug
        totalPausedTime += diff; 
        
        // Shift falling note targets so they don't jump
        fallingNotes.forEach(n => {
            n.targetTime += diff;
        });

        if(isMetronomeOn) Tone.Transport.start();
        schedulerLoop();
    }
}

function seekToTime(percent) {
    if (!isPlaying) return;
    percent = Math.max(0, Math.min(100, percent));
    
    if (schedulerTimer) clearTimeout(schedulerTimer);
    if (typeof clearTimedSustainTrackers === 'function') clearTimedSustainTrackers(false);
    if (typeof sampler !== 'undefined') sampler.releaseAll();
    activeVoices = []; 
    Tone.Draw.cancel(0);
    
    document.querySelectorAll('.active').forEach(key => key.classList.remove('active'));
    
    const targetSeconds = (percent / 100) * playbackTotalDuration;
    
    if (typeof recycleAllNotes === 'function') recycleAllNotes();
    
    const now = Tone.now();
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
    
    for (let i = 0; i < currentPlaybackEvents.length; i++) {
        const evt = currentPlaybackEvents[i];
        const spawnTimeRel = evt.time - fallDuration;
        
        if (spawnTimeRel > targetSeconds) {
            visualEventIndex = i;
            break;
        }
        
        if (evt.time > targetSeconds) {
            const hitTimeAbs = playbackStartTime + evt.time; 
            spawnFallingNote(evt.freq, evt.duration, hitTimeAbs, evt.trackIndex);
        }
        
        if (i === currentPlaybackEvents.length - 1) {
            visualEventIndex = currentPlaybackEvents.length;
        }
    }
    
    if (!isPaused) {
        schedulerLoop();
    }
}

function processRecordedEvents() {
    let active = {};
    let processed = [];
    let sorted = [...recordedEvents].sort((a, b) => a.time - b.time);
    const freqMultiplier = Math.pow(2, playbackTranspose / 12);

    sorted.forEach(evt => {
        if (evt.type === 'on') {
            const newEvt = { 
                type: 'on', 
                freq: evt.freq * freqMultiplier,
                time: evt.time / playbackRate, 
                duration: 0.5 / playbackRate,
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
        const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
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
        // Save the current elapsed percentage so we don't lose our place
        const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
        const elapsed = currentAudioTime - totalPausedTime - playbackStartTime;
        const currentPercent = playbackTotalDuration > 0 ? (elapsed / playbackTotalDuration) * 100 : 0;

        // Reprocess events with the new rate
        currentPlaybackEvents = processRecordedEvents();
        
        // Recalculate total duration
        playbackTotalDuration = 0;
        if(currentPlaybackEvents.length > 0) {
            const last = currentPlaybackEvents[currentPlaybackEvents.length - 1];
            playbackTotalDuration = last.time + last.duration;
        }

        // Seek back to the saved percentage to seamlessly resume at the new speed
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
        const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
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
    const currentContextTime = Tone.now();
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const triggerTime = playbackStartTime + event.time + totalPausedTime;

        if (triggerTime < currentContextTime + scheduleAheadTime) {
            
            // 1. Audio
            if (typeof triggerSound === 'function') {
                if (typeof sustainMode !== 'undefined' && sustainMode === 0) {
                    triggerSound(event.freq, triggerTime, null);
                } else {
                    triggerSound(event.freq, triggerTime, event.duration);
                }
            }

            // 2. UI Highlight (Note On)
            Tone.Draw.schedule(() => {
                if (typeof highlightKey === 'function') highlightKey(event.freq);
                
                // Add persistent marker to build the scale visually
                const freqStr = event.freq.toFixed(2);
                
                // Save to memory so it survives transpose redraws
                if (typeof playedFrequencies !== 'undefined') playedFrequencies.add(freqStr);
                
                if (typeof getCachedKeys === 'function') {
                    const keys = getCachedKeys(freqStr);
                    for (let i = 0; i < keys.length; i++) keys[i].classList.add("played-note");
                }
            }, triggerTime);

            // 3. UI Un-Highlight (Note Off) - This releases the key!
            const releaseTime = triggerTime + event.duration;
            Tone.Draw.schedule(() => {
                if (typeof unhighlightKey === 'function') unhighlightKey(event.freq);
            }, releaseTime);

            nextEventIndex++;
        } else {
            break; 
        }
    }

    schedulerTimer = setTimeout(schedulerLoop, 25);
    
    if (nextEventIndex >= currentPlaybackEvents.length) {
        // Check for end of song
        const lastEvent = currentPlaybackEvents[currentPlaybackEvents.length - 1];
        const endTime = playbackStartTime + lastEvent.time + lastEvent.duration + 2.0 + totalPausedTime;
        if (currentContextTime > endTime) stopPlayback();
    }
}
