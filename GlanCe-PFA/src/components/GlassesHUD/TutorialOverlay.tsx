import React from 'react';
import { X, Hand, Eye, Mic, Sparkles } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="glass-panel-glow bg-[#080d1a]/95 rounded-3xl w-full max-w-lg p-6 border border-cyan-400/40 text-slate-100 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-space text-white">How Glance Works</h2>
              <p className="text-xs text-slate-400 font-sans">Hands-free smart-glasses visual interaction</p>
            </div>
          </div>
          <button
            onClick={() => {
              audioFX.playPinchTrigger?.();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Core Interactions */}
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Interaction 1: What I'm Holding */}
          <div className="bg-black/40 p-4 rounded-2xl border border-white/10 flex gap-3.5 items-start">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shrink-0 mt-0.5">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-space text-white mb-1">1. "What I'm Holding" Mode</h3>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Hold any object up in your hand. Glance uses hand landmark tracking to locate your palm and anchors an automated Region of Interest (ROI) right around the held item, isolating it from background clutter.
              </p>
            </div>
          </div>

          {/* Interaction 2: What I'm Looking At */}
          <div className="bg-black/40 p-4 rounded-2xl border border-white/10 flex gap-3.5 items-start">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 shrink-0 mt-0.5">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-space text-white mb-1">2. "What I'm Looking At" Mode</h3>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Form an "L" shape with thumb and index fingers on both hands to create a classic director's framing square around anything you want to inspect. The app tracks the bounding box across your fingertips.
              </p>
            </div>
          </div>

          {/* Interaction 3: Voice & Calm Narrator */}
          <div className="bg-black/40 p-4 rounded-2xl border border-white/10 flex gap-3.5 items-start">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-400/30 shrink-0 mt-0.5">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-space text-white mb-1">3. Point, Frame, Ask</h3>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Hold steady for ~1 second or simply speak: <span className="text-cyan-300 font-mono">"What's this"</span>, <span className="text-cyan-300 font-mono">"Capture"</span>, or <span className="text-cyan-300 font-mono">"Explain this"</span>. An anchored floating card appears with audio narration and Wikipedia citations.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={() => {
              audioFX.playPinchTrigger?.();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-cyan-400 text-slate-950 font-space font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
          >
            Got it! Let's Glance
          </button>
        </div>
      </div>
    </div>
  );
};
