# AgentiCOS Project State

> Canonical current-state snapshot. The repository uses capability-driven continuous development. Git history preserves prior sequential-state records; the active state no longer blocks unrelated engineering work.

## Current truth

- Repository: `Ezequiell-26/agenticos`
- Architecture mode: **capability-driven-continuous**
- Current focus: backend-runtime
- Current operation status: in_progress
- Fresh mainline CI run 2771 on commit `3f766a8dcb543c45afaf0d10bb56c2a05477be38`: **green** across Rust (31/31 steps), TypeScript (18/18 steps) and desktop UI/API/provider E2E (20/20 steps). This is the latest post-merge mainline evidence as of 2026-10-11 UTC.
- Strict sandbox isolation was previously verified by mainline CI run 2746.
- Backend hardening now includes durable run ownership leases/recovery, durable retry backoff, GitHub write authorization, bounded sandbox execution plus strict workspace isolation, request correlation, token-aware quotas and ranked memory retrieval.
- Canonical runtime: Rust + Tokio
- Desktop surface: Tauri 2 + React + TypeScript + Vite
- Desktop/API/provider vertical slice: verified by current mainline CI run 2681, including UI request, provider response and persisted history after reload.
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

## Verification delta

- Fresh mainline CI run 2756 verified the new runtime integration coverage added in commit 43fb33cad016db50645891311286b8e34441e1ed, including semantic-memory backfill/evaluation, subagent child-run creation, workflow restart recovery, MCP stdio discovery/call gating, and persisted skill activation.

## Active workstreams

- **backend-runtime (P0):** durable runs, jobs, workers, ownership leases, recovery and API control plane.
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

A2A is implemented in its dedicated infrastructure crate and exposed through the API; it remains unverified until fresh capability-specific evidence is available.

The first desktop integration vertical slice is now verified: the React/Vite surface reaches the typed `runtime.ts` boundary, calls the Rust API, reaches an OpenAI-compatible provider fixture, receives the assistant response, and reloads with the persisted conversation history.

The active operation is the backend architecture refactor and runtime hardening. The current main branch includes workflow/subagent execution, capability-gated approvals/tools, multi-provider routing and streaming token accounting, durable scheduler retries/lease recovery, durable run-level leases with restart recovery, ranked memory retrieval, optional real browser automation, GitHub write/delete operations, request correlation, strict sandbox workspace isolation, durable outbox persistence with idempotent retries/dead-letter, A2A and CQRS run projection. Auxiliary SQLite persistence schemas are versioned under migration 0004 and now use a canonical bootstrap path across runtime infrastructure; source-intelligence persistence is behind a domain port with its SQLite adapter in source-forge. Mainline CI run 2771 on commit `3f766a8dcb543c45afaf0d10bb56c2a05477be38` is green across Rust, TypeScript and desktop UI+API+provider E2E.

## Runtime reliability updates (2026-10-12)

- PR #103 (commit 59f16dacacd7653e09d8ee1a753ec8b8a285ca47) hardens BasicAgentEngine::resume_run: post-lease failures now attempt to transition the run to Failed and release the lease. The context-read failure regression ran in mainline CI #2764.
- PR #104 (commit f3fb6325d598ba8a5e6c15bf40fe89741fd7033f) turns model-selected tool denials and explicit failed tool responses into ReAct observations, keeps unrelated runtime failures fatal, prevents raw repeated tool JSON from being returned as the final answer, and adds a mandatory kernel tool-recovery test step. Mainline CI #2769 passed.
- PR #105 (commit 3f766a8dcb543c45afaf0d10bb56c2a05477be38) handles the allow-listed echo command internally, without launching a shell, so it behaves consistently on Windows. The local Windows kernel suite passed 103/103 tests; PR CI #2770 and post-merge mainline CI #2771 passed.
- Local runtime smoke checks: API /ready on port 8080 returned HTTP 200, Vite on port 5199 returned HTTP 200, and Ollama exposed qwen2.5:3b. A live /api/agent/chat smoke request returned HTTP 200 with a Completed run when asked about an unavailable tool. This complements unit coverage; it does not by itself prove every tool-provider integration is production-complete.
- The broad agent-engine and tool-plane capabilities remain implemented-unverified. Focused fixes and green CI do not close the remaining model-loop, authorization, durable context/run-registry, provider transport or evaluation gaps.

## Next actions

Continue backend work by capability rather than by numbered implementation step. The desktop + API + provider vertical slice, SQLite migration authority, source-intelligence persistence boundaries, strict sandbox boundary, semantic-memory retrieval/backfill, subagents, workflows, MCP, skill activation and the focused runtime fixes above have current or capability-specific CI evidence. Next, verify whether provider health/readiness is refreshed automatically at API startup, then prioritize evaluation/replay fixtures and the remaining broader runtime integration gaps for the AgentEngine/model loop, provider transport, tool capability validation and durable run/context registry. Promote individual capabilities to verified only after their declared acceptance evidence exists.
