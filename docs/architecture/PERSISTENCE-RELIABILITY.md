# AgentiCOS Persistence and Reliability Architecture

## Storage strategy

Canonical durable runtime state is stored in transactional SQLite through the AgentiCOS-owned kernel contracts. Large binary artifacts use a separate artifact store. Caches are disposable and never canonical.

```text
Transactional SQLite
├── runs
├── steps
├── events
├── outbox
├── inbox
├── idempotency
├── leases
└── checkpoints

Future/optional domain persistence
├── identities
├── profiles
├── projects
├── threads
├── memory
├── skills
├── workflows
├── plugins
├── usage
└── audit

Artifact Store
└── files/blobs/media
```

## Event log + snapshot model

AgentiCOS uses an **append-only event log plus periodic snapshots**, not final-state-only persistence.

The canonical durable history of a Run contains immutable events such as:

```
RunCreated
TurnStarted
ModelRequestIssued
ModelResponseRecorded
StepStarted
ToolCapabilityGranted
ToolInvoked
ToolResultRecorded
ArtifactPublished
ChildRunSpawned
ApprovalRequested
ApprovalResolved
StepCompleted
TurnCompleted
RunPaused
RunResumed
RunFailed
```

Each event has a monotonic per-stream sequence number, event ID, causal parent IDs,
schema version and durable payload. Wall-clock timestamps are metadata, not the
ordering authority.

Snapshots are derived acceleration points. They contain the materialized state,
the last applied event sequence and a snapshot schema/version. Recovery loads the
newest valid snapshot and replays subsequent events.

This produces deterministic state reconstruction without requiring every restart
to replay the complete history.

## Concurrency and actor ownership

The runtime uses an actor-like ownership model for **durable Run state**:

```
Run mailbox
   ↓
single logical state owner
   ↓
validated transition
   ↓
append event(s)
   ↓
update projection/snapshot
```

Workers may execute tools/models in parallel, but durable Run state is mutated
through the owning state machine. Parallel work emits events back to that owner.

For fan-out/fan-in, events include parent/child causality IDs and per-stream sequence
numbers. Replay therefore reconstructs the same logical state transitions without
depending on nondeterministic thread scheduling.

The architecture does not require every internal component to become a separate
actor. Actor ownership is used where serialized state mutation prevents races;
stateless or read-heavy components may remain ordinary services.

## Checkpointing

Long tasks can create integrity-checked workspace checkpoints before destructive changes, expensive fan-out, compaction or promotion.

Checkpoint data is scoped to the owning run and workspace.

## Idempotency

Retryable external side effects should carry idempotency keys. Durable keys store an operation fingerprint and status, preventing concurrent duplicate execution and rejecting key reuse for different inputs.

## Outbox / Inbox

The outbox provides at-least-once publication. An event remains pending until successful publication is acknowledged in storage. Consumers claim events transactionally and record completion, so duplicate deliveries do not execute the same consumer work concurrently.

## Failure model

```text
provider failure  → router fallback
tool failure      → retry/repair policy
child failure     → typed child result
UI disconnect     → run continues
worker crash      → lease expires
process restart   → recovery scan
cancelling crash  → active steps cancelled + run cancelled
storage failure   → transaction rollback / fail closed
```

## Budget enforcement

Durable Runs persist execution budgets and usage. Usage updates are rejected when duration, steps, child-agent count, tool calls, tokens or cost exceed the configured limits.

## Replay and deterministic external effects

Replay is defined as **logical re-execution from recorded inputs**, not as a second
live execution against the world.

For nondeterministic external boundaries, the original response/effect record is
stored or replaced by a deterministic replay adapter:

- provider request/response;
- tool request/result;
- browser observations;
- filesystem mutation result;
- network operation metadata;
- approval decisions;
- scheduler decisions where ordering matters.

A replay can therefore choose:

```
recorded effect → inject recorded result
or
deterministic adapter → recompute controlled result
```

Destructive live side effects are denied by default during replay.

Replay must be able to verify event sequence, schema versions, checksums and causal
relationships before applying events.

## Storage abstraction

The runtime never depends directly on SQLite, PostgreSQL or a file format.

Core persistence ports are:

```text
EventStore
SnapshotStore
ProjectionStore
IdempotencyStore
LeaseStore
OutboxStore
ArtifactMetadataStore
```

The initial production adapter is transactional SQLite for local/desktop/CLI
durability. Remote deployments can use a transactional PostgreSQL adapter or a
server-backed persistence service behind the same contracts.

An in-memory implementation exists only for deterministic tests.

Binary/JSON serialization is a codec concern, not the storage abstraction. The
authoritative state model remains typed events/snapshots with versioned schemas.

## Migration and backup

The database has an explicit schema version and a migration boundary. Production backup/restore operations must include the SQLite database plus the artifact metadata required to reconstruct durable state.

The current kernel intentionally keeps storage behind AgentiCOS-owned contracts so a future PostgreSQL backend can replace SQLite without changing Run/Step semantics.
