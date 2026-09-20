# AgentiCOS Iteration Architecture

## Objective

AgentiCOS is intended to be built and improved through frequent AI-assisted iterations. The architecture must make every iteration additive, testable and compatible with previous work.

The primary rule is:

> Every iteration must leave behind a working, integrated product increment. No speculative subsystem is considered complete merely because its files compile.

## Vertical-slice rule

A feature is implemented as a vertical slice through the existing architecture.

```text
User goal
   ↓
UI surface
   ↓
Application protocol
   ↓
Runtime/domain contract
   ↓
Real service
   ↓
Persistence
   ↓
Verification
```

The first slice may use a deterministic test adapter where the real external system does not yet exist, but the adapter must implement the exact production contract. The test adapter is not a parallel architecture.

## Feature maturity ladder

Every major feature progresses through:

1. UX contract — what the user sees and can do.
2. Surface shell — routes, window/panel, navigation and empty/loading/error states.
3. Protocol contract — request/response/event shapes.
4. State contract — durable objects and lifecycle.
5. Real implementation — actual provider/tool/runtime behavior.
6. Persistence — restart/reconnect semantics.
7. Failure behavior — timeout, cancellation, retry and recovery.
8. Security — permissions, secrets and sandbox.
9. Observability — events, metrics and audit.
10. Tests — unit, contract, integration and user-visible checks.
11. Optimization — caching, batching and performance.

A slice can be released at an intermediate level only when its current behavior is honest and explicitly labeled as limited.

## Rule against dead-end work

Do not create a subsystem only because it may be useful later.

Before adding a package, identify:
- the user/product capability it enables;
- the domain owner;
- the contract it consumes/exports;
- the first vertical slice that exercises it;
- the test that proves integration.

If a package cannot answer these questions, it belongs in research/design rather than the production tree.

## Rule against rewrites

Every slice must consume existing contracts and expose new capability through them.

Do not implement temporary APIs that will later be replaced by the final API unless the temporary interface is explicitly declared as a test fixture.

## AI implementation loop

Every coding iteration should execute:

```text
READ architecture
   ↓
READ current feature manifest
   ↓
UNDERSTAND existing contracts
   ↓
PLAN one slice
   ↓
IMPLEMENT smallest integrated increment
   ↓
RUN tests/typecheck/build
   ↓
RUN application smoke test
   ↓
VERIFY no dependency boundary was bypassed
   ↓
UPDATE docs/manifest
   ↓
STOP at a stable checkpoint
```

The next iteration starts from that checkpoint rather than rebuilding the feature from scratch.

## No parallel architectures

A new iteration must not create:
- a second chat state store;
- a second agent loop;
- a second provider interface;
- a second tool invocation path;
- a UI-only persistence layer;
- a feature-specific permission system;
- a feature-specific event protocol.

If a new requirement cannot fit an existing boundary, update the architecture explicitly before implementing the requirement.

## AI-friendly implementation

The repository must keep architecture documents, contracts, feature manifests and acceptance tests close enough that an AI coding agent can discover the required path before editing code.

Every feature therefore has a small machine-readable manifest describing:
- status;
- owning domain;
- UI entry points;
- protocols;
- dependencies;
- persistence;
- permissions;
- tests;
- next slice.