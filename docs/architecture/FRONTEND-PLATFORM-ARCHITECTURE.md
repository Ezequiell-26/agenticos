# AgentiCOS Frontend Platform Architecture

## Purpose

The AgentiCOS desktop frontend is a product shell for an agent runtime, not the runtime itself. The UI can model complete workflows locally while preserving an explicit boundary for capabilities that will later be implemented by Rust services.

## Product domains

The frontend is divided into four navigation planes:

- **Build** — Command Center, Files & Editor, Terminal, Prompt Lab, Projects, Codebase Index, Context, Rules & Instructions.
- **Operate** — Runs, Background Agents, Reviews & Bugbot, Checkpoints, Approvals, Observability, Agent Profiles, Bots & Teams, Workflows, Automations, Artifacts, Research, Batch Processing and Learning Loop.
- **Configure** — Providers & Models, Skills, Tools, Memory, Settings, Plugins, Hooks & Policies and Execution Lab.
- **Integrate** — Channels & Gateway, Browser, Voice & Media, MCP Servers, Environments, Source Integrations and Security Center.

## Source structure

`src/navigation.ts` is the single source of truth for frontend modes and their metadata. The activity rail, command palette and application title resolution consume the same registry.

The existing `components/StudioSurface.tsx` remains responsible for the earlier editor/run/provider/skills/tools/memory/workflow/artifact/terminal/settings surfaces.

New cross-cutting agent-product capabilities live under:

```
src/
  navigation.ts
  components/
    ActivityRail.tsx
    ChatSurface.tsx
    ChatEnhancementDock.tsx
    CommandPalette.tsx
    WorkspaceOverview.tsx
    StudioSurface.tsx
  features/
    platform/
      PlatformSurface.tsx
```

This is an incremental migration point: future domains can be extracted from `PlatformSurface.tsx` into feature-specific modules without changing the public navigation contract.

## Capability mapping

The frontend now has dedicated visual surfaces for:

- Cursor-style agent projects and larger coordinated tasks.
- Codebase indexing and semantic-search-oriented workspace discovery.
- Explicit context assembly, including file, diff, rule, memory, history and web-source references.
- Rule sources such as `AGENTS.md`, `.cursor/rules`, `.hermes.md`, `SOUL.md` and user/workspace policy.
- Long-running/background agent execution with isolated worktree presentation, progress and handoff.
- Review/Bugbot-style findings and fix-task handoff.
- Checkpoint snapshots, diff inspection and restore preview.
- Hermes-style specialist bots, team routines and delegation policy.
- Cron/natural-language automation design with pause/resume presentation.
- Multi-channel gateway presentation for desktop and messaging surfaces.
- Browser control, URL navigation, action logs, DOM/screenshot previews.
- Voice/media controls for voice input, transcription, TTS and multimodal attachments.
- Research batches, sources, trajectories and export.
- MCP server installation, capabilities and authentication preview.
- Security policy presentation for approval, sandbox, network, secret and destructive-action controls.

## Chat contract

`ChatSurface` owns the live chat interaction already backed by the known runtime service. `ChatEnhancementDock` adds presentation-only composition features:

- `@files`, `@diff`, `@memory`, `@rules`, `@terminal`, `@url` context references.
- `/plan`, `/review`, `/research`, `/fix`, `/test`, `/summarize` command affordances.
- Branch, checkpoint and background-agent actions.
- Response-format, structured-output, citation and voice-input previews.

These affordances do not invoke unsupported endpoints.

## Runtime boundary

The frontend may:

- manage local visual state;
- preview future capability;
- persist non-sensitive UI preferences;
- render live responses through existing runtime services.

The frontend must not:

- hold provider credentials as runtime state;
- invent API routes;
- claim cloud/background execution without a real runtime contract;
- claim messaging delivery is connected from presentation state;
- treat mock telemetry as production telemetry;
- advance the repository implementation state.

## Reference basis

The structure follows public product capabilities documented by Cursor and Hermes, including Cursor Agent/Cloud Agents, Rules, codebase indexing and agent security, and Hermes tools/toolsets, skills, persistent memory, context files, checkpoints, scheduled tasks, delegation, browser, voice, MCP and multi-platform gateway.

Public references:

- https://cursor.com/docs/agent/overview
- https://cursor.com/docs/cloud-agent
- https://cursor.com/docs/rules
- https://prod.cursor.com/docs/agent/security
- https://prod.cursor.com/blog/secure-codebase-indexing
- https://github.com/NousResearch/hermes-agent
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/overview.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/tools.md
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/browser.md

## Verification state

This document records architecture only. CI, browser verification, Windows/Tauri rendering, accessibility and new live runtime contracts remain separate verification gates.

## Agent composition modes

The chat control plane now exposes local presentation modes corresponding to documented Cursor/Hermes-style workflows:

- **Agent** — implementation/refactoring workflow.
- **Plan** — research and plan before build.
- **Ask** — read-only exploration.
- **Debug** — evidence-first diagnosis.
- **Bot** — specialist profile context.

The composer also exposes slash-style entry points for `/ask`, `/debug`, `/goal`, `/fork`, `/resume`, `/compact`, `/rename` and `/run-everything` alongside the existing planning/review/research commands. These are local presentation affordances until explicit runtime contracts exist.

## Expanded platform domains

- **Plugins** package optional capabilities.
- **Hooks & Policies** model lifecycle middleware and fail-closed event handling.
- **Execution Lab** models reproducible sandbox execution without executing browser-side code.
- **Environments** represent local/background/future cloud development environments with explicit setup, network, secrets and MCP boundaries.
- **Source Integrations** represent repository and engineering-system connections.
- **Batch Processing** models bounded-concurrency work over many inputs.
- **Learning Loop** models reviewable skill/memory/prompt candidates rather than silently mutating agent behavior.

These domains are frontend product surfaces, not claims of live availability.


## Product completion surface map

The current frontend registry contains 49 user-facing modes. This is intentionally broader than the minimal chat/editor baseline so the UI can absorb future runtime capabilities without a second information-architecture redesign.

The user-facing organization is:

- Build: Command Center, Files & Editor, Terminal, Prompt Lab, Projects, Codebase Index, Context, Rules & Instructions.
- Operate: Runs, Tasks, Background Agents, Reviews & Bugbot, Checkpoints, Approvals, Observability, Agent Profiles, Bots & Teams, Workflows, Automations, Artifacts, Research, Evaluations, Notifications, Sessions, Logs & Traces, Analytics, Batch Processing and Learning Loop.
- Configure: Providers & Models, Skills, Tools, Memory, Settings, Toolsets, Plugins, Hooks & Policies, Execution Lab, Credentials.
- Integrate: Channels & Gateway, Browser, Voice & Media, MCP Servers, Environments, Webhooks & Events, Imports & Migrations, Media Studio, Wake Word & Presence, Source Integrations and Security Center.

This surface map is visual product structure only. It does not imply that any listed runtime integration is connected.

The default interaction model is:

```
discover capability
  -> choose task surface
  -> configure context / agent / tools
  -> inspect plan and trace
  -> review changes / approvals
  -> inspect artifacts / evidence
  -> return to session or fork
```


## Navigation ergonomics and chat reliability

The activity rail intentionally exposes a compact primary set of high-frequency surfaces. The full 49-mode registry remains available through the AgentiCOS launcher and command palette. When a secondary surface is active, that surface is temporarily surfaced in the rail so the current location remains visible.

The chat surface follows a fail-recovery rule: a runtime rejection produces a visible system error, restores the unsent draft in the composer, returns the run state to failed, and leaves the user able to retry without reconstructing the message manually. Message history also keeps the latest activity in view through controlled auto-scroll.

Accessibility behavior includes visible keyboard focus treatment and a reduced-motion mode for preference-aware environments.


## Cursor + Hermes capability coverage matrix — 2026-09-24

The frontend now models the major documented capability families from current Cursor and Hermes product documentation.

| Capability family | Frontend surface |
| --- | --- |
| Cursor Agent, Plan/Ask/Debug workflows | Command Center + Agent Mode Strip |
| Cursor Projects and larger coordinated work | Projects + Tasks + Kanban |
| Cursor codebase indexing and explicit context | Codebase Index + Context |
| Cursor Rules / AGENTS.md style instructions | Rules & Instructions |
| Cursor checkpoints | Checkpoints + Security recovery |
| Cursor Bugbot / review workflows | Reviews & Bugbot |
| Cursor Browser with screenshots, console and network | Browser + Computer Use |
| Cursor Image generation / Canvas artifacts | Media Studio + Canvas |
| Cursor Skills / Commands / Hooks / Plugins | Skills + Commands + Hooks + Marketplace |
| Cursor MCP / Subagents | MCP Servers + Subagents |
| Cursor Cloud Agents / isolated environments / remote desktop | Cloud Agents + Environments |
| Hermes tools and toolsets | Tools + Toolsets |
| Hermes persistent memory and session search | Memory + Sessions + Context |
| Hermes context files and @ references | Rules & Instructions + Chat Context Dock |
| Hermes checkpoints / rollback | Checkpoints |
| Hermes scheduled tasks / cron | Automations + Commands |
| Hermes delegation / parallel subagents | Subagents + Background Agents |
| Hermes web/browser/vision/image/TTS/video capabilities | Browser + Voice & Media + Media Studio + Tools |
| Hermes messaging gateway | Channels & Gateway |
| Hermes MCP integrations | MCP Servers |
| Hermes learning loop / skills | Learning Loop + Skills |
| Hermes administration dashboard | Operations Center |
| Hermes backup/restore/security operations | Operations Center + Security Center |
| Hermes desktop GUI/computer tools | Computer Use |
| Hermes kanban/tool-driven task management | Kanban |
| Hermes Home Assistant integration | Home Assistant |
| Hermes social/X search capability | Social Search |

These surfaces are product/UI representations. They do not claim the corresponding external service, credential, cloud environment or runtime tool is connected until a matching Rust service contract exists.

Reference basis: Cursor documents Agent, Cloud Agents, Browser, Skills, Customize/Plugins/MCP/Subagents/Hooks, Bugbot and current agent workflows; Hermes documents tools/toolsets, skills, memory, context, checkpoints, cron, delegation, browser, MCP, gateway, desktop dashboard, multimodal tools and learning-oriented workflows.
