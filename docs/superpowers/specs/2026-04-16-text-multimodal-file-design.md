# koma text — Multimodal File Input

## Goal

Add `--file` option to `koma text` so agents and users can pass images, videos, audio, and PDFs to multimodal models (Gemini, GPT-4o, etc.) for understanding and analysis.

## Command Interface

```
koma text "描述这张图片" --file photo.jpg
koma text "对比差异" --file before.png --file after.png
koma text "总结这个视频" --file meeting.mp4
koma text "翻译这份文档" --file doc.pdf
```

`--file` can be used multiple times. Accepts local file paths (auto base64) and URLs (pass through).

## Types Changes

Add to `TextRequest`:

```typescript
files?: Array<{ mimeType: string; data: string }>;
```

Each entry has a `mimeType` (e.g. `image/jpeg`) and `data` (base64-encoded content or URL).

## Provider Implementation

### Vertex AI (Gemini)

Appends `inlineData` parts after the text part:

```json
{
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "描述这张图" },
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } }
    ]
  }]
}
```

Supports all media types: images, video, audio, PDF.

### OpenAI-compatible

Uses multimodal `content` array format:

```json
{
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "描述这张图" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
    ]
  }]
}
```

Only supports images. Non-image files are silently skipped (no error).

## MIME Support Matrix

| Type | Extensions | Vertex AI | OpenAI-compatible |
|------|-----------|-----------|-------------------|
| Image | jpg/jpeg/png/webp/gif | Yes | Yes |
| Video | mp4/mov/avi/webm/mpeg/flv | Yes | Skip |
| Audio | mp3/wav/flac/aac/ogg | Yes | Skip |
| Document | pdf | Yes | Skip |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/utils.ts` | **Create** | Extract `resolveFileToBase64(path) → {mimeType, data}` from seedance.ts, shared by both commands |
| `src/types.ts` | **Modify** | Add `files` field to `TextRequest` |
| `src/commands/text.ts` | **Modify** | Handle `--file` options, resolve local files |
| `src/commands/seedance.ts` | **Modify** | Import `resolveFileToBase64` from utils instead of inline |
| `src/providers/vertex-ai.ts` | **Modify** | Add `inlineData` parts to generateText |
| `src/providers/openai-compatible.ts` | **Modify** | Use content array format when files present |
| `src/cli.ts` | **Modify** | Register `--file` on text subcommand |

## Error Handling

- File not found → `"File not found: <path>"`
- File >20MB → `"File exceeds 20MB limit: <path> (<size>MB)"`
- No `--file` → behavior unchanged, fully backward compatible

## Non-goals

- Volcengine Ark text models multimodal (not supported by their API)
- Streaming responses
- File type validation per provider at command level (provider silently skips unsupported types)
