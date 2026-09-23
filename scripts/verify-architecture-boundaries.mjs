#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

const layers = new Set(Object.keys(manifest.layers));
const legacyRootCrates = new Set([
  "artifacts",
  "context",
  "plugins",
  "projects",
  "router",
  "skills",
  "interface",
]);

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
  const layer = segments[0];

  if (!layers.has(layer) && !legacyRootCrates.has(layer)) {
    fail("crate is not assigned to a canonical layer or explicit legacy bridge: " + normalized);
  }
}


const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));

function packageLayer(pkg) {
  const normalized = pkg.manifest_path.replaceAll("\\", "/");
  const relative = normalized.split("/crates/")[1];
  const first = relative.split("/")[0];
  return layers.has(first) ? first : "invalid";
}

function collectCargoManifests(rootPath) {
  const manifests = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === "Cargo.toml") {
        manifests.push(fullPath.replaceAll("\\", "/"));
      }
    }
  }

  walk(rootPath);
  return manifests;
}

const expectedManifestPaths = new Set(
  packages.map((pkg) => pkg.manifest_path.replaceAll("\\", "/").replace(/^.*?(?=crates\/)/, "")),
);
const actualManifestPaths = collectCargoManifests(join(root, "crates"));
for (const manifestPath of actualManifestPaths) {
  const relative = manifestPath.replace(root.replaceAll("\\", "/") + "/", "");
  const segments = relative.split("/");
  if (segments.length !== 4 || segments[0] !== "crates" || segments[3] !== "Cargo.toml") {
    fail("nested or legacy Cargo.toml detected: " + relative);
  }
  if (!expectedManifestPaths.has(relative)) {
    fail("Cargo.toml is not registered as a workspace package: " + relative);
  }
}

if (actualManifestPaths.length !== packages.length) {
  fail(
    "workspace manifest count mismatch: metadata=" +
      packages.length +
      " filesystem=" +
      actualManifestPaths.length,
  );
}

for (const pkg of packages) {
  const layer = packageLayer(pkg);
  const dependencies = pkg.dependencies.map((d) => d.name);

  const forbidden =
    layer === "domain"
      ? new Set(["application", "infrastructure", "presentation"])
      : layer === "application"
        ? new Set(["presentation"])
        : layer === "utilities"
          ? new Set(["domain", "application", "presentation"])
          : new Set();

  if (layer === "invalid") {
    fail("workspace package is outside canonical layers: " + pkg.manifest_path);
  }

  for (const depName of dependencies) {
    if (!depName.startsWith("agenticos-")) continue;
    const target = packageByName.get(depName);
    if (!target) fail(pkg.name + " references missing first-party package " + depName);

    const targetLayer = packageLayer(target);
    if (forbidden.has(targetLayer)) {
      fail(pkg.name + " -> " + depName + " violates layer DAG (" + layer + " -> " + targetLayer + ")");
    }
  }
}

console.log(
  "ARCHITECTURE BOUNDARIES: PASS — workspace ownership, canonical layers, legacy bridges and layer boundaries verified.",
);
