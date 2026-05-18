import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { VertexAIProvider } from '../src/providers/vertex-ai.js';
import { isRetriableError } from '../src/failover.js';

const config: any = {
  type: 'vertex-ai',
  project: 'test-project',
  location: 'us-central1',
  service_account: {
    client_email: 'test@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
  },
  models: ['gemini-test'],
};

function makeProvider(responseBody: unknown): VertexAIProvider {
  const provider = new VertexAIProvider(config);
  (provider as any).getAccessToken = async () => 'test-token';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => responseBody,
  }) as Response;
  return provider;
}

describe('VertexAIProvider.generateText', () => {
  afterEach(() => {
    delete (globalThis as any).fetch;
  });

  it('collects text from all Vertex content parts', async () => {
    const provider = makeProvider({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: 'image/png', data: 'abc' } },
              { text: 'OK' },
              { text: ' done' },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 3,
        candidatesTokenCount: 2,
      },
    });

    const result = await provider.generateText({
      model: 'gemini-test',
      prompt: 'only say OK',
    });

    assert.equal(result.text, 'OK done');
    assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2 });
  });

  it('includes Vertex response reasons when no text parts are present', async () => {
    const provider = makeProvider({
      promptFeedback: {
        blockReason: 'SAFETY',
      },
      candidates: [
        {
          finishReason: 'MAX_TOKENS',
          safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'NEGLIGIBLE' }],
          content: {
            parts: [{ thought: true }],
          },
        },
      ],
    });

    await assert.rejects(
      () => provider.generateText({ model: 'gemini-test', prompt: 'only say OK' }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /No text content in Vertex AI response/);
        assert.match(error.message, /finishReason=MAX_TOKENS/);
        assert.match(error.message, /safetyRatings=/);
        assert.match(error.message, /promptFeedback=/);
        assert.match(error.message, /parts=/);
        return true;
      }
    );
  });
});

describe('isRetriableError', () => {
  it('treats missing Vertex text content as retriable for provider failover', () => {
    assert.equal(
      isRetriableError(new Error('Vertex AI text generation failed: No text content in Vertex AI response')),
      true
    );
  });
});
