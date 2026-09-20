import {
  ProviderError,
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  type ProviderConfig,
  type ProviderModel,
  type TokenUsage,
} from "./types.js";

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAIModelsResponse {
  data?: Array<{
    id: string;
    owned_by?: string;
  }>;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly definition: ProviderConfig;
  private readonly timeoutMs: number;

  constructor(config: ProviderConfig) {
    this.definition = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ""),
    };
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (request.stream) {
      throw new ProviderError(
        "Streaming is not implemented in the initial provider engine. Use stream=false for now.",
        {
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.topP === undefined ? {} : { top_p: request.topP }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
      ...(request.reasoningEffort === undefined ? {} : { reasoning_effort: request.reasoningEffort }),
      ...(request.tools === undefined ? {} : { tools: request.tools }),
      ...(request.toolChoice === undefined ? {} : { tool_choice: request.toolChoice }),
      stream: false,
      ...(request.extraBody ?? {}),
    };

    const response = await this.fetchWithTimeout("/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
        ...(this.definition.extraHeaders ?? {}),
      },
      body: JSON.stringify(body),
    });

    const data = await this.parseJson<OpenAIChatResponse>(response);
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!choice || !message) {
      throw new ProviderError("Provider returned no usable completion choice.", {
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      });
    }

    const usage = data.usage
      ? compactUsage(data.usage)
      : undefined;

    return {
      id: data.id ?? crypto.randomUUID(),
      providerId: this.definition.id,
      model: data.model ?? request.model,
      text: extractMessageText(message.content),
      ...(choice.finish_reason === undefined || choice.finish_reason === null
        ? {}
        : { finishReason: choice.finish_reason }),
      ...(usage ? { usage } : {}),
      raw: data,
    };
  }

  async listModels(): Promise<readonly ProviderModel[]> {
    const response = await this.fetchWithTimeout("/models", {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...this.authHeaders(),
        ...(this.definition.extraHeaders ?? {}),
      },
    });

    const data = await this.parseJson<OpenAIModelsResponse>(response);

    return (data.data ?? []).map((model) => ({
      id: model.id,
      providerId: this.definition.id,
      displayName: model.id,
      capabilities: ["text"],
      billing: this.definition.billing,
      active: true,
    }));
  }

  private authHeaders(): Record<string, string> {
    const key = this.definition.apiKey;
    return key ? { Authorization: "Bearer " + key } : {};
  }

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.definition.baseUrl + path, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw classifyHttpError(response.status, response.headers, text);
      }

      return response;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ProviderError(
          "Provider request timed out after " + this.timeoutMs + " ms.",
          {
            code: "PROVIDER_TIMEOUT",
            retryable: true,
            rateLimited: false,
            quotaExhausted: false,
          },
        );
      }

      throw new ProviderError(
        error instanceof Error ? error.message : "Unknown provider network error.",
        {
          code: "PROVIDER_NETWORK_ERROR",
          retryable: true,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseJson<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!text) {
      throw new ProviderError("Provider returned an empty response body.", {
        code: "PROVIDER_EMPTY_RESPONSE",
        retryable: true,
        rateLimited: false,
        quotaExhausted: false,
      });
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new ProviderError("Provider returned invalid JSON.", {
        code: "PROVIDER_INVALID_JSON",
        retryable: true,
        rateLimited: false,
        quotaExhausted: false,
      },);
    }
  }
}

function classifyHttpError(
  status: number,
  headers: Headers,
  body: string,
): ProviderError {
  const rateLimited = status === 429;
  const quotaExhausted =
    rateLimited &&
    /(quota|insufficient|limit exceeded|credits|billing|balance)/i.test(body);

  const retryable =
    rateLimited ||
    status >= 500 ||
    status === 408 ||
    status === 425;

  const retryAfter = headers.get("retry-after");
  const retryAfterMs = retryAfter ? parseRetryAfter(retryAfter) : undefined;
  const suffix = retryAfter ? " Retry-After: " + retryAfter + "." : "";

  return new ProviderError(
    "Provider HTTP " + status + ": " + truncate(body, 600) + "." + suffix,
    {
      code: "PROVIDER_HTTP_" + status,
      status,
      retryable,
      rateLimited,
      quotaExhausted,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    },
  );
}

function compactUsage(usage: NonNullable<OpenAIChatResponse["usage"]>): TokenUsage {
  return {
    ...(usage.prompt_tokens === undefined ? {} : { inputTokens: usage.prompt_tokens }),
    ...(usage.completion_tokens === undefined ? {} : { outputTokens: usage.completion_tokens }),
    ...(usage.total_tokens === undefined ? {} : { totalTokens: usage.total_tokens }),
  };
}

function parseRetryAfter(value: string): number | undefined {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max) + "…";
}

function extractMessageText(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  return content
    .filter((part) => part.type === "text" || Boolean(part.text))
    .map((part) => part.text ?? "")
    .join("");
}
