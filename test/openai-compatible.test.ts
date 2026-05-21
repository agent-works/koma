import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OpenAICompatibleProvider } from '../src/providers/openai-compatible.js';

const originalFetch = globalThis.fetch;

function makeProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    type: 'openai-compatible',
    endpoint: 'https://example.test',
    key: 'test-key',
    models: ['gpt-image-2'],
  });
}

function makeOutputPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koma-openai-test-'));
  return path.join(dir, 'out.png');
}

function imageResponse(data = 'fake image', usage?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ data: [{ b64_json: Buffer.from(data).toString('base64') }], usage }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('OpenAICompatibleProvider.generateImage', () => {
  it('uses image generations without reference files and forwards size and quality', async () => {
    const provider = makeProvider();
    const outputPath = makeOutputPath();
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedInit = init;
      return imageResponse();
    }) as typeof fetch;

    await provider.generateImage({
      model: 'gpt-image-2',
      prompt: 'draw a small house',
      outputPath,
      size: '1024x1024',
      quality: 'high',
    });

    assert.equal(capturedUrl, 'https://example.test/v1/images/generations');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal((capturedInit?.headers as Record<string, string>)['Content-Type'], 'application/json');

    const body = JSON.parse(String(capturedInit?.body));
    assert.deepEqual(body, {
      model: 'gpt-image-2',
      prompt: 'draw a small house',
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });
  });

  it('uses image edits with multipart reference files', async () => {
    const provider = makeProvider();
    const outputPath = makeOutputPath();
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const usage = {
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      input_tokens_details: { text_tokens: 4, image_tokens: 6 },
    };

    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedInit = init;
      return imageResponse('fake image', usage);
    }) as typeof fetch;

    const files = Array.from({ length: 6 }, (_, index) => ({
      mimeType: index % 2 === 0 ? 'image/png' : 'image/jpeg',
      data: Buffer.from(`reference pixels ${index}`).toString('base64'),
      filename: `reference-${index + 1}.${index % 2 === 0 ? 'png' : 'jpg'}`,
    }));

    const response = await provider.generateImage({
      model: 'gpt-image-2',
      prompt: 'turn this into watercolor',
      outputPath,
      size: '1536x1024',
      quality: 'medium',
      files,
    });

    assert.equal(capturedUrl, 'https://example.test/v1/images/edits');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal((capturedInit?.headers as Record<string, string>)['Authorization'], 'Bearer test-key');
    assert.ok(!(capturedInit?.headers as Record<string, string>)['Content-Type']);
    assert.ok(capturedInit?.body instanceof FormData);

    const form = capturedInit.body as FormData;
    assert.equal(form.get('model'), 'gpt-image-2');
    assert.equal(form.get('prompt'), 'turn this into watercolor');
    assert.equal(form.get('n'), '1');
    assert.equal(form.get('size'), '1536x1024');
    assert.equal(form.get('quality'), 'medium');

    const images = form.getAll('image');
    assert.equal(images.length, 6);
    const uploaded = images[0] as any;
    assert.equal(uploaded.name, 'reference-1.png');
    assert.equal(uploaded.type, 'image/png');
    const uploadedSecond = images[1] as any;
    assert.equal(uploadedSecond.name, 'reference-2.jpg');
    assert.equal(uploadedSecond.type, 'image/jpeg');
    assert.deepEqual(response.usage, usage);
  });
});
