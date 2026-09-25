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
  execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], {
    encoding: "utf8",
  }),
);

const packages = metadata.packages;
const workspaceMemberIds = new Set(metadata.workspace_members);
const packageNames = new Set();

const layers = new Set(Object.keys(manifest.layers));

function normalize(path) {
  return path.replaceAll("\\", "/");
}

function relativeCratePath(manifestPath) {
  const normalized = normalize(manifestPath);
  const marker = "/crates/";
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) fail("workspace package is outside crates/: " + normalized);
  return normalized.slice(idx + 1);
}

function packageLayer(pkg) {
  const relative = relativeCratePath(pkg.manifest_path);
  const segments = relative.split("/");
  if (segments.length !== 4 || segments[0] !== "crates" || segments[3] !== "Cargo.toml") {
    fail("crate must use crates/<layer>/<crate>/Cargo.toml: " + relative);
  }
  const layer = segments[1];
  const crateName = segments[2];
  if (!layers.has(layer)) fail("crate uses an unknown canonical layer: " + relative);
  return { layer, crateName, relative };
}

function collectCargoManifests(rootPath) {
  const manifests = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name === "Cargo.toml") {
        manifests.push(normalize(fullPath));
      }
    }
  }
  walk(rootPath);
  return manifests;
}

for (const pkg of packages) {
  if (packageNames.has(pkg.name)) {
    fail("duplicate workspace package name: " + pkg.name);
  }
  packageNames.add(pkg.name);

  const { layer, crateName, relative } = packageLayer(pkg);
  if (!workspaceMemberIds.has(pkg.id)) {
    fail("crate is a path dependency but not an explicit workspace member: " + relative);
  }
  if (!manifest.layers[layer]?.includes(crateName)) {
    fail(
      "crate is missing from architecture-dag.json layer '" +
        layer +
        "': " +
        relative,
    );
  }
}

const actualManifestPaths = collectCargoManifests(join(root, "crates"));
const actualRelativePaths = new Set(
  actualManifestPaths.map((path) =>
    path.replace(normalize(root) + "/", ""),
  ),
);

const workspaceMemberPackages = packages.filter((pkg) =>
  workspaceMemberIds.has(pkg.id),
);
const expectedRelativePaths = new Set(
  workspaceMemberPackages.map((pkg) => relativeCratePath(pkg.manifest_path)),
);

for (const relative of actualRelativePaths) {
  if (!expectedRelativePaths.has(relative)) {
    fail("Cargo.toml is not a registered workspace member: " + relative);
  }
}

for (const relative of expectedRelativePaths) {
  if (!actualRelativePaths.has(relative)) {
    fail("workspace member manifest is missing from filesystem: " + relative);
  }
}

if (actualRelativePaths.size !== expectedRelativePaths.size) {
  fail(
    "workspace manifest count mismatch: filesystem=" +
      actualRelativePaths.size +
      " workspace-members=" +
      expectedRelativePaths.size,
  );
}

for (const pkg of workspaceMemberPackages) {
  const { layer } = packageLayer(pkg);
  const dependencies = pkg.dependencies.map((dependency) => dependency.name);

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
    const target = packages.find((candidate) => candidate.name === depName);
    if (!target) fail(pkg.name + " references missing first-party package " + depName);
    if (!workspaceMemberIds.has(target.id)) {
      fail(pkg.name + " references non-workspace first-party package " + depName);
    }

    const targetLayer = packageLayer(target).layer;
    if (forbidden.has(targetLayer)) {
      fail(
        pkg.name +
          " -> " +
          depName +
          " violates layer DAG (" +
          layer +
          " -> " +
          targetLayer +
          ")",
      );
    }
  }
}

const crateNamesByLayer = new Map(
  Object.entries(manifest.layers).map(([layer, names]) => [layer, new Set(names)]),
);
for (const [layer, names] of crateNamesByLayer) {
  for (const name of names) {
    if (!expectedRelativePaths.has("crates/" + layer + "/" + name + "/Cargo.toml")) {
      fail(
        "architecture-dag.json declares a non-existent implemented crate: " +
          layer +
          "/" +
          name,
      );
    }
  }
}

console.log(
  "ARCHITECTURE BOUNDARIES: PASS — explicit workspace ownership, canonical layer membership and dependency direction verified.",
);
