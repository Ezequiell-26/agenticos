import assert from "node:assert/strict";
import { test } from "node:test";
import {
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
} from "../src/architecture/index.js";

test("run state machine rejects illegal terminal transitions", () => {
  const machine = new RunStateMachine();
  machine.transition("admitted");
  machine.transition("running");
  machine.transition("completed");
  assert.throws(() => machine.transition("running"));
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

test("contract registry loads and validates", async () => {
  const registry = await loadContractRegistry();
  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.contracts.length >= 1);
});
