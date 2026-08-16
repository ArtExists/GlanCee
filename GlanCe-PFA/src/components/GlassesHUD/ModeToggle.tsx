import React from 'react';
import { AppMode } from '../../types';
import { Hand, Eye } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface ModeToggleProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ currentMode, onModeChange }) => {
  const handleSelect = (mode: AppMode) => {
    if (mode !== currentMode) {
      audioFX.playPinchTrigger?.();
      onModeChange(mode);
    }
  };

  return (
    <div className="flex items-center justify-center p-1.5 rounded-2xl glass-panel-glow bg-black/60 border border-cyan-400/30 shadow-2xl backdrop-blur-2xl">
      <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm sm:max-w-md">
        {/* Mode 1: What I'm Holding */}
        <button
          onClick={() => handleSelect('HOLDING')}
          className={`relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-space font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 ${
            currentMode === 'HOLDING'
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.35)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Hand className={`w-4 h-4 ${currentMode === 'HOLDING' ? 'text-cyan-300' : 'text-slate-400'}`} />
          <span className="truncate">What I'm Holding</span>
          {currentMode === 'HOLDING' && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
          )}
        </button>

        {/* Mode 2: What I'm Looking At */}
        <button
          onClick={() => handleSelect('LOOKING_AT')}
          className={`relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-space font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 ${
            currentMode === 'LOOKING_AT'
              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 shadow-[0_0_15px_rgba(0,255,157,0.35)] font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Eye className={`w-4 h-4 ${currentMode === 'LOOKING_AT' ? 'text-emerald-300' : 'text-slate-400'}`} />
          <span className="truncate">What I'm Looking At</span>
          {currentMode === 'LOOKING_AT' && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00ff9d]" />
          )}
        </button>
      </div>
    </div>
  );
};
