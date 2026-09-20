import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SourceManifest } from "./types.js";

export const DEFAULT_MANIFEST: SourceManifest = {
  schemaVersion: 1,
  repositories: [],
  candidates: [],
};

export async function loadManifest(filePath: string): Promise<SourceManifest> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as SourceManifest;
  } catch (error) {
    const code = error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "";

    if (code === "ENOENT") {
      return DEFAULT_MANIFEST;
    }

    throw error;
  }
}

export async function saveManifest(
  filePath: string,
  manifest: SourceManifest,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export function upsertRepository(
  manifest: SourceManifest,
  repository: SourceManifest["repositories"][number],
): SourceManifest {
  const repositories = manifest.repositories.filter((item) => item.id !== repository.id);

  return {
    ...manifest,
    repositories: [...repositories, repository],
  };
}

export function replaceCandidates(
  manifest: SourceManifest,
  sourceId: string,
  candidates: SourceManifest["candidates"],
): SourceManifest {
  return {
    ...manifest,
    candidates: [
      ...manifest.candidates.filter((item) => item.sourceId !== sourceId),
      ...candidates,
    ],
  };
}
