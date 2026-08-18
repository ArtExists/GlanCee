import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { AppMode, AppSettings, BoundingBox, IdentifiedCard, LookingAtFramingStyle, RecordedSession, SimulationPreset } from './types';
import { TopBar } from './components/GlassesHUD/TopBar';
import { ModeToggle } from './components/GlassesHUD/ModeToggle';
import { CameraViewport } from './components/GlassesHUD/CameraViewport';
import { AnchoredCard } from './components/GlassesHUD/AnchoredCard';
import { ManualTriggerButton } from './components/GlassesHUD/ManualTriggerButton';
import { SettingsModal } from './components/GlassesHUD/SettingsModal';
import { SimulationBench } from './components/GlassesHUD/SimulationBench';
import { TutorialOverlay } from './components/GlassesHUD/TutorialOverlay';
import { RecordingReadyCard } from './components/GlassesHUD/RecordingReadyCard';
import { vlmService } from './services/vlmService';
import { wikipediaService } from './services/wikipediaService';
import { speechService } from './services/speechService';
import { audioFX } from './services/audioEffects';
import { gestureDetector, GestureDetectionResult } from './services/gestureDetector';
import { recordingService } from './services/recordingService';
import { recordingStorage } from './services/recordingStorage';

const getEnvString = (keys: string[]): string => {
  const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
  for (const k of keys) {
    const meta = (import.meta.env as any)[k];
    if (meta && typeof meta === 'string' && meta.trim()) return meta.trim();
    if (g && g.process && g.process.env && g.process.env[k]) {
      const pVal = g.process.env[k];
      if (pVal && typeof pVal === 'string' && pVal.trim()) return pVal.trim();
    }
  }
  return '';
};

const DEFAULT_SETTINGS: AppSettings = {
  qwenApiKey: getEnvString([
    'VITE_QWEN_API_KEY',
    'QWEN_API_KEY',
    'VITE_HUGGINGFACE_API_KEY',
    'HUGGINGFACE_API_KEY',
    'VITE_HF_TOKEN',
    'HF_TOKEN',
    'VITE_HF_API_KEY',
    'HF_API_KEY',
    'HUGGING_FACE_HUB_TOKEN',
    'VITE_OPENROUTER_API_KEY',
    'OPENROUTER_API_KEY',
  ]),
  qwenApiBaseUrl: getEnvString(['VITE_QWEN_BASE_URL', 'QWEN_BASE_URL']) || 'https://router.huggingface.co/hf-inference/v1',
  qwenModel: getEnvString(['VITE_QWEN_MODEL', 'QWEN_MODEL']) || 'Qwen/Qwen2.5-VL-3B-Instruct',
  mistralApiKey: getEnvString(['VITE_MISTRAL_API_KEY', 'MISTRAL_API_KEY']),
  anthropicApiKey: getEnvString(['VITE_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY']),
  geminiApiKey: getEnvString(['VITE_GEMINI_API_KEY', 'GEMINI_API_KEY']),
  openaiApiKey: getEnvString(['VITE_OPENAI_API_KEY', 'OPENAI_API_KEY']),
  groqApiKey: getEnvString(['VITE_GROQ_API_KEY', 'GROQ_API_KEY']),
  backendUrl: getEnvString(['VITE_BACKEND_URL', 'BACKEND_URL']) || 'http://localhost:8000',
  autoSpeak: true,
  voiceRate: 1.0,
  voicePitch: 1.0,
  autoCaptureStability: true,
  showLandmarks: false,
  cameraFacingMode: 'environment',
  includeHUDInRecording: true,
};

export const App: React.FC = () => {
  // Application State
  const [mode, setMode] = useState<AppMode>('HOLDING');
  const [cards, setCards] = useState<IdentifiedCard[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  const [currentDetection, setCurrentDetection] = useState<GestureDetectionResult | null>(null);
  const [simulationImage, setSimulationImage] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'SETTINGS' | 'SIMULATION' | 'TUTORIAL' | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [cachedSession, setCachedSession] = useState<RecordedSession | null>(null);
  const [isRecordingReadyOpen, setIsRecordingReadyOpen] = useState<boolean>(false);
  const [framingStyle, setFramingStyle] = useState<LookingAtFramingStyle>('FINGERS_FRAME');
  const stopClickedTimestampRef = useRef<number | null>(null);

  // Settings loaded from localStorage with .env fallback
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('glance_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          qwenApiKey: parsed.qwenApiKey || DEFAULT_SETTINGS.qwenApiKey,
          mistralApiKey: parsed.mistralApiKey || DEFAULT_SETTINGS.mistralApiKey,
          anthropicApiKey: parsed.anthropicApiKey || DEFAULT_SETTINGS.anthropicApiKey,
          geminiApiKey: parsed.geminiApiKey || DEFAULT_SETTINGS.geminiApiKey,
          openaiApiKey: parsed.openaiApiKey || DEFAULT_SETTINGS.openaiApiKey,
          groqApiKey: parsed.groqApiKey || DEFAULT_SETTINGS.groqApiKey,
          includeHUDInRecording: parsed.includeHUDInRecording !== undefined ? parsed.includeHUDInRecording : true,
        };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const lastBoxRef = useRef<BoundingBox>({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  const pipelineLockRef = useRef<boolean>(false);
  const activePipelineIdRef = useRef<number>(0);

  // Sync API Keys to VLM & Speech Services
  useEffect(() => {
    vlmService.setQwenApiKey(settings.qwenApiKey);
    vlmService.setQwenApiBaseUrl(settings.qwenApiBaseUrl || 'https://router.huggingface.co/hf-inference/v1');
    vlmService.setQwenModel(settings.qwenModel || 'Qwen/Qwen2.5-VL-3B-Instruct');
    vlmService.setMistralApiKey(settings.mistralApiKey);
    vlmService.setAnthropicApiKey(settings.anthropicApiKey);
    vlmService.setGeminiApiKey(settings.geminiApiKey);
    vlmService.setOpenaiApiKey(settings.openaiApiKey);
    vlmService.setGroqApiKey(settings.groqApiKey);
    vlmService.setBackendUrl(settings.backendUrl);

    speechService.setBackendUrl(settings.backendUrl);
    speechService.setWhisperApiKey(settings.groqApiKey || settings.openaiApiKey);
    speechService.setVoiceSettings(settings.voiceRate, settings.voicePitch);

    localStorage.setItem('glance_settings', JSON.stringify(settings));
  }, [settings]);

  // Execute the Object Identification + Wikipedia RAG + Calm Narrator Pipeline
  const executeIdentificationPipeline = useCallback(
    async (box: BoundingBox, source: HTMLVideoElement | HTMLImageElement, customHint?: string) => {
      // Hard mutex lock: prevent ANY new object detection while one is being identified or processed
      if (pipelineLockRef.current) {
        return;
      }
      pipelineLockRef.current = true;
      const pipelineId = ++activePipelineIdRef.current;
      setIsProcessing(true);
      speechService.pauseForProcessing();

      try {
        audioFX.playScanningSweep();

        // 1. Crop high-resolution image from source
        const cropBase64 = vlmService.cropImage(source, box, 0.10);

        // 2. Identify object class via High-Precision VLM (Backend / Cloud / Fallback)
        const idResult = await vlmService.identifyObject(cropBase64, mode, customHint);
        if (activePipelineIdRef.current !== pipelineId) return;

        // Check if no object was detected
        if (idResult.hasObject === false || idResult.label.toLowerCase().includes('no object')) {
          const noObjCard: IdentifiedCard = {
            id: 'card-' + Date.now(),
            timestamp: Date.now(),
            label: 'No Object Detected',
            confidence: 'high',
            shortAnswer: 'No object was detected in your hand or framed view.',
            expandedText: 'Please place or hold an object clearly in view of the camera to identify it.',
            wikiTitle: 'Empty View',
            wikiUrl: 'https://en.wikipedia.org/wiki/Computer_vision',
            box: { ...box },
            croppedThumbnailUrl: cropBase64,
            mode: mode,
            provider: idResult.provider || 'Smart Vision',
          };

          if (activePipelineIdRef.current !== pipelineId) return;
          setCards((prev) => [noObjCard, ...prev.slice(0, 4)]);
          audioFX.playPinchTrigger();

          if (settings.autoSpeak) {
            setSpeakingCardId(noObjCard.id);
            speechService.speak('No object detected.', () => {
              setSpeakingCardId(null);
              setTimeout(() => {
                setCards((prev) => prev.filter((c) => c.id !== noObjCard.id));
              }, 1200);
            });
          } else {
            setTimeout(() => {
              setCards((prev) => prev.filter((c) => c.id !== noObjCard.id));
            }, 2500);
          }
          return;
        }

        // 3. Grounding via Wikipedia REST API
        const wikiSummary = await wikipediaService.fetchArticleSummary(idResult.search_query);
        if (activePipelineIdRef.current !== pipelineId) return;

        // 4. Generate calm narrator answer
        const narratorAnswers = await vlmService.generateCalmNarratorAnswer(
          idResult.label,
          wikiSummary || {
            title: idResult.label,
            extract: `${idResult.label} is an identified subject in your field of view.`,
            contentUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(idResult.search_query)}`,
          }
        );
        if (activePipelineIdRef.current !== pipelineId) return;

        // 5. Create new popup card (High Confidence)
        const newCard: IdentifiedCard = {
          id: 'card-' + Date.now(),
          timestamp: Date.now(),
          label: idResult.label,
          confidence: idResult.confidence || 'high',
          shortAnswer: narratorAnswers.shortAnswer,
          expandedText: narratorAnswers.expandedText,
          wikiTitle: wikiSummary?.title || idResult.label,
          wikiUrl: wikiSummary?.contentUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(idResult.search_query)}`,
          wikiThumbnail: wikiSummary?.thumbnailUrl,
          box: { ...box },
          croppedThumbnailUrl: cropBase64,
          mode: mode,
          provider: idResult.provider,
        };

        // Add to stack of cards
        setCards((prev) => [newCard, ...prev.slice(0, 4)]);
        audioFX.playCardReveal();

        // 6. Speak aloud via Calm Narrator if enabled, and auto-dismiss when description is over
        if (settings.autoSpeak) {
          setSpeakingCardId(newCard.id);
          setIsSpeaking(true);
          speechService.speak(narratorAnswers.shortAnswer, () => {
            setSpeakingCardId(null);
            setIsSpeaking(false);
            // Gracefully dismiss popup card 1.5s after description finishes
            setTimeout(() => {
              setCards((prev) => {
                const remaining = prev.filter((c) => c.id !== newCard.id);
                if (remaining.length === 0) {
                  pipelineLockRef.current = false;
                }
                return remaining;
              });
            }, 1500);
          });
        } else {
          // If autoSpeak is disabled, auto-dismiss after reading timeout
          setTimeout(() => {
            setCards((prev) => {
              const remaining = prev.filter((c) => c.id !== newCard.id);
              if (remaining.length === 0) {
                pipelineLockRef.current = false;
              }
              return remaining;
            });
          }, 6000);
        }
      } catch (error) {
        console.error('Identification pipeline error:', error);
        pipelineLockRef.current = false;
      } finally {
        setIsProcessing(false);
        speechService.resumeAfterProcessing();
      }
    },
    [mode, settings.autoSpeak]
  );

  // Auto-capture triggered from stability in CameraViewport
  const handleAutoCapture = useCallback(
    (box: BoundingBox, source: HTMLVideoElement | HTMLImageElement) => {
      if (
        settings.autoCaptureStability &&
        !pipelineLockRef.current &&
        !isSpeaking &&
        cards.length === 0 &&
        !speechService.isVoiceSpeaking()
      ) {
        executeIdentificationPipeline(box, source);
      }
    },
    [settings.autoCaptureStability, isSpeaking, cards.length, executeIdentificationPipeline]
  );

  // Manual Trigger Button or Tap Capture
  const handleManualCapture = useCallback(
    (hintQuery?: string) => {
      if (pipelineLockRef.current || isProcessing) return;

      const box = currentDetection?.box || lastBoxRef.current;
      const source =
        document.querySelector('video') ||
        (document.querySelector('img[alt="Simulation Scene"]') as HTMLVideoElement | HTMLImageElement | null);

      if (source) {
        executeIdentificationPipeline(box, source, hintQuery);
      }
    },
    [currentDetection, isProcessing, executeIdentificationPipeline]
  );

  // Setup Speech Output Callbacks
  useEffect(() => {
    speechService.setCallbacks({
      onSpeakingStateChange: (speaking) => setIsSpeaking(speaking),
    });

    return () => {
      speechService.stopSpeaking();
    };
  }, []);

  // Manual Stop Recognition (cancels in-flight pipeline, speech, and clears cards)
  const handleManualStopRecognition = useCallback(() => {
    stopClickedTimestampRef.current = Date.now();
    activePipelineIdRef.current = 0;
    pipelineLockRef.current = false;
    setIsProcessing(false);
    speechService.stopSpeaking();
    setSpeakingCardId(null);
    setIsSpeaking(false);
    setCards([]);
    gestureDetector.reset();
    audioFX.playPinchTrigger?.();
  }, []);

  // Card Speech controls
  const handlePlayVoice = (card: IdentifiedCard) => {
    setSpeakingCardId(card.id);
    setIsSpeaking(true);
    pipelineLockRef.current = true;
    speechService.speak(card.shortAnswer, () => {
      setSpeakingCardId(null);
      setIsSpeaking(false);
      setTimeout(() => {
        setCards((prev) => {
          const remaining = prev.filter((c) => c.id !== card.id);
          if (remaining.length === 0) {
            pipelineLockRef.current = false;
          }
          return remaining;
        });
      }, 1500);
    });
  };

  const handleStopVoice = () => {
    stopClickedTimestampRef.current = Date.now();
    speechService.stopSpeaking();
    setSpeakingCardId(null);
    setIsSpeaking(false);
    setCards([]);
    pipelineLockRef.current = false;
  };

  const handleDismissCard = (id: string) => {
    if (speakingCardId === id) {
      speechService.stopSpeaking();
      setSpeakingCardId(null);
      setIsSpeaking(false);
    }
    setCards((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        pipelineLockRef.current = false;
      }
      return remaining;
    });
  };

  // Preset Scenario Selection
  const handleSelectPreset = (preset: SimulationPreset) => {
    setSimulationImage(preset.imageUrl);
    setMode(preset.mode);
    lastBoxRef.current = preset.defaultBox;

    const newCard: IdentifiedCard = {
      id: 'preset-' + Date.now(),
      timestamp: Date.now(),
      label: preset.fallbackIdentification.label,
      confidence: preset.fallbackIdentification.confidence,
      shortAnswer: preset.fallbackShortAnswer,
      expandedText: preset.fallbackWiki.extract,
      wikiTitle: preset.fallbackWiki.title,
      wikiUrl: preset.fallbackWiki.contentUrl,
      wikiThumbnail: preset.fallbackWiki.thumbnailUrl,
      box: preset.defaultBox,
      croppedThumbnailUrl: preset.imageUrl,
      mode: preset.mode,
      provider: preset.fallbackIdentification.provider,
    };

    setCards([newCard]);
    if (settings.autoSpeak) {
      setSpeakingCardId(newCard.id);
      speechService.speak(preset.fallbackShortAnswer, () => {
        setSpeakingCardId(null);
      });
    }
  };

  // Load cached session from IndexedDB on startup
  useEffect(() => {
    recordingStorage.getLatestRecording().then((session) => {
      if (session) {
        setCachedSession(session);
      }
    });
  }, []);

  // Synchronize state with off-screen recording compositor in real time
  useEffect(() => {
    if (isRecording) {
      const source = simulationImage
        ? (document.querySelector('img[alt="Simulation Scene"]') as HTMLImageElement | null)
        : (document.querySelector('video') as HTMLVideoElement | null);

      recordingService.updateCompositorState({
        sourceElement: source,
        mode,
        facingMode: settings.cameraFacingMode,
        showLandmarks: settings.showLandmarks,
        currentDetection,
        cards,
        speakingCardId,
        isProcessing,
        includeHUDOverlay: settings.includeHUDInRecording !== false,
        isRecording,
        recordingDuration,
        hasActiveRecognition: isProcessing || isSpeaking || cards.length > 0,
        stopClickedTimestamp: stopClickedTimestampRef.current,
      });
    }
  }, [
    isRecording,
    recordingDuration,
    mode,
    settings.cameraFacingMode,
    settings.showLandmarks,
    settings.includeHUDInRecording,
    currentDetection,
    cards,
    speakingCardId,
    isProcessing,
    isSpeaking,
    simulationImage,
  ]);

  // Handle Record Start / Stop Toggle
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      try {
        const session = await recordingService.stopRecording();
        setIsRecording(false);
        setCachedSession(session);
        setIsRecordingReadyOpen(true);
        audioFX.playPinchTrigger();
      } catch (err) {
        console.warn('Failed to stop recording:', err);
        setIsRecording(false);
      }
    } else {
      try {
        const source = simulationImage
          ? (document.querySelector('img[alt="Simulation Scene"]') as HTMLImageElement | null)
          : (document.querySelector('video') as HTMLVideoElement | null);

        setCachedSession(null);
        setIsRecordingReadyOpen(false);

        await recordingService.startRecording(
          {
            sourceElement: source,
            mode,
            facingMode: settings.cameraFacingMode,
            showLandmarks: settings.showLandmarks,
            landmarks: [],
            currentDetection,
            cards,
            speakingCardId,
            isProcessing,
          },
          (secs) => setRecordingDuration(secs)
        );

        setIsRecording(true);
        setRecordingDuration(0);
        audioFX.playTargetLock();
      } catch (err) {
        console.warn('Failed to start recording:', err);
        setIsRecording(false);
      }
    }
  }, [
    isRecording,
    simulationImage,
    mode,
    settings.cameraFacingMode,
    settings.showLandmarks,
    currentDetection,
    cards,
    speakingCardId,
    isProcessing,
  ]);

  // Handle Download Recording File (.webm)
  const handleDownloadRecording = useCallback(() => {
    if (!cachedSession) return;
    const a = document.createElement('a');
    a.href = cachedSession.url;
    const timestamp = new Date(cachedSession.timestamp).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `glance-session-${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [cachedSession]);

  // Handle Discard Recording File (clears from IndexedDB)
  const handleDiscardRecording = useCallback(async () => {
    await recordingStorage.clearLatestRecording();
    setCachedSession(null);
    setIsRecordingReadyOpen(false);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#03060c] font-sans">
      {/* 1. Full-screen Live Camera Feed / Simulation Background */}
      <div className="absolute inset-0 z-0">
        <CameraViewport
          mode={mode}
          facingMode={settings.cameraFacingMode}
          showLandmarks={settings.showLandmarks}
          cards={cards}
          onAutoCapture={handleAutoCapture}
          isProcessing={isProcessing}
          isSpeaking={isSpeaking}
          simulationImage={simulationImage}
          framingStyle={framingStyle}
          onTargetDetected={(res) => {
            setCurrentDetection(res);
            if (res.box) lastBoxRef.current = res.box;
          }}
        />
      </div>

      {/* 2. Minimal Top Bar */}
      <TopBar
        isSpeaking={isSpeaking}
        isProcessing={isProcessing}
        hasActiveRecognition={isProcessing || isSpeaking || cards.length > 0}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        hasCachedRecording={!!cachedSession}
        onStopRecognition={handleManualStopRecognition}
        onSwitchCamera={() =>
          setSettings((s) => ({
            ...s,
            cameraFacingMode: s.cameraFacingMode === 'user' ? 'environment' : 'user',
          }))
        }
        onToggleRecording={handleToggleRecording}
        onOpenRecordingModal={() => setIsRecordingReadyOpen(true)}
        onOpenSettings={() => setActiveModal('SETTINGS')}
        onOpenSimulation={() => setActiveModal('SIMULATION')}
        onOpenTutorial={() => setActiveModal('TUTORIAL')}
        hasCustomKey={!!(settings.mistralApiKey || settings.anthropicApiKey || settings.geminiApiKey || settings.openaiApiKey || settings.groqApiKey)}
      />

      {/* 3. Floating Side Controls: Quick Toggle Recording HUD */}
      <div className="absolute right-2.5 sm:right-4 top-16 sm:top-20 z-40 pointer-events-auto flex flex-col items-end gap-1.5">
        <button
          onClick={() => {
            setSettings((s) => ({
              ...s,
              includeHUDInRecording: s.includeHUDInRecording === false ? true : false,
            }));
            audioFX.playPinchTrigger?.();
          }}
          title="Toggle whether AR reticles, status cards, and STOP indicators are baked into the video recording"
          className={`px-2.5 py-1.5 rounded-xl border backdrop-blur-md text-[10px] font-mono flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${
            settings.includeHUDInRecording !== false
              ? 'bg-cyan-950/70 border-cyan-400/50 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
              : 'bg-black/60 border-white/15 text-slate-400 hover:text-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              settings.includeHUDInRecording !== false ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span>REC HUD: {settings.includeHUDInRecording !== false ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* 4. Left Side Dock: Mode Toggle ("Holding" vs "Looking At") */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 pointer-events-auto flex flex-col items-start gap-2">
        <ModeToggle
          currentMode={mode}
          onModeChange={(newMode) => setMode(newMode)}
          framingStyle={framingStyle}
          onFramingStyleChange={(style) => setFramingStyle(style)}
        />
      </div>

      {/* 5. Spatially Anchored Floating Info Cards (Stacking) */}
      {cards.map((card, index) => (
        <AnchoredCard
          key={card.id}
          card={card}
          index={index}
          totalCards={cards.length}
          onDismiss={handleDismissCard}
          isSpeakingThis={speakingCardId === card.id}
          onPlayVoice={handlePlayVoice}
          onStopVoice={handleStopVoice}
        />
      ))}

      {/* 6. Bottom Controls: Tactile Capture Shutter Button & Status */}
      <div className="absolute bottom-0 left-0 right-0 z-40 px-3 sm:px-6 pb-safe pb-2.5 sm:pb-6 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-center">
          <ManualTriggerButton
            isProcessing={isProcessing}
            onTriggerCapture={handleManualCapture}
            statusMessage={currentDetection?.message}
          />
        </div>
      </div>

      {/* Modals & Drawers */}
      <SettingsModal
        isOpen={activeModal === 'SETTINGS'}
        onClose={() => setActiveModal(null)}
        settings={settings}
        onUpdateSettings={(newVals) => setSettings((s) => ({ ...s, ...newVals }))}
        onClearHistory={() => {
          setCards([]);
          speechService.stopSpeaking();
        }}
      />

      <SimulationBench
        isOpen={activeModal === 'SIMULATION'}
        onClose={() => setActiveModal(null)}
        onSelectPreset={handleSelectPreset}
        onCustomImageUpload={(dataUrl) => {
          setSimulationImage(dataUrl);
          lastBoxRef.current = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
        }}
        onSwitchToLiveCamera={() => setSimulationImage(null)}
        isLiveCameraActive={!simulationImage}
      />

      <TutorialOverlay
        isOpen={activeModal === 'TUTORIAL'}
        onClose={() => setActiveModal(null)}
      />

      {/* Recording Ready / Download Card */}
      {isRecordingReadyOpen && cachedSession && (
        <RecordingReadyCard
          session={cachedSession}
          onDownload={handleDownloadRecording}
          onDiscard={handleDiscardRecording}
          onClose={() => setIsRecordingReadyOpen(false)}
        />
      )}
      <Analytics />
    </div>
  );
};

export default App;
