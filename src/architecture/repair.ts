import { AgentiCOSError } from "./errors.js";

export interface RepairBudget {
  readonly maxAttempts: number;
  readonly maxDurationMs: number;
  readonly maxFilesChanged: number;
  readonly maxLinesChanged: number;
  readonly maxCost: number;
}

export interface RepairAttempt {
  readonly attempt: number;
  readonly filesChanged: number;
  readonly linesChanged: number;
  readonly cost: number;
  readonly atMs: number;
}

export class BoundedRepairController {
  private readonly startedAtMs: number;
  private attempts = 0;

  constructor(
    private readonly budget: RepairBudget,
    nowMs = Date.now(),
  ) {
    this.startedAtMs = nowMs;
  }

  nextAttempt(
    filesChanged: number,
    linesChanged: number,
    cost: number,
    nowMs = Date.now(),
  ): RepairAttempt {
    const attempt = this.attempts + 1;
    const errors: string[] = [];

    if (attempt > this.budget.maxAttempts) errors.push("attempts");
    if (nowMs - this.startedAtMs > this.budget.maxDurationMs) errors.push("duration");
    if (filesChanged > this.budget.maxFilesChanged) errors.push("filesChanged");
    if (linesChanged > this.budget.maxLinesChanged) errors.push("linesChanged");
    if (cost > this.budget.maxCost) errors.push("cost");

    if (errors.length > 0) {
      throw new AgentiCOSError(
        "Repair budget exceeded: " + errors.join(", "),
        {
          code: "REPAIR_BUDGET_EXCEEDED",
          category: "RESOURCE",
          recoverable: false,
        },
      );
    }

    this.attempts = attempt;
    return { attempt, filesChanged, linesChanged, cost, atMs: nowMs };
  }

  get attemptCount(): number {
    return this.attempts;
  }
}
