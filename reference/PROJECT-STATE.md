# AgentiCOS Project State

> Canonical current-state snapshot. The repository uses capability-driven continuous development. Git history preserves prior sequential-state records; the active state no longer blocks unrelated engineering work.

## Current truth

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: **capability-driven-continuous**
- Current focus: backend-runtime
- Current operation status: in_progress
- Backend hardening now includes durable retry backoff, GitHub write authorization, sandbox limits, request correlation, token-aware quotas and ranked memory retrieval.
- Canonical runtime: Rust + Tokio
- Desktop surface: Tauri 2 + React + TypeScript + Vite
- Third-party canonical source policy: MIT/compatible license + provenance + exact revision before integration
- Destructive AI operations: disabled by default
- Parallel workstreams: enabled

## Why the development model changed

The previous `sequential-verified` implementation manifest required one numbered step to be verified before any other capability could be advanced. In practice this caused unrelated backend work to wait on a narrow integration-test gate and encouraged repeated CI churn.

The new model separates:

- **workstream state** — what area is actively being engineered;
- **capability state** — whether an individual capability is planned, implemented, verified or blocked;
- **verification state** — which checks have actual evidence;
- **Git history** — the immutable record of prior implementation.

The old sequential manifest is preserved in Git history and is not used as the active development lock.

## Active workstreams

- **backend-runtime (P0):** durable runs, jobs, workers, recovery and API control plane.
- **provider-plane (P0):** providers, model catalog, routing, retry, quota, failover and capability normalization.
- **agent-orchestration (P0):** Brain, planners, subagents, verification and repair.
- **tool-mcp (P0):** typed tools, MCP, capability authorization and sandbox.
- **memory-context (P1):** durable memory, context budgeting, compression, retrieval and provenance.
- **observability-control-plane (P1):** tracing, metrics, audit, health and operational diagnostics.
- **desktop-integration (P1):** typed UI/runtime integration.
- **source-and-evaluation (P2):** Source Forge, reference ingestion, replay and regression evaluation.

## Verification truth

A capability is not considered verified merely because source code exists.

Verification evidence is tracked per capability/workstream and must include the relevant automated checks. Current newer backend changes require fresh CI evidence; historical green results remain historical evidence only.

The global verification suite includes:

- `npm run continuity:verify`
- `npm run state:verify`
- `npm run check`
- `npm run test`
- `cargo fmt --all -- --check`
- `cargo check --workspace --all-targets`
- `cargo test --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`
- architecture and dependency boundary checks
- provider integration coverage

## Anti-regression rule

Development may proceed in parallel, but every change must preserve:

1. domain/application/infrastructure dependency direction;
2. capability and sandbox authorization;
3. durable run identity and recovery semantics;
4. provider credential isolation;
5. versioned cross-boundary contracts;
6. provenance and license evidence;
7. existing verified behavior.

A failing check blocks the affected capability or release path; it does not automatically freeze unrelated workstreams.

## Current operation

A2A is implemented in its dedicated infrastructure crate and exposed through the API; it remains unverified until fresh CI evidence is available.

The active operation is the backend architecture refactor and runtime hardening. It is intentionally allowed to touch related backend capabilities when their contracts and boundaries are preserved.

## Next actions

Continue backend work by capability rather than by numbered implementation step. Prioritize durable worker state, persistent jobs, real provider routing, complete tool/MCP execution, context/token optimization and runtime observability. Promote individual capabilities to verified only after their evidence exists.
