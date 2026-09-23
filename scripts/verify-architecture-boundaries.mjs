#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";

const root = process.cwd();
const fail = (m) => { console.error("ARCHITECTURE BOUNDARIES: FAIL — " + m); process.exit(1); };
const manifest = JSON.parse(readFileSync(root + "/reference/manifests/architecture-dag.json", "utf8"));
const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], { encoding: "utf8" }));
const packages = metadata.packages;
const names = new Set();

for (const pkg of packages) {
  if (names.has(pkg.name)) fail("duplicate package name: " + pkg.name);
  names.add(pkg.name);

  const normalized = pkg.manifest_path.replaceAll("\\", "/");
  const marker = "/crates/";
  const idx = normalized.lastIndexOf(marker);
  if (idx < 0) fail("package outside crates/: " + pkg.name);
  const relative = normalized.slice(idx + marker.length);
  if (!relative.endsWith("/Cargo.toml")) fail("malformed manifest: " + normalized);
  const parts = relative.slice(0, -"/Cargo.toml".length).split("/");
  if (parts.length !== 2) fail("nested crate manifest: " + normalized);
}

function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (!entry.isDirectory()) continue;
    const direct = path + "/Cargo.toml";
    try { statSync(direct); fail("crate manifest not owned by a layer: " + direct); } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    scan(path);
  }
}
scan(root + "/crates");

for (const pkg of packages) {
  const firstParty = new Set(pkg.dependencies.map(d => d.name).filter(n => n.startsWith("agenticos-")));
  const layer = pkg.manifest_path.replaceAll("\\", "/").split("/crates/")[1].split("/")[0];
  const forbiddenByLayer = {
    domain: new Set(["application","infrastructure","presentation"]),
    application: new Set(["presentation"]),
    utilities: new Set(["domain","application","presentation"])
  };
  const forbiddenLayers = forbiddenByLayer[layer] ?? new Set();

  for (const dependency of firstParty) {
    const depPkg = packages.find(p => p.name === dependency);
    if (!depPkg) fail(pkg.name + " references missing workspace package " + dependency);
    const depLayer = depPkg.manifest_path.replaceAll("\\", "/").split("/crates/")[1].split("/")[0];
    if (forbiddenLayers.has(depLayer)) fail(pkg.name + " -> " + dependency + " violates layer DAG");
  }

  if (pkg.name === "agenticos-kernel") {
    for (const forbidden of ["agenticos-providers","agenticos-tools","agenticos-mcp","agenticos-cli","agenticos-desktop","agenticos-api-server"]) {
      if (firstParty.has(forbidden)) fail("kernel -> forbidden dependency " + forbidden);
    }
  }
}

console.log("ARCHITECTURE BOUNDARIES: PASS — unique crates, canonical two-level layout and layer DAG verified.");
