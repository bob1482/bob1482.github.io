// ==========================================
// PIANO VISUALIZER: Engine, Canvas, Scheduler
// ==========================================

// --- CANVAS SETUP ---
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d", { alpha: true }); // Explicit alpha optimization

// --- STATE & POOLS ---
let keyCoordinates = {}; 
let notePool = [];      
let visualNotes = [];   // Manual rising notes
let fallingNotes = [];  // Playback falling notes
let particles = [];     // Explosion particles

// --- SETTINGS (TIME-BASED) ---
const FALL_DURATION = 2.0;       
const MANUAL_RISE_SPEED_PPS = 100; 
const PARTICLE_DECAY_RATE = 1; 

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

// --- INITIALIZATION ---
function initVisualizer() {
    resizeCanvas();
    startVisualizerLoop();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 150);
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.83; 
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

// --- OBJECT POOLING ---
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
    particles = [];
}

// --- PARTICLE SYSTEM ---
function createParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: x + (Math.random() * 40 - 20) | 0,
            y: y | 0,
            vx: (Math.random() - 0.5) * 150, 
            vy: ((Math.random() - 0.5) * 150) - 80, 
            life: 1.0,
            color: color
        });
    }
}

// --- VISUALIZER FUNCTIONS ---
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
  note.color = 'rgb(93, 0, 150)'; 
  note.targetTime = targetTime;
  note.active = true;

  fallingNotes.push(note);
}

function startManualVisualNote(freqStr, color = 'rgb(61, 182, 67)') { 
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const coords = keyCoordinates[freqStr];
  if (!coords) return;

  for(let i=0; i<visualNotes.length; i++) {
      if(visualNotes[i].freq === freqStr && visualNotes[i].active) return;
  }

  createParticles(coords.x + coords.width / 2, canvas.height, color);

  const note = getNoteFromPool();
  note.freq = freqStr;
  note.x = coords.x;
  note.width = coords.width;
  note.y = canvas.height;
  note.height = 0;
  note.color = color;
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

// --- THE LOOP (View Layer) ---
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

    // Only update physics if not paused
    // Particles and Manual notes still animate, but playback logic halts
    updatePhysics(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 2;

    // A. Render Falling Notes
    if (fallingNotes.length > 0) {
        ctx.fillStyle = 'rgb(93, 0, 150)'; 
        ctx.beginPath(); 
        for (let i = 0; i < fallingNotes.length; i++) {
            const note = fallingNotes[i];
            ctx.roundRect(note.x | 0, (note.drawY | 0), note.width | 0, note.height | 0, 4);
        }
        ctx.fill();
        ctx.stroke(); 
    }

    // B. Render Manual Notes
    for (let i = 0; i < visualNotes.length; i++) {
        const note = visualNotes[i];
        ctx.fillStyle = note.color; 
        ctx.beginPath();
        ctx.roundRect(note.x | 0, note.y | 0, note.width | 0, note.height | 0, 7);
        ctx.fill();
        ctx.stroke();
    }
    
    // C. Render Particles
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x | 0, p.y | 0, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function updatePhysics(dt) {
    // If paused, we freeze playback logic, but we still render current positions
    // Actually, for "falling" effect to pause, we must stop updating Y
    
    if (isPaused) {
        // Just animate particles if paused
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= PARTICLE_DECAY_RATE * dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
        return; 
    }

    const currentAudioTime = Tone.now(); 
    const effectiveTime = currentAudioTime - totalPausedTime; // Compensate for pauses
    
    const pixelsPerSecond = canvas.height / FALL_DURATION;

    // 1. PLAYBACK LOGIC
    if (isPlaying) {
        // Spawn Visuals
        while(visualEventIndex < currentPlaybackEvents.length) {
            const evt = currentPlaybackEvents[visualEventIndex];
            // Hit time adjusted by start time
            const hitTime = playbackStartTime + evt.time + totalPausedTime; 
            const spawnTime = hitTime - FALL_DURATION;
            
            if (currentAudioTime >= spawnTime) {
                spawnFallingNote(evt.freq, evt.duration, hitTime);
                visualEventIndex++;
            } else {
                break; 
            }
        }

        // Move & Cull Falling Notes
        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            // effective target time vs current time
            const timeRemaining = note.targetTime - (currentAudioTime);
            
            // If paused, note.targetTime needs to "move" away, or we freeze time.
            // Since we use strict time diff:
            
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;

            if (note.drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
            }
        }
        
        // Update Progress Bar
        const elapsed = (effectiveTime - playbackStartTime);
        if (playbackTotalDuration > 0) {
            const pct = (elapsed / playbackTotalDuration) * 100;
            const bar = document.getElementById('progress-bar');
            if (bar) bar.value = Math.min(pct, 100);
        }

    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    // 2. MANUAL NOTES LOGIC (Always animates even if playback paused?)
    // Usually manual playing works while paused
    for (let i = visualNotes.length - 1; i >= 0; i--) {
        const note = visualNotes[i];
        if (note.active) {
            note.height += MANUAL_RISE_SPEED_PPS * dt;
            note.y = canvas.height - note.height;
        } else {
            note.y -= MANUAL_RISE_SPEED_PPS * dt;
        }
        if (note.y + note.height < -50) {
            recycleNote(note);
            visualNotes.splice(i, 1);
        }
    }

    // 3. PARTICLE LOGIC
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= PARTICLE_DECAY_RATE * dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// --- PLAYBACK CONTROLLER ---

function startPlayback() {
  if (recordedEvents.length === 0) return;
  isPlaying = true;
  isPaused = false;
  totalPausedTime = 0;
  
  hideBoard(); 

  currentPlaybackEvents = processRecordedEvents();
  
  // Calculate total duration for progress bar
  playbackTotalDuration = 0;
  if(currentPlaybackEvents.length > 0) {
      const last = currentPlaybackEvents[currentPlaybackEvents.length-1];
      playbackTotalDuration = last.time + last.duration;
  }
  
  nextEventIndex = 0;
  visualEventIndex = 0;
  
  const now = Tone.now();
  // Start playing immediately (visuals fall from top, so they spawn 'in past' virtually or strictly)
  // To make visuals appear at top and fall to hit line:
  // Playback start is "Now" + FallDuration. Audio waits.
  playbackStartTime = now + FALL_DURATION; 
  
  if(isMetronomeOn) {
      Tone.Transport.start();
      metroLoop.start(0); 
  }
  
  updateUI();
  schedulerLoop();
}

function setVisualizerPause(paused) {
    if (paused) {
        pauseStartTimestamp = Tone.now();
        if(schedulerTimer) clearTimeout(schedulerTimer);
        Tone.Transport.pause();
    } else {
        const now = Tone.now();
        const diff = now - pauseStartTimestamp;
        totalPausedTime += diff; // Accumulate pause duration
        
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
    
    // 1. Calculate new time
    const targetSeconds = (percent / 100) * playbackTotalDuration;
    
    // 2. Reset visualizer state
    recycleAllNotes();
    
    // 3. Reset Time Base
    const now = Tone.now();
    // Logic: (now - totalPausedTime - playbackStartTime) should equal targetSeconds
    // So: playbackStartTime = now - totalPausedTime - targetSeconds
    
    // However, to simplify, we can just reset pausedTime to 0 and recalculate start
    totalPausedTime = 0; 
    playbackStartTime = now - targetSeconds + FALL_DURATION; // +FallDuration to keep sync

    // 4. Find Index in Events
    nextEventIndex = 0;
    visualEventIndex = 0;
    
    // Audio Events
    for(let i=0; i<currentPlaybackEvents.length; i++) {
        if (currentPlaybackEvents[i].time >= targetSeconds) {
            nextEventIndex = i;
            break;
        }
    }
    
    // Visual Events (need to spawn things that haven't hit the bar yet)
    // Actually, we need to spawn things that are currently FALLING (in the window)
    // Complex, but simplest is to just reset visual index to same as audio
    visualEventIndex = nextEventIndex;

    // Optional: Pre-warm visualizer?
    // For now, keys will just start appearing from top.
}

function stopPlayback() {
  isPlaying = false;
  isPaused = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  Tone.Transport.stop(); 
  metroLoop.stop();
  
  recycleAllNotes(); 
  showBoard(); 
  clearAllHighlights(); 
  
  // Reset Progress Bar
  const bar = document.getElementById('progress-bar');
  if(bar) bar.value = 0;
  
  updateUI();
}

function processRecordedEvents() {
    let active = {};
    let processed = [];
    let sorted = [...recordedEvents].sort((a, b) => a.time - b.time);

    sorted.forEach(evt => {
        if (evt.type === 'on') {
            active[evt.freq] = evt;
            evt.duration = 0.5; // default
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

function schedulerLoop() {
    if (!isPlaying || isPaused) return;

    const scheduleAheadTime = 0.1; 
    const currentContextTime = Tone.now();
    const effectiveTime = currentContextTime - totalPausedTime;
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const absolutePlayTime = playbackStartTime + event.time; // This moves with pause compensation?
        // No. absolutePlayTime is fixed relative to Start. 
        // We compare against (effectiveTime)
        
        // Wait, if playbackStartTime was set using Tone.now(), it is fixed in reality.
        // effectiveTime is currentNow - totalPaused.
        // If we paused for 5 sec, effectiveTime is 5 sec less than Now.
        // logic: if (effectiveTime >= startTime + eventTime) -> Play.
        
        // Let's refine:
        // PlayTime = playbackStartTime + event.time + totalPausedTime
        const triggerTime = playbackStartTime + event.time + totalPausedTime;

        if (triggerTime < currentContextTime + scheduleAheadTime) {
            
            // 1. Audio
            triggerSound(event.freq, triggerTime);

            // 2. UI Highlight & Particles
            Tone.Draw.schedule(() => {
                highlightKey(event.freq);
                if(keyCoordinates[event.freq.toFixed(2)]) {
                    const k = keyCoordinates[event.freq.toFixed(2)];
                    createParticles(k.x + k.width/2, canvas.height, '#4a0094');
                }
            }, triggerTime);

            Tone.Draw.schedule(() => {
                unhighlightKey(event.freq);
            }, triggerTime + event.duration);

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