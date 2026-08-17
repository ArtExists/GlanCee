import React, { useState } from 'react';
import { AppSettings } from '../../types';
import { X, Key, Volume2, Sliders, ShieldCheck, Sparkles, Check, Server, Mic } from 'lucide-react';
import { audioFX } from '../../services/audioEffects';
import { vlmService } from '../../services/vlmService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
}) => {
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey);
  const [mistralKey, setMistralKey] = useState(settings.mistralApiKey);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey);
  const [groqKey, setGroqKey] = useState(settings.groqApiKey);
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [isSaved, setIsSaved] = useState(false);
  const [isTestingMistral, setIsTestingMistral] = useState(false);
  const [mistralTestResult, setMistralTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTestMistral = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!mistralKey.trim()) {
      setMistralTestResult({ success: false, message: 'Please enter a Mistral API key first.' });
      return;
    }
    setIsTestingMistral(true);
    setMistralTestResult(null);
    const result = await vlmService.testMistralKey(mistralKey);
    setIsTestingMistral(false);
    setMistralTestResult(result);
    if (result.success) {
      audioFX.playCardReveal?.();
    }
  };


  if (!isOpen) return null;

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      anthropicApiKey: anthropicKey.trim(),
      mistralApiKey: mistralKey.trim(),
      geminiApiKey: geminiKey.trim(),
      openaiApiKey: openaiKey.trim(),
      groqApiKey: groqKey.trim(),
      backendUrl: backendUrl.trim(),
    });
    audioFX.playPinchTrigger();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="glass-panel-glow bg-[#080d1a]/95 rounded-3xl w-full max-w-lg p-6 border border-cyan-400/40 text-slate-100 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-space text-white">HUD Settings & Models</h2>
              <p className="text-xs text-slate-400 font-sans">
                Set API keys in <code className="text-cyan-300">.env</code> or directly below
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

        {/* Scrollable Content */}
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Key Summary Notice */}
          <div className="bg-cyan-500/10 border border-cyan-400/30 p-3.5 rounded-2xl text-xs space-y-1.5">
            <div className="font-space font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Active Model Engine:</span>
            </div>
            <ul className="list-disc list-inside text-slate-300 space-y-1 font-sans text-[11px]">
              <li>
                <strong className="text-white">Vision & Reasoner:</strong> Mistral AI (Pixtral 12B / Large + Mistral LLM)
              </li>
              <li>
                <strong className="text-white">Speech STT:</strong> Web Speech API / Whisper (OpenAI / Groq)
              </li>
            </ul>
          </div>

          {/* API Keys Configuration Form */}
          <form onSubmit={handleSaveKeys} className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wider">
              <Key className="w-4 h-4 text-cyan-300" />
              <span>Vision & Speech API Keys</span>
            </div>

            {/* Mistral Pixtral Key */}
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
              <label className="block text-xs font-medium text-cyan-200 mb-1 flex items-center justify-between">
                <span>Mistral API Key (Pixtral Vision & Calm Narrator)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">Active VLM</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={mistralKey}
                  onChange={(e) => setMistralKey(e.target.value)}
                  placeholder="mis_..."
                  className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-cyan-400/40 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-300 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestMistral}
                  disabled={isTestingMistral}
                  className="px-3 py-2 rounded-xl text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 transition-all font-semibold disabled:opacity-50"
                >
                  {isTestingMistral ? 'Testing...' : 'Test Key'}
                </button>
              </div>
              {mistralTestResult && (
                <div
                  className={`mt-2 p-2 rounded-lg text-[11px] font-mono border flex items-center gap-1.5 ${
                    mistralTestResult.success
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{mistralTestResult.success ? '✅' : '❌'}</span>
                  <span>{mistralTestResult.message}</span>
                </div>
              )}
            </div>


            {/* Anthropic Claude Key */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Anthropic API Key (Claude 3.5 Sonnet Vision Fallback)
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>

            {/* OpenAI Key (Whisper + GPT-4o) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>OpenAI API Key (Whisper STT + GPT-4o Vision)</span>
                <span className="text-[10px] font-mono text-emerald-400">Whisper & VLM</span>
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>

            {/* Groq Key (Fastest Whisper) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Groq API Key (Sub-200ms Whisper Large v3)</span>
                <span className="text-[10px] font-mono text-cyan-400">Ultra-fast STT</span>
              </label>
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>

            {/* Google Gemini Key */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Google Gemini API Key (Gemini 1.5 / 2.0 Flash)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>

            {/* Python Backend URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Python Backend Server URL</span>
              </label>
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Saved locally or via .env file</span>
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-space font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              >
                {isSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Keys</span>
                )}
              </button>
            </div>
          </form>

          {/* Voice & Calm Narrator Settings */}
          <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 uppercase tracking-wider">
              <Volume2 className="w-4 h-4 text-emerald-300" />
              <span>Voice & Voice Commands</span>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs text-slate-200">Auto-Read Answers (Calm Narrator TTS)</span>
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => onUpdateSettings({ autoSpeak: e.target.checked })}
                className="accent-cyan-400 w-4 h-4 rounded"
              />
            </label>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Voice Rate / Speed</span>
                <span className="font-mono text-cyan-300">{settings.voiceRate}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={settings.voiceRate}
                onChange={(e) => onUpdateSettings({ voiceRate: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Voice Command Reference */}
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1 text-[11px] text-slate-300 font-mono">
              <div className="text-cyan-300 font-bold flex items-center gap-1">
                <Mic className="w-3 h-3" /> Supported Voice Commands:
              </div>
              <div>• <span className="text-white">"Stop"</span> / <span className="text-white">"Quiet"</span> → Immediately stops speech</div>
              <div>• <span className="text-white">"What's this"</span> / <span className="text-white">"Capture"</span> → Identifies target</div>
              <div>• <span className="text-white">"Tell me more"</span> → Expands Wikipedia summary</div>
              <div>• <span className="text-white">"Clear"</span> → Dismisses floating cards</div>
            </div>
          </div>

          {/* Gesture Controls */}
          <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Gesture & Stability</span>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-xs text-slate-200 block">Auto-Capture on Stability</span>
                <span className="text-[11px] text-slate-400 block">Captures automatically after ~1s steady hold</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCaptureStability}
                onChange={(e) => onUpdateSettings({ autoCaptureStability: e.target.checked })}
                className="accent-cyan-400 w-4 h-4 rounded"
              />
            </label>

            <div className="pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  audioFX.playPinchTrigger();
                }}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline font-space"
              >
                Clear all active popup cards & history
              </button>
            </div>
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
