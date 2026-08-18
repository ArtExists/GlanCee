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
    <div className="flex flex-col items-stretch p-1.5 sm:p-2 rounded-2xl glass-panel-glow bg-black/80 border border-cyan-400/30 shadow-2xl backdrop-blur-2xl transition-all w-[135px] sm:w-[155px] gap-1.5 select-none">
      <div className="px-1.5 pt-0.5 pb-0.5 flex items-center justify-between text-[9px] font-mono tracking-widest text-cyan-400/70 uppercase">
        <span>MODE</span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
      </div>

      {/* Mode 1: What I'm Holding */}
      <button
        onClick={() => handleSelect('HOLDING')}
        className={`relative flex items-center gap-2 py-2 px-2.5 min-h-[38px] rounded-xl font-space font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 active:scale-95 text-left ${
          currentMode === 'HOLDING'
            ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.35)] font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
        }`}
      >
        <Hand className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${currentMode === 'HOLDING' ? 'text-cyan-300' : 'text-slate-400'}`} />
        <span className="truncate">Holding</span>
        {currentMode === 'HOLDING' && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
        )}
      </button>

      {/* Mode 2: What I'm Looking At */}
      <button
        onClick={() => handleSelect('LOOKING_AT')}
        className={`relative flex items-center gap-2 py-2 px-2.5 min-h-[38px] rounded-xl font-space font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 active:scale-95 text-left ${
          currentMode === 'LOOKING_AT'
            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 shadow-[0_0_15px_rgba(0,255,157,0.35)] font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
        }`}
      >
        <Eye className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${currentMode === 'LOOKING_AT' ? 'text-emerald-300' : 'text-slate-400'}`} />
        <span className="truncate">Looking At</span>
        {currentMode === 'LOOKING_AT' && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00ff9d]" />
        )}
      </button>

      {/* Sub-Toggle for "What I'm Looking At": 2-Hand Framing vs Reverse-Pinch */}
      {currentMode === 'LOOKING_AT' && (
        <div className="flex flex-col gap-1 pt-1.5 border-t border-emerald-500/20 w-full animate-fadeIn">
          <button
            onClick={() => handleFramingSelect('FINGERS_FRAME')}
            className={`flex items-center gap-1.5 px-2 py-1.5 min-h-[28px] rounded-lg text-[10px] sm:text-[11px] font-mono transition-all active:scale-95 text-left ${
              framingStyle === 'FINGERS_FRAME'
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_10px_rgba(0,255,157,0.3)] font-bold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            title="Frame with fingers from two hands (L-shapes)"
          >
            <Maximize2 className="w-3 h-3 shrink-0" />
            <span className="truncate">2-Hand Frame</span>
          </button>

          <button
            onClick={() => handleFramingSelect('REVERSE_PINCH')}
            className={`flex items-center gap-1.5 px-2 py-1.5 min-h-[28px] rounded-lg text-[10px] sm:text-[11px] font-mono transition-all active:scale-95 text-left ${
              framingStyle === 'REVERSE_PINCH'
                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_10px_rgba(0,255,157,0.3)] font-bold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            title="Reverse-pinch / spread thumb and index finger to create bounding box"
          >
            <Scan className="w-3 h-3 shrink-0" />
            <span className="truncate">Reverse Pinch</span>
          </button>
        </div>
      )}
    </div>
  );
};

