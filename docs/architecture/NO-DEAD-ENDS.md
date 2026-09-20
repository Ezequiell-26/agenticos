# AgentiCOS No-Dead-Ends Policy

## Purpose

AI-assisted development is iterative. A common failure mode is creating a subsystem that cannot be integrated later, then building another subsystem that solves the same problem differently.

AgentiCOS prohibits this pattern.

## Rules

### Rule 1 — Every implementation has a destination

Before coding, identify the final package/domain and application surface where the feature will live.

### Rule 2 — Temporary means test fixture

A mock, stub or fake implementation is allowed only when it implements a final contract and is clearly marked as a test fixture.

### Rule 3 — No throwaway UI

Early production screens use the final navigation and protocol types. Pure visual prototypes belong outside the production application tree.

### Rule 4 — No hidden migrations

State created by an early slice must already use the canonical persistence schema or an explicitly versioned migration path.

### Rule 5 — No second abstractions

If Provider, Tool, Thread, Run, Artifact, Skill or Memory contracts already exist, a feature extends them instead of introducing a feature-local interface.

### Rule 6 — Every iteration is reversible

Prefer small commits and checkpoints. A failed slice should be removable without invalidating unrelated domains.

### Rule 7 — Every slice is executable

After each slice there must be a user-visible or machine-testable path that exercises it.

### Rule 8 — Stop before architectural uncertainty compounds

When a feature reveals a missing contract or boundary, record an ADR and fix the architecture before continuing the dependent implementation.

## Anti-pattern

Build huge backend
→ build UI later
→ contracts do not match
→ rewrite

## Required pattern

Small visible slice
→ final contract
→ real integration
→ test
→ checkpoint
→ next slice

## Product outcome

The product grows continuously rather than alternating between unusable internal work and large rewrites.