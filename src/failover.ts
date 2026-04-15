import { ProviderConfig, Provider } from './types.js';
import { createProvider } from './providers/index.js';

/**
 * Check if an error is retriable (should trigger failover to next provider).
 * Retriable: 429, 5xx, network errors.
 * Non-retriable: 4xx (except 429), missing config, unsupported operation.
 */
export function isRetriableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  // Extract HTTP status from provider error patterns like "error (429):" or "API error (500):"
  const statusMatch = message.match(/error \((\d{3})\)/i);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    return status === 429 || status >= 500;
  }

  // Network / timeout errors
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ENETUNREACH|socket hang up|network/i.test(message)) {
    return true;
  }

  // Timeout errors from video polling
  if (/timed out/i.test(message)) {
    return true;
  }

  return false;
}

/**
 * Try a provider call across multiple providers in order.
 * On retriable error, log fallback to stderr and try the next provider.
 * On non-retriable error or last provider failure, throw.
 */
export async function callWithFailover<T>(
  providers: Array<{ provider: string; config: ProviderConfig }>,
  callFn: (provider: Provider, providerName: string) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < providers.length; i++) {
    const { provider: providerName, config } = providers[i];

    try {
      const provider = createProvider(config.type, config);
      return await callFn(provider, providerName);
    } catch (error) {
      lastError = error;
      const hasMore = i < providers.length - 1;

      if (hasMore && isRetriableError(error)) {
        const nextProvider = providers[i + 1].provider;
        const reason = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify({
            fallback: `${providerName} → ${nextProvider}`,
            reason,
          })
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
