# AgentiCOS Protocol Registry

## Purpose

The Protocol Registry allows AgentiCOS to support new network/API protocols without changing the runtime or provider router.

## Registry entry

```text
Protocol
├── protocolId
├── version
├── transport(s)
├── request schema
├── response schema
├── stream schema
├── auth schemes
├── capabilities
├── serializer
├── parser
├── error mapper
└── compatibility tests
```

## Initial protocol families

- OpenAI Chat Completions;
- OpenAI Responses;
- Anthropic Messages;
- Google Gemini native;
- generic HTTP/JSON;
- local server protocols;
- MCP;
- A2A;
- AgentiCOS Application Protocol;
- AgentiCOS Engine Protocol;
- AgentiCOS Plugin Protocol.

## Transport abstraction

Protocols may run over:
- HTTP/HTTPS;
- SSE;
- WebSocket;
- stdio;
- local IPC;
- gRPC/HTTP2 where a plugin requires it.

Transport is separate from semantic protocol.

## Version negotiation

A client and server negotiate:
- protocol version;
- optional extensions;
- capabilities;
- authentication mechanism;
- streaming support.

Unknown extensions must not corrupt canonical state.

## Conformance

Every protocol adapter ships contract tests against canonical fixtures.

Provider-specific quirks are tested in the adapter package rather than leaking into runtime code.