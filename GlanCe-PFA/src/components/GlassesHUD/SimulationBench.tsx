import React, { useRef } from 'react';
import { SimulationPreset } from '../../types';
import { X, Upload, Camera, Sparkles } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface SimulationBenchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: SimulationPreset) => void;
  onCustomImageUpload: (dataUrl: string) => void;
  onSwitchToLiveCamera: () => void;
  isLiveCameraActive: boolean;
}

export const PRESET_SCENARIOS: SimulationPreset[] = [
  {
    id: 'mobile_phone',
    title: 'Mobile Phone (Smartphone)',
    mode: 'HOLDING',
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1000&auto=format&fit=crop&q=80',
    defaultBox: { x: 0.28, y: 0.22, width: 0.44, height: 0.56 },
    fallbackIdentification: {
      label: 'Mobile Phone',
      confidence: 'high',
      search_query: 'Mobile phone',
      provider: 'Smart Knowledge',
    },
    fallbackWiki: {
      title: 'Mobile phone',
      extract: 'A mobile phone (or cellular phone, cell phone, or smartphone) is a portable telephone that can make and receive calls over a radio frequency link while the user is moving within a telephone service area. Modern smartphones integrate advanced mobile computing capabilities.',
      description: 'Portable telecommunication device',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&auto=format&fit=crop&q=80',
      contentUrl: 'https://en.wikipedia.org/wiki/Mobile_phone',
    },
    fallbackShortAnswer: 'A mobile phone is a portable telecommunication and computing device. It connects via cellular radio networks and provides high-speed internet, sensing, and multimedia capabilities.',
  },
  {
    id: 'laptop',
    title: 'Laptop Computer',
    mode: 'LOOKING_AT',
    imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1000&auto=format&fit=crop&q=80',
    defaultBox: { x: 0.18, y: 0.2, width: 0.64, height: 0.58 },
    fallbackIdentification: {
      label: 'Laptop',
      confidence: 'high',
      search_query: 'Laptop',
      provider: 'Smart Knowledge',
    },
    fallbackWiki: {
      title: 'Laptop',
      extract: 'A laptop computer or notebook computer is a small, portable personal computer with a screen and alphanumeric keyboard. Modern laptops are capable of rich productivity, software development, and multimedia processing.',
      description: 'Portable personal computer',
      thumbnailUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&auto=format&fit=crop&q=80',
      contentUrl: 'https://en.wikipedia.org/wiki/Laptop',
    },
    fallbackShortAnswer: 'A laptop is a compact personal computer designed for portable productivity. It integrates an alphanumeric keyboard, display, trackpad, and rechargeable battery.',
  },
  {
    id: 'watch',
    title: 'Wristwatch (Timepiece)',
    mode: 'HOLDING',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1000&auto=format&fit=crop&q=80',
    defaultBox: { x: 0.28, y: 0.22, width: 0.44, height: 0.55 },
    fallbackIdentification: {
      label: 'Wristwatch',
      confidence: 'high',
      search_query: 'Watch',
      provider: 'Smart Knowledge',
    },
    fallbackWiki: {
      title: 'Watch',
      extract: 'A watch is a portable timepiece intended to be carried or worn by a person. It is designed to keep a consistent movement despite the motions caused by the person\'s activities.',
      description: 'Timepiece intended to be worn',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300&auto=format&fit=crop&q=80',
      contentUrl: 'https://en.wikipedia.org/wiki/Watch',
    },
    fallbackShortAnswer: 'A wristwatch is a precision personal timepiece worn on the wrist. It continuously tracks the passage of time through mechanical or electronic oscillation.',
  },
  {
    id: 'monstera',
    title: 'Houseplant (Potted Plant)',
    mode: 'LOOKING_AT',
    imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=1000&auto=format&fit=crop&q=80',
    defaultBox: { x: 0.22, y: 0.18, width: 0.55, height: 0.6 },
    fallbackIdentification: {
      label: 'Houseplant',
      confidence: 'high',
      search_query: 'Houseplant',
      provider: 'Smart Knowledge',
    },
    fallbackWiki: {
      title: 'Houseplant',
      extract: 'A houseplant, sometimes known as a pot plant or indoor plant, is an ornamental plant that is grown indoors in places such as residences and offices, often for decorative or air-purifying purposes.',
      description: 'Plant grown indoors',
      thumbnailUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=300&auto=format&fit=crop&q=80',
      contentUrl: 'https://en.wikipedia.org/wiki/Houseplant',
    },
    fallbackShortAnswer: 'A houseplant cultivated in an indoor setting. Indoor plants provide aesthetic ambiance and naturally contribute to ambient humidity and air quality.',
  },
  {
    id: 'empty_hand',
    title: 'Empty Hand (No Object)',
    mode: 'HOLDING',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1000&auto=format&fit=crop&q=80',
    defaultBox: { x: 0.3, y: 0.25, width: 0.4, height: 0.5 },
    fallbackIdentification: {
      hasObject: false,
      label: 'No Object Detected',
      confidence: 'high',
      search_query: '',
      provider: 'Smart Knowledge',
    },
    fallbackWiki: {
      title: 'Empty View',
      extract: 'No object was detected in your hand or framed view.',
      description: 'Empty view',
      thumbnailUrl: '',
      contentUrl: 'https://en.wikipedia.org/wiki/Computer_vision',
    },
    fallbackShortAnswer: 'No distinct object was detected in your hand or framed view. Place an object in view.',
  },
];

export const SimulationBench: React.FC<SimulationBenchProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  onCustomImageUpload,
  onSwitchToLiveCamera,
  isLiveCameraActive,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          audioFX.playCardReveal();
          onCustomImageUpload(ev.target.result as string);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="glass-panel-glow bg-[#080d1a]/95 rounded-3xl w-full max-w-2xl p-4 sm:p-6 border border-cyan-400/40 text-slate-100 shadow-2xl overflow-hidden relative max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-space text-white">Interactive Test Scenarios</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-sans">
                Test hands-free framing, holding ROIs, Wikipedia RAG, and calm narrator voice
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioFX.playPinchTrigger();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Camera Quick Return Button */}
        <div className="mb-5">
          <button
            onClick={() => {
              audioFX.playTargetLock();
              onSwitchToLiveCamera();
              onClose();
            }}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-space font-medium text-xs sm:text-sm tracking-wide transition-all ${
              isLiveCameraActive
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.3)] font-semibold'
                : 'glass-button text-slate-200 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4 text-cyan-300" />
            <span>Switch to Live WebCam Feed</span>
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {PRESET_SCENARIOS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => {
                audioFX.playCardReveal();
                onSelectPreset(preset);
                onClose();
              }}
              className="group relative rounded-2xl overflow-hidden border border-white/15 bg-black/40 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] transition-all cursor-pointer p-3 flex gap-3 items-center"
            >
              <img
                src={preset.imageUrl}
                alt={preset.title}
                className="w-16 h-16 rounded-xl object-cover border border-white/10 group-hover:scale-105 transition-transform"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/20">
                  {preset.mode === 'HOLDING' ? 'Holding ROI' : 'Framing Square'}
                </span>
                <h4 className="text-xs sm:text-sm font-bold font-space text-white truncate mt-1">
                  {preset.fallbackIdentification.label}
                </h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {preset.title}
                </p>
              </div>
            </div>
          ))}

          {/* Custom Image Upload Tile */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-cyan-400/40 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400 transition-all cursor-pointer p-4 flex flex-col items-center justify-center text-center gap-1.5 sm:col-span-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-xs font-space font-bold text-white">Upload Custom Photo / Snapshot</span>
            <span className="text-[11px] text-slate-400">
              Test identification on any object image from your computer
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={() => {
              audioFX.playPinchTrigger();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-space font-medium text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
