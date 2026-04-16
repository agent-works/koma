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
