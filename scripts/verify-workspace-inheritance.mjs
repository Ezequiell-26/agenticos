#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const shared = [
  "tokio","serde","serde_json","thiserror","anyhow","async-trait","tracing",
  "tracing-subscriber","futures","uuid","chrono","reqwest","sqlx","semver",
  "serde_yaml","dotenv","rand","async-stream","clap"
];

const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], { encoding: "utf8" }));
const core = metadata.packages.filter((p) =>
  ["agenticos-contracts","agenticos-brain","agenticos-kernel","agenticos-runtime","agenticos-execution","agenticos-providers","agenticos-adapters","agenticos-tools","agenticos-memory","agenticos-context","agenticos-protocols","agenticos-source-forge","agenticos-observability","agenticos-mcp","agenticos-cli","agenticos-api-server","agenticos-desktop"].includes(p.name)
);

const failures = [];
for (const pkg of core) {
  const source = readFileSync(pkg.manifest_path, "utf8");
  for (const dependency of shared) {
    const escaped = dependency.replaceAll("-", "\\-");
    const line = source.split(/\r?\n/).find((l) => new RegExp("^\\s*" + escaped + "\\s*=").test(l));
    if (line && !line.includes("workspace = true")) {
      failures.push(pkg.name + ": " + line.trim());
    }
  }
}
if (failures.length) {
  console.error("WORKSPACE INHERITANCE: FAIL");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}
console.log("WORKSPACE INHERITANCE: PASS — shared dependencies use workspace inheritance.");
