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
  const normalizedUrl = normalizeRepositoryUrl(url);
  const id = repositoryId(normalizedUrl);
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

  args.push(normalizedUrl, target);

  await execFileAsync("git", args, {
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });

  const { stdout: commit } = await execFileAsync(
    "git",
    ["-C", target, "rev-parse", "HEAD"],
    { windowsHide: true },
  );

  const sourceCommit = commit.trim();
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error("Imported repository did not resolve to a full Git commit.");
  }

  return {
    id,
    url: normalizedUrl,
    ...(options.ref ? { ref: options.ref } : {}),
    localPath: target,
    licenseStatus: "unknown",
    licenseFiles: [],
    importedAt: new Date().toISOString(),
    sourceCommit,
  };
}

export function normalizeRepositoryUrl(url: string): string {
  const value = url.trim();

  if (!value) {
    throw new Error("Repository URL cannot be empty.");
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("ssh://")
  ) {
    const parsed = new URL(value);
    if (!parsed.hostname || parsed.username || parsed.password || parsed.hash) {
      throw new Error("Repository URL contains unsupported or embedded credential data.");
    }

    if (!["http:", "https:", "ssh:"].includes(parsed.protocol)) {
      throw new Error("Repository URL protocol is not supported.");
    }

    return value.replace(/\/$/, "").replace(/\.git$/, "");
  }

  if (/^[^\s@]+@[^\s:]+:[^\s]+$/.test(value)) {
    return value.replace(/\.git$/, "");
  }

  throw new Error("Repository URL must be an HTTPS, HTTP, SSH URL or scp-style Git URL.");
}

export function repositoryId(url: string): string {
  const normalized = normalizeRepositoryUrl(url);

  let identity: string;
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("ssh://")
  ) {
    const parsed = new URL(normalized);
    identity = parsed.hostname + parsed.pathname;
  } else {
    const [host, repositoryPath = ""] = normalized.split(":", 2);
    identity = host + "/" + repositoryPath;
  }

  const parts = identity
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"));

  if (parts.length < 2) {
    throw new Error("Could not derive a stable repository id from URL: " + url);
  }

  return parts.join("--");
}
