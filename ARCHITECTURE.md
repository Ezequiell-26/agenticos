# AgentiCOS — Product Architecture

Status: Architecture-first / hardened foundation.
This document is the source of truth for product architecture.

## Language and runtime decision

The canonical AgentiCOS core runtime is Rust, with Tokio as the target async runtime.

TypeScript is primarily for Web/product surfaces, Python for ecosystem integrations and SDKs, and WASM for selected portable sandboxed plugins.

The current TypeScript code is a transitional architecture prototype, not the final runtime boundary.

See docs/adr/0006-rust-core-runtime.md and docs/adr/0007-token-optimization-rust.md.

## MIT-only third-party implementation policy

AgentiCOS canonical product code may copy, vendor or directly adapt third-party source only when Source Forge has admitted the source as MIT-compatible after repository, file, dependency, notice and provenance review.

Non-MIT sources may be retained as **comparative reference evidence** for architecture analysis, test ideas or behavior comparison, but their source code must not enter canonical AgentiCOS implementation boundaries.

This policy applies across runtime, providers, tools, context, sandboxes, plugins, applications and SDKs. A future exception requires an explicit architecture decision and a corresponding licensing/provenance review.

## Reference-first implementation policy

AgentiCOS maintains an approved Reference Knowledge Corpus.

Before implementing a non-trivial capability, the coding agent must search the corpus, read relevant documentation/implementation/tests, extract applicable behavior and edge cases, and map those findings onto AgentiCOS contracts.

For registered repositories—especially MIT-licensed repositories—the learning process must inspect the relevant project documentation, source modules, tests, build/quality configuration, security material, licenses and third-party notices. Large repositories may be indexed/summarized, but exact implementation evidence must remain retrievable by file/symbol and pinned source snapshot.

See docs/architecture/REFERENCE-KNOWLEDGE-CORPUS.md and docs/architecture/AI-IMPLEMENTATION-CONTRACT.md.

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
26. Reference evidence must be traceable to an exact source snapshot.
27. Reference code cannot override AgentiCOS security, contracts or license policy.
28. Registered source repositories must be fully learned at the project level before they are treated as trusted implementation references.
29. Third-party source copied, vendored or directly adapted into canonical product code must pass the MIT-only source-admission gate; non-admitted repositories remain reference-only.
30. Token optimization must fail closed to original content when a transform cannot prove its safety contract.
31. Durable Run state has a single logical state owner; parallel workers communicate through versioned events rather than unsynchronized shared mutation.
32. Durable Run history is append-only and recoverable through snapshots plus event replay.
33. Capability grants are unforgeable, attenuated and bound to principal, run, step, tool and resource scope.
34. Source Forge executes imported code only inside an isolated untrusted-code boundary.
35. Canonical runtime responsibilities are separated into explicit Rust contracts; agent orchestration and model transport cannot be hidden inside each other.

## Product definition

AgentiCOS is a universal, model-agnostic agent operating layer. It turns user objectives into durable, observable and verifiable execution.

It combines models, providers, tools, sandboxes, browser/computer control, memory, skills, workflows, child agents, interoperability, artifacts, scheduling and developer surfaces behind one execution model.

Detailed scope: docs/architecture/PRODUCT-BLUEPRINT.md.

## Provider gateway and router

The provider platform includes a dedicated gateway/router layer.

AgentiCOS should cover:

- provider adapters;
- model catalog;
- capability registry;
- smart routing;
- multiple routing strategies;
- provider health;
- rate-limit and quota ledgers;
- quota-aware scheduling;
- cooldowns;
- key/account pools;
- controlled failover;
- retry/backoff;
- circuit breakers;
- degradation policies;
- streaming normalization;
- multimodal normalization;
- compatible API surfaces;
- local and custom OpenAI-compatible endpoints;
- routing telemetry and evaluation.

FreeLLMAPI is the primary reference for provider aggregation, model catalogs, quotas, fallback and compatibility.

OmniRoute is a primary reference for multi-strategy routing, resilience policy separation, telemetry, quota-aware behavior, router evaluation and operational quality controls.

AgentiCOS keeps these ideas behind Rust-owned contracts and does not depend on either project's internal implementation.

## Compression and cache plane

The provider/execution path may include optional, measurable optimizations for:

- prompt compression;
- tool-output compaction;
- semantic caching;
- exact-match caching;
- cache provenance;
- cache safety boundaries;
- explicit opt-in/feature flags;
- compression/evaluation benchmarks.

OmniRoute and FreeLLMAPI are references for relevant gateway optimization patterns.

## Architectural strategy

AgentiCOS uses a small microkernel with pluggable domains around it.

The kernel owns lifecycle, stable IDs, correlation, cancellation, event transport, contract/version negotiation, persistence boundaries, plugin lifecycle, capability primitives, policy hooks and normalized error/recovery semantics.

Feature domains must remain replaceable. The kernel never depends on a specific provider, UI, browser implementation or storage vendor.

## Primary object model

User/Profile -> Workspace -> Project -> Task -> Run -> Thread -> Turn -> Step -> Item -> Artifact.

A durable Task/Run owns execution. A Thread owns conversational/context lineage. A Turn is one model-driven work cycle. A Step is one model/tool iteration. Items are bounded observable units. Artifacts are durable outputs with provenance.

## Capability planes

Control plane       → lifecycle, policy, budgets, approvals
Model plane         → providers, models, routing, streaming, multimodal
Tool plane          → native tools, MCP, browser/computer, files, processes
Knowledge plane     → context, memory, retrieval, skills
Agent plane         → delegation, child runs, DAGs, A2A
Execution plane     → workers, sandboxes, resources, leases
Artifact plane      → files, media, reports, evidence, provenance
Integration plane   → plugins, SDKs, protocols, engine adapters
Source plane        → Source Forge, licensing, SBOM, fusion, reference corpus
Evaluation plane    → replay, golden tasks, regression, fault injection, router evaluation
Surface plane       → CLI, TUI, Web, Desktop, IDE, API, SDK, messaging

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

Model text alone never grants privileged capability.

## Durability and recovery

Runs use strict state machines. Retryable side effects use idempotency. Distributed execution uses leases/fencing. Durable events use outbox/inbox. Workspace mutations use snapshots/rollback.

The kernel depends on storage ports, not a database driver. SQLite is a local adapter; PostgreSQL and other transactional stores can be added behind the same semantics.

## Architecture completion rule

Before broad implementation, every major capability must have an owner, contract, state model, security boundary, persistence semantics and verification strategy.

The architecture is implementation-ready when those constraints are explicit and the next vertical slice has a clear entry/exit contract.

## Universal capability platform

The canonical runtime is extensible without modifying the AgentEngine loop. APIs, model providers, tools, toolsets, MCP servers, browser backends, plugins, skills, memory providers, workflows, channels, webhooks, schedules and external engines are modeled as versioned capabilities behind registries and protocols.

See [docs/architecture/UNIVERSAL-CAPABILITY-PLATFORM.md](./docs/architecture/UNIVERSAL-CAPABILITY-PLATFORM.md) and [reference/manifests/capability-parity.json](./reference/manifests/capability-parity.json).

The capability architecture explicitly covers the reusable platform patterns currently documented by Hermes Agent and DeepSeek Harness: pluggable extensions, progressive skills, memory providers, event-sourced sessions, guarded tool registries, scoped registration, messaging gateways, scheduling, webhooks, management APIs and IDE/ACP boundaries. These remain reference inputs; AgentiCOS contracts, security and sequencing rules remain authoritative. citeturn254296search0turn254296search3turn254296search5turn178395search0turn178395search2

