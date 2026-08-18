// Off-Screen Canvas Compositor for Baked Smart-Glasses AR Recording
// Composites Camera Feed + HUD Reticles/Boxes + Floating Popup Cards (rendered as graphics)

import { AppMode, BoundingBox, HandLandmarkData, IdentifiedCard } from '../types';
import { GestureDetectionResult } from './gestureDetector';

export interface CompositorRenderState {
  sourceElement: HTMLVideoElement | HTMLImageElement | null;
  mode: AppMode;
  facingMode: 'user' | 'environment';
  showLandmarks: boolean;
  landmarks: HandLandmarkData[];
  currentDetection: GestureDetectionResult | null;
  cards: IdentifiedCard[];
  speakingCardId: string | null;
  isProcessing: boolean;
  includeHUDOverlay?: boolean;
  isRecording?: boolean;
  recordingDuration?: number;
  hasActiveRecognition?: boolean;
  stopClickedTimestamp?: number | null;
}

export class RecordingCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private isRunning: boolean = false;
  private state: CompositorRenderState = {
    sourceElement: null,
    mode: 'HOLDING',
    facingMode: 'environment',
    showLandmarks: false,
    landmarks: [],
    currentDetection: null,
    cards: [],
    speakingCardId: null,
    isProcessing: false,
    includeHUDOverlay: true,
    isRecording: true,
    recordingDuration: 0,
    hasActiveRecognition: false,
    stopClickedTimestamp: null,
  };

  constructor(width: number = 1280, height: number = 720) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context for compositor canvas.');
    }
    this.ctx = ctx;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public updateState(newState: Partial<CompositorRenderState>) {
    this.state = { ...this.state, ...newState };
  }

  /**
   * Start the compositing render loop and return the 30 FPS MediaStream
   */
  public start(): MediaStream {
    this.isRunning = true;

    const loop = () => {
      if (!this.isRunning) return;
      this.renderFrame();
      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
    return this.canvas.captureStream(30);
  }

  /**
   * Stop the compositing loop
   */
  public stop() {
    this.isRunning = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private renderFrame() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const state = this.state;

    // Clear background to dark space color
    ctx.fillStyle = '#03060c';
    ctx.fillRect(0, 0, width, height);

    // 1. Draw Live Camera / Simulation Image Feed
    this.drawSourceFeed(ctx, width, height, state);

    // 2. Draw Futuristic Smart Glasses Hologram & Vignette
    this.drawGlassesVignette(ctx, width, height);

    // 3. Draw Gesture & HUD Bounding Boxes / Reticles
    this.drawHUDOverlay(ctx, width, height, state);

    // 4. Draw Floating Popups as Vector Canvas Graphics
    this.drawPopupCards(ctx, width, height, state);

    // 5. Draw Top Status, Full UI Controls, & Stop Action Indicators (if enabled)
    if (state.includeHUDOverlay !== false) {
      this.drawFullHUDControls(ctx, width, height, state);
    } else {
      this.drawARWatermark(ctx, width, height, state);
    }
  }

  private drawSourceFeed(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: CompositorRenderState
  ) {
    const source = state.sourceElement;
    if (!source) return;

    let srcWidth = 0;
    let srcHeight = 0;

    if (source instanceof HTMLVideoElement) {
      if (source.readyState < 2) return;
      srcWidth = source.videoWidth || 1280;
      srcHeight = source.videoHeight || 720;
    } else if (source instanceof HTMLImageElement) {
      if (!source.complete || source.naturalWidth === 0) return;
      srcWidth = source.naturalWidth;
      srcHeight = source.naturalHeight;
    }

    if (srcWidth === 0 || srcHeight === 0) return;

    // Calculate aspect ratio fill ("object-fit: cover")
    const canvasAspect = width / height;
    const srcAspect = srcWidth / srcHeight;

    let drawW = width;
    let drawH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (srcAspect > canvasAspect) {
      drawW = height * srcAspect;
      offsetX = (width - drawW) / 2;
    } else {
      drawH = width / srcAspect;
      offsetY = (height - drawH) / 2;
    }

    ctx.save();
    if (state.facingMode === 'user' && source instanceof HTMLVideoElement) {
      // Mirror front camera
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(source, -offsetX, offsetY, drawW, drawH);
    } else {
      ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
    }
    ctx.restore();
  }

  private drawGlassesVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();

    // Subtle dark gradient vignette around edges
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(3, 6, 12, 0.45)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal scanline effect
    ctx.fillStyle = 'rgba(0, 240, 255, 0.015)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1);
    }

    ctx.restore();
  }

  private drawHUDOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: CompositorRenderState
  ) {
    const isHolding = state.mode === 'HOLDING';
    const themeColor = isHolding ? '#00f0ff' : '#00ff9d';
    const themeRgb = isHolding ? '0, 240, 255' : '0, 255, 157';

    // Optional: Draw landmarks
    if (state.showLandmarks && state.landmarks.length > 0) {
      ctx.save();
      ctx.fillStyle = themeColor;
      ctx.strokeStyle = `rgba(${themeRgb}, 0.5)`;
      state.landmarks.forEach((hand) => {
        hand.landmarks.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x * width, pt.y * height, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.restore();
    }

    const detection = state.currentDetection;
    const hasTarget = detection?.hasTarget ?? false;
    const box: BoundingBox = detection?.box || { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const progress = detection?.stabilityProgress ?? 0;

    const screenX = box.x * width;
    const screenY = box.y * height;
    const screenW = box.width * width;
    const screenH = box.height * height;

    if (hasTarget) {
      ctx.save();

      // Outer bounding box outline with glow
      ctx.strokeStyle = `rgba(${themeRgb}, 0.85)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = 10;

      // Rounded rectangle
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

      // Translucent inner tint
      ctx.fillStyle = `rgba(${themeRgb}, 0.03)`;
      ctx.fill();

      // Corner Brackets
      const bracketLen = Math.min(24, screenW * 0.2, screenH * 0.2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = themeColor;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + bracketLen);
      ctx.lineTo(screenX, screenY);
      ctx.lineTo(screenX + bracketLen, screenY);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(screenX + screenW - bracketLen, screenY);
      ctx.lineTo(screenX + screenW, screenY);
      ctx.lineTo(screenX + screenW, screenY + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + screenH - bracketLen);
      ctx.lineTo(screenX, screenY + screenH);
      ctx.lineTo(screenX + bracketLen, screenY + screenH);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(screenX + screenW - bracketLen, screenY + screenH);
      ctx.lineTo(screenX + screenW, screenY + screenH);
      ctx.lineTo(screenX + screenW, screenY + screenH - bracketLen);
      ctx.stroke();

      // Center Crosshairs
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

      // Stability Progress Arc
      if (progress > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.stroke();
      }

      // ROI Header Tag Pill
      const tagText = isHolding
        ? `HOLDING ROI [${Math.round((detection?.confidence || 0.9) * 100)}%]`
        : `FRAMING SQUARE [${Math.round((detection?.confidence || 0.95) * 100)}%]`;

      ctx.font = 'bold 11px "Space Mono", "JetBrains Mono", monospace';
      const tagWidth = ctx.measureText(tagText).width + 16;

      ctx.fillStyle = 'rgba(5, 7, 13, 0.90)';
      ctx.strokeStyle = `rgba(${themeRgb}, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(screenX + 8, Math.max(10, screenY - 22), tagWidth, 20, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = themeColor;
      ctx.fillText(tagText, screenX + 16, Math.max(24, screenY - 8));

      ctx.restore();
    }
  }

  private drawPopupCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: CompositorRenderState
  ) {
    if (!state.cards || state.cards.length === 0) return;

    // Render up to 2 active cards
    state.cards.slice(0, 2).forEach((card, index) => {
      const box = card.box;
      const targetAnchorX = (box.x + box.width) * width;
      const targetAnchorY = (box.y + box.height / 2) * height;

      // Card Dimensions
      const cardWidth = Math.min(380, width * 0.38);
      const cardX = Math.min(width - cardWidth - 24, Math.max(24, targetAnchorX + 30));
      const cardY = Math.min(height - 240, Math.max(24, box.y * height + index * 30));

      ctx.save();

      // 1. Anchor Connecting Dashed Line
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(targetAnchorX, targetAnchorY);
      ctx.lineTo(cardX, cardY + 30);
      ctx.stroke();

      // Glowing anchor origin dot
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(targetAnchorX, targetAnchorY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.setLineDash([]); // Reset line dash

      // 2. Glassmorphic Card Container
      ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(6, 11, 24, 0.90)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1.5;

      // Estimate card height from text length
      const padding = 16;
      const textWidth = cardWidth - padding * 2;
      const lines = this.wrapText(ctx, card.shortAnswer, textWidth, '13px system-ui, sans-serif');
      const textBlockHeight = lines.length * 18;
      const cardHeight = Math.max(160, 95 + textBlockHeight + 35);

      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 14);
      ctx.fill();
      ctx.stroke();

      // 3. Card Badges
      let badgeX = cardX + padding;
      const badgeY = cardY + 16;

      // Mode badge ("HOLDING" / "FRAMED")
      const modeLabel = card.mode === 'HOLDING' ? 'HOLDING' : 'FRAMED';
      ctx.font = 'bold 9px "Space Mono", monospace';
      const modeWidth = ctx.measureText(modeLabel).width + 12;

      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, modeWidth, 16, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.fillText(modeLabel, badgeX + 6, badgeY + 12);
      badgeX += modeWidth + 6;

      // Confidence badge
      const confLabel = card.confidence === 'high' ? 'HIGH CONFIDENCE (98%)' : `${card.confidence.toUpperCase()} CONFIDENCE`;
      const confWidth = ctx.measureText(confLabel).width + 12;

      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, confWidth, 16, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.fillText(confLabel, badgeX + 6, badgeY + 12);

      // 4. Object Title / Label
      ctx.font = 'bold 18px "Space Grotesk", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'transparent';
      ctx.fillText(card.label, cardX + padding, cardY + 52);

      // 5. Calm Narrator Short Answer
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      lines.forEach((line, lineIdx) => {
        ctx.fillText(line, cardX + padding, cardY + 76 + lineIdx * 18);
      });

      // 6. Footer: Speaking Equalizer + Wikipedia Reference
      const footerY = cardY + cardHeight - 16;

      if (state.speakingCardId === card.id || card.isSpeaking) {
        // Draw animated sound wave bars
        const now = Date.now();
        ctx.fillStyle = '#00f0ff';
        for (let i = 0; i < 4; i++) {
          const barHeight = 4 + Math.sin(now / 150 + i * 1.5) * 6;
          ctx.fillRect(cardX + padding + i * 4, footerY - barHeight, 2.5, barHeight);
        }

        ctx.font = '11px "Space Mono", monospace';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText('Calm Narrator Speaking...', cardX + padding + 22, footerY - 2);
      } else {
        ctx.font = '10px "Space Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`WIKIPEDIA GROUNDING: ${card.wikiTitle}`, cardX + padding, footerY - 2);
      }

      ctx.restore();
    });
  }

  private drawFullHUDControls(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: CompositorRenderState
  ) {
    ctx.save();

    const now = Date.now();

    // 1. Top-Left: Brand & Live HUD status
    ctx.fillStyle = 'rgba(5, 7, 13, 0.75)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(16, 16, 150, 32, 12);
    ctx.fill();
    ctx.stroke();

    // Glowing cyan dot
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GLANCE', 42, 36);

    ctx.font = '10px "Space Mono", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('AR v1.0', 98, 36);

    // 2. Live REC Timer Badge (Top Left next to brand)
    const duration = state.recordingDuration || 0;
    const mins = Math.floor(duration / 60).toString().padStart(2, '0');
    const secs = (duration % 60).toString().padStart(2, '0');
    const recTimeStr = `REC ${mins}:${secs}`;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.roundRect(174, 16, 95, 32, 10);
    ctx.fill();
    ctx.stroke();

    // Blinking red dot
    const blink = Math.floor(now / 500) % 2 === 0;
    ctx.fillStyle = blink ? '#ef4444' : 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(188, 32, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 11px "Space Mono", monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(recTimeStr, 198, 36);

    // 3. Top-Right: STOP Button Graphic & Status
    const hasActive = state.hasActiveRecognition || (state.cards && state.cards.length > 0) || state.isProcessing;
    const stopBtnW = 90;
    const stopBtnX = width - stopBtnW - 16;

    ctx.fillStyle = hasActive ? 'rgba(244, 63, 94, 0.35)' : 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = hasActive ? 'rgba(244, 63, 94, 0.8)' : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(stopBtnX, 16, stopBtnW, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px "Space Mono", monospace';
    ctx.fillStyle = hasActive ? '#fecdd3' : '#94a3b8';
    ctx.fillText('🛑 STOP', stopBtnX + 16, 36);

    // 4. STOP CLICKED FLASH BANNER (shows when user triggered STOP)
    if (state.stopClickedTimestamp && now - state.stopClickedTimestamp < 2200) {
      const elapsed = now - state.stopClickedTimestamp;
      const alpha = Math.max(0, 1 - elapsed / 2200);

      ctx.save();
      ctx.globalAlpha = alpha;
      const bannerW = 280;
      const bannerX = (width - bannerW) / 2;
      ctx.fillStyle = 'rgba(225, 29, 72, 0.9)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bannerX, 60, bannerW, 36, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('🛑 STOP RECOGNITION TRIGGERED', width / 2, 83);
      ctx.restore();
    }

    // 5. Processing Badge (Top Center)
    if (state.isProcessing) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      const procW = 180;
      const procX = (width - procW) / 2;
      ctx.beginPath();
      ctx.roundRect(procX, 16, procW, 32, 10);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px "Space Mono", monospace';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText('✨ ANALYZING TARGET...', width / 2, 36);
    }

    // 6. Bottom-Left Mode Indicator Pill
    const modeLabel = state.mode === 'HOLDING' ? "MODE: WHAT I'M HOLDING" : "MODE: WHAT I'M LOOKING AT";
    const modeColor = state.mode === 'HOLDING' ? '#00f0ff' : '#00ff9d';
    const modeBg = state.mode === 'HOLDING' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(0, 255, 157, 0.2)';
    const modeBorder = state.mode === 'HOLDING' ? 'rgba(0, 240, 255, 0.5)' : 'rgba(0, 255, 157, 0.5)';

    ctx.fillStyle = modeBg;
    ctx.strokeStyle = modeBorder;
    ctx.beginPath();
    ctx.roundRect(16, height - 48, 220, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10px "Space Mono", monospace';
    ctx.fillStyle = modeColor;
    ctx.textAlign = 'left';
    ctx.fillText(modeLabel, 26, height - 28);

    // 7. Bottom-Right Tactile Shutter HUD Graphic
    const shutterX = width - 110;
    const shutterY = height - 48;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.beginPath();
    ctx.roundRect(shutterX, shutterY, 94, 32, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10px "Space Mono", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('📷 CAPTURE', shutterX + 12, height - 28);

    ctx.restore();
  }

  private drawARWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    state: CompositorRenderState
  ) {
    ctx.save();

    // Top Right Glance HUD Logo in recording
    const logoText = 'GLANCE AR RECORDING';
    ctx.font = 'bold 10px "Space Mono", monospace';
    const textWidth = ctx.measureText(logoText).width;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(width - textWidth - 28, 12, textWidth + 18, 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.fillText(logoText, width - textWidth - 19, 26);

    // Processing badge if active
    if (state.isProcessing) {
      const procText = 'ANALYZING TARGET...';
      ctx.font = 'bold 10px "Space Mono", monospace';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fillText(procText, 20, 26);
    }

    ctx.restore();
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    font: string
  ): string[] {
    ctx.save();
    ctx.font = font;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    ctx.restore();
    return lines.slice(0, 4); // Max 4 lines on card
  }
}
