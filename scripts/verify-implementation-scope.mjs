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

const headBranch = process.env.GITHUB_HEAD_REF ?? "";

let violations = changed.filter((file) => !matchesAny(file, allowed));

const approvedRegression = (scope.controlled_regressions ?? []).find(
  (exception) =>
    exception.branch === headBranch &&
    exception.journal_operation_id &&
    Array.isArray(exception.paths) &&
    violations.length > 0 &&
    violations.every((file) => matchesAny(file, exception.paths)),
);

if (approvedRegression) {
  const journalSource = await readFile(
    new URL("reference/journal/agent-operations.jsonl", pathToFileURL(root + "/")),
    "utf8",
  );
  const journalEntries = journalSource
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const operation = journalEntries.find(
    (entry) => entry.operation_id === approvedRegression.journal_operation_id,
  );
  if (
    !operation ||
    operation.status !== "approved" ||
    operation.authorized_step !== current.id ||
    !Array.isArray(operation.changed_paths) ||
    operation.changed_paths.sort().join("\n") !== [...approvedRegression.paths].sort().join("\n")
  ) {
    fail("controlled regression exception is missing matching approved journal evidence");
  }
  violations = violations.filter((file) => !matchesAny(file, approvedRegression.paths));
}
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
    allowed.length +
    (approvedRegression ? "; audited_regression=PASS" : ""),
);
