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

## Event sourcing boundary

The runtime records append-oriented durable events for actions that must survive restarts. Materialized projections remain separate from canonical state.

Run mutations and their corresponding durable events/outbox records are committed in one SQLite transaction.

## Concurrency

Worker claims use BEGIN IMMEDIATE transactions. Run versions are checked optimistically. Leases carry monotonically increasing fencing tokens so an expired worker cannot continue as the current owner.

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

## Replay

The durable event timeline can be read per Run. Replay remains restricted to recorded logical inputs, mocked providers/tools and non-destructive execution.

## Migration and backup

The database has an explicit schema version and a migration boundary. Production backup/restore operations must include the SQLite database plus the artifact metadata required to reconstruct durable state.

The current kernel intentionally keeps storage behind AgentiCOS-owned contracts so a future PostgreSQL backend can replace SQLite without changing Run/Step semantics.
