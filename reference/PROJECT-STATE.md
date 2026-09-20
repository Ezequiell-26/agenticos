# AgentiCOS Project State

> Canonical continuity snapshot. Read this before any AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: sequential-verified
- Current implementation step: `architecture-foundation`
- Current step status: `in_progress`
- Functional implementation remains locked until the foundation verification gate passes.
- Canonical runtime: Rust/Tokio.
- Reference policy: MIT-only canonical third-party source, dynamic repository resolution, no-invention evidence rule.
- Destructive AI operations: disabled by default.

## What is already established

The architecture contains explicit contracts and schemas for runtime, providers, routing, tools, plugins, skills, memory, workflows, multi-agent execution, channels, webhooks, scheduling, MCP/A2A, persistence, context, terminals/jobs, filesystem changes, attachments, code intelligence, planning, trajectories, supervision, migration, distribution, management and AI-generated changes.

The reference system contains a verified MIT-focused seed corpus and a dynamic resolver. The resolver must select the strongest applicable repository and collect repository-level evidence before non-trivial implementation.

## Current work

Architecture completeness, reference resolution and AI continuity/anti-regression controls are being finalized. No functional Step 1 implementation has been started by this continuity checkpoint.

## Verification truth

Do not claim a check passed unless its command/result is recorded in the operation journal or CI evidence.

At the latest architectural work checkpoint, remote GitHub CI was not available as a passing result and local Rust execution was not available in the execution environment. Treat those checks as **unverified**, not passed.

## Next authorized progression

1. Finish and verify the architecture foundation.
2. Record all verification evidence.
3. Only after the foundation becomes `verified`, unlock `rust-kernel-vertical-slice-1`.
4. Execute exactly one step at a time.

## Anti-regression rule

Do not delete, replace or rewrite project history, code, data, manifests or evidence as an optimization. Preserve first. Any exceptional destructive change requires explicit authorization, a snapshot/rollback point and a journal record describing exactly what was removed and why.

## Continuity rule

Every AI operation must leave:
- what it did;
- what it created;
- what it modified;
- what it deleted (normally `none`);
- what it verified;
- what remains unverified;
- risks;
- rollback point;
- the single next step.

The next AI must continue from this file and the append-only journal, not from model memory.

## Latest continuity checkpoint

- Continuity protocol: active.
- Durable operation journal: active and append-only.
- Anti-regression verifier: `scripts/verify-agent-continuity.mjs`.
- CI enforcement: active.
- Latest audited code checkpoint before journal append: `1c62548dfae43c7e4d00fddc17dcb1a49236f793`.
- Functional Step 1 remains locked until architecture-foundation verification is complete.
- No project code or data was deleted by this operation.

## Continuity enforcement checkpoint

- Foundation gate now explicitly requires the continuity verifier and journal integrity checks.
- Architecture documentation indexes the continuity protocol.
- Latest audited code checkpoint before the next journal append: `1c62548dfae43c7e4d00fddc17dcb1a49236f793`.


## Pre-implementation architecture audit

- Audit document: `docs/architecture/ARCHITECTURE-AUDIT-BASELINE.md`.
- Architecture status: verification pending, no functional implementation unlocked.
- Structural findings corrected: readiness corpus bug, continuity portability/enforcement, root license, Cargo.lock, MIT-corpus/source-registry reconciliation, dependency-direction wording, embedded citation artifacts and state-consistency enforcement.
- Remaining verification truth: Rust toolchain checks and final remote CI evidence are still UNVERIFIED.
