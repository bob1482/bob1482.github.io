'use client';

import React from 'react';
import { Music, Download, Disc3 } from 'lucide-react';
import { RealVoicesBadge } from '../badges/RealVoicesBadge';
import { NpsBadge } from '../badges/NpsBadge';
import { RecordingSession } from '@/lib/midiRecorder';

export interface SongSettingsTabProps {
  inputTranspose?: number;
  onInputTransposeChange?: (transpose: number) => void;
  midiTranspose?: number;
  onMidiTransposeChange?: (transpose: number) => void;
  speedMultiplier: number;
  onSpeedMultiplierChange: (speed: number) => void;
  seekSeconds?: number;
  onSeekSecondsChange?: (seconds: number) => void;
  maxVoices?: number;
  onMaxVoicesChange?: (limit: number) => void;
  recordingSession?: RecordingSession | null;
  onOpenRecordingModal?: () => void;
  onDownloadRecording?: (fileName: string) => void;
}

export const SongSettingsTab: React.FC<SongSettingsTabProps> = React.memo(({
  inputTranspose = 0,
  onInputTransposeChange,
  midiTranspose = 0,
  onMidiTransposeChange,
  speedMultiplier,
  onSpeedMultiplierChange,
  seekSeconds = 5,
  onSeekSecondsChange,
  maxVoices = 64,
  onMaxVoicesChange,
  recordingSession = null,
  onOpenRecordingModal,
  onDownloadRecording,
}) => {
  return (
    <div className="flex flex-col gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
      <span className="font-medium text-zinc-200 flex items-center gap-1.5">
        <Music className="w-3.5 h-3.5 text-zinc-400" /> Song, Transpose &amp; Performance
      </span>

      {/* Recorded Performance & Download */}
      <div className="flex flex-col gap-2 bg-white/[0.03] border border-white/[0.08] p-3 rounded-xl">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-200 font-medium flex items-center gap-1.5 text-xs">
              <Disc3 className="w-3.5 h-3.5 text-rose-400" /> Last Recorded Performance
            </span>
            <span className="text-[10px] text-zinc-400">MIDI capture of your inputs</span>
          </div>
          {recordingSession && (
            <span className="font-mono text-zinc-200 bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.1] text-[10px] font-semibold">
              {recordingSession.notes.length} notes • {Math.floor(recordingSession.duration / 60)}:{(Math.floor(recordingSession.duration % 60)).toString().padStart(2, '0')}
            </span>
          )}
        </div>

        {recordingSession ? (
          <div className="flex items-center gap-2 mt-0.5">
            <button
              type="button"
              onClick={() => {
                if (onDownloadRecording) {
                  onDownloadRecording(recordingSession.title + '.mid');
                } else if (onOpenRecordingModal) {
                  onOpenRecordingModal();
                }
              }}
              className="flex-1 py-2 px-3 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-sky-500/15 active:scale-[0.98] transition cursor-pointer text-xs"
              title="Download Last Recording as .mid file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Last Recording (.mid)</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRecordingModal?.()}
              className="py-2 px-3 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 border border-white/[0.1] rounded-xl text-xs font-medium transition cursor-pointer active:scale-[0.98]"
              title="Open recording details, rename, or play in visualizer"
            >
              Details
            </button>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-xl text-[11px] text-zinc-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
            <span>No recording yet. Click the record button in the HUD to record your inputs.</span>
          </div>
        )}
      </div>

      {/* Keyboard & MIDI Input Transpose */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Transpose (Keyboard &amp; MIDI In)</span>
            <span className="text-[10px] text-zinc-500">Live pitch shift</span>
          </div>
          <span className="font-mono text-zinc-200 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08] text-[11px] font-semibold">
            {inputTranspose > 0 ? `+${inputTranspose}` : inputTranspose} st
          </span>
        </div>
        <input
          type="range"
          min={-36}
          max={36}
          step={1}
          value={inputTranspose}
          onChange={e => onInputTransposeChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-9 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(-36)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === -36 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-3 Octaves (-36 semitones)"
          >
            -36
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(-24)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === -24 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-2 Octaves (-24 semitones)"
          >
            -24
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(Math.max(-36, inputTranspose - 12))}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === -12 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-1 Octave"
          >
            -12
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(Math.max(-36, inputTranspose - 1))}
            className="py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
            title="-1 Semitone"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(0)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === 0 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="Reset to 0"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(Math.min(36, inputTranspose + 1))}
            className="py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
            title="+1 Semitone"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(Math.min(36, inputTranspose + 12))}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === 12 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+1 Octave"
          >
            +12
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(24)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === 24 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+2 Octaves (+24 semitones)"
          >
            +24
          </button>
          <button
            type="button"
            onClick={() => onInputTransposeChange?.(36)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              inputTranspose === 36 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+3 Octaves (+36 semitones)"
          >
            +36
          </button>
        </div>
      </div>

      {/* MIDI File Transpose */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">MIDI File Transpose</span>
            <span className="text-[10px] text-zinc-500">Song Playback &amp; Visuals</span>
          </div>
          <span className="font-mono text-zinc-200 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08] text-[11px] font-semibold">
            {midiTranspose > 0 ? `+${midiTranspose}` : midiTranspose} st
          </span>
        </div>
        <input
          type="range"
          min={-36}
          max={36}
          step={1}
          value={midiTranspose}
          onChange={e => onMidiTransposeChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-9 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(-36)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === -36 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-3 Octaves (-36 semitones)"
          >
            -36
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(-24)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === -24 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-2 Octaves (-24 semitones)"
          >
            -24
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(Math.max(-36, midiTranspose - 12))}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === -12 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="-1 Octave"
          >
            -12
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(Math.max(-36, midiTranspose - 1))}
            className="py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
            title="-1 Semitone"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(0)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === 0 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="Reset to 0"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(Math.min(36, midiTranspose + 1))}
            className="py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] cursor-pointer"
            title="+1 Semitone"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(Math.min(36, midiTranspose + 12))}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === 12 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+1 Octave"
          >
            +12
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(24)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === 24 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+2 Octaves (+24 semitones)"
          >
            +24
          </button>
          <button
            type="button"
            onClick={() => onMidiTransposeChange?.(36)}
            className={`py-1.5 px-0.5 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
              midiTranspose === 36 ? 'bg-white/[0.12] text-white font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="+3 Octaves (+36 semitones)"
          >
            +36
          </button>
        </div>
      </div>

      {/* Playback Speed */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-zinc-300">
          <span className="text-zinc-400 font-medium">Playback Speed</span>
          <span className="font-mono text-zinc-200 font-semibold">{speedMultiplier}x</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[0.5, 0.75, 1.0, 1.25, 1.5].map(spd => (
            <button
              key={spd}
              type="button"
              onClick={() => onSpeedMultiplierChange(spd)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[11px] transition-all cursor-pointer ${
                speedMultiplier === spd
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Rewind & Forward Jump Duration */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Rewind &amp; Forward Step</span>
            <span className="text-[10px] text-zinc-500">Arrow keys (← / →) seek jump</span>
          </div>
          <span className="font-mono text-zinc-200 bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08] text-[11px]">
            {seekSeconds}s
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={seekSeconds}
          onChange={e => onSeekSecondsChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[1, 2, 5, 10].map(sec => (
            <button
              key={sec}
              type="button"
              onClick={() => onSeekSecondsChange?.(sec)}
              title={`Seek ${sec}s per arrow key`}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] cursor-pointer transition-all ${
                seekSeconds === sec
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Max Polyphony */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Max Polyphony</span>
            <span className="text-[10px] text-zinc-500">Voice cap &amp; live active voices</span>
          </div>
          <RealVoicesBadge maxVoices={maxVoices} />
        </div>
        <div className="grid grid-cols-5 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[32, 48, 64, 128, 0].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => onMaxVoicesChange?.(val)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] cursor-pointer ${
                maxVoices === val
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
              title={val === 0 ? 'Unlimited Voices' : `Cap at ${val} max concurrent voices`}
            >
              {val === 0 ? 'Max' : val}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Per Second Counter */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex flex-col">
            <span className="text-zinc-300 font-medium">Notes Per Second (NPS)</span>
            <span className="text-[10px] text-zinc-500">Live note velocity &amp; peak density</span>
          </div>
          <NpsBadge />
        </div>
      </div>
    </div>
  );
});

SongSettingsTab.displayName = 'SongSettingsTab';
