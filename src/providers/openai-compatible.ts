import fs from 'fs';
import path from 'path';
import { BaseProvider } from './base.js';
import {
  ProviderConfig,
  TextRequest,
  TextResponse,
  ImageRequest,
  ImageResponse,
} from '../types.js';

export class OpenAICompatibleProvider extends BaseProvider {
  name = 'openai-compatible';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    if (!config.key) {
      throw new Error('OpenAI-compatible provider requires an API key');
    }
    if (!config.endpoint) {
      throw new Error('OpenAI-compatible provider requires an endpoint');
    }
  }

  private get endpoint(): string {
    // Normalize: strip trailing slash
    return this.config.endpoint!.replace(/\/+$/, '');
  }

  async generateText(req: TextRequest): Promise<TextResponse> {
    const messages: Array<{ role: string; content: any }> = [];

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }

    // Build user message: plain string or multimodal content array
    const imageFiles = (req.files || []).filter(f => f.mimeType.startsWith('image/'));

    if (imageFiles.length > 0) {
      const content: any[] = [{ type: 'text', text: req.prompt }];
      for (const file of imageFiles) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${file.mimeType};base64,${file.data}` },
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: req.prompt });
    }

    const body: any = {
      model: req.model,
      messages,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    body.max_tokens = req.maxTokens ?? 8192;

    const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI-compatible API error (${response.status}): ${errBody}`);
    }

    const result = await response.json() as any;

    const choice = result.choices?.[0];
    const text = choice?.message?.content || '';

    const usage = result.usage
      ? {
          inputTokens: result.usage.prompt_tokens || 0,
          outputTokens: result.usage.completion_tokens || 0,
        }
      : undefined;

    return { model: req.model, text, usage };
  }

  async generateImage(req: ImageRequest): Promise<ImageResponse> {
    const imageFiles = (req.files || []).filter(f => f.mimeType.startsWith('image/'));
    if ((req.files || []).length > imageFiles.length) {
      throw new Error('OpenAI-compatible image generation only supports image reference files');
    }

    if (imageFiles.length > 0) {
      return this.generateImageEdit(req, imageFiles);
    }

    const body: any = {
      model: req.model,
      prompt: req.prompt,
      n: 1,
    };
    // gpt-image-* models don't accept response_format and return b64_json by default.
    // Older DALL-E models default to URL, so we explicitly request b64_json for those.
    if (!req.model.startsWith('gpt-image')) {
      body.response_format = 'b64_json';
    }
    if (req.width && req.height) {
      body.size = `${req.width}x${req.height}`;
    }
    if (req.size) body.size = req.size;
    if (req.quality) body.quality = req.quality;

    const response = await fetch(`${this.endpoint}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await this.parseImageResponse(response);
    return this.writeImageResult(req, result);
  }

  private async generateImageEdit(
    req: ImageRequest,
    imageFiles: Array<{ mimeType: string; data: string; filename?: string }>
  ): Promise<ImageResponse> {
    const form = new FormData();
    form.append('model', req.model);
    form.append('prompt', req.prompt);
    form.append('n', '1');
    if (req.size) form.append('size', req.size);
    if (req.quality) form.append('quality', req.quality);
    if (!req.model.startsWith('gpt-image')) {
      form.append('response_format', 'b64_json');
    }

    imageFiles.forEach((file, index) => {
      const buffer = Buffer.from(file.data, 'base64');
      const blob = new Blob([new Uint8Array(buffer)], { type: file.mimeType });
      form.append('image', blob, file.filename || this.defaultImageFilename(file.mimeType, index));
    });

    const response = await fetch(`${this.endpoint}/v1/images/edits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.key}`,
      },
      body: form,
    });

    const result = await this.parseImageResponse(response);
    return this.writeImageResult(req, result);
  }

  private async parseImageResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI-compatible API error (${response.status}): ${errBody}`);
    }
    const result = await response.json() as any;
    return result;
  }

  private writeImageResult(req: ImageRequest, result: any): ImageResponse {
    const imageData = result.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error('No image data in OpenAI-compatible response');
    }

    const outputPath = req.outputPath || path.join(process.cwd(), `image-${Date.now()}.png`);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);

    return {
      model: req.model,
      filePath: outputPath,
      mimeType: 'image/png',
      sizeBytes: buffer.length,
      usage: result.usage,
    };
  }

  private defaultImageFilename(mimeType: string, index: number): string {
    const extByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/heic': 'heic',
    };
    const ext = extByMime[mimeType] || 'png';
    return `reference-${index + 1}.${ext}`;
  }

  listModels(): string[] {
    return this.config.models;
  }
}
