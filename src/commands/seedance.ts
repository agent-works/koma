import fs from 'fs';
import path from 'path';
import { VideoRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';
import { resolveImageUrl } from '../utils.js';

// ── Model short names → config model names ─────────────────────────
const SEEDANCE_MODEL_MAP: Record<string, string> = {
  '1.5-pro': 'seedance-1.5-pro',
  '2.0': 'seedance-2.0',
  '2.0-fast': 'seedance-2.0-fast',
};

function resolveModelName(shortName: string): string {
  return SEEDANCE_MODEL_MAP[shortName] || shortName;
}

function isV2(model: string): boolean {
  return model === '2.0' || model === '2.0-fast';
}

// ── Parameter validation ────────────────────────────────────────────

export interface SeedanceOptions {
  resolution?: string;
  duration?: number;
  cameraFixed?: boolean;
  draft?: boolean;
  [key: string]: any;
}

export function validateSeedanceParams(
  model: string,
  opts: SeedanceOptions
): void {
  const v2 = isV2(model);

  // Resolution validation
  if (opts.resolution !== undefined) {
    const valid = ['480p', '720p', '1080p'];
    if (!valid.includes(opts.resolution)) {
      throw new Error('--resolution must be 480p, 720p, or 1080p.');
    }
    if (v2 && opts.resolution === '1080p') {
      throw new Error(
        '--resolution 1080p is not supported by Seedance 2.0. Use 480p or 720p.'
      );
    }
  }

  // Camera-fixed: 1.5 only
  if (opts.cameraFixed && v2) {
    throw new Error('--camera-fixed is only supported by Seedance 1.5 Pro.');
  }

  // Draft: 1.5 only
  if (opts.draft && v2) {
    throw new Error('--draft is only supported by Seedance 1.5 Pro.');
  }

  // Duration validation
  if (opts.duration !== undefined) {
    if (opts.duration < 4) {
      throw new Error('--duration must be at least 4 seconds.');
    }
    if (!v2 && opts.duration > 12) {
      throw new Error(
        '--duration max is 12 for Seedance 1.5 Pro. Use 2.0 for up to 15s.'
      );
    }
    if (v2 && opts.duration > 15) {
      throw new Error('--duration max is 15 for Seedance 2.0.');
    }
  }
}

// ── Help text ───────────────────────────────────────────────────────

export function buildSeedanceHelp(): string {
  return `
Seedance video generation (Volcengine Ark)

Models:
  1.5-pro (default)    4-12s, up to 1080p, draft mode, camera control
  2.0                  4-15s, up to 720p, multi-modal reference
  2.0-fast             Same as 2.0, faster generation

Input:
  [prompt]                   Text prompt (up to 2000 chars)
  --input <file>             Read prompt from file
  --first-frame <url>        First frame image (image-to-video)     [1.5, 2.0]
  --last-frame <url>         Last frame image (start+end control)   [1.5, 2.0]
  --negative-prompt <text>   What to exclude from generation

Output:
  -o, --output <file>        Output file path (default: video-<timestamp>.mp4)
  --return-last-frame        Return last frame URL (for chaining clips) [1.5, 2.0]

Video specs:
  -m, --model <name>         Model: 1.5-pro (default), 2.0, 2.0-fast
  --resolution <res>         480p, 720p (default), 1080p             [1080p: 1.5 only]
  --ratio <ratio>            16:9 (default), 9:16, 1:1, 4:3, 3:4, 21:9, adaptive
  --duration <sec>           Duration in seconds (4-12 for 1.5, 4-15 for 2.0)
  --seed <n>                 Random seed (0-4294967295, -1 for random)

Generation:
  --audio                    Generate synchronized audio              [1.5, 2.0]
  --no-watermark             Disable watermark
  --camera-fixed             Lock camera position                     [1.5 only]
  --draft                    Draft preview mode (lower cost)          [1.5 only]

Polling:
  --poll-interval <sec>      Status check interval (default: 5)
  --timeout <sec>            Max wait time (default: 600)

Examples:

  # Text-to-video (default model: 1.5-pro)
  koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远"

  # Specify output file and ratio
  koma seedance "cyberpunk cityscape at night" --ratio 21:9 -o city.mp4

  # Image-to-video with first frame
  koma seedance "女孩微笑着转身" --first-frame ./portrait.jpg --ratio 9:16

  # First frame + last frame (scene transition)
  koma seedance "角色穿过花园" --first-frame start.jpg --last-frame end.jpg --duration 8

  # Generate with audio
  koma seedance "海浪拍打岩石，海鸥飞过" --audio --duration 10

  # High resolution (1.5 Pro only)
  koma seedance "4K质感的山间日出延时" --resolution 1080p --ratio 16:9

  # Draft preview (1.5 Pro only, lower cost)
  koma seedance "测试概念：机器人在雨中行走" --draft

  # Camera locked (1.5 Pro only, no camera movement)
  koma seedance "街头艺人表演，固定机位" --camera-fixed

  # Chain clips using last frame of previous video
  koma seedance "场景一" --return-last-frame -o scene1.mp4
  # Then use the returned last_frame_url as first frame for next clip
  koma seedance "场景二" --first-frame <last_frame_url> -o scene2.mp4

  # Use Seedance 2.0 for longer duration
  koma seedance -m 2.0 "epic drone shot over mountains" --duration 15 --audio

  # Read prompt from file
  koma seedance --input prompt.txt -o result.mp4

Image requirements for --first-frame / --last-frame:
  Formats: JPEG, PNG, WebP, BMP, TIFF, GIF, HEIC/HEIF (1.5 Pro)
  Dimensions: 300-6000px per side, aspect ratio 0.4-2.5
  Max size: 30MB per image
  Accepts: HTTPS URLs or local file paths
`.trim();
}

// ── Command options ─────────────────────────────────────────────────

export interface SeedanceCommandOptions {
  model?: string;
  input?: string;
  output?: string;
  json?: boolean;
  firstFrame?: string;
  lastFrame?: string;
  negativePrompt?: string;
  returnLastFrame?: boolean;
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  audio?: boolean;
  noWatermark?: boolean;
  cameraFixed?: boolean;
  draft?: boolean;
  pollInterval?: number;
  timeout?: number;
}

// ── Command handler ─────────────────────────────────────────────────

export async function handleSeedanceCommand(
  prompt: string | undefined,
  options: SeedanceCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model (short name like "1.5-pro" or "2.0")
    const modelShort = options.model || '1.5-pro';
    const modelName = resolveModelName(modelShort);

    // Validate version-specific params
    validateSeedanceParams(modelShort, {
      resolution: options.resolution,
      duration: options.duration,
      cameraFixed: options.cameraFixed,
      draft: options.draft,
    });

    // Get prompt from argument or file
    let finalPrompt: string;
    if (options.input) {
      finalPrompt = fs.readFileSync(options.input, 'utf-8').trim();
    } else if (prompt) {
      finalPrompt = prompt;
    } else {
      throw new Error(
        'No prompt provided (use positional argument or --input flag)'
      );
    }

    // Determine output path
    const outputPath =
      options.output || path.join(process.cwd(), `video-${Date.now()}.mp4`);

    // Resolve local image paths to base64 data URIs
    const firstFrameUrl = options.firstFrame
      ? resolveImageUrl(options.firstFrame)
      : undefined;
    const lastFrameUrl = options.lastFrame
      ? resolveImageUrl(options.lastFrame)
      : undefined;

    // Resolve providers
    const providers = resolveProviders(modelName);

    // Build request
    const request: VideoRequest = {
      model: modelName,
      prompt: finalPrompt,
      outputPath,
      referenceImageUrl: firstFrameUrl,
      lastFrameUrl: lastFrameUrl,
      ratio: options.ratio,
      duration: options.duration,
      resolution: options.resolution,
      generateAudio: options.audio,
      seed: options.seed,
      watermark: options.noWatermark === true ? false : undefined,
      cameraFixed: options.cameraFixed,
      negativePrompt: options.negativePrompt,
      returnLastFrame: options.returnLastFrame,
      draft: options.draft,
      pollIntervalMs: options.pollInterval
        ? options.pollInterval * 1000
        : undefined,
      timeoutMs: options.timeout ? options.timeout * 1000 : undefined,
    };

    // Generate video with failover
    const response = await callWithFailover(
      providers,
      (provider, providerName) => {
        if (!provider.generateVideo) {
          throw new Error(
            `Provider "${providerName}" does not support video generation.`
          );
        }
        return provider.generateVideo(request);
      }
    );

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      if (response.status === 'succeeded') {
        console.log(`Video saved to: ${response.filePath}`);
      } else {
        console.log(
          `Video generation ${response.status}: ${response.error || 'unknown'}`
        );
      }
    }

    if (response.status === 'failed') {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
