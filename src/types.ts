export interface KomaConfig {
  defaults: { text?: string; image?: string; video?: string };
  providers: Record<string, ProviderConfig>;
}

export interface ProviderConfig {
  type: 'vertex-ai' | 'openai' | 'anthropic' | 'openai-compatible';
  credentials?: string;
  key?: string;
  endpoint?: string;
  location?: string;
  models: string[];
}

export interface TextRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
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
}

export interface ImageResponse {
  model: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Provider {
  name: string;
  generateText(req: TextRequest): Promise<TextResponse>;
  generateImage(req: ImageRequest): Promise<ImageResponse>;
  listModels(): string[];
}
