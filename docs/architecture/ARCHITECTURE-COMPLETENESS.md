# AgentiCOS — Architecture Completeness Addendum

## Purpose

This document closes the remaining architectural seams required for a universal agent runtime capable of hosting the reusable capability set demonstrated by Hermes Agent, DeepSeek Harness and the existing AgentiCOS reference corpus.

This is architecture only. No feature is considered implemented merely because its contract exists.

## Canonical platform planes

1. Control
2. Identity and policy
3. Model/API
4. Agent
5. Tool
6. Execution and sandbox
7. Context
8. Memory and knowledge
9. Skills and workflows
10. Multi-agent
11. Interoperability
12. Channels/application
13. Artifacts and media
14. Observability/evaluation
15. Source Forge
16. Change plane
17. Operations/distribution

Cross-cutting infrastructure:

- identity;
- capabilities;
- persistence;
- provenance;
- versioning;
- cancellation;
- quotas/budgets;
- recovery;
- audit.

## 1. Auxiliary Model Plane

The model platform is split into independently routable model roles:

- primary inference;
- auxiliary reasoning;
- vision;
- summarization;
- classification;
- metadata extraction;
- repair/review;
- embedding;
- reranking.

Auxiliary calls use the same ModelProvider contract but separate routing policy, budget ledger, health and caching policy. An auxiliary operation can never bypass the parent Run's authority or budget.

## 2. Persistent Terminal and PTY Plane

Terminal execution is a distinct capability from one-shot process execution.

Required concepts:

- terminal;
- process;
- PTY;
- background job;
- remote terminal;
- sandbox terminal;
- terminal owner;
- terminal lease.

Lifecycle:

`open → attach → read/write → resize/signal → detach → close`

A persistent terminal is durable enough to recover ownership metadata and safely terminate orphaned execution, but its live PTY bytes are not treated as the authoritative Run state.

## 3. Background Job Runtime

All background execution uses one JobRuntime:

- process jobs;
- terminal jobs;
- subagent jobs;
- workflow jobs;
- scheduled jobs.

The JobRuntime owns:

- identity;
- owner Run/Step;
- lifecycle;
- output;
- cancellation;
- deadlines;
- concurrency;
- resource limits;
- cleanup;
- recovery;
- completion delivery.

The scheduler creates/resumes jobs; the JobRuntime executes them. Neither embeds the AgentEngine loop.

## 4. Filesystem Change Plane

Filesystem mutation uses explicit intent and observation:

`observe → intent → authorize → mutate → observe-after → verify → commit/rollback`

The plane supports:

- read-before-write;
- optimistic concurrency;
- file identity/version;
- external-change detection;
- path normalization;
- snapshots;
- structural and textual diffs;
- rollback;
- mutation provenance;
- atomic writes;
- recovery after process interruption.

An edit may be rejected when the observed file version is stale.

## 5. Spill Store

Large tool outputs and intermediate data are retained outside model context.

`Tool → classify → inline or spill → artifact/locator → selective retrieval`

SpillStore supports:

- put;
- get;
- range;
- search;
- checksum;
- retention;
- expiration;
- provenance;
- trust-boundary isolation.

The model receives a bounded representation and a retrievable locator when policy permits.

## 6. Attachment and Multimodal Plane

Attachments are first-class durable artifacts.

Kinds include:

- image;
- audio;
- video;
- document;
- archive;
- structured data;
- arbitrary binary.

Pipeline:

`ingest → classify → checksum → store → inspect → transform → capability check → model/artifact use`

The plane exposes MIME/type detection, size limits, previews/thumbnails, media metadata, transcription/transformation providers and provider capability negotiation.

## 7. Code Intelligence Plane

Coding agents use a provider abstraction for:

- LSP;
- diagnostics;
- symbols;
- definitions;
- references;
- hover;
- rename;
- code actions;
- formatting;
- language-server lifecycle.

The agent consumes a stable CodeIntelligence contract while concrete language servers remain replaceable processes/providers.

## 8. Goal, Plan, Task and TODO Plane

The object hierarchy is explicitly:

`Goal → Plan → Task → TODO → Run → Step`

Semantics:

- Goal: desired outcome;
- Plan: proposed strategy;
- Task: bounded unit of work;
- TODO: operational progress projection;
- Run: durable execution instance;
- Step: execution unit.

Planning has explicit states:

`draft → proposed → awaiting-approval → approved → executing → revised → completed/cancelled`

Plan approval does not grant execution authority; it only changes workflow state.

## 9. Agent Team Plane

Multi-agent execution distinguishes child agents from durable teams.

A Team owns:

- members;
- roles;
- shared task board;
- assignment;
- messaging;
- waiting;
- interruption;
- shared artifacts;
- aggregated budgets;
- authority inheritance;
- lifecycle and recovery.

Team members remain independent Run principals and cannot widen authority through peer messages.

## 10. Complete MCP Plane

MCP is modeled as:

- tools;
- resources;
- resource templates;
- prompts;
- subscriptions where supported;
- discovery;
- handshake;
- capability negotiation;
- authentication;
- authorization;
- lifecycle;
- transport adapters.

Transport adapters remain replaceable:

- stdio;
- SSE;
- Streamable HTTP;
- future supported transports.

MCP resources are model/context inputs, not privileged storage shortcuts.

## 11. Complete A2A Plane

A2A interoperability includes:

- agent identity;
- Agent Card;
- advertised skills/capabilities;
- authentication;
- authorization;
- task submission;
- task status;
- messages;
- streaming;
- artifacts;
- cancellation;
- delegation;
- remote trust policy.

Remote agents are external principals and never receive ambient authority.

## 12. Credential and Account Plane

Credentials are separate from providers and accounts.

Canonical objects:

`Credential → Account → Provider → Endpoint → Model`

The CredentialManager supports:

- API keys;
- OAuth access/refresh tokens;
- rotation;
- expiry;
- revocation;
- encryption;
- redaction;
- pool membership;
- provider health association;
- cooldown;
- concurrency limits;
- audit.

Credential selection happens after policy evaluation and never exposes secret material to general model context.

## 13. Profile and Scope Isolation

A Profile is a top-level trust/configuration boundary.

A Scope can be:

- system;
- profile;
- workspace;
- project;
- agent;
- run;
- step.

Each scope owns registrations and resources it creates. Disposal drains work and removes registrations. A child scope cannot mutate a parent scope without an explicit parent capability.

## 14. Prompt and Context Stability Plane

Context assembly is divided into:

- stable policy;
- stable capability/tool description;
- workspace/project context;
- skills;
- memory/profile state;
- session-derived context;
- volatile runtime state;
- ephemeral request overlay.

Only declared sections may mutate at each lifecycle stage. A low-trust dynamic source cannot replace a higher-trust policy section.

Prompt-cache identity is derived from the stable portion; ephemeral overlays are excluded from reusable identity.

## 15. Trajectory Plane

Runs can produce normalized trajectories for evaluation and training:

`event log → trajectory compiler → redaction → normalized record → export`

Trajectory records can include:

- prompts;
- model outputs;
- tool calls/results;
- environment observations;
- artifacts;
- evaluations;
- outcome;
- latency/cost;
- provenance.

Trajectory export must support redaction and policy-controlled retention.

## 16. Supervisor and Watchdog Plane

Long-running deployments require a supervisor that monitors:

- startup progress;
- worker heartbeat;
- provider stalls;
- plugin hangs;
- terminal leaks;
- orphaned processes;
- queue starvation;
- resource exhaustion;
- shutdown progress.

Supervisor actions are policy-driven:

- warn;
- cancel;
- isolate;
- restart worker;
- quarantine extension;
- recover durable Run.

Automatic recovery must never silently broaden permissions.

## 17. Migration and Configuration Evolution

Versioning applies to:

- database schemas;
- event schemas;
- protocol schemas;
- provider configuration;
- profile configuration;
- plugin manifests;
- skill manifests;
- workflow definitions;
- memory schemas.

Migrations follow:

`backup → validate → migrate → verify → activate → rollback-on-failure`

## 18. Feature and Capability Flags

Feature availability and authority are separate concepts.

- Feature flag: whether a feature is exposed.
- Capability grant: whether an actor may use it.

Flags support global/profile/workspace/project/run scope, staged rollout and rollback. Security permissions cannot be expressed only as feature flags.

## 19. Package, Update and Distribution Plane

Distributable components include:

- plugins;
- skills;
- provider adapters;
- engine adapters;
- runtime releases.

Lifecycle:

`discover → verify → stage → install → activate → health-monitor → promote/rollback`

Package metadata contains:

- version;
- checksum;
- signature/provenance;
- protocol compatibility;
- dependencies;
- source/license metadata;
- migration requirements.

## 20. Change Plane for AI-generated modifications

All AI-generated repository changes pass through:

`request → scope lock → reference evidence → contract impact → dependency impact → security/license impact → deterministic checks → diff review → artifact snapshot → promotion`

No AI actor receives a permanent implicit write path to protected production surfaces.

The Change Plane tracks:

- change ID;
- parent request;
- agent/actor;
- affected contracts;
- affected files;
- reference evidence;
- test evidence;
- approvals;
- rollback snapshot;
- final disposition.

## 21. Management and Admin Plane

Administration is a typed protocol, not a backdoor.

It manages:

- providers;
- credentials;
- pools;
- models;
- tools/toolsets;
- MCP/A2A;
- plugins;
- skills;
- memory;
- channels;
- webhooks;
- jobs;
- profiles;
- sessions;
- workers;
- sandboxes;
- policies;
- artifacts;
- logs/metrics;
- evaluations;
- backups/migrations;
- updates.

Every management operation is authenticated, authorized, audited and versioned.

## 22. Architectural invariants added by this addendum

1. AgentEngine does not own provider discovery, plugin loading, memory storage, channel transport, scheduler implementation or filesystem mutation.
2. One-shot processes, persistent terminals and background jobs are separate abstractions.
3. Large outputs may spill to durable storage without being injected wholesale into context.
4. Attachments are artifacts with explicit model capability checks.
5. Filesystem mutations use observed-version protection.
6. Child agents and Teams have distinct lifecycle semantics.
7. MCP resources/templates are first-class.
8. Remote A2A agents are untrusted principals.
9. Credential identity is separate from provider/model identity.
10. Scopes own their registrations and cleanup.
11. Prompt stability is a contract, not a convention.
12. Trajectories are derived artifacts, not the Run source of truth.
13. Long-running services have watchdog/supervisor semantics.
14. Configuration evolution has transactional migration semantics.
15. Security authority cannot be encoded only as a feature flag.
16. Package activation is staged and reversible.
17. AI-generated changes use a dedicated Change Plane before promotion.

## Completion rule

The architecture baseline is complete only when every invariant above has:

- an owner;
- a versioned contract;
- a protocol/schema where cross-boundary;
- a state model;
- security boundary;
- persistence/recovery semantics;
- observability requirements;
- verification requirements;
- reference evidence mapping.

Existence of the contract does not mean the capability is implemented.
