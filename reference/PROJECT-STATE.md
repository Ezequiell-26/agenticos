# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: `agent-engine-vertical-slice-1`
- Current step status: `pending`
- Architecture foundation: VERIFIED on GitHub Actions run #354 at `34d3299cdc865e8c2aa8d6662b841ae9b93e7b14`.
- Rust durable kernel Step 1: VERIFIED on `main` at `25c6df9c1f5816255e803cf70497ef7ef1de6f01`.
- Rust durable kernel Step 2: VERIFIED by recorded Rust workspace gates.
- Architecture hardening: VERIFIED by CI run #371 on integration commit `3b66f76a00305e06cdc44f58e563e450b356c05f`; the evidence covers continuity, project-state consistency, TypeScript checks/tests and Rust gates.
- Canonical runtime: Rust/Tokio.
- TypeScript: transitional prototype/product surface boundary; it is not the canonical runtime.
- Reference policy: MIT-only canonical third-party source, dynamic repository resolution, no-invention evidence rule.
- Destructive AI operations: disabled by default.

## What is established

The architecture contains explicit contracts and schemas for runtime, providers, routing, tools, plugins, skills, memory, workflows, multi-agent execution, channels, webhooks, scheduling, MCP/A2A, persistence, context, terminals/jobs, filesystem changes, attachments, code intelligence, planning, trajectories, supervision, migration, distribution, management and AI-generated changes.

The reference system contains a verified MIT-focused seed corpus and a dynamic resolver. Non-trivial implementation must use repository evidence and preserve exact provenance.

The current kernel hardening layer additionally protects versioned SQLite migrations, database invariants, worker leases/fencing, durable outbox/inbox claims, idempotency recovery, contract validation, snapshot integrity, execution budgets and Forge/provider validation paths.

## Current implementation scope

The sole authorized next implementation slice is `agent-engine-vertical-slice-1`.

Its scope is intentionally limited to:

- canonical Rust AgentEngine boundary;
- model/provider transport boundary integration;
- one deterministic model-driven Run slice;
- recovery and verification semantics.

No later product slice should be pre-implemented.

## Verification truth

Do not claim a check passed unless the command/result is recorded in the operation journal or CI evidence.

The architecture-hardening step is VERIFIED from CI run #371:
- `npm run continuity:verify`
- `npm run state:verify`
- `npm run check`
- `npm run test`
- `cargo fmt --all -- --check`
- `cargo check --workspace --all-targets`
- `cargo test --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`

The current `main` push run #373 exposed the previous PROJECT-STATE mismatch; that mismatch is corrected in this reconciliation branch and must be revalidated by CI before merge.

## Next authorized progression

1. Verify this reconciliation branch with the full CI gate.
2. Merge the reconciled hardening onto current `main` without overwriting Devin's verified Step 2 work.
3. Keep exactly one next implementation step unlocked: `agent-engine-vertical-slice-1`.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave: what it did; what it created; what it modified; what it deleted; what it verified; what remains unverified; risks; rollback point; and exactly one next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Current rollback point

- Safe rollback to current `main` baseline before reconciliation: `f9c0a0092fe8d7f6822309b26505d4494a32a4a8`.
- Previous verified architectural baseline remains `25c6df9c1f5816255e803cf70497ef7ef1de6f01`.
- No files or historical records were deleted by this reconciliation.

## Historical evidence

Detailed historical verification records remain in `reference/journal/agent-operations.jsonl` and the existing architecture audit documents. They are evidence, not competing current state.
