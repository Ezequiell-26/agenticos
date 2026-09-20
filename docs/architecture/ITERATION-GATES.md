# AgentiCOS Iteration Gates

These gates apply to every AI-assisted implementation iteration and are enforced progressively by CI and the Change Plane.

## Gate 0 — Understand
Read ARCHITECTURE.md, the relevant domain architecture, the feature manifest, current tests and recent changes. Identify exactly one slice.

## Gate 1 — Plan
State the user-visible outcome, contracts, dependency path, persistence impact, permissions, acceptance tests and rollback/snapshot strategy when state or code changes.

## Gate 2 — Implement
Stay inside existing domain boundaries. No direct bypass of protocol, policy, provider, tool or persistence contracts.

## Gate 3 — Validate
Run strict typecheck/build, affected unit/contract tests, application smoke tests, migration checks when applicable, and the architecture guard.

## Gate 4 — Integrate
The capability must be reachable through its intended product surface. A package that cannot be exercised is not integrated.

## Gate 5 — Observe
Confirm structured events/logs, error classification, cancellation, timeouts and usage where relevant.

## Gate 6 — Security
Confirm declared capabilities, secret boundaries, approval behavior, sandbox behavior, external-input trust boundaries and third-party dependency/license impact.

## Gate 7 — Recover
Test at least one applicable failure: provider timeout, quota/rate limit, tool failure, client disconnect, process restart, cancellation, duplicate execution or stale lease.

## Gate 8 — Document
Update the feature manifest, architecture docs when boundaries change, ADRs when decisions change, fixtures/tests and third-party provenance.

## Gate 9 — Stable checkpoint
The repository must end the iteration in a state another AI agent can safely continue from. Half-migrated architecture is not an acceptable checkpoint unless explicitly recorded.

## CI enforcement

The main verification command performs strict typecheck, architecture validation and architecture regression tests. Dependency audit is also required. Failed gates are hard failures in the normal promotion path.

## Change Plane enforcement

AI-driven code changes use impact analysis, workspace snapshot, bounded repair, verification and then promotion or rollback.
