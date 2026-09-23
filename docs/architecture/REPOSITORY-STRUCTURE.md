# AgentiCOS Repository Structure

This document is the canonical map of the repository tree. It describes the implemented structure on the current `main` branch; historical layouts are archived separately.

## 1. Canonical Rust workspace

All Rust crates use exactly this manifest shape:

    crates/<layer>/<crate>/Cargo.toml

There are 40 registered workspace crates plus the repository-root workspace manifest.

### Domain
- `crates/domain/contracts`
- `crates/domain/brain`

### Application
- `crates/application/agents`
- `crates/application/execution`
- `crates/application/scheduler`
- `crates/application/workflows`

### Infrastructure
- `crates/infrastructure/adapters`
- `crates/infrastructure/evaluation`
- `crates/infrastructure/kernel`
- `crates/infrastructure/memory`
- `crates/infrastructure/observability`
- `crates/infrastructure/protocols`
- `crates/infrastructure/providers`
- `crates/infrastructure/runtime`
- `crates/infrastructure/sandbox`
- `crates/infrastructure/security`
- `crates/infrastructure/source-forge`
- `crates/infrastructure/tools`

### Presentation
- `crates/presentation/api-server`
- `crates/presentation/cli`
- `crates/presentation/desktop`
- `crates/presentation/gateway`

### Utilities
- `crates/utilities/async-utils`
- `crates/utilities/cache`
- `crates/utilities/compression`
- `crates/utilities/concurrency-stress`
- `crates/utilities/configuration`
- `crates/utilities/crypto`
- `crates/utilities/event-bus`
- `crates/utilities/file-watcher`
- `crates/utilities/http-client`
- `crates/utilities/math`
- `crates/utilities/notifications`
- `crates/utilities/rate-limiting`
- `crates/utilities/state-management`
- `crates/utilities/streaming`
- `crates/utilities/text-search`
- `crates/utilities/time-utils`
- `crates/utilities/vector-database`
- `crates/utilities/websockets`

## 2. Desktop product surface

The desktop application has one authoritative home: `crates/presentation/desktop/`.
The frontend lives at `crates/presentation/desktop/frontend/`.
The frontend is React + TypeScript + Vite and remains presentation-only; runtime ownership remains in Rust.
There is no second legacy desktop application under `crates/interface/`.

## 3. Frontend organization

    crates/presentation/desktop/frontend/
    ├── src/
    │   ├── components/     # shell, shared interaction and compatibility surfaces
    │   ├── features/       # isolated product capabilities
    │   ├── services/       # typed runtime boundary
    │   ├── types/          # UI-facing runtime types
    │   ├── navigation.ts   # centralized feature registry
    │   ├── App.tsx         # desktop composition root
    │   ├── main.tsx        # bootstrap + error boundary
    │   ├── index.css       # primary design system
    │   └── workspace-enhancements.css
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    └── tsconfig*.json

Preview/local UI state must stay visually distinct from live runtime telemetry.

## 4. Verification and control plane

- `reference/PROJECT-STATE.md` — current human-readable state.
- `reference/manifests/implementation-state.json` — authoritative sequential state machine.
- `reference/manifests/architecture-dag.json` — layer/dependency rules.
- `reference/manifests/agent-continuity.json` — AI change-control contract.
- `reference/journal/agent-operations.jsonl` — append-only operation history.
- `scripts/verify-project-consistency.mjs` — project-state gate.
- `scripts/verify-agent-continuity.mjs` — journal/continuity gate.
- `scripts/verify-architecture-boundaries.mjs` — workspace ownership, layer and manifest-shape gate.
- `scripts/verify-frontend-architecture.mjs` — frontend structure/route/service-boundary gate.

## 5. Contracts, references and docs

- `contracts/` — versioned AgentiCOS contracts.
- `protocols/schemas/` — cross-boundary schemas.
- `reference/manifests/` — machine-readable architecture and source metadata.
- `vendor/` — controlled source snapshots and manifests.
- `docs/architecture/` — current architecture documentation.
- `docs/adr/` — architectural decisions.
- `docs/archive/architecture/` — superseded proposals and historical structure analyses.

## 6. Structural invariants

The architecture gate enforces:

1. exactly one Cargo workspace manifest per registered crate;
2. no nested Cargo manifests inside a crate;
3. every crate manifest is registered in the root workspace;
4. no legacy `crates/interface` tree;
5. no legacy flat-root crates duplicated under canonical owners;
6. presentation code does not become part of the Brain/runtime;
7. frontend leaf components do not bypass runtime transport boundaries.

Historical source remains recoverable through Git history and documented evidence; it is not kept as duplicate live code.