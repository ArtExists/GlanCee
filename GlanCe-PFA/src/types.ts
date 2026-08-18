export type AppMode = 'HOLDING' | 'LOOKING_AT';
export type LookingAtFramingStyle = 'FINGERS_FRAME' | 'REVERSE_PINCH';

export interface Point2D {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
}

export interface BoundingBox {
  x: number; // Left (0 to 1)
  y: number; // Top (0 to 1)
  width: number; // Width (0 to 1)
  height: number; // Height (0 to 1)
}

export interface HandLandmarkData {
  landmarks: Point2D[];
  handedness: 'Left' | 'Right';
  score: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface VLMIdentificationResult {
  label: string;
  confidence: ConfidenceLevel;
  search_query: string;
  hasObject?: boolean;
  provider?: string;
}

export interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  thumbnailUrl?: string;
  contentUrl: string;
}

export interface IdentifiedCard {
  id: string;
  timestamp: number;
  label: string;
  confidence: ConfidenceLevel;
  shortAnswer: string; // 2-4 sentences for calm narrator voice
  expandedText: string; // Longer article extract
  wikiTitle: string;
  wikiUrl: string;
  wikiThumbnail?: string;
  box: BoundingBox;
  croppedThumbnailUrl?: string;
  mode: AppMode;
  provider?: string;
  isSpeaking?: boolean;
}

export interface AppSettings {
  qwenApiKey: string;
  qwenApiBaseUrl?: string;
  qwenModel?: string;
  anthropicApiKey: string;
  mistralApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  groqApiKey: string;
  backendUrl: string;
  autoSpeak: boolean;
  voiceRate: number;
  voicePitch: number;
  autoCaptureStability: boolean; // Auto-trigger after ~1s stability
  showLandmarks: boolean;
  cameraFacingMode: 'user' | 'environment';
  lookingAtFramingStyle?: LookingAtFramingStyle;
  includeHUDInRecording: boolean;
}

export interface SimulationPreset {
  id: string;
  title: string;
  mode: AppMode;
  imageUrl: string;
  defaultBox: BoundingBox;
  fallbackIdentification: VLMIdentificationResult;
  fallbackWiki: WikipediaSummary;
  fallbackShortAnswer: string;
}

export type RecordingState = 'idle' | 'recording' | 'processing' | 'ready';

export interface RecordedSession {
  id: string;
  blob: Blob;
  url: string;
  duration: number; // in seconds
  size: number; // in bytes
  timestamp: number;
  mimeType: string;
}
