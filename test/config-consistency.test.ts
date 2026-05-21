import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { handleModelsCommand } from '../src/commands/models.js';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const cliPath = path.join(repoRoot, 'src', 'cli.ts');
const tsxLoaderPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs');

function makeTempConfig(config: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koma-config-test-'));
  fs.writeFileSync(path.join(dir, 'koma.yaml'), config);
  return dir;
}

function runKoma(args: string[], cwd: string) {
  return spawnSync(process.execPath, ['--import', tsxLoaderPath, cliPath, ...args], {
    cwd,
    encoding: 'utf-8',
  });
}

describe('configuration consistency', () => {
  it('uses defaults.video when seedance model is omitted', () => {
    const cwd = makeTempConfig(`
defaults:
  video: seedance-2.0
providers:
  custom:
    type: openai-compatible
    endpoint: https://example.invalid
    key: test-key
    models:
      - seedance-2.0
`);

    const result = runKoma(['seedance', 'test prompt'], cwd);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Provider \\"custom\\" does not support video generation/);
    assert.doesNotMatch(result.stderr, /Model "seedance-1\.5-pro" not found/);
  });

  it('prints defaults.tts in non-JSON models output', async () => {
    const cwd = makeTempConfig(`
defaults:
  text: gemini-test
  tts: doubao-tts
providers:
  custom:
    type: openai-compatible
    endpoint: https://example.invalid
    key: test-key
    models:
      - gemini-test
      - doubao-tts
`);

    const originalCwd = process.cwd();
    const originalLog = console.log;
    const lines: string[] = [];
    process.chdir(cwd);
    console.log = (message?: unknown) => {
      lines.push(String(message ?? ''));
    };

    try {
      await handleModelsCommand({ json: false });
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
    }

    const output = lines.join('\n');
    assert.match(output, /Defaults:/);
    assert.match(output, /text: gemini-test/);
    assert.match(output, /tts: doubao-tts/);
  });
});
