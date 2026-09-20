# AgentiCOS Multi-Agent Orchestration

## Agent topology

```text
                    Supervisor
                       │
           ┌───────────┼───────────┐
           ↓           ↓           ↓
       Research       Code       Review
           │           │           │
           └───────────┼───────────┘
                       ↓
                    Synthesis
```

## Agent templates

A reusable agent definition declares:
- role;
- objective policy;
- system/instruction source;
- allowed tools;
- allowed providers;
- skill set;
- sandbox profile;
- output schema;
- cost/resource budget.

## Child-run isolation

Each child gets:
- unique run ID;
- bounded context;
- separate approval scope;
- explicit workspace roots;
- independent cancellation;
- resource budget;
- typed return channel.

## Parallel execution

The scheduler supports DAG-based execution:

```text
A ──┐
    ├──→ D ──→ E
B ──┤
    └──→ C ──┘
```

Independent nodes may execute concurrently.

## Fan-out controls

The orchestrator enforces:
- maximum child count;
- depth limit;
- total token budget;
- total wall-clock budget;
- filesystem concurrency limits;
- external request limits.

## Agent handoff

A handoff should transfer only the minimum information needed.

Use artifact/result references instead of copying entire histories between agents.

## Agent role separation

A planning agent can be prohibited from changing files.
A coding agent can write only its assigned workspace.
A reviewer can be read-only.
A deployment agent can require explicit approval.

## Consensus/review

Critical results can require:
- one reviewer;
- multiple independent reviewers;
- deterministic tests;
- policy checks;
- user approval.

The system should prefer evidence over model self-assessment.