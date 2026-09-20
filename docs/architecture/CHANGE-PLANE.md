# AgentiCOS Change Plane

The Change Plane is the controlled execution path used when AI or automation modifies the AgentiCOS codebase or a managed workspace.

request
 ↓
impact analysis
 ↓
snapshot
 ↓
patch
 ↓
static validation
 ↓
typecheck
 ↓
tests
 ↓
architecture guard
 ↓
security/migration checks
 ↓
replay when applicable
 ↓
promotion

## Rules

1. Never apply an AI-generated patch directly to the canonical branch without verification.
2. Every change has a workspace identity and a change or operation identity.
3. A patch is evaluated against the architecture and contract registry.
4. Verification failures trigger bounded repair, never unbounded loops.
5. Every accepted patch leaves a stable checkpoint.
6. A rejected patch can be rolled back to its pre-change snapshot.

The current codebase exposes snapshot primitives and gate contracts; the filesystem/git executor is an adapter that must run inside the selected sandbox policy.

## Continuity gate

Every change operation is paired with a durable operation report.

The report is created before the operation begins and completed after verification. The report must enumerate:

- previous checkpoint;
- allowed/forbidden scope;
- files planned and affected;
- creations/modifications/deletions;
- preserved assets;
- reference evidence;
- verification results;
- unverified checks;
- regression assessment;
- rollback point;
- next authorized step.

The Change Plane rejects silent deletions, history rewrites and unrecorded destructive changes. A failed verification remains FAILED/BLOCKED until corrected and re-verified.

