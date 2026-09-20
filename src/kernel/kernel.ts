import { randomUUID } from "node:crypto";
import { SqliteKernelStore } from "./sqlite-store.js";
import type { CreateRunInput, CreateStepInput, RunRecord, StepRecord } from "./types.js";

export class DurableKernel {
  constructor(readonly store: SqliteKernelStore) {}

  createRun(input: Omit<CreateRunInput, "id"> & { id?: string }): RunRecord {
    return this.store.createRun({ ...input, id: input.id ?? randomUUID() });
  }

  admitRun(runId: string): RunRecord {
    return this.store.admitRun(runId);
  }

  claimNext(workerId: string, leaseTtlMs = 60_000): RunRecord | undefined {
    return this.store.claimNextRunnable(workerId, leaseTtlMs);
  }

  createStep(input: Omit<CreateStepInput, "id"> & { id?: string }): StepRecord {
    return this.store.createStep({ ...input, id: input.id ?? randomUUID() });
  }

  startStep(stepId: string, workerId: string, fencingToken: number): StepRecord {
    const step = this.store["requireStepRowForExternalUse"](stepId);
    this.store.assertRunLease(step.run_id, workerId, fencingToken);
    return this.store.transitionStep(stepId, "running");
  }

  completeStep(stepId: string, workerId: string, fencingToken: number, output: unknown): StepRecord {
    const step = this.store["requireStepRowForExternalUse"](stepId);
    this.store.assertRunLease(step.run_id, workerId, fencingToken);
    return this.store.transitionStep(stepId, "completed", output);
  }

  failStep(stepId: string, workerId: string, fencingToken: number, error: unknown): StepRecord {
    const step = this.store["requireStepRowForExternalUse"](stepId);
    this.store.assertRunLease(step.run_id, workerId, fencingToken);
    return this.store.transitionStep(stepId, "failed", undefined, error);
  }

  completeRun(runId: string, workerId: string, fencingToken: number): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    return this.store.transitionRun(runId, "completed", "run.completed");
  }

  failRun(runId: string, workerId: string, fencingToken: number, error: unknown): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    return this.store.transitionRun(runId, "failed", "run.failed");
  }

  cancelRun(runId: string, workerId: string, fencingToken: number): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    return this.store.transitionRun(runId, "cancelling", "run.cancelling");
  }

  recoverExpiredRuns(nowMs = Date.now()): readonly string[] {
    return this.store.recoverExpiredRuns(nowMs);
  }

  close(): void {
    this.store.close();
  }
}
