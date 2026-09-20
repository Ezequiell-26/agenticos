# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: `architecture-hardening-2026-09-21`
- Current step status: `in_progress`
- Architecture foundation: VERIFIED (GitHub Actions run #354; commit `34d3299cdc865e8c2aa8d6662b841ae9b93e7b14`).
- Rust durable kernel Step 1: VERIFIED on `main` at `25c6df9c1f5816255e803cf70497ef7ef1de6f01`.
- Canonical runtime: Rust/Tokio.
- TypeScript: transitional prototype/product surface boundary; it is not the canonical runtime.
- Reference policy: MIT-only canonical third-party source, dynamic repository resolution, no-invention evidence rule.
- Destructive AI operations: disabled by default.

## What is established

The architecture contains explicit contracts and schemas for runtime, providers, routing, tools, plugins, skills, memory, workflows, multi-agent execution, channels, webhooks, scheduling, MCP/A2A, persistence, context, terminals/jobs, filesystem changes, attachments, code intelligence, planning, trajectories, supervision, migration, distribution, management and AI-generated changes.

The reference system contains a verified MIT-focused seed corpus and a dynamic resolver. Non-trivial implementation must use repository evidence and preserve exact provenance.

## Current hardening scope

- Keep machine-readable and human-readable project state synchronized.
- Add a blocking project-state consistency verifier.
- Enforce that only one implementation step is active.
- Harden the canonical Rust in-memory lease store against active takeover and fencing-token reuse.
- Add regression coverage and CI enforcement.
- Do not implement the AgentEngine or later product slices during this step.

## Verification truth

Do not claim a check passed unless the command/result is recorded in the operation journal or CI evidence.

At this checkpoint, the hardening branch has not yet received final CI evidence. Treat all hardening checks as **UNVERIFIED** until GitHub Actions records them.

## Next authorized progression

1. Verify `architecture-hardening-2026-09-21` in CI.
2. Record exact verification evidence in the journal and manifest.
3. Mark the hardening step `VERIFIED` only after every required check passes.
4. Unlock exactly one next step: `agent-engine-vertical-slice-1`.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave: what it did; what it created; what it modified; what it deleted; what it verified; what remains unverified; risks; rollback point; and exactly one next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Current rollback point

- Safe rollback to verified main baseline: `25c6df9c1f5816255e803cf70497ef7ef1de6f01`.
- No files or historical records were deleted by the hardening operation.

## Historical evidence

Detailed historical verification records remain in `reference/journal/agent-operations.jsonl` and the existing architecture audit documents. They are evidence, not competing current state.
