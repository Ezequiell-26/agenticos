# AgentiCOS Frontend Capability Matrix

Updated: 2026-09-24

## Purpose

This matrix is the working inventory for frontend completeness. A feature counts as frontend-complete when its visual surface, navigation metadata, explicit UI states, safe action affordances, responsive layout, and runtime boundary are represented.

Backend pending means the UI contract exists but the corresponding Tauri/Rust service is not yet connected.

## Build / development

| Surface | Frontend surface | Main concerns | Backend status |
| --- | --- | --- | --- |
| Command Center | ChatSurface | conversations, send/stop, session status | connected vertical slice |
| Workspace Overview | WorkspaceOverview | project health, activity, approvals | preview |
| Files & Editor | existing surface | explorer, tabs, diff, inspector | preview |
| Developer Workspace | DeveloperWorkspace | symbols, search, safe edits, code preview | preview |
| Git Control Center | GitControlCenter | branches, diff, commit, stash, conflict, rollback | preview |
| Agent Mission Control | AgentMissionControl | mode, model, routing, context, tools, isolation, parallelism, schedule, preflight | preview |
| Task Execution Center | TaskExecutionCenter | tasks, terminals, processes, approvals, logs, evidence | preview |
| Codebase Index | existing surface | semantic repository map | preview |
| Context | existing surface | source selection, budget | preview |
| Advanced Context | FinalControlSuite | compaction, provenance, budgets | preview |
| Rules & Instructions | existing surface | AGENTS.md and hierarchy | preview |
| Canvas | CanvasStudio | visual artifacts and side-by-side work | preview |
| Commands | CommandStudio | reusable agent commands | preview |
| Prompt Lab | PromptLab | versions, variables, tests, release | preview |

## Runtime / orchestration

| Surface | Frontend surface | Main concerns | Backend status |
| --- | --- | --- | --- |
| Runs | existing surface | run lifecycle | connected concept, broader services pending |
| Run Control Center | RunControlCenter | graph, retry, checkpoints, handoffs, artifacts | preview |
| Tasks | TaskExecutionCenter via PlatformSurface | objectives, execution queue, terminals, approvals, logs and evidence | preview |
| Background Agents | existing surface | long-running isolated jobs | preview |
| Cloud Agents | CloudAgentsWorkspace | remote agents and follow-ups | preview |
| Remote Control Center | RemoteControlCenter | remote session monitoring, device pairing, approvals, notifications and resume workflow | preview |
| Subagents | SubagentFleet | isolated specialists | preview |
| Agent Teams | FinalControlSuite | multi-agent lanes and handoffs | preview |
| Agent Control Plane | AgentControlPlane | autonomy, policy, budgets | preview |
| Automations | AutomationBuilder | schedules and triggers | preview |
| Session Replay Studio | SessionReplayStudio | branch, replay, compare, restore, event timeline | preview |
| Offline & Recovery | FinalControlSuite | offline queue, restore, retry | preview |

## Tool / integration plane

| Surface | Frontend surface | Main concerns | Backend status |
| --- | --- | --- | --- |
| Providers & Models | ProviderStudio via PlatformSurface | catalog, routes, quotas, fallback and capabilities | first provider boundary connected |
| Routing Studio | AdvancedStudio | routing and fallback | preview |
| Model Playground | AdvancedStudio | model comparison | preview |
| Token Observatory | AdvancedStudio | budgets and optimization | preview |
| Tools | ToolPolicyStudio | scopes, risk, approvals | preview |
| Toolsets | existing surface | grouped capabilities | preview |
| Skills | SkillsStudio via PlatformSurface | installable capabilities and configuration | preview |
| MCP Servers | McpManager | tool servers and auth | preview |
| Browser | BrowserWorkspace | navigation, DOM, console, network | preview |
| Computer Use | ComputerUseWorkspace | desktop automation and recording | preview |
| Voice & Media | existing surface | speech, TTS, vision, media | preview |
| Channels & Gateway | ChannelGatewayManager | messaging and delivery | preview |
| Plugins / Marketplace | MarketplaceStudio | extensions and packages | preview |
| Environment Lab | EnvironmentLab | local, worktree, cloud, SSH, network, snapshots | preview |
| Credentials | CredentialManager | masked metadata, no secrets | preview |
| Imports & Migrations | existing surface | rules, sessions, skills | preview |
| Source Integrations | IntegrationCatalogSurface | GitHub/GitLab/engineering systems | preview |
| Webhooks & Events | existing surface | inbound triggers | preview |

## Governance / verification

| Surface | Frontend surface | Main concerns | Backend status |
| --- | --- | --- | --- |
| Permissions Matrix | PermissionsMatrix | resource scope and authorization | preview |
| Approval Center | ApprovalCenter | human gates | preview |
| Security Center | SecurityCenter | sandbox, data, network, secrets | preview |
| Hooks & Policies | HookManager | pre/post action governance | preview |
| Evaluations | FeatureWorkbench via PlatformSurface | repeatable suites, baselines, comparisons and evidence | preview |
| QA & Readiness | FrontendQAHarness | visual/accessibility/readiness evidence | preview |
| Observability | FinalControlSuite | metrics, traces, events | preview |
| Logs & Traces | existing surface | structured diagnostics | preview |
| Evidence & Artifact Inspector | EvidenceArtifactInspector | screenshots, logs, diffs, reports, provenance | preview |
| Release Center | FinalControlSuite | gates and rollback | preview |
| Audit Log | AdvancedStudio | chronological evidence | preview |
| Checkpoints | existing surface | snapshots and restore | preview |
| Cost & Usage | FinalControlSuite | tokens, quotas, budgets | preview |
| Collaboration & Review Center | CollaborationReviewCenter | review threads, checks, approvals, handoffs | preview |
| Design System Studio | DesignSystemStudio | components, tokens, states, density, accessibility foundations | preview |
| Frontend Coverage Studio | FrontendCoverageStudio | full surface inventory, ownership, platform-mode and verification contract audit | preview |

## UX / continuity

| Surface | Frontend surface | Main concerns | Backend status |
| --- | --- | --- | --- |
| Sessions | FeatureWorkbench via PlatformSurface | history, lifecycle, search and export presentation | history endpoint exists; broader branching pending |
| Session Replay Studio | SessionReplayStudio | trajectory timeline, forks, replay | preview |
| Knowledge Studio | KnowledgeStudio | sources, retrieval, provenance | preview |
| Memory Studio | MemoryStudio | persistent memory | backend foundation exists; UI adapter pending |
| Notifications | FeatureWorkbench via PlatformSurface | priority inbox, source filters and read state | preview |
| Customization | FinalControlSuite | themes, keymaps, layouts | preview |
| Help & Documentation | FinalControlSuite | contextual help | preview |
| Workspace Setup | FrontendCompletenessStudio | setup checklist | preview |

## State coverage required by every substantial surface

Each module should represent, where meaningful:

- loading
- ready
- empty
- error
- offline
- reconnecting
- stale
- permission denied
- approval required

## Completion gates

1. Navigation registry has one owner per surface.
2. Surface is lazy-loaded when substantial.
3. Actions have explicit labels and do not fabricate runtime effects.
4. Sensitive information stays outside presentation state.
5. Responsive layout exists for narrow widths.
6. Verification status is evidence-backed.
7. Backend connection later replaces adapters, not component architecture.

## Current reality

The frontend now has broad coverage across coding-agent, orchestration, context, memory, tools, MCP, browser/computer use, governance, Git, execution, artifacts, environments, research, evaluation, release and recovery.

The remaining work to call the frontend operational rather than presentation-complete is backend adapter coverage, runtime event streaming, persistence, real command/tool execution, and fresh build/browser/Tauri verification.


## Final source-level ownership audit — 2026-09-24

The navigation registry currently contains 98 surfaces. Ownership is explicit through the shared audit utility:

- 91 `PlatformSurface` modes
- 6 `StudioSurface` modes: `files`, `terminal`, `runs`, `agents`, `artifacts`, `settings`
- 1 App-shell mode: `chat`
- 0 unowned navigation surfaces

This is a structural completeness result, not a runtime-verification result. Build, browser, accessibility execution and Tauri/runtime tests still require fresh evidence.


| Workspace Navigator | NavigationCenter | full feature catalog, sections, favorites and recent surfaces | preview |


| Quality Workbench | QualityWorkbench | diagnostics, tests, coverage, quick fixes and release evidence | preview |


| Provider & Model Control Center | ModelControlCenter | providers, models, routing, fallback, capabilities and usage | preview |


| Integration Control Center | IntegrationControlCenter | MCP, browser, channels, sources, credentials, webhooks and environments | preview |


| Governance Control Center | GovernanceControlCenter | permissions, approvals, security, hooks, audit and release gates | preview |


| Intelligence Control Center | IntelligenceControlCenter | context, knowledge, memory, research, prompts, evaluations and token optimization | preview |


| Project Control Center | ProjectControlCenter | project identity, workspace, tasks, Git, environments and direct workspace entry points | preview |


## Taxonomy exhaustiveness audit — 2026-09-24

All 98 navigation surfaces are now explicitly assigned to one of the seven navigation sections. `Run` has an explicit source set rather than relying on the classifier fallback.


## Remote control and shell orientation — 2026-09-24

Added a dedicated Remote Control Center and a persistent workspace command strip. The strip exposes project, branch, runtime, current surface, verification and agent-policy context without moving runtime authority into React state. Remote sessions, devices, approvals and notification preferences remain presentation-only until typed runtime contracts exist.

## Latest route ownership audit — 2026-09-24

The canonical navigation registry contains 98 surfaces: 91 typed `PlatformMode` surfaces, six `StudioSurface` modes (`files`, `terminal`, `runs`, `agents`, `artifacts`, `settings`), and one App-shell mode (`chat`).

All 91 `PlatformMode` values now have an explicit owner path in `PlatformSurface`:

- dedicated control/workbench components for complex capabilities;
- `FeatureWorkbench` for platform capabilities that need a coherent presentation surface but do not yet justify a separate feature module.

Current generic `FeatureWorkbench` modes:
`evaluations`, `versions`, `audit`, `notifications`, `sessions`, `logs`, `analytics`, `batch`, `learning`, `playground`, `routing`, `token-observatory`, `toolsets`, `execution`, `webhooks`, `imports`, `media`, `wake`.

The previous broad fallback that rendered `Security Center` for unrelated unhandled platform modes has been removed. Source audit result: **0 missing platform owners and 0 invalid non-platform owners**.

This is a source-structure result. Frontend build, browser verification, accessibility execution and Tauri rendering remain evidence gates, not implied by route coverage.


## Settings parity coverage — 2026-09-24

| Capability | Surface | Coverage | Runtime status |
| --- | --- | --- | --- |
| Hermes advanced parity | HermesParityControls | context engine, credential pools, fallback model, auxiliary task routing, voice mode, web crawl, streaming transport, gateway policies, quick commands | presentation preview |
| Auxiliary model matrix | SettingsStudio + HermesParityControls | provider/model/base URL/timeout contracts for side-task models | adapter pending |
| Gateway policy parity | HermesParityControls | group-session isolation and unauthorized-DM policy shape | runtime enforcement pending |
| Quick command contract | HermesParityControls | named zero-LLM command definitions | execution/authorization pending |
| Portable parity snapshot | SettingsStudio raw config | new fields serialized under hermes_parity | runtime schema reconciliation pending |
