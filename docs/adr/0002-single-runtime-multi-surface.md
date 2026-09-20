# ADR 0002 — Single Runtime, Multiple Surfaces

Status: Accepted

## Decision

CLI, TUI, Web, Desktop, IDE integrations, API, SDK and messaging channels will all drive the same Agent Runtime through one application protocol.

No surface may implement a second agent loop or a second canonical session store.

## Rationale

Hermes demonstrates the value of a shared agent core across many entry points. Codex demonstrates a strong app-server boundary between the runtime and richer clients. Antigravity demonstrates that an agent-first workspace can expose asynchronous agents, browser operation and artifacts through a coherent surface.

AgentiCOS will combine these ideas into one protocol-driven runtime.

## Consequence

A new interface becomes an adapter, not a new agent implementation.