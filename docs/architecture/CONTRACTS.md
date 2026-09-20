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
## Rust-native conceptual traits

The architecture defines responsibilities separately so adapters do not become hidden
agent runtimes.

### AgentEngine

Owns the agent lifecycle and orchestration loop.

```rust
#[async_trait]
pub trait AgentEngine: Send + Sync {
    async fn start(&self, request: StartRun) -> Result<RunHandle, EngineError>;
    async fn continue_run(&self, request: ContinueRun) -> Result<RunHandle, EngineError>;
    async fn steer(&self, request: SteerRun) -> Result<(), EngineError>;
    async fn interrupt(&self, request: InterruptRun) -> Result<(), EngineError>;
}
```

### ModelProvider / ModelClient

Owns model transport and provider-specific translation. It is deliberately separate
from AgentEngine.

```rust
#[async_trait]
pub trait ModelProvider: Send + Sync {
    async fn describe(&self) -> Result<ProviderDescriptor, ProviderError>;
    async fn complete(&self, request: ModelRequest) -> Result<ModelResponse, ProviderError>;
    async fn stream(&self, request: ModelRequest) -> Result<ModelStream, ProviderError>;
    async fn health(&self) -> ProviderHealth;
}
```

Provider adapters translate vendor formats into the canonical model protocol. The
agent loop never depends on a specific vendor SDK.

### AgentTool

Defines typed tool invocation plus the capability boundary.

```rust
#[async_trait]
pub trait AgentTool: Send + Sync {
    fn descriptor(&self) -> &ToolDescriptor;
    async fn validate(&self, input: ToolInput) -> Result<ValidatedToolInput, ToolError>;
    async fn execute(
        &self,
        ctx: ToolExecutionContext,
        input: ValidatedToolInput,
        capability: CapabilityHandle,
    ) -> Result<ToolOutput, ToolError>;
}
```

The tool receives an issued capability handle; possession of the handle is not
sufficient to bypass policy because the executor revalidates it.

### ContextCompressor

Owns one compression/normalization strategy.

```rust
#[async_trait]
pub trait ContextCompressor: Send + Sync {
    fn descriptor(&self) -> CompressorDescriptor;
    async fn compress(
        &self,
        input: ContextPayload,
        policy: CompressionPolicy,
    ) -> Result<CompressionResult, CompressionError>;
    async fn recover(&self, reference: RecoveryReference) -> Result<ContextPayload, CompressionError>;
}
```

The descriptor records loss class, supported representations, protected-content
behavior, deterministic guarantees and optimizer version.

### ContextEncoder

```rust
pub trait ContextEncoder: Send + Sync {
    fn can_encode(&self, input: &StructuredContext) -> bool;
    fn encode(&self, input: &StructuredContext, session: Option<&ContextSession>)
        -> Result<EncodedContext, EncodingError>;
    fn decode(&self, payload: &EncodedContext) -> Result<StructuredContext, EncodingError>;
}
```

### EventStore / SnapshotStore

```rust
#[async_trait]
pub trait EventStore: Send + Sync {
    async fn append(&self, stream: StreamId, expected_version: u64, events: Vec<Event>)
        -> Result<u64, StorageError>;
    async fn read_after(&self, stream: StreamId, after_version: u64)
        -> Result<Vec<Event>, StorageError>;
}

#[async_trait]
pub trait SnapshotStore: Send + Sync {
    async fn put(&self, snapshot: Snapshot) -> Result<(), StorageError>;
    async fn latest(&self, stream: StreamId) -> Result<Option<Snapshot>, StorageError>;
}
```

Additional storage traits cover projections, leases, idempotency and outbox state.

### CapabilityIssuer

```rust
#[async_trait]
pub trait CapabilityIssuer: Send + Sync {
    async fn issue(
        &self,
        request: CapabilityRequest,
        parent: ParentCapability,
    ) -> Result<CapabilityHandle, CapabilityError>;
    async fn consume(&self, handle: CapabilityHandle) -> Result<(), CapabilityError>;
    async fn revoke(&self, handle: CapabilityHandle) -> Result<(), CapabilityError>;
}
```

The exact Rust types are contract placeholders until the corresponding crate exists,
but these ownership boundaries are architectural invariants.

## Extensibility contracts

### CapabilityRegistryContract

Owns discovery and lifecycle of runtime-extensible capabilities.

Required semantics:
- discover;
- inspect;
- verify provenance/license;
- resolve dependencies;
- negotiate compatibility;
- activate transactionally;
- health-check;
- deactivate/drain;
- rollback.

The registry does not grant authority.

### SkillContract

Skills are versioned procedural knowledge packages loaded progressively. A skill may declare tools, dependencies, triggers, references, templates, scripts and evaluations, but cannot grant permissions.

### MemoryProviderContract

A memory provider supports setup/health/prefetch/sync/search/update/delete and optional consolidation. It receives scoped access and cannot widen persistence authority.

### ChannelContract

A channel adapter normalizes inbound events and renders outbound events. It declares authentication, authorization/pairing, streaming, attachment and rate-limit capabilities.

### WebhookContract

A webhook is an authenticated, replay-protected durable trigger source with a payload schema, event filter and delivery policy.

### HookContract

Hooks are ordered, scoped lifecycle observers/interceptors with explicit budgets, cancellation and observability. A hook cannot create a hidden agent loop.

### ContextEngineContract

The context engine deterministically assembles policy, instructions, skills, memory, workspace context, session history, tool schemas and model constraints under an explicit token budget. It preserves provenance and recovery references.

### SessionPersistenceContract

Session persistence backends implement append, checkpoint, recovery, integrity verification, replay, search/projection and export behind one logical event-stream contract.

### ScopeContract

A scoped registration boundary owns everything registered inside it and can dispose/drain that owned state without leaking registrations into other profiles, agents or runs.

### JobSchedulerContract

The scheduler persists jobs and produces/resumes durable Runs. It supports one-shot/recurring scheduling, pause/resume, manual trigger, retry and execution-mode selection without embedding the agent loop.

### ToolRegistryContract

The tool registry owns discovery, schema collection, availability, dispatch and guarded execution. Host-only scheduler/security/presentation fields must not leak into model-facing schemas.

## Contract composition rule

The canonical AgentEngine consumes these contracts. It does not implement provider discovery, plugin lifecycle, memory persistence, channel transport, scheduling or skill storage internally.

New integrations should implement or compose existing contracts instead of adding vendor-specific branches to the canonical loop.

