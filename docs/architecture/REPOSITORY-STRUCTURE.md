# AgentiCOS Repository Structure

The repository is organized around architectural boundaries rather than individual upstream projects.

## Canonical implementation layout

```
agenticos/
├── Cargo.toml
├── Cargo.lock
│
├── crates/
│   ├── kernel/
│   ├── contracts/
│   ├── runtime/
│   ├── execution/
│   ├── scheduler/
│   ├── providers/
│   ├── router/
│   ├── tools/
│   ├── sandbox/
│   ├── context/
│   ├── memory/
│   ├── skills/
│   ├── workflows/
│   ├── agents/
│   ├── projects/
│   ├── artifacts/
│   ├── plugins/
│   ├── gateway/
│   ├── security/
│   ├── observability/
│   ├── evaluation/
│   └── source-forge/
│
├── apps/
│   ├── cli/
│   ├── tui/
│   ├── web/
│   ├── desktop/
│   └── ide/
│
├── sdk/
│   ├── python/
│   └── typescript/
│
├── engines/
│   ├── adapters/
│   │   ├── hermes/
│   │   ├── deepseek-harness/
│   │   ├── codex/
│   │   └── other/
│   └── manifests/
│
├── protocols/
│   ├── application/
│   ├── engine/
│   ├── plugin/
│   └── schemas/
│
├── vendor/
│   └── sources/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── reference/
│
├── reference/
│   ├── evidence/
│   ├── manifests/
│   └── fixtures/
│
├── tests/
│   ├── contract/
│   ├── integration/
│   ├── engine/
│   ├── sandbox/
│   ├── e2e/
│   ├── replay/
│   ├── conformance/
│   ├── persistence/
│   ├── replay/
│   ├── security/
│   └── fixtures/
│
├── third-party/
│   ├── licenses/
│   ├── notices/
│   ├── sbom/
│   └── provenance/
│
└── prototypes/
    └── typescript/
```

## Language ownership

- **Rust:** canonical kernel, runtime, execution, scheduling, security boundaries, provider normalization, persistence adapters, APIs, CLI and TUI.
- **TypeScript:** Web UI and frontend-specific tooling/SDKs.
- **Python:** optional AI/ML and ecosystem integrations exposed through protocols/SDKs.
- **WASM:** selected portable sandboxed plugins.

Token optimization itself remains Rust-owned; other languages consume its versioned protocol rather than recreating its algorithms.

## Dependency rule

```
apps / SDKs
      ↓
application protocol
      ↓
runtime
      ↓
domain contracts
      ↓
infrastructure adapters
```

Domain contracts must not depend on applications. Applications must not contain their own agent loops.

## Vendor boundary

`vendor/` contains source snapshots only.

`engines/` contains adapters and integration glue.

`crates/` contains AgentiCOS-owned Rust implementations.

`apps/` contains product clients.

`prototypes/` contains transitional experiments that must not become hidden production dependencies.

Source Forge may ingest complete repositories, but it must preserve provenance and never bypass the vendor boundary.
