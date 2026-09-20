import { randomUUID } from "node:crypto";
import { AgentiCOSError } from "../architecture/errors.js";
import { DurableScheduler, type SchedulerOptions } from "./scheduler.js";
import { SqliteKernelStore } from "./sqlite-store.js";
import type { CreateRunInput, CreateStepInput, RunRecord, StepRecord } from "./types.js";

export class DurableKernel {
  constructor(readonly store: SqliteKernelStore) {}

  createRun(input: Omit<CreateRunInput, "id"> & { id?: string }): RunRecord {
    return this.store.createRun({ ...input, id: input.id ?? randomUUID() });
  }

  getRun(runId: string): RunRecord {
    const run = this.store.getRun(runId);
    if (!run) {
      throw new AgentiCOSError("Run not found: " + runId, {
        code: "RUN_NOT_FOUND",
        category: "VALIDATION",
      });
    }
    return run;
  }

  getStep(stepId: string): StepRecord {
    const step = this.store.getStep(stepId);
    if (!step) {
      throw new AgentiCOSError("Step not found: " + stepId, {
        code: "STEP_NOT_FOUND",
        category: "VALIDATION",
      });
    }
    return step;
  }

  admitRun(runId: string): RunRecord {
    return this.store.admitRun(runId);
  }

  createScheduler(options: SchedulerOptions): DurableScheduler {
    return new DurableScheduler(this.store, options);
  }

  claimNext(workerId: string, leaseTtlMs = 60_000): RunRecord | undefined {
    return this.store.claimNextRunnable(workerId, leaseTtlMs);
  }

  createStep(input: Omit<CreateStepInput, "id"> & { id?: string }): StepRecord {
    return this.store.createStep({ ...input, id: input.id ?? randomUUID() });
  }

  startStep(stepId: string, workerId: string, fencingToken: number): StepRecord {
    return this.store.transitionStepOwned(
      stepId,
      workerId,
      fencingToken,
      "running",
    );
  }

  completeStep(
    stepId: string,
    workerId: string,
    fencingToken: number,
    output: unknown,
  ): StepRecord {
    return this.store.transitionStepOwned(
      stepId,
      workerId,
      fencingToken,
      "completed",
      output,
    );
  }

  failStep(
    stepId: string,
    workerId: string,
    fencingToken: number,
    error: unknown,
  ): StepRecord {
    return this.store.transitionStepOwned(
      stepId,
      workerId,
      fencingToken,
      "failed",
      undefined,
      error,
    );
  }

  completeRun(runId: string, workerId: string, fencingToken: number): RunRecord {
    return this.store.transitionRunOwned(
      runId,
      workerId,
      fencingToken,
      "completed",
      "run.completed",
      undefined,
      true,
    );
  }

  failRun(
    runId: string,
    workerId: string,
    fencingToken: number,
    error: unknown,
  ): RunRecord {
    return this.store.transitionRunOwned(
      runId,
      workerId,
      fencingToken,
      "failed",
      "run.failed",
      error,
      true,
    );
  }

  requestCancel(runId: string, workerId: string, fencingToken: number): RunRecord {
    return this.store.transitionRunOwned(
      runId,
      workerId,
      fencingToken,
      "cancelling",
      "run.cancelling",
    );
  }

  finalizeCancel(
    runId: string,
    workerId: string,
    fencingToken: number,
  ): RunRecord {
    return this.store.transitionRunOwned(
      runId,
      workerId,
      fencingToken,
      "cancelled",
      "run.cancelled",
      undefined,
      true,
    );
  }

  recoverExpiredRuns(nowMs = Date.now()): readonly string[] {
    return this.store.recoverExpiredRuns(nowMs);
  }

  close(): void {
    this.store.close();
  }
}
