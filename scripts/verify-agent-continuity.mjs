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

function skipLegacyJournalSeparator(source, index) {
  let cursor = skipWhitespace(source, index);
  if (source[cursor] === "\\" && source[cursor + 1] === "n") {
    cursor += 2;
    cursor = skipWhitespace(source, cursor);
  }
  return cursor;
}

function parseJournalEntries(source) {
  const entries = [];
  let cursor = 0;
  let ordinal = 0;

  while (true) {
    cursor = skipLegacyJournalSeparator(source, cursor);
    if (cursor >= source.length) break;

    const start = cursor;
    const end = scanJsonValue(source, start, `reference/journal/agent-operations.jsonl entry ${ordinal + 1}`);
    const raw = source.slice(start, end);
    let op;
    try {
      op = JSON.parse(raw);
    } catch (error) {
      fail(`reference/journal/agent-operations.jsonl entry ${ordinal + 1} is not valid JSON: ${error.message}`);
    }

    entries.push({
      op,
      lineNumber: source.slice(0, start).split(/\r?\n/).length,
    });
    cursor = end;
    ordinal += 1;
  }

  return entries;
}

const journalEntries = parseJournalEntries(operationsRaw);

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

// The strict journal schema was introduced at a concrete append-only operation.
// Earlier records may use their historical schema; records from this operation
// onward must satisfy the current required fields and evidence contract.
const EVIDENCE_POLICY_FIRST_OPERATION = "ci-error-repair-rustfmt-continuity-2026-09-24";

const ids = new Set();
let strictJournalSchemaActive = false;

for (const { op, lineNumber } of journalEntries) {
  const modern = op.schema_version === 1;
  const operationId = String(op.operation_id ?? op.operation ?? `legacy-line-${lineNumber}`).trim();

  if (typeof op.timestamp !== "string" || Number.isNaN(Date.parse(op.timestamp))) {
    fail(`journal operation ${operationId} has an invalid timestamp`);
  }

  if (operationId === EVIDENCE_POLICY_FIRST_OPERATION) {
    strictJournalSchemaActive = true;
  }

  if (modern) {
    const required = continuity.required_operation_fields;
    const fieldAliases = { risks: ["risks", "risk"] };

    for (const field of required) {
      if (!strictJournalSchemaActive && !(field in op)) continue;
      const aliases = fieldAliases[field] ?? [field];
      if (!aliases.some((alias) => alias in op)) {
        fail(`journal operation ${operationId} is missing ${field}`);
      }
    }
  } else if (strictJournalSchemaActive) {
    fail(`legacy journal operation ${operationId} appears after strict schema migration`);
  } else {
    // Historical entries predate schema_version=1. Preserve them and validate
    // only the fields needed to keep their identity and status readable.
    if (typeof op.status !== "string") fail(`legacy journal operation ${operationId} has no status`);
  }

  if (ids.has(operationId)) fail(`duplicate operation_id: ${operationId}`);
  ids.add(operationId);

  if (!strictJournalSchemaActive) {
    if (op.status === "completed" && typeof op.next_step !== "string") {
      fail(`historical completed operation ${operationId} has no next step`);
    }
    continue;
  }

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

    if (op.status === "completed" && (!Array.isArray(op.evidence) || op.evidence.length === 0)) {
      fail(`completed operation ${operationId} has no evidence (strict schema begins at ${EVIDENCE_POLICY_FIRST_OPERATION})`);
    }
    if (op.status === "completed" && typeof op.next_step !== "string") {
      fail(`completed operation ${operationId} has no next step`);
    }
  }
}

if (!strictJournalSchemaActive) {
  fail(`strict journal schema migration operation ${EVIDENCE_POLICY_FIRST_OPERATION} was not found`);
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
