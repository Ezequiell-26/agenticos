# AgentiCOS Observability and Agent Evaluation

## Observability layers

```text
Product events
     ↓
Run timeline
     ↓
Metrics / traces / logs
     ↓
Evaluation records
     ↓
Regression datasets
```

## Trace model

Every operation has correlation:
- trace ID;
- run ID;
- thread ID;
- turn ID;
- step ID;
- tool call ID;
- provider request ID where available;
- child run ID.

## Metrics

Provider metrics:
- latency;
- token usage;
- errors;
- retries;
- rate limits;
- quota exhaustion;
- cost.

Agent metrics:
- task duration;
- steps;
- tool calls;
- failed repairs;
- child runs;
- context size;
- completion status.

## Evaluation

Agent quality must not be inferred from whether the model says it succeeded.

Evaluation can combine:
- deterministic tests;
- schema validation;
- build/test results;
- policy checks;
- reference answers;
- human review;
- artifact inspection.

## Replay

A run should be replayable with:
- recorded model inputs/outputs where permitted;
- mocked provider calls;
- mocked tool results;
- fixed clock/randomness where practical.

Replay is the foundation for regression testing agent behavior.

## Golden tasks

Maintain curated tasks for:
- coding;
- research;
- browser automation;
- file operations;
- multi-agent delegation;
- provider fallback;
- long-running recovery.

Every runtime change should report which golden tasks changed behavior.