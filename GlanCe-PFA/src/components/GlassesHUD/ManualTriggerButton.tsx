import React from 'react';
import { Camera, Sparkles, Mic } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface ManualTriggerButtonProps {
  isProcessing: boolean;
  onTriggerCapture: () => void;
  statusMessage?: string;
}

export const ManualTriggerButton: React.FC<ManualTriggerButtonProps> = ({
  isProcessing,
  onTriggerCapture,
  statusMessage,
}) => {
  const handleClick = () => {
    if (isProcessing) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch {
      // ignore
    }
    audioFX.playTargetLock?.();
    onTriggerCapture();
  };

  return (
    <div className="flex flex-col items-center gap-2 pointer-events-auto">
      {/* Dynamic Status / Voice Cue Pill */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full glass-panel bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 backdrop-blur-md">
        <Mic className="w-3 h-3 text-cyan-400 animate-pulse" />
        <span>{statusMessage || 'Say "What\'s this" or tap capture'}</span>
      </div>

      {/* Main Tactile Capture Shutter Button */}
      <button
        onClick={handleClick}
        disabled={isProcessing}
        className={`group relative flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 rounded-full transition-all duration-300 ${
          isProcessing
            ? 'opacity-80 scale-95 cursor-not-allowed'
            : 'hover:scale-105 active:scale-95'
        }`}
        title="Tap to Identify"
      >
        {/* Outer glowing pulsing halo */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 opacity-70 blur-md group-hover:opacity-100 transition-opacity animate-pulse-slow" />

        {/* Ring outline */}
        <div className="absolute -inset-1 rounded-full border border-cyan-300/40" />

        {/* Inner button surface */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950 border-2 border-white/80 flex items-center justify-center shadow-inner overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/20 to-transparent" />
          
          {isProcessing ? (
            <Sparkles className="w-6 h-6 text-cyan-300 animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-cyan-300 group-hover:text-white transition-colors" />
          )}
        </div>
      </button>
    </div>
  );
};
