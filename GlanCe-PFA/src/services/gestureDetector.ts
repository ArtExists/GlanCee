import { BoundingBox, HandLandmarkData, Point2D } from '../types';

export interface GestureDetectionResult {
  hasTarget: boolean;
  box: BoundingBox;
  isStable: boolean;
  stabilityProgress: number; // 0 to 1
  handCount: number;
  confidence: number;
  message: string;
  proximity?: number; // 0 (far) to 1 (close to screen)
}

export class GestureDetector {
  private smoothedBox: BoundingBox | null = null;
  private lastBox: BoundingBox | null = null;
  private stableStartTime: number | null = null;
  private smoothingAlpha: number = 0.35; // Exponential smoothing factor

  public reset() {
    this.smoothedBox = null;
    this.lastBox = null;
    this.stableStartTime = null;
  }

  /**
   * Mode: "What I'm Holding"
   * Dynamically scales the capture area based on hand proximity to the camera/screen:
   * Closer hands -> Significantly larger capture area to capture full foreground objects.
   * Farther hands -> Focused capture area around the palm.
   */
  public processHoldingMode(
    hands: HandLandmarkData[],
    stabilityThresholdMs: number = 1000
  ): GestureDetectionResult {
    if (!hands || hands.length === 0) {
      this.reset();
      // Fallback: Default center ROI with lower confidence
      const defaultCenter: BoundingBox = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
      return {
        hasTarget: false,
        box: defaultCenter,
        isStable: false,
        stabilityProgress: 0,
        handCount: 0,
        confidence: 0.3,
        message: 'No hand detected. Hold an object in front of the camera.',
      };
    }

    const handBoxes: BoundingBox[] = [];
    let maxProximity = 0;

    for (const hand of hands) {
      const lm = hand.landmarks;
      if (lm.length < 21) continue;

      // Key landmarks: 0 (wrist), 5 (index MCP), 9 (middle MCP), 13 (ring MCP), 17 (pinky MCP)
      const wrist = lm[0];
      const indexMcp = lm[5];
      const middleMcp = lm[9];
      const ringMcp = lm[13];
      const pinkyMcp = lm[17];

      // Palm center = average of wrist and finger bases
      const palmCenter: Point2D = {
        x: (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5,
        y: (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5,
      };

      // 1. Palm width (index MCP to pinky MCP)
      const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);

      // 2. Estimate Proximity (0 = far away, 1.0 = very close to screen)
      // Normal palm width ranges from ~0.07 (far) to ~0.35+ (very close)
      const proximity = Math.min(1.0, Math.max(0.0, (palmWidth - 0.07) / 0.24));
      if (proximity > maxProximity) maxProximity = proximity;

      // Direction vector from wrist to middle finger MCP
      const dirX = middleMcp.x - wrist.x;
      const dirY = middleMcp.y - wrist.y;
      const dirLen = Math.hypot(dirX, dirY) || 1;
      const normDirX = dirX / dirLen;
      const normDirY = dirY / dirLen;

      // Center the ROI slightly above the palm center in the direction the fingers point
      const offsetDist = palmWidth * (0.65 + proximity * 0.35);
      const roiCenterX = palmCenter.x + normDirX * offsetDist;
      const roiCenterY = palmCenter.y + normDirY * offsetDist;

      // DYNAMIC AREA SCALING BASED ON SCREEN PROXIMITY:
      // Closer the hand is to the screen -> Wider & taller capture area to encompass large held objects
      const expansionScaleW = 2.8 + proximity * 2.5; // Scale factor 2.8x (far) up to 5.3x (close)
      const expansionScaleH = 3.2 + proximity * 2.8; // Scale factor 3.2x (far) up to 6.0x (close)

      const boxW = Math.max(0.32, Math.min(0.92, palmWidth * expansionScaleW));
      const boxH = Math.max(0.36, Math.min(0.94, palmWidth * expansionScaleH));

      const rawBox: BoundingBox = {
        x: Math.max(0.02, Math.min(0.98 - boxW, roiCenterX - boxW / 2)),
        y: Math.max(0.02, Math.min(0.98 - boxH, roiCenterY - boxH / 2)),
        width: boxW,
        height: boxH,
      };

      handBoxes.push(rawBox);
    }

    if (handBoxes.length === 0) {
      return {
        hasTarget: false,
        box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        isStable: false,
        stabilityProgress: 0,
        handCount: 0,
        confidence: 0.3,
        message: 'Searching for hand...',
      };
    }

    // Merge ROIs if two hands are visible and holding an object together
    let targetBox = handBoxes[0];
    if (handBoxes.length > 1) {
      const minX = Math.min(handBoxes[0].x, handBoxes[1].x);
      const minY = Math.min(handBoxes[0].y, handBoxes[1].y);
      const maxX = Math.max(handBoxes[0].x + handBoxes[0].width, handBoxes[1].x + handBoxes[1].width);
      const maxY = Math.max(handBoxes[0].y + handBoxes[0].height, handBoxes[1].y + handBoxes[1].height);

      // Add extra padding when holding with two hands
      const pad = 0.04;
      const combinedX = Math.max(0.02, minX - pad);
      const combinedY = Math.max(0.02, minY - pad);
      targetBox = {
        x: combinedX,
        y: combinedY,
        width: Math.min(0.96 - combinedX, (maxX - minX) + pad * 2),
        height: Math.min(0.96 - combinedY, (maxY - minY) + pad * 2),
      };
    }

    // Smooth bounding box
    const smoothed = this.smoothBox(targetBox);
    const { isStable, progress } = this.checkStability(smoothed, stabilityThresholdMs);

    return {
      hasTarget: true,
      box: smoothed,
      isStable,
      stabilityProgress: progress,
      handCount: hands.length,
      confidence: 0.95,
      proximity: maxProximity,
      message: isStable
        ? 'Object locked! Ready to capture.'
        : maxProximity > 0.6
        ? 'Close-up target detected. Hold steady...'
        : 'Hold object steady in front of camera...',
    };
  }

  /**
   * Mode: "What I'm Looking At"
   * Detects "framing square" gesture (two hands forming opposite L-corners).
   * Dynamically expands the framed area with generous margin padding based on hand proximity.
   */
  public processLookingAtMode(
    hands: HandLandmarkData[],
    stabilityThresholdMs: number = 750
  ): GestureDetectionResult {
    if (!hands || hands.length < 2) {
      this.reset();
      return {
        hasTarget: false,
        box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        isStable: false,
        stabilityProgress: 0,
        handCount: hands ? hands.length : 0,
        confidence: 0.4,
        message: hands?.length === 1 ? 'Bring second hand to complete frame' : 'Frame with both hands (L-shapes)',
      };
    }

    // Collect index tips (8) and thumb tips (4) from both hands
    const hand1 = hands[0].landmarks;
    const hand2 = hands[1].landmarks;

    if (hand1.length < 21 || hand2.length < 21) {
      return {
        hasTarget: false,
        box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        isStable: false,
        stabilityProgress: 0,
        handCount: 2,
        confidence: 0.5,
        message: 'Aligning hand landmarks...',
      };
    }

    const keyPoints: Point2D[] = [
      hand1[4], // Hand 1 Thumb Tip
      hand1[8], // Hand 1 Index Tip
      hand2[4], // Hand 2 Thumb Tip
      hand2[8], // Hand 2 Index Tip
    ];

    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;

    for (const pt of keyPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;

    // Ensure frame size is reasonable (not touching tips together or across entire screen)
    if (boxWidth < 0.08 || boxHeight < 0.08) {
      return {
        hasTarget: false,
        box: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        isStable: false,
        stabilityProgress: 0,
        handCount: 2,
        confidence: 0.5,
        message: 'Expand fingers to open framing square',
      };
    }

    // Measure proximity based on hand size
    const hand1Span = Math.hypot(hand1[8].x - hand1[0].x, hand1[8].y - hand1[0].y);
    const hand2Span = Math.hypot(hand2[8].x - hand2[0].x, hand2[8].y - hand2[0].y);
    const avgHandSpan = (hand1Span + hand2Span) / 2;
    const frameProximity = Math.min(1.0, Math.max(0.1, (avgHandSpan - 0.10) / 0.30));

    // Dynamic margin expansion based on proximity (closer = larger capture area beyond fingertips)
    const marginPercent = 0.10 + frameProximity * 0.15; // 10% to 25% margin padding
    const padW = boxWidth * marginPercent;
    const padH = boxHeight * marginPercent;

    const clampedX = Math.max(0.02, minX - padW);
    const clampedY = Math.max(0.02, minY - padH);
    const clampedW = Math.min(0.96 - clampedX, boxWidth + padW * 2);
    const clampedH = Math.min(0.96 - clampedY, boxHeight + padH * 2);

    const rawBox: BoundingBox = {
      x: clampedX,
      y: clampedY,
      width: Math.max(0.30, clampedW),
      height: Math.max(0.30, clampedH),
    };

    const smoothed = this.smoothBox(rawBox);
    const { isStable, progress } = this.checkStability(smoothed, stabilityThresholdMs);

    return {
      hasTarget: true,
      box: smoothed,
      isStable,
      stabilityProgress: progress,
      handCount: 2,
      confidence: 0.95,
      proximity: frameProximity,
      message: isStable ? 'Frame locked! Capturing...' : 'Hold frame steady...',
    };
  }

  private smoothBox(newBox: BoundingBox): BoundingBox {
    if (!this.smoothedBox) {
      this.smoothedBox = { ...newBox };
      return this.smoothedBox;
    }

    const a = this.smoothingAlpha;
    this.smoothedBox = {
      x: this.smoothedBox.x * (1 - a) + newBox.x * a,
      y: this.smoothedBox.y * (1 - a) + newBox.y * a,
      width: this.smoothedBox.width * (1 - a) + newBox.width * a,
      height: this.smoothedBox.height * (1 - a) + newBox.height * a,
    };

    return this.smoothedBox;
  }

  private checkStability(
    currentBox: BoundingBox,
    thresholdMs: number
  ): { isStable: boolean; progress: number } {
    const now = Date.now();

    if (!this.lastBox) {
      this.lastBox = { ...currentBox };
      this.stableStartTime = now;
      return { isStable: false, progress: 0 };
    }

    // Measure delta movement
    const dx = Math.abs(currentBox.x - this.lastBox.x);
    const dy = Math.abs(currentBox.y - this.lastBox.y);
    const dw = Math.abs(currentBox.width - this.lastBox.width);
    const dh = Math.abs(currentBox.height - this.lastBox.height);
    const movement = dx + dy + dw + dh;

    // Movement threshold for stability (slightly more forgiving for close-up hands)
    const maxJitter = 0.05;

    if (movement < maxJitter) {
      if (!this.stableStartTime) {
        this.stableStartTime = now;
      }
      const elapsed = now - this.stableStartTime;
      const progress = Math.min(1, elapsed / thresholdMs);
      const isStable = elapsed >= thresholdMs;
      return { isStable, progress };
    } else {
      // Movement reset
      this.lastBox = { ...currentBox };
      this.stableStartTime = now;
      return { isStable: false, progress: 0 };
    }
  }
}

export const gestureDetector = new GestureDetector();
