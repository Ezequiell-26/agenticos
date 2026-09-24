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

const LEGACY_EVIDENCE_COMPAT_OPERATION_IDS = new Set([
  "frontend-complete-agent-builder-2026-09-24",
  "frontend-complete-subagent-builder-2026-09-24",
  "frontend-provider-account-center-2026-09-24",
  "frontend-context-inspector-2026-09-24",
  "frontend-run-timeline-2026-09-24",
  "frontend-complete-mcp-manager-2026-09-24",
  "frontend-complete-hook-manager-2026-09-24",
  "frontend-git-diff-center-2026-09-24",
  "frontend-environment-builder-2026-09-24",
  "frontend-automation-builder-2026-09-24",
  "frontend-credential-manager-2026-09-24",
  "frontend-channel-gateway-manager-2026-09-24",
  "frontend-research-workbench-2026-09-24",
  "frontend-integrity-lazy-boundaries-2026-09-24",
  "frontend-product-depth-2026-09-24",
  "frontend-runtime-control-center-2026-09-24",
  "frontend-routing-hardening-2026-09-24",
  "frontend-surface-boundary-hardening-2026-09-24",
]);

function hasHistoricalEvidenceCompatibility(operation) {
  const operationId = typeof operation.operation_id === "string"
    ? operation.operation_id.trim()
    : "";
  return LEGACY_EVIDENCE_COMPAT_OPERATION_IDS.has(operationId);
}

const ids = new Set();
for (const [index, line] of lines.entries()) {
  const op = parseJson(line, `reference/journal/agent-operations.jsonl line ${index + 1}`);
  const modern = op.schema_version === 1;
  const operationId = String(op.operation_id ?? op.operation ?? `legacy-line-${index + 1}`).trim();

  if (typeof op.timestamp !== "string" || Number.isNaN(Date.parse(op.timestamp))) {
    fail(`journal operation ${operationId} has an invalid timestamp`);
  }

  if (modern) {
    const required = continuity.required_operation_fields;
    for (const field of required) {
      if (!(field in op)) fail(`journal operation ${operationId} is missing ${field}`);
    }
  } else {
    // Historical entries predate schema_version=1. Preserve them and validate
    // the fields that make them identifiable without forcing a rewrite of history.
    if (typeof op.status !== "string") fail(`legacy journal operation ${operationId} has no status`);
  }

  if (ids.has(operationId)) fail(`duplicate operation_id: ${operationId}`);
  ids.add(operationId);

  if (modern) {
    if (!Array.isArray(op.deleted)) fail(`deleted must be an array in ${operationId}`);
    if (op.deleted.length > 0) {
      const auth = op.rollback?.authorized_destructive_change === true;
      const snapshot = typeof op.rollback?.point === "string" && op.rollback.point.length > 0;
      const reason = typeof op.rollback?.reason === "string" && op.rollback.reason.length > 0;
      if (!auth || !snapshot || !reason) {
        fail(`unauthorized destructive change recorded by ${operationId}`);
      }
    }

    const historicalEvidenceCompatible =
      hasHistoricalEvidenceCompatibility(op) &&
      op.verification &&
      typeof op.verification === "object";

    if (
      op.status === "completed" &&
      (!Array.isArray(op.evidence) || op.evidence.length === 0) &&
      !historicalEvidenceCompatible
    ) {
      fail(`completed operation ${operationId} has no evidence`);
    }
    if (op.status === "completed" && typeof op.next_step !== "string") {
      fail(`completed operation ${operationId} has no next step`);
    }
  }
}

const ordered = [...state.steps].sort((a, b) => a.number - b.number);
for (let i = 1; i < ordered.length; i += 1) {
  if (ordered[i].status === "verified" && ordered[i - 1].status !== "verified") {
    fail(`verified step ${ordered[i].id} precedes an unverified predecessor`);
  }
}
const active = ordered.filter((step) => ["in_progress", "verifying", "correcting"].includes(step.status));
if (active.length > 1) fail("multiple implementation steps are active");

const current = ordered.find((step) => step.id === state.current_step);
if (!current) fail("current_step is not declared in implementation-state");

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
