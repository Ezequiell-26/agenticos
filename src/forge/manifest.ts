import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { AgentiCOSError } from "../architecture/errors.js";
import type {
  ComponentDecision,
  SourceManifest,
  SourceRepository,
} from "./types.js";
import { normalizeRepositoryUrl, repositoryId } from "./importer.js";

export const DEFAULT_MANIFEST: SourceManifest = {
  schemaVersion: 1,
  repositories: [],
  candidates: [],
};

export async function loadManifest(filePath: string): Promise<SourceManifest> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    assertSourceManifest(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof AgentiCOSError) throw error;

    const code =
      error instanceof Error && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : "";

    if (code === "ENOENT") {
      return DEFAULT_MANIFEST;
    }

    throw new AgentiCOSError("Source manifest could not be loaded.", {
      code: "FORGE_MANIFEST_LOAD_FAILED",
      category: "PERSISTENCE",
      cause: error,
    });
  }
}

export async function saveManifest(
  filePath: string,
  manifest: SourceManifest,
): Promise<void> {
  assertSourceManifest(manifest);
  await mkdir(path.dirname(filePath), { recursive: true });

  const temporaryPath = filePath + "." + randomUUID() + ".tmp";

  try {
    await writeFile(
      temporaryPath,
      JSON.stringify(manifest, null, 2) + "\\n",
      "utf8",
    );
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw new AgentiCOSError(
      "Source manifest could not be persisted atomically.",
      {
        code: "FORGE_MANIFEST_SAVE_FAILED",
        category: "PERSISTENCE",
        cause: error,
      },
    );
  }
}

export function upsertRepository(
  manifest: SourceManifest,
  repository: SourceRepository,
): SourceManifest {
  assertSourceManifest(manifest);
  assertSourceRepository(repository);

  const repositories = manifest.repositories.filter(
    (item) => item.id !== repository.id,
  );

  const next = {
    ...manifest,
    repositories: [...repositories, repository],
  };
  assertSourceManifest(next);
  return next;
}

export function replaceCandidates(
  manifest: SourceManifest,
  sourceId: string,
  candidates: SourceManifest["candidates"],
): SourceManifest {
  assertSourceManifest(manifest);

  if (!sourceId.trim()) {
    throw new AgentiCOSError("Source id is required.", {
      code: "FORGE_SOURCE_ID_REQUIRED",
      category: "VALIDATION",
    });
  }

  const next = {
    ...manifest,
    candidates: [
      ...manifest.candidates.filter((item) => item.sourceId !== sourceId),
      ...candidates,
    ],
  };
  assertSourceManifest(next);
  return next;
}

export function assertSourceManifest(
  value: unknown,
): asserts value is SourceManifest {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw invalidManifest("Source manifest schemaVersion must be 1.");
  }

  if (
    !Array.isArray(value.repositories) ||
    !Array.isArray(value.candidates)
  ) {
    throw invalidManifest("Source manifest collections are invalid.");
  }

  const repositoryIds = new Set<string>();
  for (const repository of value.repositories) {
    assertSourceRepository(repository);

    if (repositoryIds.has(repository.id)) {
      throw invalidManifest(
        "Duplicate source repository id: " + repository.id,
      );
    }

    repositoryIds.add(repository.id);
  }

  const candidateKeys = new Set<string>();
  for (const candidate of value.candidates) {
    if (
      !isRecord(candidate) ||
      typeof candidate.sourceId !== "string" ||
      typeof candidate.path !== "string" ||
      !candidate.sourceId.trim() ||
      !candidate.path.trim() ||
      candidate.path.startsWith("/") ||
      candidate.path.includes("\\\\") ||
      candidate.path.split("/").some(
        (part) => part === "" || part === "." || part === "..",
      ) ||
      /^[A-Za-z]:/.test(candidate.path) ||
      !isCategory(candidate.category) ||
      !isDecision(candidate.decision) ||
      !Array.isArray(candidate.reasons) ||
      candidate.reasons.some(
        (reason) => typeof reason !== "string" || !reason.trim(),
      ) ||
      typeof candidate.score !== "number" ||
      !Number.isInteger(candidate.score) ||
      candidate.score < 0 ||
      candidate.score > 100
    ) {
      throw invalidManifest("Source manifest candidate is invalid.");
    }

    if (!repositoryIds.has(candidate.sourceId)) {
      throw invalidManifest(
        "Candidate references an unknown source: " + candidate.sourceId,
      );
    }

    const key = candidate.sourceId + "\\n" + candidate.path;
    if (candidateKeys.has(key)) {
      throw invalidManifest("Duplicate source candidate: " + key);
    }

    candidateKeys.add(key);
  }
}

function assertSourceRepository(
  value: unknown,
): asserts value is SourceRepository {
  if (!isRecord(value)) {
    throw invalidManifest("Source repository entry is invalid.");
  }

  const rawId = value.id;
  const rawUrl = value.url;
  const rawLocalPath = value.localPath;
  const rawImportedAt = value.importedAt;
  const rawLicenseFiles = value.licenseFiles;

  if (
    typeof rawId !== "string" ||
    !rawId.trim() ||
    typeof rawUrl !== "string" ||
    !rawUrl.trim() ||
    typeof rawLocalPath !== "string" ||
    !rawLocalPath.trim() ||
    typeof rawImportedAt !== "string" ||
    Number.isNaN(Date.parse(rawImportedAt)) ||
    !isLicenseStatus(value.licenseStatus) ||
    !Array.isArray(rawLicenseFiles) ||
    rawLicenseFiles.some(
      (file) => typeof file !== "string" || !file.trim(),
    )
  ) {
    throw invalidManifest("Source repository entry is invalid.");
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeRepositoryUrl(rawUrl);
  } catch (error) {
    throw invalidManifest(
      "Source repository URL is invalid: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }

  if (repositoryId(normalizedUrl) !== rawId) {
    throw invalidManifest(
      "Source repository id must match its stable URL-derived identity.",
    );
  }

  if (
    value.ref !== undefined &&
    (typeof value.ref !== "string" || !value.ref.trim())
  ) {
    throw invalidManifest("Source repository ref is invalid.");
  }

  if (
    value.sourceCommit !== undefined &&
    !/^[0-9a-f]{40}$/i.test(value.sourceCommit)
  ) {
    throw invalidManifest(
      "Source repository sourceCommit must be a full Git commit.",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLicenseStatus(
  value: unknown,
): value is SourceRepository["licenseStatus"] {
  return (
    value === "verified-mit" ||
    value === "non-mit" ||
    value === "unknown" ||
    value === "mixed" ||
    value === "review-required"
  );
}

function isCategory(
  value: unknown,
): value is SourceManifest["candidates"][number]["category"] {
  return [
    "agent",
    "model-provider",
    "tool",
    "memory",
    "workflow",
    "orchestration",
    "sandbox",
    "browser",
    "ui",
    "api",
    "testing",
    "other",
  ].includes(value as string);
}

function isDecision(value: unknown): value is ComponentDecision {
  return (
    value === "integrate" ||
    value === "adapt" ||
    value === "reference" ||
    value === "exclude"
  );
}

function invalidManifest(message: string): AgentiCOSError {
  return new AgentiCOSError(message, {
    code: "FORGE_MANIFEST_INVALID",
    category: "VALIDATION",
    severity: "critical",
  });
}
