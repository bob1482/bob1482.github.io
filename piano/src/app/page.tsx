'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { audioEngine } from '@/lib/audioEngine';
import { midiManager, MidiSong } from '@/lib/midiEngine';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { WickiBoard } from '@/components/WickiBoard';
import { ControlsOverlay } from '@/components/ControlsOverlay';
import {
  loadCustomBackgroundFromDB,
  saveCustomBackgroundToDB,
  removeCustomBackgroundFromDB,
  compressImageFile,
} from '@/lib/backgroundStorage';
import { QWERTY_TO_MIDI, QWERTY_TO_SIDE } from '@/lib/pianoGeometry';

const SynthesiaCanvas = dynamic(
  () => import('@/components/SynthesiaCanvas').then((mod) => mod.SynthesiaCanvas),
  { ssr: false }
);

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<MidiSong | null>(null);
  const [leftSustain, setLeftSustain] = useState(false);
  const [rightSustain, setRightSustain] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [isSamplerLoaded, setIsSamplerLoaded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [renderNoteBlocks, setRenderNoteBlocks] = useState(true);
  const [fadeJankoMode, setFadeJankoMode] = useState(false);
  const [leftNoteColor, setLeftNoteColor] = useState('#ffffff');
  const [rightNoteColor, setRightNoteColor] = useState('#ffffff');
  const [jankoBoardColor, setJankoBoardColor] = useState('#ffffff');
  const [jankoTranspose, setJankoTranspose] = useState(0);
  const [midiTranspose, setMidiTranspose] = useState(0);
  const [midiInputTranspose, setMidiInputTranspose] = useState(0);

  const pressedKeysRef = useRef<Map<string, { midi: number; side: 'left' | 'right' }>>(new Map());
  const leftSustainKeyHeldRef = useRef(false);
  const rightSustainKeyHeldRef = useRef(false);

  useEffect(() => {
    const savedRenderNotes = window.localStorage.getItem('piano:renderNoteBlocks');
    if (savedRenderNotes !== null) {
      setRenderNoteBlocks(savedRenderNotes === 'true');
    }
    const savedFadeJanko = window.localStorage.getItem('piano:fadeJankoMode');
    if (savedFadeJanko !== null) {
      setFadeJankoMode(savedFadeJanko === 'true');
    }
    const savedLeftColor = window.localStorage.getItem('piano:leftNoteColor');
    if (savedLeftColor) {
      setLeftNoteColor(savedLeftColor);
    }
    const savedRightColor = window.localStorage.getItem('piano:rightNoteColor');
    if (savedRightColor) {
      setRightNoteColor(savedRightColor);
    }
    const savedBoardColor = window.localStorage.getItem('piano:jankoBoardColor');
    if (savedBoardColor) {
      setJankoBoardColor(savedBoardColor);
    }
    const savedJankoTranspose = window.localStorage.getItem('piano:jankoTranspose');
    if (savedJankoTranspose !== null) {
      const parsed = Number.parseInt(savedJankoTranspose, 10);
      if (!Number.isNaN(parsed)) {
        setJankoTranspose(Math.max(-24, Math.min(24, parsed)));
      }
    }
    const savedTranspose = window.localStorage.getItem('piano:midiTranspose');
    if (savedTranspose !== null) {
      const parsed = Number.parseInt(savedTranspose, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(-24, Math.min(24, parsed));
        setMidiTranspose(clamped);
        midiManager.setSongTranspose(clamped);
      }
    }
    const savedInputTranspose = window.localStorage.getItem('piano:midiInputTranspose');
    if (savedInputTranspose !== null) {
      const parsed = Number.parseInt(savedInputTranspose, 10);
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(-24, Math.min(24, parsed));
        setMidiInputTranspose(clamped);
        midiManager.setMidiInputTranspose(clamped);
      }
    }
    audioEngine.preload();
    const unsubSampler = audioEngine.onSamplerReady(() => setIsSamplerLoaded(true));
    void midiManager.initWebMidi();
    void loadCustomBackgroundFromDB().then((bg) => {
      if (bg) setBackgroundImage(bg);
    });

    const unsubPlay = midiManager.onPlaybackStateChange(setIsPlaying);
    const unsubSustain = midiManager.onSustainChange((active, side) => {
      if (side === 'left') setLeftSustain(active);
      else if (side === 'right') setRightSustain(active);
    });

    return () => {
      unsubSampler();
      unsubPlay();
      unsubSustain();
      midiManager.stop();
      audioEngine.releaseAll();
    };
  }, []);

  const handleLoadMidiFile = useCallback(async (file: File) => {
    try {
      await audioEngine.ensureAudioStarted();
      const song = await midiManager.parseMidiFile(file);
      midiManager.loadSong(song);
      setCurrentSong(song);
    } catch (err) {
      console.error('Failed to load MIDI file:', err);
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (!currentSong) return;
    if (midiManager.getIsPlaying()) {
      midiManager.pause();
    } else {
      midiManager.play();
    }
  }, [currentSong]);

  const handleSeek = useCallback((time: number) => {
    midiManager.seek(time);
  }, []);

  const handleClearSong = useCallback(() => {
    midiManager.clearSong();
    setCurrentSong(null);
    setIsPlaying(false);
  }, []);

  const handleToggleLeftSustain = useCallback(() => {
    setLeftSustain((prev) => {
      const next = !prev;
      audioEngine.setSustainPedal(next, 'left');
      return next;
    });
  }, []);

  const handleToggleRightSustain = useCallback(() => {
    setRightSustain((prev) => {
      const next = !prev;
      audioEngine.setSustainPedal(next, 'right');
      return next;
    });
  }, []);

  const handleBackgroundSelected = useCallback(async (file: File) => {
    try {
      const dataUrl = await compressImageFile(file);
      await saveCustomBackgroundToDB(dataUrl);
      setBackgroundImage(dataUrl);
    } catch (err) {
      console.error('Failed to save background:', err);
    }
  }, []);

  const handleClearBackground = useCallback(async () => {
    await removeCustomBackgroundFromDB();
    setBackgroundImage('');
  }, []);

  const handleToggleNoteBlocks = useCallback(() => {
    setRenderNoteBlocks((prev) => {
      const next = !prev;
      window.localStorage.setItem('piano:renderNoteBlocks', String(next));
      return next;
    });
  }, []);

  const handleToggleFadeJankoMode = useCallback(() => {
    setFadeJankoMode((prev) => {
      const next = !prev;
      window.localStorage.setItem('piano:fadeJankoMode', String(next));
      return next;
    });
  }, []);

  const handleLeftNoteColorChange = useCallback((color: string) => {
    setLeftNoteColor(color);
    window.localStorage.setItem('piano:leftNoteColor', color);
  }, []);

  const handleRightNoteColorChange = useCallback((color: string) => {
    setRightNoteColor(color);
    window.localStorage.setItem('piano:rightNoteColor', color);
  }, []);

  const handleJankoBoardColorChange = useCallback((color: string) => {
    setJankoBoardColor(color);
    window.localStorage.setItem('piano:jankoBoardColor', color);
  }, []);

  const handleJankoTransposeChange = useCallback((next: number) => {
    const clamped = Math.max(-24, Math.min(24, Math.round(next)));
    setJankoTranspose(clamped);
    window.localStorage.setItem('piano:jankoTranspose', String(clamped));
  }, []);

  const handleMidiTransposeChange = useCallback((next: number) => {
    const clamped = Math.max(-24, Math.min(24, Math.round(next)));
    setMidiTranspose(clamped);
    midiManager.setSongTranspose(clamped);
    window.localStorage.setItem('piano:midiTranspose', String(clamped));
  }, []);

  const handleMidiInputTransposeChange = useCallback((next: number) => {
    const clamped = Math.max(-24, Math.min(24, Math.round(next)));
    pressedKeysRef.current.forEach((entry, code) => {
      midiManager.triggerLiveNoteOff(entry.midi, `kbd:${code}`, entry.side);
    });
    pressedKeysRef.current.clear();
    setMidiInputTranspose(clamped);
    midiManager.setMidiInputTranspose(clamped);
    window.localStorage.setItem('piano:midiInputTranspose', String(clamped));
  }, []);

  // QWERTY Keyboard, 1 / Backslash Sustain & Transport Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range'))
      ) {
        return;
      }

      if (e.key === "'" || e.key === '/') {
        e.preventDefault();
      }

      if (e.code === 'Digit1') {
        e.preventDefault();
        if (!e.repeat && !leftSustainKeyHeldRef.current) {
          leftSustainKeyHeldRef.current = true;
          handleToggleLeftSustain();
        }
        return;
      }
      if (e.code === 'Backslash') {
        e.preventDefault();
        if (!e.repeat && !rightSustainKeyHeldRef.current) {
          rightSustainKeyHeldRef.current = true;
          handleToggleRightSustain();
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          handleTogglePlay();
        }
        return;
      }
      if (e.code === 'ArrowLeft' && currentSong) {
        e.preventDefault();
        if (!e.repeat) {
          midiManager.seek(midiManager.getPlaybackTime() - 5);
        }
        return;
      }
      if (e.code === 'ArrowRight' && currentSong) {
        e.preventDefault();
        if (!e.repeat) {
          midiManager.seek(midiManager.getPlaybackTime() + 5);
        }
        return;
      }

      const baseMidi = QWERTY_TO_MIDI[e.code];
      if (baseMidi !== undefined) {
        e.preventDefault();
        if (!e.repeat && !pressedKeysRef.current.has(e.code)) {
          const midi = baseMidi + midiManager.getMidiInputTranspose();
          const side = QWERTY_TO_SIDE[e.code] ?? 'left';
          pressedKeysRef.current.set(e.code, { midi, side });
          midiManager.triggerLiveNoteOn(midi, 0.85, `kbd:${e.code}`, side);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') {
        e.preventDefault();
        if (leftSustainKeyHeldRef.current) {
          leftSustainKeyHeldRef.current = false;
          handleToggleLeftSustain();
        }
        return;
      }
      if (e.code === 'Backslash') {
        e.preventDefault();
        if (rightSustainKeyHeldRef.current) {
          rightSustainKeyHeldRef.current = false;
          handleToggleRightSustain();
        }
        return;
      }

      const entry = pressedKeysRef.current.get(e.code);
      if (entry !== undefined) {
        pressedKeysRef.current.delete(e.code);
        midiManager.triggerLiveNoteOff(entry.midi, `kbd:${e.code}`, entry.side);
      }
    };

    const handleBlur = () => {
      pressedKeysRef.current.forEach((entry, code) => {
        midiManager.triggerLiveNoteOff(entry.midi, `kbd:${code}`, entry.side);
      });
      pressedKeysRef.current.clear();
      if (leftSustainKeyHeldRef.current) {
        leftSustainKeyHeldRef.current = false;
        handleToggleLeftSustain();
      }
      if (rightSustainKeyHeldRef.current) {
        rightSustainKeyHeldRef.current = false;
        handleToggleRightSustain();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [currentSong, handleTogglePlay, handleToggleLeftSustain, handleToggleRightSustain]);

  const handleNoteOn = useCallback((midi: number, velocity = 0.85, inputId?: string, side?: 'left' | 'right') => {
    midiManager.triggerLiveNoteOn(midi, velocity, inputId, side);
  }, []);

  const handleNoteOff = useCallback((midi: number, inputId?: string, side?: 'left' | 'right') => {
    midiManager.triggerLiveNoteOff(midi, inputId, side);
  }, []);

  return (
    <main
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && /\.(mid|midi)$/i.test(file.name)) {
          void handleLoadMidiFile(file);
        }
      }}
      className="relative w-screen h-screen overflow-hidden bg-[#050507] flex flex-col select-none"
    >
      {/* Custom Background */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none z-0 opacity-80"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Drag-and-Drop MIDI Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-white/40 pointer-events-none">
          <p className="text-white text-sm font-medium">Drop MIDI file to play</p>
        </div>
      )}

      {/* Minimal Top HUD */}
      <ControlsOverlay
        isSongActive={Boolean(currentSong)}
        isPlaying={isPlaying}
        leftSustain={leftSustain}
        rightSustain={rightSustain}
        hasBackground={Boolean(backgroundImage)}
        isSamplerLoaded={isSamplerLoaded}
        renderNoteBlocks={renderNoteBlocks}
        fadeJankoMode={fadeJankoMode}
        leftNoteColor={leftNoteColor}
        rightNoteColor={rightNoteColor}
        jankoBoardColor={jankoBoardColor}
        jankoTranspose={jankoTranspose}
        midiTranspose={midiTranspose}
        midiInputTranspose={midiInputTranspose}
        onMidiFileSelected={handleLoadMidiFile}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onClearSong={handleClearSong}
        onToggleLeftSustain={handleToggleLeftSustain}
        onToggleRightSustain={handleToggleRightSustain}
        onBackgroundSelected={handleBackgroundSelected}
        onClearBackground={handleClearBackground}
        onToggleNoteBlocks={handleToggleNoteBlocks}
        onToggleFadeJankoMode={handleToggleFadeJankoMode}
        onLeftNoteColorChange={handleLeftNoteColorChange}
        onRightNoteColorChange={handleRightNoteColorChange}
        onJankoBoardColorChange={handleJankoBoardColorChange}
        onJankoTransposeChange={handleJankoTransposeChange}
        onMidiTransposeChange={handleMidiTransposeChange}
        onMidiInputTransposeChange={handleMidiInputTransposeChange}
      />

      {/* Falling / Rising Note Canvas & Side Wicki Boards */}
      <div className="relative flex-1 w-full overflow-hidden z-10">
        {renderNoteBlocks && (
          <SynthesiaCanvas
            isPlaying={isPlaying}
            jankoTranspose={jankoTranspose}
            leftNoteColor={leftNoteColor}
            rightNoteColor={rightNoteColor}
          />
        )}

        <div className="absolute bottom-2 left-2 z-20">
          <WickiBoard
            side="left"
            fadeJankoMode={fadeJankoMode}
            leftNoteColor={leftNoteColor}
            rightNoteColor={rightNoteColor}
            boardColor={jankoBoardColor}
            midiInputTranspose={midiInputTranspose}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        </div>

        <div className="absolute bottom-2 right-2 z-20">
          <WickiBoard
            side="right"
            fadeJankoMode={fadeJankoMode}
            leftNoteColor={leftNoteColor}
            rightNoteColor={rightNoteColor}
            boardColor={jankoBoardColor}
            midiInputTranspose={midiInputTranspose}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        </div>
      </div>

      {/* Jankó Piano */}
      <PianoKeyboard
        fadeJankoMode={fadeJankoMode}
        leftNoteColor={leftNoteColor}
        rightNoteColor={rightNoteColor}
        jankoBoardColor={jankoBoardColor}
        jankoTranspose={jankoTranspose}
        onNoteOn={handleNoteOn}
        onNoteOff={handleNoteOff}
      />
    </main>
  );
}
