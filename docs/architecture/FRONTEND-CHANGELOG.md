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



## Cursor + Hermes frontend platform integration — 2026-09-24

- Scope: frontend-only integration of documented Cursor/Hermes-style product capabilities into the existing AgentiCOS desktop experience.
- User-visible effect: expanded navigation from the existing Studio views into a complete agent workspace covering project orchestration, codebase indexing, explicit context packs, rules/instructions, background agents, review/Bugbot workflows, checkpoints, specialist bot teams, automations, gateway channels, browser control, voice/media, research batches, MCP servers and a dedicated security center.
- Created:
  - `crates/presentation/desktop/frontend/src/navigation.ts` as the single navigation/type registry.
  - `crates/presentation/desktop/frontend/src/components/ChatEnhancementDock.tsx` for context references, slash-style commands, background/checkpoint/branch actions and response-format controls.
  - `crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx` as the feature-oriented platform surface for the newly added domains.
  - `docs/architecture/FRONTEND-PLATFORM-ARCHITECTURE.md` as the durable structure/contract map.
- Modified:
  - `App.tsx`, `ActivityRail.tsx`, `CommandPalette.tsx`, `WorkspaceOverview.tsx`, `ChatSurface.tsx`, `Icon.tsx`, `index.css`.
- Architecture decision:
  - navigation metadata is centralized to prevent drift between rail, command palette and application state;
  - new product domains live under `features/platform` rather than expanding the existing Studio monolith;
  - presentation-only controls are explicitly preview/local and do not claim live backend permissions, model telemetry, cloud execution or messaging delivery;
  - existing runtime service contracts remain the only live integration path.
- Reference basis: current public Cursor documentation/product material on Agent/Cloud Agents, codebase indexing, Rules, agent security and memories; current public Hermes documentation on tools/toolsets, skills, persistent memory, context files, checkpoints, cron, delegation, browser, voice, MCP and multi-platform gateway.
- Verification evidence:
  - frontend code committed to `main` in `8b8d134ec1a50d3f60f1cbc82ae5edbd329962f7`;
  - platform type-guard hardening committed in `9379aa4cd577f200dafbc9e919a1809b9245c22d`;
  - GitHub Actions run `#681` is the current CI run for `main` and was `in_progress` when this entry was recorded.
- Unverified checks: final CI conclusion, browser visual verification, Windows/Tauri rendering, accessibility audit and real backend contract integration for new surfaces.
- Rollback point: `19bc9d373dba412d45a021c193268a82159cf526`.
- Next step: inspect the latest CI result and use browser-level verification on the new navigation and highest-value platform views before introducing live contracts.


## Platform build hardening — 2026-09-24

- Scope: repair and verification hardening after the Cursor + Hermes platform expansion.
- Commit: `5f29373c3dd800c8deb60ee3b7163f646b762533`.
- User-visible effect: completed the missing platform icon primitive, connected the chat enhancement dock import correctly, repaired the preview typing model for heterogeneous UI records, and removed a malformed serialized newline from the chat composer.
- Modified: `ChatSurface.tsx`, `Icon.tsx`, `StudioSurface.tsx`, `PlatformSurface.tsx`, `navigation.ts`.
- Architecture decision: preview data collections use explicit readonly tuple types where needed, and the platform type guard uses a readonly set over the complete RailMode domain.
- Verification evidence: GitHub Actions run `#690` reports the **TypeScript/frontend build step as success**, including `npm run build --prefix crates/presentation/desktop/frontend`; Rust verification was still running when recorded.
- Unverified checks: final overall CI conclusion, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: `19bc9d373dba412d45a021c193268a82159cf526`.
- Next step: complete the final CI run and then perform browser-level verification for navigation and agent workspace flows.


## Cursor + Hermes control-plane depth — 2026-09-24

- Scope: frontend-only continuation of the public Cursor/Hermes capability integration.
- Commits: `e400b26958f926d5143ee2675d8553d6c937d2ac` and `ac892d48b8f520a6918eb104b8808d16ddfb6c5e`.
- User-visible effect: added a dedicated Agent/Plan/Ask/Debug/Bot mode strip, expanded slash-style commands and session controls, centralized persisted navigation across all frontend modes, and added platform surfaces for Plugins, Hooks & Policies, Batch Processing, Learning Loop, Execution Lab, Environments and Source Integrations.
- Architecture decision: chat-specific composition is under `features/chat`; platform-wide capability views are under `features/platform`; navigation remains a single typed registry consumed by rail, command palette and app state.
- Safety/accuracy decision: all newly added surfaces are explicit local/preview UI and do not invent runtime endpoints, provider credentials, cloud execution or messaging delivery.
- Verification evidence: architecture gate and TypeScript/Vite production build passed during CI run `#690`; subsequent run `#693` exposed one ownership-type mismatch and was corrected in `ac892d48b8f520a6918eb104b8808d16ddfb6c5e`; latest global run is `#694`.
- Unverified checks: final global CI conclusion for `ac892d48b8f520a6918eb104b8808d16ddfb6c5e`, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: `19bc9d373dba412d45a021c193268a82159cf526`.
- Next step: complete the final CI gate and then proceed to browser-level visual regression coverage.


## Frontend product completion pass — 2026-09-24

- Scope: frontend-only product completion and usability pass.
- Commits included: adaptive panel layout, product administration surfaces, evaluation/notification/presence views, platform data/primitives refactor, feature launcher and task planning.
- User-visible effect: the desktop product now exposes a searchable catalog of 49 visual surfaces across build, operate, configure and integrate planes, with chat execution tracing, session actions, panel focus controls, task tracking and grouped navigation.
- Added visual domains: Sessions, Logs & Traces, Analytics, Webhooks & Events, Credentials metadata, Toolsets, Imports & Migrations, Media Studio, Evaluations, Notifications, Wake Word & Presence and Tasks.
- Architecture decision: the navigation registry is centralized; platform data is separated from rendering; shared platform primitives are reusable; chat-specific execution UI is isolated under `features/chat`.
- UX decision: the primary rail remains compact while the AgentiCOS logo opens a searchable all-features launcher grouped by workflow plane.
- Runtime boundary: all newly introduced controls remain presentation-local/preview until corresponding Rust service contracts are deliberately added.
- Verification evidence: previous CI run `#690` passed the TypeScript/Vite build after the earlier platform hardening; subsequent CI runs are being re-triggered as the frontend grows. Current main verification is tracked separately and must not be inferred from the presence of committed UI code.
- Unverified: current final CI conclusion, browser visual verification, Windows/Tauri rendering, accessibility audit and live backend integration.
- Rollback point: `19bc9d373dba412d45a021c193268a82159cf526`.
- Next step: after the current CI gate, run browser-level visual verification against the desktop frontend before adding live runtime contracts.

## Frontend UX phase — 2026-09-24

- Branch: `frontend/ux-phase-next` (PR #21, target `main`).
- Scope: presentation-only UX expansion; no new backend routes or runtime contracts.
- Added: richer chat composer with slash commands, draft persistence, response format, reasoning/citation toggles and token budget indicator.
- Added: dedicated Agent Profiles studio with behavior, tools, policy and evaluation views.
- Added: dedicated Prompt Lab with library, variables, versions and test views.
- Added: Security Center, Provider Studio, Browser Workspace, Memory Studio, Skills Studio, Tools Studio, Workflow Builder and Artifact Viewer to the broader product surface map.
- Coverage: navigation registry contains 49 surfaces and all 49 currently resolve to a frontend surface.
- Verification: PR checks for TypeScript and Rust are queued as of the branch HEAD; browser CLI verification is unavailable in this environment; Windows/Tauri rendering and live runtime integration remain unverified.
- Runtime boundary: new interactions remain local/preview until a matching runtime contract is intentionally added.


## Frontend interaction hardening — 2026-09-24

- Scope: frontend-only navigation ergonomics, chat recovery and accessibility polish.
- User-visible effect: reduced the activity rail to a compact primary set while retaining all 49 product surfaces in the launcher/command palette; the currently active secondary surface is still surfaced in the rail.
- Reliability improvement: failed chat runtime requests now create a visible system message, reset the run state to failed, restore the unsent draft and keep the composer focused for retry.
- Usability improvement: chat message history auto-scrolls to the latest activity without introducing a new runtime dependency.
- Accessibility improvement: added explicit focus treatment for the compact rail and quick actions, plus reduced-motion handling.
- Modified:
  - crates/presentation/desktop/frontend/src/navigation.ts
  - crates/presentation/desktop/frontend/src/components/ActivityRail.tsx
  - crates/presentation/desktop/frontend/src/App.tsx
  - crates/presentation/desktop/frontend/src/components/ChatSurface.tsx
  - crates/presentation/desktop/frontend/src/index.css
  - docs/architecture/FRONTEND-PLATFORM-ARCHITECTURE.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Runtime boundary: no new backend routes, provider calls or runtime contracts were introduced.
- Verification state: branch build/CI and browser verification remain separate gates; main CI run #728 was still in progress before this branch was created.
- Rollback point: 8ad7f3864e308109da5ff9ef69c6f8689d03630b.
- Next step: validate the branch with the repository CI and browser-level smoke checks before merging.


## Cursor + Hermes complete capability surface pass — 2026-09-24

- Scope: frontend-only expansion based on current public Cursor and Hermes capability families.
- Added first-class visual surfaces for Canvas, reusable Commands, isolated Subagents, Cloud Agents, Computer Use, Operations Center, Kanban and Marketplace.
- Added explicit integration surfaces for Home Assistant and Social/X Search.
- Expanded the Skills catalog with current Cursor built-in workflow skills such as automate, autopilot, canvas, create-hook, create-rule, create-skill, create-subagent, review-bugbot, review-security and loop.
- Expanded the Tools catalog with Hermes-style web, browser, terminal/process, memory/session search, delegation, cron, skills management, multimodal, computer-use, social, messaging, Home Assistant, Spotify, Discord, Kanban and desktop GUI families.
- Expanded chat slash-command affordances for delegation, rollback, memory, session search, cron, skills, tools, MCP, browser and gateway workflows.
- Modified:
  - crates/presentation/desktop/frontend/src/navigation.ts
  - crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx
  - crates/presentation/desktop/frontend/src/features/canvas/CanvasStudio.tsx
  - crates/presentation/desktop/frontend/src/features/commands/CommandStudio.tsx
  - crates/presentation/desktop/frontend/src/features/subagents/SubagentFleet.tsx
  - crates/presentation/desktop/frontend/src/features/cloud/CloudAgentsWorkspace.tsx
  - crates/presentation/desktop/frontend/src/features/computer/ComputerUseWorkspace.tsx
  - crates/presentation/desktop/frontend/src/features/operations/OperationsCenter.tsx
  - crates/presentation/desktop/frontend/src/features/marketplace/MarketplaceStudio.tsx
  - crates/presentation/desktop/frontend/src/features/kanban/KanbanBoard.tsx
  - crates/presentation/desktop/frontend/src/features/integrations/IntegrationCatalogSurface.tsx
  - crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx
  - crates/presentation/desktop/frontend/src/features/tools/ToolsStudio.tsx
  - crates/presentation/desktop/frontend/src/components/ChatEnhancementDock.tsx
  - crates/presentation/desktop/frontend/src/components/ChatSurface.tsx
  - crates/presentation/desktop/frontend/src/index.css
  - docs/architecture/FRONTEND-PLATFORM-ARCHITECTURE.md
- Deleted: none.
- Runtime boundary: all newly surfaced capabilities remain presentation-local/preview; no backend routes, provider secrets or external credentials were invented.
- Verification state: current CI is the authoritative gate; browser/Tauri/accessibility verification remains separate.
- Rollback point: f4e66960c5fcf728b9f4cae59802e4f8c905fe2e.
- Next step: validate the complete capability surface in CI and then browser-level smoke coverage.


## Capability catalog completion pass — 2026-09-24

- Scope: frontend-only completion of the Cursor/Hermes capability catalog.
- Navigation registry now exposes 59 user-facing surfaces across Build, Operate, Configure and Integrate.
- Added/remapped visual domains: Canvas, Commands, Subagents, Cloud Agents, Computer Use, Operations Center, Kanban, Marketplace, Home Assistant and Social Search.
- Expanded the gateway presentation to include the major Hermes messaging/client families plus Cursor remote clients and engineering triggers.
- Expanded Cursor skill coverage and Hermes tool catalog coverage, while keeping external credentials and runtime execution behind explicit backend boundaries.
- Verification state: latest GitHub Actions run remains authoritative; no claim of full runtime parity or live external integration is made by the frontend.
## Workspace orchestration dock — 2026-09-24

- Scope: frontend-only desktop workspace refinement; no Rust/backend contracts changed.
- User-visible effect: added a universal bottom dock available across the desktop shell with Terminal, Problems, Timeline and Output views, plus maximize/restore controls and a compact runtime/mode context.
- Interaction added: `Ctrl+J` toggles the dock; the terminal tab supports local preview commands (`help`, `status`, `clear`) without executing host processes.
- Created:
  - `crates/presentation/desktop/frontend/src/components/WorkspaceDock.tsx`
  - `crates/presentation/desktop/frontend/src/workspace-enhancements.css`
- Modified:
  - `crates/presentation/desktop/frontend/src/App.tsx`
  - `crates/presentation/desktop/frontend/src/main.tsx`
- Deleted: none.
- Preserved: Rust runtime, existing runtime service contracts, existing navigation/features, current implementation-state manifest and historical frontend evidence.
- Architecture decision: the dock is a presentation-layer composition surface and keeps terminal/problem/timeline data explicitly local/preview until matching runtime services exist.
- Verification evidence: source-level integration checks completed for imports, state wiring, keyboard shortcut and dock render path; CI will validate the integrated tree.
- Unverified checks: browser visual verification, Windows/Tauri rendering, accessibility audit and live backend integration.
- Rollback point: `b638e6d7d31b510707fd89e9a577e36043d512a2`.
- Next step: inspect the integrated CI/build result, then perform browser-level visual verification when a runnable frontend is available.
## Frontend hardening: recovery and route coverage — 2026-09-24

- Scope: frontend-only reliability and governance hardening.
- User-visible effect: added a shell-level render recovery screen so a React rendering failure becomes a recoverable workspace state instead of a blank desktop surface.
- Architecture correction: the legacy compatibility chat now receives an injected `onSend` service operation and contains no direct HTTP/API call.
- Governance correction: `scripts/verify-frontend-architecture.mjs` now checks that every registered navigation mode resolves to a visual route, verifies shell safeguard files, and rejects direct HTTP calls from the compatibility chat component.
- Created:
  - `crates/presentation/desktop/frontend/src/components/AppErrorBoundary.tsx`
- Modified:
  - `crates/presentation/desktop/frontend/src/components/ChatInterface.tsx`
  - `crates/presentation/desktop/frontend/src/main.tsx`
  - `crates/presentation/desktop/frontend/src/index.css`
  - `scripts/verify-frontend-architecture.mjs`
- Deleted: none.
- Preserved: all 59 navigation surfaces, Cursor/Hermes-inspired feature work, Rust runtime, runtime service contracts and sequential implementation state.
- Verification evidence: source inspection confirms the recovery wrapper, service-boundary chat signature and route-coverage verifier are present.
- Unverified checks: latest CI conclusion, browser visual verification, Windows/Tauri rendering and full accessibility audit.
- Rollback point: `8e8a907792883deeab37661b0189909c47c21014`.
- Next step: use the resulting CI evidence to complete browser-level visual regression coverage of the primary workspace flows.

## 2026-09-24 — Frontend build recovery

- Fixed Settings persistence typing by declaring the stored `defaultMode` preference alongside the other settings fields.
- Fixed Subagent Fleet selection typing by deriving the selected ID from the immutable subagent registry instead of narrowing state to the first item.
- Purpose: restore the nested Vite/TypeScript build after CI surfaced concrete type errors; no runtime transport or backend contracts changed.

## 2026-09-24 — Frontend dead-surface cleanup

- Removed five unreferenced legacy components: `AgentStatus`, `ConversationHistory`, `FileExplorer`, `ProviderDashboard` and `RunTimeline`.
- Preserved `ChatInterface` because it remains a compatibility artifact required by the architecture verifier.
- Preserved `ChatEnhancementDock` because `ChatSurface` still consumes it.
- Removed the duplicate `/compact` command entry to avoid duplicate React list keys and conflicting command rows.
- Purpose: keep one authoritative implementation per active product surface and prevent stale component copies from accumulating.

## Visual system + iconography polish — 2026-09-24

- Scope: frontend-only visual quality pass over the existing desktop shell; no runtime contracts or provider behavior changed.
- User-visible effect: upgraded the monochrome interface with a more disciplined visual hierarchy, refined surface depth, cleaner focus/hover/active states, more consistent controls, polished scrollbars, reduced-motion behavior and stronger desktop shell cohesion.
- Iconography:
  - expanded the local SVG icon set with dedicated Home, File Code, Database, Network, Users, Lock, Bell, Bug, Refresh, Sliders, Filter, Maximize, Minimize, Panel, External, Upload, Download, Check Circle, Alert and Info geometry;
  - increased icon rendering precision and non-scaling stroke behavior;
  - remapped high-frequency navigation surfaces away from overloaded generic symbols;
  - replaced the attachment remove glyph and dock sizing glyph with the shared icon system.
- Modified:
  - crates/presentation/desktop/frontend/src/components/Icon.tsx
  - crates/presentation/desktop/frontend/src/navigation.ts
  - crates/presentation/desktop/frontend/src/workspace-enhancements.css
  - crates/presentation/desktop/frontend/src/components/ChatSurface.tsx
  - crates/presentation/desktop/frontend/src/components/WorkspaceDock.tsx
  - crates/presentation/desktop/frontend/src/components/StatusBar.tsx
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Preserved: Rust runtime, typed service boundary, existing feature surfaces, local/preview state semantics, implementation-state manifest and repository history.
- Architecture decision: the icon system remains repository-owned and dependency-free; the visual pass does not introduce a second component library or a second token system.
- Verification evidence: source-level review completed for the changed icon registry, navigation mappings and CSS selectors; no backend route or credential surface was introduced.
- Unverified checks: branch CI/build, browser screenshot verification, Windows/Tauri rendering, full accessibility audit and live runtime integration.
- Rollback point: 079762e7fab4ab6f3fea9cba3be914c40ec2399f.
- Next step: run branch CI and inspect the real frontend build before merging the visual polish into main.

## Hermes-style configuration studio — 2026-09-24

- Scope: frontend-only configuration and personalization expansion; no runtime contracts, provider credentials or backend routes were introduced.
- User-visible effect: replaced the previous small settings form with a full configuration studio covering core profile selection, model/provider routing, agent behavior, tools/toolsets, terminal/sandbox, context/memory, compression/cache, display/theme, voice/media, gateway/channels, MCP, automation, security/privacy and advanced/raw configuration.
- Customization:
  - named profile creation, switching, local deletion with explicit confirmation and active-profile metadata;
  - persistent local preferences with unsaved/saved state;
  - import/export of secret-free portable JSON configuration snapshots;
  - raw JSON editor with apply/refresh controls;
  - live document-level theme, accent, density, UI scale and font-size hooks;
  - searchable configuration domains.
- Hermes-inspired configuration domains represented from the current public configuration model:
  - configuration precedence and environment placeholders;
  - model/provider/default model and auxiliary model routing;
  - reasoning effort, tool-use enforcement, iteration budget and delegation;
  - per-platform toolset concepts;
  - terminal backends and resource limits;
  - persistent memory, user profile memory, session recall and context pressure;
  - compression threshold, target ratio, protected recent messages and summary model;
  - display progress levels, streaming, reasoning, cost, resume display and skins;
  - TTS/STT/vision/web/media providers;
  - API server, gateway streaming and messaging platforms;
  - MCP discovery/server registry;
  - cron, wake/presence and background-run preferences;
  - checkpoints, PII/secrets redaction, network/shell/git guards and fail-closed mode.
- Modified:
  - crates/presentation/desktop/frontend/src/components/SettingsSurface.tsx
  - crates/presentation/desktop/frontend/src/workspace-enhancements.css
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Preserved: 59 registered navigation surfaces, Rust runtime, typed runtime/service boundary, visual icon system, local/preview semantics and sequential Step 25 implementation state.
- Architecture decision: Settings remains a presentation-layer configuration editor. Secrets are intentionally excluded from React state and portable exports; eventual runtime persistence must be implemented through typed service contracts.
- Verification evidence: source-level review confirms the settings domains, profile state, JSON import/export path, live personalization attributes and responsive layout are wired through the canonical SettingsSurface.
- Unverified checks: TypeScript/Vite build, GitHub Actions conclusion, browser visual verification, Windows/Tauri rendering, and live runtime persistence.
- Rollback point: f1227d42b1dd18b89e4cf6c02b3ecde276dcabe3.
- Next step: validate the settings studio through branch CI and browser-level verification before merging the combined frontend polish.

## Hermes-style configuration hardening — 2026-09-24

- Scope: corrective frontend pass on the new configuration studio.
- User-visible effect: removed remaining static control rows so model aliases, fallback chains, custom endpoint, delegation model/provider/endpoint, clarification timeout, tool-call visibility, per-platform toolset presets, local STT model, automation policy/concurrency/notifications and approval mode are editable and represented in the portable snapshot.
- Modified:
  - crates/presentation/desktop/frontend/src/components/SettingsSurface.tsx
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Preserved: all previous settings domains, profile isolation model, theme personalization, raw JSON editor and secret-free export.
- Verification evidence: source audit found zero remaining `onChange={() => undefined}` handlers in SettingsSurface and zero React namespace references after the type import correction.
- Unverified checks: TypeScript/Vite build, GitHub Actions, browser/Tauri rendering and live runtime persistence.
- Rollback point: 947645a1635dd8a05ac2a0896f52c78491af6545.
- Next step: run the settings studio through CI and browser verification before merging the frontend branch.

## Workspace customization bridge + settings feature boundary — 2026-09-24

- Scope: frontend architecture refinement after the Hermes-style configuration expansion.
- User-visible effect: layout preferences now propagate through a shared UI preference bridge instead of being trapped inside Settings; sidebar visibility, agent inspector visibility, dock visibility, status bar, rail density, tooltips, hover-preview policy and panel widths affect the desktop shell globally.
- Customization added:
  - persistent sidebar and inspector widths;
  - persistent left/right/bottom panel visibility;
  - persistent activity rail density;
  - tooltip and hover-preview controls;
  - notification position preference;
  - keyboard/profile routing controls;
  - global disabled-toolset registry;
  - profile cloning and richer active-profile controls;
  - per-profile gateway state, skills count and MCP count metadata.
- Architecture cleanup:
  - created crates/presentation/desktop/frontend/src/services/ui-preferences.ts as the canonical presentation preference bridge;
  - moved the full Settings implementation into crates/presentation/desktop/frontend/src/features/settings/SettingsStudio.tsx;
  - reduced components/SettingsSurface.tsx to a thin compatibility wrapper;
  - kept the existing shell import stable while aligning the implementation with the feature-slice architecture contract.
- Modified:
  - crates/presentation/desktop/frontend/src/services/ui-preferences.ts
  - crates/presentation/desktop/frontend/src/components/SettingsSurface.tsx
  - crates/presentation/desktop/frontend/src/features/settings/SettingsStudio.tsx
  - crates/presentation/desktop/frontend/src/components/App.tsx
  - crates/presentation/desktop/frontend/src/workspace-enhancements.css
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Preserved: the complete 59-surface navigation system, Rust runtime/service boundary, profile configuration model, secret-free export, icon system and existing preview semantics.
- Architecture decision: presentation preferences are now centralized in a typed service module; feature-specific UI remains inside the features/settings boundary while a compatibility wrapper protects existing composition imports.
- Verification evidence: source audit confirms one Settings implementation, no duplicate Settings implementation tree, centralized preference key/bridge, and shell consumption of the same preference source.
- Unverified checks: TypeScript/Vite production build, GitHub Actions, browser interaction, Tauri/Windows rendering and accessibility audit.
- Rollback point: a72d7e332379694b15149492e0b16ae226438186.
- Next step: validate the reorganized settings feature and preference bridge in CI and browser verification before merging.

## Frontend customization architecture hardening — 2026-09-24

- Scope: corrective pass after CI surfaced two strict TypeScript errors in the customization stack.
- Fixed:
  - aligned NavigationItem.icon with the complete shared IconName registry;
  - initialized new profile metadata fields for every newly created profile.
- Architecture documentation:
  - documented the settings feature boundary and shared UI preference bridge in FRONTEND-ARCHITECTURE.md.
- Modified:
  - crates/presentation/desktop/frontend/src/navigation.ts
  - crates/presentation/desktop/frontend/src/features/settings/SettingsStudio.tsx
  - docs/architecture/FRONTEND-ARCHITECTURE.md
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Verification evidence: CI run 793 completed its repository continuity/state/architecture/frontend contract checks successfully and failed only in the nested Vite TypeScript build on the two reported issues; both concrete causes were patched.
- Unverified checks: new branch CI after the fixes, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: 4a25b5e48658184e2c6a849edc214da5e3803d66.
- Next step: inspect the post-fix CI run and correct only any newly reported concrete failures.

## Full Hermes configuration coverage pass — 2026-09-24

- Scope: frontend-only expansion to close the remaining documented Hermes configuration domains.
- Added configuration domains:
  - Web Search: search/extract backend split, keyless fallback/rescue, Parallel/Exa free/paid tiers, browser provider and timezone.
  - Browser Automation: inactivity timeout, command timeout, recording, managed persistence, CDP URL and native dialog policy.
  - Runtime & Liveness: NOFILE limit, result spillover, code execution mode/timeout/call cap, tool-loop thresholds, hard-stop policies, web/subagent loop caps, execution guidance, stall guards and turn liveness.
  - Terminal refinement: Vercel Sandbox plus temp directory, terminal font, HOME mode, remote sync-back cap, backend images and Docker env forwarding.
  - Display refinement: focus view, interim gateway updates, warning suppression, commentary, Vim mode, timestamp formatting, turn summary, spinner token flow, prompt bell, file-mutation verification, credits notices and multiline shortcuts.
- Structural result: Settings is now a feature-owned studio with a thin compatibility wrapper and a shared preference bridge.
- Verification: 193 SettingsState fields, 193 defaults, 20 configuration domains with matching views and zero undefined onChange handlers.
- Modified:
  - crates/presentation/desktop/frontend/src/features/settings/SettingsStudio.tsx
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Preserved: all previous frontend surfaces, icon system, shell customization bridge, runtime/service boundaries and secret isolation.
- Reference basis: current Hermes configuration documentation covers these runtime, terminal, tool-loop, display, browser, web and timezone controls. citeturn785892view2turn785892view3turn832737view0turn258108view3turn785892view4turn258108view4
- Unverified checks: post-pass GitHub Actions result, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: a314febfce604ad16fe41509790c489b01b6e755.
- Next step: inspect the post-pass CI result and continue from verified evidence only.

## Full UI preference persistence — 2026-09-24

- Scope: frontend reliability correction for persistent customization.
- Fixed: the shared preference bridge now carries both layout and visual preferences, so the App restores theme, accent, density, UI scale and font size at startup together with panel geometry.
- Live behavior: Settings applies unsaved visual changes immediately through the shared bridge; App subscribes to the same preference event so shell layout updates without navigation away from Settings.
- Modified:
  - crates/presentation/desktop/frontend/src/services/ui-preferences.ts
  - crates/presentation/desktop/frontend/src/components/App.tsx
  - crates/presentation/desktop/frontend/src/features/settings/SettingsStudio.tsx
  - docs/architecture/FRONTEND-CHANGELOG.md
  - reference/journal/agent-operations.jsonl
- Deleted: none.
- Verification evidence: source-level wiring confirms one shared storage key, one full preference reader/applicator, App startup restoration and live preference subscription.
- Unverified checks: latest CI/build after the persistence correction, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: 209bdf9abb8e471ed4207d5d9adecb7920890ebb.
- Next step: inspect the newest CI result and fix only concrete failures.

## Final frontend configuration checkpoint — 2026-09-24

- Current frontend scope now includes the 59 product surfaces plus a 20-domain configuration studio with 193 typed settings fields and matching defaults.
- Current customization covers profile lifecycle, model/provider routing, agent behavior/delegation, toolsets and global disabled toolsets, terminal/sandbox backends, context/memory, compression, display/skins, layout geometry, voice/media, web search, browser automation, gateway/channels, MCP, automation, runtime/liveness, security/privacy, shortcuts and raw configuration.
- Shared architecture:
  - one repository-owned SVG icon registry;
  - one typed UI preference bridge;
  - feature-owned SettingsStudio with a thin compatibility wrapper;
  - shell subscription to persisted preferences;
  - no secret material in React state or portable exports.
- CI recovery note: run 793 isolated two TypeScript errors after a feature move; both were corrected before this checkpoint.
- Unverified: a fresh CI run for this final head, browser visual verification, Windows/Tauri rendering and accessibility audit.
- Rollback point: df9be7f69ce2cfb5440bdcae1b8cc886f637fcff.
- Next step: validate this final head through CI and then perform browser-level visual verification when a runnable frontend environment is available.

## 2026-09-24 — Unified control plane + frontend performance pass

- Added `src/features/settings/SettingsControlCenter.tsx` as the top-level settings control plane.
- The control plane groups modern agent-IDE configuration into nine domains: Overview, AI & Agent, Codebase & Context, Execution & Security, Browser & Web, Customizations, Cloud & Automations, Interface & Performance, and Data & Usage.
- Added configuration scopes for Global, Project, Session and Agent.
- Added UI controls for Agent/Plan/Ask/Review/Custom modes, model routing, fast models, failover, autonomy, codebase indexing, context sources, permissions, terminal sandbox, browser backends, Chrome DevTools, MCP, rules, skills, plugins, custom agents, hooks, cloud agents, isolated worktrees, remote control, automations, notifications, theme, density, reduced motion, privacy and cost tracking.
- Kept the existing `SettingsStudio` as the detailed/deep configuration layer rather than duplicating its 193-field catalog.
- Converted non-chat workspace surfaces to lazy-loaded modules through `WorkspaceOverview`, reducing initial feature mounting and keeping heavy surfaces off the startup path.
- Removed a duplicated Security & Privacy domain declaration from `SettingsStudio`.
- The frontend remains presentation-only: no provider credentials, backend routes or runtime semantics were introduced.

Verification status:
- Source edits are structurally complete.
- Fresh TypeScript/Vite CI for the combined head is still required.
- Browser/Tauri and accessibility verification remain required before merge.

## 2026-09-24 — Agent IDE depth coverage

- Extended the unified Control Center with auxiliary model routing for vision, compression, approvals, browser analysis, image/media and session-title workloads.
- Added iteration budget and provider service-tier controls to the agent domain.
- Added vision embedding byte/call budgets to the context domain.
- Added status-line field selection and platform display override controls.
- Kept these controls presentation-local and separate from the detailed runtime-inspired settings catalog.
- Static source audit after this pass: 76 ControlState fields, 76 defaults, zero missing defaults or duplicate fields.
- Fixed/verified the deep Settings catalog contains a single Security & Privacy domain declaration.
- Unverified: fresh TypeScript/Vite CI, browser/Tauri rendering and accessibility audit.

## 2026-09-24 — IDE depth: editor, VCS, verification and remote controls

- Extended the Control Center to 10 domains with a dedicated **Editor, Git & Verification** domain.
- Added editor preferences: font size, tab size, word wrap, minimap, breadcrumbs, semantic highlighting, format/code-actions on save.
- Added autocomplete preferences: inline suggestions, Tab completion, model selection and suggestion delay.
- Added VCS preferences: review panel, agent-change staging, generated commit messages, branch diffs and conflict resolver.
- Added task verification/artifact preferences: verification command, verify-on-completion, artifact preview and auto-attachment.
- Added long-lived goal controls: goal retention, in-run steering and loop/check interval.
- Added remote-control presentation settings including a machine nickname; execution remains runtime-owned.
- Static source audit: 101 ControlState fields, 101 defaults, zero missing/duplicate fields, 10 unique domains, zero unknown icon names.
- Unverified: fresh TypeScript/Vite CI, browser/Tauri rendering and accessibility audit.

## 2026-09-24 — Scoped settings engine + lightweight editor

- Added `features/settings/settings-engine.ts` as the typed local settings store for high-level Control Center state.
- Control Center now has real Global / Project / Session / Agent stores instead of treating scope as a display-only toggle.
- Added explicit draft/commit behavior: changes are local drafts until Save; Discard restores the last committed store.
- Added local configuration history with up to 20 snapshots and one-click restore from the Control Center.
- Migrates the previous `agenticos.ui.control-center-v1` flat snapshot into the Project scope when present.
- Added reusable `features/editor/CodeEditorSurface.tsx` and moved the Files workspace onto that surface.
- Editor surface remains dependency-light and supports in-file search, match counts, line focus, wrap, optional minimap and Ctrl/Cmd+F / Ctrl/Cmd+S actions.
- Heavy workspace surfaces remain lazy-loaded.
- Verification still pending for fresh TypeScript/Vite CI, browser/Tauri rendering and accessibility.

## 2026-09-24 — Configuration architecture hardening + editor modularization

- Consolidated high-level Control Center persistence behind `features/settings/settings-engine.ts`.
- Control Center scope is now real application state for Global / Project / Session / Agent, with explicit Save/Discard semantics and local history/restore.
- Avoided React state-updater side effects during persistence, keeping snapshot creation deterministic under Strict Mode.
- Added `features/editor/CodeEditorSurface.tsx` as the reusable Files workspace editor surface.
- The editor remains dependency-light and is isolated behind its own feature boundary for future language-server integration.
- Added compact configuration history UI.
- Static source audits passed after the hardening pass; runtime/build/browser verification remains pending.

## 2026-09-24 — Effective permission visualization

- Added `features/security/EffectivePermissionMatrix.tsx`.
- Execution settings now render an explicit preview of effective allow/ask/deny decisions for files, external files, terminal, network, destructive operations, Git and MCP.
- The matrix derives from the selected frontend policy controls so the user can see the consequence of a setting change before runtime integration.
- The preview is explicitly non-authoritative; runtime policy enforcement remains behind typed contracts.
- The component is isolated under the security feature boundary and only mounted inside the selected Execution & Security domain.
## 2026-09-24 — Complete frontend control surfaces + navigation performance

- Added lazy-loaded Customize Manager for Agents, Skills, Rules, Commands, Hooks, MCP, Plugins and Toolsets with filtering, scope metadata, enable/disable state and permission summaries.
- Added a Keymap Editor with profile presets, command filtering, inline rebinding and conflict detection.
- Added a Capability Registry surface showing Available / Requires setup / Unavailable / Disabled states.
- Added Setup Checklist for first-run readiness and a Scope Resolver Preview for Global / Project / Agent / Session effective configuration.
- Added Theme Studio with token-level color editing, radius controls, presets and live preview.
- Added Workspace Preset Picker for Coding, Agent Ops, Research and Focus layouts.
- Added Universal Search (Ctrl/Cmd+Shift+F) alongside Command Palette (Ctrl/Cmd+K) so navigation and search remain separate interaction systems.
- Converted platform feature modules to independent lazy chunks; the current dispatcher lazy-loads 11 heavy feature modules.
- Kept all new functionality presentation-only and preserved runtime/service boundaries.


### 2026-09-24 — Complete visual Agent Builder

Added `features/agents/AgentBuilder.tsx` and routed Agent Profiles through it from `components/StudioSurface.tsx`.

The frontend now presents a complete agent-profile editing flow across Identity, Model, Instructions, Capabilities, Policies, and Test & Release. It includes search, local draft state, create/duplicate/save/test actions, model fallback controls, context and memory budgets, explicit capability toggles, policy segmentation, evaluation/release state, and compatibility/readiness views.

The component is presentation-only: no backend route, credential, network transport, authorization enforcement or runtime persistence was invented. `AgentStudio.tsx` is preserved as a compatibility surface.

Verification for this slice:
- source-level structure and imports inspected;
- shared icon names restricted to the repository-owned icon registry;
- responsive and reduced-motion styling added;
- fresh TypeScript/Vite CI, browser/Tauri verification and accessibility audit remain pending.


### 2026-09-24 — Complete visual Subagent Builder

Added `features/subagents/SubagentBuilder.tsx` and routed `SubagentFleet.tsx` through the new builder. The surface now covers task ownership, isolated context budgets, bounded turns, model/toolset selection, memory scope, handoff format, recursive delegation, safety toggles, approval requirements and run/handoff inspection.

No runtime execution or authorization was added. The existing Subagent route remains lazy-loaded through the platform surface.

### 2026-09-24 — Provider Account Center

Expanded `features/providers/ProviderStudio.tsx` with an Accounts tab. It now presents provider/account metadata, safe masked secret state, model counts, quota previews, routing role, capabilities, connection test/refresh/routing actions, and responsive account layouts.

No credentials or transport behavior were introduced.

### 2026-09-24 — Context Inspector and Run Timeline

Moved the detailed Context and Runs surfaces into dedicated feature components. Context Inspector now exposes explicit source selection, budget and compaction controls; Run Timeline adds run filtering plus Timeline / Tools / Changes inspection.

The dispatcher components now route into these feature boundaries instead of carrying the detailed surface state themselves. No backend behavior was introduced.

### 2026-09-24 — MCP Manager

Created `features/mcp/McpManager.tsx` and routed the existing MCP navigation surface through it. Added server search, tool/resource inspection, auth readiness, masked secret state and policy controls with responsive styling.

The feature is presentation-only and introduces no runtime transport or credential handling.

### 2026-09-24 — Hook Manager

Created `features/hooks/HookManager.tsx` and routed Hooks & Policies through the dedicated feature boundary. Added configuration, lifecycle trace and test-bench views with responsive/reduced-motion styling.

No runtime middleware or authorization behavior was introduced.

### 2026-09-24 — Git Diff Center and Environment Builder

Added dedicated feature components for source-control review and environment configuration. The dispatcher now routes Reviews through Git Diff Center and Environments through Environment Builder, reducing inline surface state.

No backend execution, credentials or runtime authorization were introduced.

### 2026-09-24 — Automation and Credential Managers

Added dedicated builders for Automations and Credentials and routed both surfaces through `PlatformSurface`. Added responsive/reduced-motion styling and explicit presentation-only boundaries.

Credentials never expose secret material in the frontend.

### 2026-09-24 — Channel Gateway Manager

Added a dedicated Channel Gateway Manager and routed Channels & Gateway through it. The surface now exposes channel capabilities, gateway routing, delivery controls and session associations with responsive/reduced-motion styling.

Runtime transport and credentials remain outside the frontend boundary.

### 2026-09-24 — Research Workbench

Replaced the shallow Research presentation with a dedicated Research Workbench covering Batch, Sources, Trajectories and Synthesis views, with responsive/reduced-motion styling.

No external search or runtime execution was introduced.


### 2026-09-24 — Frontend integrity and lazy-boundary hardening

- Repaired the compatibility App preference imports so it uses the canonical UiLayoutPreferences helpers without stale symbol references.
- Converted the remaining heavy Platform surfaces (Context, MCP, Hooks, Git/Diff, Environments, Automations, Credentials, Channels and Research) to independent lazy imports, matching the frontend performance contract.
- Preserved presentation-only behavior: no backend routes, credentials, transport or runtime policy were introduced.


### 2026-09-24 — Advanced product-depth control plane

Added a dedicated lazy-loaded AdvancedStudio surface for the remaining high-value frontend depth gaps:
- Model Playground for side-by-side model comparison.
- Routing Studio for primary/fast/reasoning/fallback route visualization.
- Token Observatory for context pressure, budget allocation and the planned trim → dedupe → compaction → dynamic-trim pipeline.
- Agent Versions for immutable configuration snapshots, diffs, promotion and rollback previews.
- Audit Log for chronological agent/tool/policy/workspace evidence.

Navigation and platform-mode contracts were extended without changing runtime behavior. All controls remain local presentation state and explicitly label backend-owned data as preview until integration exists.

Verification status:
- source-level imports and icon registry references inspected;
- design tokens aligned with the existing monochrome system;
- lazy loading preserved for the new feature;
- fresh TypeScript/Vite build, GitHub Actions, browser/Tauri verification and accessibility audit remain pending.


## 2026-09-24 — Workspace overview control plane
- Added `Workspace Overview` as the frontend entry surface for project health, active tasks, agent activity, notifications and safe quick actions.
- Reused existing preview datasets; no runtime/backend calls were introduced.
- Added responsive layout rules for narrower desktop widths.
- Verification status: implementation committed to feature branch; build/browser/CI evidence still pending.


## 2026-09-24 — Governance UX layer
- Added Approval Center with risk, scope, policy, decision and reason surfaces.
- Added Permissions Matrix with actor/resource/operation/scope inspection and policy comparison controls.
- Kept all actions presentation-only; no runtime authorization is granted by the UI.
- Verification status: build/browser/CI evidence pending.


## Agent Control Plane — 2026-09-24

- Scope: frontend-only agent configuration depth; backend/runtime integration intentionally deferred.
- User-visible effect: added a dedicated Agent Control Plane for specialist fleet selection, autonomy/policy controls, context and execution budgets, failure/handoff behavior, execution contracts and agent lifecycle.
- Created:
  - `crates/presentation/desktop/frontend/src/features/platform/AgentControlPlane.tsx`;
  - `crates/presentation/desktop/frontend/src/features/platform/AgentControlPlane.css`.
- Modified:
  - `crates/presentation/desktop/frontend/src/navigation.ts`;
  - `crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx`.
- Architecture decision: agent configuration is represented as a presentation contract first; runtime authorization, tool execution, budget enforcement and deployment remain backend-owned.
- Safety decision: destructive/network/secret-sensitive behavior is represented as policy state only; no credentials or runtime permissions are introduced.
- Verification evidence: repository writes completed on branch `feature/frontend-agent-control-plane-2026-09-24`; fresh build/browser verification remains pending.
- Unverified checks: TypeScript/Vite production build, GitHub Actions conclusion, browser/Tauri visual verification, accessibility audit.
- Rollback point: branch base `main` before this slice; no history rewrite or destructive deletion.
- Next step: deepen Prompt Lab and task/agent execution surfaces, then run a fresh frontend build and browser verification.


## Prompt Lab + Platform Mode Registration — 2026-09-24

- Added a dedicated frontend Prompt Lab for prompt versions, layered system/developer/user instructions, variables, model compatibility, token estimates, tests, diffs and release safeguards.
- Added preview-only prompt actions for testing, comparison, rollback, branching and publishing.
- Added explicit backend boundary: prompt deployment and runtime enforcement remain outside the presentation layer.
- Fixed the `PlatformMode` type registration for `agent-control` and added `prompts` so the navigation modes match the surfaces actually rendered by `PlatformSurface.tsx`.
- Created:
  - `crates/presentation/desktop/frontend/src/features/platform/PromptLab.tsx`;
  - `crates/presentation/desktop/frontend/src/features/platform/PromptLab.css`.
- Modified:
  - `crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx`;
  - `crates/presentation/desktop/frontend/src/navigation.ts`.
- Verification: repository changes committed on branch `feature/frontend-prompt-lab-2026-09-24`; fresh TypeScript/build/browser verification is still pending.


## Runtime Control Center — 2026-09-24

- Authorized purpose: deepen the frontend execution control plane before backend integration.
- Branch: `feature/frontend-runtime-control-2026-09-24`.
- User-visible effect: added a dedicated Run Control Center for execution trees, node inspection, pause/resume/stop previews, retry budgets, checkpoints, handoffs and artifacts.
- Created:
  - `crates/presentation/desktop/frontend/src/features/platform/RunControlCenter.tsx`.
- Modified:
  - `crates/presentation/desktop/frontend/src/navigation.ts`;
  - `crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx`;
  - `crates/presentation/desktop/frontend/src/workspace-enhancements.css`;
  - this changelog and the operation journal.
- Architecture decision: execution controls remain presentation-only. No transport, process control, checkpoint persistence, authorization enforcement or runtime mutation was introduced.
- Verification evidence: static route/component/CSS wiring reviewed; Prompt Lab was also explicitly registered in `platformModes` to prevent navigation classification drift.
- Unverified: fresh TypeScript/Vite production build, GitHub Actions completion, browser/Tauri visual verification and accessibility audit.
- Rollback: revert this feature branch/PR to its main base; no history rewrite or destructive deletion.
- Next step: run fresh frontend verification, then continue the remaining UX/accessibility hardening pass.

## 2026-09-24 — Memory, Tool Policy and Workflow control surfaces
- Added MemoryStudio for semantic/episodic/workspace memory inspection, provenance, TTL, importance, conflict resolution and write safeguards.
- Added ToolPolicyStudio for tool registry, operation/risk/scope policies, approval requirements, profiles and fail-closed preview behavior.
- Added WorkflowStudio for graph-based orchestration, agent/subagent nodes, conditions, parallel branches, human gates, bounded retries and checkpoint recovery previews.
- Exposed memory, tools and workflows as lazy platform modes.
- Kept all three surfaces presentation-only; no runtime, credential, filesystem or network mutation was introduced.
- Verification pending: fresh TypeScript/Vite build, browser/Tauri visual QA and accessibility audit.


## 2026-09-24 — Frontend Completeness Suite

- Added `FrontendCompletenessStudio` as a presentation-only control-plane surface.
- Added advanced Evaluation Studio, Skills Studio, MCP Control Center, Provider & Model Center, Browser Automation Studio, Computer Use Recorder, Credential Vault, Plugin/Marketplace Manager, Import & Migration Center, Session Replay & Branching, Workspace Setup, and QA & Readiness Center.
- Added navigation modes for Workspace Setup and QA & Readiness and routed provider/skills surfaces through the same platform boundary.
- Runtime/backend integrations remain intentionally deferred; buttons stage UI actions only.
- Verification note: this slice was not yet validated with a fresh Vite/TypeScript build, Tauri runtime, browser verification, accessibility audit, or GitHub Actions result.


## 2026-09-24 — Final Frontend Control Suite

- Added a unified frontend control suite for Agent Teams, Advanced Context, Cost & Usage, Observability, Release Center, Customization, Help & Documentation, and Offline & Recovery.
- Added navigation registration for the new product surfaces and lazy routing through PlatformSurface.
- Added responsive presentation states for filtering, metrics, control contracts, readiness evidence and fail-closed preview boundaries.
- Architecture decision: this slice remains presentation-only. No provider calls, secret storage, runtime authorization, process execution or persistence was fabricated.
- Verification status: fresh TypeScript/Vite build, browser/Tauri verification, accessibility audit and GitHub Actions result remain pending.
- Rollback: revert this feature branch/PR to its main base; no history rewrite or destructive deletion.


## 2026-09-24 — Frontend QA & Hardening Control Surface

- Added `FrontendQAHarness` as a dedicated presentation-only verification surface.
- Added release gates for route coverage, lazy loading, loading/empty/error/offline states, accessibility, responsive layout, runtime boundary, typed action contracts, visual consistency, duplicate-route audit and real build/browser verification.
- Added explicit local states: Ready, Needs hardening and Not verified. The UI does not claim an unexecuted verification is passed.
- Registered the `qa` route before the broader completeness suite so the dedicated QA surface is actually reachable.
- Verification status: code was added through the GitHub branch/PR workflow; fresh TypeScript/Vite build, browser/Tauri verification and accessibility execution remain pending.
- No runtime, provider, secret, filesystem or network behavior was introduced.


## 2026-09-24 — Frontend build hardening follow-up
- Corrected malformed literal `\\n` sequences that were present in three TypeScript sources and caused `tsc` parse failures.
- Frontend production verification remains gated on the isolated GitHub Actions build; no passing result is claimed until the workflow executes successfully.

## Frontend routing resilience — 2026-09-24

- Scope: frontend-only routing correctness and lazy-surface resilience.
- Branch/PR: `feature/frontend-routing-hardening-2026-09-24`.
- User-visible effect: dedicated Browser, MCP, Computer Use, Credentials, Imports, Sessions and Evaluations surfaces are no longer shadowed by the generic completeness router; lazy-loaded platform failures now render an isolated retry state instead of escaping the feature boundary.
- Modified: `crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx`, `crates/presentation/desktop/frontend/src/workspace-enhancements.css`.
- Architecture decision: route-specific surfaces must be evaluated before generic grouped fallbacks; lazy loading is protected by an error boundary so one feature cannot take down the platform surface.
- Verification evidence: static source inspection confirms the route precedence fix and isolated error boundary; fresh production build and browser verification remain unobserved.
- Unverified checks: GitHub Actions build result, browser/Tauri verification, accessibility audit.
- Rollback point: branch base `main`; no history rewrite or destructive deletion.
- Next step: merge the routing hardening PR only after the frontend verification workflow provides a fresh result.


## 2026-09-24 — Frontend routing and surface-boundary hardening

- Repaired the SurfaceErrorBoundary source block in `PlatformSurface.tsx`: literal escaped newline/quote sequences were normalized into valid TypeScript syntax.
- Wrapped the lazy platform surface in the error boundary so render failures stay isolated and expose a retry action instead of taking down the workspace surface.
- Added `approvals` and `observability` to `platformModes` so the dedicated Approval Center and Final Control Suite routes are reachable instead of falling through to the legacy StudioSurface.
- Kept the frontend-only boundary intact: no runtime, provider, credential, network or execution integration was added.
- Verification status: source-level audit completed; GitHub Actions build result for the resulting commit must still be observed before claiming production-build verification.


## 2026-09-24 — Platform mode type-registry hardening

- Scope: frontend-only navigation/type consistency.
- Branch: `fix/frontend-navigation-type-registry-2026-09-24`.
- User-visible effect: keeps the typed `PlatformMode` union synchronized with the already-registered `approvals` and `observability` routes, preventing type-level drift between navigation registration and platform dispatch.
- Modified: `crates/presentation/desktop/frontend/src/navigation.ts`.
- Architecture decision: `PlatformMode`, `platformModes` and dedicated `PlatformSurface` branches must remain one coherent registry; a route added to the set must also exist in the type domain.
- Verification evidence: source audit confirmed both modes were already in `platformModes` and dispatch, while missing from the `PlatformMode` union; the union is now corrected.
- Unverified checks: fresh TypeScript/Vite build, GitHub Actions result, browser/Tauri verification and accessibility audit.
- Rollback point: `58c5dd58e72024d2afaf890839c6fec5895bf0ea`.
- Next step: run the isolated frontend verification workflow after merging this registry correction.


## Frontend architecture registry hardening — 2026-09-24

- Scope: frontend architecture organization and navigation-registry hardening; backend/runtime integration remains deferred.
- Commit/PR: feature branch `feature/frontend-architecture-registry-2026-09-24`; PR to be opened after static inspection.
- Created:
  - `docs/architecture/FRONTEND-ARCHITECTURE-MAP.md`;
  - `crates/presentation/desktop/frontend/src/navigation-audit.ts`.
- Modified:
  - `crates/presentation/desktop/frontend/src/features/platform/FrontendQAHarness.tsx`.
- User-visible effect: QA now reports navigation-registry structure from the same source used by the frontend instead of treating route coverage as a purely manual status.
- Architecture decision: navigation metadata remains centralized in `navigation.ts`; the audit is a pure TypeScript utility with no React/runtime dependency and can later be reused by automated tests.
- Preserved: all existing feature surfaces, runtime boundaries, historical commits and presentation-only behavior.
- Verification evidence: source-level inspection and static registry integration only.
- Unverified checks: fresh Vite production build, browser/Tauri verification, accessibility audit, and GitHub workflow result for this branch.
- Rollback point: `05bad5894fbc8a14bf6a2c8cb9292c64c0480a80`.
- Next step: open the architecture hardening PR and inspect its changed-file set before merge.


## Backend runtime vertical slice — 2026-09-24

- Scope: first real backend/runtime connection after the frontend control-plane work.
- Added a Rust/Actix API runtime with persistent SQLite conversation memory and session-isolated `ReactAgent` instances.
- Replaced placeholder chat behavior with a real OpenAI-compatible provider boundary. Missing credentials now produce an explicit configuration error instead of a fake response.
- Added conversation history and FTS5 search endpoints plus structured health/status/tool endpoints.
- Added a standalone API-server binary and embedded API-server startup in the Tauri desktop process.
- Added `.env.example` documentation for endpoint, model, credential, persistence and bind configuration.
- Preserved the frontend/backend boundary: React remains transport-oriented and does not own credentials or provider logic.
- Verification status: implementation/source inspection completed; fresh Rust workspace build, tests, desktop launch and live provider request remain unobserved until CI or local execution produces evidence.
- Next backend slice: multi-provider registry/routing, durable run commands, tool policy enforcement, events/checkpoints and streaming.


## Knowledge Studio — 2026-09-24

- Added a dedicated Knowledge Studio frontend surface for source indexing, memory governance, retrieval controls and provenance.
- Added source freshness/chunk metadata, hybrid retrieval/reranking controls, memory write safeguards and citation previews.
- Added responsive layout and lazy-loaded platform routing.
- All ingestion/retrieval actions remain presentation-only until connected to the backend knowledge runtime.


## Developer Workspace — 2026-09-24

- Added a developer-focused workspace for file exploration, symbol navigation, search, code preview, safe edit actions, diff review and checkpoints.
- Added branch/working-tree/context status indicators and responsive layout.
- Kept all code-edit, terminal and Git actions presentation-only until their backend capabilities are connected.


## Git Control Center — 2026-09-24

- Added repository control surface for working-tree changes, branches, commit history, checkpoints and safe Git actions.
- Added protected-branch, pre-commit, approval and rollback indicators.
- All Git mutations remain presentation-only until connected to the repository backend.


## Agent Mission Control + Market Benchmark — 2026-09-24

- Added `Agent Mission Control`, a unified frontend mission composer for agent mode, model/route, context policy, tools/permissions, workspace isolation, parallel execution, scheduling and preflight verification.
- Added a current market capability benchmark covering Cursor, OpenAI Codex, Google Antigravity, Claude Code, Windsurf Cascade, Cline and Roo Code, with source links and implementation decisions.
- Fixed `PlatformMode` registration drift by including `knowledge`, `developer-workspace`, `git-control` and `agent-mission` in the typed platform-mode set.
- Preserved the presentation/runtime boundary: mission launch, scheduling, tools, provider routing and worktree/cloud creation remain preview-only until connected to typed Tauri/Rust services.


## Task Execution Center — 2026-09-24

- Added a unified execution workspace for task queue state, terminal sessions, process/resource state, approvals, event logs and evidence-oriented controls.
- Connected the surface to the same typed navigation and lazy-loading architecture used by other platform modules.
- Kept command execution, process control, delegation and artifact mutation explicitly presentation-only until runtime adapters are connected.


## Session, Evidence & Environment Suite — 2026-09-24

- Added Session Replay Studio for branching, replay, comparison, event filtering and restore previews.
- Added Evidence & Artifact Inspector for screenshots, videos, logs, diffs, test reports, handoffs and provenance chains.
- Added Environment Lab for local/worktree/cloud/SSH targets, network policy, runtime setup, snapshots and lifecycle states.
- Added FRONTEND-CAPABILITY-MATRIX.md as the canonical inventory of frontend surfaces and backend connection status.


## Agent Arena + Resilience QA — 2026-09-24

- Added Agent Arena for parallel candidate lanes, isolated worktrees, criterion comparison, evidence review and convergence preview.
- Added Frontend State Matrix to standardize loading, ready, empty, error, offline, reconnecting, stale, permission and approval UX contracts across critical surfaces.
- Added Visual & Accessibility Lab for viewport, keyboard, reduced-motion, contrast, semantics and recovery verification workflows.
- Kept all verification labels honest: this lab records UI expectations and preview intent; it does not fabricate successful browser or accessibility execution.


## Collaboration + Design System — 2026-09-24

- Added Collaboration & Review Center for findings, review threads, verification gates and human approval previews.
- Added Design System Studio for reusable component states, visual tokens, density, focus and accessibility foundations.


## Frontend Coverage Studio — 2026-09-24

- Added a live structural inventory driven by the navigation registry.
- Explicitly identifies App-shell, legacy StudioSurface and PlatformSurface ownership so no route appears missing just because it is not a dedicated conditional inside PlatformSurface.
- Adds search, owner filters, per-surface runtime-boundary metadata and completion-contract inspection.


## Navigation Taxonomy + Workspace Navigator — 2026-09-24

- Added a shared navigation taxonomy with seven sections: Workspace, Build, Run, Intelligence, Governance, Integrations and System.
- Reorganized the All Features launcher to use that taxonomy instead of the previous flat Build/Operate/Configure/Integrate grouping.
- Added Workspace Navigator with search, section filters, favorites and recent surfaces stored locally.
- Propagated navigation callbacks through WorkspaceOverview → PlatformSurface so the Navigator can switch surfaces directly.
- Updated Command Palette results to expose the same taxonomy context.


## Quality Workbench — 2026-09-24

- Added a centralized quality workspace for diagnostics, tests, coverage, quick fixes and release evidence.
- Added explicit distinction between source findings, test expectations and runtime verification evidence.
- Connected the quality surface to the shared navigation taxonomy.
