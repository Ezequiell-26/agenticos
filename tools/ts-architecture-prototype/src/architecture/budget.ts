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

const INTEGER_BUDGET_KEYS = new Set<keyof ExecutionBudget>([
  "maxDurationMs",
  "maxSteps",
  "maxChildAgents",
  "maxToolCalls",
  "maxTokens",
]);

const USAGE_KEYS = new Set<keyof Omit<BudgetUsage, "startedAtMs">>([
  "steps",
  "childAgents",
  "toolCalls",
  "tokens",
  "cost",
]);

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
    if (INTEGER_BUDGET_KEYS.has(name) && !Number.isInteger(value)) {
      throw new AgentiCOSError("Execution budget must use an integer for " + name, {
        code: "EXECUTION_BUDGET_INTEGER_REQUIRED",
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
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new AgentiCOSError("Budget clock value is invalid.", {
        code: "EXECUTION_CLOCK_INVALID",
        category: "VALIDATION",
      });
    }

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

  consume(
    delta: Partial<Omit<BudgetUsage, "startedAtMs">>,
    nowMs = Date.now(),
  ): void {
    this.validateDelta(delta);
    const candidate: BudgetUsage = {
      ...this.usage,
      steps: this.usage.steps + (delta.steps ?? 0),
      childAgents: this.usage.childAgents + (delta.childAgents ?? 0),
      toolCalls: this.usage.toolCalls + (delta.toolCalls ?? 0),
      tokens: this.usage.tokens + (delta.tokens ?? 0),
      cost: this.usage.cost + (delta.cost ?? 0),
    };

    this.assertWithinBudget(nowMs, candidate);
    this.usage = candidate;
  }

  assertWithinBudget(
    nowMs = Date.now(),
    usage = this.usage,
  ): void {
    if (!Number.isFinite(nowMs) || nowMs < 0) {
      throw new AgentiCOSError("Budget clock value is invalid.", {
        code: "EXECUTION_CLOCK_INVALID",
        category: "VALIDATION",
      });
    }

    const elapsed = Math.max(0, nowMs - usage.startedAtMs);
    const exceeded: string[] = [];

    if (elapsed > this.budget.maxDurationMs) exceeded.push("duration");
    if (usage.steps > this.budget.maxSteps) exceeded.push("steps");
    if (usage.childAgents > this.budget.maxChildAgents) exceeded.push("childAgents");
    if (usage.toolCalls > this.budget.maxToolCalls) exceeded.push("toolCalls");
    if (usage.tokens > this.budget.maxTokens) exceeded.push("tokens");
    if (usage.cost > this.budget.maxCost) exceeded.push("cost");

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

  private validateDelta(
    delta: Partial<Omit<BudgetUsage, "startedAtMs">>,
  ): void {
    for (const [name, value] of Object.entries(delta)) {
      if (!USAGE_KEYS.has(name as keyof Omit<BudgetUsage, "startedAtMs">)) {
        throw new AgentiCOSError("Unknown budget usage field: " + name, {
          code: "EXECUTION_USAGE_FIELD_INVALID",
          category: "VALIDATION",
        });
      }
      if (value === undefined) continue;
      if (!Number.isFinite(value) || value < 0) {
        throw new AgentiCOSError("Invalid budget usage: " + name, {
          code: "EXECUTION_USAGE_INVALID",
          category: "VALIDATION",
        });
      }
      if (
        (name === "steps" ||
          name === "childAgents" ||
          name === "toolCalls" ||
          name === "tokens") &&
        !Number.isInteger(value)
      ) {
        throw new AgentiCOSError("Budget usage must be an integer for " + name, {
          code: "EXECUTION_USAGE_INTEGER_REQUIRED",
          category: "VALIDATION",
        });
      }
    }
  }
}
