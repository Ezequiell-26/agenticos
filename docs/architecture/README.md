# AgentiCOS Architecture

This directory contains the architecture source of truth.

## Read first

1. [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
2. [PRODUCT-BLUEPRINT.md](./PRODUCT-BLUEPRINT.md)
3. [REPOSITORY-STRUCTURE.md](./REPOSITORY-STRUCTURE.md)
4. [IMPLEMENTATION-MASTER-PLAN.md](./IMPLEMENTATION-MASTER-PLAN.md)
5. [../adr/0006-rust-core-runtime.md](../adr/0006-rust-core-runtime.md)

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

## Construction rule

The product is built by vertical slices.

A slice is complete only when the intended surface or headless interface can exercise it and the applicable architecture gates pass.

The TypeScript implementation is transitional. New canonical runtime work targets the Rust workspace defined by the architecture.
