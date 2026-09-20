# AgentiCOS Durable Kernel

The production kernel foundation uses SQLite through better-sqlite3 behind AgentiCOS-owned contracts.

## Guarantees

- WAL journaling is enabled.
- SQLite foreign keys are enabled.
- synchronous=FULL is used for durable commits.
- Worker claims use BEGIN IMMEDIATE.
- Run state changes use optimistic version checks.
- State transitions are validated before writes.
- Run state changes and durable events are committed atomically.
- Durable events enter the outbox in the same transaction as their aggregate mutation.
- Inbox claims are transactionally deduplicated.
- Retryable operations have durable idempotency records.
- Run ownership uses leases and fencing tokens.
- Expired runs can be recovered after process restart.
- Interrupted cancellation closes active steps before the run becomes terminal.
- Usage is budget-checked before being committed.
- Workspace checkpoints retain integrity hashes.

## Runtime model

```text
Client
  ↓
DurableKernel
  ↓
DurableScheduler
  ↓
SqliteKernelStore
  ├── runs
  ├── steps
  ├── events
  ├── outbox
  ├── inbox
  ├── idempotency
  ├── leases
  └── checkpoints
```

## Worker lifecycle

```text
created
  ↓
admitted
  ↓
claimed + lease
  ↓
running
  ├── waiting
  ├── cancelling
  ├── completed
  └── failed
```

When a worker disappears, the lease expires. On restart, expired running runs move back to waiting. A cancelling run is recovered to cancelled and active steps are cancelled atomically.

## Outbox semantics

1. Aggregate mutation commits with the outbox record.
2. Dispatcher reads pending events.
3. Publisher sends the event.
4. Successful publication marks the outbox row published.
5. A publisher failure leaves the event pending for retry.

Consumers must be idempotent because publication can repeat after a crash between external delivery and markPublished.

## Idempotency semantics

A durable idempotency key is bound to a stable fingerprint of the operation and input.

- completed -> cached result is returned;
- in-progress -> duplicate execution is rejected;
- failed -> explicit retry is required;
- same key + different fingerprint -> hard validation failure.

## Production scaling boundary

SQLite is the first durable local/runtime backend. If AgentiCOS later requires very high concurrent write throughput or centralized multi-node service operation, implement the same kernel contracts with PostgreSQL rather than changing agent semantics.
