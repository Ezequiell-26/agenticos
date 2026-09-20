# AgentiCOS Implementation Master Plan

This is the architecture-derived implementation order. It is designed to prevent features from being built on unstable abstractions.

**Foundation status:** the Rust workspace, canonical crate ownership, versioned protocol schemas, contract registry, reference catalog, sequential implementation manifest, executable architecture-readiness gate and Rust CI enforcement are now materialized. Functional implementation remains locked behind the architecture-foundation verification state.

## Phase 0 — Architecture, references, language and contracts

- finalize Product Blueprint and domain ownership;
- finalize Rust runtime decision;
- define cross-language protocol schemas;
- establish Rust workspace and crate boundaries;
- define stable IDs, correlation and event envelopes;
- define cancellation and error taxonomy;
- define protocol versioning;
- define provider/tool/sandbox/plugin contracts;
- define persistence ports;
- define architecture lint rules;
- establish the Reference Knowledge Corpus;
- fully ingest/index registered reference repositories at project level, with exact source provenance;
- create source evidence packs for the highest-value reference repositories;
- ingest the Rust token-optimization corpus and record license admission status.

Exit: the Rust workspace can be created without changing domain semantics, every critical boundary has a testable contract, and a coding agent can retrieve source evidence for each planned subsystem.

## Phase 1 — Rust kernel

Runtime lifecycle, dependency composition, event bus, cancellation tree, lifecycle state machines, configuration layers, policy primitives, persistence transaction boundary, structured logging, deterministic test clocks/IDs, explicit Rust trait boundaries and capability-safe dependency injection.

The kernel establishes an actor-like single-owner state machine for each durable Run. Parallel workers never mutate canonical Run state directly.

Exit: one durable run can start, transition, cancel, persist and recover through the canonical runtime with deterministic state reconstruction.

## Phase 2 — Provider gateway and model platform

Provider/protocol registries, hosted and local adapters, generic HTTP mapping, proxy hops, credential pools, model catalog, capability registry, quota/rate limits, quota-aware scheduling, cost, health/circuit breakers, intelligent multi-strategy routing, controlled failover, streaming and multimodal normalization.

Reference priority: FreeLLMAPI for gateway/provider/fallback/quota/catalog patterns; OmniRoute for multi-strategy routing, resilience, telemetry, quota-aware behavior and router evaluation; Hermes, DeepSeek Harness and Codex for provider/client integration patterns.

Exit: one model-neutral call path can route, stream, fail, retry and recover across multiple provider families.

## Phase 3 — Execution and security platform

Tool registry, policy/approval engine, attenuated capability issuance, scoped one-step grants, sandbox, local and worker executors, filesystem/process/browser adapters, network policy, secret isolation, artifact store and resource scheduler.

Source-derived and imported code remains untrusted and executes only through the Source Forge sandbox boundary.

Reference priority: Hermes, OpenHands and browser-use for tool/execution workflows; Codex for Rust-native runtime boundaries; OmniRoute for operational quality gates around gateway execution.

Exit: a real tool action executes inside policy and sandbox controls and produces an auditable event/artifact trail.

## Phase 4 — Agent runtime

Task/run lifecycle, context compiler, model/tool loops, verification, bounded repair, continuation, checkpoints, durable background execution, steering/interrupt and idempotent side effects.

AgentEngine owns orchestration. ModelProvider/ModelClient owns model transport. AgentTool owns typed tool execution. Neither layer may hide the other's responsibility.

Reference priority: Hermes, DeepSeek Harness and Codex.

Exit: a user can submit a real objective, watch it run, intervene, disconnect and resume it safely.

## Phase 5 — Knowledge platform

- token-aware context compilation, reversible compaction and content-addressed deduplication;
- structured encoding and delta-aware context synchronization where supported.

Session history, project/user memory, retrieval/reranking, compaction, skills, instruction hierarchy, provenance and deletion/correction controls.

Reference priority: Hermes for memory/skills patterns; LangGraph for checkpointed workflows where applicable; gcf-rust for MIT-admissible structured context encoding/delta/session dedup.

Exit: a project can accumulate controlled knowledge without silently promoting uncertain model output into durable facts.

## Phase 6 — Multi-agent

Child runs, DAG scheduler, fan-out/fan-in, delegation, reviewer/specialist agents, remote agent adapter, A2A, budget propagation and authority containment.

Reference priority: AutoGen, DeepSeek Harness, OmniRoute MCP/A2A patterns and A2A-compatible implementations.

Exit: child agents collaborate without bypassing parent budgets, security or provenance.

## Phase 7 — Interoperability

MCP, A2A, engine adapters, external agent bridges, generic protocol SDK, Python SDK and TypeScript SDK.

Exit: external tools and agents can participate through explicit, versioned trust boundaries.

## Phase 8 — Product surfaces

Application protocol, CLI, TUI, Web, Desktop, IDE, SDK/API gateway, messaging, artifact review, provider management, run timeline, approvals and diagnostics.

Exit: the same run works through at least one production-grade client and one headless interface.

## Phase 9 — Source Forge / Fusion

Repository import, dependency/license graph, language/package discovery, documentation and architecture extraction, symbol graph, test/quality-gate extraction, duplicate detection, capability comparison, compatibility analysis, evidence-pack generation, integration proposals, adaptation scaffolding, SBOM/notices, source refresh/diff and upstream regression.

Forge must also provide the untrusted-source execution boundary: isolated builds/tests/indexers, network/filesystem restrictions, ephemeral credentials, resource quotas and artifact scanning before source-derived components can be proposed for integration.

Exit: repositories can be evaluated and adapted without bypassing license or provenance gates.

## Phase 10 — Reliability and evaluation

Golden tasks, event/snapshot replay, deterministic external-effect injection, contract conformance, load testing, fault injection, worker/provider chaos tests, sandbox escape tests, prompt-injection tests, capability-reuse tests, quota/cost regression, router evaluation, compression evaluation, cache-invalidation regression, semantic-cache regression, upgrade/rollback and cross-language compatibility tests.

Exit: critical paths have repeatable evidence for functional, security and recovery behavior.

## Phase 11 — Distribution

Signed releases, plugin registry, update channels, rollback, desktop packaging, containers, remote workers, migration tooling and backward-compatible protocol policy.

Exit: users can install, update, recover and roll back supported distributions.

## Vertical-slice rule

Requirement
 → Reference evidence
 → Contract
 → Domain implementation
 → Persistence semantics
 → Policy/security
 → Observability
 → Verification
 → One usable surface
 → Recovery behavior

Implementation is slice-driven, not file-driven.

## Definition of done

A subsystem is production-ready only when it has contracts, state semantics, security policy, observability, retries/cancellation, migrations where needed, tests, compatibility documentation and an exercised user-facing or headless path.

## Foundation completeness gate

Phase 0 now includes the complete universal runtime seam baseline defined in [ARCHITECTURE-COMPLETENESS.md](./ARCHITECTURE-COMPLETENESS.md):

- auxiliary model roles;
- persistent terminal/PTY;
- generic background JobRuntime;
- filesystem Change Plane;
- SpillStore;
- multimodal Attachment plane;
- Code Intelligence/LSP;
- Goal/Plan/Task/TODO;
- Agent Teams;
- complete MCP resources/templates/prompts/transports;
- A2A remote-agent boundary;
- credentials/accounts/pools;
- profile and scope isolation;
- prompt stability and cache boundaries;
- trajectory derivation;
- supervisor/watchdog;
- migration/config evolution;
- feature vs capability flags;
- package/update/distribution lifecycle;
- AI Change Plane;
- management plane.

These are architecture contracts only. Their functional implementation remains distributed across later vertical slices and cannot begin before the sequential implementation gate unlocks each slice.

A feature that requires a new seam must first update the architecture contract, schema, completeness manifest and reference mapping before its functional step is created.

