import { assertExecutionBudget, BudgetGuard } from "../architecture/budget.js";
import { AgentiCOSError, serializeError } from "../architecture/errors.js";
import { SystemClock, SystemIdGenerator, type Clock, type IdGenerator } from "../architecture/runtime.js";
import {
  executeIdempotent,
  type IdempotencyRecord,
  type IdempotencyStore,
} from "../architecture/idempotency.js";
import {
  DEFAULT_CLAIM_STALE_AFTER_MS,
  DEFAULT_OUTBOX_CLAIM_TTL_MS,
  type DurableEvent,
  type Inbox,
  type Outbox,
  type OutboxClaim,
} from "../architecture/outbox.js";
import { RunStateMachine, type RunState } from "../architecture/state-machine.js";
import {
  assertSnapshotIntegrity,
  type WorkspaceSnapshot,
} from "../architecture/snapshots.js";
import type { Lease } from "../architecture/concurrency.js";
import type {
  CreateRunInput,
  CreateStepInput,
  RunRecord,
  StepRecord,
} from "./types.js";
import { SqliteDatabase } from "./database.js";
import { StepStateMachine } from "./step-state.js";
import type { StepState } from "./step-state.js";
import type { KernelStore } from "./ports.js";

interface RunRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  thread_id: string | null;
  actor_id: string | null;
  state: RunState;
  version: number;
  created_at: string;
  updated_at: string;
  budget_json: string;
  usage_json: string;
  error_json: string | null;
}

interface StepRow {
  id: string;
  run_id: string;
  sequence: number;
  state: StepState;
  version: number;
  created_at: string;
  updated_at: string;
  input_json: string | null;
  output_json: string | null;
  error_json: string | null;
}

type IdempotencyRow = {
  key: string;
  operation: string;
  fingerprint: string;
  status: IdempotencyRecord["status"];
  result_json: string | null;
  created_at: string;
  updated_at: string;
};

export interface KernelStoreOptions {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}

export class SqliteKernelStore implements KernelStore, IdempotencyStore, Outbox, Inbox {
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor(
    readonly database: SqliteDatabase,
    options: KernelStoreOptions = {},
  ) {
    this.clock = options.clock ?? new SystemClock();
    this.ids = options.ids ?? new SystemIdGenerator();
  }

  close(): void {
    this.database.close();
  }

  createRun(input: CreateRunInput): RunRecord {
    assertExecutionBudget(input.budget);
    if (!input.workspaceId.trim()) {
      throw new AgentiCOSError("Run workspaceId cannot be empty.", {
        code: "RUN_WORKSPACE_REQUIRED",
        category: "VALIDATION",
      });
    }
    const now = this.clock.nowIso();
    const usage = {
      startedAtMs: this.clock.nowMs(),
      steps: 0,
      childAgents: 0,
      toolCalls: 0,
      tokens: 0,
      cost: 0,
    };

    return this.database.transaction(() => {
      if (this.database.db.prepare("SELECT 1 FROM runs WHERE id = ?").get(input.id)) {
        throw new AgentiCOSError("Run already exists.", {
          code: "RUN_EXISTS",
          category: "VALIDATION",
        });
      }

      this.database.db.prepare(`
        INSERT INTO runs(
          id, workspace_id, project_id, thread_id, actor_id, state, version,
          created_at, updated_at, budget_json, usage_json
        )
        VALUES(@id, @workspace_id, @project_id, @thread_id, @actor_id, 'created', 1,
          @created_at, @updated_at, @budget_json, @usage_json)
      `).run({
        id: input.id,
        workspace_id: input.workspaceId,
        project_id: input.projectId ?? null,
        thread_id: input.threadId ?? null,
        actor_id: input.actorId ?? null,
        created_at: now,
        updated_at: now,
        budget_json: JSON.stringify(input.budget),
        usage_json: JSON.stringify(usage),
      });

      this.appendEventInTransaction(
        "run.created",
        1,
        input.id,
        input.id,
        { workspaceId: input.workspaceId },
        now,
      );

      return {
        id: input.id,
        workspaceId: input.workspaceId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.actorId ? { actorId: input.actorId } : {}),
        state: "created",
        version: 1,
        createdAt: now,
        updatedAt: now,
        budget: input.budget,
        usage,
      };
    });
  }

  getRun(id: string): RunRecord | undefined {
    const row = this.database.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
    return row ? this.toRun(row) : undefined;
  }

  getStep(id: string): StepRecord | undefined {
    const row = this.database.db.prepare("SELECT * FROM steps WHERE id = ?").get(id) as StepRow | undefined;
    return row ? this.toStep(row) : undefined;
  }

  listRunnable(): readonly RunRecord[] {
    const rows = this.database.db
      .prepare("SELECT * FROM runs WHERE state IN ('admitted', 'waiting') ORDER BY created_at ASC")
      .all() as RunRow[];
    return rows.map((row) => this.toRun(row));
  }

  admitRun(id: string): RunRecord {
    return this.transitionRun(id, "admitted", "run.admitted");
  }

  transitionRun(
    id: string,
    to: RunState,
    eventType = "run.state.changed",
    error?: unknown,
  ): RunRecord {
    return this.database.transaction(() => {
      const row = this.requireRunRow(id);
      const machine = new RunStateMachine(row.state);
      machine.transition(to);

      if (to === "completed" || to === "cancelled") {
        const open = this.database.db.prepare(`
          SELECT COUNT(*) AS count
          FROM steps
          WHERE run_id = ? AND state IN ('pending', 'running', 'waiting')
        `).get(id) as { count: number };

        if (open.count > 0) {
          throw new AgentiCOSError(
            "Run cannot enter a terminal state while active steps remain.",
            {
              code: "RUN_HAS_ACTIVE_STEPS",
              category: "VALIDATION",
            },
          );
        }
      }

      const now = this.clock.nowIso();
      const nextVersion = row.version + 1;
      const nextError = error === undefined
        ? row.error_json
        : JSON.stringify(serializeError(error));

      const changed = this.database.db.prepare(`
        UPDATE runs
        SET state = ?, version = ?, updated_at = ?, error_json = ?
        WHERE id = ? AND version = ?
      `).run(to, nextVersion, now, nextError, id, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Run version conflict.", {
          code: "RUN_VERSION_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction(eventType, 1, id, id, {
        from: row.state,
        to,
        version: nextVersion,
      }, now);

      return this.requireRun(id);
    });
  }

  transitionRunOwned(
    id: string,
    ownerId: string,
    fencingToken: number,
    to: RunState,
    eventType = "run.state.changed",
    error?: unknown,
    releaseLease = false,
    nowMs = this.clock.nowMs(),
  ): RunRecord {
    return this.database.transactionImmediate(() => {
      const row = this.requireRunRow(id);
      this.assertLeaseInTransaction("run:" + id, ownerId, fencingToken, nowMs);

      const machine = new RunStateMachine(row.state);
      machine.transition(to);

      if (to === "completed" || to === "cancelled") {
        const open = this.database.db
          .prepare(
            "SELECT COUNT(*) AS count FROM steps WHERE run_id = ? AND state IN ('pending','running','waiting')",
          )
          .get(id) as { count: number };

        if (open.count > 0) {
          throw new AgentiCOSError(
            "Run cannot enter a terminal state while active steps remain.",
            {
              code: "RUN_HAS_ACTIVE_STEPS",
              category: "VALIDATION",
            },
          );
        }
      }

      const now = new Date(nowMs).toISOString();
      const nextVersion = row.version + 1;
      const nextError =
        error === undefined ? row.error_json : JSON.stringify(serializeError(error));

      const changed = this.database.db
        .prepare(
          "UPDATE runs SET state=?, version=?, updated_at=?, error_json=? WHERE id=? AND version=?",
        )
        .run(to, nextVersion, now, nextError, id, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Run version conflict.", {
          code: "RUN_VERSION_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction(
        eventType,
        nextVersion,
        id,
        id,
        { from: row.state, to, version: nextVersion, workerId: ownerId, fencingToken },
        now,
      );

      if (releaseLease) {
        const released = this.database.db
          .prepare(
            "UPDATE leases SET expires_at=? WHERE resource_id=? AND owner_id=? AND fencing_token=?",
          )
          .run(new Date(0).toISOString(), "run:" + id, ownerId, fencingToken);

        if (released.changes !== 1) {
          throw new AgentiCOSError("Run lease release lost ownership.", {
            code: "RUN_LEASE_RELEASE_CONFLICT",
            category: "CONCURRENCY",
            severity: "critical",
            recoverable: true,
          });
        }
      }

      return this.requireRun(id);
    });
  }

  createStep(input: CreateStepInput): StepRecord {
    const now = this.clock.nowIso();

    return this.database.transaction(() => {
      const run = this.requireRunRow(input.runId);
      if (run.state !== "running" && run.state !== "admitted") {
        throw new AgentiCOSError("Steps can only be created for admitted or running runs.", {
          code: "STEP_RUN_STATE_INVALID",
          category: "VALIDATION",
        });
      }

      this.database.db.prepare(`
        INSERT INTO steps(
          id, run_id, sequence, state, version, created_at, updated_at, input_json
        )
        VALUES(?, ?, ?, 'pending', 1, ?, ?, ?)
      `).run(
        input.id,
        input.runId,
        input.sequence,
        now,
        now,
        input.input === undefined ? null : JSON.stringify(input.input),
      );

      this.appendEventInTransaction("step.created", 1, input.id, input.runId, {
        sequence: input.sequence,
      }, now);

      return this.requireStep(input.id);
    });
  }

  transitionStep(
    id: string,
    to: StepState,
    output?: unknown,
    error?: unknown,
  ): StepRecord {
    return this.database.transaction(() => {
      const row = this.requireStepRow(id);
      const machine = new StepStateMachine(row.state);
      machine.transition(to);

      const now = this.clock.nowIso();
      const nextVersion = row.version + 1;
      const nextOutput = output === undefined ? row.output_json : JSON.stringify(output);
      const nextError = error === undefined ? row.error_json : JSON.stringify(serializeError(error));

      const changed = this.database.db.prepare(`
        UPDATE steps
        SET state = ?, version = ?, updated_at = ?, output_json = ?, error_json = ?
        WHERE id = ? AND version = ?
      `).run(to, nextVersion, now, nextOutput, nextError, id, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Step version conflict.", {
          code: "STEP_VERSION_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction("step.state.changed", 1, id, row.run_id, {
        from: row.state,
        to,
        version: nextVersion,
      }, now);

      return this.requireStep(id);
    });
  }

  transitionStepOwned(
    id: string,
    ownerId: string,
    fencingToken: number,
    to: StepState,
    output?: unknown,
    error?: unknown,
    nowMs = this.clock.nowMs(),
  ): StepRecord {
    return this.database.transactionImmediate(() => {
      const row = this.requireStepRow(id);
      this.assertLeaseInTransaction("run:" + row.run_id, ownerId, fencingToken, nowMs);

      const machine = new StepStateMachine(row.state);
      machine.transition(to);

      const now = new Date(nowMs).toISOString();
      const nextVersion = row.version + 1;
      const nextOutput =
        output === undefined ? row.output_json : JSON.stringify(output);
      const nextError =
        error === undefined ? row.error_json : JSON.stringify(serializeError(error));

      const changed = this.database.db
        .prepare(
          "UPDATE steps SET state=?, version=?, updated_at=?, output_json=?, error_json=? WHERE id=? AND version=?",
        )
        .run(to, nextVersion, now, nextOutput, nextError, id, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Step version conflict.", {
          code: "STEP_VERSION_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction(
        "step.state.changed",
        nextVersion,
        id,
        row.run_id,
        { from: row.state, to, version: nextVersion, workerId: ownerId, fencingToken },
        now,
      );

      return this.requireStep(id);
    });
  }

  claimNextRunnable(
    workerId: string,
    ttlMs: number,
    nowMs = this.clock.nowMs(),
  ): RunRecord | undefined {
    if (ttlMs <= 0) {
      throw new AgentiCOSError("Lease TTL must be positive.", {
        code: "LEASE_TTL_INVALID",
        category: "VALIDATION",
      });
    }

    return this.database.transactionImmediate(() => {
      const nowIso = new Date(nowMs).toISOString();
      const row = this.database.db.prepare(`
        SELECT r.*
        FROM runs r
        LEFT JOIN leases l ON l.resource_id = 'run:' || r.id
        WHERE r.state IN ('admitted', 'waiting')
          AND (l.resource_id IS NULL OR l.expires_at <= ?)
        ORDER BY r.created_at ASC
        LIMIT 1
      `).get(nowIso) as RunRow | undefined;

      if (!row) return undefined;

      const resourceId = "run:" + row.id;
      const currentLease = this.database.db
        .prepare("SELECT fencing_token FROM leases WHERE resource_id = ?")
        .get(resourceId) as { fencing_token: number } | undefined;

      const fencingToken = (currentLease?.fencing_token ?? 0) + 1;
      const lease: Lease = {
        resourceId,
        leaseId: this.ids.next(),
        ownerId: workerId,
        fencingToken,
        acquiredAt: nowIso,
        expiresAt: new Date(nowMs + ttlMs).toISOString(),
      };

      this.database.db.prepare(`
        INSERT INTO leases(
          resource_id, lease_id, owner_id, fencing_token, acquired_at, expires_at
        )
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource_id) DO UPDATE SET
          lease_id = excluded.lease_id,
          owner_id = excluded.owner_id,
          fencing_token = excluded.fencing_token,
          acquired_at = excluded.acquired_at,
          expires_at = excluded.expires_at
      `).run(
        lease.resourceId,
        lease.leaseId,
        lease.ownerId,
        lease.fencingToken,
        lease.acquiredAt,
        lease.expiresAt,
      );

      const machine = new RunStateMachine(row.state);
      machine.transition("running");
      const nextVersion = row.version + 1;

      const changed = this.database.db.prepare(`
        UPDATE runs
        SET state = 'running', version = ?, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nextVersion, nowIso, row.id, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Run claim version conflict.", {
          code: "RUN_CLAIM_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction("run.claimed", 1, row.id, row.id, {
        from: row.state,
        to: "running",
        workerId,
        fencingToken,
      }, nowIso);

      return this.requireRun(row.id);
    });
  }

  releaseRunLease(runId: string, workerId: string): void {
    this.database.transactionImmediate(() => {
      const lease = this.requireLease("run:" + runId);
      if (lease.ownerId !== workerId) {
        throw new AgentiCOSError("Worker does not own run lease.", {
          code: "LEASE_OWNER_MISMATCH",
          category: "CONCURRENCY",
          recoverable: true,
        });
      }
      this.database.db
        .prepare("UPDATE leases SET expires_at = ? WHERE resource_id = ? AND lease_id = ?")
        .run(new Date(0).toISOString(), lease.resourceId, lease.leaseId);
    });
  }

  recoverExpiredRuns(nowMs = this.clock.nowMs()): readonly string[] {
    return this.database.transactionImmediate(() => {
      const nowIso = new Date(nowMs).toISOString();
      const rows = this.database.db.prepare(`
        SELECT r.id, r.state
        FROM runs r
        LEFT JOIN leases l ON l.resource_id = 'run:' || r.id
        WHERE r.state IN ('running', 'cancelling')
          AND (l.resource_id IS NULL OR l.expires_at <= ?)
        ORDER BY r.created_at ASC
      `).all(nowIso) as Array<{ id: string; state: RunState }>;

      const recovered: string[] = [];
      for (const item of rows) {
        const row = this.requireRunRow(item.id);
        const target: RunState = row.state === "cancelling" ? "cancelled" : "waiting";
        const machine = new RunStateMachine(row.state);
        machine.transition(target, { reason: "worker-recovery" });

        if (target === "cancelled") {
          const activeSteps = this.database.db.prepare(`
            SELECT id, version
            FROM steps
            WHERE run_id = ? AND state IN ('pending', 'running', 'waiting')
          `).all(row.id) as Array<{ id: string; version: number }>;

          for (const step of activeSteps) {
            const stepChanged = this.database.db.prepare(`
              UPDATE steps
              SET state='cancelled', version=version+1, updated_at=?
              WHERE id=? AND version=?
            `).run(nowIso, step.id, step.version);

            if (stepChanged.changes !== 1) {
              throw new AgentiCOSError("Cancellation step recovery conflict.", {
                code: "STEP_CANCELLATION_RECOVERY_CONFLICT",
                category: "CONCURRENCY",
                retryable: true,
                recoverable: true,
              });
            }

            this.appendEventInTransaction("step.recovered", 1, step.id, row.id, {
              from: "active",
              to: "cancelled",
              reason: "worker-recovery",
            }, nowIso);
          }
        }

        const changed = this.database.db
          .prepare("UPDATE runs SET state=?, version=version+1, updated_at=? WHERE id=? AND version=?")
          .run(target, nowIso, row.id, row.version);

        if (changed.changes !== 1) {
          throw new AgentiCOSError("Recovery version conflict.", {
            code: "RUN_RECOVERY_CONFLICT",
            category: "CONCURRENCY",
            retryable: true,
            recoverable: true,
          });
        }

        this.appendEventInTransaction("run.recovered", 1, row.id, row.id, {
          from: row.state,
          to: target,
          reason: "worker-recovery",
        }, nowIso);
        recovered.push(row.id);
      }

      return recovered;
    });
  }

  saveCheckpoint(snapshot: WorkspaceSnapshot, runId: string): void {
    assertSnapshotIntegrity(snapshot);

    this.database.transaction(() => {
      const run = this.requireRunRow(runId);
      if (run.workspace_id !== snapshot.workspaceId) {
        throw new AgentiCOSError("Checkpoint workspace does not match run workspace.", {
          code: "CHECKPOINT_WORKSPACE_MISMATCH",
          category: "VALIDATION",
        });
      }
      this.database.db.prepare(`
        INSERT INTO checkpoints(
          checkpoint_id, workspace_id, run_id, created_at, content_json, content_hash
        )
        VALUES(?, ?, ?, ?, ?, ?)
      `).run(
        snapshot.snapshotId,
        snapshot.workspaceId,
        runId,
        snapshot.createdAt,
        JSON.stringify(snapshot),
        snapshot.contentHash,
      );
    });
  }

  latestCheckpoint(runId: string): WorkspaceSnapshot | undefined {
    this.requireRunRow(runId);

    const row = this.database.db
      .prepare("SELECT content_json FROM checkpoints WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(runId) as { content_json: string } | undefined;

    if (!row) return undefined;
    const snapshot = JSON.parse(row.content_json) as WorkspaceSnapshot;
    assertSnapshotIntegrity(snapshot);
    return snapshot;
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    return this.toIdempotency(
      this.database.db.prepare("SELECT * FROM idempotency WHERE key = ?").get(key) as IdempotencyRow | undefined,
    );
  }

  async claim(record: IdempotencyRecord): Promise<IdempotencyRecord | undefined> {
    return this.database.transactionImmediate(() => {
      const existing = this.database.db
        .prepare("SELECT * FROM idempotency WHERE key = ?")
        .get(record.key) as IdempotencyRow | undefined;

      if (existing) {
        if (existing.fingerprint !== record.fingerprint) {
          throw new AgentiCOSError("Idempotency key reused with a different operation.", {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            category: "VALIDATION",
          });
        }
        return this.toIdempotency(existing);
      }

      this.database.db.prepare(`
        INSERT INTO idempotency(
          key, operation, fingerprint, status, result_json, created_at, updated_at
        )
        VALUES(?, ?, ?, ?, NULL, ?, ?)
      `).run(
        record.key,
        record.operation,
        record.fingerprint,
        record.status,
        record.createdAt,
        record.updatedAt,
      );

      return undefined;
    });
  }

  async claimEvent(
    consumerId: string,
    eventId: string,
    staleAfterMs = DEFAULT_CLAIM_STALE_AFTER_MS,
    nowMs = this.clock.nowMs(),
  ): Promise<boolean> {
    if (!consumerId.trim() || !eventId.trim()) {
      throw new AgentiCOSError("Inbox consumerId and eventId are required.", {
        code: "INBOX_ID_REQUIRED",
        category: "VALIDATION",
      });
    }
    if (!Number.isInteger(staleAfterMs) || staleAfterMs <= 0) {
      throw new AgentiCOSError("Inbox staleAfterMs must be a positive integer.", {
        code: "INBOX_STALE_WINDOW_INVALID",
        category: "VALIDATION",
      });
    }
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new AgentiCOSError("Inbox claim clock is invalid.", {
        code: "INBOX_CLAIM_CLOCK_INVALID",
        category: "VALIDATION",
      });
    }

    return this.database.transactionImmediate(() => {
      const existing = this.database.db
        .prepare(
          "SELECT status, claimed_at FROM inbox WHERE consumer_id=? AND event_id=?",
        )
        .get(consumerId, eventId) as
        | { status: "processing" | "completed"; claimed_at: string }
        | undefined;

      const nowIso = new Date(nowMs).toISOString();

      if (!existing) {
        this.database.db
          .prepare(
            "INSERT INTO inbox(consumer_id,event_id,status,claimed_at) VALUES(?,?, 'processing',?)",
          )
          .run(consumerId, eventId, nowIso);
        return true;
      }

      if (existing.status === "completed") return false;

      const claimedAt = Date.parse(existing.claimed_at);
      if (!Number.isFinite(claimedAt) || nowMs - claimedAt < staleAfterMs) {
        return false;
      }

      const reclaimed = this.database.db
        .prepare(
          "UPDATE inbox SET status='processing', claimed_at=?, completed_at=NULL WHERE consumer_id=? AND event_id=? AND status='processing' AND claimed_at=?",
        )
        .run(nowIso, consumerId, eventId, existing.claimed_at);

      return reclaimed.changes === 1;
    });
  }

  async put(record: IdempotencyRecord): Promise<void> {
    const changed = this.database.db.prepare(`
      UPDATE idempotency
      SET status = ?, result_json = ?, updated_at = ?
      WHERE key = ? AND fingerprint = ?
    `).run(
      record.status,
      record.result === undefined ? null : JSON.stringify(record.result),
      record.updatedAt,
      record.key,
      record.fingerprint,
    );

    if (changed.changes !== 1) {
      throw new AgentiCOSError("Idempotency record update was lost.", {
        code: "IDEMPOTENCY_UPDATE_LOST",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }

  async runIdempotent<T>(
    operation: string,
    key: string,
    input: unknown,
    execute: () => Promise<T>,
  ): Promise<T> {
    return executeIdempotent(this, operation, key, input, execute);
  }

  async append<T>(
    event: Omit<DurableEvent<T>, "eventId" | "createdAt" | "attempts" | "lastError" | "nextAttemptAt">,
  ): Promise<DurableEvent<T>> {
    const now = this.clock.nowIso();
    return this.database.transaction(() =>
      this.appendEventInTransaction(
        event.type,
        event.version,
        event.aggregateId,
        event.runId,
        event.payload,
        now,
        event,
      ),
    );
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    const safeLimit = Math.max(1, Math.floor(limit));
    const rows = this.database.db.prepare(`
      SELECT e.*, o.attempts, o.last_error_json, o.next_attempt_at
      FROM events e
      JOIN outbox o ON o.event_id = e.event_id
      WHERE o.published_at IS NULL
        AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= ?)
      ORDER BY o.created_at ASC
      LIMIT ?
    `).all(this.clock.nowIso(), safeLimit) as Array<{
      event_id: string;
      type: string;
      version: number;
      aggregate_id: string;
      run_id: string | null;
      workspace_id: string | null;
      project_id: string | null;
      thread_id: string | null;
      actor_id: string | null;
      parent_event_id: string | null;
      correlation_id: string | null;
      causation_id: string | null;
      durable: number;
      created_at: string;
      payload_json: string;
      attempts: number;
      last_error_json: string | null;
      next_attempt_at: string | null;
    }>;

    return rows.map((row) => ({
      eventId: row.event_id,
      type: row.type,
      version: row.version,
      aggregateId: row.aggregate_id,
      createdAt: row.created_at,
      ...(row.run_id === null ? {} : { runId: row.run_id }),
      ...(row.workspace_id === null ? {} : { workspaceId: row.workspace_id }),
      ...(row.project_id === null ? {} : { projectId: row.project_id }),
      ...(row.thread_id === null ? {} : { threadId: row.thread_id }),
      ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
      ...(row.parent_event_id === null ? {} : { parentEventId: row.parent_event_id }),
      ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }),
      ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
      durable: row.durable === 1,
      attempts: row.attempts,
      ...(row.last_error_json === null ? {} : { lastError: JSON.parse(row.last_error_json) }),
      ...(row.next_attempt_at === null ? {} : { nextAttemptAt: row.next_attempt_at }),
      payload: JSON.parse(row.payload_json),
    }));
  }

  async claimPending(
    ownerId: string,
    limit = 100,
    ttlMs = DEFAULT_OUTBOX_CLAIM_TTL_MS,
    nowMs = this.clock.nowMs(),
  ): Promise<readonly OutboxClaim[]> {
    if (!ownerId.trim()) {
      throw new AgentiCOSError("Outbox ownerId cannot be empty.", {
        code: "OUTBOX_OWNER_REQUIRED",
        category: "VALIDATION",
      });
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new AgentiCOSError("Outbox limit must be positive.", {
        code: "OUTBOX_LIMIT_INVALID",
        category: "VALIDATION",
      });
    }
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
      throw new AgentiCOSError("Outbox claim TTL must be a positive integer.", {
        code: "OUTBOX_CLAIM_TTL_INVALID",
        category: "VALIDATION",
      });
    }
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new AgentiCOSError("Outbox claim clock is invalid.", {
        code: "OUTBOX_CLAIM_CLOCK_INVALID",
        category: "VALIDATION",
      });
    }

    return this.database.transactionImmediate(() => {
      const nowIso = new Date(nowMs).toISOString();
      const rows = this.database.db
        .prepare(`
          SELECT e.*
          FROM events e
          JOIN outbox o ON o.event_id=e.event_id
          WHERE o.published_at IS NULL
            AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= ?)
            AND (o.claimed_until IS NULL OR o.claimed_until <= ?)
          ORDER BY o.created_at ASC
          LIMIT ?
        `)
        .all(nowIso, nowIso, Math.floor(limit)) as Array<{
          event_id: string;
          type: string;
          version: number;
          aggregate_id: string;
          run_id: string | null;
          workspace_id: string | null;
          project_id: string | null;
          thread_id: string | null;
          actor_id: string | null;
          parent_event_id: string | null;
          correlation_id: string | null;
          causation_id: string | null;
          durable: number;
          created_at: string;
          payload_json: string;
        }>;

      const claims: OutboxClaim[] = [];
      const claimedUntil = new Date(nowMs + ttlMs).toISOString();

      for (const row of rows) {
        const claimId = this.ids.next();
        const changed = this.database.db
          .prepare(`
            UPDATE outbox
            SET claimed_by=?, claim_id=?, claimed_until=?
            WHERE event_id=? AND published_at IS NULL
              AND (claimed_until IS NULL OR claimed_until <= ?)
          `)
          .run(ownerId, claimId, claimedUntil, row.event_id, nowIso);

        if (changed.changes !== 1) continue;

        const event: DurableEvent = {
          eventId: row.event_id,
          type: row.type,
          version: row.version,
          aggregateId: row.aggregate_id,
          createdAt: row.created_at,
          ...(row.run_id === null ? {} : { runId: row.run_id }),
          ...(row.workspace_id === null ? {} : { workspaceId: row.workspace_id }),
          ...(row.project_id === null ? {} : { projectId: row.project_id }),
          ...(row.thread_id === null ? {} : { threadId: row.thread_id }),
          ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
          ...(row.parent_event_id === null ? {} : { parentEventId: row.parent_event_id }),
          ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }),
          ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
          durable: row.durable === 1,
          payload: JSON.parse(row.payload_json),
        };

        claims.push({
          event,
          claimId,
          ownerId,
          claimedUntil,
        });
      }

      return claims;
    });
  }

  async markPublished(eventId: string, claimId?: string): Promise<void> {
    const changed = this.database.db
      .prepare(
        claimId === undefined
          ? "UPDATE outbox SET published_at=?, claimed_by=NULL, claim_id=NULL, claimed_until=NULL WHERE event_id=? AND published_at IS NULL"
          : "UPDATE outbox SET published_at=?, claimed_by=NULL, claim_id=NULL, claimed_until=NULL WHERE event_id=? AND published_at IS NULL AND claim_id=?",
      )
      .run(
        this.clock.nowIso(),
        eventId,
        ...(claimId === undefined ? [] : [claimId]),
      );

    if (changed.changes !== 1) {
      throw new AgentiCOSError(
        claimId === undefined
          ? "Outbox event was already published or does not exist."
          : "Outbox publication fencing rejected.",
        {
          code: "OUTBOX_MARK_PUBLISHED_FAILED",
          category: "PERSISTENCE",
          severity: "critical",
        },
      );
    }
  }

  async markFailed(eventId: string, error: unknown, nextAttemptAt: string): Promise<void> {
    const changed = this.database.db.prepare(`
      UPDATE outbox
      SET attempts = attempts + 1, last_error_json = ?, next_attempt_at = ?,
          claimed_by = NULL, claim_id = NULL, claimed_until = NULL
      WHERE event_id = ? AND published_at IS NULL
    `).run(JSON.stringify(serializeError(error)), nextAttemptAt, eventId);

    if (changed.changes !== 1) {
      throw new AgentiCOSError("Outbox failure update was lost or event is already published.", {
        code: "OUTBOX_MARK_FAILED_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }

  async releaseClaim(eventId: string, claimId: string): Promise<void> {
    this.database.db
      .prepare(
        "UPDATE outbox SET claimed_by=NULL, claim_id=NULL, claimed_until=NULL WHERE event_id=? AND claim_id=? AND published_at IS NULL",
      )
      .run(eventId, claimId);
  }

  async complete(consumerId: string, eventId: string): Promise<void> {
    const changed = this.database.db.prepare(`
      UPDATE inbox
      SET status='completed', completed_at=?
      WHERE consumer_id=? AND event_id=? AND status='processing'
    `).run(this.clock.nowIso(), consumerId, eventId);

    if (changed.changes !== 1) {
      throw new AgentiCOSError("Inbox completion was lost.", {
        code: "INBOX_COMPLETE_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }

  async release(consumerId: string, eventId: string): Promise<void> {
    this.database.db
      .prepare("DELETE FROM inbox WHERE consumer_id=? AND event_id=? AND status='processing'")
      .run(consumerId, eventId);
  }

  recordUsage(runId: string, delta: Partial<Pick<RunRecord["usage"], "steps" | "childAgents" | "toolCalls" | "tokens" | "cost">>): RunRecord {
    return this.database.transaction(() => {
      const row = this.requireRunRow(runId);
      const current = JSON.parse(row.usage_json) as RunRecord["usage"];
      const guard = new BudgetGuard(JSON.parse(row.budget_json) as RunRecord["budget"], current.startedAtMs);
      guard.consume(delta);
      const next = guard.snapshot();
      const now = this.clock.nowIso();

      const changed = this.database.db
        .prepare("UPDATE runs SET usage_json=?, updated_at=? WHERE id=? AND version=?")
        .run(JSON.stringify(next), now, runId, row.version);

      if (changed.changes !== 1) {
        throw new AgentiCOSError("Run usage version conflict.", {
          code: "RUN_USAGE_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      this.appendEventInTransaction("run.usage.updated", 1, runId, runId, {
        delta,
        usage: next,
      }, now);

      return this.requireRun(runId);
    });
  }

  renewRunLease(
    runId: string,
    workerId: string,
    fencingToken: number,
    ttlMs: number,
    nowMs = this.clock.nowMs(),
  ): Lease {
    if (ttlMs <= 0) {
      throw new AgentiCOSError("Lease TTL must be positive.", {
        code: "LEASE_TTL_INVALID",
        category: "VALIDATION",
      });
    }

    return this.database.transactionImmediate(() => {
      const lease = this.requireLease("run:" + runId);
      if (
        lease.ownerId !== workerId ||
        lease.fencingToken !== fencingToken ||
        Date.parse(lease.expiresAt) <= nowMs
      ) {
        throw new AgentiCOSError("Run lease cannot be renewed.", {
          code: "RUN_LEASE_RENEW_REJECTED",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      const nextExpiresAt = new Date(nowMs + ttlMs).toISOString();
      const result = this.database.db.prepare(`
        UPDATE leases
        SET expires_at = ?
        WHERE resource_id = ? AND lease_id = ? AND fencing_token = ?
      `).run(nextExpiresAt, lease.resourceId, lease.leaseId, lease.fencingToken);

      if (result.changes !== 1) {
        throw new AgentiCOSError("Run lease renewal lost ownership.", {
          code: "RUN_LEASE_RENEW_CONFLICT",
          category: "CONCURRENCY",
          retryable: true,
          recoverable: true,
        });
      }

      return { ...lease, expiresAt: nextExpiresAt };
    });
  }

  listEvents(runId: string): readonly DurableEvent[] {
    this.requireRunRow(runId);
    const rows = this.database.db.prepare(`
      SELECT event_id, type, version, aggregate_id, run_id, workspace_id,
             project_id, thread_id, actor_id, parent_event_id,
             correlation_id, causation_id, durable, created_at, payload_json
      FROM events
      WHERE run_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(runId) as Array<{
      event_id: string;
      type: string;
      version: number;
      aggregate_id: string;
      run_id: string | null;
      workspace_id: string | null;
      project_id: string | null;
      thread_id: string | null;
      actor_id: string | null;
      parent_event_id: string | null;
      correlation_id: string | null;
      causation_id: string | null;
      durable: number;
      created_at: string;
      payload_json: string;
    }>;

    return rows.map((row) => ({
      eventId: row.event_id,
      type: row.type,
      version: row.version,
      aggregateId: row.aggregate_id,
      createdAt: row.created_at,
      ...(row.run_id === null ? {} : { runId: row.run_id }),
      ...(row.workspace_id === null ? {} : { workspaceId: row.workspace_id }),
      ...(row.project_id === null ? {} : { projectId: row.project_id }),
      ...(row.thread_id === null ? {} : { threadId: row.thread_id }),
      ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
      ...(row.parent_event_id === null ? {} : { parentEventId: row.parent_event_id }),
      ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }),
      ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
      durable: row.durable === 1,
      payload: JSON.parse(row.payload_json),
    }));
  }

  private assertLeaseInTransaction(
    resourceId: string,
    ownerId: string,
    fencingToken: number,
    nowMs: number,
  ): void {
    const row = this.database.db
      .prepare(
        "SELECT owner_id, fencing_token, expires_at FROM leases WHERE resource_id=?",
      )
      .get(resourceId) as
      | { owner_id: string; fencing_token: number; expires_at: string }
      | undefined;

    if (
      !row ||
      row.owner_id !== ownerId ||
      row.fencing_token !== fencingToken ||
      Date.parse(row.expires_at) <= nowMs
    ) {
      throw new AgentiCOSError("Run lease fencing rejected.", {
        code: "RUN_LEASE_FENCING_REJECTED",
        category: "CONCURRENCY",
        recoverable: true,
      });
    }
  }

  assertRunLease(runId: string, workerId: string, fencingToken: number): void {
    const lease = this.requireLease("run:" + runId);
    if (
      lease.ownerId !== workerId ||
      lease.fencingToken !== fencingToken ||
      Date.parse(lease.expiresAt) <= this.clock.nowMs()
    ) {
      throw new AgentiCOSError("Run lease fencing rejected.", {
        code: "RUN_LEASE_FENCING_REJECTED",
        category: "CONCURRENCY",
        recoverable: true,
      });
    }
  }

  leaseForRun(runId: string): Lease | undefined {
    try {
      return this.requireLease("run:" + runId);
    } catch (error) {
      if (error instanceof AgentiCOSError && error.code === "LEASE_NOT_FOUND") {
        return undefined;
      }
      throw error;
    }
  }

  private appendEventInTransaction<T>(
    type: string,
    version: number,
    aggregateId: string,
    runId: string | undefined,
    payload: T,
    createdAt: string,
    metadata?: Omit<DurableEvent<T>, "eventId" | "createdAt" | "payload">,
  ): DurableEvent<T> {
    const eventId = this.ids.next();

    const context = runId === undefined
      ? undefined
      : this.database.db
          .prepare("SELECT workspace_id, project_id, thread_id, actor_id FROM runs WHERE id = ?")
          .get(runId) as {
            workspace_id: string;
            project_id: string | null;
            thread_id: string | null;
            actor_id: string | null;
          } | undefined;

    const workspaceId = metadata?.workspaceId ?? context?.workspace_id;
    const projectId = metadata?.projectId ?? context?.project_id ?? undefined;
    const threadId = metadata?.threadId ?? context?.thread_id ?? undefined;
    const actorId = metadata?.actorId ?? context?.actor_id ?? undefined;
    const correlationId = metadata?.correlationId ?? runId;

    this.database.db.prepare(`
      INSERT INTO events(
        event_id, type, version, aggregate_id, run_id,
        workspace_id, project_id, thread_id, actor_id,
        parent_event_id, correlation_id, causation_id, durable, created_at, payload_json
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      eventId,
      type,
      version,
      aggregateId,
      runId ?? null,
      workspaceId ?? null,
      projectId ?? null,
      threadId ?? null,
      actorId ?? null,
      metadata?.parentEventId ?? null,
      correlationId ?? null,
      metadata?.causationId ?? null,
      createdAt,
      JSON.stringify(payload),
    );

    this.database.db
      .prepare("INSERT INTO outbox(event_id, created_at, attempts, next_attempt_at) VALUES(?, ?, 0, ?)")
      .run(eventId, createdAt, createdAt);

    return {
      eventId,
      type,
      version,
      aggregateId,
      createdAt,
      ...(runId ? { runId } : {}),
      ...(workspaceId === undefined ? {} : { workspaceId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(threadId === undefined ? {} : { threadId }),
      ...(actorId === undefined ? {} : { actorId }),
      ...(metadata?.parentEventId ? { parentEventId: metadata.parentEventId } : {}),
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(metadata?.causationId ? { causationId: metadata.causationId } : {}),
      durable: metadata?.durable ?? true,
      attempts: 0,
      nextAttemptAt: createdAt,
      payload,
    };
  }

  private requireRun(id: string): RunRecord {
    return this.toRun(this.requireRunRow(id));
  }

  private requireRunRow(id: string): RunRow {
    const row = this.database.db
      .prepare("SELECT * FROM runs WHERE id = ?")
      .get(id) as RunRow | undefined;

    if (!row) {
      throw new AgentiCOSError("Run not found: " + id, {
        code: "RUN_NOT_FOUND",
        category: "VALIDATION",
      });
    }
    return row;
  }

  private requireStep(id: string): StepRecord {
    return this.toStep(this.requireStepRow(id));
  }

  private requireStepRow(id: string): StepRow {
    const row = this.database.db
      .prepare("SELECT * FROM steps WHERE id = ?")
      .get(id) as StepRow | undefined;

    if (!row) {
      throw new AgentiCOSError("Step not found: " + id, {
        code: "STEP_NOT_FOUND",
        category: "VALIDATION",
      });
    }
    return row;
  }

  private requireLease(resourceId: string): Lease {
    const row = this.database.db
      .prepare("SELECT * FROM leases WHERE resource_id = ?")
      .get(resourceId) as {
        resource_id: string;
        lease_id: string;
        owner_id: string;
        fencing_token: number;
        acquired_at: string;
        expires_at: string;
      } | undefined;

    if (!row) {
      throw new AgentiCOSError("Lease not found.", {
        code: "LEASE_NOT_FOUND",
        category: "CONCURRENCY",
        recoverable: true,
      });
    }

    return {
      resourceId: row.resource_id,
      leaseId: row.lease_id,
      ownerId: row.owner_id,
      fencingToken: row.fencing_token,
      acquiredAt: row.acquired_at,
      expiresAt: row.expires_at,
    };
  }

  private toIdempotency(row: IdempotencyRow | undefined): IdempotencyRecord | undefined {
    if (!row) return undefined;
    return {
      key: row.key,
      operation: row.operation,
      fingerprint: row.fingerprint,
      status: row.status,
      ...(row.result_json === null ? {} : { result: JSON.parse(row.result_json) }),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toRun(row: RunRow): RunRecord {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      ...(row.project_id === null ? {} : { projectId: row.project_id }),
      ...(row.thread_id === null ? {} : { threadId: row.thread_id }),
      ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
      state: row.state,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      budget: JSON.parse(row.budget_json) as RunRecord["budget"],
      usage: JSON.parse(row.usage_json) as RunRecord["usage"],
      ...(row.error_json === null ? {} : { error: JSON.parse(row.error_json) }),
    };
  }

  private toStep(row: StepRow): StepRecord {
    return {
      id: row.id,
      runId: row.run_id,
      sequence: row.sequence,
      state: row.state,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.input_json === null ? {} : { input: JSON.parse(row.input_json) }),
      ...(row.output_json === null ? {} : { output: JSON.parse(row.output_json) }),
      ...(row.error_json === null ? {} : { error: JSON.parse(row.error_json) }),
    };
  }
}
