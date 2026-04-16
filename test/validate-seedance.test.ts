import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateSeedanceParams } from '../src/commands/seedance.js';
import { resolveImageUrl } from '../src/utils.js';

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

  it('rejects --draft with --first-frame', () => {
    assert.throws(
      () => validateSeedanceParams('1.5-pro', { draft: true, firstFrame: './img.jpg' }),
      { message: '--draft is only supported for text-to-video. Remove --first-frame/--last-frame to use draft mode.' }
    );
  });

  it('rejects --draft with --last-frame', () => {
    assert.throws(
      () => validateSeedanceParams('1.5-pro', { draft: true, lastFrame: './img.jpg' }),
      { message: '--draft is only supported for text-to-video. Remove --first-frame/--last-frame to use draft mode.' }
    );
  });

  it('accepts --first-frame + --last-frame without --draft', () => {
    assert.doesNotThrow(() => {
      validateSeedanceParams('1.5-pro', { firstFrame: './a.jpg', lastFrame: './b.jpg' });
    });
  });
});

describe('resolveImageUrl', () => {
  it('passes through HTTPS URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    assert.equal(resolveImageUrl(url), url);
  });

  it('passes through HTTP URLs unchanged', () => {
    const url = 'http://example.com/image.jpg';
    assert.equal(resolveImageUrl(url), url);
  });

  it('converts local file to base64 data URI', () => {
    // Create a tiny test file
    const tmpFile = path.join('/tmp', 'koma-test-image.png');
    fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes
    try {
      const result = resolveImageUrl(tmpFile);
      assert.ok(result.startsWith('data:image/png;base64,'));
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('detects JPEG mime from extension', () => {
    const tmpFile = path.join('/tmp', 'koma-test.jpg');
    fs.writeFileSync(tmpFile, Buffer.from([0xff, 0xd8, 0xff]));
    try {
      const result = resolveImageUrl(tmpFile);
      assert.ok(result.startsWith('data:image/jpeg;base64,'));
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('throws on nonexistent file', () => {
    assert.throws(
      () => resolveImageUrl('/tmp/nonexistent-koma-image.jpg'),
      { message: 'File not found: /tmp/nonexistent-koma-image.jpg' }
    );
  });
});
