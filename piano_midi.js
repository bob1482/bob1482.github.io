// ==========================================
// PIANO MIDI: Devices & Files
// ==========================================

let midiInitialized = false;

// --- WEB MIDI API (ON DEMAND) ---
function initMidiAccess() {
    if (midiInitialized) return; // Prevent multiple requests
    
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }
}

function onMIDISuccess(midiAccess) {
    midiInitialized = true;
    const inputs = midiAccess.inputs.values();
    for (let input of inputs) {
        input.onmidimessage = getMIDIMessage;
    }
    
    // Listen for new devices plugging in after init
    midiAccess.onstatechange = (e) => {
        if (e.port.type === "input" && e.port.state === "connected") {
            e.port.onmidimessage = getMIDIMessage;
        }
    };
    
    console.log("MIDI Devices Connected");
}

function onMIDIFailure() {
    console.log("Could not access your MIDI devices.");
}

function getMIDIMessage(message) {
    const command = message.data[0];
    const note = message.data[1];
    const velocity = (message.data.length > 2) ? message.data[2] : 0; 
    
    // Check if midiToFreq exists (helper from core)
    if (typeof midiToFreq !== 'function') return;
    const freq = midiToFreq(note);

    // 144 = Note On, 128 = Note Off
    if (command === 144 && velocity > 0) {
        if(typeof pressNote === 'function') pressNote(freq);
    }
    else if (command === 128 || (command === 144 && velocity === 0)) {
        if(typeof releaseNote === 'function') releaseNote(freq);
    }
}


// ==========================================
// DRAG AND DROP MIDI HANDLER
// ==========================================

const dropZone = document.getElementById('drop-zone');

if (dropZone) {
    window.addEventListener('dragenter', (e) => { 
        e.preventDefault(); 
        dropZone.classList.add('active'); 
    });

    window.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
    });

    dropZone.addEventListener('dragleave', (e) => { 
        e.preventDefault(); 
        dropZone.classList.remove('active'); 
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');

        // --- NEW: Request MIDI Permission only on drop ---
        // This stops the browser from nagging the user on page load
        initMidiAccess(); 

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
                loadMidiFile(file);
            } else {
                console.warn("Not a MIDI file.");
            }
        }
    });
}

function loadMidiFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const midiData = new Midi(e.target.result);
        convertMidiToEvents(midiData);
    };
    reader.readAsArrayBuffer(file);
}

function convertMidiToEvents(midiData) {
    // Access global variables from piano_core.js
    if (typeof stopPlayback === 'function' && isPlaying) stopPlayback();
    
    // We modify the global recordedEvents array
    recordedEvents.length = 0; // Clear array
    isRecording = false;

    midiData.tracks.forEach(track => {
        track.notes.forEach(note => {
            // MIDI 48 = C3. Adjust offset based on BASE_NOTE_FREQ (C3)
            const semitoneOffset = note.midi - 48; 
            const freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);
            
            recordedEvents.push({ type: 'on', freq: freq, time: note.time });
            recordedEvents.push({ type: 'off', freq: freq, time: note.time + note.duration });
        });
    });

    recordedEvents.sort((a, b) => a.time - b.time);
    console.log(`MIDI Loaded: ${recordedEvents.length / 2} notes imported.`);
    
    if (typeof startPlayback === 'function') startPlayback();
    if (typeof updateUI === 'function') updateUI();
}

// ==========================================
// MIDI EXPORT
// ==========================================

function downloadCurrentMidi() {
    let eventsToExport = [];
    let exportName = "wicki_recording.mid";

    // Determine what to export (saved recording or raw unsaved buffer)
    if (currentRecordingIndex >= 0 && currentRecordingIndex < recordingsList.length) {
        eventsToExport = recordingsList[currentRecordingIndex].events;
        exportName = recordingsList[currentRecordingIndex].name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".mid";
    } else if (recordedEvents.length > 0) {
        eventsToExport = recordedEvents;
    } else {
        alert("No recording to download!");
        return;
    }

    // Process raw on/off events into discrete notes with durations
    let active = {};
    let processedNotes = [];
    let sortedEvents = [...eventsToExport].sort((a, b) => a.time - b.time);

    sortedEvents.forEach(evt => {
        if (evt.type === 'on') {
            active[evt.freq] = { ...evt, duration: 0.5 }; // Clone and set default duration
            processedNotes.push(active[evt.freq]);
        } else if (evt.type === 'off') {
            if (active[evt.freq]) {
                active[evt.freq].duration = evt.time - active[evt.freq].time;
                delete active[evt.freq];
            }
        }
    });

    // Initialize @tonejs/midi object
    const midi = new Midi();
    const track = midi.addTrack();

    // Populate track with notes
    processedNotes.forEach(noteEvent => {
        // Convert frequency to MIDI note number
        const midiNote = Math.round(69 + 12 * Math.log2(noteEvent.freq / 440));
        
        track.addNote({
            midi: midiNote,
            time: noteEvent.time,
            duration: noteEvent.duration,
            velocity: 0.8 
        });
    });

    // Create a Blob and trigger download
    const midiData = midi.toArray();
    const blob = new Blob([midiData], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = exportName;
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up DOM and memory
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}