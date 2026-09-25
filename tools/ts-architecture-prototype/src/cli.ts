import { BUILT_IN_PROVIDERS, type EnvironmentProviderConfig } from "./providers/catalog.js";
import { ProviderRegistry } from "./providers/registry.js";

const registry = new ProviderRegistry();

for (const definition of BUILT_IN_PROVIDERS) {
  const apiKey = definition.apiKeyEnv
    ? process.env[definition.apiKeyEnv]
    : undefined;

  if (!apiKey) {
    continue;
  }

  registry.registerOpenAICompatible({
    ...definition,
    apiKey,
  });
}

const customBaseUrl = process.env.AGENTICOS_CUSTOM_BASE_URL;
const customApiKey = process.env.AGENTICOS_CUSTOM_API_KEY;

if (customBaseUrl) {
  const custom: EnvironmentProviderConfig = {
    id: "custom",
    name: "Custom OpenAI-compatible",
    billing: "custom",
    protocol: "openai-chat-completions",
    baseUrl: customBaseUrl,
    docsUrl: "https://platform.openai.com/docs/api-reference",
    ...(customApiKey ? { apiKey: customApiKey } : {}),
  };

  registry.registerOpenAICompatible(custom);
}

const args = process.argv.slice(2);
const command = args[0] ?? "providers";

if (command === "providers") {
  for (const snapshot of registry.snapshots()) {
    console.log(
      snapshot.definition.id +
        "\t" +
        snapshot.definition.billing +
        "\t" +
        snapshot.health +
        "\t" +
        snapshot.definition.baseUrl,
    );
  }

  if (registry.list().length === 0) {
    console.log("No providers configured. Copy .env.example and add at least one API key.");
  }

  process.exit(0);
}

if (command === "models") {
  const providerId = args[1];
  const models = await registry.models(providerId);

  for (const model of models) {
    console.log(model.providerId + "\t" + model.id);
  }

  process.exit(0);
}

if (command === "chat") {
  const providerId = args[1];
  const model = args[2];
  const prompt = args.slice(3).join(" ");

  if (!providerId || !model || !prompt) {
    console.error("Usage: npm run dev -- chat <provider> <model> <prompt>");
    process.exit(1);
  }

  const response = await registry.chat(providerId, {
    model,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  console.log(response.text);
  process.exit(0);
}

console.error("Unknown command. Use: providers | models [provider] | chat <provider> <model> <prompt>");
process.exit(1);
