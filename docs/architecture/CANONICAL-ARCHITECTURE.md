# AgentiCOS — Canonical Architecture

## 1. System identity

AgentiCOS is a Rust-first universal AI agent runtime and product platform.

The **Brain is the orchestration layer**, not a model and not a provider. It coordinates model selection, capability selection, context, memory, tools, MCP, source intelligence, planning, execution, verification, recovery and resource governance.

The product surface is intentionally decoupled from the runtime:

- **Rust + Tokio** — canonical runtime, Brain, application services and infrastructure.
- **Tauri 2** — desktop shell and secure native boundary.
- **TypeScript + React + Vite** — desktop product UI.
- **Monaco Editor** — target code-editor surface.
- **HTTP/RPC/IPC contracts** — stable seams between UI and runtime.

No UI framework becomes part of the Brain.

## 2. Canonical dependency direction

```
presentation
    ↓
application
    ↓
domain
    ↑
infrastructure implements domain/application ports
    ↑
utilities are reusable implementation primitives
```

Canonical ownership:

```
crates/
├── domain/
│   ├── contracts/          # Stable public/internal contracts
│   └── brain/              # Brain abstractions and policy-level intelligence
│
├── application/
│   ├── agents/
│   ├── execution/
│   ├── scheduler/
│   ├── workflows/
│   ├── projects/
│   └── skills/
│
├── infrastructure/
│   ├── kernel/
│   ├── runtime/
│   ├── providers/
│   ├── tools/
│   ├── mcp/
│   ├── memory/
│   ├── context/
│   ├── protocols/
│   ├── source-forge/
│   ├── observability/
│   ├── evaluation/
│   ├── security/
│   ├── sandbox/
│   ├── adapters/
│   ├── artifacts/
│   ├── plugins/
│   └── router/
│
├── presentation/
│   ├── cli/
│   ├── gateway/
│   ├── desktop/
│   └── api-server/
│
└── utilities/
    └── cross-cutting reusable infrastructure
```

The exact workspace may temporarily contain fewer target crates. A planned crate is not treated as implemented until it exists, is registered and is verified.

## 3. Brain contract

The Brain must remain structurally independent of:

- a concrete model;
- a concrete provider;
- a concrete tool;
- a concrete MCP server;
- a concrete repository;
- a concrete UI.

The Brain selects capabilities through registries and contracts.

Core control loop:

```
OBSERVE
  → UNDERSTAND
  → PLAN
  → SELECT MODEL
  → SELECT CONTEXT
  → SELECT CAPABILITIES
  → EXECUTE
  → VERIFY
  → REPAIR
  → LEARN
  → DONE
```

Model intelligence is adaptive at orchestration level. AgentiCOS may improve effective task performance through routing, context engineering, memory, tool selection, verification, repair, caching and resource governance. It must never claim that orchestration changed model weights unless it actually did.

## 4. Capability model

Every capability should have a stable identity and metadata covering, where applicable:

- capability ID and version;
- origin and provenance;
- license;
- supported platforms;
- compatibility;
- dependencies;
- permissions;
- cost/quota characteristics;
- resource consumption;
- evidence and verification status.

Capability discovery is dynamic. Product code must not hard-code the universe of available capabilities.

## 5. External repository policy

Third-party repositories are controlled sources, not automatic dependencies.

Admission flow:

```
discover
→ resolve exact source
→ verify license
→ record provenance
→ inspect docs/source/tests/CI/security/dependencies
→ classify integration mode
→ pin exact version/commit
→ integrate or index
→ verify
```

Allowed modes:

1. **vendored** — foundational code with compatible licensing and a justified maintenance boundary.
2. **adapter/plugin** — external API/runtime exposed through a stable AgentiCOS contract.
3. **isolated-process** — incompatible or heavyweight runtimes separated from the core process.
4. **knowledge-source** — source is learned/indexed without copying it into the runtime.

MIT status of a repository does not automatically make every dependency or file inside that repository MIT. License and provenance checks remain mandatory.

## 6. Source Intelligence and Knowledge

Large repository corpora must never be loaded wholesale into RAM or model context.

The ingestion pipeline is incremental:

```
discover
→ license/security admission
→ fetch selected revision
→ parse
→ normalize
→ deduplicate
→ index
→ store provenance
→ retrieve selectively
```

Knowledge is retrieved by relevance and task scope, not by dumping the full corpus into a prompt.

## 7. Resource governance

Resource budgets are first-class contracts for:

- RAM;
- CPU;
- disk;
- network;
- concurrency;
- model tokens;
- provider quotas;
- latency.

Required controls include:

- bounded queues;
- backpressure;
- cancellation;
- timeouts;
- bounded caches;
- eviction;
- output spill storage;
- context trimming/compression;
- duplicate suppression;
- rate limiting;
- graceful degradation.

## 8. Persistence and recovery

Durable operations must use stable identifiers and explicit lifecycle state.

Required concepts include:

- RunId;
- session/thread identity;
- event identity;
- checkpoints/snapshots;
- outbox/inbox;
- idempotency;
- leases/fencing;
- recovery state;
- rollback metadata.

UI state is not the source of truth for durable AI work.

## 9. Desktop/frontend architecture

The desktop application lives under:

`crates/presentation/desktop/frontend/`

Target frontend structure:

```
frontend/src/
├── app/                    # app bootstrap, routing, providers
├── components/
│   ├── ui/                 # design-system primitives
│   ├── layout/             # shell/chrome
│   └── shared/             # reusable product components
├── features/
│   ├── chat/
│   ├── runs/
│   ├── editor/
│   ├── terminal/
│   ├── providers/
│   ├── capabilities/
│   ├── memory/
│   ├── knowledge/
│   └── settings/
├── services/               # typed ports to HTTP/RPC/Tauri
├── state/                  # local UI/session state
├── hooks/
├── lib/
├── types/
├── styles/
└── tests/
```

Rules:

- React components do not contain raw backend transport logic.
- Use typed services for API/IPC boundaries.
- Feature state remains local to the feature unless it is truly cross-feature.
- No direct dependency from frontend UI to Rust internals.
- No provider API keys in the frontend.
- Durable AI generations and runs are persisted by the runtime.
- Loading, empty, error, streaming, cancellation and recovery states are designed explicitly.
- The UI may optimistically render local state, but server/runtime state remains authoritative.

See `FRONTEND-ARCHITECTURE.md` for the detailed contract.

## 10. Design system

The frontend design system is token-first.

Baseline:

- dark-first developer/AI workspace;
- semantic color tokens;
- consistent typography;
- compact but readable density;
- keyboard-first interaction;
- accessible focus states;
- quiet iconography;
- restrained radius and borders;
- no decorative gradients/glass effects as a substitute for hierarchy.

Target component approach:

- shadcn/ui-compatible primitives;
- Tailwind tokenization;
- Geist/Geist Mono or equivalent neutral UI/code typography;
- Lucide-style iconography;
- Monaco for code editing.

A component must be composed from design tokens rather than arbitrary per-component colors and spacing.

## 11. AI UI

AI UI must model real agent lifecycle, not only a text chat.

The interface needs explicit representations for:

- user/assistant messages;
- streaming;
- tool calls;
- tool results;
- approvals;
- errors;
- retries;
- cancellation;
- run status;
- agent activity;
- artifacts;
- citations/provenance;
- token/cost/latency metadata where exposed.

Vercel AI SDK/AI Elements may be used at the product surface when a capability is appropriate. They must not become a structural dependency of the Rust runtime.

## 12. Verification

Every implementation change must preserve the architecture contract.

Required verification categories:

- repository continuity/state consistency;
- Rust format/check/test/clippy;
- TypeScript typecheck/tests;
- architecture boundary gate;
- dependency inheritance gate;
- duplicate critical dependency gate;
- frontend architecture gate;
- browser verification for running frontends;
- Windows/Tauri build checks before release.

Never call a check verified without recorded evidence.

## 13. AI change-control contract

Before an AI agent modifies the repository it must:

1. read current project state;
2. read implementation-state and identify relevant workstreams/capabilities;
3. read the latest operation journal;
4. read the relevant architecture and contract evidence;
5. inspect the current code/evidence;
6. declare the concrete capability/file scope and dependencies;
7. implement the smallest coherent vertical slice;
8. verify the affected capability and run broader checks when relevant;
9. record the operation and evidence;
10. state the next concrete actions and unresolved risks.

Independent workstreams may proceed in parallel. A failing check blocks the affected capability or release path, not unrelated capabilities.

Destructive changes require explicit authorization, rollback metadata and impact evidence.

## 14. Architectural non-goals

AgentiCOS will not become:

- a monolithic crate containing every provider and tool;
- a frontend that directly owns runtime orchestration;
- an unbounded repository mirror in RAM;
- a provider-specific agent framework;
- an undocumented collection of copied repositories;
- a system where generated code is considered correct merely because it compiles.

The architecture is designed so that new models, providers, tools, protocols, repositories and UI features can be added without rewriting the Brain.
