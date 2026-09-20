# AgentiCOS Vertical Slice Catalog

This document defines how major product areas should be built incrementally.

## Example: Agent feature

The agent feature must not start by implementing the complete autonomous runtime. It starts with the smallest user-visible experience and grows through compatible slices.

### Agent Slice 01 — Window/surface

Deliver:
- agent workspace route/window;
- header/title;
- message area placeholder;
- input area placeholder;
- loading/error/empty states;
- navigation back to workspace.

Must use the final application routing and surface architecture.

Acceptance:
- application starts;
- agent page opens;
- no dead route;
- no console/runtime errors;
- responsive shell exists where applicable.

### Agent Slice 02 — Chat shell

Deliver:
- user message rendering;
- assistant message rendering;
- input submission;
- local temporary transcript using the canonical thread contract;
- loading state;
- error state.

A deterministic mock model may be used only as a test provider through the real Provider Contract.

Acceptance:
- user can submit a message;
- transcript updates;
- UI consumes protocol/domain objects rather than ad hoc UI state types.

### Agent Slice 03 — Persistent thread

Deliver:
- thread creation;
- durable messages/items;
- thread reload;
- thread list;
- reconnect after restart.

Acceptance:
- refresh/restart does not lose committed conversation state.

### Agent Slice 04 — Real provider

Deliver:
- Provider Registry;
- user-selected provider/model;
- credential reference;
- real model request;
- normalized assistant response.

Acceptance:
- at least one configured provider completes a real request through the Provider Contract.

### Agent Slice 05 — Streaming

Deliver:
- normalized stream events;
- incremental assistant message rendering;
- cancellation/interruption;
- final durable settlement.

Acceptance:
- stream can start, update, stop and complete without duplicate durable messages.

### Agent Slice 06 — Tools

Deliver:
- tool registry;
- tool call items;
- tool result items;
- execution state;
- timeout/error handling.

Acceptance:
- one safe read-only tool works end-to-end through the canonical tool pipeline.

### Agent Slice 07 — Approval and sandbox

Deliver:
- policy evaluation;
- approval request UI;
- sandbox execution;
- audit event.

Acceptance:
- a privileged tool can be blocked, approved or denied through the same runtime path.

### Agent Slice 08 — Context and skills

Deliver:
- bounded context compilation;
- project instructions;
- skill discovery/loading;
- provenance.

Acceptance:
- the agent can use a skill without UI-specific prompt logic.

### Agent Slice 09 — Memory

Deliver:
- persistent project/session memory;
- retrieval;
- explicit memory writes;
- deletion/update semantics.

Acceptance:
- relevant memory can be retrieved across sessions with provenance.

### Agent Slice 10 — Verification and repair

Deliver:
- verification stage;
- failure classification;
- repair loop;
- max attempts;
- final evidence.

Acceptance:
- agent success is determined by evidence, not self-reported text.

### Agent Slice 11 — Subagents

Deliver:
- child-run creation;
- scoped context;
- budgets;
- parallel execution;
- typed results.

Acceptance:
- a parent can delegate and merge a child result without sharing unrestricted state.

### Agent Slice 12 — Background runs

Deliver:
- queue;
- worker;
- durable status;
- reconnect;
- cancellation.

Acceptance:
- closing the UI does not lose a permitted durable run.

### Agent Slice 13 — Advanced interoperability

Deliver:
- MCP tools;
- A2A remote agent;
- external engine adapter;
- artifact exchange.

Acceptance:
- external capabilities use the same policy, identity, run and artifact model.

## Same rule for every major feature

Provider management, Source Forge, browser automation, workflows, memory, plugins, desktop and IDE support must follow the same shell → contract → real capability → persistence → security → verification progression.