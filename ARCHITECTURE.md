# AgentiCOS — Product Architecture

Status: Architecture-first / hardened implementation foundation.
This is the source of truth for the product architecture.

## Global invariants

1. No model vendor is hard-coded into the agent core.
2. No tool bypasses policy and sandbox infrastructure.
3. No secret is placed into model context accidentally.
4. No UI contains a second agent loop.
5. Durable state never exists only in UI memory.
6. Every model-visible input has provenance.
7. Every external action has a run/item identity.
8. Child agents are isolated and budgeted.
9. Context has explicit size limits.
10. Provider failures are recoverable.
11. Plugin activation failure cannot corrupt the runtime.
12. Third-party source provenance is preserved.
13. Persisted schema changes are versioned and migratable.
14. Dangerous permissions are explicit.
15. A disconnected client does not imply a lost background run.
16. Illegal state transitions are rejected.
17. Retryable side effects use idempotency keys.
18. Worker ownership is protected by leases and fencing.
19. Durable event publication uses an outbox/inbox boundary.
20. AI-generated code changes pass Change Plane gates before promotion.
21. Execution and repair loops are bounded by explicit budgets.
22. Workspace changes have a rollback/snapshot path.

## Hardened control flow

TypeScript strictness -> executable contract registry -> architecture guard -> contract and recovery tests -> CI verification and dependency audit -> Change Plane promotion.

A failed structural or behavioral gate is a hard stop. Architecture exceptions require an explicit documented change.

## Durable state and recovery

Runs use strict state machines. Retryable side effects use idempotency. Distributed execution uses leases and fencing. Durable events use outbox/inbox patterns. Workspace mutations use snapshots and rollback semantics.

The repository includes in-memory reference adapters for these contracts. Production deployments must provide transactional, durable implementations behind the same interfaces.

See docs/architecture/CONTRACTS.md, ITERATION-ARCHITECTURE.md, ITERATION-GATES.md, STATE-RECOVERY.md, CHANGE-PLANE.md and ARCHITECTURE-ENFORCEMENT.md for detailed rules.

The remaining universal-provider, agent interoperability, Source Forge, plugin and execution architecture described below remains canonical.

## Product definition

AgentiCOS is a universal, model-agnostic agent runtime and application platform. It combines AI providers, models, tools, skills, memory, workflows, subagents, sandboxes, channels and developer surfaces behind one durable execution model.

The product must support user-owned free-tier APIs, paid APIs, local models and arbitrary compatible endpoints without coupling the agent core to a vendor.

## Architectural strategy

AgentiCOS uses a small microkernel with pluggable domains around it.

The kernel owns only lifecycle, stable IDs, correlation, cancellation, event transport, contract/version negotiation, persistence boundaries, plugin lifecycle, capability primitives, policy hooks, and normalized error/recovery semantics.

Feature domains must remain replaceable. The kernel must never depend on a specific model vendor, UI, browser implementation or storage vendor.

## Primary object model

User/Profile -> Workspace -> Project -> Thread -> Turn -> Step -> Item.

A durable Task/Run owns execution. A Thread owns conversational/context lineage. A Turn is one model-driven work cycle. A Step is one model/tool iteration. Items are typed and bounded observable units.

## Execution model

Request -> Admission -> Policy -> Context -> Model routing -> Plan/Act -> Tool execution -> Observation -> Verification -> Repair loop if required -> Artifact publication -> Durable commit -> Completion.

Cancellation is first-class. Long-running work must survive client disconnects and may be resumed.

## Universal interoperability principle

Any AI means any model or service that can be represented by an existing protocol adapter or a new adapter/plugin, not a hard-coded vendor list.

The Provider layer separates model, provider, account/credential, endpoint, proxy/gateway hop, protocol and capabilities.

Initial protocol families include OpenAI Chat Completions, OpenAI Responses, Anthropic Messages, Google Gemini, generic HTTP/JSON, local inference APIs, MCP, A2A and AgentiCOS application/engine/plugin protocols.

## Agent interoperability

MCP is the vertical capability plane for tools/context/integrations. A2A is the horizontal collaboration plane for independent agents. Remote agents are untrusted external principals.

## Resource and autonomy

Every run can be bounded by duration, steps, child agents, tool calls, tokens, cost and infrastructure resources. Client disconnect does not terminate a durable run unless policy says so.

## Architecture completion rule

Before broad implementation, the completeness matrix must have a conceptual owner for model/provider/proxy interoperability, multimodal execution, agent interoperability, tools/MCP, skills/memory/context, sandbox/security, scheduling/resources, persistence/recovery, protocols/surfaces, Source Forge and observability/evaluation.
