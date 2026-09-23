#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";

const fail = (message) => {
  console.error("ARCHITECTURE BOUNDARIES: FAIL — " + message);
  process.exit(1);
};

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(root + "/reference/manifests/architecture-dag.json", "utf8"),
);
const metadata = JSON.parse(
  execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], { encoding: "utf8" }),
);
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

const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));

for (const pkg of packages) {
  const normalized = pkg.manifest_path.replaceAll("\\", "/");
  const layer = normalized.split("/crates/")[1].split("/")[0];
  const dependencies = pkg.dependencies.map((d) => d.name);

  const forbidden =
    layer === "domain"
      ? new Set(["application", "infrastructure", "presentation"])
      : layer === "application"
        ? new Set(["presentation"])
        : layer === "utilities"
          ? new Set(["domain", "application", "presentation"])
          : new Set();

  for (const depName of dependencies) {
    if (!depName.startsWith("agenticos-")) continue;
    const target = packageByName.get(depName);
    if (!target) fail(pkg.name + " references missing first-party package " + depName);

    const targetPath = target.manifest_path.replaceAll("\\", "/");
    const targetLayer = targetPath.split("/crates/")[1].split("/")[0];
    if (forbidden.has(targetLayer)) {
      fail(pkg.name + " -> " + depName + " violates layer DAG");
    }
  }
}

console.log("ARCHITECTURE BOUNDARIES: PASS — canonical workspace ownership and layer boundaries verified.");
