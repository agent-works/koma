import fs from 'fs';
import path from 'path';
import { VideoRequest, VideoResponse } from '../types.js';
import { loadConfig, resolveProvider } from '../config.js';
import { createProvider } from '../providers/index.js';

export interface VideoCommandOptions {
  model?: string;
  input?: string;
  output?: string;
  json?: boolean;
  /** First-frame image for image-to-video */
  image?: string;
  /** Aspect ratio */
  ratio?: string;
  /** Duration in seconds */
  duration?: number;
  /** Generate audio track */
  audio?: boolean;
  /** Random seed */
  seed?: number;
  /** Disable watermark */
  noWatermark?: boolean;
  /** Keep camera static */
  cameraFixed?: boolean;
  /** Negative prompt */
  negativePrompt?: string;
  /** Poll interval in seconds */
  pollInterval?: number;
  /** Max wait time in seconds */
  timeout?: number;
}

export async function handleVideoCommand(
  prompt: string | undefined,
  options: VideoCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model
    const model = options.model || config.defaults.video;
    if (!model) {
      throw new Error('No model specified and no default video model configured');
    }

    // Get prompt from argument or file
    let finalPrompt: string;
    if (options.input) {
      finalPrompt = fs.readFileSync(options.input, 'utf-8').trim();
    } else if (prompt) {
      finalPrompt = prompt;
    } else {
      throw new Error('No prompt provided (use positional argument or --input flag)');
    }

    // Determine output path
    const outputPath = options.output || path.join(process.cwd(), `video-${Date.now()}.mp4`);

    // Resolve provider
    const { provider: providerName, config: providerConfig } = resolveProvider(model);
    const provider = createProvider(providerConfig.type, providerConfig);

    if (!provider.generateVideo) {
      throw new Error(
        `Provider "${providerName}" does not support video generation. ` +
        `Model "${model}" cannot be used for video.`
      );
    }

    // Build request
    const request: VideoRequest = {
      model,
      prompt: finalPrompt,
      outputPath,
      referenceImageUrl: options.image,
      ratio: options.ratio,
      duration: options.duration,
      generateAudio: options.audio,
      seed: options.seed,
      watermark: options.noWatermark === true ? false : undefined,
      cameraFixed: options.cameraFixed,
      negativePrompt: options.negativePrompt,
      pollIntervalMs: options.pollInterval ? options.pollInterval * 1000 : undefined,
      timeoutMs: options.timeout ? options.timeout * 1000 : undefined,
    };

    // Generate video
    const response = await provider.generateVideo(request);

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      if (response.status === 'succeeded') {
        console.log(`Video saved to: ${response.filePath}`);
      } else {
        console.log(`Video generation ${response.status}: ${response.error || 'unknown'}`);
      }
    }

    // Exit with error code if failed
    if (response.status === 'failed') {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
