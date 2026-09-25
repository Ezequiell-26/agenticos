# Getting Started with AgentiCOS

This guide covers the supported development surfaces: the Rust API runtime, CLI, and Tauri desktop application.

## Prerequisites

- Rust toolchain with `cargo`, `rustfmt`, and `clippy`
- Git
- Node.js and npm for the desktop frontend
- At least one model provider credential or a local OpenAI-compatible endpoint for actual model execution

## Clone

```bash
git clone https://github.com/Ezequiell-26/agenticos.git
cd agenticos
```

## Configure

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in at least one provider configuration documented in `.env.example`. The default API bind is:

```text
127.0.0.1:8080
```

The backend reads environment variables from the process environment. For local shells that do not load `.env` automatically, export the variables before starting the runtime.

## Run the API server

```bash
cargo run -p agenticos-api-server
```

Health endpoint:

```text
GET http://127.0.0.1:8080/health
```

Chat endpoint:

```text
POST /api/agent/chat
```

The chat endpoint returns `PROVIDER_NOT_CONFIGURED` until a provider credential/configuration is available.

## Run the desktop application

Install the Tauri CLI once:

```bash
cargo install tauri-cli --version "^2"
```

Then:

```bash
cd crates/presentation/desktop
cargo tauri dev
```

The desktop application starts the Rust backend runtime in-process and launches the React/Vite frontend using the Tauri configuration.

For a production bundle:

```bash
cargo tauri build
```

## Build the CLI

```bash
cargo build -p agenticos-cli --release
```

Binary:

```text
target/release/agenticos
```

The CLI is a separate diagnostic/demo surface. The Tauri desktop and API runtime are the canonical product surfaces.

## Verification

Install JavaScript dependencies and run the repository gates:

```bash
npm ci --no-audit --no-fund
npm run verify
```

Rust formatting:

```bash
cargo fmt --all -- --check
```

Critical CI Rust checks:

```bash
cargo check -p agenticos-brain -p agenticos-providers --all-targets
cargo test -p agenticos-brain --lib
cargo test -p agenticos-providers --test provider_plane_integration
cargo clippy -p agenticos-brain -p agenticos-providers --all-targets -- -D warnings
```

For a local release-candidate audit, also run:

```bash
cargo check --workspace --all-targets
cargo test --workspace
```

## Troubleshooting

If the API fails at startup, inspect the terminal for SQLite, filesystem, browser, or provider initialization errors.

If the desktop shell opens with the runtime offline, inspect the desktop terminal for backend startup errors and verify that the frontend points to `http://127.0.0.1:8080` unless a custom API URL is configured.

If chat returns `PROVIDER_NOT_CONFIGURED`, configure at least one provider and restart the runtime.

See [Canonical Architecture](docs/architecture/CANONICAL-ARCHITECTURE.md), [Repository Structure](docs/architecture/REPOSITORY-STRUCTURE.md), and [Project State](reference/PROJECT-STATE.md) for the deeper implementation status.
