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

function startPlayback() {
  if (recordedEvents.length === 0) return;
  isPlaying = true;
  isPaused = false;
  totalPausedTime = 0;
  
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
    if (typeof recycleAllNotes === 'function') recycleAllNotes();
    
    // 3. Reset Time Base
    const now = Tone.now();
    totalPausedTime = 0; 
    playbackStartTime = now - targetSeconds + FALL_DURATION;

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
    
    // Sync visual index
    visualEventIndex = nextEventIndex;
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
                
                // Particle creation removed
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