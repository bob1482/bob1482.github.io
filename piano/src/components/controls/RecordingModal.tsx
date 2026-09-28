'use client';

import React, { useState, useEffect } from 'react';
import { Download, Play, X, Clock, Music, Disc3, Layers } from 'lucide-react';
import { RecordingSession } from '@/lib/midiRecorder';

export interface RecordingModalProps {
  session: RecordingSession | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (fileName: string) => void;
  onPlayInVisualizer: (session: RecordingSession, customTitle?: string) => void;
  isMobile?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export const RecordingModal: React.FC<RecordingModalProps> = React.memo(({
  session,
  isOpen,
  onClose,
  onDownload,
  onPlayInVisualizer,
  isMobile = false,
}) => {
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (session) {
      // Set initial filename based on session date/title
      const defaultName = session.title.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      setFileName(defaultName || 'recording');
    }
  }, [session]);

  if (!isOpen || !session) return null;

  const handleDownload = () => {
    let name = fileName.trim();
    if (!name) name = 'recording';
    if (!name.endsWith('.mid') && !name.endsWith('.midi')) {
      name += '.mid';
    }
    onDownload(name);
  };

  const handlePlay = () => {
    onPlayInVisualizer(session, fileName.trim() || undefined);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] pointer-events-auto transition-opacity duration-200"
      />

      {/* Modal Dialog */}
      <div
        className={
          isMobile
            ? 'fixed inset-x-0 bottom-0 max-h-[85dvh] bg-zinc-950/98 backdrop-blur-2xl border-t border-white/[0.15] rounded-t-3xl z-[101] flex flex-col pointer-events-auto shadow-[0_-10px_35px_rgba(0,0,0,0.85)] p-5 pb-10 gap-4 text-xs animate-in slide-in-from-bottom duration-200 overflow-y-auto overscroll-contain custom-scrollbar'
            : 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-zinc-950/95 backdrop-blur-2xl border border-white/[0.12] p-5 rounded-2xl pointer-events-auto flex flex-col gap-4 text-xs shadow-2xl z-[101] animate-in fade-in zoom-in-95 duration-150 custom-scrollbar'
        }
      >
        {isMobile && (
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-0.5 shrink-0" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Disc3 className="w-4 h-4 animate-spin [animation-duration:6s]" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-100 text-sm">Recording Complete</span>
              <span className="text-[11px] text-zinc-400">Your inputs have been captured</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-white/[0.06] transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Performance Metrics Cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Duration Card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <Clock className="w-3.5 h-3.5 text-zinc-400 mb-1" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Duration</span>
            <span className="text-sm font-bold font-mono text-zinc-100 mt-0.5">
              {formatDuration(session.duration)}
            </span>
          </div>

          {/* Notes Card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <Music className="w-3.5 h-3.5 text-sky-400 mb-1" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Notes</span>
            <span className="text-sm font-bold font-mono text-sky-300 mt-0.5">
              {session.notes.length}
            </span>
          </div>

          {/* Sustain CCs Card */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <Layers className="w-3.5 h-3.5 text-amber-400 mb-1" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Pedal</span>
            <span className="text-sm font-bold font-mono text-amber-300 mt-0.5">
              {session.ccs.length} <span className="text-[10px] font-normal text-zinc-500">events</span>
            </span>
          </div>
        </div>

        {/* File Name Field */}
        <div className="flex flex-col gap-1.5 bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl">
          <label className="text-[11px] font-medium text-zinc-300">File Name</label>
          <div className="flex items-center gap-1 bg-black/40 border border-white/[0.08] focus-within:border-sky-500/50 rounded-lg px-2.5 py-1.5 transition">
            <input
              type="text"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              placeholder="recording-name"
              className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
            />
            <span className="text-[11px] text-zinc-500 font-mono shrink-0">.mid</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Download Button (Primary) */}
          <button
            onClick={handleDownload}
            disabled={session.notes.length === 0}
            className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download className="w-4 h-4" />
            <span>Download MIDI File (.mid)</span>
          </button>

          {/* Play in Visualizer Button */}
          <button
            onClick={handlePlay}
            disabled={session.notes.length === 0}
            className="w-full py-2 px-4 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white font-medium border border-white/[0.1] rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <Play className="w-3.5 h-3.5 text-sky-400" />
            <span>Play in Visualizer</span>
          </button>
        </div>
      </div>
    </>
  );
});

RecordingModal.displayName = 'RecordingModal';
