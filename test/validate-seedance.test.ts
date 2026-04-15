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
