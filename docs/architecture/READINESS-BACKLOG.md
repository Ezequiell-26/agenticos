# Readiness backlog — what stands between this build and "ready to use"

## Estado

Actualizado: 2026-10-19 10:20 (operación `backend-runtime-links-and-boots-2026-10-19`).

- **Etapa:** 4 de 5 — **el backend compila, linkea y arranca en esta máquina.**
  1. Clonar y levantar el front — **hecho** (5188 modificado, 5189 original de referencia).
  2. Piel Qoder en el shell — **hecho** (barra de título, sidebar, chat, composer, status bar, ajustes).
  3. Fidelidad de superficies y gates verdes — **hecho en su cola de tokens**; las pasadas 18 y 19 quedaron sin commitear y se recuperaron en `64665083` después de re-verificar los seis gates sobre el mismo diff. Queda pendiente lo que ellas mismas listaron en QODER-UI-AUDIT (cinco selectores sin render, `--code` / `.code-preview`, `.canvas-preview`, y las cinco pestañas de control center sin abrir).
  4. Backend y runtime funcionando — **empezado y medido**: `cargo build -p agenticos-api-server` exit 0, servidor escuchando en 127.0.0.1:8080, `GET /health` 200. Todavía sin pruebas de UI contra el runtime vivo (R3) ni del workspace de tests (R8).
  5. Flujo completo usable de punta a punta — **sin empezar**; el chat sigue necesitando que el usuario escriba `AGENTICOS_API_KEY` en `.env` (medido vacío, longitud 0).
- **Checklist "ready to use":** **3 de 10** confirmadas — ítem 1 (build), ítem 2 (servidor + `/health` 200) e ítem 8 (gates del front). Ítems 3, 4, 6, 7, 9 y 10 pasaron de bloqueados a `OPEN` ejecutables; el 5 sigue necesitando credencial. El 4 tiene medición parcial: `/api/models` responde 200 con un modelo registrado, pero `configured:false` porque no hay clave.
- **Ítem DOING:** ninguno. R0 y R1 se cerraron en esta pasada y no se abrió otro. Los dos barridos de UI que las pasadas 18 y 19 tenían en curso quedaron liberados al commitearse su trabajo en `64665083`; ninguno estaba marcado DOING acá, porque esas dos pasadas nunca actualizaron este bloque — ver el aviso en Etapa 3.
- **Próxima acción ejecutable:** **R8** (`cargo test --workspace --all-targets` y `cargo clippy … -- -D warnings`), que es el ítem 7 de readiness y quedó habilitado por el mismo override. **Toda pasada que corra Rust debe exportar `LIB` e `INCLUDE` como documenta R0**, o reproduce el exit 101. Alternativa sin esperar al toolchain: R2 (diff de contratos front↔back), que ya tiene tres pistas concretas medidas en R1 (`/api/memory` 400 por `namespace`, `/api/conversations` y `/api/history` 404).
- **Sugerencias al loop:** el intervalo de la automación debe quedar en 30 minutos; las pasadas duran 9-12 minutos y a 3 minutos se superponen. Nota nueva: una pasada de Rust ya no cabe en 12 minutos si compila el workspace desde cero; conviene que R8 se reparta entre dos pasadas con el estado escrito, o que el intervalo suba.

Single queue for the scheduled improvement loop. One pass picks the **highest-priority OPEN item across every track**, not only the frontend. Priority order is fixed: `R` (runtime) → `S` (shell/usable) → `F` (frontend UI fidelity) → `Q` (quality gates) → `D` (docs). Cosmetics never outrank a broken or unverified runtime path.

Status vocabulary — never use a stronger word than the evidence:

- `OPEN` — not started.
- `DOING` — a pass owns it right now.
- `BLOCKED(user)` — needs a credential, a decision or an action only the user can take.
- `DONE` — implemented **and** verified, with the measurement written in the changelog entry.

## Definition of "ready to use"

All ten must hold. Anything unverified stays unchecked and says so.

1. `cargo build -p agenticos-api-server` succeeds on this machine. — **`DONE` 2026-10-19**: exit 0, `Finished dev profile in 5m 48s`, 0 errors, binary `target/debug/agenticos-api-server.exe` 27,740,672 bytes. Required the R0 `LIB`/`INCLUDE` override; without it the same command dies with 101.
2. The server listens on `127.0.0.1:8080` and `GET /health` returns 200. — **`DONE` 2026-10-19**: HTTP **200** on the first poll, body `{"backend":"rust","database":"sqlite","provider_configured":false,"sandbox":"Ready","service":"AgentiCOS API Server","status":"healthy"}`. The server was stopped after measuring; port verified closed afterwards.
3. The desktop frontend reaches it: the status bar reads connected instead of `Runtime offline`. — `OPEN`, unblocked by item 2 but not yet measured: the server was not running during the frontend checks.
4. `GET /api/models` returns real models, not the offline fallback. — `OPEN`, **partially measured**: probed with curl against the live server, `GET /api/models` returned HTTP 200 with `{"count":1,"models":[{"capabilities":["chat"],"context_window":null,"model_id":"gpt-4o-min…` , while `GET /api/providers` returned `configured:false, health:"Unhealthy"`. So the endpoint answers from the registered model row, not from a live provider catalogue, because `AGENTICOS_API_KEY` is still empty. The offline-fallback question is a frontend-side measurement that has not been taken.
5. A chat round-trip renders an assistant reply in the UI. — `BLOCKED(2)` and needs the same credential.
6. Conversations persist across reloads through the runtime, not only through local UI preferences. — `OPEN`, unblocked by item 2.
7. `cargo test --workspace --all-targets` and `cargo clippy --workspace --all-targets -- -D warnings` pass. — `OPEN`, unblocked by R0's override (never run in this environment yet).
8. The frontend gates pass: `npm run check` in the frontend plus the five node verifiers. — `DONE` for the current tree, re-verified every pass.
9. The aggregate root `npm run verify` runs. — `OPEN`, blocked by item 10.
10. A documented start procedure that a fresh clone can follow (`GETTING-STARTED.md`) is executed end to end and matches reality. — `OPEN`

## Known hard limits of this environment

- **The linker blocker is closed — but only with an environment override.** The old text here said the backend could not link because `D:\visualstudiocomunity\VC\Tools\MSVC` had zero `.lib` files. The user authorised the repair, it ran, and the count is now 725 — yet a plain cargo command **still** died with `LNK1104 / msvcrt.lib` (exit 101). Measured reason: the repair filled `14.43.34808\lib\x64` but the newest toolchain `14.51.36231\lib\` has only `arm64`, `arm64ec` and `onecore`, no `x64`, and rustc auto-detects the highest version. **Every Rust command on this machine must export `LIB` and `INCLUDE` to 14.43 + SDK 10.0.26100.0 first** (exact values in R0); with them, `cargo build -p agenticos-api-server` exits 0. Do not re-diagnose from a `.lib` count, and do not report Rust as blocked.
- Second, unrelated defect in the same file: `.cargo/config.toml` sets `rustflags = ["-C", "link-arg=-fuse-ld=lld"]` for `x86_64-pc-windows-msvc`. `-fuse-ld` is a GCC/Clang driver flag, so MSVC's `link.exe` should reject it with `LNK4044`. **Prediction now measured false**: the full `cargo build` that produced the working binary emitted **0** `LNK4044`/`fuse-ld` hits in its log. The flag is still wrong for this host target and should be cleaned up, but it is not costing anything today.
- Root `npm ci` dies building `better-sqlite3` (MSBuild exit 1), so `tsc` and `tsx` never resolve at the root and the aggregate `npm run verify` cannot run. Every individual verifier still runs; record which ones actually executed. **Re-test this now that Rust links**: a native-module MSBuild failure has the same missing-CRT root cause as R0, so it may be fixed by the same override. It was deliberately not re-run in this pass because `npm ci` deletes `node_modules` before rebuilding — a failed retry would take the green frontend gates down with it, which is a bigger loss than the information. When it is attempted, do it with the R0 `LIB`/`INCLUDE` exported and the frontend gates already recorded green in the same pass, so the damage is reversible.
- The reference Qoder captures for `Captura de pantalla (7).png` and `(8).png` are the visual contract. The live Qoder window is available for manual capture, but operating it section by section is **not** authorized for the loop.
- `.env` now exists on this machine (copied from `.env.example`, gitignored — `git check-ignore -v .env` returns `.gitignore:2`). Measured 2026-10-19 without printing the value: `AGENTICOS_API_KEY=` is still **empty (length 0)**, so the chat endpoint returns `PROVIDER_NOT_CONFIGURED` until the user writes a key in. 20 variable names are present in the file. The loop may read the file to check whether the key is loaded, but must never print it, copy it into a log, an issue, the journal or any external service.

## Track R — runtime and backend

- **R0 `DONE` (2026-10-19)** Repair the MSVC C++ libraries so Rust can link. **Closed, but not the way the item assumed.** The user authorised the repair and it ran: `find "/d/visualstudiocomunity/VC/Tools/MSVC" -name "*.lib"` went from 0 to **725**. A raw `cargo check -p agenticos-api-server --all-targets` **still failed** with `CARGO_EXIT=101` / `LNK1104: msvcrt.lib`, because the libs are unevenly installed: `14.43.34808\lib\x64\msvcrt.lib` exists (8 MB, stamped 2026-10-19) while the newest toolchain `14.51.36231\lib\` holds only `arm64`, `arm64ec` and `onecore` — **no `x64`** — and rustc auto-detects the highest version. So disk presence is not the linker search path; a future pass must not re-infer readiness from a `.lib` count.
  The working fix is a per-invocation environment override, no system or registry change: export `LIB` to `D:\visualstudiocomunity\VC\Tools\MSVC\14.43.34808\lib\x64` plus the Windows SDK `10.0.26100.0` `um\x64` and `ucrt\x64`, and `INCLUDE` to the matching include dirs. `link.exe` falls back to `LIB` after its detected `/LIBPATH`. Measured with the override: `cargo check -p serde_core` exit 0 in 16.16s (it previously died here), and `cargo check -p agenticos-api-server --all-targets` **exit 0 in 4m13s over 267 crates, 0 errors, 23 warnings**. The predicted `LNK4044` noise from `.cargo/config.toml`'s `-fuse-ld=lld` did **not** appear (0 hits in the log): `cargo check` links build scripts and proc-macros but not the final binary, so that flag is still untested — R1's `cargo build` is the first command that will actually exercise it.
  **Every future Rust command on this machine must carry the `LIB`/`INCLUDE` export**, or it will reproduce the old 101.
- **R1 `DONE` (2026-10-19)** Build and boot the API server. Measured with the R0 override: `cargo build -p agenticos-api-server` **exit 0 in 5m 48s**, 0 errors, 1 `missing-docs` warning on the bin. Started `target/debug/agenticos-api-server.exe` with `AGENTICOS_BIND_HOST=127.0.0.1`, `AGENTICOS_BIND_PORT=8080` and `AGENTICOS_DATABASE_URL` pointed **outside the repo** (`loop-runtime/agenticos-loop.db`) so the working tree stayed clean — the built-in default is the relative `sqlite://agenticos.db?mode=rwc` (lib.rs:100), which would drop a database in the checkout; `*.db` is gitignored anyway (`.gitignore:16`) but the tree is kept clean regardless. `GET /health` answered **HTTP 200** on the first poll with `status:"healthy"`, `backend:"rust"`, `database:"sqlite"`, `sandbox:"Ready"`, `provider_configured:false`. The process was then stopped and the port verified closed.
  Live probes taken while it was up, useful for R2/R3: `/api/models` 200 `count:1` (`gpt-4o-mini`), `/api/providers` 200 `configured:false, health:"Unhealthy"`, `/api/skills` 200 `count:5`, `/api/capabilities` 200 `{"grants":[]}`, `/api/workflows` 200 `count:0`, **`/api/memory` 400 `Query deserialize error: missing field 'namespace'`** and **`/api/conversations` / `/api/history` 404**. The memory 400 and the two 404s are concrete contract-mismatch candidates for R2. `cargo build` produced **0 `LNK4044` hits**, so the predicted `-fuse-ld=lld` noise did not materialise on the final link either; that claim in Known hard limits is now measured as false and the flag stays as a latent oddity, not a blocker.
  Restart command for the next pass (instant, the binary is already built):
  ```sh
  AGENTICOS_DATABASE_URL='sqlite://C:/Users/ofici/Documents/Qoder/2026-10-17/861cc563/loop-runtime/agenticos-loop.db?mode=rwc' \
  AGENTICOS_BIND_HOST=127.0.0.1 AGENTICOS_BIND_PORT=8080 \
  ./target/debug/agenticos-api-server.exe > /tmp/api_server.log 2>&1 &
  ```
- **R2 `OPEN`** Static contract audit that needs no linker: map every path in `src/services/runtime.ts` to the route that answers it in `crates/presentation/api-server/src/`, and list the set difference. `frontend:runtime-contract` reports 89 frontend paths against 96 backend routes; the mismatch is the honest gap list.
- **R3 `OPEN`** With the server up, walk the surfaces that currently render the offline fallback (chat history, models, memory list, workflows list, provider status) and confirm each one either shows real runtime data or states plainly why it cannot. Unblocked by R1 on 2026-10-19 — the server boots and answers; start it with the command recorded in R1 and point `VITE_AGENTICOS_API_URL` at it. The curl probes in R1 already give the expected payloads to compare the UI against.
- **R4 `OPEN`** Conversation persistence: check history and the default-conversation path against the running server. Unblocked by R1, but note the measured starting point: `/api/conversations` and `/api/history` both answered **404**, so R2 has to establish which path the frontend actually calls before this can be interpreted.
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
- **R8 `OPEN` — highest-value next runtime item.** Checklist item 7: `cargo test --workspace --all-targets` and `cargo clippy --workspace --all-targets -- -D warnings`. Never run in this environment; both were unreachable while R0 blocked the linker and are now executable with the `LIB`/`INCLUDE` override. Budget for it: `cargo check -p agenticos-api-server --all-targets` alone took 4m13s over 267 crates and `cargo build -p agenticos-api-server` 5m48s, so a workspace-wide test build is a multi-run item — start it, record the real exit code from the log, and let the next pass finish it rather than assuming one pass covers 51 crates.
- **R9 `OPEN`** Retry root `npm ci` with the R0 override exported. `better-sqlite3` failed under MSBuild for the same missing-CRT reason the linker did, so this may be what unblocks checklist items 9 and 10 (the aggregate `npm run verify`). Read the blast-radius note in Known hard limits before running it: `npm ci` deletes `node_modules` first, so a failed attempt degrades the currently green frontend gates until it is re-installed.

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
