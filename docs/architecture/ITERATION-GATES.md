# AgentiCOS Iteration Gates

These gates apply to every AI-assisted implementation iteration.

## Gate 0 — Understand

The coding agent must read:
- ARCHITECTURE.md;
- relevant domain architecture;
- feature manifest;
- current tests;
- recent changes.

It must identify the exact slice being implemented.

## Gate 1 — Plan

The proposed slice must state:
- user-visible outcome;
- contract(s);
- dependency path;
- persistence impact;
- permissions;
- acceptance tests.

## Gate 2 — Implement

Changes must fit existing domain boundaries.

No direct bypass of protocol, policy, provider, tool or persistence contracts.

## Gate 3 — Validate

At minimum:
- typecheck/build;
- unit/contract tests affected by the change;
- application smoke test for the changed surface;
- migration check when state changed.

## Gate 4 — Integrate

The new capability must be reachable through the intended product surface.

A package that exists but cannot be exercised is not considered integrated.

## Gate 5 — Observe

Confirm:
- structured logs/events;
- error classification;
- cancellation;
- timeout;
- usage where relevant.

## Gate 6 — Security

Confirm:
- declared capabilities;
- secret boundaries;
- approval behavior;
- sandbox behavior;
- external input trust boundaries.

## Gate 7 — Recover

Test at least one applicable failure:
- provider timeout;
- provider quota/rate limit;
- tool failure;
- client disconnect;
- process restart;
- cancellation.

## Gate 8 — Document

Update:
- feature manifest;
- architecture if a boundary changed;
- ADR when a design decision changed;
- tests/fixtures;
- provenance for third-party-derived code.

## Gate 9 — Stable checkpoint

The branch/repository must end the iteration in a state that another AI agent can safely continue from.

A half-migrated architectural state is not an acceptable checkpoint unless explicitly recorded as such.