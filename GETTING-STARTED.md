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

Install the frontend dependencies. The desktop UI is a separate npm project from the
repository root — the root has no npm workspaces, and `frontend/node_modules` is
gitignored — so the root `npm ci` in [Verification](#verification) does not provide them:

```bash
cd crates/presentation/desktop/frontend
npm install
```

Then, still from that directory:

```bash
cd ..
cargo tauri dev
```

`cargo tauri dev` runs `npm run dev` inside `frontend/` as its `beforeDevCommand`, which
starts Vite from the `agenticos-desktop-frontend` package. Without the install above that
step fails before Rust ever compiles. The desktop application starts the Rust backend
runtime in-process and launches the React/Vite frontend using the Tauri configuration.

The desktop application keeps its SQLite database **outside the checkout**, in the Tauri
application-data directory for the `com.agenticos.app` identifier —
`%APPDATA%\com.agenticos.app\agenticos.db` on Windows — and it only chooses that path when
`AGENTICOS_DATABASE_URL` is not already set. Every clone, copy and worktree on one machine
therefore shares the same database. To run against a separate one, set
`AGENTICOS_DATABASE_URL` in the environment before `cargo tauri dev`; the application honours
it and leaves the shared file untouched.

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

On Windows the file is `target/release\agenticos.exe`. Measured on a cold clone: the release
build exits 0 and produces a 5,511,680-byte binary, and `--version` is **not** accepted
(`error: unexpected argument '--version' found`, item **R13**) — use `--help`, which works and
lists `run`, `agent`, `status`, `config`, `flags` and `chat`.

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

Expect `cargo check --workspace --all-targets` to pass with zero compile errors — measured
**exit 0** on a cold clone from GitHub on 2026-10-19.

Expect `cargo test --workspace` to **exit 101 today**, and expect it to **stop early**: cargo is
fail-fast for test binaries, so the first crate that fails ends the run. Measured literally, on
that cold clone, it reached **13 of 58** test binaries and reported **61 passed, 1 failed**. The
failure that stopped it is `crates/presentation/desktop/src/lib.rs:298`, which calls
`get_agent_status("http://127.0.0.1:8080")` and asserts the call errors — so it only passes on a
machine where **nothing is listening on 8080**, and it fails on any machine that already has the
API server running. See item **R12** in `docs/architecture/READINESS-BACKLOG.md`.

The full picture needs the flag the documented command omits: `cargo test --workspace
--no-fail-fast` measured **503 passed and 9 failed** across the 58 binaries, and those nine sit
in `crates/utilities/` packages that nothing in the product links against (**R8b**). Neither
class is a new regression. Do not read a red workspace test run as the product being broken, do
not read the 61/1 stop as the whole count, and do not "fix" it by deleting those crates without
that decision being made.

## Troubleshooting

If the API fails at startup, inspect the terminal for SQLite, filesystem, browser, or provider initialization errors.

If the desktop shell opens with the runtime offline, inspect the desktop terminal for backend startup errors and verify that the frontend points to `http://127.0.0.1:8080` unless a custom API URL is configured.

If chat returns `PROVIDER_NOT_CONFIGURED`, configure at least one provider and restart the runtime.

On Windows, if a Rust build dies with `LNK1104: cannot open file 'msvcrt.lib'`, the detected
MSVC toolchain has no `x64` library directory. Point `LIB` and `INCLUDE` at a toolchain that
has both `link.exe` and `lib/x64/msvcrt.lib`, plus the matching Windows SDK `um\x64` and
`ucrt\x64` directories, before running any `cargo` command. This is a machine-level toolchain
gap, not a repository one — a correctly installed Visual Studio C++ workload does not need it.

If `cargo fmt --all -- --check` reports only `Incorrect newline style` and **zero** `Diff in`
lines, the checkout has CRLF files, not badly formatted code. A fresh clone is correct because
the repository ships a `.gitattributes`; an older working copy may predate it. Do **not** run
`cargo fmt --all` to silence it — that rewrites every source file to satisfy one local
checkout. Re-clone, or refresh the working copy after confirming the tree is clean and pushed.

If `cargo tauri dev` fails immediately in `BeforeDevCommand`, it did not find the frontend
dependencies. Run `npm install` inside `crates/presentation/desktop/frontend` first; the root
`npm ci` does not cover it.

If the desktop window never appears and the terminal ends with `Failed to setup app: ... sqlite
migration failed: migration 1 was previously applied but has been modified` (process exits with
code 101 after a successful build), the shared application-data database on that machine was
created from an older copy of the files in
`crates/utilities/sqlite-migrations/migrations/`. sqlx refuses to migrate against it by design —
applied migrations are immutable. Pointing `AGENTICOS_DATABASE_URL` at a fresh file starts the
application immediately and leaves the old database untouched; deciding what to do with the old
one is item **R14** in `docs/architecture/READINESS-BACKLOG.md`, not something to resolve by
deleting files.

See [Canonical Architecture](docs/architecture/CANONICAL-ARCHITECTURE.md), [Repository Structure](docs/architecture/REPOSITORY-STRUCTURE.md), and [Project State](reference/PROJECT-STATE.md) for the deeper implementation status.
