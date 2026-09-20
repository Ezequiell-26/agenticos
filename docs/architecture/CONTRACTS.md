# AgentiCOS Core Contracts

These are conceptual contracts for the first implementation. Exact language-specific types may differ, but semantics must remain compatible.

## Event envelope

```text
Event
├── eventId
├── type
├── version
├── timestamp
├── workspaceId
├── projectId
├── runId
├── threadId
├── actorId
├── parentEventId
├── durable
└── payload
```

All cross-domain events carry correlation identifiers.

## ProviderContract

```text
ProviderContract
├── identity
├── capabilities
├── credentialRequirements
├── modelCatalog
├── healthCheck
├── chat/request
├── stream/request
├── structuredOutput
├── toolCalling
└── usage/cost metadata
```

The provider adapter owns vendor translation.

## RouterContract

Input:
- task requirements;
- candidate provider/model set;
- routing policy;
- health state;
- quota state;
- budget state;
- user override.

Output:
- selected provider/model;
- ordered fallback candidates;
- reasons/evidence;
- estimated cost/latency;
- routing decision ID.

## AgentContract

```text
AgentContract
├── createRun
├── continueRun
├── steerRun
├── interruptRun
├── delegate
├── requestTool
├── publishArtifact
└── complete
```

An agent cannot bypass the runtime's policy, provider or tool contracts.

## EngineContract

External engines expose:
- engine identity/version;
- capability list;
- run create/read;
- event stream;
- tool bridge;
- approval bridge;
- artifact bridge;
- cancellation;
- health;
- resource usage.

This contract allows Hermes-like, Harness-like or Codex-like execution engines to participate without becoming the product's canonical client model.

## ToolContract

```text
Tool
├── identity/version
├── inputSchema
├── outputSchema
├── capabilities
├── permissions
├── environmentRequirements
├── timeout
├── resourceLimits
├── idempotency
├── execute
└── auditMetadata
```

## SandboxContract

The sandbox receives an execution request plus policy.

Policy includes filesystem, network, process, environment, credential and resource rules.

Output includes stdout/stderr, exit status, files/artifacts, resource usage and audit identifiers.

## MemoryContract

```text
Memory
├── write
├── retrieve
├── update
├── delete
├── search
├── scope
└── provenance
```

Memory records are scoped to user, profile, project, thread or run.

## SkillContract

A skill exposes:
- metadata;
- trigger/selection hints;
- bounded instructions;
- dependencies;
- required tools;
- compatible providers/capabilities;
- optional scripts;
- version.

Skills are loaded progressively.

## WorkflowContract

A workflow defines:
- trigger;
- ordered/parallel steps;
- conditions;
- assigned agent;
- tool permissions;
- retry policy;
- timeout;
- approval gates;
- artifact outputs.

A workflow run is durable and independently resumable.

## ArtifactContract

```text
Artifact
├── artifactId
├── type
├── sourceRunId
├── parentArtifacts
├── mediaType
├── checksum
├── location
├── provenance
├── permissions
└── retention
```

## PluginContract

A plugin declares:
- plugin ID/version;
- API compatibility;
- dependencies;
- capabilities;
- configuration schema;
- permissions;
- contributed services;
- activation/deactivation hooks.

Activation is transactional from the host's perspective: partial activation is cleaned up and cannot leave orphaned registrations.

## ProtocolContract

The application protocol is a typed bidirectional contract shared by all clients.

Core resource families:
- workspace;
- project;
- task/run;
- thread;
- turn;
- item;
- provider/model;
- tool;
- skill;
- workflow;
- artifact;
- plugin.

The protocol must be versioned and capable of capability negotiation.

## Contract rule

If two modules communicate through internal concrete classes rather than one of the defined contracts, the architecture should treat that dependency as a candidate for extraction into a contract.