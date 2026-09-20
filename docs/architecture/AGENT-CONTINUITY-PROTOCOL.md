# AgentiCOS Agent Continuity Protocol

## Purpose

This protocol is the durable memory and anti-regression contract for every AI coding agent operating on AgentiCOS.

The repository, not the model's conversation memory, is the source of continuity.

## Mandatory read order

Before changing anything, an AI agent MUST read:

1. `reference/PROJECT-STATE.md`
2. `reference/manifests/implementation-state.json`
3. the latest entries in `reference/journal/agent-operations.jsonl`
4. `reference/manifests/agent-continuity.json`
5. the applicable architecture/contract/reference evidence.

If any required state is missing, contradictory or unreadable, the agent is BLOCKED and must not guess.

## Mandatory pre-change declaration

Before modifying files, the agent must establish:

- current commit;
- current implementation step;
- allowed scope;
- forbidden scope;
- intended files;
- repositories/references consulted;
- contracts affected;
- expected verification;
- rollback point.

This declaration is recorded in the operation report.

## Mandatory post-change report

Every operation MUST record:

- what was done;
- what was created;
- what was modified;
- what was deleted;
- what was preserved;
- exact files affected;
- checks executed;
- checks that could not be executed;
- evidence obtained;
- risks discovered;
- rollback point;
- exactly one next step.

`deleted` MUST be `none` unless explicit destructive authorization exists.

## No-hallucination rule

An agent may state only what it can support with repository state, command output, CI evidence, reference evidence or explicit user requirements.

The following are forbidden:

- claiming a test passed without its result;
- claiming CI passed without CI evidence;
- claiming code exists when it was not found;
- claiming a repository was consulted when it was not read;
- claiming a feature is complete because its documentation exists;
- inventing APIs, files, commits, versions or behavior;
- silently converting an unverified state into a verified state.

Use `UNVERIFIED` or `BLOCKED` instead of filling evidence gaps with assumptions.

## No-regression rule

The default operation is additive or corrective.

Do not:

- erase project history;
- force-reset branches;
- rewrite the journal;
- silently replace contracts;
- remove working code/data merely to simplify an implementation;
- downgrade a verified step to an earlier state;
- remove reference evidence;
- delete Cargo.lock;
- bypass architecture or security gates.

A legitimate removal must be treated as a controlled migration, not as cleanup.

## Destructive-change gate

Deletion/replacement of code, data, contracts, schemas, manifests or evidence requires all of:

1. explicit authorization;
2. a rollback snapshot/commit;
3. a change ID;
4. an impact analysis;
5. an explanation of why preservation is impossible;
6. verification after the change;
7. a journal entry recording the exact deleted paths and recovery point.

Without all seven, the operation is BLOCKED.

## Monotonic progress

Implementation state follows:

`PENDING → IN_PROGRESS → VERIFYING → CORRECTING → VERIFIED → UNLOCKED_NEXT`

Normal development may not move a verified step backward.

Rollback is a separate controlled operation and must restore to a recorded checkpoint rather than rewrite history.

## Scope lock

An agent may not implement future steps while working on the current step.

Finding a future concern is recorded as a risk or follow-up, not implemented opportunistically.

## Memory integrity

The operation journal is append-only.

Agents add a new record; they do not edit or delete previous records to make the history cleaner.

`reference/PROJECT-STATE.md` is the current snapshot. The journal is the historical record. If they disagree, the agent stops and reconciles the state explicitly.

## Continuation rule

At the end of an operation, the agent must leave the repository in a checkpoint that another AI can understand without the original conversation.

The next AI must be able to answer from repository state:

- What was completed?
- What was actually verified?
- What remains unverified?
- What must not be touched?
- What is the current step?
- What is the single next authorized step?
- Where is the rollback point?

## Completion report format

Every completed operation ends with this exact conceptual structure:

`DONE`
`CREATED: ...`
`MODIFIED: ...`
`DELETED: none | authorized paths`
`VERIFIED: ...`
`UNVERIFIED: ...`
`RISKS: ...`
`ROLLBACK: ...`
`NEXT: exactly one step`

The repository journal stores the machine-readable equivalent.

## Emergency rule

When state is contradictory, a destructive request appears, evidence is missing, or verification cannot establish correctness, the safe result is:

`BLOCKED`

The agent records why and stops the affected step. It does not improvise around the control.
