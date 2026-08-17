import React from 'react';
import { AppMode, LookingAtFramingStyle } from '../../types';
import { Hand, Eye, Scan, Maximize2 } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface ModeToggleProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  framingStyle?: LookingAtFramingStyle;
  onFramingStyleChange?: (style: LookingAtFramingStyle) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  currentMode,
  onModeChange,
  framingStyle = 'FINGERS_FRAME',
  onFramingStyleChange,
}) => {
  const handleSelect = (mode: AppMode) => {
    if (mode !== currentMode) {
      audioFX.playPinchTrigger?.();
      onModeChange(mode);
    }
  };

  const handleFramingSelect = (style: LookingAtFramingStyle) => {
    if (style !== framingStyle) {
      audioFX.playPinchTrigger?.();
      onFramingStyleChange?.(style);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-1.5 rounded-2xl glass-panel-glow bg-black/60 border border-cyan-400/30 shadow-2xl backdrop-blur-2xl transition-all">
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

      {/* Sub-Toggle for "What I'm Looking At": 2-Hand Framing vs Reverse-Pinch */}
      {currentMode === 'LOOKING_AT' && (
        <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-emerald-500/20 w-full max-w-sm sm:max-w-md animate-fadeIn">
          <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider hidden xs:inline">
            BOX METHOD:
          </span>
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => handleFramingSelect('FINGERS_FRAME')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                framingStyle === 'FINGERS_FRAME'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_10px_rgba(0,255,157,0.3)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Frame with fingers from two hands (L-shapes)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fingers Frame (2-Hand)</span>
            </button>

            <button
              onClick={() => handleFramingSelect('REVERSE_PINCH')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                framingStyle === 'REVERSE_PINCH'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_10px_rgba(0,255,157,0.3)] font-bold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              title="Reverse-pinch / spread thumb and index finger to create bounding box"
            >
              <Scan className="w-3 h-3" />
              <span>Reverse-Pinch (1/2 Hand)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

