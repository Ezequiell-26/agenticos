# AgentiCOS Architecture

This directory contains the architecture source of truth.

## Documents

- ../.. / ARCHITECTURE.md — master architecture and invariants.
- DOMAIN-MAP.md — domain ownership and dependency boundaries.
- EXECUTION-MODEL.md — durable run/thread/turn/step/item execution.
- PROVIDER-ARCHITECTURE.md — multi-provider AI access and routing.
- SECURITY-SANDBOX.md — permissions, approvals and isolation.
- CONTEXT-MEMORY-SKILLS.md — context compilation, memory and procedural knowledge.
- PROTOCOL-AND-SURFACES.md — application protocol and all clients.
- PERSISTENCE-RELIABILITY.md — state, events, checkpoints, recovery and replay.
- SOURCE-FORGE-ARCHITECTURE.md — repository ingestion and open-source fusion.

## Order of design

1. Kernel contracts.
2. Runtime lifecycle.
3. Provider/tool/sandbox boundaries.
4. Context/memory/skills.
5. Persistence and recovery.
6. Application protocol.
7. Plugins and Source Forge.
8. Product surfaces.
9. Implementation.

## Architecture change rule

A feature that needs a new execution loop, new persistence system, new permission system or vendor-specific path must first be documented as an architectural change.

Architecture changes are recorded as ADRs.

## Iterative construction

The product is built by vertical slices. Read:

- ITERATION-ARCHITECTURE.md
- VERTICAL-SLICES.md
- FEATURE-MANIFEST.md
- DEPENDENCY-GRAPH.md
- ITERATION-GATES.md
- AI-IMPLEMENTATION-CONTRACT.md
- NO-DEAD-ENDS.md

For the Agent feature specifically, the canonical sequence is defined in `docs/features/agent/manifest.yml`: window → chat shell → persistence → real provider → streaming → tools → security/sandbox → context/skills → memory → verification/repair → subagents → background execution → interoperability.

A slice is not complete because code exists. It is complete when the user can exercise the feature through the intended surface and the implementation passes the applicable architecture gates.
