# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: none-pending-definition
- CQRS separation vertical slice: VERIFIED with all gates passing (command/query separation, projections, event-driven synchronization, read/write isolation, security gate, architecture gate)
- Outbox pattern vertical slice: VERIFIED with all gates passing (outbox store, background publisher, status transitions, event identity, security gate, architecture gate)
- Architecture foundation: VERIFIED on GitHub Actions run #354.
- Rust durable kernel Step 1: VERIFIED.
- Rust durable kernel Step 2: VERIFIED.
- Architecture hardening: VERIFIED on the recorded hardening CI evidence.
- AgentEngine vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Provider plane vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Tool plane vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Memory/context vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Protocol implementation vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Product surfaces CLI vertical slice: VERIFIED by its recorded Rust acceptance evidence.
- Main baseline before this reconciliation: `bc9b21324b072cc5df068a47d7bf1571399f6304`.
- Canonical runtime: Rust/Tokio.
- TypeScript: transitional prototype/product surface boundary; it is not the canonical runtime.
- Reference policy: MIT-only canonical third-party source, dynamic repository resolution, no-invention evidence rule.
- Destructive AI operations: disabled by default.

## What is established

The architecture contains explicit contracts and schemas for runtime, providers, routing, tools, plugins, skills, memory, workflows, multi-agent execution, channels, webhooks, scheduling, MCP/A2A, persistence, context, terminals/jobs, filesystem changes, attachments, code intelligence, planning, trajectories, supervision, migration, distribution, management and AI-generated changes.

The reference system contains a verified MIT-focused seed corpus and a dynamic resolver. Non-trivial implementation must use repository evidence and preserve exact provenance.

The architecture-control plane is now guarded against duplicate JSON object keys, stale current-step projections and multiple active steps.

## Verified-slice interpretation

A VERIFIED step means its declared acceptance checks and recorded evidence passed. It does **not** mean that the entire capability is production-complete.

The current codebase still contains intentional first-slice implementations such as in-memory stores, an in-memory model provider, a simulated HTTP provider adapter, and boundary-level tool policy logic. Those are now explicitly tracked rather than being treated as completed production behavior.

## Current implementation scope

No implementation slice is currently authorized. The last verified slice was `outbox-pattern-vertical-slice-1`.

Verified slices:
- Runtime integration vertical slice: VERIFIED (AgentEngine-ModelProvider connection, HTTP transport, capability validation, context/memory persistence, durable run identity, end-to-end recovery)
- CQRS separation vertical slice: VERIFIED (command/query separation, projections, event-driven synchronization, read/write isolation)
- Outbox pattern vertical slice: VERIFIED (outbox store, background publisher, status transitions, event identity)

No later product slice should be pre-implemented.

## Open runtime integration gaps

The detailed machine-readable gap register is `reference/manifests/runtime-integration-gaps.json`. It records the concrete code evidence and the contract obligations that remain before these boundaries can be treated as production-complete.

## Verification truth

Do not claim a check passed unless the command/result is recorded in the operation journal or CI evidence.

The pre-reconciliation main baseline `bc9b213...` includes the Step 9 implementation commits. This reconciliation is not yet considered VERIFIED until its pull-request CI passes.

## Next authorized progression

No implementation slice is currently authorized. The next step must be defined based on the master implementation plan and verified architectural patterns from MIT repositories.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave: what it did; what it created; what it modified; what it deleted; what it verified; what remains unverified; risks; rollback point; and exactly one next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Current rollback point

- Safe rollback to the pre-reconciliation main baseline: `bc9b21324b072cc5df068a47d7bf1571399f6304`.
- No source code or historical journal entries are deleted by this reconciliation.
- The malformed duplicate-key state is corrected in the new commit rather than rewriting prior commits.

## Historical evidence

Detailed historical verification records remain in `reference/journal/agent-operations.jsonl` and the existing architecture audit documents. Historical records remain evidence, not competing current state.
