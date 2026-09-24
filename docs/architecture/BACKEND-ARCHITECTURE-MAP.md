# AgentiCOS Backend Architecture Map

## Purpose

The backend is the runtime authority behind the desktop frontend. The frontend sends typed intents over the HTTP/Tauri boundary; the backend owns execution, provider calls, persistence, memory, policy and recovery.

## Runtime path

`React UI → HTTP/Tauri transport → API server → session runtime → ReactAgent → ModelProvider → provider API`

Persistence path:

`ReactAgent → SqliteMemory → SQLite`

## Current implemented vertical slice

- Rust/Actix API server.
- Persistent SQLite conversation memory.
- One isolated `ReactAgent` instance per session ID.
- OpenAI-compatible model-provider adapter.
- Configurable endpoint, API key, provider name and model through environment variables.
- Agent status and health endpoints.
- Conversation history and FTS5 search.
- Tool registry read endpoints.
- Desktop Tauri process starts the API runtime automatically.
- No API secret is exposed to the React frontend.

## Environment contract

- `AGENTICOS_API_KEY`
- `AGENTICOS_PROVIDER_URL`
- `AGENTICOS_PROVIDER_NAME`
- `AGENTICOS_MODEL`
- `AGENTICOS_DATABASE_URL`
- `AGENTICOS_BIND_HOST`
- `AGENTICOS_BIND_PORT`

The provider boundary is intentionally OpenAI-compatible so gateways and compatible providers can be selected without changing the agent core.

## State and concurrency

Session agents are keyed by session ID and share the SQLite memory store. This prevents concurrent sessions from mutating a single global session identity.

The model provider is immutable runtime state. Provider routing/fallback is a separate concern and must not be embedded in UI components.

## Security rules

1. API keys remain backend-only.
2. The frontend never receives raw credentials.
3. Empty or missing provider configuration returns an explicit `503` instead of fabricating an AI response.
4. Tool execution must remain behind a typed policy/capability boundary.
5. Destructive tools require explicit authorization before execution.
6. Runtime errors are returned as structured error codes.

## Current hardening note

The provider integration slice now treats transport and protocol failures as errors instead of successful response values, enabling failover and retry layers to observe failure conditions. Deterministic integration coverage also exercises health-driven selection, fallback ordering and concurrent quota accounting.

## Next backend slices

1. Multi-provider registry + health/quota routing using the existing kernel router.
2. Typed command/query API for runs, checkpoints, approvals and workflows.
3. Tool execution service with capability and approval enforcement.
4. Durable event log/outbox and run recovery.
5. Context optimization pipeline and token accounting.
6. MCP/skills/plugin runtime.
7. Streaming events/SSE or Tauri event transport.
8. Backend integration tests and end-to-end desktop verification.

## Verification rule

A feature is not marked production-ready until its automated build/test result is observed. Source inspection alone is structural evidence, not runtime verification.
