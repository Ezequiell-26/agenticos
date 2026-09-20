import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  BudgetGuard,
  BoundedRepairController,
  InMemoryIdempotencyStore,
  RunStateMachine,
  InMemoryLeaseManager,
  InMemoryOutbox,
  InMemoryInbox,
  consumeAtLeastOncePerConsumer,
  createWorkspaceSnapshot,
  assertSnapshotIntegrity,
  InMemoryWorkspace,
  loadContractRegistry,
  assertContractRegistry,
  fingerprintOperation,
} from "../src/architecture/index.js";
import {
  DurableKernel,
  SqliteDatabase,
  SqliteKernelStore,
  DurableOutboxDispatcher,
} from "../src/kernel/index.js";

const budget = () => ({
  maxDurationMs: 60_000,
  maxSteps: 10,
  maxChildAgents: 2,
  maxToolCalls: 20,
  maxTokens: 10_000,
  maxCost: 1,
});

test("run state machine rejects illegal terminal transitions", () => {
  const machine = new RunStateMachine();
  machine.transition("admitted");
  machine.transition("running");
  machine.transition("completed");
  assert.throws(() => machine.transition("running"));
});

test("run state machine rejects restoring an unknown state", () => {
  const machine = new RunStateMachine();
  assert.throws(() => machine.restore("corrupted" as never));
});

test("idempotency returns the original completed result and blocks concurrent duplicate execution", async () => {
  const store = new InMemoryIdempotencyStore();
  let executions = 0;
  const execute = async () => {
    executions += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true };
  };

  const results = await Promise.allSettled([
    import("../src/architecture/idempotency.js").then(({ executeIdempotent }) =>
      executeIdempotent(store, "test", "key-1", { x: 1 }, execute),
    ),
    import("../src/architecture/idempotency.js").then(({ executeIdempotent }) =>
      executeIdempotent(store, "test", "key-1", { x: 1 }, execute),
    ),
  ]);

  assert.equal(executions, 1);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
});

test("idempotency fingerprints are canonical and distinguish semantic types", () => {
  assert.equal(
    fingerprintOperation("test", { b: 2, a: 1 }),
    fingerprintOperation("test", { a: 1, b: 2 }),
  );
  assert.notEqual(
    fingerprintOperation("test", { value: null }),
    fingerprintOperation("test", { value: Number.NaN }),
  );
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => fingerprintOperation("test", circular));
});

test("lease fencing rejects stale owners", () => {
  const manager = new InMemoryLeaseManager();
  const first = manager.acquire("run-1", "worker-a", 1_000, 1_000);
  const second = manager.acquire("run-1", "worker-b", 1_000, 2_100);
  assert.notEqual(first.fencingToken, second.fencingToken);
  assert.throws(() => manager.assertOwner(first, 2_100));
});

test("outbox/inbox prevent duplicate concurrent consumer handling", async () => {
  const outbox = new InMemoryOutbox();
  const inbox = new InMemoryInbox();
  const event = await outbox.append({
    type: "run.created",
    version: 1,
    aggregateId: "run-1",
    payload: { runId: "run-1" },
  });

  let handled = 0;
  const handler = async () => {
    handled += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
  };

  const results = await Promise.all([
    consumeAtLeastOncePerConsumer(inbox, "consumer-a", event, handler),
    consumeAtLeastOncePerConsumer(inbox, "consumer-a", event, handler),
  ]);

  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(handled, 1);
});

test("snapshot integrity rejects traversal, duplicate and NUL-byte paths", async () => {
  assert.throws(() =>
    createWorkspaceSnapshot("workspace-1", [
      { path: "../secret.txt", content: "x" },
    ]),
  );
  assert.throws(() =>
    createWorkspaceSnapshot("workspace-1", [
      { path: "a.txt", content: "x" },
      { path: "a.txt", content: "y" },
    ]),
  );
  assert.throws(() =>
    createWorkspaceSnapshot("workspace-1", [
      { path: "bad" + String.fromCharCode(0) + ".txt", content: "x" },
    ]),
  );
});

test("snapshot integrity detects tampering and transactions rollback on failure", async () => {
  const snapshot = createWorkspaceSnapshot("workspace-1", [
    { path: "a.txt", content: "a" },
    { path: "b.txt", content: "b" },
  ]);
  assertSnapshotIntegrity(snapshot);
  assert.throws(() => assertSnapshotIntegrity({
    ...snapshot,
    files: [{ path: "a.txt", content: "tampered" }],
  }));

  const workspace = new InMemoryWorkspace("workspace-1", snapshot.files);
  await assert.rejects(() =>
    workspace.transaction((files) => {
      files[0] = { path: "a.txt", content: "broken" };
      throw new Error("simulated failure");
    }),
  );
  assert.deepEqual(workspace.snapshot().files, snapshot.files);
});

test("contract registry loads and rejects malformed descriptors", async () => {
  const registry = await loadContractRegistry();
  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.contracts.length >= 1);

  assert.throws(() =>
    assertContractRegistry({
      schemaVersion: 1,
      contracts: [{
        id: "broken",
        version: 1,
        kind: "domain",
        compatibility: "backward-compatible",
        requiredCapabilities: ["run", "run"],
      }],
    }),
  );
});

test("execution budget fails closed without mutating usage after a rejected increment", () => {
  const guard = new BudgetGuard({
    maxDurationMs: 1_000,
    maxSteps: 2,
    maxChildAgents: 1,
    maxToolCalls: 3,
    maxTokens: 100,
    maxCost: 1,
  }, 1_000);

  guard.consume({ steps: 2, toolCalls: 3, tokens: 100, cost: 1 }, 1_100);
  const before = guard.snapshot();

  assert.throws(() => guard.consume({ steps: 1 }, 1_100));
  assert.deepEqual(guard.snapshot(), before);
});

test("repair controller bounds repair attempts", () => {
  const repair = new BoundedRepairController({
    maxAttempts: 1,
    maxDurationMs: 1_000,
    maxFilesChanged: 10,
    maxLinesChanged: 100,
    maxCost: 1,
  }, 1_000);

  repair.nextAttempt(2, 10, 0.1, 1_100);
  assert.throws(() => repair.nextAttempt(2, 10, 0.1, 1_200));
});

test("sqlite kernel migrations install integrity guards and preserve database health", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-migrations-"));
  const dbPath = join(directory, "state.sqlite");
  const database = new SqliteDatabase(dbPath);
  const kernel = new DurableKernel(new SqliteKernelStore(database));

  const run = kernel.createRun({
    id: "guarded-run",
    workspaceId: "workspace-guard",
    budget: budget(),
  });

  assert.equal(
    (database.db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get() as { value: string }).value,
    "2",
  );
  assert.equal(
    (database.db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version=2").get() as { count: number }).count,
    1,
  );

  assert.throws(() =>
    database.db.prepare("UPDATE runs SET state='corrupted' WHERE id=?").run(run.id),
  );

  const report = database.integrity();
  assert.equal(report.ok, true);
  assert.equal(report.foreignKeyViolations, 0);
  database.assertIntegrity();

  kernel.close();
  await rm(directory, { recursive: true, force: true });
});

test("sqlite kernel persists runs across reopen and atomically records lifecycle events", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-kernel-"));
  const dbPath = join(directory, "state.sqlite");
  const database = new SqliteDatabase(dbPath);
  const kernel = new DurableKernel(new SqliteKernelStore(database));

  const run = kernel.createRun({
    id: "durable-run",
    workspaceId: "workspace-1",
    budget: budget(),
  });

  assert.equal(run.state, "created");
  kernel.admitRun(run.id);

  const workerRun = kernel.claimNext("worker-a", 60_000);
  assert.equal(workerRun?.state, "running");

  const lease = kernel.store.leaseForRun(run.id);
  assert.ok(lease);

  const step = kernel.createStep({
    runId: run.id,
    sequence: 1,
    input: { action: "smoke" },
  });

  kernel.startStep(step.id, "worker-a", lease.fencingToken);
  kernel.completeStep(step.id, "worker-a", lease.fencingToken, { ok: true });
  kernel.completeRun(run.id, "worker-a", lease.fencingToken);

  const pending = await kernel.store.listPending(20);
  assert.ok(pending.some((event) => event.type === "run.created"));
  assert.ok(pending.some((event) => event.type === "run.claimed"));
  assert.ok(pending.some((event) => event.type === "run.completed"));

  kernel.close();

  const reopened = new DurableKernel(new SqliteKernelStore(new SqliteDatabase(dbPath)));
  const persisted = reopened.getRun(run.id);
  assert.equal(persisted.state, "completed");
  assert.equal(persisted.version >= 4, true);
  assert.ok(reopened.store.listEvents(run.id).some((event) => event.type === "run.completed"));

  const dispatcher = new DurableOutboxDispatcher(reopened.store);
  let published = 0;
  const dispatchResult = await dispatcher.dispatch(() => {
    published += 1;
  });
  assert.equal(dispatchResult.failed, false);
  assert.equal(dispatchResult.published, published);
  assert.equal((await reopened.store.listPending(100)).length, 0);

  reopened.close();

  await rm(directory, { recursive: true, force: true });
});

test("sqlite scheduler prevents duplicate claims and recovers an expired worker lease", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agenticos-scheduler-"));
  const dbPath = join(directory, "state.sqlite");

  const kernelA = new DurableKernel(new SqliteKernelStore(new SqliteDatabase(dbPath)));
  const kernelB = new DurableKernel(new SqliteKernelStore(new SqliteDatabase(dbPath)));

  const run = kernelA.createRun({
    id: "scheduled-run",
    workspaceId: "workspace-2",
    budget: budget(),
  });
  kernelA.admitRun(run.id);

  const schedulerA = kernelA.createScheduler({
    workerId: "worker-a",
    leaseTtlMs: 60_000,
  });
  const schedulerB = kernelB.createScheduler({
    workerId: "worker-b",
    leaseTtlMs: 60_000,
  });

  const first = schedulerA.claimNext();
  const second = schedulerB.claimNext();

  assert.equal(first?.id, run.id);
  assert.equal(second, undefined);
  assert.equal(kernelB.getRun(run.id).state, "running");

  const lease = kernelA.store.leaseForRun(run.id);
  assert.ok(lease);
  const renewed = schedulerA.heartbeat(run.id, lease.fencingToken, Date.now() + 1_000);
  assert.ok(Date.parse(renewed.expiresAt) > Date.parse(lease.expiresAt));

  kernelA.close();
  kernelB.close();

  const kernelC = new DurableKernel(new SqliteKernelStore(new SqliteDatabase(dbPath)));
  const recovery = kernelC.recoverExpiredRuns(Date.now() + 61_000);
  assert.deepEqual(recovery, [run.id]);
  assert.equal(kernelC.getRun(run.id).state, "waiting");

  const schedulerC = kernelC.createScheduler({
    workerId: "worker-c",
    leaseTtlMs: 60_000,
  });
  const claimAgain = schedulerC.claimNext(Date.now() + 61_000);
  assert.equal(claimAgain?.id, run.id);
  assert.equal(claimAgain?.state, "running");

  kernelC.close();

  const kernelD = new DurableKernel(new SqliteKernelStore(new SqliteDatabase(dbPath)));
  const cancellationRun = kernelD.createRun({
    id: "cancel-recovery-run",
    workspaceId: "workspace-2",
    budget: budget(),
  });
  kernelD.admitRun(cancellationRun.id);
  const claimedCancellation = kernelD.claimNext("worker-d", 60_000);
  assert.ok(claimedCancellation);
  const cancellationLease = kernelD.store.leaseForRun(cancellationRun.id);
  assert.ok(cancellationLease);
  kernelD.requestCancel(cancellationRun.id, "worker-d", cancellationLease.fencingToken);

  const cancellationRecovery = kernelD.recoverExpiredRuns(Date.now() + 61_000);
  assert.ok(cancellationRecovery.includes(cancellationRun.id));
  assert.equal(kernelD.getRun(cancellationRun.id).state, "cancelled");
  kernelD.close();

  await rm(directory, { recursive: true, force: true });
});
