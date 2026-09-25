import { AgentiCOSError } from "../architecture/errors.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  ProviderError,
  ProviderHealth,
  ProviderModel,
  ProviderSnapshot,
} from "./types.js";

interface RuntimeState {
  health: ProviderHealth;
  consecutiveFailures: number;
  requests: number;
  failures: number;
  rateLimits: number;
  quotaExhaustions: number;
  lastError?: string;
  lastRequestAt?: string;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();
  private readonly state = new Map<string, RuntimeState>();

  register(provider: AIProvider): void {
    const id = provider.definition.id.trim();
    if (!id) {
      throw new AgentiCOSError("Provider id cannot be empty.", {
        code: "PROVIDER_ID_EMPTY",
        category: "VALIDATION",
      });
    }
    if (this.providers.has(id)) {
      throw new AgentiCOSError(`Provider "${id}" is already registered.`, {
        code: "PROVIDER_ALREADY_REGISTERED",
        category: "VALIDATION",
      });
    }

    this.providers.set(id, provider);
    this.state.set(id, {
      health: "unknown",
      consecutiveFailures: 0,
      requests: 0,
      failures: 0,
      rateLimits: 0,
      quotaExhaustions: 0,
    });
  }

  registerOpenAICompatible(config: ProviderConfig): void {
    this.register(new OpenAICompatibleProvider(config));
  }

  get(id: string): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new AgentiCOSError(`Unknown provider "${id}".`, {
        code: "PROVIDER_NOT_FOUND",
        category: "VALIDATION",
      });
    }
    return provider;
  }

  list(): readonly AIProvider[] {
    return [...this.providers.values()];
  }

  snapshots(): readonly ProviderSnapshot[] {
    return this.list().map((provider) => ({
      definition: provider.definition,
      ...this.requireState(provider.definition.id),
    }));
  }

  async models(providerId?: string): Promise<readonly ProviderModel[]> {
    if (providerId) {
      const provider = this.get(providerId);
      try {
        const models = await provider.listModels();
        this.markSuccess(providerId);
        return models;
      } catch (error) {
        this.markFailure(providerId, error);
        throw error;
      }
    }

    const results: ProviderModel[] = [];

    for (const provider of this.providers.values()) {
      try {
        results.push(...await provider.listModels());
        this.markSuccess(provider.definition.id);
      } catch (error) {
        this.markFailure(provider.definition.id, error);
      }
    }

    return results;
  }

  async chat(providerId: string, request: ChatRequest): Promise<ChatResponse> {
    const provider = this.get(providerId);
    const state = this.requireState(providerId);

    state.requests += 1;
    state.lastRequestAt = new Date().toISOString();

    try {
      const response = await provider.chat(request);
      this.markSuccess(providerId);
      return response;
    } catch (error) {
      this.markFailure(providerId, error);
      throw error;
    }
  }

  async chatWithFallback(
    providerIds: readonly string[],
    request: ChatRequest,
  ): Promise<ChatResponse> {
    if (providerIds.length === 0) {
      throw new AgentiCOSError("No providers were supplied for fallback execution.", {
        code: "NO_PROVIDERS",
        category: "PROVIDER",
        recoverable: true,
      });
    }

    let lastError: unknown;
    const attempted = new Set<string>();

    for (const providerId of providerIds) {
      if (attempted.has(providerId)) continue;
      attempted.add(providerId);

      try {
        return await this.chat(providerId, request);
      } catch (error) {
        lastError = error;
        if (!isRetryableProviderError(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AgentiCOSError("All configured providers failed.", {
          code: "ALL_PROVIDERS_FAILED",
          category: "PROVIDER",
          retryable: true,
          recoverable: true,
        });
  }

  private requireState(providerId: string): RuntimeState {
    const state = this.state.get(providerId);
    if (!state) {
      throw new AgentiCOSError(
        `Missing runtime state for provider "${providerId}".`,
        { code: "PROVIDER_STATE_MISSING", category: "BUG", severity: "critical" },
      );
    }
    return state;
  }

  private markSuccess(providerId: string): void {
    const state = this.requireState(providerId);
    state.health = "healthy";
    state.consecutiveFailures = 0;
    delete state.lastError;
  }

  private markFailure(providerId: string, error: unknown): void {
    const state = this.requireState(providerId);

    state.failures += 1;
    state.consecutiveFailures += 1;
    state.lastError = error instanceof Error ? error.message : String(error);

    if (isQuotaError(error)) {
      state.quotaExhaustions += 1;
      state.health = "quota-exhausted";
      return;
    }

    if (isRateLimitError(error)) {
      state.rateLimits += 1;
      state.health = "rate-limited";
      return;
    }

    if (hasStatus(error, 401) || hasStatus(error, 403)) {
      state.health = "unauthorized";
      return;
    }

    state.health = "error";
  }
}

function isRetryableProviderError(error: unknown): error is ProviderError {
  return error instanceof Error &&
    "details" in error &&
    Boolean((error as ProviderError).details?.retryable);
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error &&
    "details" in error &&
    Boolean((error as ProviderError).details?.rateLimited);
}

function isQuotaError(error: unknown): boolean {
  return error instanceof Error &&
    "details" in error &&
    Boolean((error as ProviderError).details?.quotaExhausted);
}

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof Error &&
    "details" in error &&
    (error as ProviderError).details?.status === status;
}
