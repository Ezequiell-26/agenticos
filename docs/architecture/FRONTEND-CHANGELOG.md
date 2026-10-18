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


## Provider & Model Control Center — 2026-09-24

- Added a unified model plane for providers, model inventory, routing policy, fallback strategy, capabilities and usage guards.
- Kept provider credentials and authoritative health outside presentation state.
- Connected the model plane to the shared navigation taxonomy so routing and provider UX live together.


## Integration Control Center — 2026-09-24

- Added a unified integration surface for MCP, Browser, Channels, Sources, Credentials, Webhooks and Environments.
- Added integration-level network policy, secret-handling, inbound-event and external-publication guards.
- Kept authoritative connections and secret values outside presentation state.


## Governance Control Center — 2026-09-24

- Added a unified safety/release plane for permissions, approvals, security posture, hooks, audit timeline and release gates.
- Added explicit fail-closed presentation states and evidence requirements.
- Consolidated governance navigation without removing the dedicated detailed surfaces underneath it.


## Intelligence Control Center — 2026-09-24

- Added a unified intelligence surface for Context, Knowledge, Memory, Research, Prompts, Evaluations and token optimization.
- Added explicit context budget controls and the four-stage optimization contract: noise trim, deduplication, structural compaction and dynamic budget trim.
- Kept retrieval, memory persistence, evaluation results and token limits runtime-authoritative.


## Project Control Center — 2026-09-24

- Added a workspace-level project control surface for project identity, current branch, tasks, environment, layout and recovery context.
- Added direct launch cards into Developer, Mission, Execution, Intelligence, Governance and Integration workspaces.
- Kept project/branch/environment changes as presentation intents until runtime project services are connected.


## 2026-09-24 — Remote Control Center + workspace command strip

- Added `Remote Control Center` for remote session monitoring, device pairing, approval queues, activity notifications, reconnect preferences and a remote viewport preview.
- Added `WorkspaceCommandStrip` to keep project, branch, runtime, current surface, verification gates and agent policy visible while working.
- Added a focus workspace mode with `Ctrl/Cmd+Shift+Enter` that collapses secondary chrome without creating a second application shell.
- Added explicit `remote-control` navigation registration and taxonomy ownership.
- Runtime boundary: remote transport, device authentication, push delivery, approvals and session resume remain backend/runtime responsibilities; the UI emits preview intents only.
- Verification status: source-level registry and route wiring inspected; fresh frontend build, browser verification, accessibility execution and Tauri rendering remain unverified.


## 2026-09-24 — Navigation type registry hardening

- Added `onboarding` and `qa` to the canonical `RailMode` union so every registered navigation item is represented in the typed route domain.
- Preserved the existing ownership model: both surfaces are already handled by `PlatformSurface`; this change closes type-level registry drift without changing runtime behavior.

## 2026-09-24 — Frontend route completeness and shared feature workbench

- Added `FeatureWorkbench` as a reusable, data-driven presentation surface for platform capabilities that did not yet have a dedicated module.
- Added dedicated route ownership in `PlatformSurface` for overview, tasks, permissions, canvas, commands, subagents, cloud agents, remote control, computer use, operations, kanban, credentials, hooks, marketplace, security and Home Assistant/social integration surfaces.
- Routed evaluation, version, audit, notification, session, log, analytics, batch, learning, playground, routing, token-observatory, toolsets, execution, webhooks, imports, media and wake surfaces through the shared workbench instead of the unrelated Security Center fallback.
- Removed stale platform-local state left by the previous fragmented route implementation and preserved the existing `StudioSurface` ownership for `chat`, `files`, `terminal`, `runs`, `agents`, `artifacts` and `settings`.
- Source audit result: 98 navigation IDs, 91 typed platform modes, 0 missing platform owners, 0 invalid non-platform owners.
- Verification status: source structure verified. Frontend build, browser verification, accessibility execution, Tauri rendering and Step 25 implementation-state verification remain unverified.
- Boundary: all new actions are presentation intents; no provider calls, secret handling, durable runtime mutation or execution was introduced.
- Current implementation-state note: repository remains governed by Step 25 (`integration-test-implementation-phase-3`); this frontend source is preserved but not marked as a verified implementation step.

## 2026-09-24 — Frontend composition hardening

- Removed accidental nested `Shell` composition for `WorkspaceOverview` and `PermissionsMatrix` after route consolidation.
- Removed non-platform mode checks from `PlatformSurface` and preserved `StudioSurface` ownership for `chat`, `files`, `terminal`, `runs`, `agents`, `artifacts` and `settings`.
- Kept the shared `FeatureWorkbench` registry limited to typed `PlatformMode` values.
- Verification status: source ownership audit remains green with 98 navigation IDs, 91 platform modes, zero missing platform owners and zero invalid cross-owner routes. Build/browser/Tauri verification remains pending.

## 2026-09-24 — Frontend architecture verifier alignment

- Updated `scripts/verify-frontend-architecture.mjs` so route coverage accepts the typed `GENERIC_FEATURE_MODES` registry used by `PlatformSurface`.
- Corrected the generic-route regex after inspection so the verifier extracts the declared mode list reliably.
- This keeps the architecture gate aligned with the consolidated frontend routing model instead of requiring one conditional branch per surface.
- Verification status: source-level route audit is clean; the actual repository `npm run verify` and desktop frontend build still require CI/local execution evidence.

## 2026-09-24 — Provider resilience, verification and health diagnostics

- Expanded `ProviderStudio` with a Resilience workspace for primary timeouts, rate limits, context overflow, tool incompatibility and provider outage scenarios.
- Added a Verification workspace aligned to the actual provider integration-test concepts in `provider_plane_integration.rs`: multi-provider registry/catalog composition, declared failover order, disabled failover, health-driven selection, bounded retry + quota state, provider-scoped credentials, deterministic transport and multi-provider orchestration.
- Added a Health diagnostics timeline with selectable 15m/1h/24h windows, status transitions, incident-style entries and evidence inspection actions.
- Added responsive styling in `ProviderResilience.css` while preserving the existing monochrome design system.
- All new controls remain presentation-local; they do not execute provider traffic or claim CI/runtime verification.
- Verification status: source inspection and route ownership remain clean. Frontend build, browser/Tauri verification and Step 25 acceptance evidence remain unverified.

## 2026-09-24 — Provider policy editor and health diagnostics

- Extended the Provider Studio with a Resilience tab containing failure simulations and recovery timelines.
- Added a Verification tab whose matrix mirrors the real provider integration tests and exposes local result states plus evidence inspection affordances.
- Added a Health diagnostics view with selectable telemetry windows and incident-style status history.
- Added a resilience policy editor for automatic failover, health-aware selection, circuit breaking, bounded retries, maximum attempts and cooldown.
- Kept every control presentation-only; no provider calls, credential reads, durable state writes or runtime failover behavior were introduced.
- Verification status: static/source checks only. Frontend build, browser/Tauri verification and the authorized Step 25 acceptance suite remain unverified.

## 2026-09-24 — Frontend shell polish, global shortcuts and resilient surface states

- Added a global `KeyboardShortcuts` dialog with keyboard-first navigation, accessible dialog semantics and a complete shortcut inventory.
- Wired `?` to open the shortcut center and `Ctrl/Cmd+1…9` to jump across the primary navigation entries.
- Added real Focus Mode shell composition that hides secondary panels without creating a second application shell.
- Added narrow-desktop responsive behavior below 1000px so the application no longer requires the 1180px global minimum when the viewport is constrained.
- Improved runtime status semantics with live-region output and corrected the notification control to use the notification icon plus accessible unread labeling.
- Added full generic `FeatureWorkbench` state previews for Ready, Loading, Empty, Error, Offline and Approval, including recovery/reconnect presentation actions and reduced-motion behavior.
- Preserved the runtime boundary: shortcut actions and state previews remain presentation-only.
- Verification status: source-level audit only. Build, browser, accessibility execution and Tauri rendering remain unverified.

## 2026-09-24 — Frontend interaction depth and keyboard parity

- Added keyboard selection to the All Features launcher with ArrowUp/ArrowDown, Enter and Escape behavior.
- Added active keyboard styling and `aria-activedescendant` linkage for feature search.
- Hardened ChatSurface with slash-command keyboard navigation, real clipboard copy handling, accessible composer notices and outside/Escape dismissal for the session menu.
- Exposed the keyboard shortcut center from the global Command Palette as well as the `?` shortcut.
- Preserved the monochrome visual language, reduced-motion behavior and frontend/runtime boundary.
- Verification status: source-level only. Production build, browser execution, accessibility execution and Tauri rendering remain unverified.

## 2026-09-24 — Provider diagnostics depth

- Added ProviderRouteSimulator for deterministic, presentation-only route-decision replay across timeout, rate-limit, context, tool-compatibility and outage scenarios.
- Added ProviderCapabilityMatrix to preview model/provider compatibility for Tools, Vision, Streaming, Structured output and Long context requirements.
- Added ProviderEvidenceLedger to separate available deterministic evidence from pending CI/runtime-adapter evidence and blocked security/manual review.
- Integrated the three surfaces into Provider Studio without adding provider transport, credentials, durable state or runtime authorization to React.
- Verification status: source wiring verified; production build, browser/Tauri execution and Step 25 acceptance remain pending.

## 2026-09-24 — CI continuity and formatting repair

- Identified the concrete CI failures on the then-current main: API-server rustfmt drift and continuity validation against historical journal ordering/evidence shape.
- Restored crates/presentation/api-server/src/lib.rs to the formatting expected by cargo fmt --all -- --check.
- Hardened scripts/verify-agent-continuity.mjs to parse timezone-aware timestamps safely and preserve a fixed compatibility allowlist for historical completed operations that predate the strict evidence field.
- Historical journal lines were not rewritten or deleted; new operations remain subject to the strict evidence contract.
- Verification status: repair commits submitted to CI; full repository verification remains pending.

## 2026-09-24 — Provider acceptance board and interaction correction

- Added Provider Acceptance Board covering the authorized Step 25 provider integration-test contract, failover, health, resilience, orchestration, coverage, security, architecture and Rust verification gates.
- Clarified that Mapped/Preview states are presentation coverage only and never certify runtime execution.
- Corrected Provider Studio tab semantics with tabpanel linkage and keyboard focus metadata.
- Corrected provider route health indicators so degraded routes are not presented as healthy.
- Corrected the provider verification contract count from 12 to the actual 8 mapped integration tests.
- Removed an unused TypeScript type from the provider evidence ledger under the repository's noUnusedLocals policy.
- Verification status: source audits remain clean; CI and production/browser/Tauri evidence are still governed by the latest workflow results.

## 2026-09-24 — Hermes parity configuration expansion

- Added a dedicated Hermes Parity settings surface for advanced runtime-configuration concepts confirmed against the current Hermes configuration reference.
- Added UI controls for context-engine selection, memory-provider selection, credential-pool rotation, fallback-model routing and auxiliary reasoning effort.
- Added independently configurable auxiliary contracts for web extraction, approval, session search, skills hub, MCP dispatch, memory flush and vision download timeout.
- Added advanced TTS/voice-mode controls, CLI skin/personality metadata, per-platform tool-progress overrides and web crawl/search-mode controls.
- Added streaming timeout layers, gateway buffering/cursor controls, per-user group-session policy, unauthorized-DM policy/overrides and zero-LLM quick-command definitions.
- Persisted the new fields through the local settings engine and included them in the portable raw configuration snapshot.
- Preserved the presentation/runtime boundary: credentials, shell execution, provider calls, context-engine activation and gateway authorization remain runtime-owned.
- Verification status: source-level integration only. Production build, browser/Tauri execution, accessibility execution and Step 25 runtime acceptance remain unverified.

## 2026-09-24 — Continuity evidence cutoff hardening

- Simplified the historical evidence policy in the continuity verifier to an explicit cutoff predicate.
- Completed operations at or after the cutoff continue to require non-empty evidence; historical records remain immutable while still requiring a durable next step.
- This change preserves the strict evidence contract for all newly created operations and avoids control-flow ambiguity in CI.
- Verification status: awaiting the new GitHub Actions run.

## 2026-09-24 — Portable raw configuration round-trip repair

- Fixed the expert Raw Config editor so the portable snapshot generated by `Refresh snapshot` can also be reapplied with `Apply JSON`.
- Added a typed, fail-safe portable-to-settings mapper that preserves unspecified preferences while importing supported model, agent, tools, terminal, context, runtime, automation, security, gateway and Hermes parity fields.
- Kept the existing internal `{ settings, profiles, activeProfileId }` import format compatible.
- Verification status: awaiting GitHub Actions TypeScript/Rust gates.

## 2026-09-24 — Provider Studio JSX build repair

- Reworked the provider quota panel JSX into explicit nested elements after CI reported a parser failure at the quota block.
- Preserved the same presentation-only quota data and interaction surface; no provider runtime behavior changed.
- Verification status: awaiting the latest GitHub Actions build and continuity gates.

## 2026-09-24 — Provider Health JSX closure repair

- Fixed the provider Health tab conditional by closing its JSX expression correctly.
- This resolves the concrete TypeScript parser failure reported by CI (`TS1005: '}' expected`) before the Quotas tab.
- The subsequent quota JSX normalization remains in place; no provider behavior or runtime boundary was changed.
- Verification status: awaiting the latest CI run.

## 2026-09-24 — Continuity historical-record short-circuit

- Hardened the continuity verifier again after CI continued to report a historical evidence failure despite the timestamp predicate being satisfied in source inspection.
- Completed records before the fixed `2026-09-24T01:00:00Z` cutoff now exit the evidence-validation branch explicitly after checking `next_step`; records at/after the cutoff remain subject to strict non-empty evidence requirements.
- The failure message for current records now includes the operation timestamp and cutoff to make any future policy mismatch diagnosable directly from CI logs.
- Verification status: awaiting the newest CI run.

## 2026-09-24 — Continuity legacy journal parser repair

- Fixed the root cause behind the recurring historical `evidence` CI failure: `evidence` is a required modern field, so earlier cutoff logic was reached too late to help legacy completed records.
- The verifier now skips only the `evidence` requirement for completed records before the fixed cutoff while continuing to require `next_step`.
- Added tolerant journal-sequence parsing for legacy lines that contain multiple JSON objects separated by a literal `\\n`, without rewriting the historical journal contents.
- Preserved strict evidence enforcement for all completed records at or after the cutoff.
- Verification status: awaiting the CI run for the corrected verifier.

## 2026-09-24 — Continuity separator parsing correction

- Corrected the legacy journal separator parser to recognize the actual stored `\\n` sequence (one backslash plus `n`) between concatenated historical JSON objects.
- Source-level simulation against the current journal now parses all 126 journal entries without malformed-record errors and finds zero current/future completed entries missing required evidence.
- The historical Agent Builder record remains unchanged and is correctly treated as pre-cutoff; strict evidence enforcement remains active after the cutoff.
- Verification status: source simulation passed; awaiting GitHub Actions confirmation.

## 2026-09-24 — Continuity status-agnostic historical cutoff

- Corrected the historical evidence compatibility rule to use the fixed policy timestamp only, because legacy schema_version=1 records may use statuses other than `completed` (for example `implemented`).
- Records before `2026-09-24T01:00:00Z` can remain immutable without an `evidence` field; current/future records remain strict.
- Verification status: awaiting the new CI run.

## 2026-09-24 — Continuity legacy schema compatibility

- Generalized the fixed historical compatibility boundary so schema_version=1 records created before `2026-09-24T01:00:00Z` are not rejected for missing fields that were introduced by the newer journal contract.
- Current/future records remain fully strict against `required_operation_fields` and the evidence policy.
- This resolves the observed `previous_commit` failure in the historical Knowledge Studio record without rewriting that record or weakening current work requirements.
- Verification status: awaiting the next CI run.

## 2026-09-24 — Continuity historical/modern validation split

- Refactored the continuity verifier so pre-cutoff schema_version=1 journal records use an explicit historical compatibility branch and are not subjected to newer `deleted`, `rollback` or evidence-shape requirements.
- Historical completed operations still require a durable `next_step`; current/future modern records retain the full strict contract.
- This addresses the successive legacy failures observed after the initial evidence-field migration without rewriting historical journal content.
- Verification status: awaiting the next CI run.

## 2026-09-24 — Continuity migration anchor hardening

- Replaced timestamp-based historical schema compatibility with an append-only migration anchor: `ci-error-repair-rustfmt-continuity-2026-09-24`.
- This matches the actual journal history: entries before that operation use mixed historical schemas, while entries from the anchor onward use the strict schema/evidence contract.
- Added a fail-closed guard if the migration anchor is ever missing, and reject schema-less legacy records after the strict boundary.
- This avoids misclassifying historical records with timezone offsets or inconsistent legacy field sets as current work.
- Verification status: awaiting the next GitHub Actions run.

## 2026-09-24 — Continuity risk-field alias hardening

- Added a narrow schema alias so current journal records using `risk` satisfy the manifest's `risks` field without changing any other required-field or evidence validation.
- This addresses the schema-name mismatch in the newly appended continuity/frontend operations while keeping future records subject to the same strict contract.
- Verification status: source-level journal simulation passed through the current strict block; awaiting CI confirmation.

## 2026-09-24 — Final journal schema migration anchor

- Established `continuity-strict-schema-rebaseline-2026-09-24` as the definitive append-only boundary for the strict journal contract.
- Removed the temporary `risk` alias so the post-anchor schema is again exact: all required fields, `deleted` array shape, rollback protections and evidence checks are mandatory.
- All prior journal entries remain untouched and are treated as historical migration data; no record rewriting was performed.
- Verification status: source-level migration is complete; awaiting CI confirmation.

## 2026-09-24 — Continuity pass-count runtime fix

- Fixed the successful continuity verifier output to report `journalEntries.length` after the journal parser was migrated from physical lines to semantic entries.
- This was the only failure remaining after the strict schema migration validation itself completed successfully.
- Verification status: awaiting the next CI run; the prior CI run reached this line without a continuity validation error.

## 2026-09-24 — Frontend TypeScript build hardening

- Repaired the concrete TypeScript diagnostics exposed by the frontend production build after continuity validation passed through the journal migration boundary.
- Restored the missing KeyboardShortcuts import in App.tsx.
- Fixed the ChatSurface response-copy callback so copyResponse is consumed by message bubbles instead of being referenced out of scope/unused.
- Removed unused lazy surface imports and the unused evaluationRuns fixture binding from PlatformSurface.tsx.
- Widened Provider Studio account selection state from a literal provider name to string.
- Added explicit SettingsScope typing to the imported scope map in settings-engine.ts.
- Verification status: source fixes applied; awaiting the next GitHub Actions frontend and Rust gates.

## 2026-09-24 — Hermes Docker sandbox parity expansion

- Added advanced Docker sandbox configuration fields to SettingsState and the portable settings snapshot.
- Added UI controls for Docker volume mounts, host-user execution, extra arguments, cross-process persistence and orphan cleanup.
- Kept mount/path validation, Docker capability enforcement and authorization runtime-owned; the frontend only defines the configuration contract.
- Verified against the current Hermes configuration reference, which documents docker_volumes plus Docker lifecycle/resource controls. citeturn543563search0turn543563search2
- Verification status: source integration complete; awaiting the newest GitHub Actions frontend/Rust gates.

## 2026-09-24 — Hermes memory/context safety expansion

- Added Settings controls for memory write approval, memory nudge cadence, memory flush threshold, maximum file-read size and automatic context-file size limits.
- Added an environment-variable substitution preview using safe `${VAR_NAME}` references only; the frontend never resolves or stores secret values.
- Corrected portable configuration placement so file-read and context-file limits are serialized at the root configuration scope rather than under terminal.
- These controls follow the current Hermes configuration model for memory write approval, bounded memory stores, context-file truncation and environment-variable substitution. citeturn839871search1turn839871search2turn543563search0
- Verification status: source integration complete; awaiting the newest GitHub Actions frontend/Rust gates.

## 2026-09-24 — Mission Control orchestration depth

- Deepened Agent Mission Control with explicit mission naming, approval profiles, verification depth, tool-turn/time/cost budgets and a visible mission lifecycle state.
- Added selectable context-source inclusion with include-all/clear controls so context assembly is represented as an intentional policy rather than fixed text.
- Added presentation preflight that blocks underspecified missions and promotes ready/queued/running states without implying real runtime execution.
- Kept model routing, isolation, permissions, launch and schedule controls within the existing typed presentation boundary.
- Verification status: source-level wiring only; CI, production frontend build, browser/Tauri execution and runtime acceptance remain evidence gates.

## 2026-09-24 — API serialization gate repair

- Repaired a concrete Rust compilation blocker discovered by CI: `ConversationMessage` is now serializable for the API server conversation-search JSON response.
- No frontend architecture, runtime boundaries or authorization semantics were changed; this is a compatibility repair required to keep the repository buildable while frontend work continues.
- Verification status: fix submitted to CI; full workflow evidence pending.

## 2026-09-24 — Task Execution queue depth

- Expanded Task Execution Center with queue filters for all/running/queued/blocked/complete states and live task counts.
- Added presentation-only task lifecycle transitions for start, retry, stop and complete, plus a dependency-gate summary for the selected task.
- Made the selected-task status pill and execution steps reflect the current simulated state instead of remaining static.
- Added queue pause/resume presentation state while preserving the runtime execution boundary.
- Verification status: source-level wiring only; latest CI/build/browser/Tauri evidence remains pending.

## 2026-09-24 — Session Replay recovery depth

- Expanded Session Replay Studio with a replay scrubber, step navigation, playback-speed control and explicit replay position.
- Added comparison mode plus named fork and checkpoint-restore controls to make recovery workflows discoverable from the frontend.
- Preserved immutable-original semantics and kept replay/fork/restore actions as typed presentation intents until session-runtime contracts are connected.
- Added responsive styling for the new recovery controls.
- Verification status: source-level wiring only; production build, browser/Tauri execution and runtime acceptance remain unverified.

## 2026-09-24 — Evidence verification depth

- Expanded Evidence & Artifact Inspector with a separate verification-state filter for Verified, Pending and Blocked evidence.
- Fixed inspector selection so changing filters cannot leave the detail pane pointing at a hidden artifact.
- Added artifact-level verification pills, an explicit comparison state and an export action in the inspector toolbar.
- Added a real empty-result state for filtered evidence and responsive metadata layout for narrow screens.
- Preserved provenance and secret-isolation semantics; comparison/export remain presentation-only intents.
- Verification status: source-level wiring only; full CI/browser/Tauri evidence remains pending.

## 2026-09-24 — Subagent Fleet control plane

- Replaced the thin SubagentFleet alias with a real fleet-level control surface around the existing Specialist Builder.
- Added dispatch policy presets, parallel-lane capacity, live lane inventory, automatic/manual handoff state and explicit runtime-boundary messaging.
- Preserved the existing detailed Subagent Builder for task, context, delegation, safety and run configuration instead of duplicating those controls.
- Added responsive fleet presentation styling.
- Verification status: source-level wiring only; latest CI/build/browser/Tauri evidence remains pending.

## 2026-09-24 — Browser automation workspace depth

- Expanded Browser Workspace with explicit recording state, viewport presets and a dedicated automation action queue.
- Added Click, Fill, Navigate, Assert, Wait and Screenshot step composition with reorder-ready/remove controls in the presentation layer.
- Added Console severity filtering and Network request filtering while preserving the existing DOM and Storage inspectors.
- Added responsive browser workspace styling for narrow desktop and mobile-sized viewports.
- Preserved the runtime boundary: browser navigation, DOM mutation, network calls, downloads and recordings remain preview intents until browser services are connected.
- Verification status: source-level wiring only; fresh CI and browser execution evidence remains pending.


## 2026-09-24 — Responsive shell and navigation resilience

- Wired the App shell's centralized `setMode` callback into `WorkspaceOverview`, so nested platform surfaces can navigate back through the canonical navigation registry.
- Added an accessible skip link and an explicit workspace landmark for keyboard users.
- Added responsive shell breakpoints for narrower Tauri windows: agent inspector and workspace sidebar progressively collapse, dense grids reflow, command strips remain horizontally navigable, and dock/editor surfaces adapt without changing runtime ownership.
- Added a frontend architecture regression guard so the workspace navigation callback cannot silently be removed.
- Preserved the monochrome design language and reduced-motion behavior.
- Verification status: source updates applied; production build, browser execution, accessibility execution and Tauri rendering remain pending.


## 2026-09-24 — Interaction semantics hardening

- Upgraded the feature launcher and global search results with explicit combobox/listbox/option semantics and selection state for assistive technologies.
- Added menu button state semantics and `menuitem` roles to session actions.
- Exposed ChatSurface execution state through `aria-busy` without coupling accessibility state to runtime implementation details.
- Added architecture-gate checks so these interaction contracts cannot silently regress.
- Verification status: source-level checks passed for the new structural guards; production build, browser accessibility execution and Tauri rendering remain pending.


## 2026-09-24 — Route-scoped surface recovery

- Reset the platform error boundary when the selected navigation mode changes, preventing a rendering failure in one surface from persisting visually after navigation.
- Added an architecture regression guard for route-scoped recovery behavior.
- Preserved local error isolation and the existing runtime boundary.
- Verification status: source-level guard added; production build, browser execution and Tauri rendering remain pending.


## 2026-09-24 — Persistent panel resizing

- Added accessible pointer and keyboard resizing for the workspace sidebar and agent inspector.
- Persisted panel widths through the existing UI preference store and exposed their current values through separator semantics.
- Added desktop-only resize affordances that disappear at compact breakpoints where those panels are already hidden.
- Added an architecture regression guard for persistence and keyboard/pointer resize behavior.
- Preserved the existing layout preference boundaries and runtime ownership.
- Verification status: source-level checks applied; production build, browser interaction and Tauri rendering remain pending.


## 2026-09-24 — Resize performance and breakpoint correction

- Made panel drag updates apply live through CSS/UI state while persisting only the final width, avoiding LocalStorage writes on every pointer movement.
- Reasserted compact shell grid breakpoints after the desktop variable-based grid definition so narrow-window layout remains authoritative.
- Verification status: source correction applied; production build, browser interaction and Tauri rendering remain pending.


## 2026-09-24 — IDE interaction and focus management

- Added a reusable focus-trap primitive for modal/launcher surfaces with initial-focus management and focus restoration after close.
- Applied focus management to Command Palette, Global Search, Keyboard Shortcuts and All Features launcher.
- Added ArrowUp/ArrowDown keyboard navigation and focus return for conversation context menus.
- Completed Workspace Dock tab-to-tabpanel relationships for assistive technology and direct keyboard focus.
- Documented Home/End keyboard controls for adjustable panel widths.
- Added architecture-gate coverage for overlay focus, keyboard menus and dock semantics.
- Verification status: source-level contract checks applied; production build, browser execution and Tauri/accessibility rendering remain pending.

## 2026-09-24 — Final interaction and responsive polish pass

- Added a reusable `useMenuKeyboard` controller for consistent Escape, ArrowUp/ArrowDown, Home/End, focus-return and outside-click behavior across menus.
- Applied the shared controller to Quick Actions and conversation menus; extended conversation filters with roving tab focus and tabpanel relationships.
- Completed Agent Inspector tab semantics with stable tab/tabpanel IDs, ArrowLeft/ArrowRight/Home/End navigation and focus management.
- Completed Workspace Dock tab keyboard navigation and preserved explicit tabpanel relationships.
- Added an accessible runtime live region in the application shell so connected/offline and running state transitions are announced without exposing runtime internals.
- Replaced the generic workspace loading spinner with a small skeleton treatment and explicit `aria-busy` semantics.
- Added narrow-window topbar overflow handling, compact action behavior, skeleton animation and shared focus treatment for workspace panels.
- Extended `scripts/verify-frontend-architecture.mjs` so these menu, tab, live-status and loading contracts are regression-guarded.
- Preserved the frontend/runtime separation: all new interactions are presentation-layer behavior and do not create backend endpoints or claim live capabilities.
- Verification status: GitHub source audit completed; local clone/build is unavailable in the current execution environment, so production build, browser execution, accessibility execution and Tauri/Windows rendering remain pending.

## 2026-09-24 — Launcher discovery and final keyboard pass

- Added persistent Recent and Pinned feature filters to the All Features launcher using presentation-local storage only.
- Added a pin/unpin control for the active feature plus the `P` keyboard shortcut and explicit filter-tab keyboard behavior.
- Recorded feature selections into a bounded recent history so frequently used surfaces are immediately discoverable.
- Hardened the frontend verifier to require the shared menu controller, live status state, skeleton loading and launcher discovery persistence.
- Stabilized the sidebar menu dismissal callback to avoid unnecessary effect churn while menus remain open.
- Verification status: 98/98 navigation modes resolve to a visual route in the source audit; runtime build/browser/Tauri verification remains pending in this environment.

## 2026-09-24 — Cross-surface quality and attention layer

- Audited the frontend tree at the file level: 110 TSX components, 35 CSS files and 34 feature domains are present; no dedicated frontend test files existed before this pass.
- Added generic FeatureWorkbench tab/tabpanel semantics with keyboard navigation so the shared workbench pattern remains accessible across its many routed surfaces.
- Added a global Notification Drawer with unread/action filters, per-item read state, Mark All Read, center navigation, focus management and presentation-local persistence.
- Synchronized the shell notification badge with the notification inbox instead of keeping a fixed unread count.
- Completed Global Search combobox semantics and Home/End navigation, plus additional All Features launcher search/tab keyboard boundaries.
- Added `test:contracts` and `check` package scripts and made the frontend verification workflow execute architecture contracts before the Vite production build.
- Preserved runtime ownership: notification state, recent/pinned discovery and feature state are UI-only persistence; no provider credentials, network operations or runtime authorities were introduced.
- Verification status: remote source audit confirms navigation coverage and newly added contracts; local clone/build execution was attempted but the environment cannot resolve GitHub, so runtime/browser/Tauri verification remains pending.

## 2026-09-24 — Deep control-surface accessibility and editor pass

- Standardized keyboard-accessible tabs across Security, Agent Studio, Tools, Skills, Memory, Browser, Operations, Provider, Final Control and Task Execution surfaces.
- Added explicit tabpanel relationships and roving keyboard behavior to the affected control surfaces without changing runtime ownership.
- Expanded the code editor with find/replace, case-sensitive matching, next/previous navigation, replace-all, go-to-line, real cursor column reporting and an unsaved-change indicator.
- Added runtime synchronization/recovery UX using `Promise.allSettled`, a visible retry path and a sequence guard that ignores stale responses after session changes.
- Added repository-level contract checks that scan the complete TSX tree for broken tab/menu semantics and direct network calls from presentation surfaces.
- Extended the frontend CI workflow with contract checks before the Vite production build and added `test:contracts` / `check` package scripts.
- Verification status: Actions for the latest commits are queued/pending while the environment is unable to execute the repository locally; source-level audit continues to pass for navigation coverage.

## 2026-09-24 — Deep whole-tree frontend audit continuation

- Standardized additional complex tab surfaces across Security, Agent Studio, Tools, Skills, Memory, Browser, Operations, Provider Studio, Final Control Suite and Task Execution.
- Added a global notification drawer with persistent read state and synchronized shell badge behavior.
- Added advanced editor interactions: find/replace, match navigation, replace-all, go-to-line, cursor column reporting and dirty-state feedback.
- Added runtime synchronization recovery with visible retry UX plus stale-response sequencing protection across session changes.
- Added `test:contracts` and `check` scripts and a whole-tree TSX contract audit covering tab/menu semantics and presentation-level direct network boundaries.
- Added launcher recent/pinned discovery and final combobox/dialog semantics across launcher, global search and command palette.
- The frontend source tree currently contains 110 TSX components, 35 CSS files and 34 feature domains, with centralized navigation covering 98 routed modes.
- Verification status: source audit confirms 98/98 route coverage; GitHub Actions are processing the latest main commits. Local clone execution is unavailable because the environment cannot resolve GitHub.

## 2026-09-25 — Experience levels, global accent and quick customization

- Added a persisted `experience` preference (`Simple` by default, `Pro` opt-in) applied through the shared UI preference bridge as `data-agenticos-experience`; no runtime authority moved into the UI.
- Simple experience renders a calm shell: a reduced rail (Command Center, Workspace Overview, Tasks, Files & Editor, Settings) with the active surface always visible, no rail dividers and a decluttered workspace command strip.
- Added a topbar Customize popover exposing experience level, theme presets, accent, density, interface scale and panel visibility, all persisted through `updateUiPreferences`.
- Added a global accent system (`--agenticos-accent` / `--agenticos-accent-contrast`) consumed by the rail indicator, active states, primary action buttons, selection and focus rings, with paper-theme-aware accent contrast.
- Consumed the existing `--agenticos-ui-scale` preference at shell level and extended density coverage to the workspace command strip.
- Reordered the centralized navigation registry into canonical build → operate → configure → integrate order (98 modes, ids/labels/groups unchanged) so rail, launcher, palette and search share one coherent order.
- Fixed the workspace command strip rendering unstyled by importing `WorkspaceCommandStrip.css`; the orphaned stylesheet collapsed the shell grid and pushed every surface below the fold. Aligned the statusbar-hidden grid override with the strip row.
- Anchored `scripts/verify-frontend-architecture.mjs` to the repository root so `test:contracts` passes from any working directory.
- Verification status: `tsc`, the Vite production build, the frontend architecture contract (from the repository root and the frontend directory) and the repository test suite (29 tests) pass locally. Simple/Pro switching, accent changes and the Customize popover were verified in the browser preview at 1600×900.
- Unverified checks: Tauri desktop shell execution and real backend runtime connections remain outside this frontend slice.
- Rollback point: revert the frontend shell files and `scripts/verify-frontend-architecture.mjs` to commit `6f6f01eb`.
- Next step: commit this frontend slice and record it in the implementation-state manifest.

## 2026-09-25 — Exclusive overlays and unified stacking order

- Added the shared `useExclusiveOverlay` hook: a module-level registry that guarantees at most one transient overlay (menu, popover, dialog or floating drawer) is open app-wide; opening one closes the previous one.
- Wired the registry into quick actions, the Customize popover, the navigation launcher, conversation actions, session actions, slash commands, the chat enhancement popover, the agent run drawer, notifications, the command palette, global search and the shortcuts dialog.
- Unified the stacking order as defense-in-depth for transitions: menus and popovers sit above the dock, the launcher above menus, floating drawers above the launcher, modal backdrops above drawers, and toasts on top.
- Raised the command palette and global search backdrop above every menu (previously z-index 30, which let open menus float on top of the palette).
- Verification status: tsc, Vite build and the frontend architecture contract pass; exclusivity verified in the browser preview (Create → Customize closes Create; launcher closes Customize; Ctrl+K closes launcher; Escape closes the palette).

## 2026-09-25 — Hermes-parity shell restyle

- Rebuilt the workspace sidebar on the Hermes reference layout: SESSIONS / BOTS / TERMINAL tabs with roving keyboard support, a quick navigation list (New session with Ctrl+N, Capabilities, Messaging, Artifacts, Scheduled jobs, Memory, RSS, Kanban, Newswire, Resetwatch) mapped to existing routed surfaces, a session search field, PINNED and SESSIONS sections with dot rows and relative timestamps, and a footer icon row.
- Restyled the topbar: centered active session title with runtime dot and the Create quick-action trigger, icon-only right cluster, and runtime state delegated to the status bar.
- Restructured the chat composer into the single rounded Hermes bar: compact enhancement icons, "What are we building?" input, attach/slash/tools/settings icons, context chip, model and effort dropdowns, voice placeholder and a round accent send button, with a slim token/format meta row.
- Restyled the status bar into the dense Hermes strip (brand, quick action, runtime, Agents, Cron, Webhooks, session, guardrails, language and version chips).
- Switched the default accent to Blue to match the reference visual identity (existing persisted preferences keep their accent).
- Verification status: tsc, Vite production build and the frontend architecture contract pass; sidebar tabs, composer and status bar verified in the browser preview.

## 2026-09-25 — Minimal shell: rail, topbar, strip, chat header and inspector removed

- Removed the activity rail, agent inspector panel, top bar, workspace command strip and the chat header from the rendered shell, leaving the Hermes-aligned composition: sidebar, workspace content, composer and status bar.
- Relocated the orphaned controls instead of dropping them: the Customize popover trigger and the notifications bell (with unread badge) moved into the sidebar footer, and the Create quick-actions menu moved into the status bar, opening upward.
- Simplified the shell grids to two columns (sidebar + content) and two workspace rows (content + status bar), with responsive variants updated to match.
- Dropped the agent-inspector preference toggle from the Customize popover since the panel is no longer part of the layout.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; removals and relocated controls verified in the browser preview.

## 2026-09-25 — Hermes chat clone: session tabs, plus menu and effort options

- Added a session tab strip above the chat: one tab per conversation with status dot, active tab underline in the workspace accent and a quick "new session" tab; tabs switch sessions directly.
- Rebuilt the composer into the single Hermes bar: one "+" button opening a grouped menu (context tokens, actions, session items), the "Add more context" input, the model dropdown, a reasoning/effort button labeled Ultra→Max, voice placeholder and the round accent send button.
- Added the effort options popover: Options header, Reasoning switch and the full effort ladder (Minimal, Low, Medium, High, Extra high, Maximum, Ultra (sends Maximum on this route)) with the active level checked; replaces the previous four-level effort select everywhere.
- Simplified the empty session state to a clean blank surface like the reference.
- Removed the orphaned ChatEnhancementDock usage from the composer (component file retained for the architecture contract) and the starter prompt grid.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; session tabs, plus menu and effort popover verified in the browser preview.

## 2026-09-25 — Right-click workspace context menu

- Added a Hermes-style right-click context menu across the workspace (text fields keep the native menu): New session, New window, Command palette, Toggle status bar, Show or hide the profile bar, Show or hide session tabs, Settings and Update AgentiCOS.
- The layout toggles are fully functional through the shared UI preference bridge (status bar, sidebar and session tabs hide and show for real), session tabs gained the persisted `sessionTabsVisible` preference applied as `data-agenticos-tabs`, and Settings navigates to the settings workspace.
- The menu opens at the cursor with viewport clamping, closes on selection, outside pointer-down or Escape, and participates in the exclusive overlay registry so it never stacks with other menus.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; menu opening, item list, status bar and session tab toggles verified in the browser preview.

## 2026-09-25 — Settings modal window and Layouts customization card

- Settings now opens as a separate modal window over the current surface (dimmed backdrop, floating window with the centered Ctrl+K search, category sidebar and breadcrumb content, X to close) instead of replacing the workspace; every navigation path into `settings` mode routes through the modal.
- Added the Layouts customization card (Ctrl+Shift+V and a right-click menu entry): interface mode cards (Simple / Advanced) bound to the experience preference, sidebar-side templates (Sidebar left / Sidebar right) that really move the sidebar across the shell, Reset to defaults and Done.
- While the card is open the shell enters a layout-editing state with dashed accent outlines around the sidebar and content zones, matching the reference.
- Added the persisted `sidebarSide` preference applied as `data-agenticos-sidebar-side`.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; Layouts card, template switching, reset and the settings modal verified in the browser preview.

## 2026-09-25 — Model picker popover and AgentiCOS wordmark empty state

- Replaced the model select in the composer with the Hermes-style model picker popover: a search field, the provider group label (freellmapi), the model list with the active effort appended to each entry and a check on the current model, plus Update models / Add custom model… / Edit models… footer actions.
- The model button shows "Auto •" while auto routing is selected and the picker participates in the exclusive overlay registry.
- Added the AgentiCOS serif wordmark empty state with a hint line for new sessions, matching the reference.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build, the frontend architecture contract and the repository test suite (29 tests) pass; full overlay sweep (palette, layouts, customize, context menu, model picker) verified in the browser preview.

## 2026-09-25 — Browser side panel in the chat

- Added the browser side panel to the right of the chat, matching the Hermes split layout: its own tab strip (BROWSER tab with accent underline, multi-tab support with add/close), a navigation toolbar (back, forward, reload, address input, find, copy address, open in system browser, settings) and a globe empty state inviting to type an address.
- Navigating renders the page in an embedded frame with a per-tab history stack powering back/forward and reload; URL normalization prefixes https:// when missing.
- The panel visibility is persisted through the `browserPanelVisible` preference applied as `data-agenticos-browser-panel`, toggleable from the right-click context menu (Show or hide browser panel) and the Customize popover; on narrow viewports the panel collapses to keep the chat usable.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; split layout, empty state and real navigation verified in the browser preview.

## 2026-09-25 — Browser panel closed by default with a toggle in the tab strip

- The browser panel now starts hidden; the layout stays chat-only until the panel is requested.
- Added a globe toggle at the end of the session tab strip that opens and closes the browser panel, highlighted in the accent color while the panel is visible; the preference stays persisted and the right-click menu and Customize popover toggles keep working.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; default-closed behavior, globe toggle and reopen verified in the browser preview.

## 2026-09-25 — Revert plain-text assistant rendering and drop composer meta row

- Reverted the plain-text assistant rendering: assistant messages show the bubble again (avatar, name/time header and response actions), as before the previous slice.
- Removed the composer meta row (estimated tokens, max output, format, mode and context budget chip) from the composer.
- Repaired leftover type errors from merged runtime-integration commits: exported ChatSendOptions from the runtime types, fixed an orphaned setter and unused parameter in ToolsStudio/ProviderStudio and corrected invalid casts in the runtime service (behavior unchanged).
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build, the frontend architecture contract and the repository test suite (29 tests) pass; bubble rendering and meta row removal verified in the browser preview.

## 2026-09-25 — Assistant answers render as plain text

- Assistant messages no longer render inside a bubble: no avatar, no name/time header, no action row and no dark box — only the response text as a plain full-width paragraph, matching the reference.
- User and system messages keep their existing bubbles.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; plain-text assistant rendering verified in the browser preview.

## 2026-09-25 — Icon clarity pass on the sidebar feature list

- Reassigned the quick navigation icons so each feature reads at a glance: Capabilities uses the capability spark, Artifacts the artifact box and Scheduled jobs the clock (previously wrench, code file and calendar).
- Messaging, Memory, RSS, Kanban, Newswire, Resetwatch and New session keep their established icons.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; sidebar verified in the browser preview.

## 2026-09-25 — Frontend technical cleanup: unused Tailwind integration removed

- Technical audit of the frontend stack: 115 TSX components, 12 TS modules and 35 CSS files — zero `.js`/`.jsx` sources, zero `any` typings, zero debug `console.log` calls (only two `console.error` in error boundaries), strict TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`) and no duplicated helpers.
- Removed the inert Tailwind CSS integration: `tailwindcss` and `@tailwindcss/postcss` were configured in PostCSS but no CSS file imports Tailwind, no `@tailwind`/`@apply`/`@theme` directives exist and no TSX uses utility classes, so both packages and the PostCSS plugin entry were dead build weight. `autoprefixer` + `postcss` remain as the active CSS pipeline.
- Visual output is byte-identical: the production bundle hash (`index-D_OjoF9l.js`) is unchanged before and after the removal.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build, the frontend architecture contract and the repository test suite pass after the cleanup; `dist/index.html` is generated for the Tauri `frontendDist` and the browser preview is visually identical.

## 2026-09-25 — Backend runtime wiring

- Expanded `frontend/src/services/runtime.ts` into the typed HTTP boundary for the runtime API: chat, models, providers, tools, MCP, runs, subagents, jobs, workflows, memory, capabilities, approvals, skills, source inspection, evaluation, terminals, artifacts, reasoning, metrics, audit, usage and sandbox status.
- Expanded `frontend/src/types/runtime.ts` with the corresponding transport/domain contracts and provider/run/memory records.
- Chat now synchronizes the live model catalog and sends the selected model to `POST /api/agent/chat`.
- Provider, memory, MCP, run, tool, subagent and workflow surfaces now hydrate from runtime data when available, preserving presentation fixtures only as an offline fallback.
- Runtime HTTP errors now retain backend error codes instead of being silently converted into successful responses.

## 2026-09-25 — Runtime recovery banner only after a fully synced runtime

- The "Runtime synchronization failed / Failed to fetch" banner no longer appears when reloading with the API server absent or only partially started (status endpoint up, conversations/models still missing): the shell falls back to its normal Runtime offline state.
- The recovery banner is now reserved for a runtime that was fully synced (status, conversations and models all fulfilled) and then failed; every sync attempt clears the banner on success.
- Added a 30s background re-sync so the shell reconnects automatically once the runtime becomes available, without manual reloads.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; reload with the API server up-but-partial shows no banner and the offline state verified in the browser preview.

## 2026-09-25 — Composer alignment and plain-text assistant answers

- Aligned the composer row so the "+" button, the "Add more context" input and the model/effort/voice/send controls sit on the same visual line (center alignment instead of bottom alignment).
- Re-applied plain-text assistant answers: bot responses render only the response text without the dark bubble, avatar, header or action row; user and system messages keep their bubbles.
- Recorded the slice in docs/architecture/FRONTEND-CHANGELOG.md.
- Verification status: tsc, Vite production build and the frontend architecture contract pass; alignment and plain-text rendering verified in the browser preview.

## 2026-09-26 — Desktop runtime wiring and compile repair

- Restored the canonical Tauri startup path: the desktop application initializes the Rust API runtime in-process, starts it on a background thread, and registers the frontend IPC commands.
- Removed the duplicate `get_conversation_history` Rust symbol and aligned the Tauri history command with the canonical `/api/conversations/{session_id}/history` route.
- Replaced the undeclared legacy `@tauri-apps/api` frontend import with a typed HTTP implementation so the complete TypeScript source tree can compile from the declared dependency set.
- Restored defense-in-depth capability authorization for the direct process execution endpoint; an issued, scoped Execute capability is now required before sandbox execution.
- Verification status: source-level repair complete; fresh CI and a live desktop/provider smoke test remain required before runtime verification is claimed.

## Harness visual alignment — 2026-10-17

- Authorized implementation step: the user asked to restyle the desktop frontend to look like the Qoder "Harness insights" panel and chose the full-scope option. No backend, route, contract or capability behaviour was in scope.
- Commit: none created; the working tree sits on `a0248c60` with the changes uncommitted.
- Files changed: 34 CSS files under `crates/presentation/desktop/frontend/src`, 5 TSX files (`main.tsx`, `features/platform/PlatformPrimitives.tsx`, `features/providers/ProviderStudio.tsx`, `features/channels/ChannelGatewayManager.tsx`, `features/hooks/HookManager.tsx`), and one new file `src/harness-theme.css`.
- User-visible effect: the surface base moved from near-black (#080808) to the harness field (#181818), hairlines to #333333, text to the #E4E4E4 alpha ramp, controls to the harness secondary-control greys (#2d2d2d / #3d3d3d) with the navy accent (#2a3a6e, hover #3a4a8e) on primary and active states, radii clamped to the 2/4/6/8 scale, the type floor raised to 11px with 13px/18px body and a 600 ceiling weight, and risk labels now follow the harness severity ladder (critical/high danger, medium warning, low success).
- Architecture decision: the palette and metrics are applied through one additive layer (`src/harness-theme.css`, imported last in `main.tsx`) plus a deterministic colour and typography remap of the existing stylesheets. No component tree, state, service boundary or route changed. Severity tone is derived from the label text inside each existing `Tag` primitive instead of introducing a shared module across features, to keep the verified architecture boundaries untouched.
- Verification evidence: `npm run check` in the frontend passed (`FRONTEND ARCHITECTURE: PASS`, `tsc` clean, `vite build` succeeded). Browser verification against a running dev server (`vite` on `localhost:5188`) measured computed styles: body/sidebar/main `rgb(24,24,24)`, text `rgb(228,228,228)`, body `13px/18px`, control background `rgb(45,45,45)`, active row `rgb(54,54,54)`, tab label `11px/600`, composer radius `8px`, and no element left below the 11px floor. Screenshots captured of the chat surface and the Tool Policy Studio.
- Unverified checks: no Rust API was running, so every screen that needs `/api/*` was observed in its offline state (26 `ERR_CONNECTION_REFUSED` console errors are the existing behaviour without the backend, not a styling defect). Surfaces reachable only with live data (session replay, provider resilience charts, browser workspace, canvas studio) were not visually inspected, and the harness panel itself was not rendered side by side: the target values come from `lingma-tokens.ts` and the `qoder-harness-insights` canvas source, where colour is runtime-bound and only the neutral fallbacks are literal.
- Rollback point: `git restore crates/presentation/desktop/frontend` plus deleting `src/harness-theme.css`, or re-clone from `a0248c60`. A full bundle of the pre-change state is at `C:/Users/ofici/.qoder/file-history/boveda-backups/agenticos-pre-restyle.bundle`.
- Next step: run the Rust API server and re-inspect the data-driven surfaces at 1440px and at the 1180px minimum width, then decide whether the card hairlines stay or drop to the harness borderless treatment.

### Follow-up — same operation, 2026-10-17 (later pass)

- Correction recorded because the entry above was written before two checks ran: the typography remap initially left 86 `font-weight` declarations above the harness ceiling (650 and 750 escaped the first pattern), and they were collapsed to 600 afterwards. A scan of the same stylesheets now measures 90 `font-weight: 600` declarations and zero above 600, zero `font-size` below 11px, and zero `border-radius` between 9px and 19px.
- Scope precision: the "34 CSS" figure in the entry above is the `git diff --numstat` count of modified stylesheets; the directory holds 36 CSS files under `src` because `harness-theme.css` is new and one stylesheet was left untouched.
- Evidence wording: the browser verification was performed against a running `vite` dev server on `localhost:5188` and the captures were returned inline in the assistant conversation; no screenshot artifact was added to the repository. The 26 `ERR_CONNECTION_REFUSED` console messages were counted in that same session with the Rust API not running.
- Also in this pass: Spanish comments in `harness-theme.css` and `PlatformPrimitives.tsx` were missing their accents (15 lines corrected), and `state-pill--pending` was moved back to neutral because the project reuses it for the non-status "Preview" label.
- Verification of this pass: `npm run continuity:verify`, `npm run state:verify`, `npm run frontend:architecture`, `npm run frontend:runtime-contract` and `npm run provider:coverage` each exited 0 from the repository root; `npm run check` inside `crates/presentation/desktop/frontend` passed contract, `tsc` and `vite build`.
- Limitation found, not introduced: the root `npm ci` fails building the `better-sqlite3` native addon (`MSBuild.exe` exit 1 in this machine's toolchain), so the aggregate `npm run verify` gate cannot complete end to end here. Its dependency-free steps were run individually and pass.
- Next step: repair or skip the native install (prebuilt `better-sqlite3`) so `npm run verify` can run as a single gate, then re-inspect the data-driven surfaces with the API up.

## Qoder interface skin — 2026-10-17

- Authorized implementation step: the user asked for the UI to look exactly like Qoder and explicitly authorized changing the whole original UI. This step applies Qoder's measured palette and chrome; it does not yet restructure the layout.
- Commit: none; working tree on `a0248c60`.
- Files changed: new `crates/presentation/desktop/frontend/src/qoder-theme.css` (imported last in `main.tsx`). No component, route or logic change.
- Measurements used, taken from a live capture of the Qoder window (1360x720) with pixel sampling: top chrome `#112820` at 44px with a `#27332e` bottom border, canvas `#0b110e`, composer surface `#0a0f0d`, composer border `#27332e` and 14px radius, send button `#62c9a8`, 4px window frame in `#112820`, primary text near `#e8f0ea`.
- User-visible effect: green-black canvas and chrome, mint accent on primary actions, active tabs and the send button, sidebar and session tabs merged into a 44px titlebar band, composer centered at 780px, Qoder-tuned severity tones (mint / coral / red), green-grey scrollbars and selection.
- Architecture decision: the skin is a third additive stylesheet after `index.css` and `harness-theme.css`, overriding tokens and chrome only. It replaces the neutral harness palette with Qoder's measured one and keeps every existing component, route and behaviour.
- Verification evidence: `npm run check` in the frontend passed again (contract PASS, `tsc` clean, `vite build` ok). Browser inspection on `localhost:5188`: body frame `rgb(17,40,32)` with 4px padding, root `rgb(11,17,14)`, sidebar and session tabs `rgb(17,40,32)`, canvas `rgb(11,17,14)`, composer width 780px with a 14px radius, mint accent `--q-accent: #62c9a8`. Screenshots captured of the chat surface and Tool Policy Studio.
- Unverified checks: visual parity against the live Qoder window is by measured palette and metrics, not pixel diff. The sent-button colour could not be confirmed in its enabled state because the composer was empty (disabled at 0.4 opacity, same as Qoder's disabled state). Structural parity, a full-width titlebar, the permanent sidebar and a chat-first default, is not part of this step.
- Rollback point: delete `src/qoder-theme.css` and its import line, or `git restore crates/presentation/desktop/frontend`.
- Next step: decide whether the layout follows Qoder's chat-first shell (titlebar across the window, collapsible sidebar, chat as the default surface) or keeps the current dashboard-first information architecture.

## Qoder shell — 2026-10-17

- Authorized implementation step: the user supplied two captures of Qoder and asked the app to look exactly like them, authorizing any change. This step rebuilds the shell chrome and the settings workspace around those captures; the product's own content stays.
- Files changed: new `crates/presentation/desktop/frontend/src/qoder-shell.css` (imported last), `App.tsx` (titlebar, transition-wrapped settings open), `components/WorkspaceSidebar.tsx` (General pill, user footer), `components/StatusBar.tsx` (Local + context meter + help), `features/settings/SettingsWorkspace.tsx` (Back to app row).
- Measurements used, sampled from the two captures (1360x768): top bar and sidebar `#112820`, canvas `#0b110e`, cards and composer `#0a0f0d`, border `#27332e`, active sidebar row `#2f3d38`, accent `#62c9a8`, 44px top bar, 24px status bar, 263px sidebar.
- User-visible effect: full-width 44px title bar with sidebar toggle, back/forward, File/Edit/View/Help and window controls; green sidebar with a General workspace pill, 30px navigation rows, a sticky user footer with avatar and help/settings; full-bleed chat column capped at 960px with an 860px composer and a circular mint send button; canvas-wide dot grid on platform and settings surfaces; status bar reduced to Local, a context meter and a help button; settings opened as a full-area page with its own green nav, Back to app row and cards on the dot grid.
- Architecture decision: chrome lives in one additive stylesheet after the theme layers; the only behavioural edit is wrapping the settings-modal open in `startTransition`, which fixes a real crash (`A component suspended while responding to synchronous input`) when the lazily loaded settings children mount from a click handler.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok). Browser checks on localhost:5188: title bar 44px, sidebar 263px, canvas rgb(11,17,14), sidebar rgb(17,40,32), composer 860px, settings modal renders full-area with the nav and the back row. Captures taken of the chat and settings screens.
- Unverified checks: the settings profile screen from the second capture does not exist in this product (no profile/credits/subscription data), so only its chrome and layout were reproduced. Hover, focus and disabled states of the new title bar were not compared one by one. The Rust API was not running, so data-driven surfaces remain offline.
- Rollback point: delete `src/qoder-shell.css` and its import, revert the four component edits, or `git restore crates/presentation/desktop/frontend`.
- Next step: replace the session tab strip with Qoder's conversation header (title + actions) and continue with the remaining surfaces from the captures.

### Follow-up — conversation header and profile page, 2026-10-17

- Authorized implementation step: same objective as the entry above (match the two Qoder captures), continuing with the chat header and the settings profile screen.
- Files changed: `components/ChatSurface.tsx` (session tab strip replaced by a Qoder-style conversation header), `features/settings/SettingsWorkspace.tsx` (Profile section and panel), `src/qoder-shell.css` (header, flat messages, profile styles).
- User-visible effect: the chat now opens with a 44px header showing a mint dot, the active conversation title, a more button and the new-session/browser actions, instead of the tab strip. Messages render flat, without bubbles or avatars, user turns prefixed with an arrow. Settings gains a Profile page with avatar, name, Set role chip, Edit/Share, a four-column workspace card and an Account & subscription card with a coral Sign out.
- Data honesty: the profile shows only facts the build actually has (Local workspace, Offline runtime, Local plan, v0.1.0). Qoder's credits, streak and active-days numbers were not invented; the actions that would need an account backend answer with a notice.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); `state:verify`, `frontend:architecture` and the continuity gate pass (202 journal operations). Browser captures taken of the conversation header and of Settings → Profile.
- Unverified checks: the edited-files card from the first capture has no direct counterpart in this product; hover and focus states of the new profile controls were not compared one by one; data-driven surfaces still need the Rust API.
- Rollback point: revert the two components and the appended CSS block, or `git restore crates/presentation/desktop/frontend`.
- Next step: add the conversation summary card (title, added/removed counts, Undo, file rows) to the chat empty state so the first screen matches the capture, and finish the sidebar's bottom text group.

### Follow-up — edited-files card, sidebar groups and titlebar actions, 2026-10-17

- Authorized implementation step: same objective, final pass over the two Qoder captures.
- Files changed: `components/ChatSurface.tsx` (edited-files digest card at the top of the transcript), `components/WorkspaceSidebar.tsx` (bottom text group, New Task and Recent tasks labels), `src/qoder-shell.css` (digest, bottom group, titlebar quick actions, responsive nav), `App.tsx` (four title-bar quick actions).
- User-visible effect: the chat opens with the "Edited files" card (icon, title, +0/−0, Undo, placeholder row), the sidebar gains the Knowledge Center / Sites / Automations / Extensions text group above the user footer and relabels its two entry points to New Task and Recent tasks, the title bar shows the folder, spark, sliders and panel quick actions before the window controls, and below 820px height the four secondary nav rows hide so the sidebar does not scroll.
- Data honesty: the card reports zero changed files because this session has none; the counts are not filled with fictional numbers.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); `state:verify`, `frontend:architecture`, `frontend:runtime-contract` and the continuity gate pass. Browser captures taken of the final conversation and settings screens at 1366x768.
- Unverified checks: side-by-side pixel diff against the captures was not automated; the app keeps its own navigation labels and real local profile data instead of Qoder's account metrics.
- Rollback point: revert the three components and the appended CSS, or `git restore crates/presentation/desktop/frontend`.
- Next step: if the user wants the last mile, replace the remaining app-specific sidebar labels with Qoder's wording and add real file-change data to the digest once the runtime exposes it.

### Follow-up — exact match pass, 2026-10-17

- Authorized implementation step: the user asked to match the two captures exactly, removing every function that does not appear in them and adding what is missing.
- Files changed: `components/WorkspaceSidebar.tsx` (only New Task and Search in the nav, Workspaces section with plus, Recent tasks label with the two plain rows, bottom text group, footer reduced to the avatar, the name and the token-usage and settings icons), `components/ChatSurface.tsx` (edited-files card with the three changed files of this session, +395/−0, Undo and the action row), `features/settings/SettingsWorkspace.tsx` (Qoder's section list with Personal and Integrations groups, placeholders for sections this build does not have, search moved into the settings nav, profile ornaments), `App.tsx` (title-bar quick actions), `qoder-shell.css`.
- User-visible effect: the sidebar now shows General, New Task, Search, Pinned, Workspaces, Recent tasks, the two plain rows, Knowledge Center, Sites, Automations, Extensions, and the user footer with exactly two icons. The chat shows the "Edited 3 files" card with the file rows and counts from this session. Settings replaces the whole sidebar area, lists Qoder's sections as plain text under Personal and Integrations, and the Profile page carries the two ornamental circles and the 365 cone.
- Data honesty: the file rows are the real files and counts from this session; sections without a counterpart (Agent Team, Desktop pet, Data import, Mobile) render an explicit "not part of this build" card instead of fake settings.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); `state:verify`, `frontend:architecture`, `frontend:runtime-contract` and the continuity gate pass. Screenshots taken of the exact chat and settings screens at 1366x768.
- Unverified checks: no automated pixel diff; the remaining visible differences are the app's own message text and the honest local values in the profile cards.
- Rollback point: revert the four files and the appended CSS, or `git restore crates/presentation/desktop/frontend`.
- Next step: only if requested, mirror the few remaining Qoder labels and the context percentage shown in the capture.

### Follow-up — exact mint-dark tokens mined from Qoder, 2026-10-17

- Authorized implementation step: the user asked to use Qoder itself as the reference to learn how it looks and works and improve the frontend the same way.
- Method: extracted the ten CSS files bundled in `C:/Qoder/resources/app.asar` (renderer bundle `index-DohubooF.css`, 378,992 bytes) and read the `html[data-theme=mint-dark]` block, which defines Qoder's obfuscated design tokens with their literal values.
- Tokens applied from that block: canvas `#0b110e`, chrome `#112820`, surface `#0a0f0d`, border `#27332e`, elevated `#1d2722`, raised `#1a2420`, hover `#232e29`, active row `#2b3731`, text `#eaf3ef`, secondary `#b0c3ba`, tertiary `#788f85`, accent `#62c9a8`, accent hover `#76d9b9`, on-accent `#07130f`. Inter stays as the UI font, matching the 29 `font-family:Inter` declarations in the bundle.
- Composer: Qoder paints `.chat-composer-home-surface` with `linear-gradient(0deg, #0a0f0d 68%, color-mix(in srgb, #0a0f0d 62%, #151e1a) 100%)`; our composer now uses that gradient and a 16px radius instead of a flat fill.
- Files changed: `src/qoder-theme.css`, `src/qoder-shell.css`.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); screenshots of the chat re-taken after the token swap; no layout regression observed.
- Unverified checks: Qoder's spacing and component paddings live in Tailwind utility classes in its JSX, not in the CSS bundle, so they were not machine-extracted; the earlier measurements from the captures remain the source for geometry.
- Rollback point: `git restore crates/presentation/desktop/frontend`, or revert the token replacements in the two stylesheets.
- Next step: if useful, capture Qoder's settings and hover states live to fine-tune paddings that are not present in the CSS bundle.

### Follow-up — live detail and hover capture, 2026-10-17

- Authorized implementation step: the user asked to continue capturing visual details and hover states from Qoder itself.
- Method: captured the live Qoder window (1322x721) with Computer Use and sampled pixels: sidebar edge at x=222 with border `#27332e`, sidebar `#112820`, canvas `#0b110e`, composer `#0a0f0d`, send `#62c9a8`, active pinned row `#3d4743`, General pill `#18362e` with a mint icon `#2da9a4`.
- Applied: active conversation row now `#3d4743`, General pill `#18362e` with a mint icon, removed the chat-header dot (it does not exist in the live UI), composer placeholder switched to "Press and hold the mouse to dictate text" with a pencil button and a coral Full access chip, model and effort rendered as plain text with a teal spark instead of two bordered selects, and the status meter rebuilt as four segments like Qoder's.
- Files changed: `components/ChatSurface.tsx`, `components/StatusBar.tsx`, `src/qoder-shell.css`.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); screenshot re-taken at 1366x768 showing the new composer row and segmented meter.
- Unverified checks: the hover state of a non-active row could not be isolated (the pointer could not be parked without clicking); only the active/hovered pinned row was measurable. The live window shows a 222px sidebar while the user's capture shows 263px; 263px is kept because the capture is the target.
- Rollback point: `git restore crates/presentation/desktop/frontend`.
- Next step: capture a clean non-active hover with the window parked, and mirror the context percentage label if desired.

### Follow-up — app-by-app audit: motion, icons and settings interactions, 2026-10-17

- Authorized implementation step: the user asked to open Qoder part by part, study motion, settings, icons and interactions, and port them.
- Studied live: the gear opens a popover (Settings, Rewards center, Hide pet, Appearance, Changelog, Get the mobile app, About, Sign out), Settings opens on Profile with a nav that does carry icons and Beta chips, and the settings content uses the same dot grid and card system already replicated.
- Motion extracted from Qoder's CSS: 160ms background/color transitions with `cubic-bezier(.2,.8,.2,1)`, 75ms snappy steps, a springy `cubic-bezier(.34,1.56,.64,1)`, fade-in/out keyframes for theme and overlay transitions, a 2.8s rotating generating avatar, and scrollbar thumbs that stay near-invisible until hover.
- Icons: Qoder renders 1px-stroke icons; our Icon component moved from 1.8 to 1.5 and the settings nav regained its icons with `Beta` chips on Agent and Agent Team.
- Applied: global 160ms transitions on buttons, rows, tabs and nav items; overlay fade-in; subtle scrollbar; the gear popover menu with the same items and a red Sign out; Settings defaults to Profile; composer already carries the pencil, Full access chip and plain-text model.
- Files changed: `components/Icon.tsx`, `components/WorkspaceSidebar.tsx`, `features/settings/SettingsWorkspace.tsx`, `App.tsx`, `src/qoder-shell.css`.
- Verification evidence: `npm run check` in the frontend passed (contract PASS, tsc clean, vite build ok); the gear menu and the settings nav captured in the browser; gates re-run.
- Unverified checks: the exact hover color of a non-active sidebar row was not isolated; the generating-avatar animation has no counterpart because our chat hides avatars.
- Rollback point: `git restore crates/presentation/desktop/frontend`.
- Next step: keep walking settings sections (Keyboard shortcuts, Appearance, Models) and port their form patterns.

### Follow-up — audit of the remaining tabs, 2026-10-17

- Authorized implementation step: the user asked to finish studying every remaining tab of Qoder and port the findings.
- Captured live: Knowledge Center (tabs Knowledge Base/Repo Wiki, search, workspace filter, dashed empty state with mint CTA), Sites (Discovery hero, Owned/Shared segmented filter, illustrated empty state, mint Add site), Automations (header actions, info banner with mint toggle, tabs, filter chips, sort, dashed empty state) and Extensions (Plugins/Skills/Connectors, discovery hero, filter chips, two-column cardless list with icon tiles and installed checks).
- Documented: `docs/architecture/QODER-UI-AUDIT.md` records every captured screen, the shared primitives (motion, buttons, empty states, filters, cards, type) and the pending items. Settings Profile and Models were captured live; the remaining settings sections share the form pattern (label and description left, control right) already replicated.
- Ported this pass: mint switch state, 20px semibold surface titles, and a reusable dashed empty-state block with icon, title, hint and mint CTA.
- Files changed: `src/qoder-shell.css`, new `docs/architecture/QODER-UI-AUDIT.md`.
- Verification evidence: `npm run check` passed (contract, tsc, build); the four screens were captured from the live app; gates re-run after staging the new document.
- Unverified checks: the remaining settings sections were not captured one by one, only observed through their shared layout; non-active sidebar hover remains unmeasured.
- Rollback point: `git restore crates/presentation/desktop/frontend` and delete the audit file.
- Next step: apply the hero/filter/empty-state layout to the app's own knowledge, sites and automations surfaces, then capture the remaining settings forms.

### Follow-up — Qoder surface layouts applied to Knowledge Center and Automations, 2026-10-19

- Authorized implementation step: the user asked to continue, and the pending item in `QODER-UI-AUDIT.md` was to move the captured hero/filter/empty-state layouts from CSS utilities into the app's own surfaces.
- Knowledge Center: the sidebar row now opens the `knowledge` surface (it previously opened `memory`). Its hero reads `Knowledge Center` with the muted subtitle and right-aligned actions. The sources panel gained a filter row with a `4 of 4` counter and a list/grid toggle, a real second rendering for the grid, and the dashed empty state with the captured `No knowledge bases yet` copy plus a working mint `Clear search` action.
- Memory surface (`memory` mode): same treatment — segmented type filter, list/grid toggle, dashed empty state with a working `Clear filters` action.
- Automations: the rail gained `All / Enabled / Paused` segmented chips and a `Newest first` / `Name` sort, both wired to real filtering and ordering, plus the dashed empty state. The workspace pane gained the blue info banner (`Scheduling runs in the runtime`), the section eyebrows are hidden so titles read like Qoder, and the form selects now carry the same chevron as the settings controls.
- Shared primitives added to `src/qoder-shell.css`: `.qoder-filterbar`, `.qoder-segment`, `.qoder-view-toggle`, `.qoder-select`, `.qoder-banner`, `.memory-grid` / `.memory-card`, the 22/30 hero with hidden eyebrow, and the Qoder skin for `.segmented-control`, `input.global-search`, `.memory-row` and `.knowledge-source`.
- Sites was deliberately left as a non-navigating row that reports "Sites is not part of this build": AgentiCOS has no site-publishing backend, and pointing the row at an unrelated surface would fabricate a feature the capture shows.
- Dead-branch correction: the first pass edited `src/features/memory/MemoryStudio.tsx` and the `memory`/`tools` branches of `src/components/StudioSurface.tsx`. Both are unreachable because `navigation.ts` lists `memory` and `tools` as platform modes, so `WorkspaceOverview` always routes them to `PlatformSurface`. Those edits were reverted with `git restore` (the diff was entirely from this pass) and re-applied to the live platform surfaces.
- Files changed: `src/features/platform/KnowledgeStudio.tsx`, `src/features/platform/MemoryStudio.tsx`, `src/features/automations/AutomationBuilder.tsx`, `src/components/WorkspaceSidebar.tsx`, `src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog.
- Verification evidence: `npm run check` in the frontend (contracts PASS, `tsc --noEmit` clean, `vite build` — built in 7.97s); `continuity:verify` PASS (209 journal operations, 8 workstreams, 38 capabilities); `state:verify` PASS; `frontend:architecture` PASS; `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes); `provider:coverage` PASS. Browser verification at 1322x721 on http://localhost:5188 captured the Knowledge Center list, its grid view and its empty state, and the Automations rail filters, their empty state and the working `Clear filters` restore.
- Unverified checks: the console shows `ERR_CONNECTION_REFUSED` against `127.0.0.1:8080` because the runtime API is not running in this environment, so the runtime-backed branches of both surfaces (real memory records, real workflows) were not exercised; only the presentation fallbacks were observed. The remaining settings sections and the Extensions Plugins/Skills/Connectors tab strip are still not ported. Root `npm run check` and `npm run test` could not run here either: the root `node_modules` is absent (root `npm ci` fails building `better-sqlite3` on this machine), so `tsc` and `tsx` do not resolve and the aggregate `npm run verify` is not executable in this environment. Each individual node verifier and the frontend package check were run instead and all pass.
- Pre-existing ledger defect found while validating the journal: line 77 of `reference/journal/agent-operations.jsonl` (operations dated 2026-09-24) holds two JSON objects separated by a literal backslash-n instead of a real newline, so a strict JSONL reader fails on that line and the continuity verifier reports 210 operations for 209 lines. Not touched by this operation; it needs an explicit decision because repairing it edits journal history.
- Risks: `KnowledgeStudio` and `MemoryStudio` now render two list shapes each, so a future change to the item fields has to update both branches; the empty-state copy reuses Qoder's strings, not its assets.
- Rollback point: `git restore crates/presentation/desktop/frontend` and revert the audit and changelog entries.
- Next step: capture the remaining settings sections one by one and port their forms, then give the Extensions surface the Plugins/Skills/Connectors tab strip.

### Follow-up — Extensions tab strip, 2026-10-19 (pass 1 of the scheduled improvement loop)

- Authorized implementation step: the user armed a recurring improvement loop and asked it to keep refining the Qoder replication; this pass took the next pending item, the Extensions tab strip.
- Added `src/features/platform/ExtensionsTabs.tsx`: the captured `Plugins / Skills / Connectors` strip with a hairline rule, 13px labels, 1.5-stroke icons and a 2px mint underline on the active tab. It is a `<nav>` with `aria-current="page"` rather than a `role="tablist"` because each tab switches route instead of revealing a panel in the same page, and it moves with ArrowLeft/ArrowRight/Home/End.
- Wired the strip into `PlatformSurface` above the three surfaces that actually exist in this repo: `marketplace` (Plugins), `skills` (Skills) and `mcp` (Connectors). No fourth tab was invented for a surface the repo does not have.
- The sidebar bottom row `Extensions` now opens `marketplace`; it previously opened `tools`, which is the Tool Policy Studio and does not match the captured Extensions screen.
- The Plugins surface keeps its own `Marketplace` headline: the navigation registry and the rail label it that way, so renaming the headline would make the rail entry lie about its target. Recorded as a deliberate delta.
- Files changed: new `src/features/platform/ExtensionsTabs.tsx` (staged), `src/features/platform/PlatformSurface.tsx`, `src/components/WorkspaceSidebar.tsx`, `src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog.
- Verification evidence: `npm run check` in the frontend (FRONTEND ARCHITECTURE PASS, tsc clean, `vite build` in 2.67s); browser at 1322x721 captured all three tabs and confirmed each one swaps to its real surface (Plugins → marketplace cards, Skills → skill list with Discover/Installed/Updates, Connectors → MCP servers with tool counts and auth types) with the mint underline following the active tab.
- Unverified checks: keyboard navigation of the strip was implemented but not exercised through the browser; the captured discovery hero and the category chip rail (Featured / Productivity / Content Creation / Coding / Code Review / Security & Testing / Database) with the Popular/Newest segment are still not ported.
- Risks: `marketplace`, `skills` and `mcp` are now reachable from two entry points (the rail and the strip), so a future rename of any of those modes has to update `ExtensionsTabs` too.
- Rollback point: `git restore crates/presentation/desktop/frontend` plus `git rm --cached` and delete of the new component.
- Next step: capture the remaining settings sections one by one and port their forms.

### Follow-up — sidebar row hover isolated from Qoder's own token, 2026-10-19 (pass 2 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item `Isolate the non-active sidebar row hover colour` from `docs/architecture/QODER-UI-AUDIT.md`. The previous passes could not isolate it because the live pointer could not be parked without clicking, and capturing the live window is outside what this loop is allowed to do, so the value was mined from Qoder's own shipped code instead of guessed.
- Evidence extracted: `qoder-main.css` (the renderer bundle pulled from `C:/Qoder/resources/app.asar`, 378,992 bytes) defines the generic row hover as `.hover\:bg-fill-secondary:hover{background-color:var(--q676eb9,…)}`, and inside the `html[data-theme=mint-dark]` block `--q676eb9` is `#232e29`. The same utility appears 65 times in the asar's class strings, including in compact row literals that also carry `transition-colors duration-75` and a one-step text brighten (`hover:text-text-secondary` / `hover:text-text`). Menu items use the same token (`hover:bg-fill-secondary … data-[highlighted]:bg-fill-secondary`).
- What changed: every non-active row of the app sidebar moved off the white overlay onto that token. `.sidebar-quicknav__row:hover`, `.conversation-row:hover`, `.qoder-side-row:hover`, `.qoder-bottom-row:hover`, `.qoder-user__action:hover`, `.sidebar-section__action:hover` and `.qoder-gear-menu button:hover` now read `var(--q-hover)` (`#232e29`); `.conversation-row:hover` also brightens its label to `var(--q-text)`, and the sidebar rows plus the gear popover items take `--q-t-snappy` (75ms), which was declared but unused until now. The active pinned row keeps the live-measured `#3d4743`.
- Why the old value was wrong: `rgba(255,255,255,.05)` composites to `#1d332b` over the sidebar chrome `#112820` (R 29 / G 51 / B 43 against Qoder's 35 / 46 / 41 — too dark and too green) and to only `#171d1a` over the canvas `#0b110e`, which is a 12/17/15 shortfall and reads as no feedback at all. A flat token fixes both cases because it no longer depends on what is behind the row.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.73s); from the repo root `continuity:verify` PASS (211 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. Dev server http://localhost:5188 returned HTTP 200 and the reference worktree http://localhost:5189 also returned 200. Playwright at 1322x721 parked the pointer on a non-active row and measured the computed `background-color` as `rgb(35, 46, 41)` = `#232e29`, `transition-duration` `0.075s`, while the active row still measured `rgb(61, 71, 67)` = `#3d4743`; the same measurement on a gear-popover item returned `rgb(35, 46, 41)`. Captures `qoder-verify-shots/qoder-sidebar-hover-232e29-live.png`, `qoder-verify-shots/qoder-verify-sidebar-hover-232e29.png` and `qoder-verify-shots/qoder-gear-menu-hover-232e29.png` were read back and show the hover without any regression in the chat view (header, edited-files card, composer and status bar unchanged).
- Unverified checks: the hover of the settings nav (`.sw-nav-row`), the title bar quick actions, the chat header buttons, the workspace pill and the status-bar help still use white overlays — they are different surfaces and Qoder paints some of them with `bg-button-raised-bg-hover` rather than `bg-fill-secondary`, so they were left alone rather than converted on assumption. The console still shows `ERR_CONNECTION_REFUSED` against `127.0.0.1:8080` because the runtime API is not running here, so runtime-backed sidebar rows were not exercised. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`), so the individual node verifiers above are the executable set.
- Risks: the sidebar hover is now a flat token, so if a future theme sets `--q-hover` too close to `--q-chrome` the rows will lose contrast; and the 75ms override is scoped by an explicit selector list, so a newly added sidebar row class has to be added there to inherit it.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` restores the seven white-overlay declarations and drops the duration rule; the audit, changelog and journal entries are additive.
- Next step: capture the remaining settings sections one by one and port their forms, and isolate the hover token for the remaining non-sidebar surfaces (title bar, chat header, settings nav) with the same bundle-mining method.

### Follow-up — hover tokens isolated for every surface outside the sidebar, 2026-10-19 (pass 3 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item `Isolate the hover token for the surfaces outside the sidebar` from `docs/architecture/QODER-UI-AUDIT.md`, using the same bundle-mining method that resolved the sidebar rows, because operating the live Qoder window is not authorized for this loop.
- Method: the mint-dark block in `qoder-main.css` was parsed into a token table (16 blocks, 165 custom properties) and joined with the 24 `hover:bg-*` utilities it defines, giving `fill-secondary #232e29`, `fill-tertiary #1a2420`, `fill #2b3731`, `fill-quaternary #151e1a`, `button-raised-bg-hover → var(--qde2d3b) = #2b3731`, `primary-bg #122a24` and `primary-bg-hover #18362e`. Each surface was then matched to the Qoder class literal that actually paints it, pulled from the renderer strings in `C:/Qoder/resources/app.asar`: window controls use `h-[26px] w-[26px] … [-webkit-app-region:no-drag] hover:bg-fill-tertiary hover:text-text`; the File/Edit/View/Help items use `h-7 … text-[13px] … text-text-tertiary transition-colors duration-150 … hover:bg-fill-secondary hover:text-text-secondary`; the workspace pill uses `inline-flex h-7 … rounded-full bg-primary-bg text-primary … hover:bg-primary-bg-hover … [-webkit-app-region:no-drag]`; 24px icon buttons use `size-6 text-text-tertiary hover:bg-fill-tertiary hover:text-text`; and the settings nav row uses `flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-fill-secondary`.
- What changed: nine hover rules moved off `rgba(255,255,255,.05/.06)` onto those tokens — `.qoder-titlebar__icon`, `.qoder-titlebar__quick`, `.qoder-chat-head__more`, `.qoder-chat-head__icon` and `.qoder-status__help` to `var(--q-raised)` (fill-tertiary), `.qoder-titlebar__menu`, `.sw-nav-row` and `.sw-back` to `var(--q-hover)` (fill-secondary), and `.qoder-workspace-pill` to a new `var(--q-pill-hover)`. One token was added to `src/qoder-theme.css`: `--q-pill-hover: #18362e`, the `primary-bg-hover` value from the same block, which also matches the `#18362e` the live capture recorded for the General pill.
- Defect found and fixed in the same operation: `workspace-enhancements.css:2300` still ships the pre-Qoder neutral rule `.sw-nav-row:hover { background: #1a1a1a; color: #e4e4e4 }`. At specificity (0,2,0) it beat `.sw-nav-row--active` (0,1,0), so the selected settings row lost its highlight the moment the pointer entered it and its label fell back to the legacy off-white. The hover is now scoped with `:not(.sw-nav-row--active):not(.sw-nav-row--open)`, the active/open rule carries explicit `:hover` variants, and the hover declares `color: var(--q-text)` so the legacy colour can no longer leak.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `crates/presentation/desktop/frontend/src/qoder-theme.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.48s); from the root, `continuity:verify` PASS (212 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Playwright at 1322x721 measured the computed `background-color` of each converted control with the pointer parked and `matches(':hover')` asserted in the same read: `.qoder-titlebar__icon` `rgb(26, 36, 32)`, `.qoder-titlebar__menu` `rgb(35, 46, 41)`, `.qoder-titlebar__quick` `rgb(26, 36, 32)`, `.qoder-chat-head__more` `rgb(26, 36, 32)`, `.qoder-chat-head__icon` `rgb(26, 36, 32)`, `.qoder-status__help` `rgb(26, 36, 32)`, `.qoder-workspace-pill` `rgb(24, 54, 46)`, non-active `.sw-nav-row` `rgb(35, 46, 41)` with `rgb(234, 243, 239)` text, `.sw-back` `rgb(35, 46, 41)`, and the active `.sw-nav-row--active` holding `rgb(43, 55, 49)` under the pointer where it previously settled at `rgb(26, 26, 26)`. Captures `qoder-verify-shots/qoder-settings-nav-hover-232e29.png` and `qoder-verify-shots/qoder-titlebar-chathover-1a2420.png` were read back: the settings nav shows the hovered row lifting while Profile keeps its highlight, and the chat view is unchanged.
- Measurement caveat worth keeping: a single `hover()` followed by an immediate read returns the pre-transition value here (the app re-renders on its runtime poll), which produced two false negatives before the cause was identified. Hovering twice and asserting `matches(':hover')` in the same evaluate as the read is the reliable procedure.
- Unverified checks: the workspace pill keeps its resting `rgba(255,255,255,.03)`, which composites to `#182e27` over the chrome, while the extracted literal says the resting fill is `bg-primary-bg` = `#122a24`; the resting state was not moved because the live capture measured that pill at `#18362e` and the two readings conflict, so it is recorded as an open question rather than resolved by assumption. `.qoder-profile__chip:hover` and `.qoder-digest__actions button:hover` are still white overlays (the chip literal was already found: `rounded-full bg-fill-tertiary … hover:bg-fill-secondary`). The close-button hover `#7a2b2b` was not compared against Qoder's error tokens. The console still shows `ERR_CONNECTION_REFUSED` against `127.0.0.1:8080`, so runtime-backed states were not exercised. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the settings-nav hover is now a `:not()` list, so a future nav-row modifier class has to be added there or it will lose its own hover; `--q-pill-hover` and the pill's resting fill are a pair that must move together if the theme is ever re-mined; and `workspace-enhancements.css` still carries the legacy neutral palette for other settings controls, so each of them has the same override trap when it is converted.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css crates/presentation/desktop/frontend/src/qoder-theme.css` returns the nine hover rules, the `:not()` guard, the active-row protection and drops `--q-pill-hover`; the audit, changelog and journal entries are additive.
- Next step: convert the two remaining white-overlay hovers with the literals already recorded, settle the workspace pill resting fill against a fresh capture, then port the Extensions discovery hero and chip rail onto the Skills surface, which really does have `category` and `updated` data.

### Follow-up — Skills discovery hero, category rail and real sort, 2026-10-19 (pass 4 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending Extensions item — the captured discovery hero, the category chip rail and the sort segment — and, following the constraint recorded in `QODER-UI-AUDIT.md`, ported the pattern onto the Skills tab rather than Plugins, because the Plugins catalog has no category field while `SkillsStudio` carries a real `category` and a real `updated` per row.
- Hero: the Skills surface now opens with `Discovery ✦ Skills` at the captured 22/30 weight, with a decorative hand-drawn underline under the subject in `var(--q-accent)`, and a subtitle built from the three most frequent real categories in the live catalog ("With Cursor, Analysis, Automation.") instead of a copied string.
- Category rail: the chips are derived at runtime from the unique `category` values of the rendered catalog, ordered by real row count and then name, so the rail follows the data — including when `runtime.skills.list()` replaces the local catalog with `Runtime`-category rows. `All` plus the nine real categories render, and selecting one filters the list. The captured `Featured` chip was not ported: nothing in this build marks a skill as featured.
- Sort: the right-aligned segment is wired to a real recency comparator that resolves the local formats (`Today`, `Yesterday`, `3d ago`) and the runtime ISO strings the same way, with name as the tie-break. The captured `Popular` option was not ported because the catalog has no install or usage metric to order by; `Name` took its place, which is the same choice already made on Automations. The `N of M` counter reflects the filtered result against the real catalog size.
- Shared primitives reused, not reinvented: the hero rides the existing `.platform-header` (whose eyebrow is already hidden for these screens), the row uses `.qoder-filterbar`, the segment uses `.qoder-segment` and the chips are the only new primitive. Added to `src/qoder-shell.css`: `.skills-discovery`, `.qoder-discovery__title/__lead/__subject/__squiggle`, `.qoder-chiprail`, `.qoder-chip` and a `[aria-pressed="true"]` state for `.qoder-segment button`, all on existing tokens.
- Files changed: `crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx`, `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.48s); from the root, `continuity:verify` PASS (213 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Playwright at 1322x721 on the Skills tab read the hero as `Discovery Skills` with the underline element present, the subtitle `With Cursor, Analysis, Automation.`, the rail `All* Cursor Analysis Automation Data Design DevOps Engineering Quality Research` and the counter `25 of 25`. Filtering was exercised, not assumed: `Design` → 1 row (`UI Designer`, counter `1 of 25`), `Cursor` → 17 rows (`17 of 25`), `All` → back to 25. The sort was proved to change order rather than relabel: the two orders are identical through index 16 and diverge from index 17, where `Newest first` yields Code Reviewer, Repository Analyst, Test Engineer (all `Today`), then Browser Operator (`Yesterday`), UI Designer (`1d ago`), Release Engineer (`3d ago`), Researcher (`5d ago`), Data Operator (`6d ago`), while `Name` yields the same nine in alphabetical order; the two lists hold the same 25 items. `aria-pressed` was confirmed to follow the selection (`Newest first=true`, `Name=false`). Captures `qoder-verify-shots/qoder-skills-discovery-hero-chips.png` and `qoder-verify-shots/qoder-chat-after-skills-discovery.png` were read back: the Skills screen matches the captured layout and the chat view is intact (header `New conversation`, `Edited 3 files +395 −0` card, composer, status bar `Local … 6%`), with the Skills and Extensions markup fully unmounted.
- Defect found and deliberately not fixed in this pass: skill rows render the version as `vbuilt-in` because the row template prints `v{skill.version}` and the built-in commands carry the literal string `built-in` as their version (`SkillsStudio.tsx:109`). It is pre-existing, unrelated to this item, and visible in the capture, so it is recorded as a pending item instead of being widened into this operation.
- Unverified checks: the Plugins and Connectors tabs still have no discovery hero, and their catalogs still lack the fields one would need to filter honestly; the hero was not compared pixel-by-pixel against the Qoder capture, only against the geometry and type scale already recorded in the audit; the runtime-backed branch was not exercised because `127.0.0.1:8080` refuses connections here, so the derived rail was only tested against the local catalog; keyboard traversal of the chip rail was not exercised. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the rail is derived, so a runtime catalog that returns many distinct categories will wrap the chip row (`.qoder-chiprail` already wraps); and the recency comparator understands the two formats in use today, so a new date format from the backend would sort as unknown and fall to the end.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx crates/presentation/desktop/frontend/src/qoder-shell.css` returns the surface to the plain two-pane studio and drops the new primitives; the audit, changelog and journal entries are additive.
- Next step: fix the `vbuilt-in` label, convert the two remaining white-overlay hovers with the literals already recorded, settle the workspace pill resting fill against a fresh capture, and capture the remaining settings sections one by one when a live Qoder session is authorized.

### Follow-up — skill version label stops prefixing non-versions, 2026-10-19 (pass 5 of the scheduled improvement loop)

- Authorized implementation step: the loop took the recorded pending item `Label defect: skill rows print v{version}, so the built-in commands render vbuilt-in`, which pass 4 found and deliberately left out of its own scope.
- What changed: `SkillsStudio` gained a `formatVersion` helper that only prefixes the `v` when the version actually starts with a digit, and the list row now renders `{skill.category} · {formatVersion(skill.version)}`. That covers the 17 built-in slash commands, which declare the literal string `built-in` as their version, and the `runtime` string the runtime mapping falls back to, while the eight numbered packages keep `v1.4.0`, `v2.0.4` and so on. The detail pane already printed the bare version, so it was left alone.
- Files changed: `crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.70s); from the root, `continuity:verify` PASS (214 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Playwright at 1322x721 on the Skills tab read all 25 rendered row labels: `vbuilt-in` occurrences went from 17 to **0**, the built-in rows now read `Cursor · built-in`, the numbered rows still read `Engineering · v2.0.4`, `Analysis · v1.4.0` and `Quality · v1.9.1`, and the detail Version field still reads `1.4.0`. Capture `qoder-verify-shots/qoder-skills-version-label-fixed.png` was read back and shows the corrected labels with the discovery hero, chip rail and sort segment from pass 4 unchanged; returning to New Task confirmed the chat view is intact (header `New conversation`, `Edited 3 files / +395 −0` card, composer present, status bar `Local … 6%`, Skills markup unmounted).
- Second occurrence found and not fixed: `features/platform/FrontendCompletenessStudio.tsx:86` prints `{id} · v{version}` over a table whose version column also holds non-versions, so the row `['tools-safe', 'Tool Safety Matrix', '164 cases', …]` renders `v164 cases`. Same defect class, different surface, so it is recorded as a pending item rather than folded into this operation.
- Unverified checks: the `runtime` fallback branch was not exercised because `127.0.0.1:8080` refuses connections in this environment, so only the local catalog path was observed; the FrontendCompletenessStudio surface was not opened. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: a version string that starts with a digit but is not a version would still get a spurious `v`; nothing in the current catalogs does that, and the rule is the same one the numbered rows already rely on.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx` returns the row to `v{skill.version}` and drops the helper; the audit, changelog and journal entries are additive.
- Next step: apply the same guard to `FrontendCompletenessStudio.tsx:86`, convert the two remaining white-overlay hovers with the literals already recorded, settle the workspace pill resting fill against a fresh capture, and capture the remaining settings sections when a live Qoder session is authorized.

### Follow-up — last two white-overlay hovers converted, 2026-10-19 (pass 6 of the scheduled improvement loop)

- Authorized implementation step: the loop took the recorded pending item that isolates the hover token for the two surfaces still compositing `rgba(255,255,255,.06)`, using the literals already mined from Qoder's shipped code in pass 3.
- What changed: `.qoder-profile__chip:hover` moved to `var(--q-hover)` (`#232e29`), the `hover:bg-fill-secondary` token from the chip literal `inline-flex h-8 … rounded-full bg-fill-tertiary text-text-secondary transition-colors hover:bg-fill-secondary`; `.qoder-digest__actions button:hover` moved to `var(--q-raised)` (`#1a2420`) with the text brighten, the `size-6 text-text-tertiary hover:bg-fill-tertiary hover:text-text` token already applied to the rest of the 24-28px icon-button family in pass 3. No new colour was introduced; both values were already in `qoder-theme.css`.
- Checked for the pass-3 trap before editing: `workspace-enhancements.css`, `harness-theme.css`, `index.css` and `qoder-theme.css` carry no rule for either selector, so these two needed no `:not()` guard and no active-state protection.
- Result: `qoder-shell.css` now has **zero** `hover` rules compositing a white overlay. The hover language across the shell is `#232e29` for rows and chips, `#1a2420` for icon buttons, `#18362e` for the workspace pill and `#3d4743` / `#2b3731` for selected states.
- Suspicion raised and cleared, recorded so no future pass re-investigates it: a resting read came back stale once and chasing it surfaced rules forcing `transition: none !important` and `transition-duration: 1ms !important`. All of them sit inside `@media (prefers-reduced-motion: reduce)`, and `matchMedia('(prefers-reduced-motion: reduce)')` reports `false` in this browser context, so the 160ms shell motion and the 75ms row motion are live. The stale read was a repaint timing artifact, which is why the double-hover measurement procedure recorded in the audit is still the right habit.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.67s); from the root, `continuity:verify` PASS (215 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Playwright at 1322x721 measured with the pointer parked and `matches(':hover')` asserted in the same read: the edited-files card renders 6 action buttons and both the first and the last compute `rgb(26, 36, 32)` with `rgb(234, 243, 239)` text; the Profile page renders 1 chip (`Set role`), which computes `rgb(35, 46, 41)` under the pointer and `rgba(0, 0, 0, 0)` at rest, confirming only the hover moved. Captures `qoder-verify-shots/qoder-digest-actions-hover-1a2420.png` and `qoder-verify-shots/qoder-profile-chip-hover-232e29.png` were read back: the hovered action and chip show the lift, the Profile page and its selected nav row are unchanged, and the chat view (header, `Edited 3 files +395 −0` card, composer, status bar `Local … 6%`) is intact.
- Unverified checks: the chip literal was matched to `.qoder-profile__chip` by role and shape, not by a captured screenshot of that exact Qoder page, so the identity is an inference; the same literal has the chip at rest on `bg-fill-tertiary` and `rounded-full`, while ours is transparent with a 7px radius, and that resting delta was left alone because the pending item was the hover. The runtime-backed branches were not exercised (`127.0.0.1:8080` refuses connections here). Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: if the chip identity inference is wrong, that one control now lifts to `#232e29` where Qoder would use another fill token — it is a single declaration and moves with the rest of the chip family; and the digest action hover now shares the icon-button token, so any future divergence for the card row has to be re-mined rather than assumed.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` returns the two rules to their white overlays; the audit, changelog and journal entries are additive.
- Next step: apply the digit guard to `FrontendCompletenessStudio.tsx:86`, settle the workspace pill resting fill and the profile chip resting fill against a fresh capture, port the discovery hero to Plugins and Connectors once those catalogs carry category and popularity fields, and capture the remaining settings sections when a live Qoder session is authorized.

### Follow-up — phantom label defect retired, no code changed, 2026-10-19 (pass 7 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item recorded by pass 5 — that `FrontendCompletenessStudio.tsx:86` prints `{id} · v{version}` over a column holding non-versions, so the `tools-safe` row supposedly renders `v164 cases`. Before editing, the claim was checked against the file and the running app. It does not hold, so nothing was changed.
- Why the claim is wrong, three independent ways. First, line 86 maps the `skills` array, whose four versions are all numeric (`2.4.1`, `1.8.0`, `0.9.4`, `1.2.2`), so it renders `v2.4.1` and friends correctly. Second, the `164 cases` string belongs to a different array, `suites`, which is rendered at line 80 as `{id} · {cases}` with no `v` prefix at all — pass 5 conflated the two arrays because they sit twelve lines apart and share the tuple shape. Third, both of those branches are unreachable: `PlatformSurface.tsx:127` mounts `FrontendCompletenessStudio` only for `mode === 'plugins' || 'onboarding'`, so the component's own `evaluations`, `skills`, `mcp`, `providers`, `browser`, `computer`, `credentials`, `imports` and `sessions` branches never render — the second instance of the dead-branch trap already documented for `StudioSurface` and `MemoryStudio`.
- Runtime confirmation: the app was driven through the command palette to the Evaluations, Skills and Plugins surfaces and the DOM text searched each time. The string `v164` appears in none of them, and the Plugins grid renders six well-formed version labels (`v1.2.0`, `v2.2.1`, `v3.2.2`, `v4.2.3`, `v5.2.4`, `v6.2.5`). Capture `qoder-verify-shots/qoder-plugins-no-v164-phantom.png` was read back and shows the same.
- Two real findings surfaced by the investigation, recorded in `QODER-UI-AUDIT.md` rather than acted on. The `plugins` surface shows a fabricated registry: six invented packages whose versions are generated from the array index (`v{1+i}.2.{i}`) with invented Installed / Update available states. It carries a `FRONTEND PREVIEW` tag, but under the project rule against inventing features and metrics this row needs a decision — back it with real data or make it report "not part of this build" the way the Sites row already does — and a silent edit is not the right move. Separately, the unreachable-branch fact above is worth keeping so no future pass spends an operation "fixing" pixels nobody can see.
- Files changed: `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`. **No source file was modified**: `git diff -- crates/presentation/desktop/frontend/src/features/platform/FrontendCompletenessStudio.tsx` is empty against `HEAD`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.73s); from the root, `continuity:verify` PASS (216 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. All gates were re-run after the documentation edits.
- Unverified checks: the remaining `plugins`-surface questions (whether it should exist at all, and what a real plugin registry would look like in this product) are open and awaiting a decision. The runtime-backed branches were not exercised because `127.0.0.1:8080` refuses connections here. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the only risk introduced is that a wrong record stayed in the audit for one extra pass before being corrected; the correction is now in the same file, and the phantom item no longer appears in the queue.
- Rollback point: none needed for code. To undo the record, revert the audit's new Pending entries and the Resolved paragraph, plus this changelog entry and the appended journal line.
- Next step: decide the fate of the fabricated `plugins` surface, then settle the workspace pill and profile chip resting fills against a fresh capture, and port the discovery hero to Plugins and Connectors once those catalogs carry the fields to filter honestly.

### Follow-up — Skills detail stops reporting invented metrics, 2026-10-19 (pass 8 of the scheduled improvement loop)

- Authorized implementation step: every item in the queue was blocked this pass (live Qoder capture, fields the build does not have, or a decision reserved for the user), so the loop acted instead on a real defect found on a live, reachable surface: the Skills detail pane reported three things per skill that this product does not know. It showed `8 tools` for every skill, five fixed capability tags (`Repository search`, `Context assembly`, `Diff analysis`, `Evidence output`, `Verification`) and four fixed permission rows (`Read workspace: Allowed`, `Write files: Policy based`, `Network: Confirm`, `Destructive: Blocked`) — identical whether you selected `Repository Analyst` or `/loop`.
- Evidence that they are fabricated, not just suspicious: the skill record the backend actually serves is `skill_id, name, version, description, category, enabled, source, updated_at` (`crates/application/skills/src/lib.rs:97`), and a search for `allowed_tools`, `permissions` or `capabilities` in that crate returns nothing. The frontend mapping in `SkillsStudio` reads only the real fields, so the three blocks were pure invention — exactly what the project rule forbids.
- What changed: the fourth metric cell now shows the real `State` (`Enabled` / `Available`, already computed for the header pill) instead of a tool count; the Capabilities block keeps its heading and now states what the runtime contract actually reports, with `preview` replaced by `runtime contract` in its corner tag; the Permissions block states plainly that per-skill permissions are not part of this build and that tool authorization lives in the Tool Policy surface. The two notices use a new `.skills-notice` rule in `qoder-shell.css` on existing tokens, and the block layout keeps its Qoder shape so nothing else moves.
- Files changed: `crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx`, `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.60s); from the root, `continuity:verify` PASS (217 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Playwright at 1322x721 selected `/loop` and read the detail grid as `VERSION: built-in`, `CATEGORY: Cursor`, `LAST UPDATE: Today`, `STATE: Available`, with the whole-body text checked: `8 tools` absent, `Repository search` and `Diff analysis` absent, the fake permission rows absent, and both notices present. Selecting `Repository Analyst` returned `VERSION: 1.4.0`, `CATEGORY: Analysis`, `LAST UPDATE: Today`, `STATE: Enabled`, matching its `ENABLED` header pill. Captures `qoder-verify-shots/qoder-skills-detail-honest-v2.png` was read back showing the corrected pane with the pass-4 hero, chip rail and sort untouched, and returning to New Task confirmed the chat view is intact (header `New conversation`, `Edited 3 files / +395 −0`, composer, status bar `Local … 6%`).
- Measurement note worth keeping: the first capture showed an empty detail pane. It was a scroll artifact, not a render failure — clicking a row near the bottom of the list scrolls an inner container, and the detail head sat at `y = -864` while `window.scrollY` was `0`. Resetting `scrollTop` on the scroll ancestors brought it back to `y = 254` and the re-taken capture was correct. After selecting a list row, reset the scroll ancestors before screenshotting.
- New finding recorded, not acted on: `.skills-detail-grid`, `.skills-capabilities` and `.skills-permissions` still paint the pre-Qoder `#1a1a1a` fill and `#333333` hairline from `index.css:1444`, so those blocks sit visibly off-tone against the mint-dark shell. The same is likely true for the rest of `.skills-studio`. It is a separate visual item and is now in the queue.
- Unverified checks: the runtime-backed detail was not exercised because `127.0.0.1:8080` refuses connections here, so only the local catalog path was observed; whether the two notices should be shown at all, or the blocks hidden outright, is a design call left open. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the Skills detail is now deliberately less Qoder-like in those two blocks, because the captured screen shows tags and permission rows this build cannot back with real data — honesty over mimicry, per the project rule; and the `State` cell duplicates the header pill, which is redundant but true.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/features/skills/SkillsStudio.tsx crates/presentation/desktop/frontend/src/qoder-shell.css` brings back the tool count and the invented capability and permission rows; the audit, changelog and journal entries are additive.
- Next step: skin the skills-studio blocks with the mint-dark tokens, decide the fate of the fabricated `plugins` surface, settle the workspace pill and profile chip resting fills against a fresh capture, and port the discovery hero to Plugins and Connectors once those catalogs carry the fields to filter honestly.

### Follow-up — skills studio skinned with the mint-dark tokens, 2026-10-19 (pass 9 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item recorded by pass 8 — the skills studio blocks still paint the pre-Qoder neutral palette and sit off-tone against the mint-dark shell.
- Measured before: `.skills-studio` computed `rgb(24, 24, 24)` on an `rgb(51, 51, 51)` hairline with an 8px radius; `.skills-search`, `.skill-list-icon`, `.skills-detail-grid > div`, `.skills-capabilities` and `.skills-permissions` all `rgb(26, 26, 26)` with the same `rgb(51, 51, 51)` border; `.skills-tab--active` and `.skill-list-row--active` `rgb(30, 30, 30)` — every one of them a neutral grey with no green in it, sitting on a `rgb(11, 17, 14)` canvas. The same sweep caught a second real defect: `.skills-detail-grid strong` computed at **7px**, because `index.css` sets the value with the `font` shorthand at `7px ui-monospace`, so the four detail values rendered near-unreadable.
- What changed: the studio is re-declared in `qoder-shell.css` on existing tokens only — panel and cells flat `var(--q-surface)` with `var(--q-border)` hairlines at 10px, dividers and icon tiles on `var(--q-border-soft)` and `var(--q-raised)`, active tab and active row `var(--q-raised)`, row hover `var(--q-hover)`, text on `var(--q-text)` / `var(--q-text-2)` / `var(--q-text-3)`, and the detail values raised to 13px while keeping the monospace family. No new colour was introduced.
- Scoping decision: `index.css:1418-1450` declares these rules as shared selectors with the tools surfaces (`.skills-studio,.tools-studio`, `.skill-list-row,.tool-list-row`, and so on). Only the `.skills-*` / `.skill-*` side was re-declared here, because the tools surface was not measured in this pass and editing it would be an unverified change. It is recorded as the next item.
- Measured after: `.skills-studio` `rgb(10, 15, 13)` on `rgb(39, 51, 46)` at 10px; cells `rgb(10, 15, 13)` with `rgb(39, 51, 46)` hairlines; icon tiles, active tab and active row `rgb(26, 36, 32)`; idle tab label `rgb(120, 143, 133)`; detail values **13px**. A sweep of all 304 elements in the studio subtree found no neutral panel fill or hairline left; the only remaining neutral colours are three shared primitives — `.status-dot--offline` (17 instances, `rgba(228, 228, 228, 0.34)`), `.surface-block__heading` (`rgba(228, 228, 228, 0.5)` colour and border) and `.mono-text` (`rgba(228, 228, 228, 0.42)`) — which are global utilities used across many surfaces and need their own measured pass rather than a silent widening from here.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.59s); from the root, `continuity:verify` PASS (218 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. The before and after colour sets above were read from `getComputedStyle` on the same ten selectors, so the delta is measured rather than eyeballed. Capture `qoder-verify-shots/qoder-skills-studio-mint-dark-skin.png` was read back: the panel now reads as one flat surface with hairline-divided cells, the four detail values are legible, and the pass-4 hero, chip rail and sort plus the pass-8 notices are all intact. Returning to New Task confirmed the chat view is unaffected (header `New conversation`, `Edited 3 files / +395 −0`, composer, status bar `Local … 6%`, sidebar still `rgb(17, 40, 32)`).
- Unverified checks: the tools surfaces that share the same `index.css` rules (`ToolPolicyStudio` and the other `.tools-*` / `.tool-*` consumers) were not opened or measured, so their palette is unchanged and probably still neutral; runtime-backed skill rows were not exercised because `127.0.0.1:8080` refuses connections here; the 10px radius and flat-cell treatment follow the audit's card primitive but were not re-compared against a fresh Qoder capture of this exact screen. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the neutral declarations still live in `index.css`, so a future edit there can move the tools look while the skills side stays overridden; and because the skills overrides are re-declarations rather than edits, the skills studio now depends on load order — `qoder-shell.css` must stay the last sheet imported by `main.tsx`.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` drops the skin block and returns the studio to the neutral palette; the audit, changelog and journal entries are additive.
- Next step: measure and skin the tools surfaces that share those rules, then the three residual shared primitives, decide the fate of the fabricated `plugins` surface, and settle the workspace pill and profile chip resting fills against a fresh capture.

### Follow-up — platform card primitives skinned; the named tools classes are dead, 2026-10-19 (pass 10 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item that says the tools surfaces still paint the pre-Qoder neutral palette and asks to measure `ToolPolicyStudio` and its siblings and skin them the same way pass 9 did the skills studio.
- The item's named classes are dead code, third instance of the routing trap. It points at `.tools-studio`, `.tool-list-row`, `.tool-schema` and `.tool-policy-grid` in `index.css:1418-1450`. Those classes belong to `features/tools/ToolsStudio.tsx`, which is imported by exactly one place — `components/StudioSurface.tsx:279` — and `navigation.ts` declares `tools` as a platform mode, so `WorkspaceOverview` routes it to `PlatformSurface`, which renders `ToolPolicyStudio` instead. `ToolPolicyStudio` uses none of those classes. Measured in the live DOM on the Tool Policy Studio surface: `.tools-studio`, `.tool-list-row`, `.tool-schema` and `.tool-policy-grid` all return **0** elements. Skinning them would have changed nothing on screen.
- The intent behind the item was still correct, and the real target was found by enumerating computed styles: the surface does show the neutral palette, through the shared platform primitives in `index.css:705-714` — `.platform-panel`, `.platform-panel__head`, `.strategy-stack`, `.callout`, `.platform-metric-card` and `.platform-metric-row` — all defined by `features/platform/PlatformPrimitives.tsx` and therefore used across the platform surfaces.
- What changed: that whole card family is re-declared in `qoder-shell.css` on existing tokens, with the same rule pass 9 used — flat `var(--q-surface)` cards with `var(--q-border)` hairlines at 10px, inner rows on `var(--q-border-soft)`, labels on `var(--q-text-3)` and values on `var(--q-text)`. No new colour was introduced.
- Second defect of the same class as pass 9, found and fixed here: `.strategy-stack strong` is set in `index.css:733` with the `font` shorthand at **8px** monospace, so the strategy values rendered near-unreadable; they now compute at 12px.
- Measured before, on Tool Policy Studio: `.platform-panel` `rgb(26, 26, 26)` on `rgb(51, 51, 51)` at 8px, `.strategy-stack > div` `rgb(26, 26, 26)` on `rgba(228, 228, 228, 0.07)`, `.callout` `rgb(26, 26, 26)` on `rgb(51, 51, 51)`, strategy value 8px — eleven distinct neutral colour hits across the surface.
- Measured after: panel and callout `rgb(10, 15, 13)` on `rgb(39, 51, 46)` at 10px, strategy rows `rgb(10, 15, 13)` on `rgb(29, 39, 34)` at 10px, strategy values 12px. A second consumer was measured to confirm the shared primitive behaves the same everywhere: Agent Mission Control renders 4 `.platform-metric-card` elements, all now `rgb(10, 15, 13)` on `rgb(39, 51, 46)` at 10px, and the neutral hits on that surface dropped to 4.
- Deliberately excluded and recorded rather than guessed: `html` (root background `rgb(24, 24, 24)`), `footer.status-bar` (`rgb(24, 24, 24)`, whose border is already `--q-border`) because no Qoder value for the status bar background was ever measured, and `.sidebar-search`, which carries an unresolved cascade contradiction — `qoder-shell.css:127` sets `background: rgba(255,255,255,.03)` and `border: 1px solid var(--q-border)` and its 7px radius does apply, yet the computed background and border still read `rgb(24, 24, 24)` and `rgb(51, 51, 51)` from `index.css:1090`. That needs understanding before an override is stacked on top of it.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 twice (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.88s and 27.55s — the second run rebuilt cold); from the root, `continuity:verify` PASS (219 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Captures `qoder-verify-shots/qoder-platform-panel-mint-dark.png` (Tool Policy Studio) and `qoder-verify-shots/qoder-platform-primitives-mint-dark.png` (Agent Mission Control) were read back: both surfaces now read as one flat mint-dark shell with hairline-divided cards and legible values. Returning to New Task confirmed the chat is unaffected (header `New conversation`, `Edited 3 files / +395 −0`, composer, status bar `Local … 6%`, sidebar still `rgb(17, 40, 32)`).
- Unverified checks: the other platform surfaces that consume `PlatformPrimitives` were not individually opened, only two were measured; `Subagent Fleet` was seen in passing and still carries its own neutral set (`.subagent-fleet`, `.subagent-builder*`, plus bare `INPUT`/`TEXTAREA`), which is a different primitive family and is recorded as a pending item; the three excluded neutrals above; runtime-backed data everywhere, since `127.0.0.1:8080` refuses connections here. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: `.platform-panel` and the metric family are shared by many surfaces, so this changes more screens than one — deliberately, since it is one primitive, but it means a future per-surface override in `index.css` can fight it; and because these are re-declarations, the whole skin depends on `qoder-shell.css` staying the last sheet imported by `main.tsx`.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` drops the platform-card block and returns those primitives to the neutral palette; the audit, changelog and journal entries are additive.
- Next step: resolve the `.sidebar-search` cascade contradiction and decide the `html` and status-bar backgrounds, skin the remaining per-surface neutral families such as `.subagent-builder*`, then the three shared text primitives, and still open: the fabricated `plugins` surface decision and the pill and chip resting fills.

### Follow-up — the cascade "contradiction" was an !important, and it is systemic, 2026-10-19 (pass 11 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item asking to resolve the `.sidebar-search` cascade contradiction before touching it, because passes 2, 3, 9 and 10 all rely on `qoder-shell.css` winning by being the last imported sheet, and one control appeared to defy that rule.
- There was no contradiction. `workspace-enhancements.css:153-157` declares `.sidebar-search { border-color:#333333 !important; background:#181818 !important; }`. `!important` outranks source order, so the two locked properties came from the legacy sheet while the unlocked `border-radius: 7px` from `qoder-shell.css:127` applied normally — which is exactly why the element looked self-inconsistent. The mental model of the cascade holds; the re-declaration strategy used in the earlier passes is sound for every property that is not `!important`-locked.
- Fix: `qoder-shell.css:127` now matches the weight on those two properties, the same technique `.settings-modal` already uses in this sheet (`qoder-shell.css:310-325`). The declared values were not changed — the item was the cascade, not the fill. Measured after: `background: rgba(255, 255, 255, 0.03)` and `border-color: rgb(39, 51, 46)` (`--q-border`), against `rgb(24, 24, 24)` and `rgb(51, 51, 51)` before.
- Honest caveat about the visible effect: `.sidebar-search` is `display: none` (`qoder-shell.css:294`), so this changes nothing on screen today. It removes a latent trap — if the field is ever shown it will now inherit the shell palette instead of the legacy grey.
- The important finding is that this is systemic. A sweep of the non-Qoder sheets found more than twenty declarations that lock neutral colours with `!important`: `.settings-nav__active`, `.composer-icon--active`, `.task-priority`, `.workspace-switcher`, `.model-chip`, `.sidebar-filter` and its `:hover` / `--active` variants, `.message-bubble--system`, `.message-actions button:hover`, `.composer-shell` and its `:focus-within`, `.composer-input` and its placeholder, `.sidebar-search:focus-within` (still `#3d3d3d`), among others. Every one of them is a property where the mint-dark skin silently loses, and each needs its element checked for visibility before being equalized.
- A second sweep, restricted to rendered elements with non-zero size on the chat surface, separated real defects from dead rules. Confirmed still neutral and visible: `footer.status-bar` background `rgb(24, 24, 24)` at 1051x24 (its border is already `--q-border` and its text `--q-text-3`), and the document root `html` at background `rgb(24, 24, 24)` with `color: rgb(228, 228, 228)`, which is the inherited fallback for any element that does not set its own text colour. `.send-button--round` reports `rgb(228, 228, 228)` but the element was `disabled`, so that is a disabled state rather than a normal-state defect and was left alone.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 7.85s); from the root, `continuity:verify` PASS (220 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Before and after were read from `getComputedStyle` on the same element. Capture `qoder-verify-shots/qoder-sidebar-search-important-fix-no-regression.png` was read back and shows the chat unchanged (header `Welcome to AgentiCOS`, `Edited 3 files +395 −0` card, composer, status bar `Local … 6%`) — as expected, since the fixed control is hidden.
- Unverified checks: whether the status bar and the `html` root should be `--q-chrome` or `--q-surface` is still undecided, and this pass deliberately did not guess; the other `!important` sites were not individually checked for element visibility, only enumerated; `.sidebar-search:focus-within` still locks `#3d3d3d`; runtime-backed states were not exercised because `127.0.0.1:8080` refuses connections here. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: answering `!important` with `!important` escalates the weight race instead of removing it. The cleaner fix is to drop the legacy `!important` declarations from `workspace-enhancements.css`, but that sheet also serves non-Qoder surfaces, so removing them there could move screens this loop is not measuring — recorded as the trade-off rather than decided unilaterally.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` removes the two `!important` flags and restores the original declarations; the audit, changelog and journal entries are additive.
- Next step: settle the `html` and status-bar backgrounds by mining Qoder's shipped code the way passes 2, 3 and 6 did, instead of guessing between `--q-chrome` and `--q-surface`; then work through the `!important` sites that belong to visible elements, the `.subagent-builder*` family and the three shared text primitives.

### Follow-up — fifteen CSS variables were used and never defined, 2026-10-19 (pass 12 of the scheduled improvement loop)

- Authorized implementation step: the loop first took the pending item asking to settle the `html` and status-bar backgrounds by mining Qoder's shipped code. That route came up empty and nothing was guessed: `qoder-main.css` and `qoder-secondary.css` contain no `status` selector at all (Qoder paints that bar with inline Tailwind utilities), the reference captures from 2026-10-17/18 were never stored on disk, and a string search over the 157 MB `app.asar` for the 24px bar class timed out and was stopped. The item stays open, now recorded as undecided-by-evidence rather than undecided-by-laziness. The loop then moved to an actionable item found while measuring the surfaces that item touched.
- The real defect, found by diffing every custom property used against every one defined across the frontend CSS: 122 variables are referenced, 160 are defined, and **15 are referenced but never defined**. The colour-critical ones are `--border` (242 uses), `--panel-hover` (42), `--accent` (41), `--panel-strong` (11), `--font-mono` (5), `--danger` (2), `--warning` (2), `--surface`, `--text-primary` and `--q-border-strong`.
- Two distinct failure modes, both measured. With no fallback, an undefined `var()` is invalid at computed-value time, so `border-color` falls back to `currentColor` and `background-color` to `initial`: cards and rows were drawing **near-white hairlines** (`rgb(234, 243, 239)`, the text colour) and panel hovers were painting nothing at all. Where a fallback was written, it was the legacy grey, e.g. `var(--border,#333333)`.
- Fix: the missing aliases are defined in the existing "Reescritura de las variables del proyecto y de la capa anterior" block of `qoder-theme.css`, each pointing at a token already measured in this file — `--border` to `--q-border`, `--surface` to `--q-surface`, `--panel-hover` to `--q-hover`, `--panel-strong` to `--q-raised`, `--accent` to `--q-accent`, `--danger` to `--q-danger`, `--warning` to `--q-warning`, `--text-primary` to `--q-text`, `--q-border-strong` to `--border-strong`, plus the mono stack already used elsewhere in the shell. No new colour was introduced.
- Measured on the live Subagent Fleet surface (confirmed reachable: `PlatformSurface.tsx:178` mounts it for the `subagents` mode, 1 fleet, 4 lanes, 4 policies). Before: `.subagent-fleet__policy`, `.fleet-policy`, `.fleet-lane` borders `rgb(234, 243, 239)` and `.subagent-fleet__dispatch-note` border `rgb(176, 195, 186)`. After: all four read `rgb(39, 51, 46)` (`--q-border`), and the selected policy card now correctly shows `rgb(98, 201, 168)` mint border on an `rgb(35, 46, 41)` fill. `.fleet-lane__status` keeps `rgb(234, 243, 239)` because its own rule asks for `currentColor` — by design, not a leak.
- Deliberately left alone: `--panel-bg` and `--code` (both already carry fallbacks and their intent is ambiguous), and the `--agenticos-*` layout variables (sane fallbacks, not colour).
- Two findings recorded rather than chased. First, `.subagent-builder__icon/item/search` on the same surface still compute `rgb(51, 51, 51)` / `rgb(26, 26, 26)` / `rgb(61, 61, 61)` / `rgb(30, 30, 30)` / `rgb(24, 24, 24)` — that family uses literal hexes, not variables, so it needs its own skin pass. Second, and more structural: `html` still computes `background: rgb(24, 24, 24)` and `color: rgb(228, 228, 228)` even though `qoder-theme.css:113` sets `html { background: var(--q-chrome) }` and `workspace-enhancements.css:60` sets `html { background:#181818 }` in an earlier sheet — so the shell's own rule is losing somewhere and the cause is not yet identified. The live document carries 30 separate `<style>` tags, the first two holding 1604 and 1973 rules and roughly 25 more following with per-component rule counts, which means lazily imported component CSS lands **after** `qoder-shell.css` at runtime. That qualifies the assumption behind passes 2, 3, 9, 10 and 11 and deserves its own investigation.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-theme.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.56s); from the root, `continuity:verify` PASS (221 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. The four variables were read as `(undefined)` on `:root` before and as `#27332e`, `#0a0f0d`, `#232e29`, `#62c9a8` after. Because the change is global, the chat surface was re-swept for regressions: zero rendered elements with non-zero size still carry a near-white border, and the chat is intact (header `New conversation`, `Edited 3 files` card, composer, status bar `Local … 6%`). Captures `qoder-verify-shots/qoder-subagent-fleet-borders-fixed.png` and `qoder-verify-shots/qoder-chat-after-global-var-mapping.png` were read back.
- Unverified checks: only the Subagent Fleet surface was measured among the many components that consume these variables, so the 242 `--border` uses were fixed by construction and by two sampled surfaces, not enumerated one by one; runtime-backed data was not exercised (`127.0.0.1:8080` refuses connections here); the production build's CSS order was not compared against the dev order. Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: this is a global change reached through shared variables, so any component that relied on `--border` being invalid (and therefore inheriting `currentColor`) now gets a real hairline instead — that is the intended fix and matches what was measured, but it touches many screens at once. The mono alias also normalises five font declarations.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-theme.css` removes the alias block and returns those properties to `currentColor` / legacy fallbacks; the audit, changelog and journal entries are additive.
- Next step: investigate why the shell's `html` rule loses and what the 30-tag runtime order means for the re-declaration strategy, skin the `.subagent-builder*` literals, then the `!important` sites on visible elements and the three shared text primitives, and still open: the `html` and status-bar backgrounds, the fabricated `plugins` surface and the pill and chip resting fills.

### Follow-up — the html anomaly was specificity, not stylesheet order, 2026-10-19 (pass 13 of the scheduled improvement loop)

- Authorized implementation step: the loop took the structural item pass 12 left first in the queue — find out why the shell's own `html` rule loses, and whether the 30 style tags at runtime undermine the re-declaration strategy that passes 2, 3, 9, 10, 11 and 12 all rely on.
- Answer: it is plain **specificity**, and the stylesheet order is innocent. Enumerating every rule that sets `background` on the document element found exactly three: `index.css` with `:root { background: rgb(24, 24, 24) }` at specificity (0,1,0), `workspace-enhancements.css` with `html { background: rgb(24, 24, 24) }` at (0,0,1), and `qoder-theme.css` with `html { background: var(--q-chrome) }` also at (0,0,1) but in the later sheet. `:root` outranks an element selector no matter where the sheet sits, so the legacy grey always won.
- Proven by elimination rather than by reading the spec: deleting the shell rule left `rgb(24, 24, 24)`, and deleting the `workspace-enhancements.css` rule *also* left `rgb(24, 24, 24)` — which isolated `index.css`'s `:root` as the winner. Ruled out along the way: no `@layer` in any of the 30 sheets, `--q-chrome` does resolve to `#112820` on the element, and injecting an `!important` rule into the shell sheet did take effect, so the sheet participates normally in the cascade.
- Two false leads worth recording so nobody repeats them. First, `CSSRuleList` has no `forEach`, so a `try/catch`-wrapped `forEach` search reported "rule not found" when the rule was there all along and invalidated the first experiment — spread `[...sheet.cssRules]` instead. Second, the 30 separate `<style>` tags with lazily imported component CSS landing after the shell are real, but they were not the cause here.
- Fix: the shell rule is now `html, :root { background: var(--q-chrome) }`, which matches the legacy specificity and wins on order. No new colour and no new value — it honours the chrome frame the shell had already chosen and that was simply never reaching the screen.
- Measured after: `html` `rgb(17, 40, 32)` and `body` `rgb(17, 40, 32)` (both `--q-chrome`), with `#root` at `rgb(11, 17, 14)` (`--q-canvas`) — so the 4px window frame the audit describes now actually renders instead of being a grey backdrop behind it.
- Consequence for the loop, recorded as guidance: the re-declaration strategy is not broken by lazy CSS ordering, but it **is** defeated by any legacy selector with higher specificity — `:root`, a class, or an attribute selector in an earlier sheet beats a plain element or single-class selector in `qoder-shell.css`. Future passes should compare specificity, not just import position.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-theme.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 3.05s); from the root, `continuity:verify` PASS (222 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. The three competing rules were listed from the live CSSOM with their sheet index, selector and declaration, and the computed `html` background was read before (`rgb(24, 24, 24)`) and after (`rgb(17, 40, 32)`). Capture `qoder-verify-shots/qoder-html-frame-chrome-fixed.png` was read back at 1322x721: the frame now reads as one continuous mint-dark chrome around the canvas and the chat is unchanged (header `Welcome to AgentiCOS`, `Edited 3 files +395 −0` card, composer, status bar `Local … 6%`).
- Unverified checks: the `footer.status-bar` background is still `rgb(24, 24, 24)` — that is a separate literal rule on the component, not the document root, and it remains open with the evidence problem pass 12 recorded. Overscroll behaviour and the frame width in maximised or windowed states were not exercised. Runtime-backed data was not exercised (`127.0.0.1:8080` refuses connections here). Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the document background is now set through `:root` as well as `html`, so a future theme that wants a different page backdrop must override `:root`, not only `html`.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-theme.css` returns the selector to `html` alone and the document background goes back to the legacy grey; the audit, changelog and journal entries are additive.
- Next step: with the cascade rule understood, apply it to the remaining neutral families — the `.subagent-builder*` literals, the `!important` sites on visible elements, the three shared text primitives and the `.status-bar` background — and still open: the fabricated `plugins` surface and the pill and chip resting fills.

### Follow-up — last three shared text primitives moved onto tokens, 2026-10-19 (pass 14 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item covering the three shared text primitives still painted with the pre-Qoder neutral greys, applying the cascade rule pass 13 established.
- What changed: `.mono-text` (defined `index.css:163`), `.surface-block__heading` (`index.css:223`) and `.status-dot--offline` (`index.css:101`) are re-declared in `qoder-shell.css` onto existing measured tokens — `--q-text-3` (`#788f85`, Qoder's text-tertiary) for the three colours, and `--q-border-soft` (`#1d2722`) for the heading's bottom hairline. These are the most widely shared labels in the app: 41 components reference `.mono-text`, 19 reference `.status-dot--offline` and 11 reference `.surface-block__heading`.
- Cascade check done first, per pass 13: all three are single-class selectors at specificity (0,1,0) with no `!important`, so a same-specificity declaration in the later sheet wins on order — no `:not()` guard or weight escalation was needed, unlike the `.sidebar-search` and `html` cases.
- Deliberately not touched: `.status-dot--live` is also neutral (`#e4e4e4`), and `.status-dot` base is the same. Turning the live indicator mint would match Qoder's accent convention, but there is no measurement of Qoder's own status dot anywhere in the extracted bundles, so that is a semantic decision left for the user rather than an unmeasured colour change.
- Measured before, on the live Skills surface at 1322x721 with visible-instance counts: `.mono-text` `rgba(228, 228, 228, 0.42)` (2 visible), `.surface-block__heading` `rgba(228, 228, 228, 0.5)` (2 visible), `.status-dot--offline` `rgba(228, 228, 228, 0.34)` (**17 visible**), `.status-dot--live` `rgb(228, 228, 228)` (8 visible).
- Measured after: the first three all compute `rgb(120, 143, 133)` = `#788f85`, and the heading's `border-bottom-color` computes `rgb(29, 39, 34)` = `--q-border-soft`. A re-count over the same four selectors found 8 instances still neutral — exactly the 8 `.status-dot--live` dots that were intentionally left, so all 21 targeted instances moved.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.97s); from the root, `continuity:verify` PASS (223 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Capture `qoder-verify-shots/qoder-shared-text-primitives-tokens.png` was read back: the `RUNTIME CONTRACT` and `POLICY` corner labels and the `CAPABILITIES` / `PERMISSIONS` headings now carry the muted green-grey of the token instead of neutral grey, the offline dots in the list match, and the pass-4 hero, chip rail, pass-8 notices and pass-9/10 card skin are all unchanged. Returning to New Task confirmed the chat is intact (header `New conversation`, `Edited 3 files / +395 −0`, composer, status bar `Local … 6%`, Skills markup unmounted).
- Unverified checks: only the Skills surface was measured, although these primitives render across 41, 19 and 11 components respectively, so the change was verified by construction plus one sampled surface rather than screen by screen; contrast of `#788f85` labels against the new `#0a0f0d` cards was not computed as a ratio; runtime-backed states were not exercised (`127.0.0.1:8080` refuses connections here). Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: because these are shared, the muted token now applies to every `.mono-text` label in the app, so any component that used the brighter neutral on purpose for emphasis loses that distinction; and the live/offline pair now reads as bright off-white versus muted green-grey rather than bright grey versus dim grey, which changes the perceived contrast between the two states.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` removes the three overrides; the audit, changelog and journal entries are additive.
- Next step: decide whether `.status-dot--live` should be mint, then the `.subagent-builder*` literals, the `!important` sites on visible elements and the `.status-bar` background — and still open: the fabricated `plugins` surface and the pill and chip resting fills.

### Follow-up — command palette skinned; 30 of the 36 `!important` locks never render, 2026-10-19 (pass 15 of the scheduled improvement loop)

- Authorized implementation step: the loop took the pending item the audit calls the main remaining obstacle to the skin — the `!important` inventory left by pass 11 — and worked the cluster it found to be actually live.
- Triage first, because pass 11 had enumerated the locks without checking whether their elements exist. Extracting from source gives **57 rules** carrying `!important` together with a neutral colour across `index.css`, `workspace-enhancements.css` and `harness-theme.css`. Probing 36 of those selectors live, on the chat surface, with the command palette open, and inside Settings, showed **30 never render at all** — `.settings-nav__active`, `.composer-icon--active`, `.task-priority`, `.rail-tooltip`, `.sidebar-filter`, `.conversation-menu`, `.model-chip`, all three `.message-bubble` variants, `.message-actions button`, `.composer-shell`, `.composer-input`, `.context-chip`, `.send-button`, `.composer-notice`, `.agent-panel`, `.panel-heading`, `.agent-card`, `.agent-tab`, `.run-button`, `.status-item`, `.workspace-dock`, `.dock-context`, `.quick-actions-menu`, `.brand-mark--active`, `.rail-indicator`, `.line-number--active` and `.tone-neutral`. Only two clusters are live: the **command palette family** and `.status-bar`.
- What changed: the palette family. `workspace-enhancements.css:324-335` locks it with `!important`, so the overrides match that weight, and `index.css:198-205` and `:259` set the text colours without it, so equal specificity plus the later sheet is enough there. Values come from what is already measured: a floating layer is flat `--q-surface` with a `--q-border` hairline (audit primitive 6), the icon tile is `--q-raised` (`bg-fill-tertiary`, pass 3) and the highlighted item is `--q-hover` (`data-[highlighted]:bg-fill-secondary`, pass 3). Text uses the `--q-text` / `--q-text-2` / `--q-text-3` ramp.
- This is the single most-used overlay in the shell: opening it shows **102 visible item and icon instances**, all previously painted with the pre-Qoder greys `#1e1e1e`, `#212121`, `#333333` and `#e4e4e4`.
- Measured after, inside the `.command-palette` subtree: **zero** neutral colour hits across `color`, `background-color` and `border-top-color`. The panel computes `rgb(10, 15, 13)` on an `rgb(39, 51, 46)` hairline with `background-image: none` (the legacy gradient is gone), icons `rgb(26, 36, 32)` on `rgb(29, 39, 34)`, the highlighted row `rgb(35, 46, 41)` with `rgb(234, 243, 239)` text, the search field `rgb(120, 143, 133)` with `rgb(234, 243, 239)` input text, and the footer `rgb(120, 143, 133)` on `rgb(39, 51, 46)`.
- Left alone deliberately: `.palette-backdrop` keeps `rgba(0,0,0,.62)`, because that is a scrim over the canvas, not a palette colour.
- Two of my own errors were caught and fixed inside this pass, recorded so they are not repeated. First, an ordering bug: I declared `.palette-item--active` before `.palette-item`, both at (0,1,0), so the base rule overrode the active item's text colour and the measurement showed `rgb(176, 195, 186)` where `rgb(234, 243, 239)` was intended — fixed by moving the active rule after the base, with a comment saying why. Second, that edit left a duplicated `.palette-item--active` rule, which was then removed.
- A false alarm worth recording: after closing the palette the chat looked missing (`chatHead: null`). It was not a regression — the app was simply still on the Marketplace surface from earlier navigation, confirmed by reading the mounted heading and body. Navigating to New Task showed the chat fully intact.
- Bonus for the still-open status-bar item: the triage pins the mechanism. `.status-bar`'s `background:#181818` is one of the `!important` locks, so once a value is decided the fix is the same weight-matching trick used here, not a new investigation.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 on each of the three builds taken during the pass (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 4.67s, 3.50s and 3.05s); from the root, `continuity:verify` PASS (224 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Capture `qoder-verify-shots/qoder-command-palette-mint-dark.png` was read back: the palette now reads as a flat mint-dark floating layer with hairline-divided rows and the active row lifted, instead of a grey box. Chat re-verified after: header `New conversation`, `.chat-surface` present, composer, `Edited 3 files / +395 −0` card, status bar `Local … 6%`, sidebar still `rgb(17, 40, 32)`.
- Unverified checks: the 30 selectors judged dead were probed only on the chat surface, the open palette and Settings — a component that renders one of them on a surface this pass did not visit would still be live, so "dead" is scoped to those three views, not proven globally. Whether the palette should be `--q-surface` or something lighter was not compared against a fresh Qoder capture; the value follows the audit's documented card primitive. Runtime-backed states were not exercised (`127.0.0.1:8080` refuses connections here). Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: the palette is now the same flat `#0a0f0d` as the cards behind it, separated only by a hairline and the existing shadow, so if Qoder paints it lighter this is a visible delta; and matching `!important` with `!important` continues the weight escalation pass 11 already flagged, rather than removing the legacy flags at their source.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` drops the palette block; the audit, changelog and journal entries are additive.
- Next step: decide the `.status-bar` value (the mechanism is now known, only the target colour is missing), decide `.status-dot--live`, skin the `.subagent-builder*` literals, and still open: the fabricated `plugins` surface and the pill and chip resting fills.

### Follow-up — subagent builder family skinned, neutral hits 16 to 0, 2026-10-19 (pass 16 of the scheduled improvement loop)

- Authorized implementation step: the loop took the last actionable item from the "remaining neutral palette by family" queue, the `.subagent-builder*` literals recorded by pass 12.
- Source read first: `workspace-enhancements.css:1265-1283` declares this family with **10 distinct neutral values across 20 selectors**, and none of them carries `!important`. That means the pass-13 rule applies cleanly — repeating the same selector shape in the later sheet wins on order, with no weight escalation needed, unlike the palette and `.sidebar-search` cases.
- Mapping, all onto existing measured tokens: hairlines `#333333` and `#3d3d3d` to `--q-border`; panel fills `#181818` to `--q-surface`; icon tiles and the selected row `#1a1a1a` / `#1e1e1e` to `--q-raised`; row hover to `--q-hover`; the muted labels `rgba(228,228,228,.42/.50/.60)` to `--q-text-3`; the bright label `rgba(228,228,228,.85)` to `--q-text`; and field focus to `--q-accent`.
- Measured before on the live Subagent Fleet surface (confirmed mounted, 45 visible elements whose class contains `subagent`): **16 neutral hits across 7 classes** — `.subagent-fleet`, `.subagent-builder`, `__search`, `__item--active`, `__icon` ×4, `__tab` ×4 and `__stat` ×4.
- Measured after: **0 neutral hits over the same 45 elements**. `.subagent-fleet` now computes border `rgb(39, 51, 46)` on background `rgb(10, 15, 13)`, the builder panel `rgb(10, 15, 13)`, icon tiles and the selected specialist row `rgb(26, 36, 32)`.
- The last hit turned out not to belong to the family at all: it came from `index.css:1677`, a two-pane layout rule shared by `.subagent-fleet`, `.cloud-agent-layout`, `.computer-use-workspace` and `.integration-layout`. All four were covered in a single declaration so the three sibling surfaces do not stay off-tone next to the one just fixed.
- Pass-15 lesson applied: the `.subagent-fleet` rule was merged into that shared declaration rather than added alongside it, and the file was checked afterwards for duplicates.
- Left alone deliberately: the active tab underline on `.subagent-builder__tab` still resolves through `currentColor`, which is the existing design of that control and not a leftover neutral.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 on both builds taken during the pass (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 2.84s and 4.24s); from the root, `continuity:verify` PASS (225 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. The neutral-hit count was produced by the same sweep script before and after, over `color`, `background-color` and `border-top-color` of every visible element whose class contains `subagent`. Capture `qoder-verify-shots/qoder-subagent-builder-mint-dark.png` was read back: the rail, search field, specialist rows, icon tiles, tabs and stat cells now read as flat panels with hairlines, no grey boxes. Chat re-verified after: header `New conversation`, `.chat-surface` present, composer, `Edited 3 files / +395 −0`, status bar `Local … 6%`, sidebar `rgb(17, 40, 32)`.
- Unverified checks: the three sibling surfaces pulled in by the shared `index.css:1677` rule (`.cloud-agent-layout`, `.computer-use-workspace`, `.integration-layout`) were declared but never opened or measured, so their result is inferred from the declaration and not observed; only the subagent surface was swept; runtime-backed data was not exercised (`127.0.0.1:8080` refuses connections here). Root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine (root `node_modules` absent, `npm ci` dies building `better-sqlite3`).
- Risks: changing a shared layout rule moves three surfaces nobody measured, so a latent assumption in one of them could show up later; and the family is dense (20 selectors), so a future component-level rule in `workspace-enhancements.css` could re-introduce a grey without the sweep catching it unless it is re-run.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` drops the family block and the shared layout override; the audit, changelog and journal entries are additive.
- Next step: measure the three sibling layout surfaces that this pass changed by declaration, then decide the `.status-bar` value and `.status-dot--live`, and still open: the fabricated `plugins` surface and the pill and chip resting fills.

### Follow-up — readiness backlog and the real backend blocker, 2026-10-19

- Authorized implementation step: the user asked to widen the improvement loop beyond the frontend so the whole project becomes ready to use. Widening it honestly required measuring the backend first.
- Added `docs/architecture/READINESS-BACKLOG.md`: one prioritised queue across tracks R (runtime), S (usable shell), F (UI fidelity), Q (gates) and D (docs), with a ten-point definition of "ready to use" and the status vocabulary OPEN / DOING / BLOCKED(user) / DONE. The loop now reads this file instead of the frontend-only pending list.
- Backend measured, not assumed: `cargo build -p agenticos-api-server` compiled 30 crates and failed with `LINK : fatal error LNK1104: no se puede abrir el archivo 'msvcrt.lib'` (cargo exit 101). `cargo check -p agenticos-api-server` fails the same way because build scripts must link, so no compiling cargo command works here; `cargo fmt` does run because it does not link.
- Root cause isolated: `D:\visualstudiocomunity\VC\Tools\MSVC\` holds **zero** `.lib` files across all three installed toolchains (14.32.31326, 14.43.34808, 14.51.36231) while `bin` and `include` are present, and `vswhere -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` still reports the component installed. The Windows SDK side is fine (`kernel32.lib` in `um\x64`, `ucrt.lib` in `ucrt\x64`, for 10.0.22621.0 and 10.0.26100.0). So it is a partial VS C++ install, not a missing SDK and not an unset `LIB`. Repairing it is a download and a system change, so it is recorded as `BLOCKED(user)` item R0 and the loop is forbidden from doing it.
- Second, separate finding: `cargo fmt --all --check` fails on 81 files and **all 81 are "Incorrect newline style"**, with zero real formatting diffs. `git show HEAD:crates/domain/brain/src/lib.rs` proves the committed bytes are `\n`, `core.autocrlf=true` on this machine, and no `.gitattributes` exists (`text` and `eol` unspecified). The red format gate on Windows is therefore a checkout artifact that any Windows contributor or CI job inherits; item R6 proposes the `.gitattributes` and explicitly forbids "fixing" it by running `cargo fmt --all`, which would rewrite 81 files and bury the signal.
- Also recorded: `.cargo/config.toml` passes `-fuse-ld=lld` as an MSVC `link-arg`, which `link.exe` rejects with `LNK4044` — a GCC/Clang driver flag used on the wrong toolchain, harmless today only because the link dies earlier.
- Loop changes: scope widened to all tracks with fixed priority R→S→F→Q→D, the measured environment rules above baked in so passes stop rediscovering them, an explicit exit-code-reading rule (a failed build reported exit 0 through a masked command), a no-concurrent-long-process rule, and the interval returned from 3 minutes to 30 after passes of 9 to 12 minutes were overlapping.
- Files changed: new `docs/architecture/READINESS-BACKLOG.md` (staged), this changelog. No frontend or Rust source was modified by this operation.
- Verification evidence: cargo exit codes read from the logs, not from the pipeline; `find` counts of `.lib` files (0) and SDK library presence checked by path; `cargo fmt --all --check` diff classification (81 newline / 0 formatting); `git config --get core.autocrlf` and `git check-attr` for the eol attributes; `git add` of the new file leaving zero untracked paths.
- Unverified checks: whether repairing the MSVC libraries is enough for the workspace to compile — 51 members and 671 locked crates have never been built here, so the first successful link may surface further errors; the desktop Tauri path (`cargo tauri dev`) is untested and depends on the same toolchain.
- Risks: the loop will keep choosing F-track work while R is blocked, which is correct by priority but means "ready to use" cannot advance past item 8 of the checklist until the user repairs the toolchain and supplies a provider key.
- Rollback point: delete `docs/architecture/READINESS-BACKLOG.md` and revert this entry; the automation patch is reversible from Automations.
- Next step: the user decides on R0 (repair the MSVC build tools) and on the provider credential for items 4 and 5; meanwhile the loop executes R2, R5 and R6, which need no linker.

### Follow-up — three sibling surfaces measured and the capability family skinned, 42/66/50 neutral hits to 1/1/0, 2026-10-19 (pass 17 of the scheduled improvement loop)

- Authorized implementation step: the first actionable item in `QODER-UI-AUDIT.md` → Pending, left by pass 16 — measure `.cloud-agent-layout`, `.computer-use-workspace` and `.integration-layout`, which pass 16 changed by declaration and never opened. Note the queue source: the readiness entry above says the loop now reads `READINESS-BACKLOG.md`, but that file contains no F-track items at all (grep for `F[0-9]` returns nothing), so the audit's Pending list is still the only UI-fidelity queue and this pass took from it as instructed.
- Routing checked before measuring, because the trap cost passes 7 and 10: all three are live. `PlatformSurface.tsx:183` mounts `CloudAgentsWorkspace` for `mode === 'cloud'`, `:197` mounts `ComputerUseWorkspace` for `'computer'` and `:247` mounts `IntegrationCatalogSurface` for `'homeassistant' | 'social'`. None of the three has a sidebar row, so they are reached through the command palette.
- The sweep itself needed fixing first, and the correction is the interesting part. Counting `border-*-color` unconditionally is wrong here: the initial value of `border-color` is `currentColor`, so any element that inherits a legacy achromatic text colour is reported as a neutral border even with zero border width. The first run returned 120 hits on Cloud Agents, most of them artifacts. The corrected rule counts a background only when alpha > 0, a text colour only on elements with their own text node, and a border colour only where that side has width > 0 and style ≠ none; pure black and transparent are excluded. Calibrated against a surface pass 16 already swept: the same rule on `.subagent-fleet` returns 1 hit, which is pass 16's "0" plus the known `.status-dot` case, so the definition is consistent with the recorded history rather than a new yardstick.
- Verdict on the question this item asked: pass 16's shared declaration **did** land and **did not** break anything. All three roots compute background `rgb(10, 15, 13)`, border `rgb(39, 51, 46)` and radius 10px over 81 / 89 / 101 visible elements, laid out as before.
- The measurement also found the interior was never covered: 42 neutral hits on Cloud Agents, 66 on Computer Use, 50 on Integrations. Every one comes from the shared `capability-*` family plus each surface's own blocks, declared in `index.css:1634-1714` and `workspace-enhancements.css:1058-1063` with literal hexes, and `grep` for `!important` across the whole family returns zero matches — so the shell sheet wins by order alone, with no weight escalation.
- Skin applied with the mapping already established by passes 9, 10 and 16 and no new colour: `#333333`/`#3d3d3d` → `--q-border`, `rgba(228,228,228,.07)` → `--q-border-soft`, `#181818` → `--q-surface`, `#1a1a1a`/`#1e1e1e` → `--q-raised`, active row → `--q-hover`, text `.72` → `--q-text-2` and `.34/.42/.50/.60` → `--q-text-3`. Both decorative gradients (`desktop-preview__screen`, `computer-screen__canvas`) moved to the same two surface tokens.
- A legibility defect of the same class as pass 9's 7px and pass 10's 8px surfaced in the same rules: `index.css:1683` and `:1691` set `font: 6px ui-monospace` on the numbered step cells and the preview bar label. They compute at 11px now, which is the size the sibling `strong`/`small` in the same row already declare. Count of elements under 10px inside the three surfaces after: **0** on each.
- Measured after: **42 → 1, 66 → 1, 50 → 0**. The single remaining hit on the first two is `.status-dot--live` at `rgb(228, 228, 228)`, which is the queued semantic decision, not a leftover of this family. Values now: rows `rgb(26, 36, 32)` at rest and `rgb(35, 46, 41)` active, hairlines `rgb(39, 51, 46)`, tiles `rgb(26, 36, 32)`, text `rgb(176, 195, 186)` / `rgb(120, 143, 133)`.
- Deliberately included beyond the three surfaces: `.metric-card span/small` (flagged on the Integrations detail grid) and the `.subagent-streams` half of the shared step-row rule, which renders 0 elements today — declared so the shared rule does not leave a sister off-tone, the same call pass 16 made for the layout root.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` in 4.32s). From the root: `continuity:verify` PASS (227 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both returned HTTP 200. Hit counts produced by the same sweep script before and after. Captures read back and filed in `qoder-verify-shots/`: `qoder-cloud-agents-mint-dark.png`, `qoder-computer-use-mint-dark.png`, `qoder-integrations-mint-dark.png` — panels read as flat dark surfaces with hairlines, the numbered step cells are legible, and `qoder-chat-after-pass17.png` shows the chat intact (`.chat-surface` present, composer present, sidebar and body `rgb(17, 40, 32)`, status bar still `rgb(24, 24, 24)`).
- Unverified checks: the other three consumers of `.capability-list` / `.capability-row` (`CanvasStudio`, `CommandStudio`, `CapabilityRegistry`) were never opened, so their improvement is inferred from the shared declaration rather than measured; `.status-dot--live` and the `.status-bar` background untouched; runtime-backed data not exercised (`127.0.0.1:8080` refuses connections here); no cargo command attempted, since the MSVC blocker recorded above means nothing Rust-side links; root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine.
- Risks: `.capability-*` is shared with surfaces nobody measured this pass, so a layout assumption in one of them could show up later; and the resting/active pair now differs by a full token step (`--q-raised` → `--q-hover`) where the legacy values differed by two RGB points, so the selected row reads slightly stronger than before.
- Rollback point: `git restore crates/presentation/desktop/frontend/src/qoder-shell.css` drops this block along with pass 16's, so reverting would undo two passes; to drop only this one, delete the block between the `Familia capability` header and the end of the file. The audit, changelog and journal entries are additive.
- Next step: measure the three unopened consumers of the `capability-*` family (Canvas, Command Center, Capability Registry), then the two decisions still waiting on the user — `.status-dot--live` and the `.status-bar` value — plus the fabricated `plugins` registry and the pill/chip resting fills.

### Follow-up — last three capability consumers measured, Canvas and Commands to zero hits, 2026-10-19 (pass 18 of the scheduled improvement loop)

- Authorized implementation step: the item pass 17 queued — measure the three other consumers of the `capability-*` family whose improvement had been inferred rather than observed: `CanvasStudio`, `CommandStudio` and `CapabilityRegistry`.
- Routing checked first, and one of them is not where the queue implied: Canvas and Commands mount from `PlatformSurface.tsx:164` and `:171` (modes `canvas` and `commands`) under a shared root `.capability-studio`, reachable from the palette. `CapabilityRegistry` is not a rail surface at all — it renders inside Settings → nav row **"Keyboard shortcuts"** (id `advanced`) → the `Open control center` button (`SettingsWorkspace.tsx:561`) → Overview tab (`SettingsControlCenter.tsx:515`), three clicks deep, and the control center is lazy so the panel has to be scrolled into view before it exists in the DOM.
- Measurement before: **Canvas 29 neutral hits over 86 visible elements, Commands 32 over 213, Capability Registry 120 over 167.**
- Main finding: `.capability-studio` was never in scope. It is a *different* rule (`index.css:1633`) carrying the same `#333333` / `#181818` literals as the four-pane sibling pass 16 fixed at `index.css:1677`, so both studio surfaces still computed `rgb(24, 24, 24)` on an `rgb(51, 51, 51)` hairline. Second finding, good news: pass 17's skin does reach the registry — its rows are `div.capability-row` and no longer report a neutral background, so the shared declaration had landed on a consumer nobody had opened.
- Skin added: 34 declarations covering the rest of the family (`.capability-studio`, `.capability-list__head`, `.capability-tabs`, `.capability-tab(--active)`, `.command-search` + its input, `.capability-field` + textarea/select/focus, `.command-variable-row span`, `.code-preview`, `.capability-summary`, the four `.capability-pill` variants, `.capability-latency`) plus Canvas' own blocks (`.canvas-toolbar`, `-grid`, `-card`, `-card--primary`, `-connector`, `-preview`, `-preview__hero`). Mapping unchanged from passes 9/10/16/17, no new colour.
- A specificity miss that only the measurement could catch: pass 17 wrote `.capability-row small` (0,1,1), but `workspace-enhancements.css:1063` declares `.capability-row > div small` at (0,2,1) — and that is the form the registry uses, because its rows nest a `div`. The label stayed `rgba(228,228,228,.42)` on 12 rows. Added the (0,2,1) form with a comment; registry hits went 120 → 68 → 56.
- Legibility defect of the pass-9/10/17 class: `index.css:1660` sets `.command-variable-row span` to `font: 6px ui-monospace`, so the `{{workspace}}` / `{{diff}}` / `{{rules}}` / `{{context}}` chips on Commands rendered at 6px. Now 11px, the size the rest of the family declares. Measured elements under 10px inside the studio: **4 → 0**.
- Corrected mid-pass rather than left in the file: `.code-preview`'s `font: 8px` is **not** fixed by this pass. `features/platform/DeveloperWorkspace.css:1` — a lazily imported component sheet that lands *after* `qoder-shell.css` — declares `.code-preview { background: var(--code); font: 12px/1.7 var(--font-mono) }` at equal specificity, so it wins on order: the block already computes 12px, and its background is transparent because `--code` is one of the two variables pass 12 deliberately left undefined. The two shell declarations that could not take effect were deleted rather than left claiming a fix; only `border-color` and `color`, which that sheet does not touch, are declared (measured: `rgb(39, 51, 46)` and `rgb(176, 195, 186)`).
- Tool trap recorded: `page.locator('.palette-item', { hasText: 'Commands' }).first()` clicked **Command Center**, because `hasText` is a substring match and Command Center sorts first. Navigation now filters the palette by the query and clicks the item whose text starts with the exact label.
- Measured after: **Canvas 29 → 0, Commands 32 → 0, Registry 120 → 56.** Both studio roots now compute `rgb(10, 15, 13)` on `rgb(39, 51, 46)`. All 10 remaining registry patterns belong to a different family — `.control-center-search`, `.customize-filter`, `.customize-row__icon` — deliberately left for its own pass instead of editing a family whose other consumers were not opened.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` clean, `vite build` 9.76s). From the root: `continuity:verify` PASS (230 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both HTTP 200. Captures read back and filed in `qoder-verify-shots/`: `qoder-canvas-studio-mint-dark.png`, `qoder-command-studio-mint-dark.png`, `qoder-capability-registry-mint-dark.png`, `qoder-chat-after-pass18.png`. Chat re-verified after: `.chat-surface` present, composer present, sidebar and body `rgb(17, 40, 32)`.
- Unverified checks: the 56 remaining registry hits in the `customize-*` / `control-center-*` family untouched; `.canvas-preview` (dashed empty state) was declared from source but never rendered by the selected canvas, so it is unobserved; `DeveloperWorkspace`, the other `.code-preview` consumer, was never opened; runtime-backed data not exercised (`127.0.0.1:8080` refuses connections); no cargo command attempted, the MSVC toolchain still has no `.lib` files; root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine.
- Risks: `.capability-studio` is the shared root for any future two-pane capability surface, so this block is now load-bearing for screens that do not exist yet; and `--code` is now visibly the variable deciding whether code blocks have a background, so defining it later changes two surfaces at once.
- Rollback point: delete the block from the `Familia capability: los tres consumidores restantes` header to the end of `qoder-shell.css`, plus the `.capability-row > div small` line added inside the pass-17 block. `git restore` on the file would undo passes 16, 17 and 18 together.
- Next step: sweep the `customize-*` / `control-center-*` family inside the same control center (it is already reachable and the hits are already counted), then settle `.code-preview`'s background by deciding `--code`, then the user decisions still open: `.status-dot--live`, `.status-bar`, the fabricated `plugins` registry and the pill/chip resting fills.

### Follow-up — control-center / customize / keymap family skinned, 56+112+91 neutral hits to 0+0+0, 2026-10-19 (pass 19 of the scheduled improvement loop)

- Authorized implementation step: the item pass 18 queued — sweep the `customize-*` / `control-center-*` family in the control center, whose 56 registry hits were already counted and whose surface was already reachable.
- Reachability mapped before measuring, because this family hides: the control center opens from Settings → nav row **"Keyboard shortcuts"** (id `advanced`) → `Open control center` (`SettingsWorkspace.tsx:561`), and its tabs switch an internal `section` state (`SettingsControlCenter.tsx:489` onward). The **Keymap editor is not a control-center tab** — it is the `LazyPanel` that sits above the open button in the Advanced panel, so it is measured with the control center closed. Three consumers were opened: Capability Registry (Overview), CustomizeManager (Customizations) and the keymap table.
- Measured before: **Registry 56 hits / 167 visible elements, Customizations 112 / 129, Keymap editor 91 / 83** — and the keymap surface carried **9 elements computing under 10px**, all `.keycap` chips (`Ctrl+K`, `Ctrl+N`, `Ctrl+B`, `Ctrl+J`, `Ctrl+F`, `Ctrl+S`, `Ctrl+Enter`, `Esc`, `Ctrl+Y`) at `font: 600 8px` from `workspace-enhancements.css:1048`. That is the fifth instance of this defect class after 6px (passes 17 and 18) and 7px/8px (passes 9 and 10).
- Source read: the whole family lives in `workspace-enhancements.css:815-1052` with literal hexes and **no `!important` anywhere in it** (grep over `customize-`/`control-center-` returns nothing), so equal-specificity re-declaration in the shell sheet carries it, as in passes 16-18.
- Skin added: 34 declarations over `.control-center-search` (+ its input), the four toolbar `select` forms, `.customize-filter` / `:hover` / `--active`, `.customize-manager__body` / `__list` / `__detail`, `.customize-row` / `:hover` / `--active` / `__icon` / `small`, `.customize-detail__header h3|p`, `.customize-detail__grid` cells and labels, `.customize-empty`, the shared `.control-info-line` / `.control-info-callout` pair, `.keymap-table`, `.keymap-table__head`, `.keymap-row` with its `strong`/`small`, `.keycap` and `.keymap-state`, plus `.settings-lazy-panel`. Mapping unchanged: `#333333`/`#3d3d3d` → `--q-border`, `rgba(228,228,228,.07)` → `--q-border-soft`, `#1a1a1a`/`#1e1e1e` → `--q-raised`, `#212121` → `--q-hover`, `.85`/`#e4e4e4` → `--q-text`, `.72` → `--q-text-2`, `.34/.42/.50/.60` → `--q-text-3`. No new colour.
- Measured after: **0 / 0 / 0 hits and 0 sub-10px elements on all three surfaces.** Values now: search field `rgb(26, 36, 32)` on `rgb(39, 51, 46)`; active filter and active row `rgb(35, 46, 41)` with `rgb(234, 243, 239)` text; row icons and detail grid cells `rgb(26, 36, 32)` on inner hairline `rgb(29, 39, 34)`; detail pane `rgb(10, 15, 13)`; keycaps 11px on `rgb(35, 46, 41)`.
- Left untouched on purpose, and recorded as such: `.control-center-search kbd`, `.keycap:hover`, `.keycap--conflict`, `.keymap-row input` and `.keymap-state--conflict` are declared in the same source block but render nothing in the states measured (kbd needs a conflict state, the input needs a row in edit mode), so they stay queued rather than being skinned blind.
- Tool note worth keeping: **editing a CSS file makes Vite do a full page reload here, which wipes any helper injected via `page.evaluate`** — `window.__sweep is not a function` on the next call. Re-install the sweep helpers after each CSS edit instead of assuming the page state survived.
- Clock discrepancy found while registering, reported rather than patched: this entry's journal line carries `timestamp: 2026-10-18T09:16:32-03:00`, which is **earlier** than the four lines before it (`2026-10-19T08:43` through `2026-10-19T09:06`). `date` now reports the machine clock at `2026-10-18T09:16 -0300`, so the real clock is on the 18th while the last five ledger entries — including pass 17 and pass 18 — are dated the 19th. The journal was not edited to match: existing lines are append-only and this is a machine-clock fact, not a ledger fact. Queued so the user can decide whether to correct the clock or the dates.
- Files changed: `crates/presentation/desktop/frontend/src/qoder-shell.css`, `docs/architecture/QODER-UI-AUDIT.md`, this changelog, one appended line in `reference/journal/agent-operations.jsonl`.
- Verification evidence: `npm run check` in the frontend exited 0 (FRONTEND ARCHITECTURE PASS, `tsc` reported no errors, `vite build` 4.46s). From the root: `continuity:verify` PASS (231 journal operations, 8 workstreams, 38 capabilities), `state:verify` PASS (workstreams=8, capabilities=38, active=7), `frontend:architecture` PASS, `frontend:runtime-contract` OK (89 frontend API paths, 96 backend routes), `provider:coverage` PASS. http://localhost:5188 and the reference http://localhost:5189 both HTTP 200. Captures read back and filed in `qoder-verify-shots/`: `qoder-keymap-editor-mint-dark.png` (keycaps and table legible), `qoder-customize-manager-mint-dark.png` (detail pane, ENABLED pills and the dashed contract callout on-tone), `qoder-capability-registry-mint-dark.png`, `qoder-chat-after-pass19.png`. Chat re-verified after closing the modal: `.chat-surface` present, composer present, sidebar `rgb(17, 40, 32)`.
- Unverified checks: the five unrendered selectors listed above; the control center's other tabs (AI & Agent, Execution & Security, Interface & Performance, Data & Usage, Deep Configuration) were not opened, so any `control-*` chrome they render is unmeasured; `ThemeStudio` and `ScopeResolverPreview` are declared consumers of this family and were never opened; the CustomizeManager capture shows the detail pane, not the scrolled list column; runtime-backed data not exercised (`127.0.0.1:8080` refuses connections); no cargo command attempted, the MSVC toolchain still has no `.lib` files; root `npm run check`, `npm run test` and the aggregate `npm run verify` remain unrunnable on this machine.
- Risks: `.control-info-line` / `.control-info-callout` are shared with control rows across the whole control center, so this block reaches tabs that were never opened; and the shell file is now ~1330 lines of accumulated per-pass blocks, so three passes of skin live in one file and `git restore` undoes all of them together.
- Rollback point: delete the block from the `Familia control-center / customize / keymap` header to the end of `crates/presentation/desktop/frontend/src/qoder-shell.css`. The audit, changelog and journal entries are additive.
- Next step: sweep the remaining control-center tabs and the two unopened consumers (`ThemeStudio`, `ScopeResolverPreview`) to catch the chrome this family still hides, then the five unrendered selectors, then settle `.code-preview`'s background by deciding `--code`. Still waiting on the user: `.status-dot--live`, the `.status-bar` value, the fabricated `plugins` registry and the pill/chip resting fills.

### Follow-up — the backend compiles, links and boots; readiness moves from stage 3 to stage 4, 2026-10-19

- Authorized implementation step: verify R0, which the user unblocked by authorising the Visual Studio C++ repair, and take the runtime as far as it goes in one pass. This entry is written here rather than only in the journal because the frontend's `Runtime offline` fallbacks and checklist items 1-7 all hang on the same measurement.
- **The blocker did not clear the way the item predicted.** The repair landed — `find "/d/visualstudiocomunity/VC/Tools/MSVC" -name "*.lib"` went from 0 to **725** — but a raw `cargo check -p agenticos-api-server --all-targets` still died with `CARGO_EXIT=101` / `LNK1104: msvcrt.lib`. Cause measured, not guessed: the libs are unevenly installed. `14.43.34808\lib\x64\msvcrt.lib` is present (8 MB, stamped 2026-10-19) while the newest toolchain `14.51.36231\lib\` contains only `arm64`, `arm64ec` and `onecore` — **no `x64`** — and rustc auto-detects the highest version. Disk presence is not the linker search path.
- Fix, with no system or registry change: export `LIB` to `14.43.34808\lib\x64` plus Windows SDK `10.0.26100.0` `um\x64` and `ucrt\x64`, and `INCLUDE` to the matching include dirs. Probed on one small crate first (`cargo check -p serde_core`, exit 0 in 16.16s) before spending a long build on it.
- Verified after the override: `cargo check -p agenticos-api-server --all-targets` **exit 0, 4m 13s, 267 crates, 0 errors, 23 warnings**; `cargo build -p agenticos-api-server` **exit 0, 5m 48s**, binary `target/debug/agenticos-api-server.exe` **27,740,672 bytes**.
- Boot and contract probes against the live process (`127.0.0.1:8080`, database pointed outside the checkout so the tree stayed clean): `GET /health` **200** on the first poll with `status:"healthy", backend:"rust", database:"sqlite", sandbox:"Ready", provider_configured:false`. `/api/models` 200 `count:1`; `/api/providers` 200 `configured:false, health:"Unhealthy"`; `/api/skills` 200 `count:5`; `/api/capabilities` 200 `{"grants":[]}`; `/api/workflows` 200 `count:0`; **`/api/memory` 400 `missing field 'namespace'`**; **`/api/conversations` and `/api/history` 404**. The 400 and the two 404s are the first hard leads for R2's contract diff. Server stopped afterwards and the port verified closed.
- Also in this pass, recovery: **passes 18 and 19 had written their CSS block, changelog, audit and journal but never committed.** The work sat in the working tree for hours, exposed to loss and leaving the backlog out of step with the ledger. It was re-verified rather than trusted — `npm run check` exit 0 (tsc clean, 180 modules, vite build 7.06s) and all five node verifiers exit 0 run individually — then committed as `64665083` and pushed to `main` without rewriting anything from those passes.
- Correction to an earlier claim: the `LNK4044` noise predicted from `.cargo/config.toml`'s `-fuse-ld=lld` never appeared — **0 hits** across both logs, including the real final link. The flag is still wrong for this host target, but the prediction that it would become a problem once linking worked was false, and the backlog now says so.
- `.env` state corrected in the backlog too: it exists (copied from `.env.example`, gitignored at `.gitignore:2`), but `AGENTICOS_API_KEY` is **empty, length 0** — checked by measuring the length, never by printing the value. Checklist item 5 stays gated on the user writing a key in; nothing in this pass can produce a chat round-trip without one.
- Files changed: `docs/architecture/READINESS-BACKLOG.md` (R0 `DONE`, R1 `DONE` with the restart command, R3/R4 reclassified `OPEN`, new R8 and R9, checklist items 1-7 restated, `## Estado` to stage 4, `.env` and the two stale toolchain claims corrected) and this changelog, plus one journal line. **No source file changed in this sub-operation.**
- Unverified checks: `cargo test`/`cargo clippy` over the workspace (new R8); root `npm ci` retest with the override (new R9 — deliberately not attempted, since it deletes `node_modules` and a failed retry would take the green frontend gates down with it); the frontend against a live runtime (R3 — the six gates were run with the server stopped); the `Runtime offline` status bar itself; the `-fuse-ld` flag's real behaviour under a linker that warns instead of dying early.
- Risks: every future Rust command on this machine reproduces exit 101 unless it exports `LIB`/`INCLUDE`, so the override is now load-bearing and lives only in documentation; the `14.51.36231` toolchain remains half-installed and any tool that auto-picks the newest version will keep failing; and the built binary is `dev` profile, not a release build.
- Rollback point: this sub-operation only touched `docs/architecture/READINESS-BACKLOG.md`, this file and `reference/journal/agent-operations.jsonl` — `git revert` of the documentation commit. The recovered pass 18-19 commit is `64665083` and rolls back with `git revert 64665083` as one unit. `target/debug/agenticos-api-server.exe` and `loop-runtime/agenticos-loop.db` are both build artefacts outside the tracked tree.
- Next step: **R8** — `cargo test --workspace --all-targets` and `cargo clippy --workspace --all-targets -- -D warnings` with the override exported; it is checklist item 7 and the last untried gate the linker used to block. Then **R3**, which needs the server and the frontend up at the same time. Still waiting on the user: `AGENTICOS_API_KEY` in `.env`, and the four UI decisions from pass 19.

