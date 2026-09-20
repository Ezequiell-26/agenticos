import assert from "node:assert/strict";
import { test } from "node:test";
import {
  InMemoryIdempotencyStore,
  RunStateMachine,
  InMemoryLeaseManager,
  InMemoryOutbox,
  InMemoryInbox,
  consumeExactlyOncePerConsumer,
  createWorkspaceSnapshot,
  assertSnapshotIntegrity,
} from "../src/architecture/index.js";

test("run state machine rejects illegal terminal transitions", () => {
  const machine = new RunStateMachine();
  machine.transition("admitted");
  machine.transition("running");
  machine.transition("completed");
  assert.throws(() => machine.transition("running"));
});

test("idempotency returns the original completed result", async () => {
  const store = new InMemoryIdempotencyStore();
  let executions = 0;
  const execute = async () => {
    executions += 1;
    return { ok: true };
  };

  const first = await import("../src/architecture/idempotency.js").then(({ executeIdempotent }) =>
    executeIdempotent(store, "test", "key-1", { x: 1 }, execute),
  );
  const second = await import("../src/architecture/idempotency.js").then(({ executeIdempotent }) =>
    executeIdempotent(store, "test", "key-1", { x: 1 }, execute),
  );

  assert.deepEqual(first, second);
  assert.equal(executions, 1);
});

test("lease fencing rejects stale owners", () => {
  const manager = new InMemoryLeaseManager();
  const first = manager.acquire("run-1", "worker-a", 1_000, 1_000);
  const second = manager.acquire("run-1", "worker-b", 1_000, 2_100);
  assert.notEqual(first.fencingToken, second.fencingToken);
  assert.throws(() => manager.assertOwner(first, 2_100));
});

test("outbox/inbox prevent duplicate consumer handling", async () => {
  const outbox = new InMemoryOutbox();
  const inbox = new InMemoryInbox();
  const event = await outbox.append({
    type: "run.created",
    version: 1,
    aggregateId: "run-1",
    payload: { runId: "run-1" },
  });

  let handled = 0;
  const handler = async () => { handled += 1; };
  assert.equal(await consumeExactlyOncePerConsumer(inbox, "consumer-a", event, handler), true);
  assert.equal(await consumeExactlyOncePerConsumer(inbox, "consumer-a", event, handler), false);
  assert.equal(handled, 1);
});

test("snapshot integrity detects tampering", () => {
  const snapshot = createWorkspaceSnapshot("workspace-1", [
    { path: "a.txt", content: "a" },
    { path: "b.txt", content: "b" },
  ]);
  assertSnapshotIntegrity(snapshot);
  assert.throws(() => assertSnapshotIntegrity({
    ...snapshot,
    files: [{ path: "a.txt", content: "tampered" }],
  }));
});
