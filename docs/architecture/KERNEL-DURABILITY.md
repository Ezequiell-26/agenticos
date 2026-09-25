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
- Inbox claims are transactionally deduplicated and stale processing claims can be recovered.
- Retryable operations have durable idempotency records and stale in-progress claims can be recovered.
- Run ownership uses leases and fencing tokens.
- Expired runs can be recovered after process restart.
- Interrupted cancellation closes active steps before the run becomes terminal.
- Usage is budget-checked before being committed.
- Workspace checkpoints retain integrity hashes and canonical relative paths.

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

## Publication semantics

1. Run event writes are persisted in the SQLite event store.
2. A SQLite trigger creates the matching runtime outbox row in the same transaction.
3. The background dispatcher atomically claims pending or expired entries.
4. The destination-aware transport publishes to the in-process runtime bus or an HTTP webhook.
5. Successful publication clears the claim and marks the entry published.
6. Failed publication clears the claim, increments the attempt count and returns the entry to the retry path until the configured dead-letter threshold.

A worker cannot finalize an entry after its lease expires or under another worker's claim. Consumers must still be idempotent because a crash can occur after external delivery and before the durable publish acknowledgement.

## Idempotency semantics

A durable idempotency key is bound to a stable fingerprint of the operation and input.

- completed -> cached result is returned;
- in-progress -> duplicate execution is rejected while the claim is fresh;
- stale in-progress -> the operation may be safely reclaimed;
- failed -> explicit retry is required;
- same key + different fingerprint -> hard validation failure.

## Production scaling boundary

SQLite is the first durable local/runtime backend. If AgentiCOS later requires very high concurrent write throughput or centralized multi-node service operation, implement the same kernel contracts with PostgreSQL rather than changing agent semantics.
