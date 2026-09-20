import type { RunRecord } from "./types.js";
import { SqliteKernelStore } from "./sqlite-store.js";

export interface SchedulerOptions {
  readonly leaseTtlMs: number;
  readonly workerId: string;
}

export class DurableScheduler {
  constructor(
    private readonly store: SqliteKernelStore,
    private readonly options: SchedulerOptions,
  ) {}

  recover(nowMs = Date.now()): readonly string[] {
    return this.store.recoverExpiredRuns(nowMs);
  }

  claimNext(nowMs = Date.now()): RunRecord | undefined {
    return this.store.claimNextRunnable(
      this.options.workerId,
      this.options.leaseTtlMs,
      nowMs,
    );
  }

  heartbeat(runId: string, fencingToken: number): void {
    this.store.assertRunLease(runId, this.options.workerId, fencingToken);
  }
}
