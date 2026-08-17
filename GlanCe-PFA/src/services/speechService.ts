// Hands-free Voice Interaction, Whisper STT & Calm Narrator Speech Synthesis Service

export type VoiceCommandAction = 'STOP' | 'IDENTIFY' | 'TELL_ME_MORE' | 'CLEAR' | 'SWITCH_MODE';

export interface SpeechCallbacks {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onCommandTriggered?: (action: VoiceCommandAction, fullQuery: string) => void;
  onListeningStateChange?: (isListening: boolean) => void;
  onSpeakingStateChange?: (isSpeaking: boolean) => void;
  onError?: (error: string) => void;
}

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

class SpeechService {
  private recognition: any = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private autoRestart: boolean = true;
  private callbacks: SpeechCallbacks = {};

  private voiceSpeed: number = 1.0;
  private voicePitch: number = 1.0;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  // Command debouncing
  private lastCommandTime: number = 0;
  private lastTriggeredText: string = '';
  private restartTimeout: any = null;

  // Whisper Audio Capture via MediaRecorder
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private backendUrl: string = 'http://localhost:8000';
  private whisperApiKey: string = '';

  constructor() {
    this.initRecognition();
    this.initVoices();
  }

  public setBackendUrl(url: string) {
    this.backendUrl = url || 'http://localhost:8000';
  }

  public setWhisperApiKey(key: string) {
    this.whisperApiKey = key || '';
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        this.preferredVoice =
          voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural'))) ||
          voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Zira') || v.name.includes('David') || v.name.includes('Serena'))) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0] ||
          null;
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  /**
   * Request microphone permission explicitly
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Close stream tracks after permission is verified
        stream.getTracks().forEach((track) => track.stop());
        return true;
      }
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      this.callbacks.onError?.('Microphone permission denied. Please allow mic access in your browser.');
    }
    return false;
  }

  private initRecognition() {
    const win = window as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('Web Speech API not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onListeningStateChange?.(true);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onListeningStateChange?.(false);

        // Auto restart gracefully after brief cooldown if autoRestart is active
        if (this.autoRestart) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.autoRestart && !this.isListening) {
              try {
                this.recognition.start();
              } catch {
                // Ignore if already active or pending
              }
            }
          }, 300);
        }
      };

      this.recognition.onerror = (event: any) => {
        const errType = event.error;
        if (errType === 'no-speech' || errType === 'aborted') {
          // Expected harmless events, keep listening
          return;
        }

        if (errType === 'not-allowed' || errType === 'audio-capture') {
          this.callbacks.onError?.('Microphone access blocked. Click the mic button to grant access.');
          this.autoRestart = false;
        } else {
          console.warn('Speech recognition warning:', errType);
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const piece = item[0]?.transcript || '';
          if (item.isFinal) {
            finalTranscript += piece;
          } else {
            interimTranscript += piece;
          }
        }

        const activeText = (finalTranscript || interimTranscript).trim();
        if (activeText) {
          this.callbacks.onTranscript?.(activeText, !!finalTranscript);
          this.evaluateCommand(activeText, !!finalTranscript);
        }
      };
    } catch (e) {
      console.error('Failed to initialize Speech Recognition:', e);
    }
  }

  /**
   * Evaluate spoken text for natural voice commands
   */
  private evaluateCommand(transcript: string, _isFinal: boolean) {
    const raw = transcript.toLowerCase().trim();
    // Normalize contractions: what's -> what is, i'm -> i am, let's -> let us
    const normalized = raw
      .replace(/what's/g, 'what is')
      .replace(/whats/g, 'what is')
      .replace(/what'm/g, 'what am')
      .replace(/i'm/g, 'i am')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const now = Date.now();

    // 1. Immediate STOP commands (evaluated instantly on both interim and final results with ZERO debounce)
    const stopMatches = [
      'stop',
      'be quiet',
      'shut up',
      'quiet',
      'silence',
      'pause',
      'cancel',
      'mute',
      'halt',
      'stop talking',
      'enough',
      'stop it',
      'abort',
      'dismiss',
      'shh',
    ];

    const words = normalized.split(/\s+/);
    const hasStopWord =
      stopMatches.some((s) => normalized.includes(s)) ||
      words.some((w) => ['stop', 'quiet', 'mute', 'cancel', 'halt', 'abort', 'silence', 'shh'].includes(w));

    if (hasStopWord) {
      this.lastCommandTime = now;
      this.stopSpeaking();
      this.callbacks.onCommandTriggered?.('STOP', transcript);
      return;
    }

    // 2. TELL ME MORE / EXPAND (requires 1s debounce)
    const moreMatches = [
      'tell me more',
      'read more',
      'explain more',
      'more details',
      'details',
      'expand',
      'more info',
      'tell more',
      'continue',
    ];

    if (moreMatches.some((m) => normalized.includes(m))) {
      if (now - this.lastCommandTime > 1200) {
        this.lastCommandTime = now;
        this.callbacks.onCommandTriggered?.('TELL_ME_MORE', transcript);
      }
      return;
    }

    // 3. CLEAR / DISMISS
    const clearMatches = ['clear', 'dismiss', 'close', 'hide', 'remove card', 'clear cards'];
    if (clearMatches.some((c) => normalized === c || normalized.startsWith(c))) {
      if (now - this.lastCommandTime > 1200) {
        this.lastCommandTime = now;
        this.callbacks.onCommandTriggered?.('CLEAR', transcript);
      }
      return;
    }

    // 4. SWITCH MODE
    const switchMatches = ['switch mode', 'change mode', 'toggle mode', 'holding mode', 'looking at mode'];
    if (switchMatches.some((sm) => normalized.includes(sm))) {
      if (now - this.lastCommandTime > 1200) {
        this.lastCommandTime = now;
        this.callbacks.onCommandTriggered?.('SWITCH_MODE', transcript);
      }
      return;
    }

    // 5. IDENTIFY / SCAN / ASK (Rich Natural Language Triggers)
    const identifyTriggers = [
      'what is this',
      'what is that',
      'what am i looking at',
      'what am i holding',
      'what do i have',
      'what do i hold',
      'what is in my hand',
      'what object is this',
      'what is this object',
      'identify this',
      'identify',
      'scan this',
      'scan frame',
      'scan',
      'capture',
      'tell me about this',
      'explain this',
      'how does this work',
      'look at this',
      'detect this',
      'check this',
      'hey glance',
      'glance',
    ];

    const hasIdentifyTrigger = identifyTriggers.some((trigger) => normalized.includes(trigger));
    const isDirectQuestion =
      normalized.startsWith('what ') ||
      normalized.startsWith('which ') ||
      normalized.startsWith('how ') ||
      normalized.startsWith('is this ');

    if (hasIdentifyTrigger || isDirectQuestion) {
      if (now - this.lastCommandTime > 500 && this.lastTriggeredText !== raw) {
        this.lastCommandTime = now;
        this.lastTriggeredText = raw;
        this.callbacks.onCommandTriggered?.('IDENTIFY', transcript);
      }
    }
  }

  /**
   * Start capturing audio for Whisper transcription
   */
  public async startWhisperRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
    } catch (e) {
      console.warn('Microphone access for Whisper recording failed:', e);
    }
  }

  /**
   * Stop capturing audio and transcribe via Whisper
   */
  public async stopWhisperRecording(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve('');
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const text = await this.transcribeAudioBlobWithWhisper(audioBlob);
        resolve(text);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Transcribe recorded audio with Whisper (Python Backend or Groq/OpenAI Whisper API)
   */
  public async transcribeAudioBlobWithWhisper(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      if (this.whisperApiKey) {
        formData.append('custom_key', this.whisperApiKey);
      }

      const res = await fetch(`${this.backendUrl}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          this.evaluateCommand(data.text, true);
          return data.text;
        }
      }
    } catch (err) {
      console.warn('Whisper backend transcription failed, falling back to Web Speech:', err);
    }
    return '';
  }

  public setCallbacks(callbacks: SpeechCallbacks) {
    this.callbacks = callbacks;
  }

  public setVoiceSettings(speed: number, pitch: number) {
    this.voiceSpeed = speed;
    this.voicePitch = pitch;
  }

  public async startListening(continuous: boolean = true) {
    this.autoRestart = continuous;
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) return;
    if (this.isListening) return;

    try {
      this.recognition.start();
    } catch (e: any) {
      if (e?.name !== 'InvalidStateError') {
        console.warn('Recognition start caught:', e);
      }
    }
  }

  public stopListening() {
    this.autoRestart = false;
    clearTimeout(this.restartTimeout);
    if (!this.recognition) return;
    if (!this.isListening) return;

    try {
      this.recognition.stop();
    } catch {}
  }

  public async toggleListening(): Promise<boolean> {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      await this.requestMicrophonePermission();
      await this.startListening(true);
      return true;
    }
  }

  private extraDestinations: Set<AudioNode> = new Set();

  public addDestination(node: AudioNode) {
    this.extraDestinations.add(node);
  }

  public removeDestination(node: AudioNode) {
    this.extraDestinations.delete(node);
  }

  /**
   * Calm Narrator Voice Output
   */
  public speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    // Cancel any ongoing utterance immediately
    window.speechSynthesis.cancel();

    if (!text || text.trim() === '') {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }
    utterance.rate = this.voiceSpeed;
    utterance.pitch = this.voicePitch;

    // Keep global reference to avoid Chrome garbage collection bug
    (window as any).__glance_utterance = utterance;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.callbacks.onSpeakingStateChange?.(true);
    };

    const handleSpeechEnd = () => {
      this.isSpeaking = false;
      this.callbacks.onSpeakingStateChange?.(false);
      (window as any).__glance_utterance = null;
      onEnd?.();
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = (e) => {
      console.warn('Speech synthesis error/interrupted:', e);
      handleSpeechEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Immediate Stop Command Handler
   */
  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.callbacks.onSpeakingStateChange?.(false);
      (window as any).__glance_utterance = null;
    }
  }

  public isVoiceSpeaking(): boolean {
    return this.isSpeaking;
  }

  public isMicListening(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
