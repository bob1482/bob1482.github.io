// ==========================================
// PIANO VISUALIZER: Engine, Canvas, Scheduler
// ==========================================

// --- CANVAS SETUP ---
const canvas = document.getElementById("synthesia-canvas");
const ctx = canvas.getContext("2d");

// --- STATE & POOLS ---
let keyCoordinates = {}; 
let notePool = [];      
let visualNotes = [];   // Manual rising notes
let fallingNotes = [];  // Playback falling notes
let particles = [];     // Explosion particles

// --- SETTINGS (TIME-BASED) ---
const FALL_DURATION = 2.0;       // Seconds for falling notes to reach bottom
const MANUAL_RISE_SPEED_PPS = 250; // Pixels Per Second (Manual notes rising speed)
const PARTICLE_DECAY_RATE = 1.5; // Life lost per second (1.0 = 1 second life)

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

window.addEventListener('resize', resizeCanvas);

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
    keyCoordinates[freq] = { x: rect.left, width: rect.width };
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
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x + (Math.random() * 40 - 20),
            y: y,
            vx: (Math.random() - 0.5) * 150, // Velocity in pixels per second
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

// --- THE VISUAL LOOP (View Layer) ---
function startVisualizerLoop() {
  let lastFrameTime = performance.now();

  // Pre-define border style to save string parsing in loop (optional, but good practice)
  const borderStyle = "rgba(255, 255, 255, 0.7)"; 

  function loop(currentTime) {
    // 0. Calculate Delta Time (Seconds passed since last frame)
    const dt = (currentTime - lastFrameTime) / 1000;
    lastFrameTime = currentTime;

    // Safety check for huge delta (e.g., user switched tabs)
    if (dt > 0.1) {
        requestAnimationFrame(loop);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set common styles for this frame to minimize state changes
    ctx.strokeStyle = borderStyle;
    ctx.lineWidth = 2;

    const currentAudioTime = Tone.now(); 

    // 1. PLAYBACK: Spawn Falling Notes
    if (isPlaying) {
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

        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            const timeRemaining = note.targetTime - currentAudioTime;
            const pixelsPerSecond = canvas.height / FALL_DURATION;
            
            // Calculate Y based on time, not frame steps
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            const drawY = y - note.height;

            if (drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
                continue;
            }

            // --- OPTIMIZED DRAWING: NO GRADIENT ---
            ctx.fillStyle = note.color;
            ctx.beginPath();
            ctx.roundRect(note.x, drawY, note.width, note.height, 4);
            ctx.fill();
            ctx.stroke(); // Draws the bright border
        }
    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    // 2. MANUAL: Render Rising Notes
    for (let i = visualNotes.length - 1; i >= 0; i--) {
        const note = visualNotes[i];
        
        // Use dt to ensure speed is pixels per second, not per frame
        if (note.active) {
            note.height += MANUAL_RISE_SPEED_PPS * dt;
            note.y = canvas.height - note.height;
        } else {
            note.y -= MANUAL_RISE_SPEED_PPS * dt;
        }

        if (note.y + note.height < -50) {
            recycleNote(note);
            visualNotes.splice(i, 1);
            continue;
        }
        
        // --- OPTIMIZED DRAWING: NO GRADIENT ---
        ctx.fillStyle = note.color;
        ctx.beginPath();
        ctx.roundRect(note.x, note.y, note.width, note.height, 7);
        ctx.fill();
        ctx.stroke(); // Draws the bright border
    }
    
    // 3. RENDER PARTICLES
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= PARTICLE_DECAY_RATE * dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
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