import { AgentiCOSError } from "./errors.js";

export type TransitionTable<S extends string> = Readonly<
  Record<S, readonly S[]>
>;

export interface StateTransition<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly at: string;
  readonly actorId?: string;
  readonly reason?: string;
}

export class StateMachine<S extends string> {
  private currentState: S;
  private readonly history: StateTransition<S>[] = [];

  constructor(
    initialState: S,
    private readonly transitions: TransitionTable<S>,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    this.currentState = initialState;
  }

  get state(): S {
    return this.currentState;
  }

  getHistory(): readonly StateTransition<S>[] {
    return [...this.history];
  }

  canTransition(to: S): boolean {
    return this.transitions[this.currentState]?.includes(to) ?? false;
  }

  transition(to: S, metadata?: Omit<StateTransition<S>, "from" | "to" | "at">): void {
    if (!this.canTransition(to)) {
      throw new AgentiCOSError(
        `Illegal state transition: ${this.currentState} -> ${to}`,
        {
          code: "ILLEGAL_STATE_TRANSITION",
          category: "VALIDATION",
          recoverable: false,
          metadata: {
            from: this.currentState,
            to,
          },
        },
      );
    }

    const record: StateTransition<S> = {
      from: this.currentState,
      to,
      at: this.clock(),
      ...(metadata?.actorId ? { actorId: metadata.actorId } : {}),
      ...(metadata?.reason ? { reason: metadata.reason } : {}),
    };

    this.history.push(record);
    this.currentState = to;
  }

  restore(state: S): void {
    this.currentState = state;
  }
}

export type RunState =
  | "created"
  | "admitted"
  | "running"
  | "waiting"
  | "paused"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export const RUN_TRANSITIONS: TransitionTable<RunState> = {
  created: ["admitted", "cancelled"],
  admitted: ["running", "cancelled"],
  running: ["waiting", "paused", "cancelling", "completed", "failed", "cancelled"],
  waiting: ["running", "paused", "cancelling", "completed", "failed", "cancelled"],
  paused: ["running", "cancelling", "cancelled"],
  cancelling: ["cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export class RunStateMachine extends StateMachine<RunState> {
  constructor(initialState: RunState = "created") {
    super(initialState, RUN_TRANSITIONS);
  }
}
