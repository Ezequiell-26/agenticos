# AgentiCOS Architecture Enforcement

Architecture rules are executable constraints, not documentation-only conventions.

## Enforcement layers

Type system
  ↓
Contract tests
  ↓
Architecture Guard
  ↓
CI verification
  ↓
Human/AI review

The Architecture Guard checks source-tree boundary violations before a change can pass npm run check.

## Non-negotiable boundaries

- UI/application code reaches providers through contracts, never provider implementations.
- Domain code cannot create a competing canonical persistence or permission path.
- Source code cannot mutate environment secrets.
- Feature-local agent loops are prohibited.
- Architecture changes must include tests and documentation updates.
- Third-party-derived code must retain provenance and license evidence.

## Failure policy

A guard failure is a hard validation failure. The change must be repaired or the architecture explicitly changed before implementation continues.

## Defense in depth

The guard intentionally does not attempt to prove application correctness. It prevents known structural classes of regressions while typechecking, contract tests, integration tests, replay tests and CI cover behavioral correctness.
