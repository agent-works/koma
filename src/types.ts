export interface KomaConfig {
  defaults: { text?: string; image?: string; video?: string; tts?: string };
  providers: Record<string, ProviderConfig>;
}

export interface ServiceAccountConfig {
  client_email: string;
  private_key: string;
}

export interface ProviderConfig {
  type: 'vertex-ai' | 'volcengine-ark' | 'openai' | 'anthropic' | 'openai-compatible' | 'volcengine-tts';
  /** API key or access token */
  key?: string;
  /** Custom base URL (for openai-compatible providers) */
  endpoint?: string;
  /** GCP project ID (vertex-ai) */
  project?: string;
  /** GCP region (vertex-ai) */
  location?: string;
  /** Inline service account credentials (vertex-ai) */
  service_account?: ServiceAccountConfig;
  /** Application ID (volcengine-tts) */
  appid?: string;
  /** Cluster identifier (volcengine-tts, e.g., "volcano_tts") */
  cluster?: string;
  models: string[];
}

export interface TextRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Attached files for multimodal input (images, video, audio, PDF) */
  files?: Array<{ mimeType: string; data: string }>;
}

export interface TextResponse {
  model: string;
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ImageRequest {
  model: string;
  prompt: string;
  outputPath?: string;
  width?: number;
  height?: number;
  /** Attached files for reference image input */
  files?: Array<{ mimeType: string; data: string }>;
}

export interface ImageResponse {
  model: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface VideoRequest {
  model: string;
  prompt: string;
  outputPath?: string;
  /** First-frame image URL or local path for image-to-video */
  referenceImageUrl?: string;
  /** Aspect ratio: "16:9" | "9:16" | "1:1" | "21:9" | "3:4" | "adaptive" */
  ratio?: string;
  /** Duration in seconds: 5 or 10 */
  duration?: number;
  /** Whether to generate audio */
  generateAudio?: boolean;
  /** Random seed for reproducibility (0–4294967295) */
  seed?: number;
  /** Whether to add watermark */
  watermark?: boolean;
  /** Negative prompt — what to exclude */
  negativePrompt?: string;
  /** Keep camera static */
  cameraFixed?: boolean;
  /** Poll interval in ms (default 5000) */
  pollIntervalMs?: number;
  /** Max wait time in ms (default 600000 = 10 min) */
  timeoutMs?: number;
  /** Output resolution: "480p", "720p", "1080p" */
  resolution?: string;
  /** Last frame image URL or path (for first+last frame control) */
  lastFrameUrl?: string;
  /** Return last frame URL in response (for chaining clips) */
  returnLastFrame?: boolean;
  /** Draft preview mode (lower cost, 1.5 Pro only) */
  draft?: boolean;
}

export interface VideoResponse {
  model: string;
  taskId: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  videoUrl?: string;
  filePath?: string;
  /** Last frame image URL (when return_last_frame was requested) */
  lastFrameUrl?: string;
  error?: string;
}

export interface TTSRequest {
  model: string;
  text: string;
  /** Provider-specific voice ID (e.g., "zh_male_aojiaobazong_moon_bigtts") */
  voice?: string;
  /** Speech rate 0.2-3.0 (default 1.0) */
  speed?: number;
  /** Volume 0.1-3.0 (default 1.0) */
  volume?: number;
  /** Pitch 0.1-3.0 (default 1.0) */
  pitch?: number;
  /** Emotion (only supported by *_emo_* voices) */
  emotion?: string;
  /** Audio format */
  format?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Output file path */
  outputPath?: string;
}

export interface TTSResponse {
  model: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  /** Duration in milliseconds (if returned by API) */
  durationMs?: number;
}

export interface Provider {
  name: string;
  generateText(req: TextRequest): Promise<TextResponse>;
  generateImage(req: ImageRequest): Promise<ImageResponse>;
  generateVideo?(req: VideoRequest): Promise<VideoResponse>;
  generateTTS?(req: TTSRequest): Promise<TTSResponse>;
  listModels(): string[];
}
