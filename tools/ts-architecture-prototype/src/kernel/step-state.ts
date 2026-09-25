import { StateMachine, type TransitionTable } from "../architecture/state-machine.js";

export type StepState =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export const STEP_TRANSITIONS: TransitionTable<StepState> = {
  pending: ["running", "cancelled"],
  running: ["waiting", "completed", "failed", "cancelled"],
  waiting: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export class StepStateMachine extends StateMachine<StepState> {
  constructor(initialState: StepState = "pending") {
    super(initialState, STEP_TRANSITIONS);
  }
}
