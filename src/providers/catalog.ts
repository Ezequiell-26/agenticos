import type { ProviderDefinition } from "./types.js";

export const BUILT_IN_PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    billing: "free-tier",
    protocol: "openai-chat-completions",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/docs",
  },
  {
    id: "groq",
    name: "Groq",
    billing: "free-tier",
    protocol: "openai-chat-completions",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/docs",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    billing: "paid",
    protocol: "openai-responses",
    baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    docsUrl: "https://api-docs.deepseek.com/",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    billing: "free-tier",
    protocol: "openai-chat-completions",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnv: "GEMINI_API_KEY",
    docsUrl: "https://ai.google.dev/gemini-api/docs/openai",
  },
  {
    id: "openai",
    name: "OpenAI",
    billing: "paid",
    protocol: "openai-chat-completions",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/docs",
  },
];

export interface EnvironmentProviderConfig extends ProviderDefinition {
  readonly apiKey?: string;
}

export function withEnvironmentKey(
  definition: ProviderDefinition,
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentProviderConfig {
  const apiKey = definition.apiKeyEnv ? env[definition.apiKeyEnv] : undefined;
  return apiKey ? { ...definition, apiKey } : definition;
}
