#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";

const fail = (message) => {
  console.error("ARCHITECTURE BOUNDARIES: FAIL — " + message);
  process.exit(1);
};

const root = process.cwd();
const manifest = JSON.parse(readFileSync(root + "/reference/manifests/architecture-dag.json", "utf8"));
const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], { encoding: "utf8" }));
const packages = metadata.packages;
const packageNames = new Set();

for (const pkg of packages) {
  if (packageNames.has(pkg.name)) fail("duplicate workspace package name: " + pkg.name);
  packageNames.add(pkg.name);

  const normalized = pkg.manifest_path.replaceAll("\\", "/");
  const marker = "/crates/";
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) fail("workspace package is outside crates/: " + pkg.name);

  const relative = normalized.slice(idx + marker.length);
  if (!relative.endsWith("/Cargo.toml")) fail("invalid manifest path: " + normalized);
  const segments = relative.slice(0, -"/Cargo.toml".length).split("/");
  if (segments.length !== 2) fail("nested/unowned crate manifest: " + normalized);
}

function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (!entry.isDirectory()) continue;
    try {
      statSync(path + "/Cargo.toml");
      fail("crate manifest found directly below a nested directory: " + path + "/Cargo.toml");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    scan(path);
  }
}
scan(root + "/crates");

for (const pkg of packages) {
  const dependencies = pkg.dependencies.map((d) => d.name).filter((n) => n.startsWith("agenticos-"));
  const layer = pkg.manifest_path.replaceAll("\\", "/").split("/crates/")[1].split("/")[0];
  const forbidden = new Set(
    layer === "domain" ? ["application", "infrastructure", "presentation"] :
    layer === "application" ? ["presentation"] :
    layer === "utilities" ? ["domain", "application", "presentation"] : []
  );

  for (const dep of dependencies) {
    const target = packages.find((p) => p.name === dep);
    if (!target) fail(pkg.name + " references missing first-party package " + dep);
    const targetLayer = target.manifest_path.replaceAll("\\", "/").split("/crates/")[1].split("/")[0];
    if (forbidden.has(targetLayer)) fail(pkg.name + " -> " + dep + " violates layer DAG");
  }

  if (pkg.name === "agenticos-kernel") {
    for (const dep of ["agenticos-providers", "agenticos-tools", "agenticos-mcp", "agenticos-cli", "agenticos-desktop", "agenticos-api-server"]) {
      if (dependencies.includes(dep)) fail("kernel -> forbidden dependency " + dep);
    }
  }
}

console.log("ARCHITECTURE BOUNDARIES: PASS — canonical workspace, ownership and layer boundaries verified.");
