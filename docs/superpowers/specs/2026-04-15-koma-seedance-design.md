# koma seedance — Dedicated Seedance Video Generation Command

## Goal

Replace the generic `koma video` with a dedicated `koma seedance` command that exposes all Seedance API parameters with version-aware validation and detailed `--help` including usage examples. Designed for agents and humans to efficiently generate video via Volcengine Ark Seedance models.

## Models

| Short name | Ark model ID | Resolution | Duration | Notes |
|------------|-------------|------------|----------|-------|
| `1.5-pro` (default) | `doubao-seedance-1-5-pro-251215` | 480p, 720p, 1080p | 4-12s | Draft mode, camera control |
| `2.0` | `doubao-seedance-2-0-260128` | 480p, 720p | 4-15s | Multi-modal reference (future) |
| `2.0-fast` | `doubao-seedance-2-0-fast-260128` | 480p, 720p | 4-15s | Faster generation |

## Command Interface

```
Usage: koma seedance [options] [prompt]

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
```

## Parameter Validation

Before sending any request to the Volcengine API, validate parameter combinations against the selected model version. Fail fast with clear error messages.

### Validation Rules

| Parameter | 1.5-pro | 2.0 / 2.0-fast | Error message on violation |
|-----------|---------|-----------------|---------------------------|
| `--resolution 1080p` | OK | Not supported | `"--resolution 1080p is not supported by Seedance 2.0. Use 480p or 720p."` |
| `--camera-fixed` | OK | Not supported | `"--camera-fixed is only supported by Seedance 1.5 Pro."` |
| `--draft` | OK | Not supported | `"--draft is only supported by Seedance 1.5 Pro."` |
| `--duration >12` | Not supported | OK (up to 15) | `"--duration max is 12 for Seedance 1.5 Pro. Use 2.0 for up to 15s."` |
| `--duration <4` | Not supported | Not supported | `"--duration must be at least 4 seconds."` |

Validation errors output to stderr as JSON `{"error": "message"}` and exit with code 1, consistent with all other koma error handling.

## Architecture

```
koma seedance [prompt] --first-frame img.jpg --audio
    │
    ▼
src/commands/seedance.ts
    ├── Parse CLI options
    ├── validateSeedanceParams(model, options)
    │     └── Check version-specific constraints → throw on violation
    ├── resolveProviders("seedance-1.5-pro")
    └── callWithFailover(providers, fn)
            │
            ▼
      src/providers/volcengine-ark.ts
            └── generateVideo(request)
                  ├── createVideoTask()  — POST /contents/generations/tasks
                  ├── pollVideoTask()    — GET  /contents/generations/tasks/{id}
                  └── downloadVideo()    — download mp4 to local file
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/commands/seedance.ts` | **Create** | Command definition, parameter validation, `--help` with examples |
| `src/commands/video.ts` | **Delete** | Replaced by seedance.ts |
| `src/cli.ts` | **Modify** | Remove `video` subcommand, register `seedance` subcommand, update help text |
| `src/types.ts` | **Modify** | Add to `VideoRequest`: `resolution`, `lastFrameUrl`, `returnLastFrame`, `draft` |
| `src/providers/volcengine-ark.ts` | **Modify** | `createVideoTask` sends new fields: `resolution`, last frame in content array, `return_last_frame`, `service_tier: "draft"` |
| `README.md` | **Modify** | Update command table, examples, and architecture section |

## Types Changes

Add to `VideoRequest` in `src/types.ts`:

```typescript
/** Output resolution: "480p", "720p", "1080p" */
resolution?: string;
/** Last frame image URL (for first+last frame control) */
lastFrameUrl?: string;
/** Return last frame URL in response (for chaining clips) */
returnLastFrame?: boolean;
/** Draft preview mode (lower cost, 1.5 Pro only) */
draft?: boolean;
```

## Provider Changes

In `volcengine-ark.ts` `createVideoTask()`:

- If `req.lastFrameUrl` is set, add a second `image_url` entry to the content array
- If `req.resolution` is set, add `resolution` to request body
- If `req.returnLastFrame` is true, add `return_last_frame: true` to request body
- If `req.draft` is true, add `service_tier: "draft"` to request body
- In poll response, capture `content.last_frame_url` if present

Add `lastFrameUrl` to `VideoResponse` in types.ts:

```typescript
/** Last frame image URL (when return_last_frame was requested) */
lastFrameUrl?: string;
```

## Output Format

Consistent with existing koma JSON output:

```jsonc
// Standard success
{"model": "seedance-1.5-pro", "taskId": "cgt-...", "status": "succeeded", "filePath": "video.mp4"}

// With return-last-frame
{"model": "seedance-1.5-pro", "taskId": "cgt-...", "status": "succeeded", "filePath": "video.mp4", "lastFrameUrl": "https://..."}

// Validation error (stderr)
{"error": "--resolution 1080p is not supported by Seedance 2.0. Use 480p or 720p."}

// Fallback event (stderr)
{"fallback": "volcengine-ark → aiproxy", "reason": "...429..."}
```

## Non-goals

- Seedance 2.0 multi-modal reference (images/videos/audio as reference) — not production-ready yet, add when API stabilizes
- Video editing / extension (2.0 only, not available via API yet)
- `koma video` alias or backwards compatibility — clean break
