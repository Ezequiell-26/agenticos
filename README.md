<p align="center">
  <img src="./assets/agenticos-banner.svg" alt="AgentiCOS" width="100%">
</p>

# AgentiCOS

AgentiCOS is being designed as a universal, model-agnostic agent runtime and application platform.

## Architecture status

The architecture foundation, Rust kernel vertical slices 1–2, and architecture hardening are verified. The project is now moving into the first canonical AgentEngine vertical slice under the sequential verification protocol.

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

The durable kernel and architectural hardening layers are verified. Provider Engine and Source Forge prototypes remain transitional until their responsibilities are replaced or adapted behind canonical Rust contracts.

The only authorized product slice is `agent-engine-vertical-slice-1`. It must be implemented and verified before the provider-plane slice is unlocked.
