# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: `provider-plane-vertical-slice-1`
- Current step status: `pending`
- Architecture foundation: VERIFIED on GitHub Actions run #354.
- Rust durable kernel Step 1: VERIFIED on `main`.
- Rust durable kernel Step 2: VERIFIED by recorded Rust workspace gates.
- Architecture hardening: VERIFIED with full TypeScript/continuity and Rust evidence from CI run #371 on the reconciled hardening branch.
- AgentEngine vertical slice: VERIFIED on current `main` commit `c23a789379bc07923440334239d9e3a982c1b9b9` according to its recorded verification evidence.
- Canonical runtime: Rust/Tokio.
- TypeScript: transitional prototype/product surface boundary; it is not the canonical runtime.
- Reference policy: MIT-only canonical third-party source, dynamic repository resolution, no-invention evidence rule.
- Destructive AI operations: disabled by default.

## What is established

The architecture contains explicit contracts and schemas for runtime, providers, routing, tools, plugins, skills, memory, workflows, multi-agent execution, channels, webhooks, scheduling, MCP/A2A, persistence, context, terminals/jobs, filesystem changes, attachments, code intelligence, planning, trajectories, supervision, migration, distribution, management and AI-generated changes.

The reference system contains a verified MIT-focused seed corpus and a dynamic resolver. Non-trivial implementation must use repository evidence and preserve exact provenance.

The current hardening layer protects versioned SQLite migrations, database invariants, worker lease/fencing semantics, durable outbox/inbox claims, idempotency recovery, contract validation, snapshot integrity, execution budgets and Forge/provider validation paths.

## Current implementation scope

The sole authorized next implementation slice is `provider-plane-vertical-slice-1`.

Its scope is:

- canonical Rust provider plane;
- model catalog and capability discovery;
- credential isolation;
- quota/health/retry/fallback boundaries;
- provider transport verification.

No later product slice should be pre-implemented.

## Verification truth

Do not claim a check passed unless the command/result is recorded in the operation journal or CI evidence.

Architecture hardening is supported by CI run #371:
- `npm run continuity:verify`
- `npm run state:verify`
- `npm run check`
- `npm run test`
- `cargo fmt --all -- --check`
- `cargo check --workspace --all-targets`
- `cargo test --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`

AgentEngine is recorded as VERIFIED by its current-main implementation evidence. A fresh full CI run is required after this reconciliation before the reconciliation itself is merged.

## Next authorized progression

1. Pass the full CI gate on this final reconciliation branch.
2. Merge the reconciled branch into `main` without overwriting the current AgentEngine implementation.
3. Keep exactly one next implementation step unlocked: `provider-plane-vertical-slice-1`.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave: what it did; what it created; what it modified; what it deleted; what it verified; what remains unverified; risks; rollback point; and exactly one next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Current rollback point

- Safe rollback to current main baseline before reconciliation: `c23a789379bc07923440334239d9e3a982c1b9b9`.
- Previous verified architectural baseline remains `25c6df9c1f5816255e803cf70497ef7ef1de6f01`.
- No project files or historical records are deleted by this reconciliation.

## Historical evidence

Detailed historical verification records remain in `reference/journal/agent-operations.jsonl` and the existing architecture audit documents. They are evidence, not competing current state.
