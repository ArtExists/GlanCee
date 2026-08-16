import React, { useState } from 'react';
import { IdentifiedCard } from '../../types';
import { Volume2, VolumeX, ExternalLink, ChevronDown, ChevronUp, X, Sparkles, BookOpen } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';

interface AnchoredCardProps {
  card: IdentifiedCard;
  index: number;
  totalCards: number;
  onDismiss: (id: string) => void;
  isSpeakingThis: boolean;
  onPlayVoice: (card: IdentifiedCard) => void;
  onStopVoice: () => void;
}

export const AnchoredCard: React.FC<AnchoredCardProps> = ({
  card,
  index,
  totalCards,
  onDismiss,
  isSpeakingThis,
  onPlayVoice,
  onStopVoice,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleVoice = () => {
    if (isSpeakingThis) {
      onStopVoice();
    } else {
      audioFX.playVoiceTriggerSound();
      onPlayVoice(card);
    }
  };

  const handleToggleExpand = () => {
    audioFX.playCardReveal();
    setIsExpanded(!isExpanded);
  };

  // Calculate screen anchor position near the bounding box
  const box = card.box;
  const leftPercent = Math.min(65, Math.max(5, (box.x + box.width) * 100));
  const topPercent = Math.min(65, Math.max(12, box.y * 100 + index * 6));

  const confidenceBadgeStyles = {
    high: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  }[card.confidence];

  return (
    <div
      className="absolute z-30 transition-all duration-300 ease-out pointer-events-auto"
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        maxWidth: '380px',
        width: 'calc(100vw - 32px)',
      }}
    >
      {/* Visual Anchor Indicator Pointer */}
      <div className="relative">
        <div className="absolute -left-3 top-5 w-3 h-[2px] bg-cyan-400/80 shadow-[0_0_8px_#00f0ff] hidden md:block" />
        <div className="absolute -left-4 top-4 w-2 h-2 rounded-full bg-cyan-400 border border-white/60 shadow-[0_0_8px_#00f0ff] hidden md:block animate-ping" />

        {/* Card Container */}
        <div className="glass-panel-glow rounded-2xl p-4 sm:p-5 text-slate-100 shadow-2xl backdrop-blur-xl border border-cyan-400/30 overflow-hidden relative group">
          {/* Subtle Cyber Background Gradient */}
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-300 border-cyan-400/30">
                  <Sparkles className="w-3 h-3 text-cyan-300" />
                  {card.mode === 'HOLDING' ? 'Holding' : 'Framed'}
                </span>
                <span className={`inline-flex items-center text-[10px] font-mono tracking-wide uppercase px-2 py-0.5 rounded-full border ${confidenceBadgeStyles}`}>
                  {card.confidence === 'high' ? 'High Confidence (98%)' : `${card.confidence} confidence`}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-space text-white tracking-tight truncate">
                {card.label}
              </h3>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => {
                audioFX.playPinchTrigger();
                onDismiss(card.id);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Dismiss Card"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Calm Narrator Short Answer */}
          <div className="text-sm sm:text-[15px] leading-relaxed text-slate-200/90 font-sans mb-3.5">
            {card.shortAnswer}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              {/* Listen / Replay Voice Button */}
              <button
                onClick={handleToggleVoice}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium font-space tracking-wide transition-all ${
                  isSpeakingThis
                    ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,240,255,0.6)] animate-pulse'
                    : 'glass-button text-cyan-300 hover:text-white'
                }`}
              >
                {isSpeakingThis ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen</span>
                  </>
                )}
              </button>

              {/* Read More Toggle */}
              <button
                onClick={handleToggleExpand}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium font-space text-slate-300 hover:text-white glass-button"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>{isExpanded ? 'Less' : 'Read more'}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
              </button>
            </div>

            {/* Wikipedia Article Citation Link */}
            {card.wikiUrl && (
              <a
                href={card.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400/80 hover:text-cyan-300 hover:underline transition-colors"
                title={`Wikipedia: ${card.wikiTitle}`}
              >
                <span>Wikipedia</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Expanded Encyclopedic Details */}
          {isExpanded && (
            <div className="mt-3.5 pt-3 border-t border-white/10 text-xs sm:text-sm text-slate-300/90 leading-relaxed font-sans space-y-2.5 animate-fadeIn">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="text-[11px] font-mono text-cyan-300 mb-1 flex items-center gap-1.5">
                  <span>WIKIPEDIA GROUNDING</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{card.wikiTitle}</span>
                </div>
                <p className="text-slate-200">{card.expandedText}</p>
              </div>

              {card.wikiThumbnail && (
                <div className="flex items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                  <img
                    src={card.wikiThumbnail}
                    alt={card.wikiTitle}
                    className="w-12 h-12 object-cover rounded-lg border border-white/10"
                  />
                  <div className="text-[11px] text-slate-400">
                    <div className="font-medium text-slate-200">{card.wikiTitle}</div>
                    <div>Referenced from encyclopedia records</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stack count indicator if multiple cards exist */}
          {totalCards > 1 && (
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-slate-500">
              {index + 1} / {totalCards}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
