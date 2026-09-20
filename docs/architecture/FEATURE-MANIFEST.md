# AgentiCOS Feature Manifest Convention

Every major feature gets a manifest before implementation.

## Required fields

```yaml
id: agent-workspace
status: planned
ownerDomain: runtime
surface:
  - web
  - tui
contracts:
  - application-protocol
  - agent-contract
dependencies:
  - kernel
  - persistence
  - providers
security:
  - model-access
  - tool-approval
persistence:
  - threads
  - runs
tests:
  - contract
  - integration
  - e2e
currentSlice: 01
nextSlice: 02
```

## Status values

- planned;
- shell;
- integrated;
- persisted;
- secured;
- verified;
- optimized;
- released;
- deprecated.

## Slice record

Every slice records:
- objective;
- files/packages changed;
- contracts touched;
- migrations;
- tests executed;
- known limitations;
- next slice.

This gives an AI coding agent a deterministic place to discover what is already implemented and what should be built next.

## Rule

The AI agent must never infer the next feature solely from filenames. It must read the feature manifest and architecture contracts first.