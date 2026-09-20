# AgentiCOS Resource and Scheduler Architecture

## Why this exists

Multi-agent execution can multiply models, tools, containers, browsers and network calls. AgentiCOS therefore needs one resource scheduler rather than independent unbounded loops.

## Resource dimensions

- concurrent runs;
- concurrent child agents;
- provider requests;
- tokens;
- network requests;
- CPU;
- memory;
- disk;
- browser sessions;
- sandbox workers;
- artifact storage;
- wall-clock duration.

## Admission control

Before execution:

```text
Task request
 ↓
estimate resources
 ↓
policy/budget check
 ↓
queue or admit
 ↓
allocate lease
 ↓
execute
 ↓
release
```

## Leases

Resource allocations are leases with expiration and renewal.

A crashed worker cannot permanently reserve a resource.

## Priority classes

- interactive;
- user-triggered background;
- scheduled;
- child-agent;
- maintenance;
- batch.

Interactive work receives bounded latency protection without starving background workloads.

## Fairness

Per-user, per-workspace and global limits prevent one task tree from consuming the entire runtime.

## Backpressure

Queues must apply backpressure to model calls, tool calls, artifact uploads and event consumers.

Clients may receive queued/deferred state rather than blocking indefinitely.

## Scheduling

The scheduler supports:
- immediate execution;
- delayed execution;
- cron-like schedules;
- dependency-triggered execution;
- webhook/event triggers;
- retry with backoff;
- pause/resume;
- cancellation.

## Distributed execution

A worker can claim a run through a lease. Heartbeats prove liveness. The control plane can reassign after lease expiry according to idempotency rules.

## Cost-aware scheduling

Scheduler decisions may consider provider quota, budget and estimated cost before admitting expensive branches.

## Shutdown

Graceful shutdown stops new admissions, waits for safe checkpoints, persists active state and releases leases.