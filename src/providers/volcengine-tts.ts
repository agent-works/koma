import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { BaseProvider } from './base.js';
import {
  ProviderConfig,
  TextRequest,
  TextResponse,
  ImageRequest,
  ImageResponse,
  TTSRequest,
  TTSResponse,
} from '../types.js';

const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';

const MIME_BY_ENCODING: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/pcm',
  ogg_opus: 'audio/ogg',
};

export class VolcengineTTSProvider extends BaseProvider {
  name = 'volcengine-tts';
  private appid: string;
  private token: string;
  private cluster: string;
  private models: string[];

  constructor(config: ProviderConfig) {
    super();
    if (!config.appid) {
      throw new Error('volcengine-tts provider requires "appid" in config');
    }
    if (!config.key) {
      throw new Error('volcengine-tts provider requires "key" (access token) in config');
    }
    this.appid = config.appid;
    this.token = config.key;
    this.cluster = config.cluster || 'volcano_tts';
    this.models = config.models || [];
  }

  async generateText(_req: TextRequest): Promise<TextResponse> {
    throw new Error('Text generation is not supported by volcengine-tts provider');
  }

  async generateImage(_req: ImageRequest): Promise<ImageResponse> {
    throw new Error('Image generation is not supported by volcengine-tts provider');
  }

  async generateTTS(req: TTSRequest): Promise<TTSResponse> {
    if (!req.voice) {
      throw new Error(
        'TTS requires --voice. Run "koma tts --help -m ' + req.model + '" to see available voices.'
      );
    }

    // UTF-8 byte length check (1024 byte limit)
    const textBytes = Buffer.byteLength(req.text, 'utf-8');
    if (textBytes > 1024) {
      throw new Error(
        `Text exceeds 1024 UTF-8 bytes (got ${textBytes}). Split into shorter segments.`
      );
    }

    const encoding = req.format || 'mp3';
    const body = this.buildRequestBody(req, encoding);

    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer;${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Volcengine TTS HTTP error (${response.status}): ${errBody}`);
    }

    const result = (await response.json()) as any;

    if (result.code !== 3000) {
      throw new Error(
        `Volcengine TTS error (${result.code}): ${result.message || 'unknown'}`
      );
    }

    if (!result.data) {
      throw new Error('Volcengine TTS returned no audio data');
    }

    // Decode base64 and write to file
    const audioBuffer = Buffer.from(result.data, 'base64');
    const outputPath =
      req.outputPath || path.join(process.cwd(), `tts-${Date.now()}.${encoding}`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, audioBuffer);

    const durationMs = result.addition?.duration
      ? parseInt(String(result.addition.duration), 10)
      : undefined;

    return {
      model: req.model,
      filePath: outputPath,
      mimeType: MIME_BY_ENCODING[encoding] || 'application/octet-stream',
      sizeBytes: audioBuffer.length,
      durationMs: Number.isNaN(durationMs) ? undefined : durationMs,
    };
  }

  /**
   * Build the Volcengine TTS request body.
   * Exposed for testing (doesn't make network calls).
   */
  buildRequestBody(req: TTSRequest, encoding: string): any {
    const audio: any = {
      voice_type: req.voice,
      encoding,
      rate: req.sampleRate ?? 24000,
    };
    if (req.speed !== undefined) audio.speed_ratio = req.speed;
    if (req.volume !== undefined) audio.volume_ratio = req.volume;
    if (req.pitch !== undefined) audio.pitch_ratio = req.pitch;
    if (req.emotion !== undefined) audio.emotion = req.emotion;

    return {
      app: {
        appid: this.appid,
        token: this.token,
        cluster: this.cluster,
      },
      user: { uid: 'koma' },
      audio,
      request: {
        reqid: randomUUID(),
        text: req.text,
        text_type: 'plain',
        operation: 'query',
      },
    };
  }

  listModels(): string[] {
    return this.models;
  }
}
