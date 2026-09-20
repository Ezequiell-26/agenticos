# AgentiCOS Persistence and Reliability Architecture

## Storage strategy

Canonical durable state lives in a transactional database.

Large binary artifacts use an artifact store.

Caches are disposable and never canonical.

```text
Canonical DB
├── identities
├── profiles
├── providers
├── projects
├── threads
├── runs
├── events
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

The runtime records append-oriented durable events for actions that must survive restarts. Materialized projections provide efficient queries for UI and search.

The event log is not a substitute for every relational query. The architecture intentionally separates canonical events from projections.

## Checkpointing

Long tasks may create checkpoints:
- before destructive file changes;
- after successful build/test;
- before deployment;
- before context compaction;
- before expensive subagent fan-out.

Checkpoints support recovery and rollback.

## Idempotency

Every external side effect that can be retried should have an idempotency strategy.

Examples:
- deployment ID;
- tool invocation ID;
- provider request ID where supported;
- artifact checksum;
- workflow action ID.

## Failure model

```text
provider failure → router fallback
tool failure     → tool retry/repair policy
child failure    → typed child result
UI disconnect    → run continues
process restart   → recover from durable state
storage failure  → fail closed / retry transaction
```

## Replay

The system must support replaying a run against recorded inputs and mock providers/tools for regression testing.

Replay must never accidentally invoke production credentials or destructive tools.

## Backup and migration

Persisted schemas use explicit version numbers and forward migrations.
Backups must include database, artifact index and configuration metadata required for recovery.