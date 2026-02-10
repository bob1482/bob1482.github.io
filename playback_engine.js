// ==========================================
// PLAYBACK ENGINE: Scheduler & Time
// ==========================================

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
  seekedWhilePaused = false; // Reset flag on fresh playback
  
  if (typeof hideBoard === 'function') hideBoard(); 

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
  // Start playing immediately (visuals fall from top, so they spawn 'in past' virtually)
  playbackStartTime = now + FALL_DURATION; 
  
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
  if (typeof showBoard === 'function') showBoard(); 
  if (typeof clearAllHighlights === 'function') clearAllHighlights(); 
  
  // Reset Progress Bar
  const bar = document.getElementById('progress-bar');
  if(bar) bar.value = 0;
  
  if (typeof updateUI === 'function') updateUI();
}

function setVisualizerPause(paused) {
    if (paused) {
        pauseStartTimestamp = Tone.now();
        seekedWhilePaused = false; // Reset the flag when pausing
        if(schedulerTimer) clearTimeout(schedulerTimer);
        Tone.Transport.pause();
    } else {
        const now = Tone.now();
        const diff = now - pauseStartTimestamp;
        
        // Only shift notes and accumulate pause time if we didn't seek while paused
        if (!seekedWhilePaused) {
            totalPausedTime += diff; // Accumulate pause duration
            
            // Shift falling note targets so they don't jump
            fallingNotes.forEach(n => {
                n.targetTime += diff;
            });
        }
        
        seekedWhilePaused = false; // Reset flag after unpausing

        if(isMetronomeOn) Tone.Transport.start();
        schedulerLoop();
    }
}

function seekToTime(percent) {
    if (!isPlaying) return;
    
    // 1. Calculate new time target in seconds
    const targetSeconds = (percent / 100) * playbackTotalDuration;
    
    // 2. Clear existing visuals
    if (typeof recycleAllNotes === 'function') recycleAllNotes();
    
    // 3. Reset Time Base
    // We adjust playbackStartTime so that 'now' corresponds to 'targetSeconds'
    const now = Tone.now();
    totalPausedTime = 0; 
    playbackStartTime = now - targetSeconds;
    
    // If we're paused, update the pause timestamp so unpause timing is correct
    if (isPaused) {
        pauseStartTimestamp = now;
        seekedWhilePaused = true; // Mark that we seeked during pause
    }

    // 4. Find Audio Index (Next event to play sound)
    nextEventIndex = 0;
    // Fast-forward audio index to targetSeconds
    while(nextEventIndex < currentPlaybackEvents.length && currentPlaybackEvents[nextEventIndex].time < targetSeconds) {
        nextEventIndex++;
    }
    
    // 5. Visuals: Backfill Logic
    // We need to populate 'fallingNotes' with notes that are currently "mid-fall".
    // A note is mid-fall if it spawned in the past (time - FALL_DURATION < targetSeconds)
    // BUT hits in the future (time > targetSeconds).
    
    visualEventIndex = 0;
    
    for (let i = 0; i < currentPlaybackEvents.length; i++) {
        const evt = currentPlaybackEvents[i];
        const spawnTimeRel = evt.time - FALL_DURATION; // Song time when it appears at top
        
        if (spawnTimeRel > targetSeconds) {
            // This note spawns in the future. 
            // This is where our spawner loop should start next frame.
            visualEventIndex = i;
            break;
        }
        
        // If we are here, the note has conceptually "spawned" already.
        // Check if it should be visible on screen (hasn't hit bottom yet).
        if (evt.time > targetSeconds) {
            // It spawned, but hits later. It belongs on screen now.
            const hitTimeAbs = playbackStartTime + evt.time; // Absolute system time
            spawnFallingNote(evt.freq, evt.duration, hitTimeAbs);
        }
        
        // Handle end of list case
        if (i === currentPlaybackEvents.length - 1) {
            visualEventIndex = currentPlaybackEvents.length;
        }
    }
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
    
    while (nextEventIndex < currentPlaybackEvents.length) {
        const event = currentPlaybackEvents[nextEventIndex];
        const triggerTime = playbackStartTime + event.time + totalPausedTime;

        if (triggerTime < currentContextTime + scheduleAheadTime) {
            
            // 1. Audio
            if (typeof triggerSound === 'function') triggerSound(event.freq, triggerTime);

            // 2. UI Highlight
            Tone.Draw.schedule(() => {
                if (typeof highlightKey === 'function') highlightKey(event.freq);
            }, triggerTime);

            Tone.Draw.schedule(() => {
                if (typeof unhighlightKey === 'function') unhighlightKey(event.freq);
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