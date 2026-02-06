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

// --- PLAYBACK STATE ---
let schedulerTimer = null; 
let playbackStartTime = 0;
let nextEventIndex = 0;
let visualEventIndex = 0;
let currentPlaybackEvents = [];

// --- INITIALIZATION ---
function initVisualizer() {
    resizeCanvas();
    startVisualizerLoop();
}

// OPTIMIZATION: Debounce Resize to prevent layout thrashing
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
    // OPTIMIZATION: Store as integers immediately
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
    // Limit particle count for performance
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
  note.color = 'rgb(93, 0, 150)'; // Common color for batching
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

    // Safety check for tab switching (large dt)
    if (dt > 0.1) {
        requestAnimationFrame(loop);
        return;
    }

    // 1. UPDATE STATE (Math)
    updatePhysics(dt);

    // 2. RENDER (Art)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Common styles
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 2;

    // A. Render Falling Notes
    if (fallingNotes.length > 0) {
        // Optimization: Set color once for all falling notes (purple)
        ctx.fillStyle = 'rgb(93, 0, 150)'; 
        
        ctx.beginPath(); // Batch path for stroke optimization if they don't overlap
        for (let i = 0; i < fallingNotes.length; i++) {
            const note = fallingNotes[i];
            // OPTIMIZATION: Bitwise OR 0 for integer coords
            ctx.roundRect(note.x | 0, (note.drawY | 0), note.width | 0, note.height | 0, 4);
        }
        ctx.fill();
        ctx.stroke(); 
    }

    // B. Render Manual Notes (Rising)
    // These might have different colors (Left/Right hand), so we group by color or draw individually
    for (let i = 0; i < visualNotes.length; i++) {
        const note = visualNotes[i];
        ctx.fillStyle = note.color; // State change required per note here
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
    const currentAudioTime = Tone.now(); 
    const pixelsPerSecond = canvas.height / FALL_DURATION;

    // 1. PLAYBACK LOGIC
    if (isPlaying) {
        // Spawn
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

        // Move & Cull
        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            const timeRemaining = note.targetTime - currentAudioTime;
            
            // Calculate Y based on time
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;

            if (note.drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
            }
        }
    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    // 2. MANUAL NOTES LOGIC
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

// --- PLAYBACK ENGINE ---

function startPlayback() {
  if (recordedEvents.length === 0) return;
  isPlaying = true;
  updateUI();
  hideBoard(); 

  currentPlaybackEvents = processRecordedEvents();
  nextEventIndex = 0;
  visualEventIndex = 0;
  
  const now = Tone.now();
  playbackStartTime = now + FALL_DURATION + 0.5; 
  
  if(isMetronomeOn) {
      Tone.Transport.start();
      metroLoop.start(playbackStartTime); 
  }
  
  schedulerLoop();
}

function stopPlayback() {
  isPlaying = false;
  if (schedulerTimer) clearTimeout(schedulerTimer);
  Tone.Transport.stop(); 
  metroLoop.stop();
  
  recycleAllNotes(); 
  showBoard(); 
  clearAllHighlights(); 
  updateUI();
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

function schedulerLoop() {
    if (!isPlaying) return;

    const scheduleAheadTime = 0.1; 
    const currentContextTime = Tone.now();
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const absolutePlayTime = playbackStartTime + event.time;

        if (absolutePlayTime < currentContextTime + scheduleAheadTime) {
            // 1. Audio
            triggerSound(event.freq, absolutePlayTime);

            // 2. UI Highlight & Particles
            Tone.Draw.schedule(() => {
                highlightKey(event.freq);
                if(keyCoordinates[event.freq.toFixed(2)]) {
                    const k = keyCoordinates[event.freq.toFixed(2)];
                    createParticles(k.x + k.width/2, canvas.height, '#4a0094');
                }
            }, absolutePlayTime);

            Tone.Draw.schedule(() => {
                unhighlightKey(event.freq);
            }, absolutePlayTime + event.duration);

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