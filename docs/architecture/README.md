# AgentiCOS Architecture

This directory contains the architecture source of truth.

## Read first

1. [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [PRODUCT-BLUEPRINT.md](./PRODUCT-BLUEPRINT.md)
3. [REFERENCE-KNOWLEDGE-CORPUS.md](./REFERENCE-KNOWLEDGE-CORPUS.md)
4. [REPOSITORY-STRUCTURE.md](./REPOSITORY-STRUCTURE.md)
5. [IMPLEMENTATION-MASTER-PLAN.md](./IMPLEMENTATION-MASTER-PLAN.md)
6. [TOKEN-OPTIMIZATION-ARCHITECTURE.md](./TOKEN-OPTIMIZATION-ARCHITECTURE.md)
7. [../adr/0006-rust-core-runtime.md](../adr/0006-rust-core-runtime.md)
8. [../adr/0007-token-optimization-rust.md](../adr/0007-token-optimization-rust.md)

## Core domains

- DOMAIN-MAP.md
- EXECUTION-MODEL.md
- PROVIDER-ARCHITECTURE.md
- SECURITY-SANDBOX.md
- CONTEXT-MEMORY-SKILLS.md
- MULTI-AGENT-ORCHESTRATION.md
- PROTOCOL-AND-SURFACES.md
- PERSISTENCE-RELIABILITY.md
- OBSERVABILITY-EVAL.md
- SOURCE-FORGE-ARCHITECTURE.md
- TOKEN-OPTIMIZATION-ARCHITECTURE.md

## Interoperability

- UNIVERSAL-AI-INTEROP.md
- AGENT-INTEROPERABILITY.md
- PROTOCOL-REGISTRY.md
- PLUGIN-SDK.md
- ENGINE-FUSION.md

## Reliability and change safety

- CONTRACTS.md
- KERNEL-DURABILITY.md
- STATE-RECOVERY.md
- ARCHITECTURE-ENFORCEMENT.md
- CHANGE-PLANE.md
- ITERATION-GATES.md
- NO-DEAD-ENDS.md
- QUALITY-ATTRIBUTES.md

## Reference-driven construction

The Reference Knowledge Corpus is mandatory input for non-trivial implementation work.

Current high-value references include Hermes Agent, DeepSeek Harness, OpenAI Codex, FreeLLMAPI, OmniRoute, AutoGen, OpenHands, browser-use, LangGraph and the Rust token-optimization corpus.

MIT-only implementation sources are admitted only after Source Forge license/dependency/provenance checks. Non-MIT sources remain reference-only unless a future architecture decision changes the admission policy.

FreeLLMAPI is the primary reference for the provider gateway/router domain, including provider aggregation, fallback, quota/rate tracking, model catalogs, compatibility and operational behavior.

GCF Rust is the primary MIT-admissible reference for compact structured context, session deduplication and delta encoding.

## Construction rule

The product is built by vertical slices.

A slice is complete only when the intended surface or headless interface can exercise it and the applicable architecture gates pass.

The TypeScript implementation is transitional. New canonical runtime work targets the Rust workspace defined by the architecture.

## Architecture foundation controls

- [ARCHITECTURE-READINESS.md](./ARCHITECTURE-READINESS.md) — structural readiness gate before functional implementation.
- [SEQUENTIAL-IMPLEMENTATION-PROTOCOL.md](./SEQUENTIAL-IMPLEMENTATION-PROTOCOL.md) — one-step-at-a-time implementation and fail-closed progression.
- [../adr/0008-sequential-verified-implementation.md](../adr/0008-sequential-verified-implementation.md) — accepted decision making sequential verification an architectural constraint.
- [../../reference/manifests/implementation-state.json](../../reference/manifests/implementation-state.json) — durable implementation-step state machine.
- [../../reference/manifests/mit-repositories.json](../../reference/manifests/mit-repositories.json) — machine-readable MIT-focused reference catalog.

