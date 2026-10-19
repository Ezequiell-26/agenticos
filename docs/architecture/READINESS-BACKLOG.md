# Readiness backlog — what stands between this build and "ready to use"

## Estado

Actualizado: 2026-10-19 08:30 (operación `readiness-backend-toolchain-blocker-2026-10-19`).

- **Etapa:** 3 de 5 — *Fidelidad de interfaz en curso; runtime todavía sin verificar.*
  1. Clonar y levantar el front — **hecho** (5188 modificado, 5189 original de referencia).
  2. Piel Qoder en el shell — **hecho** (barra de título, sidebar, chat, composer, status bar, ajustes).
  3. Fidelidad de superficies y gates verdes — **en curso** (Knowledge Center, Automations y Extensions portadas; 16+ pasadas de tokens, hovers, cascada y código muerto).
  4. Backend y runtime funcionando — **sin empezar, bloqueado por R0**.
  5. Flujo completo usable de punta a punta — **sin empezar**.
- **Checklist "ready to use":** 1 de 10 confirmada (ítem 8, gates del front). Ítems 1-7 bloqueados por R0; 9 por 10; 10 pendiente de ejecutar.
- **Ítem DOING:** ninguno. Cada pasada marca el suyo acá antes de empezar y lo libera al cerrar.
- **Próxima acción ejecutable:** R6 (`.gitattributes`), después R2 (mapa de contratos front↔back) y R5 (lectura de la tabla de rutas).
- **Sugerencias al loop:** el intervalo de la automación debe quedar en 30 minutos; las pasadas duran 9-12 minutos y a 3 minutos se superponen.

Single queue for the scheduled improvement loop. One pass picks the **highest-priority OPEN item across every track**, not only the frontend. Priority order is fixed: `R` (runtime) → `S` (shell/usable) → `F` (frontend UI fidelity) → `Q` (quality gates) → `D` (docs). Cosmetics never outrank a broken or unverified runtime path.

Status vocabulary — never use a stronger word than the evidence:

- `OPEN` — not started.
- `DOING` — a pass owns it right now.
- `BLOCKED(user)` — needs a credential, a decision or an action only the user can take.
- `DONE` — implemented **and** verified, with the measurement written in the changelog entry.

## Definition of "ready to use"

All ten must hold. Anything unverified stays unchecked and says so.

1. `cargo build -p agenticos-api-server` succeeds on this machine. — `BLOCKED(user)` see R0, measured failing 2026-10-19 with `LNK1104: msvcrt.lib`
2. The server listens on `127.0.0.1:8080` and `GET /health` returns 200. — `BLOCKED(1)`
3. The desktop frontend reaches it: the status bar reads connected instead of `Runtime offline`. — `BLOCKED(2)`
4. `GET /api/models` returns real models, not the offline fallback. — `BLOCKED(2)` and needs a provider credential in `.env`.
5. A chat round-trip renders an assistant reply in the UI. — `BLOCKED(2)` and needs the same credential.
6. Conversations persist across reloads through the runtime, not only through local UI preferences. — `BLOCKED(2)`
7. `cargo test --workspace --all-targets` and `cargo clippy --workspace --all-targets -- -D warnings` pass. — `BLOCKED(1)` (never run in this environment)
8. The frontend gates pass: `npm run check` in the frontend plus the five node verifiers. — `DONE` for the current tree, re-verified every pass.
9. The aggregate root `npm run verify` runs. — `OPEN`, blocked by item 10.
10. A documented start procedure that a fresh clone can follow (`GETTING-STARTED.md`) is executed end to end and matches reality. — `OPEN`

## Known hard limits of this environment

- **HARD BLOCKER — the backend cannot link on this machine.** `cargo build -p agenticos-api-server` reached 30 crates and then failed on every build script with `LINK : fatal error LNK1104: no se puede abrir el archivo 'msvcrt.lib'` (cargo exit 101). Measured cause: `D:\visualstudiocomunity\VC\Tools\MSVC\` contains **zero** `.lib` files across all three installed toolchains (14.32.31326, 14.43.34808, 14.51.36231) — `bin` and `include` are there, `lib\x64` holds only `enclave`, `store` and `uwp` — while `vswhere -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64` still reports the component installed. The Windows SDK side is fine (`kernel32.lib` present in `um\x64`, `ucrt.lib` in `ucrt\x64` for 10.0.22621.0 and 10.0.26100.0). So this is a partial VS C++ install, not a missing SDK and not a `LIB` variable problem. Repairing it means re-installing the MSVC build-tools component (a download and a system change) and needs an explicit yes from the user. Until then **do not retry cargo builds** — every pass would burn ten minutes rediscovering this.
- Second, unrelated defect in the same file: `.cargo/config.toml` sets `rustflags = ["-C", "link-arg=-fuse-ld=lld"]` for `x86_64-pc-windows-msvc`. `-fuse-ld` is a GCC/Clang driver flag, so MSVC's `link.exe` rejects it with `LNK4044: opción no reconocida`. It is harmless today because the link dies earlier, but it is wrong for this host target and will keep emitting noise once the toolchain is repaired.
- Root `npm ci` dies building `better-sqlite3` (MSBuild exit 1), so `tsc` and `tsx` never resolve at the root and the aggregate `npm run verify` cannot run. Every individual verifier still runs; record which ones actually executed.
- The reference Qoder captures for `Captura de pantalla (7).png` and `(8).png` are the visual contract. The live Qoder window is available for manual capture, but operating it section by section is **not** authorized for the loop.
- No `.env` exists. `.env.example` ships `AGENTICOS_API_KEY=` empty, so the chat endpoint returns `PROVIDER_NOT_CONFIGURED` by design. The loop must never invent, request in chat, or store a key.

## Track R — runtime and backend

- **R0 `BLOCKED(user)`** Repair the MSVC C++ libraries described above so Rust can link. Nothing in track R, S or the desktop app can be verified before this. The loop must leave it blocked and keep working the tracks that do not need a linker.
- **R1 `BLOCKED(R0)`** Build and boot the API server: `cargo build -p agenticos-api-server`, start it, `curl http://127.0.0.1:8080/health`. Record the real exit code — and read it from cargo's own status, because `cargo ... ; echo` and piping both mask it.
- **R2 `OPEN`** Static contract audit that needs no linker: map every path in `src/services/runtime.ts` to the route that answers it in `crates/presentation/api-server/src/`, and list the set difference. `frontend:runtime-contract` reports 89 frontend paths against 96 backend routes; the mismatch is the honest gap list.
- **R3 `BLOCKED(R0)`** With the server up, walk the surfaces that currently render the offline fallback (chat history, models, memory list, workflows list, provider status) and confirm each one either shows real runtime data or states plainly why it cannot.
- **R4 `BLOCKED(R0)`** Conversation persistence: check history and the default-conversation path against the running server.
- **R5 `OPEN`** Rust-side reading that needs no build: read `crates/presentation/api-server/src/main.rs` and the `lib.rs` route table, and record which endpoints exist, which are stubs, and which return `PROVIDER_NOT_CONFIGURED`. This is the cheapest way to make progress on readiness while R0 waits.
- **R6 `OPEN` — first executable backend item.** Add a `.gitattributes`. Measured: the file does not exist, `text` and `eol` are `unspecified` for `.rs`, and this machine has `core.autocrlf=true`, so the LF sources in `HEAD` check out as CRLF. Consequence: `cargo fmt --all --check` fails on **81 files**, and **all 81 are "Incorrect newline style"** with **zero** real formatting diffs (`git show HEAD:crates/domain/brain/src/lib.rs` proves the committed bytes are `\n`). So the red format gate on Windows is a checkout artifact, not broken code, and any Windows contributor or CI job hits it. Proposed content:
  ```gitattributes
  * text=auto eol=lf
  *.rs text eol=lf
  *.ts text eol=lf
  *.tsx text eol=lf
  *.css text eol=lf
  *.json text eol=lf
  *.md text eol=lf
  *.toml text eol=lf
  *.png binary
  *.jpg binary
  *.ico binary
  ```
  **Do not run `cargo fmt --all`** to "fix" this: it would rewrite 81 files to make a local checkout look clean and would bury the real signal. The gate is satisfied by normalising the checkout, not by reformatting the codebase.
- **R7 `OPEN`** After R6, re-run `cargo fmt --all --check` and record whether it goes green on this machine. Only then is the format gate trustworthy for future Rust edits.

## Track S — usable shell

- **S1 `OPEN`** One keyboard-reachable happy path with the runtime live: new conversation → send → streamed reply → reload → conversation still there.
- **S2 `OPEN`** Error states that are reachable in practice: server down (already the norm here), provider missing, request rejected. Each must say what happened and what to do, in the Qoder voice, without hiding behind a toast.

## Track F — frontend fidelity

The queue lives in [`QODER-UI-AUDIT.md`](./QODER-UI-AUDIT.md), section `Pending in AgentiCOS`. Read it instead of copying it here; when you close an item, move it to that file's `Resolved` section with its measurement. Two standing rules from that file apply to every pass: compare **specificity** before assuming stylesheet order carries an override, and never add a colour that nothing measured.

## Track Q — quality gates

- **Q1 `OPEN`** Run the backend gate set scoped to what a pass touched: `cargo fmt --all --check`, `cargo check -p <crate> --all-targets`, `cargo test -p <crate> --all-targets`. Escalate to `--workspace` only when shared code changed, and say which scope you ran.
- **Q2 `BLOCKED(user)`** `reference/journal/agent-operations.jsonl` line 77 holds two objects separated by a literal backslash-n, so strict JSONL readers fail there and the continuity verifier counts 211 operations over 210 lines. Repairing it edits journal history, which needs an explicit yes.
- **Q3 `BLOCKED(user)`** 56 modified files and 5 staged ones sit uncommitted on `a0248c60`. Nothing may be committed without the user asking.

## Track D — documentation

- **D1 `OPEN`** Re-read `GETTING-STARTED.md` against reality once R1 lands and fix whatever it promises that this repo does not do.
- **D2 `OPEN`** Keep `FRONTEND-CHANGELOG.md` append-only and the journal in the same operation as every change; that is a repo rule, not a convention.
