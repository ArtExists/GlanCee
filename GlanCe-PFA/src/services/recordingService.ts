// Unified Baked Session Recording Service
// Coordinates Canvas Compositor, Web Audio Mixing (Mic + AudioFX + Voice TTS), MediaRecorder, and IndexedDB Cache

import { RecordedSession } from '../types';
import { CompositorRenderState, RecordingCompositor } from './recordingCompositor';
import { audioFX } from './audioEffects';
import { speechService } from './speechService';
import { recordingStorage } from './recordingStorage';

export type RecordingCallback = (seconds: number) => void;

class RecordingService {
  private compositor: RecordingCompositor | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private audioDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;

  private isCurrentlyRecording: boolean = false;
  private startTime: number = 0;
  private durationSeconds: number = 0;
  private timerInterval: any = null;
  private onTickCallback: RecordingCallback | null = null;
  private mimeType: string = 'video/webm';

  public isRecording(): boolean {
    return this.isCurrentlyRecording;
  }

  public getDuration(): number {
    return this.durationSeconds;
  }

  /**
   * Update live state (bounding box, detection, cards, video element) for the compositor
   */
  public updateCompositorState(state: Partial<CompositorRenderState>) {
    if (this.compositor) {
      this.compositor.updateState(state);
    }
  }

  /**
   * Select best supported WebM / MP4 video recording MIME type
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];

    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return 'video/webm';
  }

  /**
   * Start recording session:
   * 1. Clears prior cached recording
   * 2. Starts offscreen compositor at 30 FPS
   * 3. Sets up Web Audio destination & connects Mic + AudioFX + TTS
   * 4. Feeds combined stream into MediaRecorder
   */
  public async startRecording(
    initialState: CompositorRenderState,
    onTick?: RecordingCallback
  ): Promise<void> {
    if (this.isCurrentlyRecording) return;

    // Rule: Clear previous cached recording on new start
    await recordingStorage.clearLatestRecording();

    this.onTickCallback = onTick || null;
    this.recordedChunks = [];
    this.durationSeconds = 0;

    // 1. Initialize Compositor
    this.compositor = new RecordingCompositor(1280, 720);
    this.compositor.updateState(initialState);
    const videoStream = this.compositor.start();

    // 2. Setup Web Audio API Destination & Mixer
    this.audioCtx = audioFX.getAudioContext() || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.audioDestinationNode = this.audioCtx.createMediaStreamDestination();

    // Connect Audio Effects and Speech Service output to the recording audio destination
    audioFX.addDestination(this.audioDestinationNode);
    speechService.addDestination(this.audioDestinationNode);

    // 3. Capture Microphone Audio Track & Connect to Mixer
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.micGainNode = this.audioCtx.createGain();
      this.micGainNode.gain.value = 1.0;

      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.audioDestinationNode);
    } catch (e) {
      console.warn('Microphone access for recording audio track failed:', e);
    }

    // 4. Create Combined MediaStream (Composited Video Track + Mixed Audio Track)
    const combinedTracks: MediaStreamTrack[] = [];

    const videoTrack = videoStream.getVideoTracks()[0];
    if (videoTrack) {
      combinedTracks.push(videoTrack);
    }

    const audioTrack = this.audioDestinationNode.stream.getAudioTracks()[0];
    if (audioTrack) {
      combinedTracks.push(audioTrack);
    }

    const combinedStream = new MediaStream(combinedTracks);

    // 5. Initialize MediaRecorder
    this.mimeType = this.getSupportedMimeType();

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: this.mimeType,
        videoBitsPerSecond: 3_500_000, // High-quality 3.5 Mbps bitrate
      });
    } catch {
      this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Collect chunk slices every 1 second
    this.mediaRecorder.start(1000);
    this.isCurrentlyRecording = true;
    this.startTime = Date.now();

    // 6. Elapsed timer loop
    this.timerInterval = setInterval(() => {
      this.durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.onTickCallback?.(this.durationSeconds);
    }, 1000);
  }

  /**
   * Stop recording session:
   * Assembles the WebM blob and saves to IndexedDB
   */
  public async stopRecording(): Promise<RecordedSession> {
    if (!this.isCurrentlyRecording || !this.mediaRecorder) {
      const existing = await recordingStorage.getLatestRecording();
      if (existing) return existing;
      throw new Error('No active recording in progress.');
    }

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.isCurrentlyRecording = false;

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder is null'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Clean up audio nodes & streams
          if (this.audioDestinationNode) {
            audioFX.removeDestination(this.audioDestinationNode);
            speechService.removeDestination(this.audioDestinationNode);
          }

          if (this.micStream) {
            this.micStream.getTracks().forEach((t) => t.stop());
            this.micStream = null;
          }

          if (this.micSourceNode) {
            try {
              this.micSourceNode.disconnect();
            } catch {}
            this.micSourceNode = null;
          }

          if (this.compositor) {
            this.compositor.stop();
            this.compositor = null;
          }

          const finalDuration = Math.max(1, this.durationSeconds);
          const finalBlob = new Blob(this.recordedChunks, { type: this.mimeType });

          // Persist to IndexedDB
          const savedSession = await recordingStorage.saveLatestRecording(
            finalBlob,
            finalDuration,
            this.mimeType
          );

          resolve(savedSession);
        } catch (err) {
          reject(err);
        }
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const recordingService = new RecordingService();
