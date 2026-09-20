# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: `provider-plane-vertical-slice-1`
- Current step status: `pending`
- Architecture foundation: VERIFIED on GitHub Actions run #354.
- Rust durable kernel Step 1: VERIFIED.
- Rust durable kernel Step 2: VERIFIED.
- Architecture hardening: VERIFIED with complete TypeScript/continuity and Rust evidence; final main post-merge CI run #377 passed.
- AgentEngine vertical slice: VERIFIED; final main post-merge CI run #377 passed.
- Final reconciled main merge commit: `4137c90828d1a57e77048a7161024b3c66099495`.
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

Final post-merge CI run #377 on `4137c908...` passed:
- TypeScript continuity verification;
- project-state consistency;
- architecture, types and tests;
- implementation-state validation;
- dependency audit;
- dependency tree check;
- Rust fmt;
- Rust workspace compilation;
- Rust workspace tests;
- Rust clippy;
- architecture workspace shape.

## Next authorized progression

1. Keep the verified `main` baseline intact.
2. Implement exactly `provider-plane-vertical-slice-1` using the registered reference corpus and canonical Rust contracts.
3. Record verification evidence and unlock only its single successor after all required gates pass.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave: what it did; what it created; what it modified; what it deleted; what it verified; what remains unverified; risks; rollback point; and exactly one next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Current rollback point

- Safe rollback to the final verified merge baseline: `4137c90828d1a57e77048a7161024b3c66099495`.
- No project files or historical records were deleted by the reconciliation.
- Older branches and PRs remain available as historical development records.

## Historical evidence

Detailed historical verification records remain in `reference/journal/agent-operations.jsonl` and the existing architecture audit documents. They are evidence, not competing current state.
