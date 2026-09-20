# AgentiCOS Product Blueprint

## Product surfaces

AgentiCOS is one runtime exposed through multiple surfaces.

```text
                         AGENTICOS RUNTIME
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
         Developer           User               Automation
            │                   │                   │
        CLI/TUI/IDE       Web/Desktop/Chat       API/SDK/Cron
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                         Application Protocol
```

## User-facing product areas

### Workspace
Home for projects, tasks, agents, providers, skills and artifacts.

### Projects
A project contains repository intelligence, instructions, memory, active skills, environments and task history.

### Tasks
A task is the user's durable objective. It can run synchronously or asynchronously.

### Agent Workspace
Shows plan, current action, model/provider, tools, child agents, approvals, logs and artifacts.

### Agents
Users can run a general agent, specialized agents or custom agents.

### Provider Center
Users can connect free-tier, paid, local and custom providers, manage credentials, inspect models, budgets and health.

### Skills
Users can install, inspect, enable, disable and version reusable procedural capabilities.

### Workflows
Users can define recurring or repeatable multi-step automations with schedules, triggers, approvals and outputs.

### Artifacts
Users can inspect generated files, diffs, media, reports, recordings and other structured outputs.

### Source Forge
Developers can import repositories, audit them, compare implementations and produce integration proposals.

## Core experiences

### Interactive task
User gives an objective and watches the agent work in real time.

### Background task
User starts a task, closes the app and later reconnects to its durable state.

### Parallel task
The runtime creates isolated child agents for independent workstreams.

### Project maintenance
The agent scans a project, identifies work, fixes issues, runs verification and records artifacts.

### Research
The agent searches, collects sources, evaluates evidence and produces a structured artifact.

### Build
The agent plans, edits, tests, repairs and packages software.

### Automation
A workflow triggers one or more agents and tools with explicit permissions.

## Product-level state

```text
User
 ↓
Profile
 ↓
Workspace
 ↓
Project
 ↓
Task
 ↓
Run
 ↓
Artifacts / Memory / Events
```

## Product navigation

```text
Workspace
├── Overview
├── Projects
├── Tasks
├── Agents
├── Providers
├── Skills
├── Workflows
├── Artifacts
├── Activity
├── Settings
└── Developer
    ├── Plugins
    ├── MCP
    ├── Source Forge
    ├── API
    └── Diagnostics
```

## Product principle

The UI should show what the agent is doing through structured state, events and artifacts rather than attempting to infer progress from model text.

## Free-tier and paid providers

The Provider Center treats provider accounts as user-owned configuration. A provider may be free-tier, paid, local or custom.

Routing policy is explicit and visible to the user. A free-first policy may automatically move to another compatible provider when a quota or rate limit is reached. Paid fallback is never implicit when the user has disabled paid usage.

## Commercialization boundary

AgentiCOS architecture does not require a specific business model. Personal/local use, self-hosted deployment, managed hosting and team deployments can share the same runtime contracts.