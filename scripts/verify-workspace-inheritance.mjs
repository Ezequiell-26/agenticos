#!/usr/bin/env node
import { readFileSync } from "node:fs";

const files = [
  "crates/domain/contracts/Cargo.toml",
  "crates/domain/brain/Cargo.toml",
  "crates/application/agents/Cargo.toml",
  "crates/application/execution/Cargo.toml",
  "crates/application/scheduler/Cargo.toml",
  "crates/application/workflows/Cargo.toml",
  "crates/application/projects/Cargo.toml",
  "crates/application/skills/Cargo.toml",
  "crates/infrastructure/kernel/Cargo.toml",
  "crates/infrastructure/providers/Cargo.toml",
  "crates/infrastructure/tools/Cargo.toml",
  "crates/infrastructure/memory/Cargo.toml",
  "crates/infrastructure/context/Cargo.toml",
  "crates/infrastructure/protocols/Cargo.toml",
  "crates/infrastructure/source-forge/Cargo.toml",
  "crates/infrastructure/observability/Cargo.toml",
  "crates/infrastructure/adapters/Cargo.toml",
  "crates/infrastructure/mcp/Cargo.toml",
  "crates/presentation/cli/Cargo.toml",
  "crates/presentation/api-server/Cargo.toml",
  "crates/presentation/desktop/Cargo.toml"
];

const dependencyNames = [
  "tokio","serde","serde_json","thiserror","anyhow","async-trait","tracing",
  "tracing-subscriber","futures","uuid","chrono","reqwest","sqlx","semver",
  "serde_yaml","dotenv","rand","async-stream","clap"
];

const bad = [];
for (const path of files) {
  const source = readFileSync(path, "utf8");
  for (const dependency of dependencyNames) {
    const line = source.split(/\r?\n/).find(l => new RegExp("^\\s*" + dependency.replace("-", "\\-") + "\\s*=").test(l));
    if (!line) continue;
    if (!line.includes("workspace = true")) bad.push(path + ": " + line.trim());
  }
}

if (bad.length) {
  console.error("WORKSPACE INHERITANCE: FAIL");
  for (const item of bad) console.error(" - " + item);
  process.exit(1);
}
console.log("WORKSPACE INHERITANCE: PASS — shared dependencies are inherited from the workspace.");
