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

if (state.schema_version !== 1) fail("unsupported implementation-state schema");
if (!state.policy || state.policy.one_step_at_a_time !== true || state.policy.next_step_requires_verified_previous !== true || state.policy.fail_closed !== true) {
  fail("implementation-state policy is incomplete or unsafe");
}
if (!Array.isArray(state.steps) || state.steps.length < 3) fail("implementation-state has fewer than three controlled steps");

const ordered = [...state.steps].sort((a, b) => a.number - b.number);
const numbers = ordered.map((step) => step.number);
const ids = ordered.map((step) => step.id);

if (numbers.some((number) => !Number.isInteger(number) || number < 0)) fail("implementation step numbers must be non-negative integers");
if (new Set(numbers).size !== numbers.length) fail("implementation step numbers must be unique");
if (new Set(ids).size !== ids.length) fail("implementation step ids must be unique");

for (let i = 0; i < ordered.length; i += 1) {
  if (ordered[i].number !== i) fail("implementation steps must use contiguous numbers starting at zero");
  if (!ordered[i].id || typeof ordered[i].id !== "string") fail("implementation step ids must be non-empty strings");
  if (!["pending", "in_progress", "verifying", "correcting", "verified", "blocked"].includes(ordered[i].status)) {
    fail("implementation step " + ordered[i].id + " has an invalid status");
  }
  if (ordered[i].requires !== undefined && !Array.isArray(ordered[i].requires)) {
    fail("step " + ordered[i].id + " has an invalid requires field");
  }
  if (i > 0 && !ordered[i].requires?.includes(ordered[i - 1].id)) {
    fail("step " + ordered[i].id + " must require its immediate predecessor");
  }
  if (!Array.isArray(ordered[i].required_checks)) fail("step " + ordered[i].id + " is missing required_checks");
  if (!Array.isArray(ordered[i].verification_evidence)) fail("step " + ordered[i].id + " is missing verification_evidence");
  if (!Array.isArray(ordered[i].unlocks)) fail("step " + ordered[i].id + " is missing unlocks");
}

const activeStatuses = new Set(["in_progress", "verifying", "correcting", "blocked"]);
const active = ordered.filter((step) => activeStatuses.has(step.status));
if (active.length > 1) fail("more than one implementation step is active");

for (let i = 1; i < ordered.length; i += 1) {
  if (ordered[i].status === "verified" && ordered[i - 1].status !== "verified") {
    fail("verified step " + ordered[i].id + " has an unverified predecessor");
  }
}

const current = ordered.find((step) => step.id === state.current_step);
if (!current) fail("current_step is not declared in steps");

const firstNonVerified = ordered.find((step) => step.status !== "verified");
if (!firstNonVerified) fail("no explicit next authorized step remains");
if (firstNonVerified.id !== current.id) fail("current_step " + current.id + " does not match first non-verified step " + firstNonVerified.id);

for (const future of ordered.filter((step) => step.number > current.number)) {
  if (future.status !== "pending") fail("future step " + future.id + " must remain pending");
}

if (!Array.isArray(state.transition_history) || state.transition_history.length === 0) {
  fail("transition_history is missing");
}
const latestTransition = state.transition_history[state.transition_history.length - 1];
const expectedTransitionTarget = current.id + ":" + current.status;
if (latestTransition?.to !== expectedTransitionTarget) {
  fail("latest transition does not point to current step " + expectedTransitionTarget);
}

if (!projectState.includes("- Current implementation step: `" + current.id + "`")) fail("PROJECT-STATE.md current step disagrees with implementation-state.json");
if (!projectState.includes("- Current step status: `" + current.status + "`")) fail("PROJECT-STATE.md current status disagrees with implementation-state.json");
if (!projectState.includes("## Next authorized progression")) fail("PROJECT-STATE.md has no next-step section");
if (!projectState.includes("## Verification truth")) fail("PROJECT-STATE.md has no verification-truth section");

const nextSection = projectState.split("## Next authorized progression", 2)[1] || "";
if (current.status !== "verified") {
  if (!/verify|verification/i.test(nextSection)) fail("active step must explicitly point toward verification");
} else {
  const successor = ordered.find((step) => step.number === current.number + 1);
  if (!successor || successor.status !== "pending") fail("verified current step must have exactly one pending successor");
  if (!nextSection.includes(successor.id)) fail("PROJECT-STATE.md does not name the single pending successor");
}

const currentSuccessors = current.unlocks;
if (current.status !== "verified" && currentSuccessors.length > 1) {
  fail("non-verified current step may not unlock multiple successors");
}

console.log(
  "PROJECT STATE: PASS — current=" +
    current.id +
    " status=" +
    current.status +
    "; verified=" +
    ordered.filter((step) => step.status === "verified").length +
    "; active=" +
    active.length,
);
