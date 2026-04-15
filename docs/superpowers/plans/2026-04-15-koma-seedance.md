# koma seedance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `koma video` with a dedicated `koma seedance` command exposing all Seedance API parameters with version-aware validation, detailed `--help`, and rich examples.

**Architecture:** New `src/commands/seedance.ts` with parameter validation, reusing `src/providers/volcengine-ark.ts` for API calls. Extend `VideoRequest`/`VideoResponse` types with new fields (resolution, lastFrameUrl, returnLastFrame, draft). Delete `video.ts`.

**Tech Stack:** TypeScript, Node.js built-in test runner (`node --test`), tsx for running tests

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/commands/seedance.ts` | **Create** | Command handler, parameter validation, help text with examples |
| `src/commands/video.ts` | **Delete** | Replaced by seedance.ts |
| `src/types.ts` | **Modify** | Add resolution, lastFrameUrl, returnLastFrame, draft to VideoRequest; add lastFrameUrl to VideoResponse |
| `src/providers/volcengine-ark.ts` | **Modify** | Send new fields in createVideoTask, capture lastFrameUrl in poll |
| `src/cli.ts` | **Modify** | Remove video subcommand, register seedance subcommand, update help text |
| `README.md` | **Modify** | Update command table, examples, architecture |
| `test/validate-seedance.test.ts` | **Create** | Tests for parameter validation logic |

---

### Task 1: Extend types with new VideoRequest/VideoResponse fields

**Files:**
- Modify: `src/types.ts:55-88`

- [ ] **Step 1: Add new fields to VideoRequest**

In `src/types.ts`, add these fields inside the `VideoRequest` interface, after `timeoutMs` (line 78):

```typescript
  /** Output resolution: "480p", "720p", "1080p" */
  resolution?: string;
  /** Last frame image URL or path (for first+last frame control) */
  lastFrameUrl?: string;
  /** Return last frame URL in response (for chaining clips) */
  returnLastFrame?: boolean;
  /** Draft preview mode (lower cost, 1.5 Pro only) */
  draft?: boolean;
```

- [ ] **Step 2: Add lastFrameUrl to VideoResponse**

In `src/types.ts`, add this field inside the `VideoResponse` interface, after `filePath` (line 86):

```typescript
  /** Last frame image URL (when return_last_frame was requested) */
  lastFrameUrl?: string;
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: extend VideoRequest/VideoResponse with resolution, lastFrame, draft fields"
```

---

### Task 2: Update volcengine-ark provider to send new fields

**Files:**
- Modify: `src/providers/volcengine-ark.ts:167-224` (createVideoTask)
- Modify: `src/providers/volcengine-ark.ts:229-292` (pollVideoTask)

- [ ] **Step 1: Update createVideoTask to handle lastFrameUrl, resolution, returnLastFrame, draft**

In `src/providers/volcengine-ark.ts`, replace the `createVideoTask` method (lines 167-224) with:

```typescript
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
      });
    }

    // Add last frame image
    if (req.lastFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: req.lastFrameUrl },
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
```

- [ ] **Step 2: Update ArkTaskResponse interface to include last_frame_url**

In `src/providers/volcengine-ark.ts`, update the `ArkTaskResponse` interface (lines 48-62):

```typescript
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
```

- [ ] **Step 3: Update pollVideoTask to capture lastFrameUrl**

In the `pollVideoTask` method, update the succeeded branch (around line 263-270). Replace:

```typescript
      if (task.status === 'succeeded') {
        process.stderr.write(`[koma] Video task ${taskId} succeeded.\n`);
        return {
          model: task.model || '',
          taskId,
          status: 'succeeded',
          videoUrl: task.content?.video_url || undefined,
        };
      }
```

With:

```typescript
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
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add src/providers/volcengine-ark.ts
git commit -m "feat: volcengine-ark provider supports resolution, last-frame, draft"
```

---

### Task 3: Create seedance command with validation and help

**Files:**
- Create: `src/commands/seedance.ts`
- Create: `test/validate-seedance.test.ts`

- [ ] **Step 1: Write validation tests**

Create `test/validate-seedance.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSeedanceParams } from '../src/commands/seedance.js';

describe('validateSeedanceParams', () => {
  it('accepts valid 1.5-pro params', () => {
    assert.doesNotThrow(() => {
      validateSeedanceParams('1.5-pro', {
        resolution: '1080p',
        duration: 12,
        cameraFixed: true,
        draft: true,
      });
    });
  });

  it('accepts valid 2.0 params', () => {
    assert.doesNotThrow(() => {
      validateSeedanceParams('2.0', {
        duration: 15,
        resolution: '720p',
      });
    });
  });

  it('rejects --resolution 1080p for 2.0', () => {
    assert.throws(
      () => validateSeedanceParams('2.0', { resolution: '1080p' }),
      { message: '--resolution 1080p is not supported by Seedance 2.0. Use 480p or 720p.' }
    );
  });

  it('rejects --camera-fixed for 2.0', () => {
    assert.throws(
      () => validateSeedanceParams('2.0', { cameraFixed: true }),
      { message: '--camera-fixed is only supported by Seedance 1.5 Pro.' }
    );
  });

  it('rejects --draft for 2.0', () => {
    assert.throws(
      () => validateSeedanceParams('2.0', { draft: true }),
      { message: '--draft is only supported by Seedance 1.5 Pro.' }
    );
  });

  it('rejects --camera-fixed for 2.0-fast', () => {
    assert.throws(
      () => validateSeedanceParams('2.0-fast', { cameraFixed: true }),
      { message: '--camera-fixed is only supported by Seedance 1.5 Pro.' }
    );
  });

  it('rejects --duration >12 for 1.5-pro', () => {
    assert.throws(
      () => validateSeedanceParams('1.5-pro', { duration: 15 }),
      { message: '--duration max is 12 for Seedance 1.5 Pro. Use 2.0 for up to 15s.' }
    );
  });

  it('rejects --duration <4', () => {
    assert.throws(
      () => validateSeedanceParams('1.5-pro', { duration: 3 }),
      { message: '--duration must be at least 4 seconds.' }
    );
  });

  it('rejects --duration >15 for 2.0', () => {
    assert.throws(
      () => validateSeedanceParams('2.0', { duration: 20 }),
      { message: '--duration max is 15 for Seedance 2.0.' }
    );
  });

  it('rejects invalid --resolution value', () => {
    assert.throws(
      () => validateSeedanceParams('1.5-pro', { resolution: '4k' }),
      { message: '--resolution must be 480p, 720p, or 1080p.' }
    );
  });

  it('accepts no optional params (all defaults)', () => {
    assert.doesNotThrow(() => {
      validateSeedanceParams('1.5-pro', {});
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test test/validate-seedance.test.ts 2>&1 | tail -5`

Expected: FAIL — `validateSeedanceParams` does not exist yet.

- [ ] **Step 3: Create `src/commands/seedance.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { VideoRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';

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

    // Resolve providers
    const providers = resolveProviders(modelName);

    // Build request
    const request: VideoRequest = {
      model: modelName,
      prompt: finalPrompt,
      outputPath,
      referenceImageUrl: options.firstFrame,
      lastFrameUrl: options.lastFrame,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test test/validate-seedance.test.ts`

Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/seedance.ts test/validate-seedance.test.ts
git commit -m "feat: add koma seedance command with validation and help"
```

---

### Task 4: Wire up CLI — remove video, register seedance

**Files:**
- Modify: `src/cli.ts`
- Delete: `src/commands/video.ts`

- [ ] **Step 1: Delete video.ts**

```bash
rm src/commands/video.ts
```

- [ ] **Step 2: Update cli.ts — replace video import and subcommand with seedance**

In `src/cli.ts`, replace the video import (line 6):

```typescript
import { handleSeedanceCommand, buildSeedanceHelp } from './commands/seedance.js';
```

Remove the old import:
```typescript
import { handleVideoCommand } from './commands/video.js';
```

- [ ] **Step 3: Replace the video subcommand block (lines 166-197) with seedance subcommand**

Replace the entire `program.command('video [prompt]')` block with:

```typescript
const seedanceCmd = program
  .command('seedance [prompt]')
  .description('Generate video using Seedance (1.5 Pro / 2.0)')
  .option('-m, --model <name>', 'Model: 1.5-pro (default), 2.0, 2.0-fast')
  .option('--first-frame <url>', 'First frame image (image-to-video)')
  .option('--last-frame <url>', 'Last frame image (start+end control)')
  .option('--negative-prompt <text>', 'What to exclude from generation')
  .option('--return-last-frame', 'Return last frame URL for chaining clips')
  .option('--resolution <res>', 'Resolution: 480p, 720p (default), 1080p')
  .option('--ratio <ratio>', 'Aspect ratio: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, adaptive')
  .option('--duration <sec>', 'Duration in seconds', (v: string) => parseInt(v))
  .option('--seed <n>', 'Random seed (0-4294967295)', (v: string) => parseInt(v))
  .option('--audio', 'Generate synchronized audio')
  .option('--no-watermark', 'Disable watermark')
  .option('--camera-fixed', 'Lock camera position (1.5 only)')
  .option('--draft', 'Draft preview mode (1.5 only)')
  .option('--poll-interval <sec>', 'Poll interval in seconds (default: 5)', (v: string) => parseInt(v))
  .option('--timeout <sec>', 'Max wait time in seconds (default: 600)', (v: string) => parseInt(v))
  .option('--input <file>', 'Read prompt from file')
  .option('-o, --output <file>', 'Output file path')
  .option('--json', 'JSON output (default true)', true)
  .addHelpText('beforeAll', '')
  .configureHelp({ formatHelp: () => buildSeedanceHelp() })
  .action(async (prompt: string | undefined, cmdOpts: any) => {
    await handleSeedanceCommand(prompt, {
      model: cmdOpts.model,
      input: cmdOpts.input,
      output: cmdOpts.output,
      json: cmdOpts.json !== false,
      firstFrame: cmdOpts.firstFrame,
      lastFrame: cmdOpts.lastFrame,
      negativePrompt: cmdOpts.negativePrompt,
      returnLastFrame: cmdOpts.returnLastFrame,
      resolution: cmdOpts.resolution,
      ratio: cmdOpts.ratio,
      duration: cmdOpts.duration,
      seed: cmdOpts.seed,
      audio: cmdOpts.audio,
      noWatermark: cmdOpts.watermark === false,
      cameraFixed: cmdOpts.cameraFixed,
      draft: cmdOpts.draft,
      pollInterval: cmdOpts.pollInterval,
      timeout: cmdOpts.timeout,
    });
  });
```

- [ ] **Step 4: Update the buildHelp() function in cli.ts**

In the `buildHelp()` function, replace all references to `koma video` with `koma seedance`. Specifically update:

The `Commands:` section (around line 43-47):
```
Commands:
  koma text [prompt]        Generate text (chat completion)
  koma image [prompt]       Generate an image and save to file
  koma seedance [prompt]    Generate video (Seedance 1.5 Pro / 2.0)
  koma models               List all available models as JSON
```

Remove the `Video Options:` section (lines 94-102) — these are now in `koma seedance --help`.

Update the examples section — replace the video examples (lines 79-89) with:

```
  # Video generation (Seedance 1.5 Pro)
  koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远" -o cat.mp4

  # Image-to-video with first frame
  koma seedance "女孩微笑着转身" --first-frame photo.jpg -o out.mp4

  # Seedance 2.0 with audio
  koma seedance -m 2.0 "赛博朋克城市夜景" --audio --ratio 16:9
```

Update the output format section — change `video response` line to:
```
  seedance:    {"model": "...", "taskId": "...", "status": "succeeded", "filePath": "..."}
```

- [ ] **Step 5: Verify compile and tests still pass**

Run: `npx tsc --noEmit && npx tsx --test test/validate-seedance.test.ts`

Expected: Clean compile, all tests pass.

- [ ] **Step 6: Smoke test**

Run: `npm run build && node dist/cli.js seedance --help | head -5`

Expected: Shows `Seedance video generation (Volcengine Ark)` and the models section.

Run: `node dist/cli.js --help | grep seedance`

Expected: Shows `koma seedance [prompt]` in the commands list.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts && git rm src/commands/video.ts
git commit -m "feat: register koma seedance, remove koma video"
```

---

### Task 5: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update command table**

Replace the command table (lines 29-34):

```markdown
| 命令 | 说明 |
|------|------|
| `koma text [prompt]` | 文本生成（chat completion） |
| `koma image [prompt]` | 图像生成，保存到文件 |
| `koma seedance [prompt]` | 视频生成（Seedance 1.5 Pro / 2.0），运行 `koma seedance --help` 查看完整参数 |
| `koma models` | 列出所有可用模型（JSON） |
```

- [ ] **Step 2: Replace 视频选项 section with seedance introduction**

Replace the `### 视频选项` section (lines 48-59) with:

```markdown
### Seedance 视频生成

`koma seedance` 是专门的 Seedance 视频生成命令，支持文生视频、首帧/尾帧驱动、音频生成、draft 预览等。运行 `koma seedance --help` 查看完整参数和丰富示例。

```bash
# 文生视频
koma seedance "一只橘猫在屋顶上奔跑" -o cat.mp4

# 首帧驱动
koma seedance "女孩微笑着转身" --first-frame portrait.jpg --ratio 9:16

# 首尾帧 + 音频
koma seedance "角色穿过花园" --first-frame start.jpg --last-frame end.jpg --audio

# 2.0 模型
koma seedance -m 2.0 "赛博朋克城市夜景" --duration 15 --audio
```
```

- [ ] **Step 3: Update examples section**

Replace all `koma video` examples (lines 73-80) with:

```bash
# 文生视频（默认 Seedance 1.5 Pro）
koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远" -o cat.mp4

# 图生视频（首帧驱动）
koma seedance "女孩微笑着转身" --first-frame photo.jpg -o out.mp4

# 视频生成带选项
koma seedance "赛博朋克城市夜景" --ratio 16:9 --duration 10 --audio --no-watermark
```

- [ ] **Step 4: Update architecture section**

In the architecture tree (lines 142-156), replace `video.ts` with `seedance.ts`:

```
    seedance.ts         # seedance 子命令（视频生成）
```

Update the provider description:
```
    volcengine-ark.ts # 火山方舟实现（Seedance 视频 & 文本）
    openai-compatible.ts # OpenAI 兼容实现（文本 & 图像）
```

- [ ] **Step 5: Update 设计理念 section**

Replace `koma video` line (line 172):

```markdown
- `koma seedance` — Seedance 视频生成（专属命令，完整参数支持）
```

- [ ] **Step 6: Update 快速开始 section**

Replace `koma video` line (line 23):

```bash
koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远" -o cat.mp4
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: update README for koma seedance command"
```

---

### Task 6: Build, test, smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`

Expected: Clean compile.

- [ ] **Step 2: Run all tests**

Run: `npx tsx --test test/validate-seedance.test.ts`

Expected: All 10 tests pass.

- [ ] **Step 3: Smoke test — seedance help**

Run: `node dist/cli.js seedance --help`

Expected: Full help text with models, parameters, and examples displayed.

- [ ] **Step 4: Smoke test — main help**

Run: `node dist/cli.js --help`

Expected: Shows `koma seedance` in commands list, no mention of `koma video`.

- [ ] **Step 5: Smoke test — models**

Run: `node dist/cli.js models`

Expected: Lists all models including seedance models, no errors.

- [ ] **Step 6: Smoke test — validation error**

Run: `node dist/cli.js seedance -m 2.0 "test" --camera-fixed 2>&1`

Expected: stderr shows `{"error": "--camera-fixed is only supported by Seedance 1.5 Pro."}` and exits with code 1.

- [ ] **Step 7: Wait for user to provide live test scenario**

Pause here. User will test with actual Seedance API calls before proceeding to publish.
