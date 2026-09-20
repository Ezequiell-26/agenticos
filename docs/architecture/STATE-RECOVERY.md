# AgentiCOS State, Concurrency and Recovery

## State machines

Durable entities use explicit legal transitions. Terminal states are immutable unless an explicit migration or repair operation exists.

The initial runtime implementation provides a strict RunStateMachine.

## Ownership

Long-running work is protected by leases and monotonically increasing fencing tokens. A worker that loses its lease cannot continue writing as the current owner.

## Idempotency

Retryable side effects carry operation keys and stable input fingerprints. Reusing a key with a different operation is rejected.

## Outbox / inbox

State mutations that publish durable events must commit state and an outbox record atomically in the production persistence adapter. Consumers deduplicate through an inbox record.

The repository currently includes in-memory reference implementations for contract tests.

## Recovery

Recovery order:

durable state
  ↓
last committed event
  ↓
checkpoint
  ↓
owned lease
  ↓
resume / compensate / abort

A disconnected client is not a run termination signal.

## Side effects

Every retriable side effect must declare its retry semantics. Irreversible operations require explicit policy/approval and must never be blindly retried.

## Production persistence rule

The in-memory implementations are test/reference adapters only. A production deployment must provide a transactional database-backed adapter satisfying the same interfaces.
