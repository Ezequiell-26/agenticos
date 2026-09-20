import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AgentiCOSError } from "./errors.js";

const COMPOSITION_ROOTS = new Set([
  "src/cli.ts",
  "src/forge-cli.ts",
  "src/architecture-cli.ts",
  "src/index.ts",
]);

const FORBIDDEN_PATTERNS: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  {
    pattern: /from\s+["'][^"']*(?:^|\/)providers(?:\/|["'])/m,
    reason: "Non-composition modules must not import provider implementations directly.",
  },
  {
    pattern: /from\s+["'][^"']*node_modules(?:\/|["'])/,
    reason: "Source code must not hard-code node_modules paths.",
  },
  {
    pattern: /process\.env\[[^\]]+\]\s*=/,
    reason: "Secrets/configuration must not be mutated through process.env.",
  },
];

export interface GuardIssue {
  readonly file: string;
  readonly reason: string;
}

export async function scanArchitecture(root = process.cwd()): Promise<readonly GuardIssue[]> {
  const issues: GuardIssue[] = [];
  const sourceRoot = path.join(root, "src");

  for (const file of await walk(sourceRoot)) {
    if (!file.endsWith(".ts")) continue;
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    if (relative === "src/architecture/guard.ts") continue;

    const content = await readFile(file, "utf8");
    const isCompositionRoot = COMPOSITION_ROOTS.has(relative);

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(content) && !isCompositionRoot && !relative.startsWith("src/providers/")) {
        issues.push({ file: relative, reason: rule.reason });
      }
    }

  }

  return issues;
}

export async function assertArchitecture(root = process.cwd()): Promise<void> {
  const issues = await scanArchitecture(root);
  if (issues.length === 0) return;

  const message = issues.map((issue) => issue.file + ": " + issue.reason).join("\n");
  throw new AgentiCOSError("Architecture guard failed.\n" + message, {
    code: "ARCHITECTURE_GUARD_FAILED",
    category: "VALIDATION",
    severity: "critical",
  });
}

async function walk(root: string, current = root): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    throw new AgentiCOSError("Architecture guard could not read source tree.", {
      code: "ARCHITECTURE_SCAN_FAILED",
      category: "VALIDATION",
      severity: "critical",
      cause: error,
    });
  }

  const result: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build" || entry.name === ".git") continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await walk(root, absolute));
    else result.push(absolute);
  }

  return result;
}
