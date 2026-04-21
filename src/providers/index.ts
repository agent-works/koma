import { Provider, ProviderConfig } from '../types.js';
import { VertexAIProvider } from './vertex-ai.js';
import { VolcengineArkProvider } from './volcengine-ark.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { VolcengineTTSProvider } from './volcengine-tts.js';

export function createProvider(
  providerType: string,
  config: ProviderConfig
): Provider {
  switch (providerType) {
    case 'vertex-ai':
      return new VertexAIProvider(config);
    case 'volcengine-ark':
      return new VolcengineArkProvider(config);
    case 'volcengine-tts':
      return new VolcengineTTSProvider(config);
    case 'openai':
    case 'anthropic':
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

export { VertexAIProvider, VolcengineArkProvider, OpenAICompatibleProvider, VolcengineTTSProvider };
