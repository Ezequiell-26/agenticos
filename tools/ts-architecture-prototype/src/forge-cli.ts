import path from "node:path";
import { importRepository } from "./forge/importer.js";
import {
  loadManifest,
  replaceCandidates,
  saveManifest,
  upsertRepository,
} from "./forge/manifest.js";
import { scanRepository } from "./forge/scanner.js";

const forgeRoot = path.resolve("vendor", "sources");
const manifestPath = path.resolve("vendor", "sources.manifest.json");

const [command, ...args] = process.argv.slice(2);

function usage(): never {
  console.error(
    [
      "AgentiCOS Source Forge",
      "",
      "Commands:",
      "  forge import <git-url> [--shallow] [--ref <ref>]",
      "  forge scan <source-id>",
      "  forge list",
      "",
      "Examples:",
      "  npm run forge -- import https://github.com/NousResearch/hermes-agent.git",
      "  npm run forge -- import https://github.com/deepseek-ai/deepseek-harness.git",
      "  npm run forge -- scan hermes-agent",
    ].join("\n"),
  );
  process.exit(1);
}

const manifest = await loadManifest(manifestPath);

if (command === "import") {
  const url = args.find((arg) => !arg.startsWith("--"));
  if (!url) {
    usage();
  }

  const shallow = args.includes("--shallow");
  const refIndex = args.indexOf("--ref");
  const ref = refIndex >= 0 ? args[refIndex + 1] : undefined;

  const repository = await importRepository(url, {
    destination: forgeRoot,
    ...(ref ? { ref } : {}),
    shallow,
    recurseSubmodules: false,
  });

  const updated = upsertRepository(manifest, repository);
  await saveManifest(manifestPath, updated);

  console.log(
    JSON.stringify(
      {
        imported: repository.id,
        path: repository.localPath,
        commit: repository.sourceCommit,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command === "scan") {
  const sourceId = args[0];
  if (!sourceId) {
    usage();
  }

  const repository = manifest.repositories.find((item) => item.id === sourceId);
  if (!repository) {
    throw new Error("Unknown source id: " + sourceId);
  }

  const result = await scanRepository(repository);
  const updated = replaceCandidates(
    upsertRepository(manifest, result.repository),
    sourceId,
    result.candidates,
  );

  await saveManifest(manifestPath, updated);

  console.log(JSON.stringify({
    source: result.repository,
    candidates: result.candidates
      .filter((candidate) => candidate.score >= 50)
      .slice(0, 100),
    warnings: result.warnings,
  }, null, 2));
  process.exit(0);
}

if (command === "list") {
  for (const repository of manifest.repositories) {
    console.log(
      repository.id +
        "\t" +
        repository.licenseStatus +
        "\t" +
        repository.sourceCommit +
        "\t" +
        repository.url,
    );
  }
  process.exit(0);
}

usage();
