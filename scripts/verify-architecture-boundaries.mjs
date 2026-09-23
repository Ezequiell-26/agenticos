#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";

function fail(message) {
  console.error("ARCHITECTURE BOUNDARIES: FAIL — " + message);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("reference/manifests/architecture-dag.json", "utf8"));
const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], { encoding: "utf8" }));
const packages = metadata.packages;
const names = new Set();

for (const pkg of packages) {
  if (names.has(pkg.name)) fail("duplicate workspace package name: " + pkg.name);
  names.add(pkg.name);

  const normalized = pkg.manifest_path.replaceAll("\\", "/");
  const marker = "/crates/";
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) fail("package outside crates/: " + pkg.name);
  const relative = normalized.slice(idx + marker.length);
  if (!relative.endsWith("/Cargo.toml")) fail("malformed crate manifest: " + pkg.name);
  const cratePath = relative.slice(0, -"/Cargo.toml".length);
  if (cratePath.includes("/")) fail("nested crate manifest: " + normalized);
}

function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (!entry.isDirectory()) continue;

    const manifestPath = path + "/Cargo.toml";
    try {
      statSync(manifestPath);
      fail("nested Cargo.toml remains: " + manifestPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    scan(path);
  }
}
scan("crates");

for (const rule of manifest.critical_boundaries) {
  const pkg = packages.find((item) => item.name === rule.crate);
  if (!pkg) fail("critical crate missing: " + rule.crate);

  const firstParty = new Set(
    pkg.dependencies
      .map((dependency) => dependency.name)
      .filter((name) => name.startsWith("agenticos-")),
  );

  for (const forbidden of rule.forbidden_first_party || []) {
    if (firstParty.has(forbidden)) {
      fail(rule.crate + " -> forbidden dependency " + forbidden);
    }
  }

  for (const allowed of rule.allowed_first_party || []) {
    if (!firstParty.has(allowed)) {
      fail(rule.crate + " -> required allowed dependency missing: " + allowed);
    }
  }

  if (rule.allowed_first_party && rule.crate !== "agenticos-contracts") {
    for (const dependency of firstParty) {
      if (!rule.allowed_first_party.includes(dependency)) {
        fail(rule.crate + " -> non-canonical dependency " + dependency);
      }
    }
  }
}

console.log("ARCHITECTURE BOUNDARIES: PASS — unique workspace packages and canonical crate layout verified.");
