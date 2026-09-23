# AgentiCOS — Frontend Change Log

Append-only log for user-visible frontend changes and frontend architecture changes.

## Entry format

Every entry must contain:

- date;
- authorized implementation step;
- commit/PR;
- files changed;
- user-visible effect;
- architecture decision, if any;
- verification evidence;
- unverified checks;
- rollback point;
- exactly one next step.

## Baseline — 2026-09-23

The current repository already contains an early desktop UI from existing commits. This entry documents the baseline without changing its verification status.

### Existing Tauri/React/Vite surface
- Existing commit: `72ce3413693531b2e1c67c33152fe41a00897144`
- Existing work: Tauri 2 desktop shell, React + TypeScript + Vite frontend, basic chat/status/history components, Windows build foundation.
- Status: preserved; not reclassified as verified by this architecture operation.

### Existing Tailwind setup
- Existing commit: `bf3c919149d0c32589742840c27b330ff56587fa`
- Existing work: Tailwind CSS/PostCSS/Autoprefixer added to the desktop frontend.
- Status: preserved; not reclassified as verified by this architecture operation.

### Current architecture operation
- Authorized purpose: architecture/governance reconciliation and persistent frontend guidance.
- User-visible effect: no runtime UI behavior intentionally changed.
- Created: canonical architecture docs, frontend contract, local AI skills/playbooks, frontend verification gate.
- Modified: project-state/implementation-state/CI documentation and continuity controls.
- Deleted: none.
- Verification: static repository evidence only; CI for this new branch remains required before merge.
- Unverified: current runtime/build state on Windows and browser visual state.
- Rollback: branch base `bf3c919149d0c32589742840c27b330ff56587fa`.
- Next step: continue the single authorized implementation step recorded by `reference/manifests/implementation-state.json`.

## Command Center — 2026-09-24

- Authorized purpose: begin the requested premium desktop frontend slice while preserving the existing Rust-first runtime boundary.
- Branch: `feature/frontend-command-center`.
- User-visible effect: replaced the minimal prototype shell with a black/white command-center workspace featuring activity navigation, conversation explorer, agent panel, chat surface, runtime status bar and searchable command palette.
- Created:
  - typed runtime contracts in `src/types/runtime.ts`;
  - transport/service boundary in `src/services/runtime.ts`;
  - reusable icon and navigation primitives;
  - `CommandPalette` for workspace search and keyboard command access.
- Modified:
  - `src/App.tsx`;
  - `src/index.css`;
  - existing frontend components to use typed props and reusable primitives.
- Deleted: none.
- Preserved: legacy components remain in the repository history and were not destructively removed.
- Architecture decision: leaf UI components do not call provider APIs directly. Known current runtime endpoints are isolated behind `AgenticosRuntime`; no unsupported backend route was invented.
- Verification evidence: TypeScript/build and browser verification are pending for this branch; existing frontend architecture gate remains the baseline contract.
- Unverified checks: Windows/Tauri runtime, live backend availability, browser visual state, production CSP/Tauri permissions.
- Rollback point: `3e9e9358f438c1e028eb350921ae072b86696083`.
- Next step: run frontend typecheck/build and interactive browser verification for the Command Center branch.


## Command Center follow-up — 2026-09-24

- Authorized purpose: continue the premium frontend after merging the Command Center slice into main.
- Commit/PR: PR #20 merged as 988cc8b3a3c18089a22367147e5239ad13f7b28; follow-up hardening commits were applied directly to main.
- User-visible effect: added usable Files, Runs, Providers and Settings surfaces; persisted the last UI mode/session locally; added keyboard navigation to the command palette; exposed truthful runtime online/offline status; refined responsive provider layout and focus states.
- Created:
  - crates/presentation/desktop/frontend/src/components/FileExplorer.tsx;
  - crates/presentation/desktop/frontend/src/components/ProviderDashboard.tsx;
  - crates/presentation/desktop/frontend/src/components/RunTimeline.tsx.
- Modified:
  - crates/presentation/desktop/frontend/src/App.tsx;
  - crates/presentation/desktop/frontend/src/components/WorkspaceOverview.tsx;
  - crates/presentation/desktop/frontend/src/components/WorkspaceSidebar.tsx;
  - crates/presentation/desktop/frontend/src/components/AgentPanel.tsx;
  - crates/presentation/desktop/frontend/src/components/CommandPalette.tsx;
  - crates/presentation/desktop/frontend/src/index.css;
  - .github/workflows/ci.yml.
- Deleted: none.
- Preserved: existing legacy frontend components, runtime contracts, Rust runtime, provider implementation and historical evidence.
- Architecture decision: UI persistence is limited to non-sensitive presentation state. Provider credentials, model discovery, telemetry and run execution remain runtime-owned. Preview surfaces are explicitly labeled until live contracts exist.
- Verification evidence: GitHub accepted all direct main writes; frontend CI was strengthened to run nested npm ci and the real Vite production build.
- Unverified checks: latest main CI result after these changes, browser visual verification, Windows/Tauri runtime verification, live backend integration for provider/run surfaces.
- Rollback point: 988cc8b3a3c18089a22367147e5239ad13f7b28.
- Next step: evaluate the latest main CI run and record evidence without advancing Step 25 verification state.

## Product Studio expansion — 2026-09-24

- Scope: frontend-only product surface expansion; backend connectivity intentionally does not block visual or interaction work.
- User-visible effect: expanded the desktop shell from five navigation views to a broader AI IDE surface with Files & Editor, Terminal, Runs, Workflows, Artifacts, Providers & Models, Skills, Tools, Memory and Settings.
- Created: `crates/presentation/desktop/frontend/src/components/StudioSurface.tsx`.
- Modified: `ActivityRail.tsx`, `CommandPalette.tsx`, `WorkspaceOverview.tsx`, `App.tsx`, and `index.css`.
- Functionality added: local editor tabs and editing, diff preview, file filtering, run filtering/detail preview, provider selection, model search, skill/tool switches, memory pinning, workflow simulation, artifact selection/actions, terminal command simulation, settings toggles, notifications/toasts, expanded command search and keyboard navigation.
- Deleted: none.
- Preserved: existing chat/runtime integration, legacy components and repository history.
- Visual direction: monochrome black/white desktop IDE with dense engineering information hierarchy, hover/focus states, modal command palette, panes, tables, cards and responsive fallbacks.
- Verification evidence: GitHub writes accepted on `main`; CI run 654 was triggered from the frontend style commit and remained pending at the time of this entry.
- Unverified checks: final CI conclusion, browser screenshot verification, Windows/Tauri rendering, production accessibility audit.
- Rollback point: `988cc8b3a3c18089a22367147e5239ad13f7b28`.
- Next step: continue expanding high-value frontend surfaces while keeping all non-connected actions explicitly in preview/local state.

## Chat Surface expansion — 2026-09-24

- Scope: frontend-only interaction and visual polish.
- User-visible effect: upgraded chat into a richer agent workspace with model selector, attachment chips, composer tools, Web/Deep toggles, context chips, starter prompt grid and response actions.
- Modified: `crates/presentation/desktop/frontend/src/components/ChatSurface.tsx`, `crates/presentation/desktop/frontend/src/index.css`.
- Deleted: none.
- Preserved: chat runtime service boundary and all existing conversation behavior.
- Architecture decision: all new chat controls use presentation-local state until corresponding runtime contracts are intentionally introduced.
- Verification evidence: GitHub accepted the targeted frontend commits on `main`; CI was automatically triggered for the latest frontend commit.
- Unverified checks: latest CI conclusion, browser visual verification, Windows/Tauri rendering, accessibility audit.
- Rollback point: `4c035ecac4cff82cb08ff07790d20c22afb70099`.
- Next step: continue the frontend with richer approvals, observability and agent-control surfaces.

## Control & observability expansion — 2026-09-24

- Scope: frontend-only product expansion.
- User-visible effect: added Approvals, Observability, Agent Profiles and Prompt Lab to the main navigation and command palette.
- Modified: `crates/presentation/desktop/frontend/src/components/ActivityRail.tsx`, `CommandPalette.tsx`, `App.tsx`, `StudioSurface.tsx`, and `index.css`.
- Functionality added: approval queue/detail actions, telemetry cards/event stream, selectable agent profiles with local controls, prompt library/editor/variables, richer navigation grouping and keyboard access.
- Deleted: none.
- Preserved: all previous chat, editor, run, provider, skills, tools, memory, workflow, artifact, terminal and settings surfaces.
- Architecture decision: these features are fully interactive in presentation-local state and are not represented as live backend telemetry or permissions until contracts exist.
- Verification evidence: GitHub accepted the frontend changes on `main`; CI was triggered automatically for the latest commits.
- Unverified checks: latest CI conclusion, browser visual verification, Windows/Tauri rendering, accessibility audit.
- Rollback point: `4c035ecac4cff82cb08ff07790d20c22afb70099`.
- Next step: continue with richer workspace interactions and visual regression coverage.

## Configuration + Chat controls expansion — 2026-09-24

- Scope: frontend-only, maximizing visible configuration and chat tooling without requiring backend contracts.
- Created: `crates/presentation/desktop/frontend/src/components/SettingsSurface.tsx`.
- Modified: `StudioSurface.tsx`, `ChatSurface.tsx`, `ActivityRail.tsx`, `App.tsx`, `WorkspaceSidebar.tsx`, and `index.css`.
- Configuration sections added: General, Appearance, Editor, Chat, Agent, Tools, Safety, Context, Notifications, Privacy, Keyboard and Advanced.
- Configuration controls added: theme, density, font size, language, default model, default agent, context strategy, autosave, notifications, sound, motion, transparency, line numbers, word wrap, format-on-save, minimap, streaming, web-by-default, memory/draft persistence, creativity, autonomy, tool budget, tool visibility, confirmation policy, telemetry, crash reports, keymap, safety mode and advanced runtime/UI indicators.
- Chat controls added: agent selector, model selector, context scope, effort level, max output, temperature, Deep/Code/Web/Memory toggles, attachment strip, token estimate, tool picker, controls panel, richer starter prompts and response actions.
- Functionality is local/preview state and does not claim runtime permissions, provider telemetry or live model capability.
- Deleted: none.
- Preserved: existing chat integration, runtime service boundary, Product Studio surfaces and repository history.
- Verification evidence: GitHub accepted the frontend commits on `main`; CI run 676 was triggered from the cleanup commit.
- Unverified checks: latest CI conclusion, browser visual verification, Tauri/Windows rendering, accessibility audit.
- Rollback point: `60e0bdac13fe8ac5072a891abf4b0271fc67e215`.
- Next step: continue frontend-only work with richer side panels, previews, command surfaces and visual regression coverage.

