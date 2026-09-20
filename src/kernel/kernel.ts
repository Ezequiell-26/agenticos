import { AgentiCOSError } from "../architecture/errors.js";
import { SystemIdGenerator, type IdGenerator } from "../architecture/runtime.js";
import { DurableScheduler, type SchedulerOptions } from "./scheduler.js";
import type { KernelStore } from "./ports.js";
import type { CreateRunInput, CreateStepInput, RunRecord, StepRecord } from "./types.js";

export class DurableKernel {
  constructor(
    readonly store: KernelStore,
    private readonly ids: IdGenerator = new SystemIdGenerator(),
  ) {}

  createRun(input: Omit<CreateRunInput, "id"> & { id?: string }): RunRecord {
    return this.store.createRun({ ...input, id: input.id ?? this.ids.next() });
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
    return this.store.createStep({ ...input, id: input.id ?? this.ids.next() });
  }

  startStep(stepId: string, workerId: string, fencingToken: number): StepRecord {
    const step = this.getStep(stepId);
    this.store.assertRunLease(step.runId, workerId, fencingToken);
    return this.store.transitionStep(stepId, "running");
  }

  completeStep(stepId: string, workerId: string, fencingToken: number, output: unknown): StepRecord {
    const step = this.getStep(stepId);
    this.store.assertRunLease(step.runId, workerId, fencingToken);
    return this.store.transitionStep(stepId, "completed", output);
  }

  failStep(stepId: string, workerId: string, fencingToken: number, error: unknown): StepRecord {
    const step = this.getStep(stepId);
    this.store.assertRunLease(step.runId, workerId, fencingToken);
    return this.store.transitionStep(stepId, "failed", undefined, error);
  }

  completeRun(runId: string, workerId: string, fencingToken: number): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    const result = this.store.transitionRun(runId, "completed", "run.completed");
    this.store.releaseRunLease(runId, workerId);
    return result;
  }

  failRun(runId: string, workerId: string, fencingToken: number, error: unknown): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    const result = this.store.transitionRun(runId, "failed", "run.failed", error);
    this.store.releaseRunLease(runId, workerId);
    return result;
  }

  requestCancel(runId: string, workerId: string, fencingToken: number): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    return this.store.transitionRun(runId, "cancelling", "run.cancelling");
  }

  finalizeCancel(runId: string, workerId: string, fencingToken: number): RunRecord {
    this.store.assertRunLease(runId, workerId, fencingToken);
    const result = this.store.transitionRun(runId, "cancelled", "run.cancelled");
    this.store.releaseRunLease(runId, workerId);
    return result;
  }

  recoverExpiredRuns(nowMs = Date.now()): readonly string[] {
    return this.store.recoverExpiredRuns(nowMs);
  }

  close(): void {
    this.store.close();
  }
}
