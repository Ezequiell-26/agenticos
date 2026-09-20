# AgentiCOS — Product Architecture

Status: Architecture-first / pre-implementation.
This is the source of truth for the product architecture.

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

## Reference principles

Hermes contributes the reusable-agent and broad operational model: provider resolution, tools/toolsets, persistent memory, skills, context files, delegation, scheduling, gateway and multiple execution backends.

DeepSeek Harness contributes plugin-first composition, profiles, bundles, typed events and durable session architecture.

Codex contributes the typed app-server boundary, explicit Thread/Turn/Item semantics, bounded context, separate approval/sandbox policy axes and external execution boundaries.

Antigravity contributes the agent-first workspace model, asynchronous parallel agents, browser operation and artifacts/transparency as product primitives.

AgentiCOS unifies these patterns through its own contracts rather than becoming a literal fork of any one product.

## Target system shape

PRODUCT SURFACES -> APPLICATION PROTOCOL -> AGENT RUNTIME -> DOMAIN SERVICES -> KERNEL -> INFRASTRUCTURE

Domain services include Providers, Router, Tools, Sandbox, Context, Memory, Skills, Workflows, Agents, Projects, Artifacts, Plugins, Gateway, Observability, Security and Source Forge.

## Architecture-first rule

Do not implement a major feature until it has a domain owner, public contract, state model, lifecycle, permission model, observability, failure/recovery semantics, compatibility/versioning strategy and tests.