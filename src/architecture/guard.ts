import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { AgentiCOSError } from "./errors.js";

const FORBIDDEN_PATTERNS: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  {
    pattern: /from\s+["'][^"']*src\/providers(?:\/|["'])/,
    reason: "Non-provider modules must not import provider implementations directly.",
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

const DOMAIN_DIRS: Readonly<Record<string, string>> = {
  providers: "providers",
  forge: "forge",
  architecture: "architecture",
};

export interface GuardIssue {
  readonly file: string;
  readonly reason: string;
}

export async function scanArchitecture(root = process.cwd()): Promise<readonly GuardIssue[]> {
  const issues: GuardIssue[] = [];
  const sourceRoot = path.join(root, "src");

  for (const file of await walk(sourceRoot)) {
    if (!file.endsWith(".ts")) continue;
    const content = await readFile(file, "utf8");
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    const domain = relative.split("/")[1] ?? "";

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(content) && domain !== "providers") {
        issues.push({ file: relative, reason: rule.reason });
      }
    }

    if (domain && DOMAIN_DIRS[domain] && content.includes('"/src/')) {
      issues.push({
        file: relative,
        reason: "Absolute /src imports are prohibited; use package/domain contracts.",
      });
    }
  }

  return issues;
}

export async function assertArchitecture(root = process.cwd()): Promise<void> {
  const issues = await scanArchitecture(root);
  if (issues.length === 0) return;

  const message = issues.map((issue) => issue.file + ": " + issue.reason).join("\n");
  throw new AgentiCOSError(
    "Architecture guard failed.\n" + message,
    {
      code: "ARCHITECTURE_GUARD_FAILED",
      category: "VALIDATION",
      severity: "critical",
    },
  );
}

async function walk(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      result.push(...await walk(root, absolute));
    } else {
      result.push(absolute);
    }
  }

  return result;
}
