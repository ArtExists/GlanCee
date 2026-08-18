import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppMode, BoundingBox, HandLandmarkData, IdentifiedCard, LookingAtFramingStyle } from '../../types';
import { gestureDetector, GestureDetectionResult } from '../../services/gestureDetector';
import { audioFX } from '../../services/audioEffects';
import { speechService } from '../../services/speechService';

interface CameraViewportProps {
  mode: AppMode;
  facingMode: 'user' | 'environment';
  showLandmarks: boolean;
  cards: IdentifiedCard[];
  onAutoCapture: (box: BoundingBox, sourceElement: HTMLVideoElement | HTMLImageElement) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  simulationImage: string | null;
  framingStyle?: LookingAtFramingStyle;
  onTargetDetected?: (res: GestureDetectionResult) => void;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  mode,
  facingMode,
  showLandmarks,
  cards,
  onAutoCapture,
  isProcessing,
  isSpeaking,
  simulationImage,
  framingStyle = 'FINGERS_FRAME',
  onTargetDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const handsTrackerRef = useRef<any>(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const currentDetectionRef = useRef<GestureDetectionResult | null>(null);
  const latestHandsRef = useRef<HandLandmarkData[]>([]);

  // Synchronized state refs to eliminate stale closure bugs
  const isProcessingRef = useRef<boolean>(isProcessing);
  const isSpeakingRef = useRef<boolean>(isSpeaking);
  const modeRef = useRef<AppMode>(mode);
  const framingStyleRef = useRef<LookingAtFramingStyle>(framingStyle);
  const cardsRef = useRef<IdentifiedCard[]>(cards);
  const onAutoCaptureRef = useRef(onAutoCapture);
  const onTargetDetectedRef = useRef(onTargetDetected);
  const simulationImageRef = useRef(simulationImage);

  useEffect(() => {
    framingStyleRef.current = framingStyle;
  }, [framingStyle]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    onAutoCaptureRef.current = onAutoCapture;
  }, [onAutoCapture]);

  useEffect(() => {
    onTargetDetectedRef.current = onTargetDetected;
  }, [onTargetDetected]);

  useEffect(() => {
    simulationImageRef.current = simulationImage;
  }, [simulationImage]);

  // Initialize WebCam stream
  const initWebcam = useCallback(async () => {
    if (simulationImage) return;

    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraError(null);
        };
      }
    } catch (err: any) {
      console.warn('WebCam access failed or blocked:', err);
      setCameraError(err?.message || 'Camera permission denied or camera not found.');
    }
  }, [facingMode, simulationImage]);

  // Setup MediaPipe Hands Landmark Tracker (once)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupMediaPipe = () => {
      const Hands = (window as any).Hands;
      if (!Hands) {
        setTimeout(setupMediaPipe, 200);
        return;
      }

      try {
        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          const handsData: HandLandmarkData[] = [];

          if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
              const rawLm = results.multiHandLandmarks[i];
              const handedness = results.multiHandedness[i]?.label || 'Right';
              const score = results.multiHandedness[i]?.score || 0.9;

              handsData.push({
                landmarks: rawLm.map((pt: any) => ({ x: pt.x, y: pt.y })),
                handedness: handedness as 'Left' | 'Right',
                score,
              });
            }
          }

          latestHandsRef.current = handsData;

          // Process detection based on active mode
          let detection: GestureDetectionResult;
          const currentMode = modeRef.current;
          if (currentMode === 'HOLDING') {
            detection = gestureDetector.processHoldingMode(handsData, 1000);
          } else if (framingStyleRef.current === 'REVERSE_PINCH') {
            detection = gestureDetector.processLookingAtReversePinch(handsData, 750);
          } else {
            detection = gestureDetector.processLookingAtMode(handsData, 750);
          }

          currentDetectionRef.current = detection;
          onTargetDetectedRef.current?.(detection);

          // Check for auto-capture trigger on stability:
          // CRITICAL: DO NOT detect new objects when one is being processed OR speaking OR card is active!
          const now = Date.now();
          const isBusy =
            isProcessingRef.current ||
            isSpeakingRef.current ||
            cardsRef.current.length > 0 ||
            speechService.isVoiceSpeaking();

          if (isBusy) {
            // Suppress gesture accumulation while explaining an object
            gestureDetector.reset();
            lastCaptureTimeRef.current = now;
          }

          const hasCooldownPassed = now - lastCaptureTimeRef.current > 3000; // 3s cooldown after finishing

          if (
            detection.hasTarget &&
            detection.isStable &&
            !isBusy &&
            hasCooldownPassed
          ) {
            lastCaptureTimeRef.current = now;
            gestureDetector.reset();
            audioFX.playTargetLock();
            const source = simulationImageRef.current ? imageRef.current : videoRef.current;
            if (source) {
              onAutoCaptureRef.current?.(detection.box, source);
            }
          }
        });

        handsTrackerRef.current = hands;
      } catch (e) {
        console.warn('Failed to initialize MediaPipe Hands:', e);
      }
    };

    setupMediaPipe();

    return () => {
      if (handsTrackerRef.current) {
        try {
          handsTrackerRef.current.close();
        } catch {}
      }
    };
  }, []);

  // Video processing frame loop for MediaPipe
  useEffect(() => {
    let isActive = true;

    const processFrame = async () => {
      if (!isActive) return;

      if (handsTrackerRef.current && videoRef.current && videoRef.current.readyState >= 2 && !simulationImage) {
        try {
          await handsTrackerRef.current.send({ image: videoRef.current });
        } catch {}
      }

      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    };

    if (!simulationImage) {
      initWebcam();
      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      isActive = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [initWebcam, simulationImage]);

  // Canvas drawing loop: Renders HUD bounding boxes, corner brackets, stability charge ring, anchor lines
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      ctx.clearRect(0, 0, width, height);

      const detection = currentDetectionRef.current;
      const box = detection?.box || { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      const hasTarget = detection?.hasTarget ?? false;
      const progress = detection?.stabilityProgress ?? 0;

      const screenX = box.x * width;
      const screenY = box.y * height;
      const screenW = box.width * width;
      const screenH = box.height * height;

      const isHolding = mode === 'HOLDING';
      const themeColor = isHolding ? '#00f0ff' : '#00ff9d';
      const themeRgb = isHolding ? '0, 240, 255' : '0, 255, 157';

      // Optional: Draw hand landmarks
      if (showLandmarks && latestHandsRef.current.length > 0) {
        ctx.save();
        ctx.fillStyle = themeColor;
        ctx.strokeStyle = `rgba(${themeRgb}, 0.5)`;
        latestHandsRef.current.forEach((hand) => {
          hand.landmarks.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x * width, pt.y * height, 3, 0, Math.PI * 2);
            ctx.fill();
          });
        });
        ctx.restore();
      }

      // 1. Draw Subtle Bounding Box or Director's Frame
      if (hasTarget || simulationImage) {
        ctx.save();

        // Glowing outer stroke
        ctx.strokeStyle = `rgba(${themeRgb}, ${hasTarget ? 0.85 : 0.35})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = hasTarget ? 12 : 4;

        // Draw rounded rectangle
        const r = 12;
        ctx.beginPath();
        ctx.moveTo(screenX + r, screenY);
        ctx.lineTo(screenX + screenW - r, screenY);
        ctx.quadraticCurveTo(screenX + screenW, screenY, screenX + screenW, screenY + r);
        ctx.lineTo(screenX + screenW, screenY + screenH - r);
        ctx.quadraticCurveTo(screenX + screenW, screenY + screenH, screenX + screenW - r, screenY + screenH);
        ctx.lineTo(screenX + r, screenY + screenH);
        ctx.quadraticCurveTo(screenX, screenY + screenH, screenX, screenY + screenH - r);
        ctx.lineTo(screenX, screenY + r);
        ctx.quadraticCurveTo(screenX, screenY, screenX + r, screenY);
        ctx.closePath();
        ctx.stroke();

        // Inner semi-transparent tint
        ctx.fillStyle = `rgba(${themeRgb}, ${hasTarget ? 0.04 : 0.01})`;
        ctx.fill();

        // 2. Futuristic Corner Brackets
        const bracketLen = Math.min(24, screenW * 0.2, screenH * 0.2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = themeColor;

        // Top-Left Corner
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + bracketLen);
        ctx.lineTo(screenX, screenY);
        ctx.lineTo(screenX + bracketLen, screenY);
        ctx.stroke();

        // Top-Right Corner
        ctx.beginPath();
        ctx.moveTo(screenX + screenW - bracketLen, screenY);
        ctx.lineTo(screenX + screenW, screenY);
        ctx.lineTo(screenX + screenW, screenY + bracketLen);
        ctx.stroke();

        // Bottom-Left Corner
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + screenH - bracketLen);
        ctx.lineTo(screenX, screenY + screenH);
        ctx.lineTo(screenX + bracketLen, screenY + screenH);
        ctx.stroke();

        // Bottom-Right Corner
        ctx.beginPath();
        ctx.moveTo(screenX + screenW - bracketLen, screenY + screenH);
        ctx.lineTo(screenX + screenW, screenY + screenH);
        ctx.lineTo(screenX + screenW, screenY + screenH - bracketLen);
        ctx.stroke();

        // 3. Center Crosshair Reticle
        const cx = screenX + screenW / 2;
        const cy = screenY + screenH / 2;
        const crossLen = 6;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${themeRgb}, 0.6)`;
        ctx.beginPath();
        ctx.moveTo(cx - crossLen, cy);
        ctx.lineTo(cx + crossLen, cy);
        ctx.moveTo(cx, cy - crossLen);
        ctx.lineTo(cx, cy + crossLen);
        ctx.stroke();

        // 4. Stability Charge Progress Bar / Arc
        if (progress > 0) {
          ctx.beginPath();
          ctx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 10;
          ctx.stroke();
        }

        // 5. Header Tag Pill
        const tagText = isHolding
          ? `HOLDING ROI [${Math.round((detection?.confidence || 0.9) * 100)}%]`
          : framingStyleRef.current === 'REVERSE_PINCH'
          ? `REVERSE-PINCH ROI [${Math.round((detection?.confidence || 0.95) * 100)}%]`
          : `FRAMING SQUARE [${Math.round((detection?.confidence || 0.95) * 100)}%]`;

        ctx.font = '10px "JetBrains Mono", monospace';
        const tagWidth = ctx.measureText(tagText).width + 12;

        ctx.fillStyle = 'rgba(5, 7, 13, 0.85)';
        ctx.strokeStyle = `rgba(${themeRgb}, 0.5)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(screenX + 8, screenY - 18, tagWidth, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = themeColor;
        ctx.fillText(tagText, screenX + 14, screenY - 5);

        ctx.restore();
      }

      // 6. Draw Anchor Connecting Lines to Floating Cards
      cards.forEach((card) => {
        const cardBox = card.box;
        const targetX = (cardBox.x + cardBox.width) * width;
        const targetY = (cardBox.y + cardBox.height / 2) * height;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(targetX + 30, targetY - 20);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [mode, cards, simulationImage, showLandmarks]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
      {/* Simulation Image Mode */}
      {simulationImage ? (
        <img
          ref={imageRef}
          src={simulationImage}
          alt="Simulation Scene"
          className="w-full h-full object-cover select-none"
        />
      ) : (
        /* Live WebCam Feed */
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />
      )}

      {/* AR HUD Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Smart Glasses Holographic Grid & Vignette Overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none z-15" />
      <div className="absolute inset-0 glasses-vignette pointer-events-none z-15" />

      {/* Camera Error / Permission Fallback Notice */}
      {cameraError && !simulationImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-25 bg-black/85 backdrop-blur-md">
          <div className="glass-panel-glow max-w-md p-6 rounded-2xl border border-cyan-400/40 text-slate-100">
            <h4 className="text-lg font-space font-bold text-cyan-300 mb-2">Camera Feed Inactive</h4>
            <p className="text-sm text-slate-300 mb-4 font-sans leading-relaxed">
              {cameraError}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={initWebcam}
                className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-space font-bold text-xs hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.5)]"
              >
                Retry Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
