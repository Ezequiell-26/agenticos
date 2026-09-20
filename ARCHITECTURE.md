# AgentiCOS — Product Architecture

Status: Architecture-first / hardened foundation.
This document is the source of truth for product architecture.

## Language and runtime decision

The canonical AgentiCOS core runtime is **Rust**, with Tokio as the target async runtime.

TypeScript is primarily for Web/product surfaces, Python for ecosystem integrations and SDKs, and WASM for selected portable sandboxed plugins.

The current TypeScript code is a transitional architecture prototype, not the final runtime boundary.

See [ADR-0006](./docs/adr/0006-rust-core-runtime.md).

## Global invariants

1. No model vendor is hard-coded into the agent core.
2. No tool bypasses policy and sandbox infrastructure.
3. No secret is placed into model context accidentally.
4. No UI contains a second agent loop.
5. Durable state never exists only in UI memory.
6. Every model-visible input has provenance.
7. Every external action has a run/item identity.
8. Child agents are isolated and budgeted.
9. Context has explicit size limits.
10. Provider failures are recoverable.
11. Plugin activation failure cannot corrupt the runtime.
12. Third-party source provenance is preserved.
13. Persisted schema changes are versioned and migratable.
14. Dangerous permissions are explicit.
15. A disconnected client does not imply a lost background run.
16. Illegal state transitions are rejected.
17. Retryable side effects use idempotency keys.
18. Worker ownership is protected by leases and fencing.
19. Durable event publication uses an outbox/inbox boundary.
20. AI-generated code changes pass Change Plane gates before promotion.
21. Execution and repair loops are bounded by explicit budgets.
22. Workspace changes have a rollback/snapshot path.
23. Cross-language behavior is defined by versioned protocols, not internal structs/classes.
24. Prototype code cannot become an undeclared production dependency.
25. No capability is considered complete until it has an executable vertical slice and recovery semantics.

## Product definition

AgentiCOS is a universal, model-agnostic agent operating layer. It turns user objectives into durable, observable and verifiable execution.

It combines models, providers, tools, sandboxes, browser/computer control, memory, skills, workflows, child agents, interoperability, artifacts, scheduling and developer surfaces behind one execution model.

Detailed scope: [PRODUCT-BLUEPRINT.md](./docs/architecture/PRODUCT-BLUEPRINT.md).

## Architectural strategy

AgentiCOS uses a small microkernel with pluggable domains around it.

The kernel owns lifecycle, stable IDs, correlation, cancellation, event transport, contract/version negotiation, persistence boundaries, plugin lifecycle, capability primitives, policy hooks and normalized error/recovery semantics.

Feature domains must remain replaceable. The kernel never depends on a specific provider, UI, browser implementation or storage vendor.

## Primary object model

User/Profile -> Workspace -> Project -> Task -> Run -> Thread -> Turn -> Step -> Item -> Artifact.

A durable Task/Run owns execution. A Thread owns conversational/context lineage. A Turn is one model-driven work cycle. A Step is one model/tool iteration. Items are bounded observable units. Artifacts are durable outputs with provenance.

## Capability planes

```
Control plane       → lifecycle, policy, budgets, approvals
Model plane         → providers, models, routing, streaming, multimodal
Tool plane          → native tools, MCP, browser/computer, files, processes
Knowledge plane     → context, memory, retrieval, skills
Agent plane         → delegation, child runs, DAGs, A2A
Execution plane     → workers, sandboxes, resources, leases
Artifact plane      → files, media, reports, evidence, provenance
Integration plane   → plugins, SDKs, protocols, engine adapters
Source plane        → Source Forge, licensing, SBOM, fusion
Evaluation plane    → replay, golden tasks, regression, fault injection
Surface plane       → CLI, TUI, Web, Desktop, IDE, API, SDK, messaging
```

Each plane has an explicit owner and communicates through contracts rather than hidden cross-plane dependencies.

## Universal interoperability

The core accepts any model/service that can be represented by an existing adapter or new plugin.

The Provider layer separates model, provider, account/credential, endpoint, proxy/gateway hop, protocol and capabilities.

## Agent interoperability

MCP is the vertical capability plane for tools/context/integrations. A2A is the horizontal collaboration plane for independent agents. Remote agents are untrusted external principals.

## Resource and autonomy

Every run can be bounded by duration, steps, child agents, tool calls, tokens, cost and infrastructure resources.

Autonomy is policy-controlled. A child agent cannot acquire more authority than its parent policy permits.

## Security model

```
User intent
  ↓
Policy
  ↓
Capability grant
  ↓
Tool authorization
  ↓
Sandbox
  ↓
Execution
  ↓
Audit event
```

Model text alone never grants privileged capability.

## Durability and recovery

Runs use strict state machines. Retryable side effects use idempotency. Distributed execution uses leases/fencing. Durable events use outbox/inbox. Workspace mutations use snapshots/rollback.

The kernel depends on storage ports, not a database driver. SQLite is a local adapter; PostgreSQL and other transactional stores can be added behind the same semantics.

## Architecture completion rule

Before broad implementation, every major capability must have an owner, contract, state model, security boundary, persistence semantics and verification strategy.

The architecture is implementation-ready when those constraints are explicit and the next vertical slice has a clear entry/exit contract.
