// ==========================================
// PIANO MIDI: Devices & Files
// ==========================================

// --- WEB MIDI API ---
if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
}

function onMIDISuccess(midiAccess) {
    const inputs = midiAccess.inputs.values();
    for (let input of inputs) {
        input.onmidimessage = getMIDIMessage;
    }
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
    // Note: recordedEvents is a global variable from piano_core.js
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