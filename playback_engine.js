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
    
    // 1. Pause the scheduler and cancel upcoming audio/visuals to prevent distortion
    if (schedulerTimer) clearTimeout(schedulerTimer);
    if (typeof sampler !== 'undefined') sampler.releaseAll();
    activeVoices = []; // Clear polyphony tracker
    Tone.Draw.cancel(0);
    
    // Clear any currently active visual highlights when jumping around the timeline
    document.querySelectorAll('.active').forEach(key => key.classList.remove('active'));
    
    // 2. Calculate new time target in seconds
    const targetSeconds = (percent / 100) * playbackTotalDuration;
    
    // 3. Clear existing visuals
    if (typeof recycleAllNotes === 'function') recycleAllNotes();
    
    // 4. Reset Time Base
    const now = Tone.now();
    totalPausedTime = 0; 
    playbackStartTime = now - targetSeconds;
    
    // If we're paused, update the pause timestamp so unpause timing is correct
    if (isPaused) {
        pauseStartTimestamp = now;
        // The seekedWhilePaused flag has been intentionally removed
    }

    // 5. Find Audio Index (Next event to play sound)
    nextEventIndex = 0;
    while(nextEventIndex < currentPlaybackEvents.length && currentPlaybackEvents[nextEventIndex].time < targetSeconds) {
        nextEventIndex++;
    }
    
    // 6. Visuals: Backfill Logic
    visualEventIndex = 0;
    
    for (let i = 0; i < currentPlaybackEvents.length; i++) {
        const evt = currentPlaybackEvents[i];
        const spawnTimeRel = evt.time - FALL_DURATION; 
        
        if (spawnTimeRel > targetSeconds) {
            visualEventIndex = i;
            break;
        }
        
        if (evt.time > targetSeconds) {
            const hitTimeAbs = playbackStartTime + evt.time; 
            spawnFallingNote(evt.freq, evt.duration, hitTimeAbs);
        }
        
        if (i === currentPlaybackEvents.length - 1) {
            visualEventIndex = currentPlaybackEvents.length;
        }
    }
    
    // 7. Restart scheduler if we are not paused
    if (!isPaused) {
        schedulerLoop();
    }
}

function processRecordedEvents() {
    let active = {};
    let processed = [];
    let sorted = [...recordedEvents].sort((a, b) => a.time - b.time);

    sorted.forEach(evt => {
        if (evt.type === 'on') {
            // Create a new object to apply playback rate without mutating the original recording
            const newEvt = { 
                type: 'on', 
                freq: evt.freq, 
                time: evt.time / playbackRate, 
                duration: 0.5 / playbackRate 
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

function changePlaybackSpeed(delta) {
    playbackRate += delta;
    
    // Clamp speed between 0.25x (25%) and 3.0x (300%)
    if (playbackRate < 0.25) playbackRate = 0.25;
    if (playbackRate > 3.0) playbackRate = 3.0;

    console.log(`Playback Speed: ${playbackRate.toFixed(2)}x`);

    if (isPlaying) {
        // Save the current elapsed percentage so we don't lose our place
        const currentAudioTime = Tone.now();
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