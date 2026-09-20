# AgentiCOS Universal Capability Platform

## Purpose

AgentiCOS must expose one runtime in which model providers, APIs, tools, MCP servers, browser backends, plugins, skills, memory providers, workflows, channels, schedules and external engines can be added without changing the canonical agent loop.

Hermes currently documents distinct plugin discovery sources, progressive-disclosure skills, pluggable memory providers, messaging channels, cron, ACP and an administrative dashboard. DeepSeek Harness documents scoped registration, an event-sourced session spine, explicit system-prompt assembly, a guarded tool registry and a swappable agent-loop composition. AgentiCOS adopts these architectural properties behind Rust-owned contracts. citeturn254296search0turn254296search3turn254296search5turn178395search0turn178395search2

## Capability registry

Every extensible capability has a versioned descriptor:

    CapabilityDescriptor
    ├── id
    ├── kind
    ├── version
    ├── provider
    ├── protocolVersion
    ├── lifecycle
    ├── dependencies
    ├── requiredCapabilities
    ├── configurationSchema
    ├── permissions
    ├── isolation
    ├── resourceLimits
    ├── compatibility
    └── provenance

Capability kinds:

- model-provider
- router-strategy
- tool
- toolset
- MCP-server
- browser-backend
- memory-provider
- skill
- workflow
- plugin
- channel
- webhook-handler
- schedule-provider
- artifact-backend
- sandbox-backend
- execution-worker
- engine-adapter
- surface-extension

The registry describes capabilities but never grants authority.

## Registration and lifecycle

    discover
      ↓
    parse descriptor
      ↓
    verify provenance/signature/license
      ↓
    resolve dependencies
      ↓
    negotiate protocol compatibility
      ↓
    evaluate requested capabilities
      ↓
    policy approval
      ↓
    isolated initialization
      ↓
    health check
      ↓
    transactional activation
      ↓
    publish capability snapshot

Activation is atomic from the host perspective. Failed activation must clean up registrations, listeners, timers, tasks and temporary state.

Deactivation stops new work, drains active work, persists required state, revokes capability handles, removes registry bindings and shuts down.

## APIs and provider abstraction

The architecture must support:

- hosted model APIs;
- local and self-hosted models;
- OpenAI-compatible endpoints;
- arbitrary HTTP APIs;
- OAuth-backed services;
- API-key pools and rotation;
- custom tool APIs;
- webhook sources;
- MCP servers;
- A2A agents;
- internal Rust services.

API access is represented as a provider plus a typed protocol adapter. Vendor SDKs never become part of the agent loop.

Providers are domain-specific implementations under a shared lifecycle:

    Provider
    ├── model
    ├── memory
    ├── search
    ├── browser
    ├── artifact
    ├── storage
    ├── sandbox
    └── channel

## Plugin architecture

Plugin classes:

1. Native host plugin — trusted/admitted code behind typed host APIs.
2. Isolated plugin — WASM, process, container or remote worker.
3. Remote capability — externally hosted service reached through a versioned protocol.

Discovery sources:

- bundled;
- user-level;
- workspace;
- project;
- installed registry;
- remotely discovered extensions.

Discovery precedence is explicit. Lower-trust sources cannot silently replace higher-trust capabilities. Activation requires compatibility, provenance, policy and health checks.

Plugins can contribute tools, hooks, commands, skills, providers, memory backends, channels, workflows, dashboard extensions, TUI widgets and other protocol-defined capabilities.

Hermes exposes plugin surfaces for tools, hooks, commands, skills, memory providers and UI/dashboard extensions; AgentiCOS generalizes these through the capability registry. citeturn254296search1turn254296search2turn178395search3

## Skills architecture

Skills are procedural knowledge, not executable authority.

Canonical skill package:

    skill/
      SKILL.md
      manifest
      references/
      templates/
      scripts/
      evaluations/

Lifecycle:

    discover metadata
      ↓
    rank/select
      ↓
    load full instructions on demand
      ↓
    validate dependencies/capabilities
      ↓
    execute with existing tools
      ↓
    record outcome/evaluation

Skills are progressively disclosed to control context growth. They are versioned, scoped, installable, disableable, testable and rollbackable. A skill cannot grant permissions merely by naming them.

Hermes explicitly uses skills as on-demand knowledge documents with progressive disclosure and agent-managed lifecycle. citeturn254296search3turn254296search6

## Memory architecture

Memory is a provider-backed subsystem with a built-in durable baseline.

    Memory Orchestrator
      ├── built-in memory
      ├── external providers
      ├── retrieval
      ├── reranking
      ├── consolidation
      ├── correction
      ├── deletion
      └── provenance

Memory scopes:

- profile;
- user;
- workspace;
- project;
- thread;
- run;
- skill/procedural.

Provider lifecycle:

    setup → health → prefetch → sync/write → consolidate → shutdown

Memory writes require a policy decision for whether model output is allowed to become durable knowledge. User-visible correction and deletion are first-class operations.

Hermes currently combines built-in memory with a selectable external provider and pre-turn prefetch/post-response synchronization. AgentiCOS generalizes this into a memory orchestrator while keeping provider choice outside the agent loop. citeturn254296search5

## Tool and toolset architecture

Each tool has two representations:

1. model-facing schema;
2. host-only execution metadata.

Host-only metadata includes timeout, scheduling hints, concurrency safety, presentation handlers, resource limits and capability requirements. It must never leak accidentally into model requests.

Tool pipeline:

    model call
      ↓
    registry lookup
      ↓
    input schema validation
      ↓
    policy evaluation
      ↓
    capability validation
      ↓
    sandbox/executor
      ↓
    canonical result
      ↓
    durable event
      ↓
    model-safe presentation

Toolsets are named groups that can be enabled or disabled by profile, workspace, project, channel or run.

DeepSeek Harness documents the separation between model-visible ToolSchema fields and host-only execution/presentation metadata and a guarded registry pipeline. AgentiCOS makes that separation a contract invariant. citeturn178395search2

## Hooks

Hooks are lifecycle observers/interceptors and cannot become hidden agent loops.

Hook phases:

- context build;
- model request;
- model response;
- tool call;
- tool result;
- persistence;
- artifact publication;
- run completion;
- failure;
- cancellation;
- shutdown.

Hooks are ordered, scoped, budgeted, fail-closed for security-sensitive stages and fully observable.

## Session and context architecture

Session history is append-only event data and the source of truth. Model messages are derived from the event stream rather than maintained as a second mutable store.

Session events must support:

- sequence;
- causation/correlation;
- turn and step lifecycle;
- model/tool-visible facts;
- compaction records;
- hook records;
- surface operations;
- replay;
- export;
- crash recovery.

DeepSeek Harness uses this event-sourced session model and derives message history from the session log. citeturn178395search0turn254296search9

## Channels and messaging gateway

The gateway is a transport plane, never a second agent runtime.

    inbound channel
      ↓
    normalize event
      ↓
    authenticate
      ↓
    authorize/pair
      ↓
    resolve profile + session
      ↓
    application protocol
      ↓
    durable run
      ↓
    render outbound event

Channel adapters declare authentication, pairing, rate limits, attachment limits, streaming capabilities, formatting capabilities and retry semantics.

Architectural channel categories include CLI, TUI, Web, Desktop, IDE/ACP, API, webhook, Telegram, Discord, Slack, Matrix, email, SMS and plugin-provided channels.

Hermes documents a long-running gateway with many platform adapters, authorization, pairing, command dispatch, hooks and background maintenance; its dashboard also manages channels, webhooks, MCP servers, memory, credentials, skills and cron. citeturn254296search0turn178395search3

## Webhooks and triggers

Webhooks are durable trigger sources.

Every webhook declares:

- route identity;
- authentication/signature;
- event filters;
- payload schema;
- replay protection;
- rate limits;
- target workflow/agent;
- delivery policy;
- audit record.

A webhook produces a durable trigger event. It never directly executes arbitrary model text.

## Scheduling

Scheduling is a first-class capability.

Supported semantics:

- one-shot;
- recurring;
- cron/calendar;
- pause;
- resume;
- edit;
- manual trigger;
- skill attachment;
- no-agent deterministic execution;
- delivery targets;
- isolated execution policy.

Hermes documents first-class scheduled agent tasks, skill attachment and a no-agent mode. AgentiCOS models both through the same durable job abstraction with an explicit execution mode. citeturn254296search4

## Profiles and configuration

Profiles isolate:

- credentials;
- model defaults;
- routing policy;
- toolsets;
- skills;
- memory;
- channels;
- workflows;
- schedules;
- permissions;
- filesystem roots;
- network policy.

Configuration precedence:

    built-in defaults
      → system
      → profile
      → workspace
      → project
      → run override
      → ephemeral step override

Security authority can only be attenuated by lower scopes. Widening authority requires an explicit policy transition.

## Management API

The application/management plane must expose typed operations for:

- providers and models;
- credentials and key pools;
- tools and toolsets;
- MCP servers;
- plugins;
- skills;
- memory providers;
- channels;
- webhooks;
- workflows and schedules;
- sessions and runs;
- artifacts;
- diagnostics;
- security audit;
- backup and restore.

The management API uses the same versioned application protocol and authorization model as runtime operations. It is not a privileged side door.

## IDE and ACP boundary

IDE integrations use a protocol adapter for:

- start/resume;
- event streaming;
- tool approvals;
- workspace context;
- artifacts;
- cancellation;
- steering.

The IDE never owns the agent loop. Hermes exposes editor-native agent integration over stdio/JSON-RPC; AgentiCOS keeps that concern at the protocol boundary. citeturn254296search0

## Extension failure isolation

Every extensible component must define startup failure, health degradation, timeout, retry, cancellation, drain, shutdown, recovery, duplicate handling and rollback behavior.

A failing plugin, provider, memory backend, channel or external engine must not corrupt unrelated runs.

## Non-negotiable architectural invariant

No new API, plugin, skill, memory backend, tool, channel or external engine should require a modification to the canonical agent loop merely to register itself.

The canonical loop consumes stable contracts and registries. Extensions implement those contracts.