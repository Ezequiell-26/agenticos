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

Only the step named by `implementation-state.json.current_step` is authorized.
Do not pre-implement later product capabilities.

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


## Frontend-specific continuity

Before changing `crates/presentation/desktop/frontend/**`, also read:

- `docs/architecture/CANONICAL-ARCHITECTURE.md`
- `docs/architecture/FRONTEND-ARCHITECTURE.md`
- `docs/architecture/FRONTEND-CHANGELOG.md`
- `docs/ai/SKILLS-CATALOG.md`
- the relevant file under `skills/agenticos-*/SKILL.md`

Every frontend change must append a changelog entry and an operation-journal entry in the same operation. The changelog is append-only.

Do not start a dev server and assume it works. When frontend runtime verification is authorized, use the browser verification procedure and record evidence.

The presence of existing UI code does not override the sequential implementation state. Future frontend implementation must use the step currently authorized by `reference/manifests/implementation-state.json`.
