# AgentiCOS Project State

> Canonical current-state snapshot. Read this before every AI change. Historical evidence remains in the append-only journal.

## Current truth

- Repository: `Ezequiell-26/agenticos`
- Current architecture mode: `sequential-verified / fail-closed`
- Current authorized implementation step: **Step 25 — `integration-test-implementation-phase-3`**
- Current implementation step: `integration-test-implementation-phase-3`
- Current step status: `in_progress`
- Verified contiguous steps: **0–24 (25 steps)**
- Steps 25 onward are not currently verified.
- Baseline main head audited before this coherence repair: `adafcc4828d775f32c224bc88ef9b69ff67e7c14`
- Safe rollback point for Step 25 implementation: `a278008b536ef4da7cf18a67191291446dd7a8a5`
- Canonical runtime: Rust + Tokio
- Desktop surface: Tauri 2 + React + TypeScript + Vite
- Third-party canonical source policy: MIT/compatible license + provenance + exact revision before integration
- Destructive AI operations: disabled by default

## Why the state was reconciled

The current main branch contained valid source changes for later capabilities, including desktop UI and Brain infrastructure, but the machine-readable implementation state had:

- a missing Step 53;
- non-sequential unlock/requirement references;
- later steps marked verified while earlier steps remained pending.

Those conditions violate the repository's own fail-closed sequential contract.

The reconciliation **does not delete those source changes** and does not rewrite historical journal records. It changes only the current admissibility of verification status.

## Verification interpretation

A source file can exist without being a verified implementation step.

The repository currently contains an early Tauri + React + Vite + Tailwind frontend. It is preserved and documented, but future UI changes remain governed by the sequential state machine.

Likewise, Brain/Capability/Source/Resource work after Step 24 is retained as source history but is not treated as currently verified until its predecessor chain is completed.

## Verification truth

- Only Steps 0–24 are currently verified.
- Step 25 remains `in_progress` until every acceptance check has recorded CI evidence.
- Existing source outside the current step remains preserved but does not become verified by presence alone.

## Anti-regression rule

- Never advance the implementation state past the current authorized step.
- Never mark a step verified without complete acceptance evidence.
- Never delete or rewrite historical source/evidence to conceal a failing check.

## Architecture-control documents

- `docs/architecture/CANONICAL-ARCHITECTURE.md`
- `docs/architecture/FRONTEND-ARCHITECTURE.md`
- `reference/manifests/architecture-dag.json`
- `reference/manifests/architecture-completeness.json`
- `reference/manifests/mit-repositories.json`

## AI continuity

Every AI operation must leave:

- what changed;
- what was created;
- what was deleted;
- what was preserved;
- verification evidence;
- unverified checks;
- risks;
- rollback point;
- exactly one next step.

For frontend work, also update `docs/architecture/FRONTEND-CHANGELOG.md`.

## Historical verification

Historical verification records are not deleted. Existing evidence for non-contiguous later steps remains available in `reference/journal/agent-operations.jsonl` and implementation-state history, but pending status takes precedence over historical "verified" claims until the sequential chain is re-established.

## Next authorized progression

**Current operation:** Step 25, `integration-test-implementation-phase-3`, is in progress. Its acceptance evidence must pass before it can become verified.

**Exactly one next step after verification:** transition Step 25 to `verified` only after every required check has recorded evidence.
