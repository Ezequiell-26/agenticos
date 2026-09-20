# AgentiCOS Architecture Readiness

## Locked architectural baseline

The architecture is considered structurally locked when all of the following exist and pass verification:

- canonical Rust workspace and explicit crate ownership;
- stable domain contracts;
- versioned wire protocols;
- durable event/snapshot/replay model;
- persistence ports independent of storage vendor;
- capability-based authorization and sandbox boundary;
- provider gateway/router boundary independent of model vendors;
- agent engine separated from model transport;
- token/context optimization boundary with fail-closed semantics;
- Reference Knowledge Corpus and Source Forge provenance boundary;
- MIT-only canonical third-party-source admission;
- sequential implementation state machine;
- architecture guard and CI enforcement;
- observable, replayable and recoverable vertical-slice definition of done;
- transition boundary for the TypeScript prototype.

## Architecture gate

```
architecture files
    ↓
contract registry
    ↓
protocol schemas
    ↓
Rust workspace
    ↓
crate ownership
    ↓
step-state manifest
    ↓
architecture guard
    ↓
Rust fmt/check/test
    ↓
CI
    ↓
ARCHITECTURE READY
```

A passing architecture gate does not mean the product is implemented. It means the project has enough deterministic structure to begin implementation without changing foundational semantics midstream.

## Mandatory pre-implementation condition

No functional Step 1 may begin until the architecture foundation is marked `VERIFIED` in `reference/manifests/implementation-state.json` by the project verification workflow.

## Canonical language boundary

- Rust: kernel, runtime, execution, scheduling, security, persistence ports/adapters, providers, router, context optimization, CLI/TUI and canonical protocols.
- TypeScript: Web/product surfaces and transitional prototype only.
- Python: ecosystem integrations/SDK.
- WASM: selected isolated portable plugins.

## Source boundary

Reference repositories are knowledge inputs. They are never authority over AgentiCOS contracts, security policy, sequencing or licensing.

## Change boundary

Architecture changes require an ADR and must update the affected contract/protocol/readiness gates before implementation resumes.
