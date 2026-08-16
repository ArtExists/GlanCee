import React, { useEffect, useState } from 'react';
import { Volume2, Mic } from 'lucide-react';

interface VoiceIndicatorProps {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  isListening,
  isSpeaking,
  transcript,
}) => {
  const [waveHeights, setWaveHeights] = useState<number[]>([4, 8, 12, 6, 14, 10, 5, 9, 13, 7]);

  // Audio waveform animation when listening or speaking
  useEffect(() => {
    if (!isListening && !isSpeaking) return;

    const interval = setInterval(() => {
      setWaveHeights(
        Array.from({ length: 12 }, () =>
          isSpeaking ? Math.floor(Math.random() * 18) + 6 : isListening ? Math.floor(Math.random() * 12) + 4 : 4
        )
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  if (!isListening && !isSpeaking && !transcript) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-md w-[90%] sm:w-auto pointer-events-none transition-all duration-300">
      <div className="glass-panel-glow bg-black/75 rounded-2xl px-4 py-2 flex items-center gap-3 border border-cyan-400/30 shadow-xl backdrop-blur-xl">
        {/* Animated Waveform Visualizer */}
        <div className="flex items-center gap-0.5 h-6">
          {waveHeights.map((h, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                isSpeaking
                  ? 'bg-gradient-to-t from-cyan-400 to-emerald-300'
                  : 'bg-cyan-400/80'
              }`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Status Text & Live Transcript */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-300">
            {isSpeaking ? (
              <>
                <Volume2 className="w-3 h-3 text-cyan-300 animate-pulse" />
                <span>Calm Narrator Output</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3 text-emerald-300 animate-pulse" />
                <span>Voice Stream Active</span>
              </>
            )}
          </div>
          {transcript && (
            <p className="text-xs text-white font-sans truncate font-medium mt-0.5">
              "{transcript}"
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
