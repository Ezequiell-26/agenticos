# AgentiCOS

> Universal, model-agnostic AI agent runtime and desktop application platform.

AgentiCOS is a Rust-first agent platform built around a central **Brain** that orchestrates models, providers, tools, MCP, memory, knowledge, source intelligence, planning, execution, verification and resource governance.

## Architecture

The canonical architecture is documented in:

- [Canonical Architecture](docs/architecture/CANONICAL-ARCHITECTURE.md)
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

- Sequential verification mode is fail-closed.
- The current authorized implementation step is recorded in `reference/manifests/implementation-state.json`.
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
2. Work only on the single authorized step.
3. Preserve code and evidence by default.
4. Use exact repository evidence for non-trivial external integrations.
5. Verify before changing a status to `verified`.
6. Record changed/created/deleted/preserved/verified/unverified/risk/rollback/next-step information for every operation.
7. For frontend changes, update the frontend changelog in the same operation.
8. Never commit secrets or provider credentials.

## Verification

Root checks:

```bash
npm ci --no-audit --no-fund
npm run verify
```

Rust checks:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets
cargo test --workspace --all-targets
cargo clippy --workspace --all-targets -- -D warnings
```

The frontend verification contract additionally requires browser verification whenever an actual dev server is started for an authorized UI change.

## License

MIT. See [LICENSE](LICENSE).

<!-- formatter-trigger -->
