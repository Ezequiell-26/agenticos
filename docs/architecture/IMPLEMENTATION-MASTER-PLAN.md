# AgentiCOS Implementation Master Plan

This is the architecture-derived implementation order. The order is intended to avoid building features on unstable abstractions.

## Phase 0 — Architecture and contracts

- kernel lifecycle contract;
- IDs/correlation;
- event envelope;
- cancellation;
- error taxonomy;
- protocol versioning;
- plugin contract;
- provider contract;
- tool contract;
- sandbox contract;
- memory/skill/workflow contracts;
- artifact contract;
- engine adapter contract.

Exit: all domain boundaries documented and contract tests can be designed.

## Phase 1 — Kernel

- runtime lifecycle;
- dependency container/plugin host;
- event bus;
- cancellation tree;
- state machine;
- configuration layers;
- policy primitives;
- persistence transaction boundary.

## Phase 2 — Provider platform

- provider registry;
- protocol registry;
- OpenAI Chat adapter;
- OpenAI Responses adapter;
- Anthropic Messages adapter;
- Gemini native adapter;
- local adapters;
- generic HTTP adapter;
- proxy-hop pipeline;
- credential pools;
- model catalog;
- capability registry;
- quota/rate-limit engine;
- cost engine;
- health/circuit breaker;
- intelligent router;
- streaming normalization.

## Phase 3 — Execution platform

- tool registry;
- permission engine;
- sandbox interface;
- local executor;
- worker executor;
- filesystem;
- process;
- browser;
- network;
- artifact store;
- resource scheduler.

## Phase 4 — Agent runtime

- task/run lifecycle;
- context compiler;
- model act loop;
- tool loop;
- verification;
- repair;
- continuation;
- checkpoints;
- durable background runs;
- steering/interrupt.

## Phase 5 — Knowledge

- session history;
- project memory;
- user memory;
- retrieval;
- reranking;
- context compaction;
- skills;
- instruction hierarchy;
- source/provenance tracking.

## Phase 6 — Multi-agent

- child runs;
- DAG scheduler;
- parallel fan-out/fan-in;
- delegation;
- reviewer agents;
- remote agent adapter;
- A2A client/server;
- budget propagation.

## Phase 7 — Interoperability

- MCP client/server;
- MCP Tasks/extensions/apps where applicable;
- A2A v1;
- engine adapters;
- external agent bridges;
- generic protocol adapter SDK.

MCP should be treated as the vertical tool/context plane; A2A as the horizontal agent collaboration plane. citeturn902940search3turn902940search4

## Phase 8 — Product surfaces

- application protocol;
- CLI;
- TUI;
- Web;
- Desktop;
- IDE;
- SDK;
- API gateway;
- messaging channels;
- artifacts review UI;
- provider management UI;
- run timeline UI.

## Phase 9 — Source Forge / Fusion

- complete repository import;
- dependency/license graph;
- language/package discovery;
- architecture extraction;
- symbol graph;
- duplicate detection;
- capability comparison;
- component compatibility;
- integration proposals;
- automated adaptation scaffolding;
- provenance/SBOM/notices;
- source refresh/diff;
- regression against upstream snapshots.

## Phase 10 — Reliability and evaluation

- golden tasks;
- replay;
- contract conformance;
- load tests;
- fault injection;
- chaos tests for workers/providers;
- sandbox escape tests;
- prompt-injection tests;
- cost/quota regression;
- upgrade/rollback tests.

## Phase 11 — Distribution

- signed releases;
- plugin registry;
- update channels;
- rollback;
- desktop packaging;
- containers;
- remote workers.

## Definition of done

A subsystem is production-ready only when it has contracts, state semantics, security policy, observability, retries/cancellation, migrations where needed, tests and compatibility documentation.