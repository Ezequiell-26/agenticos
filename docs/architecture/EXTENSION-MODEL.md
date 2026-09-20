# AgentiCOS Extension Model

## Extension points

AgentiCOS has explicit extension points:

```text
Providers
Protocols
Routers
Tools
MCP
Sandboxes
Memory
Retrievers
Skills
Workflows
Agents
Engine adapters
Channels
Storage
Artifact stores
Observability exporters
UI modules
Source Forge analyzers
```

## Extension priority

Prefer, in order:
1. configuration;
2. existing plugin contract;
3. new plugin contract;
4. engine adapter;
5. kernel change only when the capability is fundamental and cross-domain.

This prevents architecture expansion from becoming core-code expansion.

## Capability discovery

Every extension exposes a machine-readable capability manifest.

The router/runtime can inspect capabilities before selecting an extension.

## Configuration isolation

Each extension owns its configuration schema but receives the host's policy and lifecycle context.

Extensions cannot define their own secret storage, permission bypass or canonical event semantics.