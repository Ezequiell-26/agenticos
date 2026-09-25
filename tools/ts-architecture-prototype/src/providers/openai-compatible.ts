import {
  ProviderError,
  type AIProvider,
  type ChatRequest,
  type ChatResponse,
  type ProviderConfig,
  type ProviderDefinition,
  type ProviderModel,
  type TokenUsage,
  type ToolCall,
} from "./types.js";

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      tool_calls?: OpenAIToolCall[];
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
    id?: string;
    owned_by?: string;
  }>;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly definition: ProviderDefinition;

  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(config: ProviderConfig) {
    const {
      apiKey,
      models: _models,
      timeoutMs,
      ...definitionInput
    } = config;

    const definition: ProviderDefinition = {
      ...definitionInput,
      baseUrl: definitionInput.baseUrl.replace(/\/$/, ""),
    };

    assertProviderDefinition(definition);

    if (apiKey !== undefined && !apiKey.trim()) {
      throw new ProviderError("Provider API key cannot be empty.", {
        code: "PROVIDER_API_KEY_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      });
    }

    this.definition = definition;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs ?? 120_000;

    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new ProviderError("Provider timeout must be a positive integer.", {
        code: "PROVIDER_TIMEOUT_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      });
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    validateChatRequest(request);

    if (request.stream) {
      throw new ProviderError(
        "Streaming is not implemented by this adapter yet.",
        {
          code: "PROVIDER_STREAMING_UNIMPLEMENTED",
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }

    const body: Record<string, unknown> = {
      ...(request.extraBody ?? {}),
      model: request.model,
      messages: request.messages,
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
      ...(request.topP === undefined
        ? {}
        : { top_p: request.topP }),
      ...(request.maxTokens === undefined
        ? {}
        : { max_tokens: request.maxTokens }),
      ...(request.reasoningEffort === undefined
        ? {}
        : { reasoning_effort: request.reasoningEffort }),
      ...(request.tools === undefined
        ? {}
        : { tools: request.tools }),
      ...(request.toolChoice === undefined
        ? {}
        : { tool_choice: request.toolChoice }),
      stream: false,
    };

    const response = await this.fetchWithTimeout("/chat/completions", {
      method: "POST",
      headers: this.requestHeaders("application/json"),
      body: JSON.stringify(body),
    });

    const data = await this.parseJson<OpenAIChatResponse>(response);
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!choice || !message) {
      throw new ProviderError(
        "Provider returned no usable completion choice.",
        {
          code: "PROVIDER_EMPTY_CHOICE",
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }

    const usage = data.usage ? compactUsage(data.usage) : undefined;
    const toolCalls = extractToolCalls(message.tool_calls);

    return {
      id: data.id ?? crypto.randomUUID(),
      providerId: this.definition.id,
      model: data.model ?? request.model,
      text: extractMessageText(message.content),
      ...(choice.finish_reason === undefined || choice.finish_reason === null
        ? {}
        : { finishReason: choice.finish_reason }),
      ...(usage ? { usage } : {}),
      ...(toolCalls ? { toolCalls } : {}),
      raw: data,
    };
  }

  async listModels(): Promise<readonly ProviderModel[]> {
    const response = await this.fetchWithTimeout("/models", {
      method: "GET",
      headers: this.requestHeaders("application/json"),
    });

    const data = await this.parseJson<OpenAIModelsResponse>(response);

    if (!Array.isArray(data.data)) {
      throw new ProviderError("Provider returned an invalid model list.", {
        code: "PROVIDER_INVALID_MODEL_LIST",
        retryable: true,
        rateLimited: false,
        quotaExhausted: false,
      });
    }

    const models: ProviderModel[] = [];

    for (const model of data.data) {
      if (!model || typeof model.id !== "string" || !model.id.trim()) {
        throw new ProviderError(
          "Provider returned a malformed model entry.",
          {
            code: "PROVIDER_INVALID_MODEL_ENTRY",
            retryable: true,
            rateLimited: false,
            quotaExhausted: false,
          },
        );
      }

      models.push({
        id: model.id,
        providerId: this.definition.id,
        displayName: model.id,
        capabilities: ["text"],
        billing: this.definition.billing,
        active: true,
      });
    }

    return models;
  }

  private requestHeaders(accept: string): Record<string, string> {
    return {
      Accept: accept,
      ...(this.definition.extraHeaders ?? {}),
      ...(this.apiKey ? { Authorization: "Bearer " + this.apiKey } : {}),
      "Content-Type": "application/json",
    };
  }

  private async fetchWithTimeout(
    resourcePath: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        this.definition.baseUrl + resourcePath,
        {
          ...init,
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw classifyHttpError(
          response.status,
          response.headers,
          body,
        );
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
        error instanceof Error
          ? error.message
          : "Unknown provider network error.",
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
      throw new ProviderError(
        "Provider returned an empty response body.",
        {
          code: "PROVIDER_EMPTY_RESPONSE",
          retryable: true,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new ProviderError(
        "Provider returned invalid JSON.",
        {
          code: "PROVIDER_INVALID_JSON",
          retryable: true,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }
  }
}

function assertProviderDefinition(
  definition: ProviderDefinition,
): void {
  if (!definition.id.trim() || !definition.name.trim()) {
    throw new ProviderError(
      "Provider id and name are required.",
      {
        code: "PROVIDER_DEFINITION_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  if (!definition.baseUrl.trim()) {
    throw new ProviderError(
      "Provider baseUrl is required.",
      {
        code: "PROVIDER_BASE_URL_REQUIRED",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  let url: URL;
  try {
    url = new URL(definition.baseUrl);
  } catch {
    throw new ProviderError(
      "Provider baseUrl is invalid.",
      {
        code: "PROVIDER_BASE_URL_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new ProviderError(
      "Provider baseUrl must use HTTP(S) without embedded credentials.",
      {
        code: "PROVIDER_BASE_URL_UNSAFE",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  validateExtraHeaders(definition.extraHeaders);
}

function validateExtraHeaders(
  headers: Readonly<Record<string, string>> | undefined,
): void {
  if (!headers) return;

  const forbidden = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "proxy-authenticate",
  ]);

  for (const key of Object.keys(headers)) {
    if (forbidden.has(key.toLowerCase())) {
      throw new ProviderError(
        "Provider extraHeaders cannot override credential-bearing transport headers.",
        {
          code: "PROVIDER_EXTRA_HEADERS_UNSAFE",
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }
  }
}

function validateChatRequest(request: ChatRequest): void {
  if (
    !request ||
    typeof request.model !== "string" ||
    !Array.isArray(request.messages) ||
    !request.model.trim() ||
    request.messages.length === 0
  ) {
    throw new ProviderError(
      "Chat request requires a model and at least one message.",
      {
        code: "CHAT_REQUEST_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  for (const message of request.messages) {
    if (
      !message ||
      typeof message !== "object" ||
      message.content === undefined ||
      !message.content ||
      (
        typeof message.content === "string" &&
        !message.content.trim()
      )
    ) {
      throw new ProviderError(
        "Chat messages cannot have empty content.",
        {
          code: "CHAT_MESSAGE_INVALID",
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }
  }

  if (
    request.temperature !== undefined &&
    (
      !Number.isFinite(request.temperature) ||
      request.temperature < 0 ||
      request.temperature > 2
    )
  ) {
    throw new ProviderError(
      "Temperature must be between 0 and 2.",
      {
        code: "CHAT_TEMPERATURE_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  if (
    request.topP !== undefined &&
    (
      !Number.isFinite(request.topP) ||
      request.topP < 0 ||
      request.topP > 1
    )
  ) {
    throw new ProviderError(
      "topP must be between 0 and 1.",
      {
        code: "CHAT_TOP_P_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }

  if (
    request.maxTokens !== undefined &&
    (
      !Number.isInteger(request.maxTokens) ||
      request.maxTokens <= 0
    )
  ) {
    throw new ProviderError(
      "maxTokens must be a positive integer.",
      {
        code: "CHAT_MAX_TOKENS_INVALID",
        retryable: false,
        rateLimited: false,
        quotaExhausted: false,
      },
    );
  }
}

function extractToolCalls(
  calls: readonly OpenAIToolCall[] | undefined,
): ToolCall[] | undefined {
  if (!calls || calls.length === 0) return undefined;

  const normalized: ToolCall[] = [];

  for (const call of calls) {
    if (
      !call ||
      call.type !== "function" ||
      !call.id ||
      !call.function?.name ||
      call.function.arguments === undefined
    ) {
      throw new ProviderError(
        "Provider returned an invalid tool call.",
        {
          code: "PROVIDER_INVALID_TOOL_CALL",
          retryable: false,
          rateLimited: false,
          quotaExhausted: false,
        },
      );
    }

    normalized.push({
      id: call.id,
      type: "function",
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    });
  }

  return normalized;
}

function compactUsage(
  usage: NonNullable<OpenAIChatResponse["usage"]>,
): TokenUsage {
  return {
    ...(usage.prompt_tokens === undefined
      ? {}
      : { inputTokens: usage.prompt_tokens }),
    ...(usage.completion_tokens === undefined
      ? {}
      : { outputTokens: usage.completion_tokens }),
    ...(usage.total_tokens === undefined
      ? {}
      : { totalTokens: usage.total_tokens }),
  };
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
  const retryAfterMs = retryAfter
    ? parseRetryAfter(retryAfter)
    : undefined;

  const suffix = retryAfter
    ? " Retry-After: " + truncate(retryAfter, 120) + "."
    : "";

  return new ProviderError(
    "Provider HTTP " +
      status +
      ": " +
      truncate(body, 600) +
      "." +
      suffix,
    {
      code: "PROVIDER_HTTP_" + status,
      status,
      retryable,
      rateLimited,
      quotaExhausted,
      ...(retryAfterMs === undefined
        ? {}
        : { retryAfterMs }),
    },
  );
}

function parseRetryAfter(value: string): number | undefined {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs)
    ? undefined
    : Math.max(0, dateMs - Date.now());
}

function truncate(value: string, max: number): string {
  return value.length <= max
    ? value
    : value.slice(0, max) + "…";
}

function extractMessageText(
  content:
    | string
    | Array<{ type?: string; text?: string }>
    | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  return content
    .filter((part) => part.type === "text" || Boolean(part.text))
    .map((part) => part.text ?? "")
    .join("");
}
