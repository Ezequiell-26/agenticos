import type { Lease } from "../architecture/concurrency.js";
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
  ) {
    if (options.leaseTtlMs <= 0) {
      throw new Error("Scheduler leaseTtlMs must be positive.");
    }
    if (!options.workerId.trim()) {
      throw new Error("Scheduler workerId cannot be empty.");
    }
  }

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

  heartbeat(runId: string, fencingToken: number, nowMs = Date.now()): Lease {
    return this.store.renewRunLease(
      runId,
      this.options.workerId,
      fencingToken,
      this.options.leaseTtlMs,
      nowMs,
    );
  }

  release(runId: string): void {
    this.store.releaseRunLease(runId, this.options.workerId);
  }
}
