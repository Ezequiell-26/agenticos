#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();

async function readText(relativePath) {
  return readFile(new URL(relativePath, pathToFileURL(root + "/")), "utf8");
}

function fail(message) {
  console.error(`AGENT CONTINUITY: FAIL — ${message}`);
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
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === '"') return i + 1;
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
      if (source[i] !== ',') fail("invalid JSON array near " + path);
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
      if (seen.has(key)) fail("duplicate JSON object key '" + key + "' at " + path);
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
  if (skipWhitespace(source, end) !== source.length) fail(relativePath + " contains trailing non-JSON content");
}

function parseJson(source, relativePath) {
  assertNoDuplicateJsonKeys(source, relativePath);
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(relativePath + " is not valid JSON: " + error.message);
  }
}

async function readJson(relativePath) {
  return parseJson(await readText(relativePath), relativePath);
}

const continuity = await readJson("reference/manifests/agent-continuity.json");
const state = await readJson("reference/manifests/implementation-state.json");
const operationsRaw = await readText("reference/journal/agent-operations.jsonl");
const lines = operationsRaw.split(/\r?\n/).filter(Boolean);

if (continuity.schema_version !== 1) fail("unsupported continuity manifest schema");
if (continuity.policies.read_state_before_action !== true) fail("state-read policy disabled");
if (continuity.policies.report_before_action !== true) fail("pre-change report policy disabled");
if (continuity.policies.report_after_action !== true) fail("post-change report policy disabled");
if (continuity.policies.claims_require_evidence !== true) fail("evidence policy disabled");
if (continuity.policies.no_destructive_operations_by_default !== true) fail("destructive-change protection disabled");
if (continuity.policies.deletion_requires_snapshot !== true) fail("deletion snapshot requirement disabled");
if (continuity.policies.deletion_requires_rollback_plan !== true) fail("deletion rollback requirement disabled");
if (continuity.policies.regression_is_blocking !== true) fail("regression blocking disabled");
if (continuity.policies.duplicate_json_keys_are_blocking !== true) fail("duplicate JSON key protection disabled");
if (continuity.policies.verified_slice_does_not_equal_production_completeness !== true) fail("verified-slice semantics policy disabled");

const ids = new Set();
let lastTimestamp = "";
for (const [index, line] of lines.entries()) {
  const op = parseJson(line, `reference/journal/agent-operations.jsonl line ${index + 1}`);
  const required = continuity.required_operation_fields;
  for (const field of required) {
    if (!(field in op)) fail(`journal operation ${op.operation_id ?? "unknown"} is missing ${field}`);
  }
  if (ids.has(op.operation_id)) fail(`duplicate operation_id: ${op.operation_id}`);
  ids.add(op.operation_id);
  if (lastTimestamp && op.timestamp < lastTimestamp) fail(`journal timestamp moved backward at ${op.operation_id}`);
  lastTimestamp = op.timestamp;

  if (!Array.isArray(op.deleted)) fail(`deleted must be an array in ${op.operation_id}`);
  if (op.deleted.length > 0) {
    const auth = op.rollback?.authorized_destructive_change === true;
    const snapshot = typeof op.rollback?.point === "string" && op.rollback.point.length > 0;
    const reason = typeof op.rollback?.reason === "string" && op.rollback.reason.length > 0;
    if (!auth || !snapshot || !reason) {
      fail(`unauthorized destructive change recorded by ${op.operation_id}`);
    }
  }

  if (op.status === "completed" && (!Array.isArray(op.evidence) || op.evidence.length === 0)) {
    fail(`completed operation ${op.operation_id} has no evidence`);
  }
  if (op.status === "completed" && typeof op.next_step !== "string") {
    fail(`completed operation ${op.operation_id} has no next step`);
  }
}

const ordered = [...state.steps].sort((a, b) => a.number - b.number);
const idsForValidation = new Set(ordered.map((step) => step.id));
for (const step of ordered) {
  for (const requiredId of step.requires || []) {
    if (!idsForValidation.has(requiredId)) fail(`step ${step.id} requires unknown step ${requiredId}`);
    const required = ordered.find((candidate) => candidate.id === requiredId);
    if (step.status === "verified" && required?.status !== "verified") {
      fail(`verified step ${step.id} has unverified requirement ${requiredId}`);
    }
  }
  if (step.status === "superseded") {
    const replacement = ordered.find((candidate) => candidate.id === step.superseded_by);
    if (!replacement || replacement.status !== "verified") {
      fail(`superseded step ${step.id} has no verified replacement`);
    }
  }
}
const active = ordered.filter((step) => ["in_progress", "verifying", "correcting"].includes(step.status));
if (active.length > 1) fail("multiple implementation steps are active");

const current = ordered.find((step) => step.id === state.current_step);
if (!current) fail("current_step is not declared in implementation-state");
if (["verified", "superseded"].includes(current.status)) fail("current_step must point to an authorized non-terminal step");
if (state.control_plane?.exactly_one_current_authorized_step !== true) fail("control_plane current-step rule is disabled");
if (state.control_plane?.pending_steps_are_backlog !== true) fail("control_plane pending-backlog rule is disabled");

const scopeManifest = await readJson("reference/manifests/step-scope-policy.json");
if (scopeManifest.current_step !== current.id) fail("step-scope-policy current_step disagrees with implementation-state");
if (!scopeManifest.steps?.[current.id]) fail("current implementation step has no scope policy");

const projectState = await readText("reference/PROJECT-STATE.md");
if (!projectState.includes("## Next authorized progression")) fail("PROJECT-STATE.md has no next-step section");
if (!projectState.includes("## Verification truth")) fail("PROJECT-STATE.md has no verification-truth section");
if (!projectState.includes("## Anti-regression rule")) fail("PROJECT-STATE.md has no anti-regression section");
if (!projectState.includes("- Current implementation step: `" + current.id + "`")) {
  fail("PROJECT-STATE.md current step disagrees with implementation-state");
}
if (!projectState.includes("- Current step status: `" + current.status + "`")) {
  fail("PROJECT-STATE.md current status disagrees with implementation-state");
}

let gitStatus;
try {
  gitStatus = execFileSync("git", ["status", "--porcelain=v1"], {encoding:"utf8"}).trim();
} catch {
  gitStatus = "";
}
const untracked = gitStatus.split(/\r?\n/).filter((line) => line.startsWith("?? "));
if (continuity.policies.no_untracked_changes === true && untracked.length > 0) {
  fail("untracked files are present: " + untracked.map((line) => line.slice(3)).join(", "));
}

console.log(`AGENT CONTINUITY: PASS — ${lines.length} journal operations, ${ordered.length} implementation steps checked.`);
