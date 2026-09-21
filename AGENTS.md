# AgentiCOS AI Agent Operating Rules

Repository-level operating contract for Devin and every other AI coding agent.

## Before editing

Read, in order:
1. `reference/PROJECT-STATE.md`
2. `reference/manifests/implementation-state.json`
3. the latest entries of `reference/journal/agent-operations.jsonl`
4. `docs/architecture/AGENT-CONTINUITY-PROTOCOL.md`
5. the current step acceptance contract and relevant reference evidence.

If these sources contradict each other, stop. Do not guess. Run the repository consistency verifier before making a state-changing implementation decision.

## One-step rule

Only the step named by `implementation-state.json.current_step` is authorized for new implementation work.
Other `pending` records are explicit backlog only and are not authorized.
A step may depend on any earlier verified requirement; the dependency graph, not array position alone, is authoritative.
Do not pre-implement later product capabilities.
Superseded records are historical only and must never be reactivated implicitly.

## Preserve by default

Never delete, force-reset, rewrite or silently replace code, data, contracts, schemas, manifests, reference evidence or journal history.
Deletion requires explicit authorization, a rollback point, impact analysis, post-change verification and a journal record.

## Reference-first rule

For non-trivial implementation, consult the relevant registered repositories and exact source evidence before designing from model memory.
Do not claim behavior, API compatibility, licensing or provenance that repository evidence does not establish.

## Verification rule

Never mark VERIFIED merely because code exists.
A step becomes VERIFIED only after every required check in its manifest has recorded evidence. Unavailable checks remain UNVERIFIED or BLOCKED.
A VERIFIED vertical slice means its declared acceptance contract was verified; it does not imply production completeness of every future capability behind that boundary.


## Required operation report

Every operation must record what changed, what was created, what was deleted, what was preserved, verification evidence, unverified checks, risks, rollback point and exactly one next step.

## Continuity gate

Run `npm run verify` before declaring the current operation complete.
The repository state, not conversational memory, is the source of truth.

## State reconciliation rule

When implementation history and the current manifest disagree, preserve the historical evidence and repair the current projection. Never fabricate verification to make the graph contiguous.
The current step must exist, have verified requirements, and have a matching entry in `reference/manifests/step-scope-policy.json`.

