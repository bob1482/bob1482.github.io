'use client';

import React from 'react';
import { Volume2, VolumeX, Music, Flame } from 'lucide-react';
import { audioEngine, AVAILABLE_INSTRUMENTS } from '@/lib/audioEngine';
import { SoundInstrument } from '@/lib/settings';

export interface AudioSettingsTabProps {
  soundInstrument?: SoundInstrument;
  onSoundInstrumentChange?: (instrument: SoundInstrument) => void;
  stringAttack?: number;
  onStringAttackChange?: (attack: number) => void;
  stringRelease?: number;
  onStringReleaseChange?: (release: number) => void;
  lowPassFilterActive?: boolean;
  onLowPassFilterActiveChange?: (active: boolean) => void;
  lowPassCutoff?: number;
  onLowPassCutoffChange?: (cutoff: number) => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  keyboardVolume?: number;
  isKeyboardMuted?: boolean;
  onKeyboardVolumeChange?: (volume: number) => void;
  onToggleKeyboardMute?: () => void;
  midiInputVolume?: number;
  isMidiInputMuted?: boolean;
  onMidiInputVolumeChange?: (volume: number) => void;
  onToggleMidiInputMute?: () => void;
  reverbWet: number;
  onReverbWetChange: (wet: number) => void;
}

export const AudioSettingsTab: React.FC<AudioSettingsTabProps> = React.memo(({
  soundInstrument = 'salamander',
  onSoundInstrumentChange,
  stringAttack = 0.1,
  onStringAttackChange,
  stringRelease = 1.2,
  onStringReleaseChange,
  lowPassFilterActive = false,
  onLowPassFilterActiveChange,
  lowPassCutoff = 2200,
  onLowPassCutoffChange,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  keyboardVolume = 0,
  isKeyboardMuted = false,
  onKeyboardVolumeChange,
  onToggleKeyboardMute,
  midiInputVolume = 0,
  isMidiInputMuted = false,
  onMidiInputVolumeChange,
  onToggleMidiInputMute,
  reverbWet,
  onReverbWetChange,
}) => {
  const isAnyMuted = isMuted || isKeyboardMuted || isMidiInputMuted;

  const handleToggleVolumeMute = () => {
    const shouldMute = !isAnyMuted;
    if (shouldMute) {
      if (!isMuted) onToggleMute?.();
      if (!isKeyboardMuted) onToggleKeyboardMute?.();
      if (!isMidiInputMuted) onToggleMidiInputMute?.();
    } else {
      if (isMuted) onToggleMute?.();
      if (isKeyboardMuted) onToggleKeyboardMute?.();
      if (isMidiInputMuted) onToggleMidiInputMute?.();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Soundfont Sample Option Selector */}
      <div className="flex flex-col gap-2.5 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="font-medium text-zinc-200 flex items-center gap-1.5 text-xs">
            <Music className="w-3.5 h-3.5 text-cyan-400" /> Sound Sample
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {soundInstrument === 'string_ensemble_1' ? 'FluidR3_GM mp3.js' : 'Salamander Grand'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_INSTRUMENTS.map((inst) => {
            const isSelected = soundInstrument === inst.id;
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => onSoundInstrumentChange?.(inst.id)}
                className={`flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.12)]'
                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                    <span>{inst.id === 'string_ensemble_1' ? '🎻' : '🎹'}</span>
                    <span className="truncate">{inst.id === 'string_ensemble_1' ? 'Ensemble' : 'Grand Piano'}</span>
                  </span>
                </div>
                <span className="text-[10px] leading-tight text-zinc-400 line-clamp-1">
                  {inst.id === 'string_ensemble_1' ? 'FluidR3 GM (mp3.js) • Sustain off' : 'Salamander (84 Keys) • Sustain on'}
                </span>
              </button>
            );
          })}
        </div>

        {/* String Ensemble Attack & Release Envelope Controls */}
        {soundInstrument === 'string_ensemble_1' && (
          <div className="flex flex-col gap-3 pt-2.5 mt-1 border-t border-white/[0.06] animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-cyan-300 flex items-center gap-1.5">
                🎻 String Envelope (Attack &amp; Release)
              </span>
              <span className="text-[10px] text-zinc-500">FluidR3 Soundfont</span>
            </div>

            {/* Attack Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Attack (Fade In)</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-cyan-200 bg-cyan-500/10 border-cyan-500/20">
                  {stringAttack <= 0 ? 'Instant (0 ms)' : `${Math.round(stringAttack * 1000)} ms (${stringAttack.toFixed(2)}s)`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={stringAttack}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  onStringAttackChange?.(val);
                  audioEngine.setStringAttack(val);
                }}
                className="w-full cursor-pointer"
              />
              <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
                {[
                  { label: '0ms', val: 0 },
                  { label: '50ms', val: 0.05 },
                  { label: '100ms', val: 0.1 },
                  { label: '300ms', val: 0.3 },
                  { label: '600ms', val: 0.6 },
                ].map(preset => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      onStringAttackChange?.(preset.val);
                      audioEngine.setStringAttack(preset.val);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                      Math.abs(stringAttack - preset.val) < 0.01
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Release Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Release (Fade Out)</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-cyan-200 bg-cyan-500/10 border-cyan-500/20">
                  {stringRelease.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={4.0}
                step={0.05}
                value={stringRelease}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  onStringReleaseChange?.(val);
                  audioEngine.setStringRelease(val);
                }}
                className="w-full cursor-pointer"
              />
              <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
                {[
                  { label: '0.3s', val: 0.3 },
                  { label: '0.8s', val: 0.8 },
                  { label: '1.2s', val: 1.2 },
                  { label: '2.0s', val: 2.0 },
                  { label: '3.5s', val: 3.5 },
                ].map(preset => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      onStringReleaseChange?.(preset.val);
                      audioEngine.setStringRelease(preset.val);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                      Math.abs(stringRelease - preset.val) < 0.05
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 font-medium'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="font-medium text-zinc-200 flex items-center gap-1.5 text-xs sm:text-xs">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" /> Volume &amp; Mix
          </span>
        <button
          type="button"
          onClick={handleToggleVolumeMute}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
            isAnyMuted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200'
          }`}
        >
          {isAnyMuted ? 'Unmute All' : 'Mute All'}
        </button>
      </div>

      {/* MIDI / Song Playback Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleMute?.()}
              className={`p-1 rounded hover:bg-white/[0.06] transition cursor-pointer ${
                isMuted ? 'text-rose-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={isMuted ? 'Unmute Song Volume' : 'Mute Song Volume'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-zinc-300">Song Volume</span>
          </div>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              isMuted
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-zinc-200 bg-white/[0.05] border-white/[0.08]'
            }`}
          >
            {isMuted ? 'Muted' : `${volume > 0 ? '+' : ''}${volume} dB`}
          </span>
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={1}
          value={volume}
          onChange={e => onVolumeChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[-10, -5, 0, 5, 10].map(dB => (
            <button
              key={dB}
              type="button"
              onClick={() => onVolumeChange?.(dB)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                volume === dB && !isMuted
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              {dB > 0 ? `+${dB}` : dB} dB
            </button>
          ))}
        </div>
      </div>

      {/* Piano Keyboard Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleKeyboardMute?.()}
              className={`p-1 rounded hover:bg-white/[0.06] transition cursor-pointer ${
                isKeyboardMuted ? 'text-rose-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={isKeyboardMuted ? 'Unmute Keyboard Volume' : 'Mute Keyboard Volume'}
            >
              {isKeyboardMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-zinc-300">Keyboard Volume</span>
          </div>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              isKeyboardMuted
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-zinc-200 bg-white/[0.05] border-white/[0.08]'
            }`}
          >
            {isKeyboardMuted ? 'Muted' : `${keyboardVolume > 0 ? '+' : ''}${keyboardVolume} dB`}
          </span>
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={1}
          value={keyboardVolume}
          onChange={e => onKeyboardVolumeChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[-10, -5, 0, 5, 10].map(dB => (
            <button
              key={dB}
              type="button"
              onClick={() => onKeyboardVolumeChange?.(dB)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                keyboardVolume === dB && !isKeyboardMuted
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              {dB > 0 ? `+${dB}` : dB} dB
            </button>
          ))}
        </div>
      </div>

      {/* External MIDI In Volume */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-zinc-300">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleMidiInputMute?.()}
              className={`p-1 rounded hover:bg-white/[0.06] transition cursor-pointer ${
                isMidiInputMuted ? 'text-rose-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={isMidiInputMuted ? 'Unmute MIDI Input Volume' : 'Mute MIDI Input Volume'}
            >
              {isMidiInputMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-zinc-300">MIDI In Volume</span>
          </div>
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              isMidiInputMuted
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-zinc-200 bg-white/[0.05] border-white/[0.08]'
            }`}
          >
            {isMidiInputMuted ? 'Muted' : `${midiInputVolume > 0 ? '+' : ''}${midiInputVolume} dB`}
          </span>
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={1}
          value={midiInputVolume}
          onChange={e => onMidiInputVolumeChange?.(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[-10, -5, 0, 5, 10].map(dB => (
            <button
              key={dB}
              type="button"
              onClick={() => onMidiInputVolumeChange?.(dB)}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                midiInputVolume === dB && !isMidiInputMuted
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              {dB > 0 ? `+${dB}` : dB} dB
            </button>
          ))}
        </div>
      </div>

      {/* Reverb Level */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.05]">
        <div className="flex justify-between text-zinc-300">
          <span className="text-zinc-400">Reverb Level</span>
          <span className="font-mono text-zinc-200">{Math.round(reverbWet * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={reverbWet}
          onChange={e => {
            const w = parseFloat(e.target.value);
            onReverbWetChange(w);
            audioEngine.setReverbWet(w);
          }}
          className="w-full cursor-pointer"
        />
        <div className="grid grid-cols-5 gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          {[0, 0.25, 0.5, 0.75, 1.0].map(wet => (
            <button
              key={wet}
              type="button"
              onClick={() => {
                onReverbWetChange(wet);
                audioEngine.setReverbWet(wet);
              }}
              title={`${Math.round(wet * 100)}% Reverb`}
              className={`py-1.5 px-1 rounded-lg text-center font-mono text-[10px] transition-all cursor-pointer ${
                Math.abs(reverbWet - wet) < 0.01
                  ? 'bg-white/[0.12] text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
              }`}
            >
              {Math.round(wet * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Warm & Cozy Sound (Low Pass Filter) */}
      <div className={`flex flex-col gap-3 p-3 rounded-2xl border transition-all duration-200 ${
        lowPassFilterActive
          ? 'bg-amber-500/[0.04] border-amber-500/25 shadow-[0_0_20px_rgba(245,158,11,0.06)]'
          : 'bg-white/[0.02] border-white/[0.05]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              lowPassFilterActive ? 'bg-amber-500/20 text-amber-300' : 'bg-white/[0.04] text-zinc-400'
            }`}>
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-zinc-200 text-xs flex items-center gap-1.5">
                Warm &amp; Cozy Sound
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full border transition-colors ${
                  lowPassFilterActive
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-white/[0.04] text-zinc-500 border-white/[0.06]'
                }`}>
                  {lowPassFilterActive ? 'Active' : 'Off'}
                </span>
              </span>
              <span className="text-[10px] text-zinc-400">
                Low-pass filter for a mellow, intimate felt-piano acoustic tone
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextState = !lowPassFilterActive;
              onLowPassFilterActiveChange?.(nextState);
              audioEngine.setLowPassFilterActive(nextState);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              lowPassFilterActive ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-zinc-700'
            }`}
            title={lowPassFilterActive ? 'Disable warm low-pass filter' : 'Enable warm low-pass filter'}
            aria-pressed={lowPassFilterActive}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                lowPassFilterActive ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Filter Controls (Cutoff slider & Presets) */}
        <div className={`flex flex-col gap-2.5 transition-opacity duration-200 ${
          lowPassFilterActive ? 'opacity-100' : 'opacity-60'
        }`}>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400 flex items-center gap-1">
              Filter Warmth Cutoff
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className={`px-1.5 py-0.5 rounded border transition-colors ${
                lowPassFilterActive
                  ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                  : 'text-zinc-400 bg-white/[0.04] border-white/[0.06]'
              }`}>
                {lowPassCutoff >= 1000 ? `${(lowPassCutoff / 1000).toFixed(1)} kHz` : `${lowPassCutoff} Hz`}
              </span>
              <span className="text-zinc-400 text-[10px]">
                {lowPassCutoff < 1500
                  ? '• Deep & Dreamy'
                  : lowPassCutoff <= 2600
                  ? '• Cozy & Warm'
                  : lowPassCutoff <= 4200
                  ? '• Mellow & Soft'
                  : '• Subtle Warmth'}
              </span>
            </div>
          </div>

          <input
            type="range"
            min={600}
            max={6000}
            step={50}
            value={lowPassCutoff}
            onChange={e => {
              const val = parseInt(e.target.value, 10);
              onLowPassCutoffChange?.(val);
              audioEngine.setLowPassCutoff(val);
            }}
            className="w-full cursor-pointer accent-amber-400"
          />

          <div className="grid grid-cols-4 gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
            {[
              { label: 'Deep', hz: 1000, desc: '1.0 kHz' },
              { label: 'Cozy', hz: 2200, desc: '2.2 kHz' },
              { label: 'Mellow', hz: 3500, desc: '3.5 kHz' },
              { label: 'Subtle', hz: 5000, desc: '5.0 kHz' },
            ].map(preset => {
              const isSelected = lowPassFilterActive && Math.abs(lowPassCutoff - preset.hz) < 150;
              return (
                <button
                  key={preset.hz}
                  type="button"
                  onClick={() => {
                    if (!lowPassFilterActive) {
                      onLowPassFilterActiveChange?.(true);
                      audioEngine.setLowPassFilterActive(true);
                    }
                    onLowPassCutoffChange?.(preset.hz);
                    audioEngine.setLowPassCutoff(preset.hz);
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/35 font-medium shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <span className="text-[11px] font-medium leading-none">{preset.label}</span>
                  <span className="font-mono text-[9px] opacity-75 mt-0.5">{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </div>
);
});

AudioSettingsTab.displayName = 'AudioSettingsTab';
