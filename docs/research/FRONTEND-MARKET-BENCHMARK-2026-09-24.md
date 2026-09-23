# AgentiCOS Frontend Market Benchmark — 2026-09-24

## Purpose

This benchmark records a feature-oriented comparison of publicly documented agentic development products and translates the findings into concrete AgentiCOS frontend requirements.

This is not a product ranking. It is a capability inventory used to prevent feature gaps and avoid copying implementation details that are not documented.

## Sources reviewed

### Cursor
- Agent mode can search a codebase, edit multiple files, run terminal commands, write tests, fix errors and expose multiple operating modes such as Agent, Ask, Plan and Debug.
  - https://prod.cursor.com/help/ai-features/agent
- Cloud/background agents can run long-lived isolated development environments, execute commands/tests and attach screenshots, videos and logs to the resulting work.
  - https://prod.cursor.com/help/ai-features/background-agents
- Browser control includes screenshots plus console/network inspection for testing and accessibility workflows.
  - https://prod.cursor.com/docs/agent/tools/browser
- Run Modes govern approval/autonomy for shell, MCP and fetch actions.
  - https://cursor.com/docs/agent/security/run-modes
- Rules support project, user, team and AGENTS.md based persistent instructions.
  - https://prod.cursor.com/docs/rules
- Automations can combine background work, computer use and persistent memories.
  - https://cursor.com/docs/cloud-agent/automations

### OpenAI Codex
- Codex is presented as a command center for agentic coding with parallel agents, integrated worktrees and cloud environments.
  - https://openai.com/codex/
- The Codex app supports separate project threads, worktree isolation and reviewing changes without disturbing local Git state.
  - https://openai.com/index/introducing-the-codex-app/
- Codex also documents continuous/background work, Skills, PR review, multiple files and terminals, SSH development environments, browser workflows and computer use.
  - https://openai.com/es-419/index/codex-for-almost-everything/
- Codex general availability material documents editor, terminal and cloud use plus admin visibility and analytics.
  - https://openai.com/index/codex-now-generally-available/

### Google Antigravity
- Antigravity is documented as an agentic development platform combining an AI-powered editor with an agent-first interface.
  - https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/
- Antigravity 2.0 is documented as a standalone command center for launching, monitoring and orchestrating multiple local agents in parallel, with scheduled tasks.
  - https://codelabs.developers.google.com/getting-started-google-antigravity
- Google documents separate desktop, CLI, IDE and SDK surfaces for Antigravity.
  - https://cloud.google.com/blog/topics/developers-practitioners/choosing-your-surface-antigravity-20-antigravity-cli-antigravity-ide-or-antigravity-sdk/

### Claude Code
- Claude Code exposes permission modes, allowed/disallowed tools, resumable sessions, MCP configuration and structured output modes.
  - https://docs.anthropic.com/en/docs/claude-code/cli-usage
- Anthropic documents LLM gateways with centralized authentication, usage tracking, cost controls, audit logging and model routing.
  - https://docs.anthropic.com/en/docs/claude-code/llm-gateway
- Claude Code supports MCP integrations and explicit tool authorization boundaries.
  - https://docs.anthropic.com/en/docs/mcp
  - https://docs.anthropic.com/ru/docs/claude-code/sdk

### Windsurf Cascade
- Cascade supports web/documentation search and URL analysis with targeted context retrieval.
  - https://docs.windsurf.com/pt-BR/windsurf/cascade/web-search
- Cascade Arena can run multiple model instances in parallel, each with a separate Git worktree, and converge on a selected approach.
  - https://docs.windsurf.com/ro/windsurf/cascade/arena
- Cascade Hooks can run pre/post workflow checks, security controls, QA commands and governance actions around reads, writes, commands, MCP use and worktree setup.
  - https://docs.windsurf.com/de/windsurf/cascade/hooks

### Cline
- Cline documents parallel research subagents with isolated context windows, separate budgets and read-only exploration.
  - https://github.com/cline/cline/blob/main/docs/features/subagents.mdx
- Cline documents local and remote MCP servers.
  - https://github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx

### Roo Code
- Roo Code documents specialized modes such as Code, Architect, Ask, Debug and Orchestrator, plus custom modes and mode-specific tool access.
  - https://roocodeinc.github.io/Roo-Code/basic-usage/using-modes/
- Roo documents logical tool groups covering read/search/edit/image/command/MCP/workflow actions with mode-based access control.
  - https://roocodeinc.github.io/Roo-Code/advanced-usage/available-tools/tool-use-overview/
- Roo checkpoints use a shadow Git repository to support non-destructive experimentation and restore.
  - https://roocodeinc.github.io/Roo-Code/features/checkpoints/
- Roo supports project-level and global MCP configuration, including local and remote transports.
  - https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/

## Capability synthesis for AgentiCOS

| Capability area | Publicly documented pattern | AgentiCOS frontend treatment |
| --- | --- | --- |
| Agent modes | Agent/Ask/Plan/Debug plus specialized modes | Agent Mission Control mode selector |
| Multi-agent parallelism | Threads, worktrees, cloud/local parallel agents, Arena | Agent Teams + Subagents + Mission Control parallel lane |
| Worktree isolation | Cursor/Codex/Windsurf document Git worktrees | Git Control Center + Mission Control isolation selector |
| Background execution | Cloud agents and scheduled tasks | Background Agents + Cloud Agents + Automation surfaces |
| Browser verification | Browser screenshots, console/network inspection | Browser Workspace + Computer Use |
| Tool governance | Approval/autonomy modes and tool groups | Permissions Matrix + Tool Policy Studio + Mission Control |
| Persistent instructions | Rules / AGENTS.md / custom modes | Rules & Instructions + Knowledge Studio |
| Memory | Persistent memories and run history | Memory Studio + Knowledge Studio |
| MCP | External tools/data via MCP | MCP Manager + Marketplace + Mission Control tool scope |
| Checkpoints | Non-destructive snapshots and restore | Checkpoints + Run Control Center + Git Control Center |
| Evidence | Logs, screenshots, artifacts, PR review | Artifacts + Observability + Release Center |
| Model comparison | Playground/Arena-style parallel comparisons | Model Playground + Mission Control parallel mode |
| Hooks / governance | Pre/post hooks around risky workflow steps | Hooks & Policies + approvals + verification contracts |
| Scheduling | Automations and scheduled agents | Automations + Mission Control scheduling |
| Remote environments | Cloud VMs / SSH / isolated environments | Cloud Agents + Environments + Mission Control isolation |
| Session continuity | Resume/continue and project threads | Sessions + Command Center + recovery |

## Findings and implementation decisions

1. AgentiCOS already has most capability categories as separate surfaces. The main UX risk was fragmentation.
2. The missing orchestration layer was a single mission composer that makes the execution contract visible before launch. This is now implemented as **Agent Mission Control**.
3. Git lifecycle needed a dedicated control surface so branch/worktree/diff/checkpoint intent is not buried inside generic developer tooling. **Git Control Center** provides that layer.
4. The frontend keeps runtime truth outside leaf components. The new controls explicitly remain preview-only until typed Tauri/Rust services are connected.
5. Parallel-agent UX should use isolation as a first-class selection, not an implicit side effect.
6. Verification should be visible before launch: scope, policy, isolation, test plan and evidence package are represented as explicit preflight items.
7. Future backend adapters should map the Mission Control state into typed intent contracts rather than redesigning the UI.

## Remaining frontend expansion targets

The benchmark does not imply that every vendor-specific feature should be copied. The next useful additions are:
- unified task/terminal execution workspace;
- richer session branching and replay;
- artifact/evidence inspection;
- environment and remote-SSH workspace controls;
- deeper accessibility and visual verification surfaces;
- frontend contract coverage so every surface exposes loading/empty/error/offline/approval states consistently.

## Verification

This document is a research artifact. It does not claim runtime support for any vendor capability listed above. Current AgentiCOS frontend implementation remains presentation-first where no backend adapter exists.
