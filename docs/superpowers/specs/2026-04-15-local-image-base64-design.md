# Local Image Auto-Conversion to Base64 Data URI

## Goal

When `--first-frame` or `--last-frame` is a local file path, koma automatically reads the file and converts it to a base64 data URI before sending to the Seedance API. Agents and users don't need to worry about image hosting.

## Behavior

- If value starts with `http://` or `https://` → pass through as-is (URL)
- Otherwise → treat as local file path, read file, encode as `data:image/<mime>;base64,<data>`

## MIME Detection

By file extension:
- `.jpg`, `.jpeg` → `image/jpeg`
- `.png` → `image/png`
- `.webp` → `image/webp`
- `.bmp` → `image/bmp`
- `.tiff`, `.tif` → `image/tiff`
- `.gif` → `image/gif`
- `.heic`, `.heif` → `image/heic`
- Unknown → `image/jpeg` (safe default)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/commands/seedance.ts` | **Modify** | Resolve local paths to data URIs before building VideoRequest |

One function `resolveImageUrl(pathOrUrl: string): string` — if local file, read and return data URI; if URL, return as-is.

## Error Handling

- File not found → `"Image file not found: <path>"`
- File too large (>30MB) → `"Image file exceeds 30MB limit: <path> (<size>MB)"`

## Verified

Base64 data URI tested against Seedance API on 2026-04-15. Task `cgt-20260415184618-hssqn` succeeded with a base64-encoded JPEG first frame.
