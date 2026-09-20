# AgentiCOS Sequential Implementation Protocol

## Purpose

AgentiCOS is built as a sequence of independently verified vertical slices. An AI coding agent must never implement multiple future slices in one uncontrolled pass.

## State machine

```
PENDING
  ↓
IN_PROGRESS
  ↓
VERIFYING
  ├──→ FAILED → CORRECTING → VERIFYING
  ↓
VERIFIED
  ↓
UNLOCKED_NEXT
```

Only `VERIFIED` can unlock the next implementation step.

## Mandatory step transaction

For every implementation step the agent must:

1. load the architecture source of truth and current step manifest;
2. identify the exact acceptance contract for the current step;
3. retrieve relevant Reference Knowledge Corpus evidence;
4. record the references and intended adaptations before coding;
5. change only files authorized by the current step;
6. run formatting, compilation/type checks and targeted tests;
7. run architecture, contract, security and provenance gates applicable to the step;
8. verify persistence/recovery semantics when the step touches durable state;
9. inspect the diff for scope creep and accidental contract changes;
10. record verification evidence;
11. mark the step `VERIFIED` only when every required gate passes;
12. unlock exactly one next step.

## Fail-closed rules

A step cannot advance when any required gate is unavailable, skipped, flaky, or failed.

A failed check must produce a correction cycle. The agent must not work around a failed gate by weakening, deleting or bypassing the check.

The agent must not pre-implement code belonging to future steps merely because it is convenient.

## Scope lock

Each step manifest declares:

- allowed files/directories;
- required contracts;
- required reference evidence;
- required checks;
- forbidden future dependencies;
- recovery requirements;
- exit criteria.

The implementation agent must treat the manifest as an authorization boundary.

## Evidence ledger

Every step records:

`requirement → contract → reference evidence → changed files → verification evidence`

This makes iterative AI development resumable and auditable.

## Recovery

A disconnected client must not lose step state. Step status is durable and monotonic except for explicit correction/retry transitions.

## Step 0

The architecture foundation is the only step completed before functional implementation starts. Its role is to make the runtime, contracts, protocols, gates, provenance rules and sequential workflow executable.

Functional Step 1 remains locked until the architecture foundation checks pass in CI.


## State projection integrity

`reference/manifests/implementation-state.json` is the machine-readable source of truth for implementation progression.

`reference/PROJECT-STATE.md` must project the same current step and status. CI executes `scripts/verify-project-consistency.mjs` and fails when these representations disagree.

A verified predecessor unlocks exactly one successor. Existing architectural seams do not authorize future implementation.

## AI agent concurrency rule

Multiple AI agents may inspect the repository concurrently, but only one logical implementation step may be active. Overlapping implementation attempts must stop rather than merge incompatible assumptions.
