import { Midi } from '@tonejs/midi';
import { SustainMode } from './settings';
import { MidiSong, ParsedMidiNote } from './midiEngine';

export interface RecordedNote {
  midi: number;
  time: number; // seconds from recording start
  duration: number; // seconds
  velocity: number; // 0.0 to 1.0
}

export interface RecordedCC {
  number: number;
  value: number; // 0.0 to 1.0
  time: number; // seconds from recording start
}

export interface RecordingSession {
  id: string;
  title: string;
  createdAt: Date;
  duration: number; // seconds
  notes: RecordedNote[];
  ccs: RecordedCC[];
  bpm: number;
}

interface ActiveNoteInfo {
  midi: number;
  startTime: number;
  velocity: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export class MidiRecorder {
  private isRecording: boolean = false;
  private startTime: number = 0;
  private recordedNotes: RecordedNote[] = [];
  private activeNotes: Map<string, ActiveNoteInfo> = new Map();
  private recordedCCs: RecordedCC[] = [];
  private currentBpm: number = 120;
  private timerInterval: NodeJS.Timeout | null = null;
  private onDurationChange?: (duration: number) => void;

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getRecordedNotesCount(): number {
    return this.recordedNotes.length + this.activeNotes.size;
  }

  public start(
    initialSustain: SustainMode = 'off',
    bpm: number = 120,
    onDurationChange?: (duration: number) => void
  ): void {
    if (this.isRecording) {
      this.stop();
    }

    this.isRecording = true;
    this.startTime = performance.now();
    this.recordedNotes = [];
    this.activeNotes.clear();
    this.recordedCCs = [];
    this.currentBpm = bpm;
    this.onDurationChange = onDurationChange;

    // Record initial sustain pedal state if pressed
    if (initialSustain === 'full') {
      this.recordedCCs.push({ number: 64, value: 1.0, time: 0 });
    } else if (initialSustain === 'half') {
      this.recordedCCs.push({ number: 64, value: 0.5, time: 0 });
    }

    // Start interval to notify duration updates every 100ms
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.isRecording && this.onDurationChange) {
        const elapsed = (performance.now() - this.startTime) / 1000;
        this.onDurationChange(elapsed);
      }
    }, 100);
  }

  public recordNoteOn(midi: number, velocity: number = 0.85, inputId?: string): void {
    if (!this.isRecording) return;
    const time = Math.max(0, (performance.now() - this.startTime) / 1000);
    const key = inputId || `midi_${midi}`;

    // If note is already active with this key, close it first
    const existing = this.activeNotes.get(key);
    if (existing) {
      const duration = Math.max(0.05, time - existing.startTime);
      this.recordedNotes.push({
        midi: existing.midi,
        time: existing.startTime,
        duration,
        velocity: existing.velocity,
      });
      this.activeNotes.delete(key);
    }

    this.activeNotes.set(key, {
      midi,
      startTime: time,
      velocity: Math.max(0.05, Math.min(1.0, velocity)),
    });
  }

  public recordNoteOff(midi: number, inputId?: string): void {
    if (!this.isRecording) return;
    const time = Math.max(0, (performance.now() - this.startTime) / 1000);

    let keyToClose: string | null = null;
    let noteToClose: ActiveNoteInfo | null = null;

    if (inputId && this.activeNotes.has(inputId)) {
      keyToClose = inputId;
      noteToClose = this.activeNotes.get(inputId)!;
    } else {
      // Find matching note by midi pitch
      for (const [key, active] of this.activeNotes.entries()) {
        if (active.midi === midi) {
          keyToClose = key;
          noteToClose = active;
          break;
        }
      }
    }

    if (keyToClose && noteToClose) {
      const duration = Math.max(0.05, time - noteToClose.startTime);
      this.recordedNotes.push({
        midi: noteToClose.midi,
        time: noteToClose.startTime,
        duration,
        velocity: noteToClose.velocity,
      });
      this.activeNotes.delete(keyToClose);
    }
  }

  public recordSustain(mode: SustainMode): void {
    if (!this.isRecording) return;
    const time = Math.max(0, (performance.now() - this.startTime) / 1000);
    const value = mode === 'full' ? 1.0 : mode === 'half' ? 0.5 : 0.0;
    this.recordedCCs.push({
      number: 64,
      value,
      time,
    });
  }

  public stop(): RecordingSession | null {
    if (!this.isRecording) return null;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const stopTime = Math.max(0.1, (performance.now() - this.startTime) / 1000);

    // Finalize any lingering active notes
    for (const active of this.activeNotes.values()) {
      const duration = Math.max(0.05, stopTime - active.startTime);
      this.recordedNotes.push({
        midi: active.midi,
        time: active.startTime,
        duration,
        velocity: active.velocity,
      });
    }
    this.activeNotes.clear();

    this.isRecording = false;

    // Sort notes chronologically
    this.recordedNotes.sort((a, b) => a.time - b.time);
    this.recordedCCs.sort((a, b) => a.time - b.time);

    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const session: RecordingSession = {
      id: `rec-${Date.now()}`,
      title: `Recording ${dateStr}`,
      createdAt: now,
      duration: stopTime,
      notes: [...this.recordedNotes],
      ccs: [...this.recordedCCs],
      bpm: this.currentBpm,
    };

    return session;
  }

  public cancel(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRecording = false;
    this.activeNotes.clear();
    this.recordedNotes = [];
    this.recordedCCs = [];
  }

  /**
   * Export the recorded session to a standard MIDI binary array
   */
  public exportToMidi(session: RecordingSession, customTitle?: string): Uint8Array {
    const midi = new Midi();
    const title = customTitle || session.title;
    midi.name = title;

    if (session.bpm && session.bpm > 0) {
      midi.header.setTempo(session.bpm);
    }

    const track = midi.addTrack();
    track.name = 'Piano';
    track.channel = 0;

    // Add Control Changes (e.g. Sustain CC64)
    for (const cc of session.ccs) {
      track.addCC({
        number: cc.number,
        value: Math.max(0, Math.min(1.0, cc.value)),
        time: Math.max(0, cc.time),
      });
    }

    // Add Notes
    for (const note of session.notes) {
      track.addNote({
        midi: note.midi,
        time: Math.max(0, note.time),
        duration: Math.max(0.05, note.duration),
        velocity: Math.max(0.01, Math.min(1.0, note.velocity)),
      });
    }

    return midi.toArray();
  }

  /**
   * Trigger browser file download of the recorded session as a .mid file
   */
  public downloadMidiFile(session: RecordingSession, fileName?: string): void {
    const bytes = this.exportToMidi(session, fileName);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    
    let resolvedName = (fileName || session.title || 'recording').trim();
    if (!resolvedName.endsWith('.mid') && !resolvedName.endsWith('.midi')) {
      resolvedName += '.mid';
    }
    // Clean invalid characters for filename
    resolvedName = resolvedName.replace(/[/\\?%*:|"<>]/g, '-');

    const a = document.createElement('a');
    a.href = url;
    a.download = resolvedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Convert a recorded session directly to a MidiSong object for playback in the visualizer
   */
  public sessionToMidiSong(session: RecordingSession, customTitle?: string): MidiSong {
    const title = customTitle || session.title;
    const parsedNotes: ParsedMidiNote[] = session.notes.map(note => ({
      midi: note.midi,
      name: getNoteName(note.midi),
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
      trackIndex: 0,
    }));

    return {
      id: session.id,
      title,
      composer: 'User Live Recording',
      duration: Math.max(session.duration, parsedNotes.length > 0 ? parsedNotes[parsedNotes.length - 1].time + parsedNotes[parsedNotes.length - 1].duration : 1),
      notes: parsedNotes,
      bpm: session.bpm,
    };
  }
}

export const midiRecorder = new MidiRecorder();
