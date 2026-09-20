import { AgentiCOSError } from "./errors.js";

export interface ExecutionBudget {
  readonly maxDurationMs: number;
  readonly maxSteps: number;
  readonly maxChildAgents: number;
  readonly maxToolCalls: number;
  readonly maxTokens: number;
  readonly maxCost: number;
}

export interface BudgetUsage {
  readonly startedAtMs: number;
  readonly steps: number;
  readonly childAgents: number;
  readonly toolCalls: number;
  readonly tokens: number;
  readonly cost: number;
}

export function assertExecutionBudget(budget: ExecutionBudget): void {
  const entries: ReadonlyArray<[keyof ExecutionBudget, number]> = [
    ["maxDurationMs", budget.maxDurationMs],
    ["maxSteps", budget.maxSteps],
    ["maxChildAgents", budget.maxChildAgents],
    ["maxToolCalls", budget.maxToolCalls],
    ["maxTokens", budget.maxTokens],
    ["maxCost", budget.maxCost],
  ];

  for (const [name, value] of entries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new AgentiCOSError("Invalid execution budget: " + name, {
        code: "EXECUTION_BUDGET_INVALID",
        category: "VALIDATION",
      });
    }
  }
}

export class BudgetGuard {
  private usage: BudgetUsage;

  constructor(
    private readonly budget: ExecutionBudget,
    nowMs = Date.now(),
  ) {
    assertExecutionBudget(budget);
    this.usage = {
      startedAtMs: nowMs,
      steps: 0,
      childAgents: 0,
      toolCalls: 0,
      tokens: 0,
      cost: 0,
    };
  }

  snapshot(): BudgetUsage {
    return { ...this.usage };
  }

  consume(delta: Partial<Omit<BudgetUsage, "startedAtMs">>, nowMs = Date.now()): void {
    for (const [name, value] of Object.entries(delta)) {
      if (name !== "startedAtMs" && value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new AgentiCOSError("Invalid budget usage: " + name, {
          code: "EXECUTION_USAGE_INVALID",
          category: "VALIDATION",
        });
      }
    }

    this.usage = {
      ...this.usage,
      steps: this.usage.steps + (delta.steps ?? 0),
      childAgents: this.usage.childAgents + (delta.childAgents ?? 0),
      toolCalls: this.usage.toolCalls + (delta.toolCalls ?? 0),
      tokens: this.usage.tokens + (delta.tokens ?? 0),
      cost: this.usage.cost + (delta.cost ?? 0),
    };
    this.assertWithinBudget(nowMs);
  }

  assertWithinBudget(nowMs = Date.now()): void {
    const elapsed = nowMs - this.usage.startedAtMs;
    const exceeded: string[] = [];

    if (elapsed > this.budget.maxDurationMs) exceeded.push("duration");
    if (this.usage.steps > this.budget.maxSteps) exceeded.push("steps");
    if (this.usage.childAgents > this.budget.maxChildAgents) exceeded.push("childAgents");
    if (this.usage.toolCalls > this.budget.maxToolCalls) exceeded.push("toolCalls");
    if (this.usage.tokens > this.budget.maxTokens) exceeded.push("tokens");
    if (this.usage.cost > this.budget.maxCost) exceeded.push("cost");

    if (exceeded.length > 0) {
      throw new AgentiCOSError(
        "Execution budget exceeded: " + exceeded.join(", "),
        {
          code: "EXECUTION_BUDGET_EXCEEDED",
          category: "RESOURCE",
          recoverable: true,
        },
      );
    }
  }
}
