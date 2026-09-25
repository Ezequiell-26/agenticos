# AgentiCOS — Repository Structure

## Purpose

This file is the human-readable counterpart to `reference/manifests/architecture-dag.json`. Cargo membership, filesystem layout and the architecture manifest are intentionally kept in lockstep by `scripts/verify-architecture-boundaries.mjs`.

## Implemented layers

| Layer | Implemented crates | Responsibility |
|---|---|---|
| Domain | `brain`, `contracts` | Stable contracts, policy-level intelligence and model/tool-neutral abstractions. |
| Application | `agents`, `execution`, `scheduler`, `workflows` | User-facing use cases, execution orchestration, scheduling and workflows. |
| Infrastructure | `a2a`, `adapters`, `artifacts`, `browser`, `channels`, `context`, `evaluation`, `kernel`, `mcp`, `memory`, `observability`, `projects`, `protocols`, `providers`, `runtime`, `sandbox`, `security`, `source-forge`, `terminal`, `tools`, `workspace` | Concrete transports, persistence, runtime services, security, tools and integrations. |
| Presentation | `api-server`, `cli`, `desktop`, `gateway` | HTTP, CLI and desktop delivery surfaces. |
| Utilities | 18 cross-cutting crates | Reusable primitives that do not own product/domain behavior. |

## Important boundaries

`infrastructure/kernel` is a durable runtime boundary. `infrastructure/providers` is the canonical model/provider plane. `application/execution` owns reusable capability-gated native tool adapters so presentation surfaces do not implement tool behavior themselves.

`crates/infrastructure/kernel/src/agent_core.rs` is a transitional internal module extracted from the historical kernel monolith. It makes the agent implementation boundary explicit without pretending that the application-layer migration is already complete.

The root TypeScript tree under `src/` remains a transitional architecture/CLI prototype and is not the Rust product runtime. It must not become an undeclared production dependency.

## Planned, not implemented

The architecture manifest currently records `application/skills` and `infrastructure/plugins` / `infrastructure/router` as planned seams. Their absence from the implemented tree is intentional.

## Rules for future changes

1. Add a real crate before adding it to the implemented architecture list.
2. Every crate under `crates/` must be an explicit workspace member.
3. Move behavior toward its owning layer instead of introducing another compatibility implementation.
4. Keep transport and presentation code out of domain and application contracts.
5. Preserve rollback and journal evidence for destructive moves.
