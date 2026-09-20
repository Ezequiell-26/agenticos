# AgentiCOS Plugin SDK

## Extension philosophy

Everything outside the kernel should be replaceable or extendable through public contracts.

## Plugin categories

- provider;
- model protocol;
- router strategy;
- tool;
- MCP client/server;
- sandbox;
- memory;
- retriever/reranker;
- skill;
- workflow executor;
- agent engine;
- channel;
- storage;
- artifact store;
- UI panel;
- observability exporter;
- Source Forge analyzer.

## Plugin manifest

```yaml
id: example.plugin
version: 1.0.0
apiVersion: 1
capabilities: []
permissions: []
dependencies: []
contributes: []
```

## Activation

```text
discover
  ↓
signature/integrity
  ↓
manifest validation
  ↓
dependency resolution
  ↓
policy authorization
  ↓
activate
  ↓
health check
```

If activation fails, registrations and resources are rolled back.

## Isolation levels

1. In-process trusted plugin.
2. Worker-process plugin.
3. Sandboxed plugin.
4. Remote plugin service.

The plugin manifest declares its required isolation level.

## Compatibility

Plugins declare the minimum and maximum supported API versions.
Capability negotiation is required when a plugin targets an optional feature.

## Plugin registry

A registry may publish metadata, packages, signatures and compatibility information. Installation remains subject to local trust policy.

## No privileged bypass

Plugins do not gain kernel privileges merely by being installed. They receive declared capabilities through the same policy mechanism as tools.