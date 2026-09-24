#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = process.cwd();

async function readText(relativePath) {
  return readFile(new URL(relativePath, pathToFileURL(root + "/")), "utf8");
}

function fail(message) {
  console.error("PROJECT STATE: FAIL — " + message);
  process.exit(1);
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function readJsonString(source, index) {
  if (source[index] !== '"') fail("invalid JSON string while checking duplicate keys");
  let i = index + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i += 1;
  }
  fail("unterminated JSON string while checking duplicate keys");
}

function scanJsonValue(source, start, path) {
  let i = skipWhitespace(source, start);
  const ch = source[i];

  if (ch === '"') return readJsonString(source, i);
  if (ch === '[') {
    i = skipWhitespace(source, i + 1);
    if (source[i] === ']') return i + 1;
    while (true) {
      i = scanJsonValue(source, i, path + "[]");
      i = skipWhitespace(source, i);
      if (source[i] === ']') return i + 1;
      if (source[i] !== ',') fail("invalid JSON near " + path);
      i = skipWhitespace(source, i + 1);
    }
  }

  if (ch === '{') {
    const seen = new Set();
    i = skipWhitespace(source, i + 1);
    if (source[i] === '}') return i + 1;

    while (true) {
      i = skipWhitespace(source, i);
      const keyStart = i;
      i = readJsonString(source, i);
      const key = JSON.parse(source.slice(keyStart, i));
      if (seen.has(key)) {
        fail("duplicate JSON object key '" + key + "' at " + path);
      }
      seen.add(key);

      i = skipWhitespace(source, i);
      if (source[i] !== ':') fail("invalid JSON object near " + path);
      i = scanJsonValue(source, i + 1, path + "." + key);
      i = skipWhitespace(source, i);

      if (source[i] === '}') return i + 1;
      if (source[i] !== ',') fail("invalid JSON object near " + path);
      i = skipWhitespace(source, i + 1);
    }
  }

  const primitiveStart = i;
  while (i < source.length && !/[\s,\]}]/.test(source[i])) i += 1;
  if (i === primitiveStart) fail("invalid JSON value near " + path);
  return i;
}

function assertNoDuplicateJsonKeys(source, relativePath) {
  const end = scanJsonValue(source, 0, relativePath);
  if (skipWhitespace(source, end) !== source.length) {
    fail(relativePath + " contains trailing non-JSON content");
  }
}

async function readJson(relativePath) {
  const source = await readText(relativePath);
  assertNoDuplicateJsonKeys(source, relativePath);
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(relativePath + " is not valid JSON: " + error.message);
  }
}

const state = await readJson("reference/manifests/implementation-state.json");
const projectState = await readText("reference/PROJECT-STATE.md");

if (state.schema_version !== 2) fail("unsupported implementation-state schema");
if (state.mode !== "capability-driven-continuous") fail("implementation-state is not using capability-driven mode");
if (!state.policy || state.policy.sequential_implementation !== false || state.policy.parallel_workstreams_allowed !== true || state.policy.capability_level_verification !== true || state.policy.evidence_required_for_verified_status !== true || state.policy.regression_is_blocking !== true) {
  fail("capability-driven implementation policy is incomplete or unsafe");
}
if (!state.current_operation || typeof state.current_operation.id !== "string" || typeof state.current_operation.status !== "string") fail("current_operation is missing or malformed");
if (!Array.isArray(state.workstreams) || state.workstreams.length < 3) fail("implementation-state has fewer than three workstreams");
if (!Array.isArray(state.capabilities) || state.capabilities.length < 3) fail("implementation-state has fewer than three capabilities");
if (!Array.isArray(state.backlog)) fail("implementation-state backlog is missing");

const workstreamIds = new Set();
const validWorkstreamStatuses = new Set(["planned", "in_progress", "verifying", "blocked", "completed"]);
for (const workstream of state.workstreams) {
  if (!workstream || typeof workstream.id !== "string" || workstream.id.trim() === "") fail("workstream id must be a non-empty string");
  if (workstreamIds.has(workstream.id)) fail("duplicate workstream id: " + workstream.id);
  workstreamIds.add(workstream.id);
  if (!validWorkstreamStatuses.has(workstream.status)) fail("invalid workstream status for " + workstream.id);
  if (!["P0", "P1", "P2", "P3"].includes(workstream.priority)) fail("invalid priority for " + workstream.id);
}

const validCapabilityStatuses = new Set(["planned", "in_progress", "implemented-unverified", "verified", "verified-historical", "blocked"]);
const capabilityIds = new Set();
for (const capability of state.capabilities) {
  if (!capability || typeof capability.id !== "string" || capability.id.trim() === "") fail("capability id must be a non-empty string");
  if (capabilityIds.has(capability.id)) fail("duplicate capability id: " + capability.id);
  capabilityIds.add(capability.id);
  if (!validCapabilityStatuses.has(capability.status)) fail("invalid capability status for " + capability.id);
  if (capability.status === "verified" && !Array.isArray(capability.verification_evidence) && !state.verification) {
    fail("verified capability " + capability.id + " has no evidence boundary");
  }
}

if (!state.workstreams.some((workstream) => workstream.status === "in_progress")) fail("no active workstream remains");
if (!Array.isArray(state.verification?.required_checks) || state.verification.required_checks.length === 0) fail("verification checks are missing");
if (state.verification.ci_pending !== true && state.verification.ci_pending !== false) fail("verification.ci_pending must be boolean");
if (!projectState.includes("## Active workstreams")) fail("PROJECT-STATE.md has no active workstreams section");
if (!projectState.includes("## Verification truth")) fail("PROJECT-STATE.md has no verification-truth section");
if (!projectState.includes("## Anti-regression rule")) fail("PROJECT-STATE.md has no anti-regression section");
if (!projectState.includes("- Current focus: " + state.current_operation.focus)) fail("PROJECT-STATE.md current focus disagrees with implementation-state");
if (!projectState.includes("- Current operation status: " + state.current_operation.status)) fail("PROJECT-STATE.md current status disagrees with implementation-state");

console.log(
  "PROJECT STATE: PASS — capability-driven mode; workstreams=" +
    state.workstreams.length +
    "; capabilities=" +
    state.capabilities.length +
    "; active=" +
    state.workstreams.filter((workstream) => ["in_progress", "verifying"].includes(workstream.status)).length,
);
