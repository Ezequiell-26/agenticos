#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const root = process.cwd();
async function readText(relativePath) { return readFile(new URL(relativePath, pathToFileURL(root + "/")), "utf8"); }
async function readJson(relativePath) { return JSON.parse(await readText(relativePath)); }
function fail(message) { console.error("PROJECT STATE: FAIL — " + message); process.exit(1); }

const state = await readJson("reference/manifests/implementation-state.json");
const projectState = await readText("reference/PROJECT-STATE.md");
if (state.schema_version !== 1) fail("unsupported implementation-state schema");
if (!Array.isArray(state.steps) || state.steps.length < 3) fail("implementation-state has fewer than three controlled steps");
const ordered = [...state.steps].sort((a,b) => a.number - b.number);
const activeStatuses = new Set(["in_progress","verifying","correcting","blocked"]);
const active = ordered.filter(step => activeStatuses.has(step.status));
if (active.length > 1) fail("more than one implementation step is active");
for (let i=1;i<ordered.length;i+=1) { if (ordered[i].status === "verified" && ordered[i-1].status !== "verified") fail("verified step " + ordered[i].id + " has an unverified predecessor"); }
const current = ordered.find(step => step.id === state.current_step);
if (!current) fail("current_step is not declared in steps");
const firstNonVerified = ordered.find(step => step.status !== "verified");
if (!firstNonVerified) fail("no explicit next authorized step remains");
if (firstNonVerified.id !== current.id) fail("current_step " + current.id + " does not match first non-verified step " + firstNonVerified.id);
for (const future of ordered.filter(step => step.number > current.number)) { if (future.status !== "pending") fail("future step " + future.id + " must remain pending"); }
if (!projectState.includes("- Current implementation step: `" + current.id + "`")) fail("PROJECT-STATE.md current step disagrees with implementation-state.json");
if (!projectState.includes("- Current step status: `" + current.status + "`")) fail("PROJECT-STATE.md current status disagrees with implementation-state.json");
if (!projectState.includes("## Next authorized progression")) fail("PROJECT-STATE.md has no next-step section");
if (!projectState.includes("## Verification truth")) fail("PROJECT-STATE.md has no verification-truth section");
const nextSection = projectState.split("## Next authorized progression",2)[1] || "";
if (current.status !== "verified") { if (!/verify|verification/i.test(nextSection)) fail("active step must explicitly point toward verification"); } else { const successor=ordered.find(step=>step.number===current.number+1); if (!successor || successor.status !== "pending") fail("verified current step must have exactly one pending successor"); if (!nextSection.includes(successor.id)) fail("PROJECT-STATE.md does not name the single pending successor"); }
console.log("PROJECT STATE: PASS — current=" + current.id + " status=" + current.status + "; verified=" + ordered.filter(step => step.status === "verified").length + "; active=" + active.length);
