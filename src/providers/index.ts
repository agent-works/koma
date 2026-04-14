import { Provider, ProviderConfig } from '../types.js';
import { VertexAIProvider } from './vertex-ai.js';
import { getConfigDir } from '../config.js';

export function createProvider(
  providerType: string,
  config: ProviderConfig
): Provider {
  switch (providerType) {
    case 'vertex-ai':
      return new VertexAIProvider(config, getConfigDir());
    case 'openai':
      throw new Error('OpenAI provider not yet implemented');
    case 'anthropic':
      throw new Error('Anthropic provider not yet implemented');
    case 'openai-compatible':
      throw new Error('OpenAI-compatible provider not yet implemented');
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

export { VertexAIProvider };
