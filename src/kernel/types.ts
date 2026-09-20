import type { BudgetUsage, ExecutionBudget } from "../architecture/budget.js";
import type { RunState } from "../architecture/state-machine.js";
import type { StepState } from "./step-state.js";

export interface RunRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly threadId?: string;
  readonly actorId?: string;
  readonly state: RunState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly budget: ExecutionBudget;
  readonly usage: BudgetUsage;
  readonly error?: unknown;
}

export type StepState = "pending" | "running" | "waiting" | "completed" | "failed" | "cancelled";

export interface StepRecord {
  readonly id: string;
  readonly runId: string;
  readonly sequence: number;
  readonly state: StepState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: unknown;
}

export interface CreateRunInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly threadId?: string;
  readonly actorId?: string;
  readonly budget: ExecutionBudget;
}

export interface CreateStepInput {
  readonly id: string;
  readonly runId: string;
  readonly sequence: number;
  readonly input?: unknown;
}
