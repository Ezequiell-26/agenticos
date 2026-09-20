# AgentiCOS Execution Model

## Durable hierarchy

```text
Workspace
  └── Project
        └── Task / Run
              └── Thread
                    └── Turn
                          └── Step
                                └── Item
```

## Item types

- user input;
- system/context fragment;
- assistant message;
- model request/response;
- tool call/result;
- approval request/decision;
- child-run reference/result;
- artifact reference;
- status/error;
- verification result.

Items are typed, bounded and independently observable.

## Run state machine

```text
created -> admitted -> running -> waiting -> running -> completed
                         |
                         +-> waiting-for-approval
                         |
                         +-> paused
                         |
                         +-> failed
                         |
                         +-> cancelled
```

Terminal states are immutable. A retry creates a new attempt under the same logical run rather than mutating history.

## Turn lifecycle

1. Claim the next input.
2. Evaluate policies.
3. Assemble bounded context.
4. Resolve provider/model.
5. Start model request.
6. Process streamed model output.
7. Dispatch requested tools.
8. Persist tool results.
9. Continue the turn when more work is owed.
10. Verify the claimed result.
11. Publish artifacts/results.
12. Commit durable completion state.

## Retry semantics

Provider retries must be limited and classified.
Tool retries require idempotency metadata.
Workflow retries are explicit policy.
A failed child run returns a typed failure result to its parent.

## Cancellation

Cancellation propagates from parent run to active turn, provider request, tool call and child runs. Components must observe cancellation cooperatively and release resources.

## Resume

A client reconnects by run ID/thread ID and receives current durable state plus live events from the current sequence boundary.

## Event model

Events are divided into:
- durable domain events;
- ephemeral progress events;
- client protocol notifications.

Durable events are the source of truth. Projections are derived.