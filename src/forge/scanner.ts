import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ComponentCandidate,
  LicenseStatus,
  ScanResult,
  SourceRepository,
} from "./types.js";

const LICENSE_NAMES = new Set([
  "license",
  "license.md",
  "license.txt",
  "copying",
  "copying.md",
]);

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
  const files = await walk(repository.localPath);
  const licenseFiles = files
    .filter(isLicenseFile)
    .sort((a, b) => a.localeCompare(b));

  const licenseStatus = await detectLicense(
    repository.localPath,
    licenseFiles,
    files,
  );

  if (licenseStatus !== "verified-mit") {
    warnings.push(
      "MIT-only status was not proven. Components must remain reference-only until license and dependency review is complete.",
    );
  }

  const candidates = classifyCandidates(
    repository.id,
    files.filter((file) =>
      SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase()),
    ),
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

async function detectLicense(
  root: string,
  licenseFiles: readonly string[],
  files: readonly string[],
): Promise<LicenseStatus> {
  if (licenseFiles.length === 0) {
    return "unknown";
  }

  const rootLicenses = licenseFiles.filter(
    (file) => !file.includes("/") && !file.includes("\\"),
  );

  if (rootLicenses.length !== 1) {
    return "review-required";
  }

  const rootLicense = rootLicenses[0];
  if (!rootLicense) {
    return "review-required";
  }

  const content = (
    await readFile(path.join(root, rootLicense), "utf8")
  ).toLowerCase();

  const hasMitBody =
    content.includes("permission is hereby granted, free of charge") &&
    content.includes('the software is provided "as is"') &&
    content.includes("permission is hereby granted");

  if (!hasMitBody) {
    return "non-mit";
  }

  const manifestLicenses = await inspectManifestLicenses(
    root,
    files,
  );

  if (
    manifestLicenses.some(
      (license) => license !== undefined && license !== "MIT",
    )
  ) {
    return "mixed";
  }

  if (
    manifestLicenses.length === 0 ||
    manifestLicenses.every((license) => license === undefined || license === "MIT")
  ) {
    return "verified-mit";
  }

  return "review-required";
}

async function inspectManifestLicenses(
  root: string,
  files: readonly string[],
): Promise<readonly (string | undefined)[]> {
  const candidates = files.filter((file) =>
    ["package.json", "pyproject.toml", "Cargo.toml"].includes(
      path.basename(file).toLowerCase(),
    ),
  );

  const licenses: (string | undefined)[] = [];

  for (const file of candidates) {
    const fullPath = path.join(root, file);
    if (file.toLowerCase().endsWith("package.json")) {
      try {
        const parsed = JSON.parse(await readFile(fullPath, "utf8")) as {
          license?: string | { type?: string };
        };
        licenses.push(
          typeof parsed.license === "string"
            ? parsed.license
            : parsed.license?.type,
        );
      } catch {
        return ["invalid"];
      }
      continue;
    }

    const content = (await readFile(fullPath, "utf8")).toLowerCase();
    const match = content.match(/(?:^|\n)\s*license\s*=\s*["']([^"']+)["']/);
    licenses.push(match?.[1]?.toUpperCase());
  }

  return licenses;
}

function isLicenseFile(file: string): boolean {
  return LICENSE_NAMES.has(path.basename(file).toLowerCase());
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
      entry.name === "build" ||
      entry.name === ".next"
    ) {
      continue;
    }

    const absolute = path.join(current, entry.name);

    if (entry.isDirectory()) {
      result.push(...await walk(root, absolute));
    } else {
      result.push(
        path.relative(root, absolute).replaceAll(path.sep, "/"),
      );
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
