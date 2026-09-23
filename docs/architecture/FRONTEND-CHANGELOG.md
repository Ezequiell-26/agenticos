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
