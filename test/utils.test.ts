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
