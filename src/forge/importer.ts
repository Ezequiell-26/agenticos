import { mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ForgeOptions, SourceRepository } from "./types.js";

const execFileAsync = promisify(execFile);

export async function importRepository(
  url: string,
  options: ForgeOptions,
): Promise<SourceRepository> {
  const id = repositoryId(url);
  const target = path.resolve(options.destination, id);

  await mkdir(path.dirname(target), { recursive: true });

  const args = ["clone"];

  if (options.shallow) {
    args.push("--depth", "1");
  }

  if (options.recurseSubmodules) {
    args.push("--recurse-submodules");
  }

  if (options.ref) {
    args.push("--branch", options.ref);
  }

  args.push(url, target);

  await execFileAsync("git", args, {
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  const { stdout: commit } = await execFileAsync(
    "git",
    ["-C", target, "rev-parse", "HEAD"],
    { windowsHide: true },
  );

  return {
    id,
    url,
    ...(options.ref ? { ref: options.ref } : {}),
    localPath: target,
    licenseStatus: "unknown",
    licenseFiles: [],
    importedAt: new Date().toISOString(),
    sourceCommit: commit.trim(),
  };
}

export function repositoryId(url: string): string {
  const normalized = url
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  const last = normalized.split("/").at(-1);
  if (!last) {
    throw new Error("Could not derive repository id from URL: " + url);
  }

  return last.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}
