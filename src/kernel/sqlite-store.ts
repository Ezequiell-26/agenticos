import { randomUUID } from "node:crypto";
import { AgentiCOSError } from "../architecture/errors.js";
import { executeIdempotent, fingerprintOperation, type IdempotencyRecord, type IdempotencyStore } from "../architecture/idempotency.js";
import { type DurableEvent, type Inbox, type Outbox } from "../architecture/outbox.js";
import { RunStateMachine, StateMachine, RUN_TRANSITIONS, type RunState, type TransitionTable } from "../architecture/state-machine.js";
import { assertSnapshotIntegrity, type WorkspaceSnapshot } from "../architecture/snapshots.js";
import type { Lease } from "../architecture/concurrency.js";
import type { CreateRunInput, CreateStepInput, RunRecord, StepRecord, StepState } from "./types.js";
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
  id: string; workspace_id: string; project_id: string | null; thread_id: string | null; actor_id: string | null;
  state: RunState; version: number; created_at: string; updated_at: string;
  budget_json: string; usage_json: string; error_json: string | null;
}

interface StepRow {
  id: string; run_id: string; sequence: number; state: StepState; version: number;
  created_at: string; updated_at: string; input_json: string | null; output_json: string | null; error_json: string | null;
}

export class SqliteKernelStore implements IdempotencyStore, Outbox, Inbox {
  constructor(readonly database: SqliteDatabase) {}

  close(): void { this.database.close(); }

  createRun(input: CreateRunInput): RunRecord {
    const now = new Date().toISOString();
    const usage = { startedAtMs: Date.now(), steps: 0, childAgents: 0, toolCalls: 0, tokens: 0, cost: 0 };
    return this.database.transaction(() => {
      const exists = this.database.db.prepare("SELECT 1 FROM runs WHERE id = ?").get(input.id);
      if (exists) throw new AgentiCOSError("Run already exists.", { code: "RUN_EXISTS", category: "VALIDATION" });

      this.database.db.prepare(`
        INSERT INTO runs(id, workspace_id, project_id, thread_id, actor_id, state, version, created_at, updated_at, budget_json, usage_json)
        VALUES(@id, @workspace_id, @project_id, @thread_id, @actor_id, 'created', 1, @created_at, @updated_at, @budget_json, @usage_json)
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

      this.appendEventInTransaction("run.created", 1, input.id, input.id, {
        workspaceId: input.workspaceId,
      }, now);

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

  listRunnable(): readonly RunRecord[] {
    const rows = this.database.db
      .prepare("SELECT * FROM runs WHERE state IN ('admitted', 'waiting') ORDER BY created_at ASC")
      .all() as RunRow[];
    return rows.map((row) => this.toRun(row));
  }

  admitRun(id: string): RunRecord {
    return this.transitionRun(id, "admitted", "run.admitted");
  }

  transitionRun(id: string, to: RunState, eventType = "run.state.changed"): RunRecord {
    return this.database.transaction(() => {
      const row = this.requireRunRow(id);
      const machine = new RunStateMachine(row.state);
      machine.transition(to);
      const now = new Date().toISOString();
      const nextVersion = row.version + 1;

      const result = this.database.db.prepare(`
        UPDATE runs SET state = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?
      `).run(to, nextVersion, now, id, row.version);

      if (result.changes !== 1) throw new AgentiCOSError("Run version conflict.", {
        code: "RUN_VERSION_CONFLICT", category: "CONCURRENCY", retryable: true, recoverable: true,
      });

      this.appendEventInTransaction(eventType, 1, id, id, {
        from: row.state, to, version: nextVersion,
      }, now);

      return this.requireRun(id);
    });
  }

  createStep(input: CreateStepInput): StepRecord {
    const now = new Date().toISOString();
    return this.database.transaction(() => {
      this.requireRunRow(input.runId);
      this.database.db.prepare(`
        INSERT INTO steps(id, run_id, sequence, state, version, created_at, updated_at, input_json)
        VALUES(?, ?, ?, 'pending', 1, ?, ?, ?)
      `).run(input.id, input.runId, input.sequence, now, now, input.input === undefined ? null : JSON.stringify(input.input));
      this.appendEventInTransaction("step.created", 1, input.id, input.runId, {
        sequence: input.sequence,
      }, now);
      return this.requireStep(input.id);
    });
  }

  transitionStep(id: string, to: StepState, output?: unknown, error?: unknown): StepRecord {
    return this.database.transaction(() => {
      const row = this.requireStepRow(id);
      const machine = new StateMachine(row.state, STEP_TRANSITIONS);
      machine.transition(to);
      const now = new Date().toISOString();
      const nextVersion = row.version + 1;
      const result = this.database.db.prepare(`
        UPDATE steps
        SET state = ?, version = ?, updated_at = ?, output_json = ?, error_json = ?
        WHERE id = ? AND version = ?
      `).run(
        to,
        nextVersion,
        now,
        output === undefined ? row.output_json : JSON.stringify(output),
        error === undefined ? row.error_json : JSON.stringify(error),
        id,
        row.version,
      );
      if (result.changes !== 1) throw new AgentiCOSError("Step version conflict.", {
        code: "STEP_VERSION_CONFLICT", category: "CONCURRENCY", retryable: true, recoverable: true,
      });
      this.appendEventInTransaction("step.state.changed", 1, id, row.run_id, {
        from: row.state, to, version: nextVersion,
      }, now);
      return this.requireStep(id);
    });
  }

  claimNextRunnable(workerId: string, ttlMs: number, nowMs = Date.now()): RunRecord | undefined {
    return this.database.transaction(() => {
      const row = this.database.db
        .prepare("SELECT * FROM runs WHERE state IN ('admitted', 'waiting') ORDER BY created_at ASC LIMIT 1")
        .get() as RunRow | undefined;
      if (!row) return undefined;

      const resourceId = "run:" + row.id;
      const active = this.database.db
        .prepare("SELECT expires_at FROM leases WHERE resource_id = ?")
        .get(resourceId) as { expires_at: string } | undefined;
      if (active && Date.parse(active.expires_at) > nowMs) return undefined;

      const existingToken = this.database.db
        .prepare("SELECT fencing_token FROM leases WHERE resource_id = ?")
        .get(resourceId) as { fencing_token: number } | undefined;
      const fencingToken = (existingToken?.fencing_token ?? 0) + 1;
      const lease = {
        resourceId,
        leaseId: randomUUID(),
        ownerId: workerId,
        fencingToken,
        acquiredAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + ttlMs).toISOString(),
      } satisfies Lease;

      this.database.db.prepare(`
        INSERT INTO leases(resource_id, lease_id, owner_id, fencing_token, acquired_at, expires_at)
        VALUES(?, ?, ?, ?, ?, ?)
        ON CONFLICT(resource_id) DO UPDATE SET
          lease_id = excluded.lease_id,
          owner_id = excluded.owner_id,
          fencing_token = excluded.fencing_token,
          acquired_at = excluded.acquired_at,
          expires_at = excluded.expires_at
      `).run(resourceId, lease.leaseId, lease.ownerId, lease.fencingToken, lease.acquiredAt, lease.expiresAt);

      const fromState = row.state;
      const machine = new RunStateMachine(fromState);
      machine.transition("running");
      const nextVersion = row.version + 1;
      const updatedAt = new Date(nowMs).toISOString();
      const changed = this.database.db
        .prepare("UPDATE runs SET state = 'running', version = ?, updated_at = ? WHERE id = ? AND version = ?")
        .run(nextVersion, updatedAt, row.id, row.version);
      if (changed.changes !== 1) throw new AgentiCOSError("Run claim version conflict.", {
        code: "RUN_CLAIM_CONFLICT", category: "CONCURRENCY", retryable: true, recoverable: true,
      });

      this.appendEventInTransaction("run.claimed", 1, row.id, row.id, {
        from: fromState, to: "running", workerId, fencingToken,
      }, updatedAt);

      return this.requireRun(row.id);
    });
  }

  releaseRunLease(runId: string, workerId: string): void {
    this.database.transaction(() => {
      const resourceId = "run:" + runId;
      const lease = this.requireLease(resourceId);
      if (lease.ownerId !== workerId) throw new AgentiCOSError("Worker does not own run lease.", {
        code: "LEASE_OWNER_MISMATCH", category: "CONCURRENCY", recoverable: true,
      });
      this.database.db.prepare("UPDATE leases SET expires_at = ? WHERE resource_id = ?").run(new Date(0).toISOString(), resourceId);
    });
  }

  recoverExpiredRuns(nowMs = Date.now()): readonly string[] {
    return this.database.transaction(() => {
      const rows = this.database.db
        .prepare(`
          SELECT r.id
          FROM runs r
          LEFT JOIN leases l ON l.resource_id = 'run:' || r.id
          WHERE r.state = 'running' AND (l.resource_id IS NULL OR l.expires_at <= ?)
        `)
        .all(new Date(nowMs).toISOString()) as Array<{ id: string }>;

      const recovered: string[] = [];
      for (const row of rows) {
        const run = this.requireRunRow(row.id);
        const machine = new RunStateMachine(run.state);
        machine.transition("waiting", { reason: "worker-recovery" });
        const now = new Date(nowMs).toISOString();
        this.database.db
          .prepare("UPDATE runs SET state='waiting', version=version+1, updated_at=? WHERE id=? AND version=?")
          .run(now, run.id, run.version);
        this.appendEventInTransaction("run.recovered", 1, run.id, run.id, {
          from: "running", to: "waiting", reason: "worker-recovery",
        }, now);
        recovered.push(run.id);
      }
      return recovered;
    });
  }

  saveCheckpoint(snapshot: WorkspaceSnapshot, runId: string): void {
    assertSnapshotIntegrity(snapshot);
    this.requireRun(runId);
    this.database.db.prepare(`
      INSERT INTO checkpoints(checkpoint_id, workspace_id, run_id, created_at, content_json, content_hash)
      VALUES(?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.snapshotId,
      snapshot.workspaceId,
      runId,
      snapshot.createdAt,
      JSON.stringify(snapshot),
      snapshot.contentHash,
    );
  }

  latestCheckpoint(runId: string): WorkspaceSnapshot | undefined {
    this.requireRun(runId);
    const row = this.database.db
      .prepare("SELECT content_json FROM checkpoints WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(runId) as { content_json: string } | undefined;
    if (!row) return undefined;
    const snapshot = JSON.parse(row.content_json) as WorkspaceSnapshot;
    assertSnapshotIntegrity(snapshot);
    return snapshot;
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const row = this.database.db.prepare("SELECT * FROM idempotency WHERE key = ?").get(key) as {
      key: string; operation: string; fingerprint: string; status: IdempotencyRecord["status"];
      result_json: string | null; created_at: string; updated_at: string;
    } | undefined;
    if (!row) return undefined;
    return {
      key: row.key, operation: row.operation, fingerprint: row.fingerprint, status: row.status,
      ...(row.result_json === null ? {} : { result: JSON.parse(row.result_json) }),
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async claim(record: IdempotencyRecord): Promise<IdempotencyRecord | undefined> {
    return this.database.transaction(() => {
      const existing = this.database.db.prepare("SELECT * FROM idempotency WHERE key = ?").get(record.key) as {
        key: string; operation: string; fingerprint: string; status: IdempotencyRecord["status"];
        result_json: string | null; created_at: string; updated_at: string;
      } | undefined;
      if (existing) {
        if (existing.fingerprint !== record.fingerprint) {
          throw new AgentiCOSError("Idempotency key reused with a different operation.", {
            code: "IDEMPOTENCY_KEY_CONFLICT", category: "VALIDATION",
          });
        }
        return {
          key: existing.key, operation: existing.operation, fingerprint: existing.fingerprint, status: existing.status,
          ...(existing.result_json === null ? {} : { result: JSON.parse(existing.result_json) }),
          createdAt: existing.created_at, updatedAt: existing.updated_at,
        };
      }
      this.database.db.prepare(`
        INSERT INTO idempotency(key, operation, fingerprint, status, result_json, created_at, updated_at)
        VALUES(?, ?, ?, ?, NULL, ?, ?)
      `).run(record.key, record.operation, record.fingerprint, record.status, record.createdAt, record.updatedAt);
      return undefined;
    });
  }

  async put(record: IdempotencyRecord): Promise<void> {
    this.database.db.prepare(`
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
  }

  async append<T>(event: Omit<DurableEvent<T>, "eventId" | "createdAt">): Promise<DurableEvent<T>> {
    const now = new Date().toISOString();
    return this.database.transaction(() => this.appendEventInTransaction(event.type, event.version, event.aggregateId, event.aggregateId, event.payload, now));
  }

  async listPending(limit = 100): Promise<readonly DurableEvent[]> {
    const rows = this.database.db.prepare(`
      SELECT e.* FROM events e JOIN outbox o ON o.event_id = e.event_id
      WHERE o.published_at IS NULL ORDER BY o.created_at ASC LIMIT ?
    `).all(limit) as Array<{ event_id: string; type: string; version: number; aggregate_id: string; run_id: string | null; created_at: string; payload_json: string }>;
    return rows.map((row) => ({
      eventId: row.event_id, type: row.type, version: row.version,
      aggregateId: row.aggregate_id, createdAt: row.created_at,
      payload: JSON.parse(row.payload_json),
    }));
  }

  async markPublished(eventId: string): Promise<void> {
    this.database.db.prepare("UPDATE outbox SET published_at = ? WHERE event_id = ?").run(new Date().toISOString(), eventId);
  }

  async claim(consumerId: string, eventId: string): Promise<boolean> {
    return this.database.transaction(() => {
      const existing = this.database.db
        .prepare("SELECT status FROM inbox WHERE consumer_id = ? AND event_id = ?")
        .get(consumerId, eventId) as { status: "processing" | "completed" } | undefined;
      if (existing) return false;
      const changed = this.database.db.prepare(`
        INSERT INTO inbox(consumer_id, event_id, status, claimed_at) VALUES(?, ?, 'processing', ?)
      `).run(consumerId, eventId, new Date().toISOString());
      return changed.changes === 1;
    });
  }

  async complete(consumerId: string, eventId: string): Promise<void> {
    this.database.db.prepare(`
      UPDATE inbox SET status='completed', completed_at=? WHERE consumer_id=? AND event_id=?
    `).run(new Date().toISOString(), consumerId, eventId);
  }

  async release(consumerId: string, eventId: string): Promise<void> {
    this.database.db.prepare("DELETE FROM inbox WHERE consumer_id=? AND event_id=?").run(consumerId, eventId);
  }

  private appendEventInTransaction(
    type: string,
    version: number,
    aggregateId: string,
    runId: string,
    payload: unknown,
    createdAt: string,
  ): DurableEvent {
    const eventId = randomUUID();
    this.database.db.prepare(`
      INSERT INTO events(event_id, type, version, aggregate_id, run_id, created_at, payload_json)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, type, version, aggregateId, runId, createdAt, JSON.stringify(payload));
    this.database.db.prepare("INSERT INTO outbox(event_id, created_at) VALUES(?, ?)").run(eventId, createdAt);
    return { eventId, type, version, aggregateId, createdAt, payload };
  }

  private requireRun(id: string): RunRecord {
    const row = this.requireRunRow(id);
    return this.toRun(row);
  }

  private requireRunRow(id: string): RunRow {
    const row = this.database.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow | undefined;
    if (!row) throw new AgentiCOSError("Run not found: " + id, {
      code: "RUN_NOT_FOUND", category: "VALIDATION",
    });
    return row;
  }

  private requireStep(id: string): StepRecord {
    const row = this.requireStepRow(id);
    return {
      id: row.id, runId: row.run_id, sequence: row.sequence, state: row.state, version: row.version,
      createdAt: row.created_at, updatedAt: row.updated_at,
      ...(row.input_json === null ? {} : { input: JSON.parse(row.input_json) }),
      ...(row.output_json === null ? {} : { output: JSON.parse(row.output_json) }),
      ...(row.error_json === null ? {} : { error: JSON.parse(row.error_json) }),
    };
  }

  private requireStepRow(id: string): StepRow {
    const row = this.database.db.prepare("SELECT * FROM steps WHERE id = ?").get(id) as StepRow | undefined;
    if (!row) throw new AgentiCOSError("Step not found: " + id, {
      code: "STEP_NOT_FOUND", category: "VALIDATION",
    });
    return row;
  }

  private requireLease(resourceId: string): Lease {
    const row = this.database.db.prepare("SELECT * FROM leases WHERE resource_id=?").get(resourceId) as {
      resource_id: string; lease_id: string; owner_id: string; fencing_token: number; acquired_at: string; expires_at: string;
    } | undefined;
    if (!row) throw new AgentiCOSError("Lease not found.", {
      code: "LEASE_NOT_FOUND", category: "CONCURRENCY", recoverable: true,
    });
    return {
      resourceId: row.resource_id,
      leaseId: row.lease_id,
      ownerId: row.owner_id,
      fencingToken: row.fencing_token,
      acquiredAt: row.acquired_at,
      expiresAt: row.expires_at,
    };
  }

  private toRun(row: RunRow): RunRecord {
    const budget = JSON.parse(row.budget_json) as RunRecord["budget"];
    const usage = JSON.parse(row.usage_json) as RunRecord["usage"];
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
      budget,
      usage,
      ...(row.error_json === null ? {} : { error: JSON.parse(row.error_json) }),
    };
  }

  async runIdempotent<T>(operation: string, key: string, input: unknown, execute: () => Promise<T>): Promise<T> {
    return executeIdempotent(this, operation, key, input, execute);
  }

  async recordUsage(runId: string, usage: Partial<RunRecord["usage"]>): Promise<RunRecord> {
    return this.database.transaction(() => {
      const row = this.requireRunRow(runId);
      const current = JSON.parse(row.usage_json) as RunRecord["usage"];
      const next = {
        ...current,
        steps: current.steps + (usage.steps ?? 0),
        childAgents: current.childAgents + (usage.childAgents ?? 0),
        toolCalls: current.toolCalls + (usage.toolCalls ?? 0),
        tokens: current.tokens + (usage.tokens ?? 0),
        cost: current.cost + (usage.cost ?? 0),
      };
      this.database.db.prepare("UPDATE runs SET usage_json=?, updated_at=? WHERE id=? AND version=?")
        .run(JSON.stringify(next), new Date().toISOString(), runId, row.version);
      return this.requireRun(runId);
    });
  }

  assertRunLease(runId: string, workerId: string, fencingToken: number): void {
    const lease = this.requireLease("run:" + runId);
    if (lease.ownerId !== workerId || lease.fencingToken !== fencingToken || Date.parse(lease.expiresAt) <= Date.now()) {
      throw new AgentiCOSError("Run lease fencing rejected.", {
        code: "RUN_LEASE_FENCING_REJECTED", category: "CONCURRENCY", recoverable: true,
      });
    }
  }

  leaseForRun(runId: string): Lease | undefined {
    try {
      return this.requireLease("run:" + runId);
    } catch (error) {
      if (error instanceof AgentiCOSError && error.code === "LEASE_NOT_FOUND") return undefined;
      throw error;
    }
  }
}
