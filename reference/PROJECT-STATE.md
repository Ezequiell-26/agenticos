# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change.

## Current baseline

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: `sequential-verified`
- Current implementation step: `integration-test-implementation-phase-3`
- Current step status: `pending`
- Total verified steps: 25
- Total controlled steps: 56
- Security baseline: `#![forbid(unsafe_code)]` is enforced across canonical Rust crates.
- Canonical runtime: Rust/Tokio.
- TypeScript: product/interface surface; it is not the canonical backend runtime.
- Reference policy: MIT-focused canonical third-party source, dynamic repository resolution and evidence-first provenance.
- Destructive AI operations: disabled by default.

## Verified steps

Steps 0 through 24 are the currently contiguous verified chain. Their detailed acceptance evidence remains in `reference/manifests/implementation-state.json` and the append-only operation journal.

The later historical entries (including enterprise utilities and Brain architecture work) are retained as controlled steps but are not currently treated as verified because their immediate predecessors remain pending. This is intentional fail-closed behavior; no capabilities are claimed as verified without a valid predecessor chain.

## Current architecture

The canonical workspace is divided into:

- `crates/domain/`: contracts and Brain abstractions.
- `crates/application/`: agent/application orchestration.
- `crates/infrastructure/`: kernel, runtime, providers, tools, MCP, memory, source ingestion, storage and external integration infrastructure.
- `crates/presentation/`: CLI, desktop, API server and gateway surfaces.
- `crates/utilities/`: reusable cross-cutting infrastructure.

There is one canonical owner for each first-party crate and one workspace manifest per crate. Duplicate legacy trees under `crates/interface/`, top-level legacy crate roots and nested kernel/adapter/runtime copies are removed from the active workspace.

## Brain direction

AgentiCOS is being built as a Brain-first agent platform capable of coordinating model providers, capabilities, tools, MCP, knowledge, memory, planning, execution, verification and resource optimization.

The Brain must remain independent of concrete models, providers, tools, MCP servers and external repositories. External MIT/open-source code is admitted only through controlled modes: vendored foundational code, replaceable adapter/plugin, isolated process or indexed knowledge source.

Large source corpora must be ingested incrementally, normalized, deduplicated, indexed and retrieved selectively. The system must avoid loading complete repositories into RAM or model context and must use bounded caches, backpressure and explicit token/CPU/RAM/disk/network budgets.

## Structural reconciliation

The architecture cleanup branch:

- consolidates previously duplicated/unlisted crate trees into the canonical layer layout;
- adds a dedicated MCP boundary and resilience utility location;
- centralizes shared dependency versions through workspace inheritance;
- restores architecture, workspace-inheritance and dependency-duplicate verification gates;
- restores the missing `.gitmodules` metadata for the tracked Hermes reference submodule;
- preserves the canonical desktop SQLite data whose legacy copy was byte-identical;
- keeps all prior project history and reference evidence.

Detailed change records are in `reference/journal/agent-operations.jsonl`.

## Open gaps

- The current active slice is `integration-test-implementation-phase-3`; it must be completed and verified before the next step unlocks.
- `crates/infrastructure/kernel` remains large and will require controlled decomposition in a later authorized slice.
- The Brain/CapabilityRegistry architecture exists as a direction and contract boundary, but its full dynamic implementation is not claimed here.
- Cargo.lock and all remote CI checks remain authoritative for dependency-resolution and build verification.

## Verification truth

Never claim a check passed unless the command/result appears in GitHub Actions or the operation journal.

A green architecture gate means the structure is coherent and verifiable. It does not mean that every future Brain capability is implemented.

## Next authorized progression

Complete and verify `integration-test-implementation-phase-3`. Do not pre-implement later slices.

## Anti-regression rule

Preserve code, data, schemas, contracts, reference evidence and journal history by default. A destructive change requires explicit authorization, impact analysis, a rollback point and journal evidence.

## Continuity rule

Every AI operation must record:

- what changed;
- what was created;
- what was modified;
- what was deleted;
- what was preserved;
- verification evidence;
- unverified checks;
- risks;
- rollback point;
- exactly one next step.

The next AI must continue from this file, `reference/manifests/implementation-state.json`, `AGENTS.md` and the append-only journal rather than conversational memory.

## Rollback

- Primary structural rollback point: `8d959789eb5150e155db4e74529bdb961d83a54c`.
- The active cleanup is isolated on `architecture/canonical-layout-cleanup` until its PR verification passes.
