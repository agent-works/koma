import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const cliPath = path.join(repoRoot, 'src', 'cli.ts');
const tsxLoaderPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs');

function makeTempConfig(config: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koma-cli-image-test-'));
  fs.writeFileSync(path.join(dir, 'koma.yaml'), config);
  return dir;
}

function runKoma(args: string[], cwd: string) {
  return spawnSync(process.execPath, ['--import', tsxLoaderPath, cliPath, ...args], {
    cwd,
    encoding: 'utf-8',
  });
}

describe('koma image CLI', () => {
  it('shows image-specific options in image help', () => {
    const cwd = makeTempConfig(`
defaults:
  image: gpt-image-2
providers:
  openai:
    type: openai-compatible
    endpoint: https://example.invalid
    key: test-key
    models:
      - gpt-image-2
`);

    const result = runKoma(['image', '--help'], cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /koma image \[prompt\]/);
    assert.match(result.stdout, /--file <path>/);
    assert.match(result.stdout, /--size <size>/);
    assert.match(result.stdout, /--quality <quality>/);
    assert.doesNotMatch(result.stdout, /koma seedance \[prompt\]/);
  });
});
