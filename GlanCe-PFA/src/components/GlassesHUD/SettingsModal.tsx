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
}) => {
  const [qwenKey, setQwenKey] = useState(settings.qwenApiKey || '');
  const [qwenBaseUrl, setQwenBaseUrl] = useState(settings.qwenApiBaseUrl || 'https://router.huggingface.co/hf-inference/v1');
  const [qwenModel, setQwenModel] = useState(settings.qwenModel || 'Qwen/Qwen2.5-VL-3B-Instruct');

  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey);
  const [mistralKey, setMistralKey] = useState(settings.mistralApiKey);
  const [geminiKey, setGeminiKey] = useState(settings.geminiApiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey);
  const [groqKey, setGroqKey] = useState(settings.groqApiKey);
  const [backendUrl, setBackendUrl] = useState(settings.backendUrl);
  const [isSaved, setIsSaved] = useState(false);

  const [isTestingQwen, setIsTestingQwen] = useState(false);
  const [qwenTestResult, setQwenTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const [isTestingMistral, setIsTestingMistral] = useState(false);
  const [mistralTestResult, setMistralTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTestQwen = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTestingQwen(true);
    setQwenTestResult(null);
    const result = await vlmService.testQwenKey(qwenKey, qwenBaseUrl, qwenModel);
    setIsTestingQwen(false);
    setQwenTestResult(result);
    if (result.success) {
      audioFX.playCardReveal?.();
    }
  };

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
      qwenApiKey: qwenKey.trim(),
      qwenApiBaseUrl: qwenBaseUrl.trim(),
      qwenModel: qwenModel.trim(),
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
                Primary VLM: <strong className="text-cyan-300">Qwen 2.5-VL 3B Instruct</strong>
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
              <span>Active Architecture:</span>
            </div>
            <ul className="list-disc list-inside text-slate-300 space-y-1 font-sans text-[11px]">
              <li>
                <strong className="text-white">Primary Vision (VLM):</strong> Qwen 2.5-VL 3B Instruct
              </li>
              <li>
                <strong className="text-white">Knowledge Grounding:</strong> Wikipedia REST API (Official Summary & Articles)
              </li>
              <li>
                <strong className="text-white">Calm Narrator Audio:</strong> Qwen / Web Speech API / Whisper STT
              </li>
            </ul>
          </div>

          {/* API Keys Configuration Form */}
          <form onSubmit={handleSaveKeys} className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wider">
              <Key className="w-4 h-4 text-cyan-300" />
              <span>Qwen 2.5-VL & Vision Model Keys</span>
            </div>

            {/* Qwen 2.5-VL 3B Instruct (Primary Model) */}
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                  <span>Qwen 2.5-VL 3B Instruct</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-400/30 text-cyan-200 border border-cyan-400/40">
                    Primary VLM
                  </span>
                </label>
              </div>

              {/* Endpoint Preset Selector */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Endpoint Provider Preset:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQwenBaseUrl('https://router.huggingface.co/hf-inference/v1');
                      setQwenModel('Qwen/Qwen2.5-VL-3B-Instruct');
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all text-center ${
                      qwenBaseUrl.includes('huggingface.co')
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Hugging Face
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQwenBaseUrl('https://openrouter.ai/api/v1');
                      setQwenModel('qwen/qwen-2.5-vl-72b-instruct:free');
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all text-center ${
                      qwenBaseUrl.includes('openrouter.ai')
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    OpenRouter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQwenBaseUrl('http://localhost:11434/v1');
                      setQwenModel('qwen2.5-vl:3b');
                    }}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all text-center ${
                      qwenBaseUrl.includes('localhost:11434')
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Local Ollama
                  </button>
                </div>
              </div>

              {/* API Key Input */}
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">API Key / Token (HF / OpenRouter / DashScope)</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={qwenKey}
                    onChange={(e) => setQwenKey(e.target.value)}
                    placeholder="hf_... or sk-or-..."
                    className="flex-1 px-3 py-2 rounded-xl bg-black/70 border border-cyan-400/40 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-300 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestQwen}
                    disabled={isTestingQwen}
                    className="px-3 py-2 rounded-xl text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 transition-all font-semibold disabled:opacity-50"
                  >
                    {isTestingQwen ? 'Testing...' : 'Test Key'}
                  </button>
                </div>
              </div>

              {/* Advanced Model & Base URL inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Model Identifier</label>
                  <input
                    type="text"
                    value={qwenModel}
                    onChange={(e) => setQwenModel(e.target.value)}
                    placeholder="Qwen/Qwen2.5-VL-3B-Instruct"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-0.5">API Base URL</label>
                  <input
                    type="text"
                    value={qwenBaseUrl}
                    onChange={(e) => setQwenBaseUrl(e.target.value)}
                    placeholder="https://router.huggingface.co/hf-inference/v1"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {qwenTestResult && (
                <div
                  className={`p-2 rounded-lg text-[11px] font-mono border flex items-center gap-1.5 ${
                    qwenTestResult.success
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{qwenTestResult.success ? '✅' : '❌'}</span>
                  <span>{qwenTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Mistral Pixtral Key (Secondary) */}
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span>Mistral API Key (Pixtral Vision Backup)</span>
                <span className="text-[10px] font-mono text-slate-400">Optional Backup</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={mistralKey}
                  onChange={(e) => setMistralKey(e.target.value)}
                  placeholder="mis_..."
                  className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestMistral}
                  disabled={isTestingMistral}
                  className="px-3 py-2 rounded-xl text-xs font-mono bg-white/10 text-slate-300 border border-white/20 hover:bg-white/20 transition-all font-semibold disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
};
