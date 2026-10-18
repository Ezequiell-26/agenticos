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

This section is a target list, and it was previously readable as a status list. Corrected against `crates/application/scheduler/src/lib.rs` on 2026-10-19; see backlog item R10 for the measurement.

Implemented today:
- immediate execution;
- dependency-triggered execution (`JobSpec.dependencies`, evaluated in `next_ready`);
- retry with backoff (`scheduler_retry_backoff_ms`, gated by `JobRecord.next_attempt_at`);
- cancellation (`JobScheduler::cancel`).

Not implemented — no code exists for these:
- delayed execution and cron-like schedules: `JobSpec` carries no scheduled time and no recurrence field, and `next_ready` admits a job as soon as `next_attempt_at <= now`, which is a **retry** timestamp, not a requested start time;
- webhook/event triggers: `webhook` appears only in `infrastructure/channels`, `infrastructure/kernel` and `utilities/notifications`, never as a job source in the scheduler;
- pause/resume: `JobState` is `Pending | Ready | Running | Succeeded | Failed` (plus cancellation) with no paused state, and the string `pause` does not occur in the crate.

The consequence is that the runtime cannot fire work on a clock. Hermes is the useful reference here: `hermes cron`, `hermes webhook` and `hermes self-wake` are separate first-class commands on the installed binary, so scheduling is a runtime capability rather than a UI field.

## Distributed execution

A worker can claim a run through a lease. Heartbeats prove liveness. The control plane can reassign after lease expiry according to idempotency rules.

## Cost-aware scheduling

Scheduler decisions may consider provider quota, budget and estimated cost before admitting expensive branches.

## Shutdown

Graceful shutdown stops new admissions, waits for safe checkpoints, persists active state and releases leases.