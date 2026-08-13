// ==========================================
// PIANO MIDI: Devices, Messages & Files
// ==========================================

let midiAccessObj = null;
let midiInitialized = false;
let midiStatusMessage = "Not Initialized";

// --- WEB MIDI API ACCESS & LISTENERS ---
function initMidiAccess() {
    if (midiInitialized) {
        updateMidiInputListeners();
        return;
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: false })
            .then(onMIDISuccess, onMIDIFailure);
    } else {
        midiStatusMessage = "Not Supported";
        console.warn("Web MIDI API is not supported in this browser.");
        if (typeof updateUI === 'function') updateUI();
    }
}

function onMIDISuccess(midiAccess) {
    midiAccessObj = midiAccess;
    midiInitialized = true;
    midiStatusMessage = "Connected";

    updateMidiInputListeners();

    // Listen for new devices plugging in or unplugging after init
    midiAccessObj.onstatechange = (e) => {
        if (e.port.type === "input") {
            updateMidiInputListeners();
            dispatchMidiDevicesChanged();
            if (typeof updateUI === 'function') updateUI();
        }
    };

    console.log("Web MIDI Access Granted");
    dispatchMidiDevicesChanged();
    if (typeof updateUI === 'function') updateUI();
}

function onMIDIFailure(err) {
    midiInitialized = false;
    midiStatusMessage = "Access Denied";
    console.warn("Could not access your MIDI devices:", err);
    if (typeof updateUI === 'function') updateUI();
}

function updateMidiInputListeners() {
    if (!midiAccessObj) return;
    const inputs = midiAccessObj.inputs.values();
    for (let input of inputs) {
        input.onmidimessage = getMIDIMessage;
    }
}

function getMidiInputDevices() {
    if (!midiAccessObj) return [];
    const devices = [];
    const inputs = midiAccessObj.inputs.values();
    for (let input of inputs) {
        devices.push({
            id: input.id,
            name: input.name || `MIDI Device (${input.id})`,
            manufacturer: input.manufacturer || '',
            state: input.state
        });
    }
    return devices;
}

function dispatchMidiDevicesChanged() {
    window.dispatchEvent(new CustomEvent('midiDevicesChanged', {
        detail: getMidiInputDevices()
    }));
}

let activeMidiNotes = {};

function getMIDIMessage(message) {
    if (!message || !message.data || message.data.length < 2) return;

    // Filter by selected MIDI Input Device
    const targetPort = message.target;
    if (typeof selectedMidiDevice !== 'undefined' && selectedMidiDevice !== 'all') {
        if (targetPort && targetPort.id !== selectedMidiDevice) return;
    }

    const command = message.data[0];
    const status = command & 0xF0;
    const channel = (command & 0x0F) + 1; // 1-16

    // Filter by selected MIDI Channel
    if (typeof selectedMidiChannel !== 'undefined' && selectedMidiChannel !== 'all') {
        if (parseInt(selectedMidiChannel, 10) !== channel) return;
    }

    const note = message.data[1];
    const velocity = (message.data.length > 2) ? message.data[2] : 0;

    // Check helper from core
    if (typeof midiToFreq !== 'function') return;

    const midiKey = `${channel}_${note}`;
    const keyId = `midi_${midiKey}`;
    const currentTranspose = (typeof transpose !== 'undefined') ? transpose : 0;

    // 0x90 = Note On, 0x80 = Note Off
    if (status === 0x90 && velocity > 0) {
        const transposedNote = note + currentTranspose;
        const freq = midiToFreq(transposedNote);
        activeMidiNotes[midiKey] = { freq: freq, channel: channel, keyId: keyId };
        if (typeof pressNote === 'function') pressNote(freq, false, null, velocity, channel, keyId);
    }
    else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        let freq;
        if (activeMidiNotes[midiKey] !== undefined) {
            freq = typeof activeMidiNotes[midiKey] === 'object' ? activeMidiNotes[midiKey].freq : activeMidiNotes[midiKey];
            delete activeMidiNotes[midiKey];
        } else {
            freq = midiToFreq(note + currentTranspose);
        }
        if (typeof releaseNote === 'function') releaseNote(freq, false, null, channel, keyId);
    }
    // 0xB0 = Control Change (CC)
    else if (status === 0xB0) {
        const ccNumber = message.data[1];
        const ccValue = (message.data.length > 2) ? message.data[2] : 0;

        // CC 64 = Sustain Pedal
        if (ccNumber === 64) {
            if (ccValue >= 64) {
                // Pedal Pressed
                if (typeof sustainMode !== 'undefined' && sustainMode !== 0) {
                    previousSustainMode = sustainMode;
                    sustainMode = 0;
                    if (typeof updateUI === 'function') updateUI();
                }
            } else {
                // Pedal Released
                if (typeof sustainMode !== 'undefined' && sustainMode === 0) {
                    sustainMode = 1;
                    if (typeof updateUI === 'function') updateUI();
                    if (typeof clearTimedSustainTrackers === 'function') {
                        clearTimedSustainTrackers();
                    } else if (typeof stopAllAudio === 'function') {
                        stopAllAudio();
                    }
                }
            }
        }
        // CC 120 / 123 = All Sound / Notes Off (Panic)
        else if (ccNumber === 120 || ccNumber === 123) {
            if (typeof releaseAllStuckNotes === 'function') releaseAllStuckNotes();
        }
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

        // Request MIDI Permission on drop if not already init
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
    reader.onload = function (e) {
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
        currentPlaybackEvents.splice(0, currentPlaybackEvents.length, ...events);
    }

    // Preserve a copy of the raw (unprocessed) events for idempotent reprocessing
    if (typeof rawPlaybackEvents !== 'undefined') {
        rawPlaybackEvents.splice(0, rawPlaybackEvents.length, ...events.map(e => ({ ...e })));
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

// Auto-connect on page load if permitted / requested
window.addEventListener('DOMContentLoaded', () => {
    if (typeof autoConnectMidi !== 'undefined' && autoConnectMidi) {
        initMidiAccess();
    }
});