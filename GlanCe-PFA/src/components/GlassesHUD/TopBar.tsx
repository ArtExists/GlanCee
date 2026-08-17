import React from 'react';
import { Mic, MicOff, Settings, Sparkles, SwitchCamera, HelpCircle, Layers, Circle, Square, Film } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface TopBarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  recordingDuration: number;
  hasCachedRecording: boolean;
  onToggleMic: () => void;
  onSwitchCamera: () => void;
  onToggleRecording: () => void;
  onOpenRecordingModal: () => void;
  onOpenSettings: () => void;
  onOpenSimulation: () => void;
  onOpenTutorial: () => void;
  hasCustomKey: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isListening,
  isSpeaking,
  isProcessing,
  isRecording,
  recordingDuration,
  hasCachedRecording,
  onToggleMic,
  onSwitchCamera,
  onToggleRecording,
  onOpenRecordingModal,
  onOpenSettings,
  onOpenSimulation,
  onOpenTutorial,
  hasCustomKey,
}) => {
  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-40 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
      {/* Brand & AR Status */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl glass-panel-glow bg-black/60 border border-cyan-400/30">
          <div className="relative flex items-center justify-center w-5 h-5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />
            <span className="absolute inset-0 rounded-full border border-cyan-400/60 animate-ping" />
          </div>
          <span className="font-orbitron font-bold text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-emerald-300">
            GLANCE
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/20">
            AR v1.0
          </span>
        </div>

        {/* Live Recording Badge */}
        {isRecording && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-mono shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
            <span className="relative flex items-center justify-center w-2.5 h-2.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="absolute inset-0 rounded-full border border-red-400 animate-ping" />
            </span>
            <span className="font-bold">REC {formatRecordingTime(recordingDuration)}</span>
          </div>
        )}

        {/* Processing / Status Pill */}
        {!isRecording && isProcessing ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyzing target...</span>
          </div>
        ) : !isRecording && isSpeaking ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono animate-pulse">
            <span>Calm Narrator speaking...</span>
          </div>
        ) : null}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Record Session Start / Stop Button */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onToggleRecording();
          }}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-space transition-all duration-200 border ${
            isRecording
              ? 'bg-red-500/30 text-red-200 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-bold'
              : 'glass-button text-slate-300 hover:text-white border-white/10 hover:border-red-500/40'
          }`}
          title={isRecording ? 'Click to Stop Recording' : 'Start AR Session Recording (Camera + Popups + Voice)'}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span className="font-mono text-[11px]">STOP REC</span>
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <span className="font-mono text-[11px]">REC</span>
            </>
          )}
        </button>

        {/* Cached Clip Ready Download Button */}
        {hasCachedRecording && !isRecording && (
          <button
            onClick={() => {
              audioFX.playPinchTrigger?.();
              onOpenRecordingModal();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-mono shadow-[0_0_10px_rgba(16,185,129,0.3)]"
            title="Review & Download Saved Video Clip"
          >
            <Film className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden md:inline">Saved Clip</span>
          </button>
        )}

        {/* Voice Recognition Toggle */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onToggleMic();
          }}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-space transition-all duration-200 border ${
            isListening
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.4)]'
              : 'glass-button text-slate-400 hover:text-slate-200 border-white/10'
          }`}
          title={isListening ? 'Voice Commands Active (Say "What\'s this")' : 'Click to enable Voice Commands'}
        >
          {isListening ? (
            <>
              <Mic className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span className="hidden md:inline font-mono text-[11px]">VOICE ON</span>
            </>
          ) : (
            <>
              <MicOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline font-mono text-[11px]">VOICE OFF</span>
            </>
          )}
        </button>

        {/* Camera Switch */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onSwitchCamera();
          }}
          className="p-2 rounded-xl glass-button text-slate-300 hover:text-white border-white/10"
          title="Switch Camera (Front / Back)"
        >
          <SwitchCamera className="w-4 h-4" />
        </button>

        {/* Scenarios / Simulation Bench */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onOpenSimulation();
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-button text-slate-300 hover:text-white border-white/10 text-xs font-space"
          title="Interactive Test Scenarios & Uploads"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-300" />
          <span className="hidden sm:inline">Scenarios</span>
        </button>

        {/* Tutorial / Help */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onOpenTutorial();
          }}
          className="p-2 rounded-xl glass-button text-slate-300 hover:text-white border-white/10"
          title="Gesture Guide & Tutorial"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Settings Modal */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onOpenSettings();
          }}
          className="relative p-2 rounded-xl glass-button text-slate-300 hover:text-white border-white/10"
          title="Settings & API Keys"
        >
          <Settings className="w-4 h-4" />
          {!hasCustomKey && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" title="Running on Smart Fallback Engine" />
          )}
        </button>
      </div>
    </header>
  );
};
