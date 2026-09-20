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
    validateTransitionTable(transitions, initialState);
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

  transition(
    to: S,
    metadata?: Omit<StateTransition<S>, "from" | "to" | "at">,
  ): void {
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

    const at = this.clock();
    if (Number.isNaN(Date.parse(at))) {
      throw new AgentiCOSError("State transition clock returned an invalid timestamp.", {
        code: "STATE_TRANSITION_TIMESTAMP_INVALID",
        category: "VALIDATION",
      });
    }

    const record: StateTransition<S> = {
      from: this.currentState,
      to,
      at,
      ...(metadata?.actorId === undefined ? {} : { actorId: metadata.actorId }),
      ...(metadata?.reason === undefined ? {} : { reason: metadata.reason }),
    };

    this.history.push(record);
    this.currentState = to;
  }

  restore(state: S): void {
    if (!Object.prototype.hasOwnProperty.call(this.transitions, state)) {
      throw new AgentiCOSError("Cannot restore an unknown state: " + state, {
        code: "STATE_RESTORE_INVALID",
        category: "VALIDATION",
      });
    }
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

function validateTransitionTable<S extends string>(
  transitions: TransitionTable<S>,
  initialState: S,
): void {
  if (!Object.prototype.hasOwnProperty.call(transitions, initialState)) {
    throw new AgentiCOSError("Transition table does not define the initial state.", {
      code: "STATE_TABLE_INVALID",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const states = new Set(Object.keys(transitions));
  for (const [from, targets] of Object.entries(transitions)) {
    if (!Array.isArray(targets)) {
      throw new AgentiCOSError("Transition table target list is invalid for " + from, {
        code: "STATE_TABLE_INVALID",
        category: "VALIDATION",
        severity: "critical",
      });
    }

    for (const target of targets) {
      if (!states.has(target)) {
        throw new AgentiCOSError(
          `Transition table references unknown state: ${from} -> ${target}`,
          {
            code: "STATE_TABLE_INVALID",
            category: "VALIDATION",
            severity: "critical",
          },
        );
      }
    }
  }
}
