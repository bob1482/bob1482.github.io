// ==========================================
// VISUAL STATE: Data, Pools, Physics
// ==========================================

// --- GLOBAL STATE CONTAINERS ---
let keyCoordinates = {}; 
let notePool = [];      
let visualNotes = [];   // Manual rising notes
let fallingNotes = [];  // Playback falling notes
// Particles removed

// --- Visualizer State ---
let isVisualizerOn = true;

// --- SETTINGS ---
const FALL_DURATION = 2.0;       
const MANUAL_RISE_SPEED_PPS = 100; 

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
}

// Particle system removed

// --- LOGIC HELPERS ---
function spawnFallingNote(freqStr, duration, targetTime) {
  // Requires canvas to be accessible globally or via window
  const canvas = document.getElementById("synthesia-canvas");
  if (!canvas) return;

  if (Object.keys(keyCoordinates).length === 0 && typeof updateKeyCoordinates === 'function') {
      updateKeyCoordinates();
  }
  
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
  const canvas = document.getElementById("synthesia-canvas");
  if (!canvas) return;

  if (Object.keys(keyCoordinates).length === 0 && typeof updateKeyCoordinates === 'function') {
      updateKeyCoordinates();
  }
  
  const coords = keyCoordinates[freqStr];
  if (!coords) return;

  // Prevent duplicates
  for(let i=0; i<visualNotes.length; i++) {
      if(visualNotes[i].freq === freqStr && visualNotes[i].active) return;
  }

  // Particle creation removed

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

// --- PHYSICS UPDATE LOOP ---
function updatePhysics(dt) {
    const canvas = document.getElementById("synthesia-canvas");
    if (!canvas) return;

    // 1. Determine the "current time". If paused, use the exact moment we paused/scrubbed to.
    const currentAudioTime = isPaused ? pauseStartTimestamp : Tone.now();
    const effectiveTime = currentAudioTime - totalPausedTime;

    const pixelsPerSecond = canvas.height / FALL_DURATION;

    // 2. PLAYBACK LOGIC
    if (isPlaying) {
        // Only continuously spawn new falling notes if actively playing
        if (!isPaused) {
            while(visualEventIndex < currentPlaybackEvents.length) {
                const evt = currentPlaybackEvents[visualEventIndex];
                const hitTime = playbackStartTime + evt.time + totalPausedTime;
                const spawnTime = hitTime - FALL_DURATION;
                
                if (currentAudioTime >= spawnTime) {
                    spawnFallingNote(evt.freq, evt.duration, hitTime);
                    visualEventIndex++;
                } else {
                    break; 
                }
            }
        }

        // ALWAYS calculate positions so scrubbing while paused updates the screen instantly
        for (let i = fallingNotes.length - 1; i >= 0; i--) {
            const note = fallingNotes[i];
            const timeRemaining = note.targetTime - currentAudioTime;
            
            const y = canvas.height - (timeRemaining * pixelsPerSecond);
            note.drawY = y - note.height;

            // Only delete notes if we are actively playing and they fall off screen
            if (!isPaused && note.drawY > canvas.height) {
                recycleNote(note);
                fallingNotes.splice(i, 1);
            }
        }
        
        // Update Progress Bar if actively playing
        if (!isPaused) {
            const elapsed = (effectiveTime - playbackStartTime);
            if (playbackTotalDuration > 0) {
                const pct = (elapsed / playbackTotalDuration) * 100;
                const bar = document.getElementById('progress-bar');
                if (bar) bar.value = Math.min(pct, 100);
            }
        }

    } else {
        if(fallingNotes.length > 0) recycleAllNotes();
    }

    // 3. MANUAL NOTES LOGIC (Unfrozen during pause)
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
}

