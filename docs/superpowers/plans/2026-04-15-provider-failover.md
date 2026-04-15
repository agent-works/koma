# Provider Failover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a model is configured under multiple providers, automatically try the next provider on retriable errors (429, 5xx, timeout).

**Architecture:** Change `modelToProviderMap` from one-to-one to one-to-many. Extract a shared `callWithFailover()` helper that wraps provider calls with ordered fallback. Error classification via regex on existing error message patterns.

**Tech Stack:** TypeScript, Node.js, no new dependencies.

---

### Task 1: Change config to support multiple providers per model

**Files:**
- Modify: `src/config.ts:7` (map type), `src/config.ts:63-71` (build map), `src/config.ts:76-108` (resolve function)

- [ ] **Step 1: Change `modelToProviderMap` type from `Map<string, string>` to `Map<string, string[]>`**

In `src/config.ts`, change line 7:

```typescript
let modelToProviderMap: Map<string, string[]> | null = null;
```

- [ ] **Step 2: Update map building in `loadConfig()` to push instead of overwrite**

Replace lines 63-71:

```typescript
  // Build model-to-provider map
  modelToProviderMap = new Map();
  for (const [providerName, providerConfig] of Object.entries(
    configCache.providers
  )) {
    for (const model of providerConfig.models) {
      const existing = modelToProviderMap.get(model) || [];
      existing.push(providerName);
      modelToProviderMap.set(model, existing);
    }
  }
```

- [ ] **Step 3: Replace `resolveProvider()` with `resolveProviders()` that returns an ordered array**

Replace the entire `resolveProvider` function (lines 76-108) with:

```typescript
export function resolveProviders(modelName: string): Array<{
  provider: string;
  config: ProviderConfig;
}> {
  const config = loadConfig();

  if (!modelToProviderMap) {
    modelToProviderMap = new Map();
    for (const [providerName, providerConfig] of Object.entries(
      config.providers
    )) {
      for (const model of providerConfig.models) {
        const existing = modelToProviderMap.get(model) || [];
        existing.push(providerName);
        modelToProviderMap.set(model, existing);
      }
    }
  }

  const providerNames = modelToProviderMap.get(modelName);
  if (!providerNames || providerNames.length === 0) {
    throw new Error(
      `Model "${modelName}" not found in any provider. Available models: ${Array.from(
        modelToProviderMap.keys()
      ).join(', ')}`
    );
  }

  return providerNames.map(name => {
    const providerConfig = config.providers[name];
    if (!providerConfig) {
      throw new Error(`Provider "${name}" not configured`);
    }
    return { provider: name, config: providerConfig };
  });
}
```

- [ ] **Step 4: Build and verify no compile errors**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Compile errors in command files referencing old `resolveProvider` — this is expected and will be fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts
git commit -m "refactor: config supports multiple providers per model"
```

---

### Task 2: Add `isRetriableError` helper and `callWithFailover`

**Files:**
- Create: `src/failover.ts`

- [ ] **Step 1: Create `src/failover.ts`**

```typescript
import { ProviderConfig, Provider } from './types.js';
import { createProvider } from './providers/index.js';

/**
 * Check if an error is retriable (should trigger failover to next provider).
 * Retriable: 429, 5xx, network errors.
 * Non-retriable: 4xx (except 429), missing config, unsupported operation.
 */
export function isRetriableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  // Extract HTTP status from provider error patterns like "error (429):" or "API error (500):"
  const statusMatch = message.match(/error \((\d{3})\)/i);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    return status === 429 || status >= 500;
  }

  // Network / timeout errors
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|socket hang up|network/i.test(message)) {
    return true;
  }

  // Timeout errors from video polling
  if (/timed out/i.test(message)) {
    return true;
  }

  return false;
}

/**
 * Try a provider call across multiple providers in order.
 * On retriable error, log fallback to stderr and try the next provider.
 * On non-retriable error or last provider failure, throw.
 */
export async function callWithFailover<T>(
  providers: Array<{ provider: string; config: ProviderConfig }>,
  callFn: (provider: Provider, providerName: string) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < providers.length; i++) {
    const { provider: providerName, config } = providers[i];

    try {
      const provider = createProvider(config.type, config);
      return await callFn(provider, providerName);
    } catch (error) {
      lastError = error;
      const hasMore = i < providers.length - 1;

      if (hasMore && isRetriableError(error)) {
        const nextProvider = providers[i + 1].provider;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            fallback: `${providerName} → ${nextProvider}`,
            reason,
          })
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
```

- [ ] **Step 2: Build and verify no compile errors**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: Still errors in command files (expected, fixed next task). No errors in `src/failover.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/failover.ts
git commit -m "feat: add failover helper for cross-provider fallback"
```

---

### Task 3: Update all commands to use failover

**Files:**
- Modify: `src/commands/text.ts`
- Modify: `src/commands/image.ts`
- Modify: `src/commands/video.ts`

- [ ] **Step 1: Update `text.ts`**

Replace the full content of `src/commands/text.ts`:

```typescript
import fs from 'fs';
import { TextRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';

export interface TextCommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  input?: string;
  output?: string;
  json?: boolean;
}

export async function handleTextCommand(
  prompt: string | undefined,
  options: TextCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model
    const model = options.model || config.defaults.text;
    if (!model) {
      throw new Error('No model specified and no default text model configured');
    }

    // Get prompt from argument or file
    let finalPrompt: string;
    if (options.input) {
      finalPrompt = fs.readFileSync(options.input, 'utf-8');
    } else if (prompt) {
      finalPrompt = prompt;
    } else {
      throw new Error('No prompt provided (use positional argument or --input flag)');
    }

    // Resolve providers (ordered by priority)
    const providers = resolveProviders(model);

    // Build request
    const request: TextRequest = {
      model,
      prompt: finalPrompt,
      systemPrompt: options.system,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    };

    // Generate text with failover
    const response = await callWithFailover(providers, (provider) =>
      provider.generateText(request)
    );

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(response.text);
    }

    // Write to file if specified
    if (options.output) {
      fs.writeFileSync(options.output, response.text, 'utf-8');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
```

- [ ] **Step 2: Update `image.ts`**

Replace the full content of `src/commands/image.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { ImageRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';

export interface ImageCommandOptions {
  model?: string;
  width?: number;
  height?: number;
  input?: string;
  output?: string;
  json?: boolean;
}

export async function handleImageCommand(
  prompt: string | undefined,
  options: ImageCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model
    const model = options.model || config.defaults.image;
    if (!model) {
      throw new Error('No model specified and no default image model configured');
    }

    // Get prompt from argument or file
    let finalPrompt: string;
    if (options.input) {
      finalPrompt = fs.readFileSync(options.input, 'utf-8');
    } else if (prompt) {
      finalPrompt = prompt;
    } else {
      throw new Error('No prompt provided (use positional argument or --input flag)');
    }

    // Determine output path
    const outputPath = options.output || path.join(process.cwd(), `image-${Date.now()}.png`);

    // Resolve providers (ordered by priority)
    const providers = resolveProviders(model);

    // Build request
    const request: ImageRequest = {
      model,
      prompt: finalPrompt,
      outputPath,
      width: options.width,
      height: options.height,
    };

    // Generate image with failover
    const response = await callWithFailover(providers, (provider) =>
      provider.generateImage(request)
    );

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(`Image saved to: ${response.filePath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
```

- [ ] **Step 3: Update `video.ts`**

Replace the full content of `src/commands/video.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { VideoRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';

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

    // Resolve providers (ordered by priority)
    const providers = resolveProviders(model);

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

    // Generate video with failover
    const response = await callWithFailover(providers, (provider, providerName) => {
      if (!provider.generateVideo) {
        throw new Error(
          `Provider "${providerName}" does not support video generation. ` +
          `Model "${model}" cannot be used for video.`
        );
      }
      return provider.generateVideo(request);
    });

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
```

- [ ] **Step 4: Build and verify everything compiles**

Run: `npx tsc --noEmit`

Expected: Clean compile, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/text.ts src/commands/image.ts src/commands/video.ts
git commit -m "feat: commands use callWithFailover for cross-provider fallback"
```

---

### Task 4: Update `getAllModels` to deduplicate

**Files:**
- Modify: `src/config.ts:123-132`

- [ ] **Step 1: Deduplicate model list**

Replace the `getAllModels` function in `src/config.ts`:

```typescript
export function getAllModels(): string[] {
  const config = loadConfig();
  const seen = new Set<string>();

  for (const providerConfig of Object.values(config.providers)) {
    for (const model of providerConfig.models) {
      seen.add(model);
    }
  }

  return Array.from(seen);
}
```

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "fix: deduplicate model list when model appears in multiple providers"
```

---

### Task 5: Build, smoke test, publish

**Files:**
- Modify: `package.json` (version bump)

- [ ] **Step 1: Build**

Run: `npm run build`

- [ ] **Step 2: Smoke test — verify single provider still works**

Run: `node dist/cli.js models`

Expected: Models listed, no errors.

- [ ] **Step 3: Smoke test — verify help text**

Run: `node dist/cli.js --help`

Expected: Help displayed correctly.

- [ ] **Step 4: Bump version, publish, commit, push**

```bash
npm version minor --no-git-tag-version
npm publish
git add -A
git commit -m "feat: provider failover — auto-switch on 429/5xx errors"
git push
```

Note: `minor` bump because this is a new feature (0.1.x → 0.2.0).
