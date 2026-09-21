# Event Sourcing for Kernel State

## Status

Accepted

## Context and Problem Statement

The AgentiCOS kernel needs durable state management with audit trails, replay capability, and recovery semantics. Traditional CRUD-style persistence loses history and makes debugging and recovery difficult.

## Decision Drivers

- Need for immutable audit trail
- Replay capability for testing and debugging
- Recovery from snapshots after failures
- Provenance tracking for state changes
- Ability to reconstruct state at any point in time

## Considered Options

- **Event Sourcing**: Store events as the source of truth, reconstruct state by replay
- **Snapshot with Event Log**: Store current state plus event log for changes
- **Pure CRUD**: Store only current state, no history

## Decision Outcome

Chosen option: "Event Sourcing with Snapshots", because it provides immutable audit trail, enables replay for testing/debugging, supports recovery from snapshots, and maintains provenance for all state changes. Snapshots are used to optimize replay performance.

### Consequences

- Good, because immutable audit trail is always available
- Good, because state can be reconstructed at any point
- Good, because enables time-travel debugging
- Bad, because event schema evolution requires upcasters
- Bad, because replay can be expensive without snapshots

## Validation

Validated by implementation in `crates/kernel/src/lib.rs` with `EventStore`, `SnapshotStore`, and replay logic in `replay_run` method.

## Pros and Cons of the Options

### Event Sourcing with Snapshots

- Good: Immutable audit trail
- Good: State reconstruction at any point
- Good: Time-travel debugging
- Bad: Schema evolution complexity
- Bad: Replay performance (mitigated by snapshots)

### Snapshot with Event Log

- Good: Current state is fast to read
- Good: Event log provides some history
- Bad: Not truly immutable
- Bad: Event log may diverge from state

### Pure CRUD

- Good: Simple to implement
- Good: Fast reads
- Bad: No audit trail
- Bad: No replay capability
- Bad: No provenance tracking
