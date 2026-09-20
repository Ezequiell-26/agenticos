import type { IdempotencyStore } from "../architecture/idempotency.js";
import type { Inbox, Outbox, DurableEvent } from "../architecture/outbox.js";
import type { WorkspaceSnapshot } from "../architecture/snapshots.js";
import type { Lease } from "../architecture/concurrency.js";
import type { RunState } from "../architecture/state-machine.js";
import type { CreateRunInput, CreateStepInput, RunRecord, StepRecord } from "./types.js";
import type { StepState } from "./step-state.js";

export interface KernelStore extends IdempotencyStore, Outbox, Inbox {
  close(): void;
  createRun(input: CreateRunInput): RunRecord;
  getRun(id: string): RunRecord | undefined;
  getStep(id: string): StepRecord | undefined;
  listRunnable(): readonly RunRecord[];
  admitRun(id: string): RunRecord;
  transitionRun(id: string, to: RunState, eventType?: string, error?: unknown): RunRecord;
  createStep(input: CreateStepInput): StepRecord;
  transitionStep(id: string, to: StepState, output?: unknown, error?: unknown): StepRecord;
  claimNextRunnable(workerId: string, ttlMs: number, nowMs?: number): RunRecord | undefined;
  releaseRunLease(runId: string, workerId: string): void;
  recoverExpiredRuns(nowMs?: number): readonly string[];
  saveCheckpoint(snapshot: WorkspaceSnapshot, runId: string): void;
  latestCheckpoint(runId: string): WorkspaceSnapshot | undefined;
  runIdempotent<T>(operation: string, key: string, input: unknown, execute: () => Promise<T>): Promise<T>;
  recordUsage(
    runId: string,
    delta: Partial<Pick<RunRecord["usage"], "steps" | "childAgents" | "toolCalls" | "tokens" | "cost">>,
  ): RunRecord;
  renewRunLease(
    runId: string,
    workerId: string,
    fencingToken: number,
    ttlMs: number,
    nowMs?: number,
  ): Lease;
  listEvents(runId: string): readonly DurableEvent[];
  assertRunLease(runId: string, workerId: string, fencingToken: number): void;
  leaseForRun(runId: string): Lease | undefined;
}
