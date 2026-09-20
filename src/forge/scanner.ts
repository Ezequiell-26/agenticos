import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ComponentCandidate,
  LicenseStatus,
  ScanResult,
  SourceRepository,
} from "./types.js";

const LICENSE_NAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "COPYING",
  "COPYING.md",
];

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".kt", ".cpp", ".cc", ".h", ".hpp",
]);

const CATEGORY_RULES: ReadonlyArray<{
  category: ComponentCandidate["category"];
  keywords: readonly string[];
}> = [
  { category: "model-provider", keywords: ["provider", "llm", "model", "inference"] },
  { category: "agent", keywords: ["agent", "agentloop", "controller"] },
  { category: "tool", keywords: ["tool", "function", "command"] },
  { category: "memory", keywords: ["memory", "context", "retrieval", "vector"] },
  { category: "workflow", keywords: ["workflow", "task", "pipeline", "scheduler"] },
  { category: "orchestration", keywords: ["orchestrat", "router", "planner", "graph"] },
  { category: "sandbox", keywords: ["sandbox", "runtime", "container", "docker"] },
  { category: "browser", keywords: ["browser", "playwright", "puppeteer", "cdp"] },
  { category: "api", keywords: ["api", "server", "gateway", "http", "rpc"] },
  { category: "testing", keywords: ["test", "eval", "benchmark"] },
  { category: "ui", keywords: ["ui", "web", "desktop", "frontend", "tui"] },
];

export async function scanRepository(
  repository: SourceRepository,
): Promise<ScanResult> {
  const warnings: string[] = [];
  const licenseFiles = await findLicenseFiles(repository.localPath);
  const licenseStatus = await detectLicense(repository.localPath, licenseFiles);

  if (licenseStatus !== "verified-mit") {
    warnings.push(
      "The repository is not proven MIT-only by this scanner. Do not copy components into the first-party tree without license review.",
    );
  }

  const files = await walk(repository.localPath);
  const candidates = classifyCandidates(
    repository.id,
    files.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())),
  );

  return {
    repository: {
      ...repository,
      licenseStatus,
      licenseFiles,
    },
    candidates,
    warnings,
  };
}

async function findLicenseFiles(root: string): Promise<string[]> {
  const result: string[] = [];

  for (const name of LICENSE_NAMES) {
    try {
      await readFile(path.join(root, name), "utf8");
      result.push(name);
    } catch {
      // Ignore missing files.
    }
  }

  return result;
}

async function detectLicense(
  root: string,
  files: readonly string[],
): Promise<LicenseStatus> {
  if (files.length === 0) {
    return "unknown";
  }

  let sawMit = false;
  let sawOther = false;

  for (const file of files) {
    const content = (await readFile(path.join(root, file), "utf8")).toLowerCase();

    if (content.includes("mit license") || content.includes("the mit license")) {
      sawMit = true;
    } else {
      sawOther = true;
    }
  }

  if (sawMit && sawOther) {
    return "mixed";
  }

  return sawMit ? "verified-mit" : "non-mit";
}

async function walk(
  root: string,
  current = root,
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".venv" ||
      entry.name === "venv" ||
      entry.name === "dist" ||
      entry.name === "build"
    ) {
      continue;
    }

    const absolute = path.join(current, entry.name);

    if (entry.isDirectory()) {
      result.push(...await walk(root, absolute));
    } else {
      result.push(path.relative(root, absolute));
    }
  }

  return result;
}

function classifyCandidates(
  sourceId: string,
  files: readonly string[],
): ComponentCandidate[] {
  return files.map((file) => {
    const normalized = file.toLowerCase();
    const matches = CATEGORY_RULES.flatMap((rule) =>
      rule.keywords
        .filter((keyword) => normalized.includes(keyword))
        .map(() => rule.category),
    );

    const category = matches[0] ?? "other";
    const uniqueMatches = [...new Set(matches)];
    const score = Math.min(100, 35 + uniqueMatches.length * 15);

    return {
      sourceId,
      path: file,
      category,
      decision: category === "other" ? "reference" : "adapt",
      reasons: uniqueMatches.length
        ? ["Path matches capability keywords: " + uniqueMatches.join(", ")]
        : ["No capability keyword match; keep as reference until reviewed."],
      score,
    };
  });
}
