// Lightweight confirmation card for reviewing, downloading, or discarding recorded AR sessions

import React from 'react';
import { RecordedSession } from '../../types';
import { Download, Trash2, X, Film, CheckCircle2 } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface RecordingReadyCardProps {
  session: RecordedSession;
  onDownload: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

export const RecordingReadyCard: React.FC<RecordingReadyCardProps> = ({
  session,
  onDownload,
  onDiscard,
  onClose,
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownloadClick = () => {
    audioFX.playPinchTrigger();
    onDownload();
  };

  const handleDiscardClick = () => {
    audioFX.playPinchTrigger();
    onDiscard();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel-glow relative w-full max-w-lg rounded-3xl p-4 sm:p-6 text-slate-100 border border-cyan-400/40 shadow-2xl bg-[#060b18]/95 overflow-y-auto max-h-[92dvh]">
        {/* Glow Accent */}
        <div className="absolute -right-16 -top-16 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-space font-bold text-white tracking-tight">
                  Recording Ready
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" />
                  Saved to Cache
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Baked video with camera feed, AR bounding boxes, popups & voice audio.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              audioFX.playPinchTrigger();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Preview Player */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-cyan-500/20 mb-4 aspect-video flex items-center justify-center group">
          <video
            src={session.url}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Metadata Details Bar */}
        <div className="grid grid-cols-3 gap-2 mb-5 p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase">Duration</div>
            <div className="text-sm font-mono font-bold text-cyan-300">
              {formatDuration(session.duration)}
            </div>
          </div>
          <div className="border-x border-white/10">
            <div className="text-[10px] font-mono text-slate-400 uppercase">File Size</div>
            <div className="text-sm font-mono font-bold text-emerald-300">
              {formatFileSize(session.size)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase">Format</div>
            <div className="text-sm font-mono font-bold text-slate-200">
              WebM / VP9
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={handleDownloadClick}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-space font-bold text-sm hover:opacity-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Video</span>
          </button>

          <button
            onClick={handleDiscardClick}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl glass-button text-slate-400 hover:text-red-400 hover:border-red-500/40 text-xs font-space transition-colors cursor-pointer"
            title="Discard cached recording"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        </div>

        <div className="mt-3 text-center">
          <span className="text-[11px] font-mono text-slate-500">
            Cached in IndexedDB until next recording starts.
          </span>
        </div>
      </div>
    </div>
  );
};
