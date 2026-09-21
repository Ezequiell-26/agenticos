#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = process.cwd();

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, pathToFileURL(root + "/")), "utf8"));
}

function fail(message) {
  console.error("IMPLEMENTATION SCOPE: FAIL — " + message);
  process.exit(1);
}

function globToRegExp(pattern) {
  let result = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        result += ".*";
        i += 1;
      } else {
        result += "[^/]*";
      }
    } else if (".\\+?^$()[]{}|".includes(ch)) {
      result += "\\" + ch;
    } else {
      result += ch;
    }
  }
  return new RegExp(result + "$");
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch (error) {
    fail("unable to inspect git changes: " + (error?.message ?? error));
  }
}

const state = await readJson("reference/manifests/implementation-state.json");
const scope = await readJson("reference/manifests/step-scope-policy.json");

const current = state.steps.find((step) => step.id === state.current_step);
if (!current) fail("current_step is not declared in implementation-state");
if (current.status === "verified" || current.status === "superseded") {
  fail("current_step is not an authorized implementation step");
}
if (scope.current_step !== current.id) fail("scope manifest current_step disagrees with implementation-state");

const policy = scope.steps?.[current.id];
if (!policy) fail("no scope policy exists for current step");

const baseRef = process.env.GITHUB_BASE_REF;
let changed = [];
if (baseRef) {
  changed = git(["diff", "--name-only", `origin/${baseRef}...HEAD`]).split(/\r?\n/).filter(Boolean);
} else {
  const parent = git(["rev-parse", "HEAD^"]);
  changed = git(["diff", "--name-only", parent, "HEAD"]).split(/\r?\n/).filter(Boolean);
}

const controlPlane = scope.control_plane_paths ?? [];
const allowed = [...controlPlane, ...(policy.allowed_paths ?? [])];
const violations = changed.filter((file) => !matchesAny(file, allowed));

if (violations.length > 0) {
  fail(
    "changed paths are outside the authorized current-step scope (" +
      current.id +
      "): " +
      violations.join(", "),
  );
}

console.log(
  "IMPLEMENTATION SCOPE: PASS — current=" +
    current.id +
    "; changed=" +
    changed.length +
    "; allowed_patterns=" +
    allowed.length,
);
