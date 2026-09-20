# AgentiCOS Implementation Master Plan

This is the architecture-derived implementation order. It is designed to prevent features from being built on unstable abstractions.

## Phase 0 — Architecture, language and contracts

- finalize Product Blueprint and domain ownership;
- finalize Rust runtime decision;
- define cross-language protocol schemas;
- establish Rust workspace and crate boundaries;
- define stable IDs, correlation and event envelopes;
- define cancellation and error taxonomy;
- define protocol versioning;
- define provider/tool/sandbox/plugin contracts;
- define persistence ports;
- define architecture lint rules.

Exit: the Rust workspace can be created without changing domain semantics, and every critical boundary has a testable contract.

## Phase 1 — Rust kernel

Runtime lifecycle, dependency composition, event bus, cancellation tree, lifecycle state machines, configuration layers, policy primitives, persistence transaction boundary, structured logging and deterministic test clocks/IDs.

Exit: one durable run can start, transition, cancel, persist and recover through the canonical runtime.

## Phase 2 — Provider platform

Provider/protocol registries, hosted and local adapters, generic HTTP mapping, proxy hops, credentials, model catalog, capabilities, quota/rate limits, cost, health/circuit breakers, intelligent routing, streaming and multimodal normalization.

Exit: one model-neutral call path can route, stream, fail, retry and recover across multiple provider families.

## Phase 3 — Execution and security platform

Tool registry, policy/approval engine, sandbox, local and worker executors, filesystem/process/browser adapters, network policy, secret isolation, artifact store and resource scheduler.

Exit: a real tool action executes inside policy and sandbox controls and produces an auditable event/artifact trail.

## Phase 4 — Agent runtime

Task/run lifecycle, context compiler, model/tool loops, verification, bounded repair, continuation, checkpoints, durable background execution, steering/interrupt and idempotent side effects.

Exit: a user can submit a real objective, watch it run, intervene, disconnect and resume it safely.

## Phase 5 — Knowledge platform

Session history, project/user memory, retrieval/reranking, compaction, skills, instruction hierarchy, provenance and deletion/correction controls.

Exit: a project can accumulate controlled knowledge without silently promoting uncertain model output into durable facts.

## Phase 6 — Multi-agent

Child runs, DAG scheduler, fan-out/fan-in, delegation, reviewer/specialist agents, remote agent adapter, A2A, budget propagation and authority containment.

Exit: child agents collaborate without bypassing parent budgets, security or provenance.

## Phase 7 — Interoperability

MCP, A2A, engine adapters, external agent bridges, generic protocol SDK, Python SDK and TypeScript SDK.

Exit: external tools and agents can participate through explicit, versioned trust boundaries.

## Phase 8 — Product surfaces

Application protocol, CLI, TUI, Web, Desktop, IDE, SDK/API gateway, messaging, artifact review, provider management, run timeline, approvals and diagnostics.

Exit: the same run works through at least one production-grade client and one headless interface.

## Phase 9 — Source Forge / Fusion

Repository import, dependency/license graph, language/package discovery, architecture extraction, symbol graph, duplicate detection, capability comparison, compatibility analysis, integration proposals, adaptation scaffolding, SBOM/notices, source refresh/diff and upstream regression.

Exit: repositories can be evaluated and adapted without bypassing license or provenance gates.

## Phase 10 — Reliability and evaluation

Golden tasks, replay, contract conformance, load testing, fault injection, worker/provider chaos tests, sandbox escape tests, prompt-injection tests, quota/cost regression, upgrade/rollback and cross-language compatibility tests.

Exit: critical paths have repeatable evidence for functional, security and recovery behavior.

## Phase 11 — Distribution

Signed releases, plugin registry, update channels, rollback, desktop packaging, containers, remote workers, migration tooling and backward-compatible protocol policy.

Exit: users can install, update, recover and roll back supported distributions.

## Vertical-slice rule

```
Contract
 → Domain implementation
 → Persistence semantics
 → Policy/security
 → Observability
 → Verification
 → One usable surface
 → Recovery behavior
```

Implementation is slice-driven, not file-driven.

## Definition of done

A subsystem is production-ready only when it has contracts, state semantics, security policy, observability, retries/cancellation, migrations where needed, tests, compatibility documentation and an exercised user-facing or headless path.
