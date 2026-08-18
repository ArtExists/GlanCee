import { VLMIdentificationResult } from '../types';

/**
 * On-Device Neural Vision Service
 * Uses TensorFlow.js + MobileNet & COCO-SSD running directly in browser WebGL/Wasm
 * to provide 100% free, offline, instant visual recognition without needing cloud API keys,
 * seamlessly paired with the Wikipedia REST API for grounding and calm voice narration.
 */

// Common ImageNet / COCO label cleanup to Wikipedia article queries
const LABEL_TO_WIKIPEDIA_MAP: Record<string, { label: string; wikiQuery: string }> = {
  // Mobile / Tech
  'cellular telephone': { label: 'Mobile Phone', wikiQuery: 'Mobile phone' },
  'cell phone': { label: 'Mobile Phone', wikiQuery: 'Mobile phone' },
  'mobile phone': { label: 'Mobile Phone', wikiQuery: 'Mobile phone' },
  'smart phone': { label: 'Smartphone', wikiQuery: 'Smartphone' },
  'hand-held computer': { label: 'Smartphone', wikiQuery: 'Smartphone' },
  'notebook': { label: 'Laptop', wikiQuery: 'Laptop' },
  'notebook, notebook computer': { label: 'Laptop', wikiQuery: 'Laptop' },
  'laptop': { label: 'Laptop', wikiQuery: 'Laptop' },
  'laptop computer': { label: 'Laptop', wikiQuery: 'Laptop' },
  'computer keyboard': { label: 'Computer Keyboard', wikiQuery: 'Computer keyboard' },
  'keyboard': { label: 'Computer Keyboard', wikiQuery: 'Computer keyboard' },
  'mouse': { label: 'Computer Mouse', wikiQuery: 'Computer mouse' },
  'computer mouse': { label: 'Computer Mouse', wikiQuery: 'Computer mouse' },
  'mouse, computer mouse': { label: 'Computer Mouse', wikiQuery: 'Computer mouse' },
  'monitor': { label: 'Computer Monitor', wikiQuery: 'Computer monitor' },
  'screen': { label: 'Display Screen', wikiQuery: 'Computer monitor' },
  'television': { label: 'Television', wikiQuery: 'Television' },
  'tv': { label: 'Television', wikiQuery: 'Television' },
  'remote': { label: 'Remote Control', wikiQuery: 'Remote control' },
  'remote control': { label: 'Remote Control', wikiQuery: 'Remote control' },
  'remote control, remote': { label: 'Remote Control', wikiQuery: 'Remote control' },
  'headphones': { label: 'Headphones', wikiQuery: 'Headphones' },
  'headphone': { label: 'Headphones', wikiQuery: 'Headphones' },
  'earphone': { label: 'Earphones', wikiQuery: 'Headphones' },
  'microphone': { label: 'Microphone', wikiQuery: 'Microphone' },

  // Everyday items & accessories
  'wrist watch': { label: 'Wristwatch', wikiQuery: 'Watch' },
  'watch': { label: 'Watch', wikiQuery: 'Watch' },
  'digital watch': { label: 'Digital Watch', wikiQuery: 'Digital watch' },
  'analog watch': { label: 'Analog Watch', wikiQuery: 'Watch' },
  'sunglasses': { label: 'Sunglasses', wikiQuery: 'Sunglasses' },
  'sunglass': { label: 'Sunglasses', wikiQuery: 'Sunglasses' },
  'eyeglasses': { label: 'Eyeglasses', wikiQuery: 'Glasses' },
  'glasses': { label: 'Glasses', wikiQuery: 'Glasses' },
  'spectacles': { label: 'Eyeglasses', wikiQuery: 'Glasses' },
  'wallet': { label: 'Wallet', wikiQuery: 'Wallet' },
  'purse': { label: 'Purse / Handbag', wikiQuery: 'Handbag' },
  'handbag': { label: 'Handbag', wikiQuery: 'Handbag' },
  'backpack': { label: 'Backpack', wikiQuery: 'Backpack' },
  'book': { label: 'Book', wikiQuery: 'Book' },
  'comic book': { label: 'Comic Book', wikiQuery: 'Comic book' },
  'magazine': { label: 'Magazine', wikiQuery: 'Magazine' },
  'ballpoint': { label: 'Pen', wikiQuery: 'Ballpoint pen' },
  'ballpoint pen': { label: 'Ballpoint Pen', wikiQuery: 'Ballpoint pen' },
  'ballpoint, ballpoint pen, ballpen, Biro': { label: 'Pen', wikiQuery: 'Ballpoint pen' },
  'fountain pen': { label: 'Fountain Pen', wikiQuery: 'Fountain pen' },
  'quill': { label: 'Quill Pen', wikiQuery: 'Quill' },
  'pencil': { label: 'Pencil', wikiQuery: 'Pencil' },
  'pencil box': { label: 'Pencil Case', wikiQuery: 'Pencil case' },
  'scissors': { label: 'Scissors', wikiQuery: 'Scissors' },

  // Drinkware & Kitchen
  'coffee mug': { label: 'Coffee Mug', wikiQuery: 'Coffee cup' },
  'mug': { label: 'Mug', wikiQuery: 'Mug' },
  'cup': { label: 'Cup', wikiQuery: 'Cup' },
  'tea cup': { label: 'Tea Cup', wikiQuery: 'Teacup' },
  'teacup': { label: 'Teacup', wikiQuery: 'Teacup' },
  'water bottle': { label: 'Water Bottle', wikiQuery: 'Water bottle' },
  'bottle': { label: 'Bottle', wikiQuery: 'Bottle' },
  'pop bottle': { label: 'Bottle', wikiQuery: 'Bottle' },
  'beer bottle': { label: 'Bottle', wikiQuery: 'Beer bottle' },
  'wine bottle': { label: 'Wine Bottle', wikiQuery: 'Wine bottle' },
  'wine glass': { label: 'Wine Glass', wikiQuery: 'Wine glass' },
  'goblet': { label: 'Goblet', wikiQuery: 'Goblet' },
  'plate': { label: 'Plate', wikiQuery: 'Plate (dishware)' },
  'fork': { label: 'Fork', wikiQuery: 'Fork' },
  'spoon': { label: 'Spoon', wikiQuery: 'Spoon' },
  'knife': { label: 'Knife', wikiQuery: 'Knife' },
  'bowl': { label: 'Bowl', wikiQuery: 'Bowl' },

  // Plants & Nature
  'houseplant': { label: 'Houseplant', wikiQuery: 'Houseplant' },
  'potted plant': { label: 'Potted Plant', wikiQuery: 'Houseplant' },
  'plant': { label: 'Plant', wikiQuery: 'Plant' },
  'flowerpot': { label: 'Flowerpot', wikiQuery: 'Flowerpot' },
  'vase': { label: 'Vase', wikiQuery: 'Vase' },

  // Food
  'banana': { label: 'Banana', wikiQuery: 'Banana' },
  'apple': { label: 'Apple', wikiQuery: 'Apple' },
  'orange': { label: 'Orange', wikiQuery: 'Orange (fruit)' },
  'sandwich': { label: 'Sandwich', wikiQuery: 'Sandwich' },
  'pizza': { label: 'Pizza', wikiQuery: 'Pizza' },
  'bread': { label: 'Bread', wikiQuery: 'Bread' },

  // Furniture & Room
  'chair': { label: 'Chair', wikiQuery: 'Chair' },
  'couch': { label: 'Couch', wikiQuery: 'Couch' },
  'table': { label: 'Table', wikiQuery: 'Table (furniture)' },
  'desk': { label: 'Desk', wikiQuery: 'Desk' },
  'lamp': { label: 'Lamp', wikiQuery: 'Lamp' },
  'desk lamp': { label: 'Desk Lamp', wikiQuery: 'Lamp' },
  'clock': { label: 'Clock', wikiQuery: 'Clock' },
  'analog clock': { label: 'Clock', wikiQuery: 'Clock' },
  'digital clock': { label: 'Digital Clock', wikiQuery: 'Digital clock' },
};

// Non-object terms that indicate no actual held item (e.g. human body parts, background)
const IGNORED_CLASSES = new Set([
  'person',
  'human face',
  'face',
  'skin',
  'hand',
  'finger',
  'palm',
  'wrist',
  'wall',
  'ceiling',
  'floor',
  'background',
  'blur',
  'noise',
]);

class LocalVisionService {
  private mobilenetModel: any = null;
  private cocoSsdModel: any = null;
  private initPromise: Promise<boolean> | null = null;

  /**
   * Initializes MobileNet & COCO-SSD models in the browser
   */
  public async init(): Promise<boolean> {
    if (this.mobilenetModel || this.cocoSsdModel) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Check if window.mobilenet or window.cocoSsd are available via CDN scripts
        const win = window as any;

        const loadPromises: Promise<any>[] = [];

        if (win.mobilenet && !this.mobilenetModel) {
          loadPromises.push(
            win.mobilenet.load({ version: 2, alpha: 1.0 }).then((model: any) => {
              this.mobilenetModel = model;
              console.log('✓ On-Device MobileNet model loaded successfully');
            }).catch((err: any) => console.warn('MobileNet load error:', err))
          );
        }

        if (win.cocoSsd && !this.cocoSsdModel) {
          loadPromises.push(
            win.cocoSsd.load().then((model: any) => {
              this.cocoSsdModel = model;
              console.log('✓ On-Device COCO-SSD model loaded successfully');
            }).catch((err: any) => console.warn('COCO-SSD load error:', err))
          );
        }

        await Promise.all(loadPromises);
        return Boolean(this.mobilenetModel || this.cocoSsdModel);
      } catch (e) {
        console.warn('Local vision initialization warning:', e);
        return false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Classify an image (from base64 data URL, canvas, or video element) on-device
   */
  public async classifyImage(
    source: string | HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
    _mode: 'HOLDING' | 'LOOKING_AT' = 'HOLDING',
    hintQuery?: string
  ): Promise<VLMIdentificationResult> {
    // Ensure models are loaded
    await this.init();

    // Prepare HTMLImageElement or Canvas for inference
    let imgElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

    if (typeof source === 'string') {
      imgElement = await this.loadImageElement(source);
    } else {
      imgElement = source;
    }

    // 1. Try COCO-SSD Object Detection
    let detectedCocoLabel: string | null = null;
    let cocoConfidence: number = 0;

    if (this.cocoSsdModel) {
      try {
        const predictions: Array<{ class: string; score: number; bbox: [number, number, number, number] }> =
          await this.cocoSsdModel.detect(imgElement);

        if (predictions && predictions.length > 0) {
          // Filter out purely "person" if another object exists in frame
          const objectPredictions = predictions.filter((p) => !IGNORED_CLASSES.has(p.class.toLowerCase()));
          const top = objectPredictions[0] || (predictions[0].class !== 'person' ? predictions[0] : null);

          if (top && top.score > 0.40) {
            detectedCocoLabel = top.class;
            cocoConfidence = top.score;
          }
        }
      } catch (err) {
        console.warn('COCO-SSD inference error:', err);
      }
    }

    // 2. Try MobileNet Fine-Grained Classification
    let detectedMobileNetLabel: string | null = null;
    let mobileNetConfidence: number = 0;

    if (this.mobilenetModel) {
      try {
        const topPredictions: Array<{ className: string; probability: number }> =
          await this.mobilenetModel.classify(imgElement, 5);

        if (topPredictions && topPredictions.length > 0) {
          for (const pred of topPredictions) {
            const raw = pred.className.toLowerCase();
            const isIgnored = Array.from(IGNORED_CLASSES).some((c) => raw.includes(c));
            if (!isIgnored && pred.probability > 0.08) {
              detectedMobileNetLabel = pred.className;
              mobileNetConfidence = pred.probability;
              break;
            }
          }
          if (!detectedMobileNetLabel && topPredictions[0].probability > 0.15) {
            detectedMobileNetLabel = topPredictions[0].className;
            mobileNetConfidence = topPredictions[0].probability;
          }
        }
      } catch (err) {
        console.warn('MobileNet inference error:', err);
      }
    }

    // 3. Synthesize Best Classification
    let rawLabel = detectedMobileNetLabel || detectedCocoLabel || '';
    
    // Check if the user supplied a hint query
    if (hintQuery && hintQuery.trim()) {
      rawLabel = hintQuery.trim();
    }

    if (!rawLabel) {
      // Analyze image color / brightness / variance to avoid false negatives on blank frames
      const visualAnalysis = this.analyzeCanvasHeuristics(imgElement);
      if (visualAnalysis.hasSignificantSubject) {
        rawLabel = visualAnalysis.inferredCategory;
      }
    }

    if (!rawLabel) {
      return {
        hasObject: false,
        label: 'No Object Detected',
        confidence: 'high',
        search_query: '',
        provider: 'On-Device Vision (Empty View)',
      };
    }

    // Normalize Label & Wikipedia search query
    const mapped = this.resolveWikipediaMapping(rawLabel);

    return {
      hasObject: true,
      label: mapped.label,
      confidence: (cocoConfidence > 0.65 || mobileNetConfidence > 0.35) ? 'high' : 'medium',
      search_query: mapped.wikiQuery,
      provider: `On-Device Neural Vision (${this.mobilenetModel ? 'MobileNet' : 'COCO-SSD'} + Wikipedia)`,
    };
  }

  /**
   * Resolves raw model classes to clean human-readable names and standard Wikipedia queries
   */
  public resolveWikipediaMapping(raw: string): { label: string; wikiQuery: string } {
    const clean = raw.trim().toLowerCase();

    // Check direct map
    for (const [key, val] of Object.entries(LABEL_TO_WIKIPEDIA_MAP)) {
      if (clean === key || clean.includes(key) || key.includes(clean)) {
        return val;
      }
    }

    // Comma-separated synonyms from ImageNet (e.g. "cellular telephone, cell phone")
    const primaryName = raw.split(',')[0].trim();
    const capitalized = primaryName.charAt(0).toUpperCase() + primaryName.slice(1);

    return {
      label: capitalized,
      wikiQuery: capitalized,
    };
  }

  /**
   * Helper to load an Image element from base64 data URL
   */
  private loadImageElement(base64Data: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = base64Data;
    });
  }

  /**
   * Heuristic visual analysis of canvas pixels
   */
  private analyzeCanvasHeuristics(
    source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): { hasSignificantSubject: boolean; inferredCategory: string } {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { hasSignificantSubject: false, inferredCategory: '' };

      ctx.drawImage(source, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64);
      const data = imgData.data;

      let totalBrightness = 0;
      let totalVariation = 0;
      let prevLum = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += lum;
        if (i > 0) totalVariation += Math.abs(lum - prevLum);
        prevLum = lum;
      }

      const pixelCount = 64 * 64;
      const avgBrightness = totalBrightness / pixelCount;
      const avgVariation = totalVariation / pixelCount;

      // If frame is almost completely black or completely solid white/gray
      if (avgBrightness < 15 || avgBrightness > 245 || avgVariation < 4) {
        return { hasSignificantSubject: false, inferredCategory: '' };
      }

      return { hasSignificantSubject: true, inferredCategory: 'Object' };
    } catch {
      return { hasSignificantSubject: false, inferredCategory: '' };
    }
  }
}

export const localVisionService = new LocalVisionService();
