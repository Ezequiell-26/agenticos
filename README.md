<p align="center">
  <img src="./assets/agenticos-banner.svg" alt="AgentiCOS" width="100%">
</p>

# AgentiCOS

AgentiCOS is being designed as a universal, model-agnostic agent runtime and application platform.

## Architecture status

The architecture foundation and the first durable Rust kernel slice are implemented and verified. A controlled architecture-hardening step is now enforced before the next product vertical slice is unlocked.

## Non-negotiable implementation workflow

AgentiCOS is built sequentially:

`reference evidence → contract → implementation → persistence/security → verification → recovery → unlock exactly one next step`

An AI coding agent must never implement the whole project in one uncontrolled pass.

## Canonical runtime boundary

- **Rust:** kernel, runtime, execution, scheduling, security, persistence boundaries, providers, routing, context optimization and canonical protocols.
- **TypeScript:** Web/product surfaces and transitional prototype.
- **Python:** ecosystem integrations and SDK.
- **WASM:** selected portable isolated plugins.

## Reference-first development

Before implementing a non-trivial capability, the coding agent consults the Reference Knowledge Corpus and Source Forge evidence, using exact pinned source snapshots and license/provenance gates.

The machine-readable MIT-focused catalog is at [reference/manifests/mit-repositories.json](./reference/manifests/mit-repositories.json).

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first, then [docs/architecture/README.md](./docs/architecture/README.md), [docs/architecture/SEQUENTIAL-IMPLEMENTATION-PROTOCOL.md](./docs/architecture/SEQUENTIAL-IMPLEMENTATION-PROTOCOL.md) and [docs/architecture/ARCHITECTURE-READINESS.md](./docs/architecture/ARCHITECTURE-READINESS.md).

## Current state

Provider Engine and Source Forge prototypes exist in TypeScript. They remain transitional until their responsibilities are replaced or adapted behind the canonical Rust contracts.

The architecture verification gate has passed. The current hardening gate must pass before the next product vertical slice is unlocked.
