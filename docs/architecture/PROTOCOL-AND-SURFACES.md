# AgentiCOS Application Protocol and Product Surfaces

## One runtime, many surfaces

```text
CLI ─┐
TUI ─┤
Web ─┤
Desktop ─┤
IDE ─┤
SDK ─┤──→ Application Protocol ─→ Agent Runtime
API ─┤
MCP ─┤
Channels ─┘
```

No client owns its own version of the agent loop.

## Protocol goals

The protocol is bidirectional and event-driven.

Requests cover:
- initialization;
- capability negotiation;
- provider/model discovery;
- thread/run creation;
- turn start/steer/interrupt;
- tool approval;
- artifact retrieval;
- skill discovery;
- plugin discovery;
- configuration;
- task control.

Notifications cover:
- run state;
- turn state;
- model stream deltas;
- tool execution;
- approval requests;
- child runs;
- artifact creation;
- errors;
- usage/cost updates.

## Protocol object semantics

```text
Workspace
  └─ Project
      └─ Run
          └─ Thread
              └─ Turn
                  └─ Item
```

Every object has a stable ID and lifecycle state.

## Transports

- stdio for local process integration;
- Unix/domain socket or Windows equivalent for local IPC;
- WebSocket for interactive remote clients;
- HTTP/SSE or HTTP streaming for web-facing APIs;
- MCP for tool/server interoperability.

The wire contract is transport-neutral.

## API design rule

Protocol versioning is independent of internal package versions. New methods are additive when possible. Breaking protocol changes require a new version and explicit compatibility handling.

Codex currently uses a versioned app-server protocol as the backbone for IDE/desktop integrations; AgentiCOS adopts the same architectural principle of a strong application boundary rather than embedding runtime internals in each client.

## Product surfaces

### CLI
Fast local execution and scripting.

### TUI
Rich terminal interaction, streaming and approvals.

### Web
Workspace, runs, artifacts, providers, settings and administration.

### Desktop
Native shell around the same web/runtime protocol.

### IDE
Workspace-aware coding surface using the same protocol.

### SDK
Programmatic task creation, streaming, artifacts and approvals.

### Messaging
Channel adapters translate external messages into the same profile/workspace/thread/run model.