# AgentiCOS Frontend Architecture Map

## Purpose

This document is the canonical frontend organization contract for AgentiCOS while the backend/Rust runtime is being connected later.

The frontend must remain complete, navigable, typed, responsive, and truthful without inventing runtime capabilities.

## 1. Layer model

```
App shell
  ├─ Activity Rail
  ├─ Workspace Sidebar
  ├─ Workspace Main
  │   ├─ Command Center / Chat
  │   └─ Workspace Overview
  │       ├─ Platform Surface
  │       │   ├─ focused product surfaces
  │       │   └─ lazy-loaded feature modules
  │       └─ legacy Studio Surface (fallback/compatibility)
  ├─ Agent Inspector
  ├─ Workspace Dock
  ├─ Status Bar
  └─ Command Palette

Feature modules
  ├─ Build: files, editor, prompts, context, rules, codebase
  ├─ Operate: runs, tasks, agents, approvals, observability, workflows
  ├─ Configure: providers, models, skills, tools, memory, policies
  ├─ Integrate: MCP, browser, channels, credentials, environments
  └─ Control: QA, release, recovery, customization, help

Runtime boundary
  ├─ TypeScript runtime/service contracts
  ├─ Tauri command boundary
  └─ Rust/Tokio implementation (future/live integration)
```

## 2. Ownership rules

| Concern | Owner | UI may do | UI must not do |
| --- | --- | --- | --- |
| Navigation | navigation registry | select/render modes | duplicate route definitions without documentation |
| Presentation state | React/local UI services | preview, filtering, drafts | persist secrets |
| Runtime state | runtime service contract | display typed state | fabricate provider/execution results |
| Credentials | runtime/security layer | show metadata/masked state | expose or store raw secrets |
| Provider routing | runtime | render configuration preview | claim live routing without evidence |
| Agent execution | Rust/Tauri runtime | render lifecycle/control intent | execute commands from leaf UI |
| Verification | QA harness + CI/browser | record evidence | mark unexecuted checks as passed |
| Persistence | explicit persistence service | store safe UI preferences | silently persist sensitive data |

## 3. Navigation invariants

1. Every `NavigationItem.id` belongs to `RailMode`.
2. Every `PlatformMode` is present in `navigationItems`.
3. Every `platformModes` entry belongs to `PlatformMode`.
4. Every navigation ID is unique.
5. Generic/fallback surface branches must not shadow dedicated surfaces.
6. Heavy surfaces are lazy-loaded.
7. New modes require navigation metadata, route ownership, command-palette exposure, and QA coverage in the same change.
8. Removing a mode requires removing its metadata and route together; do not leave dead registry entries.

The pure audit helper in `src/navigation-audit.ts` exists to catch the first four classes of drift before runtime integration.

## 4. Feature-module contract

Each new feature should follow:

```
feature/
  ├─ Surface.tsx          # composition / route-level UI
  ├─ Surface.css          # feature-local styling when needed
  ├─ data.ts              # presentation fixtures only
  ├─ types.ts             # feature-local types
  └─ index.ts              # optional public feature boundary
```

Do not place provider calls, secret handling, shell execution, or filesystem mutation in leaf presentation components.

## 5. State model

Every substantial surface should represent these states explicitly where applicable:

- loading
- ready
- empty
- error
- offline
- reconnecting
- stale
- permission denied
- approval required

Preview-only actions must use local state and truthful labels such as `Preview`, `Staged`, or `Not connected`.

## 6. Verification gates

### Gate A — Static structure
- TypeScript types compile.
- Navigation audit reports no registry drift.
- No malformed escaped source sequences.
- No accidental duplicate route ownership.

### Gate B — Production build
- `npm ci`
- `npm run build`
- `git diff --check`

### Gate C — Browser/Tauri
- application boots;
- every primary route is reachable;
- lazy surfaces resolve;
- console/runtime errors are inspected;
- keyboard navigation works;
- reduced-width layout remains usable.

### Gate D — Release
Only evidence-backed checks may become `Ready`. Unexecuted checks remain `Not verified`.

## 7. Backend handoff contract

The frontend is being completed first. Backend integration later should replace presentation fixtures through typed adapters rather than changing component architecture.

Expected future path:

```
React feature surface
  -> typed frontend intent/state contract
  -> Tauri command adapter
  -> Rust application service
  -> Agent Engine / providers / tools / memory / event store
```

This keeps the visual product stable while the runtime is connected.

## 8. Change discipline

For every architecture/frontend change:

1. inspect current source;
2. identify the smallest compatible change;
3. preserve existing functionality;
4. update architecture/change evidence;
5. build or explicitly record why build evidence is unavailable;
6. never rewrite Git history;
7. merge through a normal PR when practical;
8. record exactly one next implementation step.

## 9. Current verification truth

The frontend build workflow has been hardened, but the latest main commit has not produced an observed workflow result through the available GitHub status interface. Therefore build/browser/Tauri verification must remain **unverified** until fresh evidence is available.
