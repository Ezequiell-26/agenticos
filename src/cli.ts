import { BUILT_IN_PROVIDERS } from "./providers/catalog.js";
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

const [command = "providers"] = process.argv.slice(2);

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
  const models = await registry.models();
  for (const model of models) {
    console.log(model.providerId + "\t" + model.id);
  }
  process.exit(0);
}

console.error("Unknown command "" + command + "". Use: providers | models");
process.exit(1);
