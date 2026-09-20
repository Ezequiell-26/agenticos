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