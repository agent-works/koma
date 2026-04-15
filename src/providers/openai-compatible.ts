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
    const messages: Array<{ role: string; content: string }> = [];

    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });

    const body: any = {
      model: req.model,
      messages,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;

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
    const body: any = {
      model: req.model,
      prompt: req.prompt,
      n: 1,
      response_format: 'b64_json',
    };
    if (req.width && req.height) {
      body.size = `${req.width}x${req.height}`;
    }

    const response = await fetch(`${this.endpoint}/v1/images/generations`, {
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
    };
  }

  listModels(): string[] {
    return this.config.models;
  }
}
