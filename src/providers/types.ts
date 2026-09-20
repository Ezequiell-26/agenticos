export type ProviderBilling = "free" | "free-tier" | "paid" | "local" | "custom";

export type ProviderProtocol =
  | "openai-chat-completions"
  | "openai-responses";

export type ModelCapability =
  | "text"
  | "vision"
  | "audio-input"
  | "audio-output"
  | "image-generation"
  | "video-generation"
  | "tool-calling"
  | "structured-output"
  | "reasoning";

export type ProviderHealth =
  | "unknown"
  | "healthy"
  | "degraded"
  | "rate-limited"
  | "quota-exhausted"
  | "unauthorized"
  | "offline"
  | "error";

export interface ProviderModel {
  readonly id: string;
  readonly providerId: string;
  readonly displayName?: string;
  readonly capabilities: readonly ModelCapability[];
  readonly contextWindow?: number;
  readonly inputPricePerMillion?: number;
  readonly outputPricePerMillion?: number;
  readonly billing: ProviderBilling;
  readonly active?: boolean;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly billing: ProviderBilling;
  readonly protocol: ProviderProtocol;
  readonly baseUrl: string;
  readonly apiKeyEnv?: string;
  readonly docsUrl?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

export interface ProviderConfig extends ProviderDefinition {
  readonly apiKey?: string;
  readonly models?: readonly ProviderModel[];
  readonly timeoutMs?: number;
}

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | readonly ContentPart[];
  readonly name?: string;
  readonly toolCallId?: string;
}

export type ContentPart =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "image_url";
      readonly image_url: { readonly url: string };
    };

export interface ChatTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description?: string;
    readonly parameters?: Record<string, unknown>;
  };
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  readonly tools?: readonly ChatTool[];
  readonly toolChoice?:
    | "none"
    | "auto"
    | "required"
    | {
        readonly type: "function";
        readonly function: { readonly name: string };
      };
  readonly stream?: boolean;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly extraBody?: Record<string, unknown>;
}

export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface ChatResponse {
  readonly id: string;
  readonly providerId: string;
  readonly model: string;
  readonly text: string;
  readonly finishReason?: string;
  readonly usage?: TokenUsage;
  readonly raw: unknown;
}

export interface ProviderErrorDetails {
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly rateLimited: boolean;
  readonly quotaExhausted: boolean;
}

export class ProviderError extends Error {
  readonly details: ProviderErrorDetails;

  constructor(message: string, details: ProviderErrorDetails) {
    super(message);
    this.name = "ProviderError";
    this.details = details;
  }
}

export interface AIProvider {
  readonly definition: ProviderDefinition;
  chat(request: ChatRequest): Promise<ChatResponse>;
  listModels(): Promise<readonly ProviderModel[]>;
}

export interface ProviderSnapshot {
  readonly definition: ProviderDefinition;
  readonly health: ProviderHealth;
  readonly consecutiveFailures: number;
  readonly requests: number;
  readonly failures: number;
  readonly rateLimits: number;
  readonly quotaExhaustions: number;
  readonly lastError?: string;
  readonly lastRequestAt?: string;
}
