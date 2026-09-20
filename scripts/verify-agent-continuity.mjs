#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = process.cwd();

async function readJson(relativePath) {
  const raw = await readFile(new URL(relativePath, `file://${root.replace(/\\\\/g, "/")}/`), "utf8");
  return JSON.parse(raw);
}

function fail(message) {
  console.error(`AGENT CONTINUITY: FAIL — ${message}`);
  process.exit(1);
}

const continuity = await readJson("reference/manifests/agent-continuity.json");
const state = JSON.parse(await readFile("reference/manifests/implementation-state.json", "utf8"));
const operationsRaw = await readFile("reference/journal/agent-operations.jsonl", "utf8");
const lines = operationsRaw.split(/\\r?\\n/).filter(Boolean);

if (continuity.schema_version !== 1) fail("unsupported continuity manifest schema");
if (continuity.policies.read_state_before_action !== true) fail("state-read policy disabled");
if (continuity.policies.report_before_action !== true) fail("pre-change report policy disabled");
if (continuity.policies.report_after_action !== true) fail("post-change report policy disabled");
if (continuity.policies.claims_require_evidence !== true) fail("evidence policy disabled");
if (continuity.policies.no_destructive_operations_by_default !== true) fail("destructive-change protection disabled");
if (continuity.policies.deletion_requires_snapshot !== true) fail("deletion snapshot requirement disabled");
if (continuity.policies.deletion_requires_rollback_plan !== true) fail("deletion rollback requirement disabled");
if (continuity.policies.regression_is_blocking !== true) fail("regression blocking disabled");

const ids = new Set();
let lastTimestamp = "";
for (const [index, line] of lines.entries()) {
  let op;
  try { op = JSON.parse(line); } catch { fail(`journal line ${index + 1} is invalid JSON`); }
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
for (let i = 1; i < ordered.length; i += 1) {
  if (ordered[i].status === "verified" && ordered[i - 1].status !== "verified") {
    fail(`verified step ${ordered[i].id} precedes an unverified predecessor`);
  }
}
const active = ordered.filter((step) => ["in_progress", "verifying", "correcting"].includes(step.status));
if (active.length > 1) fail("multiple implementation steps are active");

const projectState = await readFile("reference/PROJECT-STATE.md", "utf8");
if (!projectState.includes("## Next authorized progression")) fail("PROJECT-STATE.md has no next-step section");
if (!projectState.includes("## Verification truth")) fail("PROJECT-STATE.md has no verification-truth section");
if (!projectState.includes("## Anti-regression rule")) fail("PROJECT-STATE.md has no anti-regression section");

let gitStatus;
try { gitStatus = execFileSync("git", ["status", "--porcelain=v1"], {encoding:"utf8"}).trim(); }
catch { gitStatus = ""; }
if (gitStatus) {
  console.error("AGENT CONTINUITY: WARNING — working tree contains uncommitted changes.");
}

console.log(`AGENT CONTINUITY: PASS — ${lines.length} journal operations, ${ordered.length} implementation steps checked.`);
