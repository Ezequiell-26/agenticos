# AgentiCOS — Frontend Architecture Contract

## Purpose

This document is the persistent frontend design contract for AgentiCOS. Future UI work must follow it and update the frontend changelog.

The current repository already contains an early Tauri + React + Vite + Tailwind surface. Existing code is preserved. Its presence does **not** imply that later frontend steps are verified.

## Canonical stack

| Concern | Canonical choice |
|---|---|
| Desktop shell | Tauri 2 |
| Native/backend runtime | Rust + Tokio |
| UI language | TypeScript |
| UI framework | React |
| Bundler/dev server | Vite |
| Code editor | Monaco Editor (target) |
| Component system | shadcn/ui-compatible primitives |
| Styling | Tailwind CSS with semantic tokens |
| Local UI state | Zustand or an equivalent small typed store (adopt only when justified) |
| AI UI | AI Elements / custom typed components |
| Browser verification | agent-browser |
| End-to-end policy | browser + Rust/backend evidence |
| Durable state | Rust runtime persistence, not React state |

The exact package versions are determined by the repository manifests and current verified dependency policy. Do not copy versions from memory.

## Product shell

The desktop product should evolve toward an IDE-grade workspace:

```
┌─────────────────────────────────────────────────────────────────┐
│ Activity / Window / Workspace                                   │
├──────────┬───────────────────────────────────────┬──────────────┤
│ Activity │ Explorer / Project / Search            │ Agent        │
│ Bar      ├───────────────────────────────────────┤ / Context    │
│          │ Tabs / Editor / Diff / Preview         │              │
│          ├───────────────────────────────────────┤              │
│          │ Terminal / Problems / Logs / Runs      │              │
├──────────┴───────────────────────────────────────┴──────────────┤
│ Status / model / run / provider / resource state                │
└─────────────────────────────────────────────────────────────────┘
```

The visual direction can learn from IDE, command-palette and AI-agent products, but AgentiCOS must retain its own information hierarchy and visual identity.

## Frontend boundaries

### UI layer

Contains:

- rendering;
- interaction;
- composition;
- accessibility;
- visual state.

Must not:

- own provider secrets;
- call provider APIs directly;
- contain retry/failover policy;
- mutate durable runtime state without a service boundary;
- embed model-specific routing logic.

### Service layer

All backend communication passes through typed service interfaces.

Initial service ports:

- `ChatService`
- `RunService`
- `ToolService`
- `ProviderService`
- `ModelService`
- `SkillService`
- `McpService`
- `MemoryService`
- `KnowledgeService`
- `RepositoryService`
- `SettingsService`

Transport implementations may be:

- Tauri IPC;
- local HTTP API;
- remote gateway.

The same UI service interface must be able to swap transport without rewriting feature components.

### State layer

Separate state into:

1. **ephemeral UI state** — selected panel, modal, input focus.
2. **session state** — active run, active chat, editor tabs.
3. **runtime state** — provider/model/run status returned by the backend.
4. **durable state** — persisted conversations, artifacts, checkpoints, knowledge.

Do not place durable runtime records only in React stores.

## Feature architecture

Each major feature owns its components, hooks, state adapters and service use. Cross-feature primitives belong in `components/shared` rather than being imported from another feature's internals.

Recommended feature slices:

- `chat`
- `agent-activity`
- `runs`
- `editor`
- `terminal`
- `problems`
- `git`
- `providers`
- `models`
- `tools`
- `mcp`
- `skills`
- `memory`
- `knowledge`
- `repositories`
- `settings`

## AI interaction contract

An agent run is a state machine, not a single string response.

The UI must be capable of displaying:

```
queued
→ planning
→ awaiting-approval
→ executing
→ tool-call
→ streaming
→ verifying
→ repairing
→ completed
```

Failure paths:

```
cancelled
failed
timed-out
blocked
recovery-required
```

Every visual state has a designed representation.

## Code/editor surface

The editor area should be prepared for:

- Monaco;
- multiple tabs;
- pinned/dirty state;
- file tree;
- search;
- diff viewer;
- problems;
- diagnostics;
- terminal;
- selection-driven agent actions;
- safe file mutations with preview and rollback metadata.

Editor commands must flow through the backend change-control contract.

## Security

Before production release:

- Tauri permissions are least-privilege;
- CSP is explicitly configured;
- no secrets are bundled in frontend assets;
- shell/process capabilities are scoped;
- external links are controlled;
- file operations require backend authorization;
- destructive operations require explicit confirmation;
- agent-generated mutations expose what changed and provide recovery evidence where applicable.

The current Tauri config contains a permissive development placeholder. It is not a production security baseline and must be hardened in its dedicated implementation step.

## Performance

The frontend must remain responsive under long-running agent work.

Use:

- incremental rendering;
- message virtualization where needed;
- lazy editor loading;
- bounded activity/history views;
- memoization only where measured;
- abort/cancellation propagation;
- no unbounded arrays for streaming/tool logs;
- backpressure at the service boundary.

Do not solve performance by hiding state or truncating data without recording the policy.

## Accessibility

Baseline:

- keyboard navigation;
- visible focus;
- semantic labels;
- proper button/input semantics;
- sufficient contrast;
- reduced-motion support where animation is used;
- screen-reader-compatible state changes;
- no hover-only critical functionality.

## Visual verification protocol

Whenever a frontend dev server is started:

1. open the exact local URL;
2. wait for network idle;
3. capture an interactive snapshot;
4. check for blank page/error overlays;
5. inspect console errors;
6. exercise the changed flow;
7. capture a screenshot when visual state matters;
8. close the browser session;
9. record evidence in the operation journal.

Use no more than two fix/retry cycles before diagnosing the underlying issue.

## Frontend change requirement

Every frontend change must update:

- `docs/architecture/FRONTEND-CHANGELOG.md`;
- the operation journal;
- the current implementation-state evidence when a step changes;
- relevant tests/evidence.

Do not edit UI first and document it later from memory.

## Prohibited drift

Do not:

- create parallel frontend apps;
- create a second state-management system without an ADR;
- place API calls directly in leaf components;
- introduce a second design-token system;
- add a UI library that duplicates existing primitives;
- move the canonical runtime into TypeScript;
- couple UI features to concrete provider names;
- commit secrets, tokens or machine-local paths.
