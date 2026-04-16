# Text Multimodal File Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--file` option to `koma text` so users can pass images, videos, audio, and PDFs to multimodal models like Gemini and GPT-4o.

**Architecture:** Extract file-resolution logic from seedance.ts into shared `src/utils.ts`. Add `files` field to `TextRequest`. Each provider appends file data in its own format (Vertex AI: `inlineData` parts, OpenAI-compatible: `image_url` content array).

**Tech Stack:** TypeScript, Node.js built-in test runner, tsx

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils.ts` | **Create** | Shared `resolveFile(path) → {mimeType, data}` utility |
| `src/types.ts` | **Modify** | Add `files` to `TextRequest` |
| `src/commands/text.ts` | **Modify** | Handle `--file` options, resolve files |
| `src/commands/seedance.ts` | **Modify** | Import from utils.ts instead of inline MIME/resolve logic |
| `src/providers/vertex-ai.ts` | **Modify** | Append `inlineData` parts in generateText |
| `src/providers/openai-compatible.ts` | **Modify** | Use content array format when files present |
| `src/cli.ts` | **Modify** | Register `--file` on text subcommand |
| `test/utils.test.ts` | **Create** | Tests for resolveFile utility |

---

### Task 1: Extract shared file utils from seedance.ts

**Files:**
- Create: `src/utils.ts`
- Create: `test/utils.test.ts`
- Modify: `src/commands/seedance.ts`

- [ ] **Step 1: Write tests for resolveFile**

Create `test/utils.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveFile } from '../src/utils.js';

describe('resolveFile', () => {
  it('resolves a local JPEG file to mimeType and base64 data', () => {
    const tmpFile = path.join('/tmp', 'koma-test.jpg');
    fs.writeFileSync(tmpFile, Buffer.from([0xff, 0xd8, 0xff]));
    try {
      const result = resolveFile(tmpFile);
      assert.equal(result.mimeType, 'image/jpeg');
      assert.equal(typeof result.data, 'string');
      assert.ok(result.data.length > 0);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('resolves a local PNG file', () => {
    const tmpFile = path.join('/tmp', 'koma-test.png');
    fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    try {
      const result = resolveFile(tmpFile);
      assert.equal(result.mimeType, 'image/png');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('resolves a PDF file', () => {
    const tmpFile = path.join('/tmp', 'koma-test.pdf');
    fs.writeFileSync(tmpFile, Buffer.from('%PDF-1.4'));
    try {
      const result = resolveFile(tmpFile);
      assert.equal(result.mimeType, 'application/pdf');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('resolves an MP4 file', () => {
    const tmpFile = path.join('/tmp', 'koma-test.mp4');
    fs.writeFileSync(tmpFile, Buffer.from([0x00, 0x00]));
    try {
      const result = resolveFile(tmpFile);
      assert.equal(result.mimeType, 'video/mp4');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('throws on nonexistent file', () => {
    assert.throws(
      () => resolveFile('/tmp/nonexistent-koma-file.jpg'),
      { message: 'File not found: /tmp/nonexistent-koma-file.jpg' }
    );
  });

  it('defaults unknown extension to application/octet-stream', () => {
    const tmpFile = path.join('/tmp', 'koma-test.xyz');
    fs.writeFileSync(tmpFile, Buffer.from([0x00]));
    try {
      const result = resolveFile(tmpFile);
      assert.equal(result.mimeType, 'application/octet-stream');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test test/utils.test.ts 2>&1 | tail -3`

Expected: FAIL — `resolveFile` does not exist.

- [ ] **Step 3: Create `src/utils.ts`**

```typescript
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.mpeg': 'video/mpeg',
  '.flv': 'video/x-flv',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Resolve a local file to {mimeType, data (base64)}.
 * Throws if file not found or exceeds size limit.
 */
export function resolveFile(filePath: string): { mimeType: string; data: string } {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(
      `File exceeds 20MB limit: ${filePath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`
    );
  }

  const mimeType = getMimeType(resolved);
  const data = fs.readFileSync(resolved).toString('base64');
  return { mimeType, data };
}

/**
 * If pathOrUrl is a URL, return it as-is.
 * If it's a local file, read and return as base64 data URI.
 */
export function resolveImageUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const { mimeType, data } = resolveFile(pathOrUrl);
  return `data:${mimeType};base64,${data}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test test/utils.test.ts`

Expected: All 6 tests pass.

- [ ] **Step 5: Update seedance.ts to import from utils**

In `src/commands/seedance.ts`, remove the entire inline block from `// ── Local image → base64 data URI` through the end of `resolveImageUrl` function (lines 7-43). Replace with:

```typescript
import { resolveImageUrl } from '../utils.js';
```

Add this import after the existing imports (line 5).

- [ ] **Step 6: Run existing seedance tests to verify no regression**

Run: `npx tsx --test test/validate-seedance.test.ts`

Expected: All 16 tests pass. (The `resolveImageUrl` tests in this file now import from seedance.ts which re-exports from utils — update the import in the test file too.)

Update `test/validate-seedance.test.ts`: change the import of `resolveImageUrl` from `../src/commands/seedance.js` to `../src/utils.js`:

```typescript
import { validateSeedanceParams } from '../src/commands/seedance.js';
import { resolveImageUrl } from '../src/utils.js';
```

Run again: `npx tsx --test test/validate-seedance.test.ts`

Expected: All 16 tests pass.

- [ ] **Step 7: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 8: Commit**

```bash
git add src/utils.ts test/utils.test.ts src/commands/seedance.ts test/validate-seedance.test.ts
git commit -m "refactor: extract shared file utils from seedance into src/utils.ts"
```

---

### Task 2: Add `files` field to TextRequest

**Files:**
- Modify: `src/types.ts:26-32`

- [ ] **Step 1: Add files field to TextRequest**

In `src/types.ts`, add after `maxTokens` (line 31):

```typescript
  /** Attached files for multimodal input (images, video, audio, PDF) */
  files?: Array<{ mimeType: string; data: string }>;
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add files field to TextRequest for multimodal input"
```

---

### Task 3: Update Vertex AI provider to send files as inlineData

**Files:**
- Modify: `src/providers/vertex-ai.ts:88-162`

- [ ] **Step 1: Update generateText to append inlineData parts**

In `src/providers/vertex-ai.ts`, replace the request body building (lines 95-106):

```typescript
      // Build parts array
      const parts: any[] = [{ text: req.prompt }];

      // Append file data as inlineData parts
      if (req.files) {
        for (const file of req.files) {
          parts.push({
            inlineData: { mimeType: file.mimeType, data: file.data },
          });
        }
      }

      // Build request body
      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 2048,
        },
      };
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/providers/vertex-ai.ts
git commit -m "feat: vertex-ai sends files as inlineData parts in generateText"
```

---

### Task 4: Update OpenAI-compatible provider to send image files

**Files:**
- Modify: `src/providers/openai-compatible.ts:33-74`

- [ ] **Step 1: Update generateText to use content array when files present**

In `src/providers/openai-compatible.ts`, replace the message building (lines 33-38):

```typescript
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
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`

Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add src/providers/openai-compatible.ts
git commit -m "feat: openai-compatible sends image files as image_url content"
```

---

### Task 5: Wire --file into text command and CLI

**Files:**
- Modify: `src/commands/text.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Update text.ts to handle files option**

Replace the full content of `src/commands/text.ts`:

```typescript
import fs from 'fs';
import { TextRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';
import { resolveFile } from '../utils.js';

export interface TextCommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  input?: string;
  output?: string;
  json?: boolean;
  file?: string[];
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

    // Resolve attached files
    const files = options.file?.map(f => resolveFile(f));

    // Resolve providers (ordered by priority)
    const providers = resolveProviders(model);

    // Build request
    const request: TextRequest = {
      model,
      prompt: finalPrompt,
      systemPrompt: options.system,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      files,
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

- [ ] **Step 2: Register --file on text subcommand in cli.ts**

In `src/cli.ts`, replace the text subcommand block (lines 129-143):

```typescript
program
  .command('text [prompt]')
  .description('Generate text using an AI model')
  .option('--file <path>', 'Attach file (image/video/audio/PDF), can be used multiple times', (val: string, acc: string[]) => { acc.push(val); return acc; }, [] as string[])
  .action(async (prompt: string | undefined, cmdOpts: any) => {
    const parent = program.opts();
    await handleTextCommand(prompt, {
      model: parent.model,
      temperature: parent.temperature,
      maxTokens: parent.maxTokens,
      system: parent.system,
      input: parent.input,
      output: parent.output,
      json: parent.json !== false,
      file: cmdOpts.file?.length > 0 ? cmdOpts.file : undefined,
    });
  });
```

- [ ] **Step 3: Update buildHelp() in cli.ts — add --file to examples**

In the examples section of `buildHelp()`, add after the text examples:

```
  # Multimodal: describe an image
  koma text "描述这张图片" --file photo.jpg

  # Multimodal: analyze a video
  koma text "总结这个视频的内容" --file meeting.mp4

  # Multiple files
  koma text "对比这两张图" --file before.png --file after.png
```

- [ ] **Step 4: Verify compile and all tests pass**

Run: `npx tsc --noEmit && npx tsx --test test/utils.test.ts && npx tsx --test test/validate-seedance.test.ts`

Expected: Clean compile, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/text.ts src/cli.ts
git commit -m "feat: koma text supports --file for multimodal input"
```

---

### Task 6: Build, smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`

Expected: Clean compile.

- [ ] **Step 2: Run all tests**

Run: `npx tsx --test test/utils.test.ts && npx tsx --test test/validate-seedance.test.ts`

Expected: All tests pass.

- [ ] **Step 3: Smoke test — help text**

Run: `node dist/cli.js --help | grep "file"`

Expected: Shows `--file` in examples.

- [ ] **Step 4: Smoke test — describe an image with Gemini**

Run: `node dist/cli.js text "describe this image in one sentence" --file /tmp/test_seedance.jpg`

Expected: JSON response with text describing the image.

- [ ] **Step 5: Smoke test — describe an image via AIProxy (OpenAI-compatible)**

Run: `node dist/cli.js text -m gpt-4o "describe this image in one sentence" --file /tmp/test_seedance.jpg`

Expected: JSON response with text describing the image.

- [ ] **Step 6: Smoke test — no file (backward compat)**

Run: `node dist/cli.js text "say hello"`

Expected: Normal text response, no errors.

- [ ] **Step 7: Smoke test — file not found error**

Run: `node dist/cli.js text "test" --file /tmp/nonexistent.jpg 2>&1`

Expected: stderr `{"error": "File not found: /tmp/nonexistent.jpg"}`, exit code 1.
