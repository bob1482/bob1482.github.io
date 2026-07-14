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
    if (typeof stopPlayback === 'function' && isPlaying) stopPlayback();

    // Clear any existing events in the playback engine
    if (typeof currentPlaybackEvents !== 'undefined') {
        currentPlaybackEvents.length = 0;
    }

    let trackCounter = 0;
    let events = [];

    midiData.tracks.forEach((track) => {
        if (track.notes.length === 0) return;

        track.notes.forEach(note => {
            const semitoneOffset = note.midi - 48; 
            const freq = BASE_NOTE_FREQ * Math.pow(2, semitoneOffset / 12);

            events.push({
                type: 'on',
                freq: freq,
                time: note.time,
                duration: note.duration,
                trackIndex: trackCounter
            });
        });

        trackCounter++;
    });

    events.sort((a, b) => a.time - b.time);
    console.log(`MIDI Loaded: ${events.length} notes imported across ${trackCounter} tracks.`);
    
    // Set the events on the playback engine
    if (typeof currentPlaybackEvents !== 'undefined') {
        // Store raw events in the format expected by the playback engine
        // The playback engine will use `currentPlaybackEvents` directly
        currentPlaybackEvents.splice(0, currentPlaybackEvents.length, ...events);
    }
    
    // Preserve a copy of the raw (unprocessed) events for idempotent reprocessing
    if (typeof rawPlaybackEvents !== 'undefined') {
        rawPlaybackEvents.splice(0, rawPlaybackEvents.length, ...events.map(e => ({...e})));
    }
    
    if (typeof startPlayback === 'function') startPlayback();
    if (typeof updateUI === 'function') updateUI();
}

// ==========================================
// STANDARD MIDI UPLOAD HANDLER
// ==========================================

function handleMidiUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    initMidiAccess();

    if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
        loadMidiFile(file);
    } else {
        console.warn("Not a valid MIDI file.");
        alert("Please select a valid .mid or .midi file.");
    }

    event.target.value = "";
}