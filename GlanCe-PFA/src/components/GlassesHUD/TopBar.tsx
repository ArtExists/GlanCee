import React from 'react';
import { Settings, Sparkles, SwitchCamera, HelpCircle, Layers, Circle, Square, Film, OctagonX } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface TopBarProps {
  isSpeaking: boolean;
  isProcessing: boolean;
  hasActiveRecognition: boolean;
  isRecording: boolean;
  recordingDuration: number;
  hasCachedRecording: boolean;
  onStopRecognition: () => void;
  onSwitchCamera: () => void;
  onToggleRecording: () => void;
  onOpenRecordingModal: () => void;
  onOpenSettings: () => void;
  onOpenSimulation: () => void;
  onOpenTutorial: () => void;
  hasCustomKey: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  isSpeaking,
  isProcessing,
  hasActiveRecognition,
  isRecording,
  recordingDuration,
  hasCachedRecording,
  onStopRecognition,
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
    <header className="absolute top-0 left-0 right-0 z-40 pt-safe px-2 sm:px-4 pb-2 flex items-center justify-between pointer-events-none gap-2">
      {/* Brand & AR Status */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 pointer-events-auto shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl glass-panel-glow bg-black/60 border border-cyan-400/30">
          <div className="relative flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />
            <span className="absolute inset-0 rounded-full border border-cyan-400/60 animate-ping" />
          </div>
          <span className="font-orbitron font-bold text-xs sm:text-sm tracking-wider sm:tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-emerald-300">
            GLANCE
          </span>
          <span className="hidden md:inline text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/20">
            AR v1.0
          </span>
        </div>

        {/* Live Recording Badge */}
        {isRecording && (
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-[10px] sm:text-xs font-mono shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse">
            <span className="relative flex items-center justify-center w-2 h-2 sm:w-2.5 sm:h-2.5">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
              <span className="absolute inset-0 rounded-full border border-red-400 animate-ping" />
            </span>
            <span className="font-bold">{formatRecordingTime(recordingDuration)}</span>
          </div>
        )}

        {/* Processing / Status Pill */}
        {!isRecording && isProcessing ? (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Analyzing target...</span>
          </div>
        ) : !isRecording && isSpeaking ? (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-mono animate-pulse">
            <span>Calm Narrator speaking...</span>
          </div>
        ) : null}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto flex-wrap justify-end">
        {/* Manual Stop Recognition Button */}
        {hasActiveRecognition && (
          <button
            onClick={() => {
              audioFX.playPinchTrigger?.();
              onStopRecognition();
            }}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-space transition-all duration-200 border bg-rose-500/25 text-rose-200 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.4)] font-bold cursor-pointer hover:bg-rose-500/40 animate-pulse active:scale-95"
            title="Stop current identification and dismiss cards"
          >
            <OctagonX className="w-3.5 h-3.5 text-rose-300" />
            <span className="font-mono text-[10px] sm:text-[11px]">STOP</span>
          </button>
        )}

        {/* Record Session Start / Stop Button */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onToggleRecording();
          }}
          className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-space transition-all duration-200 border active:scale-95 ${
            isRecording
              ? 'bg-red-500/30 text-red-200 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] font-bold'
              : 'glass-button text-slate-300 hover:text-white border-white/10 hover:border-red-500/40'
          }`}
          title={isRecording ? 'Click to Stop Recording' : 'Start AR Session Recording'}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
              <span className="font-mono text-[10px] sm:text-[11px]">STOP</span>
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              <span className="font-mono text-[10px] sm:text-[11px]">REC</span>
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
            className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 min-h-[36px] rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-mono shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95"
            title="Review & Download Saved Video Clip"
          >
            <Film className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden md:inline">Clip</span>
          </button>
        )}

        {/* Camera Switch */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onSwitchCamera();
          }}
          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl glass-button text-slate-300 hover:text-white border-white/10 active:scale-95"
          title="Switch Camera (Front / Back)"
          aria-label="Switch Camera"
        >
          <SwitchCamera className="w-4 h-4 text-cyan-300" />
        </button>

        {/* Scenarios / Simulation Bench */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onOpenSimulation();
          }}
          className="p-2 sm:px-2.5 sm:py-1.5 min-h-[36px] flex items-center justify-center gap-1 rounded-xl glass-button text-slate-300 hover:text-white border-white/10 text-xs font-space active:scale-95"
          title="Interactive Test Scenarios & Uploads"
          aria-label="Interactive Test Scenarios"
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
          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl glass-button text-slate-300 hover:text-white border-white/10 active:scale-95"
          title="Gesture Guide & Tutorial"
          aria-label="Gesture Guide & Tutorial"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Settings Modal */}
        <button
          onClick={() => {
            audioFX.playPinchTrigger?.();
            onOpenSettings();
          }}
          className="relative p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl glass-button text-slate-300 hover:text-white border-white/10 active:scale-95"
          title="Settings & API Keys"
          aria-label="Settings & API Keys"
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

