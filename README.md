# AgentiCOS

> Universal, model-agnostic AI agent runtime and desktop application platform.

AgentiCOS is a Rust-first agent platform built around a central **Brain** that orchestrates models, providers, tools, MCP, memory, knowledge, source intelligence, planning, execution, verification and resource governance.

## Key Features

- **Capability Registry**: Dynamic capability management with validation
- **Source Intelligence Engine**: Repository discovery and analysis
- **Resource Governor**: RAM, CPU, tokens and cache management
- **Memory System**: Engram-inspired session persistence with decision tracking
- **Evaluation System**: RDD-inspired review system with candidate freezing
- **Provider Platform**: Multi-provider orchestration with failover and health checks

## Architecture

The canonical architecture is documented in:

- [Canonical Architecture](docs/architecture/CANONICAL-ARCHITECTURE.md)
- [Repository Structure](docs/architecture/REPOSITORY-STRUCTURE.md)
- [Frontend Architecture](docs/architecture/FRONTEND-ARCHITECTURE.md)
- [Frontend Change Log](docs/architecture/FRONTEND-CHANGELOG.md)
- [AI Skill Catalog](docs/ai/SKILLS-CATALOG.md)
- [Implementation State](reference/manifests/implementation-state.json)
- [Project State](reference/PROJECT-STATE.md)

The dependency direction is:

```
Presentation → Application → Domain
                     ↑
              Infrastructure
                     ↑
                 Utilities
```

Rust remains the canonical runtime. The desktop product surface is Tauri 2 + React + TypeScript + Vite.

## Current state

- Capability-driven continuous development is active.
- Active workstreams and capability status are recorded in `reference/manifests/implementation-state.json`.
- Existing Tauri/React/Vite/Tailwind code is preserved as repository state, but is not automatically considered verified.
- Third-party source is admitted only through provenance/license evidence and a controlled integration mode.

The README intentionally does not maintain an independent test count. Current verification evidence lives in the implementation-state manifest, operation journal and GitHub Actions.

## Repository layout

```
crates/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── utilities/

crates/presentation/desktop/
├── src/                 # Tauri/Rust boundary
└── frontend/            # React/TypeScript/Vite product UI

Supporting repository state lives under `reference/`, `protocols/`, `skills/`, `repos/` and `vendor/`; these are not alternate Rust product roots.

docs/
├── architecture/
└── ai/

reference/
├── manifests/
└── journal/

skills/
└── agenticos-*/
```

## Development rules

1. Read the project state and implementation-state before editing.
2. Work within the relevant capability/workstream scope; independent workstreams may proceed in parallel.
3. Preserve code and evidence by default.
4. Use exact repository evidence for non-trivial external integrations.
5. Verify before changing a status to `verified`.
6. Record changed/created/deleted/preserved/verified/unverified/risk/rollback/next-action information for every operation.
7. For frontend changes, update the frontend changelog in the same operation.
8. Never commit secrets or provider credentials.

## Browser runtime

AgentiCOS exposes an optional real browser runtime through the external `agent-browser` CLI. The Rust API keeps browser orchestration and capability checks in the backend while the CLI owns the persistent browser session.

Configure:

```bash
AGENTICOS_BROWSER_COMMAND=agent-browser
AGENTICOS_BROWSER_TIMEOUT_MS=60000
AGENTICOS_BROWSER_MAX_OUTPUT_BYTES=2097152
```

The runtime remains optional at startup. When the CLI is unavailable, `/api/browser/status` reports it as unavailable and the rest of the backend continues to operate.

Browser actions are capability-gated with `browser.use` and scoped to `browser/<session_id>`.

## Verification

Root checks:

```bash
npm ci --no-audit --no-fund
npm run verify
```

Rust checks (CI-optimized for critical packages):

```bash
cargo fmt --all -- --check
cargo check -p agenticos-brain -p agenticos-providers --all-targets
cargo test -p agenticos-brain --lib
cargo test -p agenticos-providers --test provider_plane_integration
cargo clippy -p agenticos-brain -p agenticos-providers --all-targets -- -D warnings
```

The CI is optimized to verify only critical packages (brain, providers) to avoid compilation errors in incomplete workstreams (kernel, browser, source-forge, agents). Full workspace verification can be done locally with `cargo check --workspace --all-targets`.

The frontend verification contract additionally requires browser verification whenever an actual dev server is started for an authorized UI change.

## License

MIT. See [LICENSE](LICENSE).
