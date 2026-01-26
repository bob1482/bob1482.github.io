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
let particles = [];     // NEW: Explosion particles

// SETTINGS
const VISUAL_SPEED = 1.5;      
const FALL_DURATION = 2.0; 

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

// --- NEW: PARTICLE SYSTEM ---
function createParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x + (Math.random() * 40 - 20),
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
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
  note.color = '#9b64b8ff';
  note.targetTime = targetTime;
  note.active = true;

  fallingNotes.push(note);
}

// [piano_visualizer.js]
// Replace the existing startManualVisualNote function with this:

function startManualVisualNote(freqStr, color = '#9b64b8ff') { // Added 'color' param with default
  if (Object.keys(keyCoordinates).length === 0) updateKeyCoordinates();
  const coords = keyCoordinates[freqStr];
  if (!coords) return;

  for(let i=0; i<visualNotes.length; i++) {
      if(visualNotes[i].freq === freqStr && visualNotes[i].active) return;
  }

  // Use the specific color for particles too
  createParticles(coords.x + coords.width / 2, canvas.height, color);

  const note = getNoteFromPool();
  note.freq = freqStr;
  note.x = coords.x;
  note.width = coords.width;
  note.y = canvas.height;
  note.height = 0;
  note.color = color; // Use the passed color
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
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            const drawY = y - note.height;

            if (drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
                continue;
            }

            const grad = ctx.createLinearGradient(note.x, drawY, note.x + note.width, drawY);
            grad.addColorStop(0, note.color);
            grad.addColorStop(0.5, "white"); 
            grad.addColorStop(1, note.color);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(note.x, drawY, note.width, note.height, 4);
            ctx.fill();
        }
    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    // 2. MANUAL: Render Rising Notes
    for (let i = visualNotes.length - 1; i >= 0; i--) {
        const note = visualNotes[i];
        if (note.active) {
            note.height += VISUAL_SPEED;
            note.y = canvas.height - note.height;
        } else {
            note.y -= VISUAL_SPEED;
        }

        if (note.y + note.height < -50) {
            recycleNote(note);
            visualNotes.splice(i, 1);
            continue;
        }
        
        const grad = ctx.createLinearGradient(note.x, note.y, note.x + note.width, note.y);
        grad.addColorStop(0, note.color);
        grad.addColorStop(0.5, "white");
        grad.addColorStop(1, note.color);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(note.x, note.y, note.width, note.height, 4);
        ctx.fill();
    }
    
    // 3. NEW: RENDER PARTICLES
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;

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
  
  // Start metronome if it was enabled
  if(isMetronomeOn) {
      Tone.Transport.start();
      metroLoop.start(playbackStartTime); // Sync metro with playback start
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
                // NEW: Trigger particles on playback note hit
                if(keyCoordinates[event.freq.toFixed(2)]) {
                    const k = keyCoordinates[event.freq.toFixed(2)];
                    createParticles(k.x + k.width/2, canvas.height, '#00ffff');
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