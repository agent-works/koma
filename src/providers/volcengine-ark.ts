import fs from 'fs';
import path from 'path';
import { BaseProvider } from './base.js';
import {
  TextRequest,
  TextResponse,
  ImageRequest,
  ImageResponse,
  VideoRequest,
  VideoResponse,
  ProviderConfig,
} from '../types.js';

/**
 * Volcengine Ark provider — supports Doubao text models and Seedance video generation.
 *
 * Video generation is async: create task → poll status → download video.
 *
 * Supported models:
 *   - doubao-seedance-2-0-260128  (Seedance 2.0)
 *   - doubao-seedance-1-5-pro-251215  (Seedance 1.5 Pro)
 *   - doubao-seedance-1-5-pro  (latest 1.5)
 *   - doubao-seedance-2-0  (latest 2.0, alias)
 */

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

/**
 * Map short user-friendly model names → actual Volcengine Ark model IDs.
 * Users can also use the full doubao-* names directly.
 */
const MODEL_ALIAS_MAP: Record<string, string> = {
  // Seedance 2.0
  'seedance-2.0': 'doubao-seedance-2-0-260128',
  'seedance-2-0': 'doubao-seedance-2-0-260128',
  // Seedance 1.5 Pro
  'seedance-1.5-pro': 'doubao-seedance-1-5-pro-251215',
  'seedance-1-5-pro': 'doubao-seedance-1-5-pro-251215',
  // Non-versioned aliases (latest)
  'seedance-2.0-latest': 'doubao-seedance-2-0',
  'seedance-1.5-pro-latest': 'doubao-seedance-1-5-pro',
};

function resolveModelId(name: string): string {
  return MODEL_ALIAS_MAP[name] || name;
}

interface ArkTaskResponse {
  id: string;
  model: string;
  status: string;
  content?: {
    video_url?: string;
    video_duration?: number;
    last_frame_url?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  created_at?: number;
  updated_at?: number;
}

export class VolcengineArkProvider extends BaseProvider {
  name = 'volcengine-ark';
  private config: ProviderConfig;
  private models: string[];
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.models = config.models || [];

    const key = config.key;
    if (!key) {
      throw new Error(
        'Volcengine Ark provider requires an API key. ' +
        'Set "key" in the provider config (can use $ENV_VAR syntax).'
      );
    }
    this.apiKey = key;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  // ── Text generation (Doubao chat models) ───────────────────────────
  async generateText(req: TextRequest): Promise<TextResponse> {
    const url = `${ARK_BASE_URL}/chat/completions`;

    const body: any = {
      model: resolveModelId(req.model),
      messages: [
        ...(req.systemPrompt
          ? [{ role: 'system', content: req.systemPrompt }]
          : []),
        { role: 'user', content: req.prompt },
      ],
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Volcengine Ark API error (${response.status}): ${errBody}`);
    }

    const result = (await response.json()) as any;

    const text = result.choices?.[0]?.message?.content ?? '';
    const usage = result.usage
      ? {
          inputTokens: result.usage.prompt_tokens || 0,
          outputTokens: result.usage.completion_tokens || 0,
        }
      : undefined;

    return { model: req.model, text, usage };
  }

  // ── Image generation (placeholder — not supported yet) ─────────────
  async generateImage(_req: ImageRequest): Promise<ImageResponse> {
    throw new Error(
      'Image generation is not supported by the Volcengine Ark provider. ' +
      'Use Vertex AI or another provider for images.'
    );
  }

  // ── Video generation (Seedance 1.5 Pro / 2.0) ─────────────────────

  /**
   * Create a video generation task, poll until completion, and download
   * the result to a local file.
   */
  async generateVideo(req: VideoRequest): Promise<VideoResponse> {
    const taskId = await this.createVideoTask(req);

    const pollInterval = req.pollIntervalMs ?? 5000;
    const timeout = req.timeoutMs ?? 10 * 60 * 1000; // 10 minutes

    const result = await this.pollVideoTask(taskId, pollInterval, timeout);

    // Download video if succeeded
    if (result.status === 'succeeded' && result.videoUrl) {
      const outputPath = req.outputPath || path.join(process.cwd(), `video-${Date.now()}.mp4`);
      await this.downloadVideo(result.videoUrl, outputPath);
      return { ...result, filePath: outputPath };
    }

    return result;
  }

  /**
   * Step 1 — POST to create a video generation task.
   */
  private async createVideoTask(req: VideoRequest): Promise<string> {
    const url = `${ARK_BASE_URL}/contents/generations/tasks`;

    // Build content array
    const content: any[] = [];

    // Add text prompt
    if (req.prompt) {
      content.push({ type: 'text', text: req.prompt });
    }

    // Add first frame image
    if (req.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: req.referenceImageUrl },
        role: 'first_frame',
      });
    }

    // Add last frame image
    if (req.lastFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: req.lastFrameUrl },
        role: 'last_frame',
      });
    }

    const body: any = {
      model: resolveModelId(req.model),
      content,
    };

    // Optional parameters
    if (req.ratio !== undefined) body.ratio = req.ratio;
    if (req.duration !== undefined) body.duration = req.duration;
    if (req.resolution !== undefined) body.resolution = req.resolution;
    if (req.generateAudio !== undefined) body.generate_audio = req.generateAudio;
    if (req.seed !== undefined) body.seed = req.seed;
    if (req.watermark !== undefined) body.watermark = req.watermark;
    if (req.negativePrompt !== undefined) body.negative_prompt = req.negativePrompt;
    if (req.cameraFixed !== undefined) body.camera_fixed = req.cameraFixed;
    if (req.returnLastFrame) body.return_last_frame = true;
    if (req.draft) body.service_tier = 'draft';

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Volcengine Ark create-task error (${response.status}): ${errBody}`);
    }

    const result = (await response.json()) as ArkTaskResponse;

    if (result.error) {
      throw new Error(
        `Volcengine Ark task error: [${result.error.code}] ${result.error.message}`
      );
    }

    if (!result.id) {
      throw new Error('Volcengine Ark returned no task ID');
    }

    return result.id;
  }

  /**
   * Step 2 — Poll GET until status is "succeeded" or "failed".
   */
  private async pollVideoTask(
    taskId: string,
    intervalMs: number,
    timeoutMs: number
  ): Promise<VideoResponse> {
    const deadline = Date.now() + timeoutMs;

    // Log to stderr so stdout stays clean JSON
    process.stderr.write(`[koma] Video task ${taskId} created. Polling for completion...\n`);

    while (Date.now() < deadline) {
      const url = `${ARK_BASE_URL}/contents/generations/tasks/${taskId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Volcengine Ark poll error (${response.status}): ${errBody}`);
      }

      const task = (await response.json()) as ArkTaskResponse;

      if (task.error) {
        return {
          model: task.model || '',
          taskId,
          status: 'failed',
          error: `[${task.error.code}] ${task.error.message}`,
        };
      }

      if (task.status === 'succeeded') {
        process.stderr.write(`[koma] Video task ${taskId} succeeded.\n`);
        return {
          model: task.model || '',
          taskId,
          status: 'succeeded',
          videoUrl: task.content?.video_url || undefined,
          lastFrameUrl: task.content?.last_frame_url || undefined,
        };
      }

      if (task.status === 'failed') {
        return {
          model: task.model || '',
          taskId,
          status: 'failed',
          error: 'Task failed without error details',
        };
      }

      // Still queued / processing
      process.stderr.write(
        `[koma] Task ${taskId} status: ${task.status}. Waiting ${intervalMs / 1000}s...\n`
      );
      await this.sleep(intervalMs);
    }

    throw new Error(
      `Video generation timed out after ${timeoutMs / 1000}s. Task ID: ${taskId}`
    );
  }

  /**
   * Step 3 — Download the video from the temporary URL.
   */
  private async downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
    process.stderr.write(`[koma] Downloading video to ${outputPath}...\n`);

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video (${response.status}): ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, buffer);

    process.stderr.write(`[koma] Video saved (${buffer.length} bytes).\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  listModels(): string[] {
    return this.models;
  }
}
