# AgentiCOS Product Blueprint

## Product definition

AgentiCOS is a **universal, model-agnostic agent operating layer** for turning user objectives into durable, observable and verifiable work.

It is not limited to chat. A conversation is one control surface for a broader execution platform.

The product should let a user define an objective, provide a workspace or project boundary, choose an agent policy, let the runtime plan and execute work, inspect actions and evidence, intervene or pause, resume later, review artifacts, reuse successful procedures as skills/workflows, and schedule capabilities for future execution.

## Core execution promise

```
Intent
  ↓
Admission + Policy
  ↓
Context + Planning
  ↓
Agent execution
  ├── Models
  ├── Tools
  ├── Browser / computer
  ├── Files / Git
  ├── APIs / MCP
  └── Child agents
  ↓
Verification
  ↓
Artifacts + Evidence
  ↓
Durable result
```

The user should be able to understand **what happened, what changed, what was verified and what remains uncertain**.

## Capability map

### Agent workspace
Expose objective/status, plan, model/provider, tools, approvals, child agents, events, token/cost/quota usage, artifacts, verification findings and recovery state.

The UI consumes structured runtime events; it does not infer execution state from model prose.

### Coding and software engineering
Support repository inspection, architecture analysis, code search, bounded editing, Git operations, test/build execution, static analysis, dependency work, migration planning, bug diagnosis/repair, patch generation, diff review, regression verification and deployment adapters.

### Research and knowledge work
Support source retrieval through approved tools, provenance, evidence collection, structured extraction, comparison, synthesis, uncertainty tracking and citation-aware artifacts.

### Browser and computer use
Support policy-controlled navigation, form interaction, screenshots, uploads/downloads, DOM/accessibility inspection and isolated computer interaction where available.

### Files, media and artifacts
Treat source files, patches, documents, spreadsheets, presentations, images, audio, video, archives, structured data, reports and verification bundles as durable artifacts with provenance and lifecycle state.

### Memory and personalization
Separate memory by platform, workspace, user, project, thread and run. Support history, project memory, user preferences, explicit facts, procedural memory, retrieval/reranking, compaction, provenance/confidence and user-visible deletion/correction.

Model output must not silently become durable memory without the applicable policy.

### Skills
Provide versioned procedural capabilities with metadata, permissions, instructions, examples/evaluations, provenance and compatibility. Skills can be installed, disabled, upgraded, tested and rolled back.

### Workflows and automation
Support deterministic and agentic steps with triggers, schedules, budgets, retries, approvals, idempotency and observable run history.

Examples include project audits, recurring research, repository health checks, report generation, monitoring and multi-stage content pipelines.

### Multi-agent execution
Support delegation, isolated child runs, parallel fan-out/fan-in, DAG execution, reviewer/critic agents, specialist agents, budget propagation and failure containment.

Child agents cannot silently acquire more authority than their parent policy grants.

### Universal provider platform
Support hosted, free-tier, paid, local, self-hosted and compatible custom endpoints. Routing considers capability, health, latency, quota, cost and user policy.

Paid fallback is never silently enabled when policy forbids it.

### Interoperability
Use explicit adapters for MCP, A2A, external agent engines, plugin protocols and the application API, with Python and TypeScript SDKs around versioned boundaries.

### Source Forge
Import repository snapshots, pin commits, audit licenses/dependencies, build provenance/SBOM data, extract architecture and capabilities, compare implementations, detect duplicates, propose integrations, generate adaptation scaffolding, preserve notices, track upstream changes and run regression checks.

Imported code never becomes product code merely because it was downloaded.

### Security and governance
Expose explicit controls for tool permissions, filesystem/network scope, process execution, secrets, browser access, provider/model access, child-agent authority, plugin trust, scheduled automation and data retention.

Model text alone never grants privileged capability.

### Observability and evaluation
Every durable run should provide structured evidence about initiation, policy, model/provider selection, tool actions, permissions, changes, verification, failures, retries, resource usage and replayability.

Ship golden tasks, replay fixtures, fault injection and regression evaluation.

## Product surfaces

```
                         AGENTICOS RUNTIME
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
     Developer                User                 Automation
        │                       │                        │
   CLI / TUI / IDE       Web / Desktop / Chat      API / SDK / Cron
        │                       │                        │
        └───────────────────────┼────────────────────────┘
                                │
                     Application Protocol
                                │
                         Agent Runtime
```

The same durable runtime backs every surface.

## Product modes

- **Interactive** — real-time execution with streaming events and user steering.
- **Background** — durable execution after client disconnect.
- **Scheduled** — cron, event or condition triggered.
- **Parallel** — bounded child-agent execution.
- **Review** — verification/reviewer stages before publication.
- **Headless** — server, worker and CI execution without a graphical client.

## Deployment modes

Support local single-user, desktop, self-hosted server, containerized workers, remote worker pools, managed hosting and team/workspace deployments.

Local use must not require a cloud control plane.

## Scope maturity

### Foundation
Kernel, contracts, execution model, providers, tools, security, persistence and one complete usable surface.

### Platform
Memory, skills, workflows, multi-agent, MCP/A2A, artifacts, observability and evaluation.

### Ecosystem
Plugins, SDKs, engine adapters, Source Forge, remote workers and distribution.

### Advanced
Adaptive routing, richer multimodal execution, advanced computer use and distributed orchestration.

A feature enters implementation only when its contract, state model, security boundary, persistence behavior and verification strategy are documented.
