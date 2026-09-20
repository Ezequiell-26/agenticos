# AgentiCOS Dependency Graph

## Stable direction

```text
Kernel
   ↑
Contracts
   ↑
Runtime
   ↑
Domain services
   ↑
Adapters / Plugins / Engines
   ↑
Application protocol
   ↑
Applications / Surfaces
```

A more precise view is:

```text
apps
  ↓
protocol/sdk
  ↓
contracts
  ↓
runtime/domains
  ↓
kernel
```

Infrastructure adapters sit below the domain that owns their contract.

## Feature dependency graph

An implementation can proceed only when all dependencies on its path are either completed or represented by the final contract plus a deterministic test adapter.

Example:

```text
Agent Chat
 ├── Surface Shell
 ├── Application Protocol
 ├── Thread State
 └── Provider Contract
          ├── Provider Registry
          └── Test Provider
```

The test provider allows the UI/protocol slice to be completed before real providers, without creating a second provider abstraction.

## No circular feature dependencies

If Feature A needs Feature B and Feature B needs Feature A, extract the shared contract into the appropriate lower domain.

## No accidental dependency promotion

A temporary test dependency must not be promoted to a production dependency without a documented reason.

## Build order rule

Build from stable contracts outward:

```text
contracts → runtime primitive → domain implementation → adapter → surface
```

A vertical slice may present a UI shell early, but its behavior must depend on the contract it will keep in production.