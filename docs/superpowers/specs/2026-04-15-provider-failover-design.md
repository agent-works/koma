# Provider Failover Design

## Goal

When a model is configured under multiple providers, koma automatically tries the next provider if the current one fails with a retriable error (429, 5xx, timeout). No config syntax changes — provider declaration order is priority order.

## Config Example

```yaml
providers:
  vertex-ai:
    models:
      - gemini-2.5-pro      # priority 1
  openai-compatible:
    models:
      - gemini-2.5-pro      # priority 2 (fallback)
```

## Changes

### config.ts

- `modelToProviderMap`: `Map<string, string>` → `Map<string, string[]>` (ordered provider names)
- `resolveProvider(model)` → `resolveProviders(model)`: returns `Array<{ provider: string, config: ProviderConfig }>` in priority order
- All existing callers updated to use the new signature

### commands/text.ts, image.ts, video.ts

Each command wraps the provider call in a failover loop:

```
providers = resolveProviders(model)
for each (provider, config) in providers:
  try:
    instance = createProvider(config.type, config)
    result = await instance.generateX(request)
    return result
  catch error:
    if isRetriable(error) AND hasMoreProviders:
      stderr: {"fallback": "model from provider-a to provider-b", "reason": "..."}
      continue
    else:
      throw error
```

### Error Classification (new: src/errors.ts)

Retriable (trigger failover):
- HTTP 429 (rate limit)
- HTTP 5xx (server error)
- Network/timeout errors (ECONNREFUSED, ETIMEDOUT, etc.)

Non-retriable (fail immediately):
- HTTP 400 (bad request)
- HTTP 401/403 (auth)
- Missing config/credentials
- Provider doesn't support the operation (e.g., volcengine image)

Implementation: providers embed HTTP status in error messages (e.g., "API error (429): ..."). A helper function `isRetriableError(error)` parses the status code from the error message pattern `(STATUS)`.

### Output

- Success JSON unchanged — includes `model` field so caller knows which model answered
- Fallback events logged to stderr as JSON: `{"fallback": "gemini-2.5-pro from vertex-ai to openai-compatible", "reason": "429 rate limited"}`
- If all providers fail, throw the last error

## Non-goals

- Same-provider retry / backoff (caller's responsibility)
- Circuit breaker / health tracking across invocations (koma is stateless CLI)
- Config syntax changes
