import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  assertSourceManifest,
  loadManifest,
  normalizeRepositoryUrl,
  repositoryId,
  saveManifest,
  scanRepository,
} from "../src/forge/index.js";

test("source forge derives collision-resistant repository identities", () => {
  assert.equal(
    repositoryId("https://github.com/OpenAI/agent.git"),
    "github.com--openai--agent",
  );
  assert.notEqual(
    repositoryId("https://github.com/OpenAI/agent.git"),
    repositoryId("https://github.com/OtherOrg/agent.git"),
  );
  assert.equal(
    normalizeRepositoryUrl("https://github.com/OpenAI/agent.git"),
    "https://github.com/OpenAI/agent",
  );
});

test("source forge rejects credential-bearing repository URLs", () => {
  assert.throws(() =>
    normalizeRepositoryUrl("https://user:secret@github.com/OpenAI/agent.git"),
  );
  assert.throws(() =>
    normalizeRepositoryUrl("ftp://github.com/OpenAI/agent.git"),
  );
});

test("source forge license scanning fails closed for ambiguous repositories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-forge-"));

  try {
    await writeFile(
      join(directory, "LICENSE"),
      "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\nThe software is provided \"as is\".\n",
      "utf8",
    );
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: "example",
        license: "Apache-2.0",
      }),
      "utf8",
    );
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "src", "agent.ts"),
      "export const agent = true;\n",
      "utf8",
    );

    const result = await scanRepository({
      id: "example",
      url: "https://github.com/example/example",
      localPath: directory,
      licenseStatus: "unknown",
      licenseFiles: [],
      importedAt: new Date().toISOString(),
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    });

    assert.equal(result.repository.licenseStatus, "mixed");
    assert.ok(result.warnings.length > 0);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.decision, "adapt");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("source forge accepts explicit MIT repository licensing without a package manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-forge-mit-"));

  try {
    await writeFile(
      join(directory, "LICENSE"),
      "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\nThe software is provided \"as is\".\n",
      "utf8",
    );
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "src", "provider.ts"),
      "export const provider = true;\n",
      "utf8",
    );

    const result = await scanRepository({
      id: "mit-example",
      url: "https://github.com/example/mit-example",
      localPath: directory,
      licenseStatus: "unknown",
      licenseFiles: [],
      importedAt: new Date().toISOString(),
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    });

    assert.equal(result.repository.licenseStatus, "verified-mit");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("source forge manifest validation rejects orphan candidates and invalid commits", async () => {
  assert.throws(() =>
    assertSourceManifest({
      schemaVersion: 1,
      repositories: [{
        id: "github.com--example--source-a",
        url: "https://github.com/example/source-a",
        localPath: "/tmp/source-a",
        licenseStatus: "unknown",
        licenseFiles: [],
        importedAt: new Date().toISOString(),
        sourceCommit: "not-a-commit",
      }],
      candidates: [],
    }),
  );

  assert.throws(() =>
    assertSourceManifest({
      schemaVersion: 1,
      repositories: [],
      candidates: [{
        sourceId: "missing-source",
        path: "src/tool.ts",
        category: "tool",
        decision: "adapt",
        reasons: ["x"],
        score: 50,
      }],
    }),
  );
});

test("source forge persists validated manifests", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-manifest-"));
  const filePath = join(directory, "forge", "manifest.json");

  try {
    const manifest = {
      schemaVersion: 1 as const,
      repositories: [{
        id: "github.com--example--source-a",
        url: "https://github.com/example/source-a",
        localPath: directory,
        licenseStatus: "verified-mit" as const,
        licenseFiles: ["LICENSE"],
        importedAt: new Date().toISOString(),
        sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      }],
      candidates: [{
        sourceId: "github.com--example--source-a",
        path: "src/tool.ts",
        category: "tool" as const,
        decision: "adapt" as const,
        reasons: ["Reviewed"],
        score: 80,
      }],
    };

    await saveManifest(filePath, manifest);
    const loaded = await loadManifest(filePath);
    assert.deepEqual(loaded, manifest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
