import { randomUUID } from "node:crypto";
import { assertExecutionBudget, BudgetGuard } from "../architecture/budget.js";
import { AgentiCOSError, serializeError } from "../architecture/errors.js";
import {
  executeIdempotent,
  type IdempotencyRecord,
  type IdempotencyStore,
} from "../architecture/idempotency.js";
import {
  DEFAULT_CLAIM_STALE_AFTER_MS,
  type DurableEvent,
  type Inbox,
  type Outbox,
} from "../architecture/outbox.js";
import {
  RunStateMachine,
  StateMachine,
  type RunState,
  type TransitionTable,
} from "../architecture/state-machine.js";
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
  StepState,
} from "./types.js";
import { SqliteDatabase } from "./database.js";

const STEP_TRANSITIONS: TransitionTable<StepState> = {
  pending: ["running", "cancelled"],
  running: ["waiting", "completed", "failed", "cancelled"],
  waiting: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

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

export class SqliteKernelStore implements IdempotencyStore, Outbox, Inbox {
  constructor(readonly database: SqliteDatabase) {}

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
    const now = new Date().toISOString();
    const usage = {
      startedAtMs: Date.now(),
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

      const now = new Date().toISOString();
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

  createStep(input: CreateStepInput): StepRecord {
    const now = new Date().toISOString();

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
      const machine = new StateMachine(row.state, STEP_TRANSITIONS);
      machine.transition(to);

      const now = new Date().toISOString();
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

  claimNextRunnable(
    workerId: string,
    ttlMs: number,
    nowMs = Date.now(),
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
        leaseId: randomUUID(),
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

  recoverExpiredRuns(nowMs = Date.now()): readonly string[] {
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

  async claim(
    record: IdempotencyRecord,
    staleAfterMs?: number,
    nowMs?: number,
  ): Promise<IdempotencyRecord | undefined>;
  async claim(
    consumerId: string,
    eventId: string,
    staleAfterMs?: number,
    nowMs?: number,
  ): Promise<boolean>;
  async claim(
    first: IdempotencyRecord | string,
    second?: string | number,
    third?: number,
    fourth?: number,
  ): Promise<IdempotencyRecord | undefined | boolean> {
    if (typeof first === "string") {
      const consumerId = first;
      const eventId = typeof second === "string" ? second : undefined;
      const staleAfter = third ?? DEFAULT_CLAIM_STALE_AFTER_MS;
      const clock = fourth ?? Date.now();

      if (!eventId) {
        throw new AgentiCOSError("Inbox eventId is required.", {
          code: "INBOX_EVENT_ID_REQUIRED",
          category: "VALIDATION",
        });
      }
      assertClaimWindow(staleAfter, clock);

      return this.database.transactionImmediate(() => {
        const existing = this.database.db
          .prepare(
            "SELECT status, claimed_at FROM inbox WHERE consumer_id = ? AND event_id = ?",
          )
          .get(consumerId, eventId) as
          | { status: "processing" | "completed"; claimed_at: string }
          | undefined;

        if (!existing) {
          const result = this.database.db.prepare(`
            INSERT INTO inbox(consumer_id, event_id, status, claimed_at)
            VALUES(?, ?, 'processing', ?)
          `).run(
            consumerId,
            eventId,
            new Date(clock).toISOString(),
          );
          return result.changes === 1;
        }

        if (existing.status === "completed") return false;

        const claimedAtMs = Date.parse(existing.claimed_at);
        if (
          !Number.isFinite(claimedAtMs) ||
          clock - claimedAtMs < staleAfter
        ) {
          return false;
        }

        const reclaimed = this.database.db.prepare(`
          UPDATE inbox
          SET claimed_at = ?, status = 'processing', completed_at = NULL
          WHERE consumer_id = ? AND event_id = ? AND status = 'processing' AND claimed_at = ?
        `).run(
          new Date(clock).toISOString(),
          consumerId,
          eventId,
          existing.claimed_at,
        );
        return reclaimed.changes === 1;
      });
    }

    const record = first;
    const staleAfter = (typeof second === "number" ? second : undefined) ??
      DEFAULT_CLAIM_STALE_AFTER_MS;
    const clock = third ?? Date.now();
    assertClaimWindow(staleAfter, clock);
    validateIdempotencyRecord(record);

    return this.database.transactionImmediate(() => {
      const existing = this.database.db
        .prepare("SELECT * FROM idempotency WHERE key = ?")
        .get(record.key) as IdempotencyRow | undefined;

      if (existing) {
        if (
          existing.fingerprint !== record.fingerprint ||
          existing.operation !== record.operation
        ) {
          throw new AgentiCOSError("Idempotency key reused with a different operation.", {
            code: "IDEMPOTENCY_KEY_CONFLICT",
            category: "VALIDATION",
          });
        }

        const updatedAtMs = Date.parse(existing.updated_at);
        if (
          existing.status === "in-progress" &&
          Number.isFinite(updatedAtMs) &&
          clock - updatedAtMs >= staleAfter
        ) {
          const reclaimed = this.database.db.prepare(`
            UPDATE idempotency
            SET status='in-progress', result_json=NULL, updated_at=?
            WHERE key=? AND fingerprint=? AND operation=? AND status='in-progress' AND updated_at=?
          `).run(
            record.updatedAt,
            record.key,
            record.fingerprint,
            record.operation,
            existing.updated_at,
          );
          if (reclaimed.changes === 1) return undefined;
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
    event: Omit<DurableEvent<T>, "eventId" | "createdAt">,
  ): Promise<DurableEvent<T>> {
    const now = new Date().toISOString();
    return this.database.transaction(() =>
      this.appendEventInTransaction(
        event.type,
        event.version,
        event.aggregateId,
        event.aggregateId,
        event.payload,
        now,
      ),
    );
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    const safeLimit = Math.max(1, Math.floor(limit));
    const rows = this.database.db.prepare(`
      SELECT e.*
      FROM events e
      JOIN outbox o ON o.event_id = e.event_id
      WHERE o.published_at IS NULL
      ORDER BY o.created_at ASC
      LIMIT ?
    `).all(safeLimit) as Array<{
      event_id: string;
      type: string;
      version: number;
      aggregate_id: string;
      run_id: string | null;
      created_at: string;
      payload_json: string;
    }>;

    return rows.map((row) => ({
      eventId: row.event_id,
      type: row.type,
      version: row.version,
      aggregateId: row.aggregate_id,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload_json),
    }));
  }

  async markPublished(eventId: string): Promise<void> {
    const changed = this.database.db
      .prepare("UPDATE outbox SET published_at = ? WHERE event_id = ? AND published_at IS NULL")
      .run(new Date().toISOString(), eventId);

    if (changed.changes !== 1) {
      throw new AgentiCOSError("Outbox event was already published or does not exist.", {
        code: "OUTBOX_MARK_PUBLISHED_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }

  async complete(consumerId: string, eventId: string): Promise<void> {
    const changed = this.database.db.prepare(`
      UPDATE inbox
      SET status='completed', completed_at=?
      WHERE consumer_id=? AND event_id=? AND status='processing'
    `).run(new Date().toISOString(), consumerId, eventId);

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
      const now = new Date().toISOString();

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
    nowMs = Date.now(),
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
      SELECT event_id, type, version, aggregate_id, created_at, payload_json
      FROM events
      WHERE run_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(runId) as Array<{
      event_id: string;
      type: string;
      version: number;
      aggregate_id: string;
      created_at: string;
      payload_json: string;
    }>;

    return rows.map((row) => ({
      eventId: row.event_id,
      type: row.type,
      version: row.version,
      aggregateId: row.aggregate_id,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload_json),
    }));
  }

  assertRunLease(runId: string, workerId: string, fencingToken: number): void {
    const lease = this.requireLease("run:" + runId);
    if (
      lease.ownerId !== workerId ||
      lease.fencingToken !== fencingToken ||
      Date.parse(lease.expiresAt) <= Date.now()
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

function assertClaimWindow(staleAfterMs: number, nowMs: number): void {
  if (!Number.isInteger(staleAfterMs) || staleAfterMs <= 0) {
    throw new AgentiCOSError("Claim staleAfterMs must be a positive integer.", {
      code: "CLAIM_STALE_WINDOW_INVALID",
      category: "VALIDATION",
    });
  }
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new AgentiCOSError("Claim clock value is invalid.", {
      code: "CLAIM_CLOCK_INVALID",
      category: "VALIDATION",
    });
  }
}

function validateIdempotencyRecord(record: IdempotencyRecord): void {
  if (!record.key.trim() || !record.operation.trim() || !record.fingerprint.trim()) {
    throw new AgentiCOSError("Idempotency record key, operation and fingerprint are required.", {
      code: "IDEMPOTENCY_RECORD_INVALID",
      category: "VALIDATION",
    });
  }
  if (!["in-progress", "completed", "failed"].includes(record.status)) {
    throw new AgentiCOSError("Idempotency record status is invalid.", {
      code: "IDEMPOTENCY_STATUS_INVALID",
      category: "VALIDATION",
    });
  }
}

  private appendEventInTransaction<T>(
    type: string,
    version: number,
    aggregateId: string,
    runId: string,
    payload: T,
    createdAt: string,
  ): DurableEvent<T> {
    const eventId = randomUUID();

    this.database.db.prepare(`
      INSERT INTO events(
        event_id, type, version, aggregate_id, run_id, created_at, payload_json
      )
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      type,
      version,
      aggregateId,
      runId,
      createdAt,
      JSON.stringify(payload),
    );

    this.database.db
      .prepare("INSERT INTO outbox(event_id, created_at) VALUES(?, ?)")
      .run(eventId, createdAt);

    return {
      eventId,
      type,
      version,
      aggregateId,
      createdAt,
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
