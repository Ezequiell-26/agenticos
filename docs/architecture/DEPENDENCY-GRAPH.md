# AgentiCOS Dependency Graph

## Stable dependency direction

The canonical dependency arrow means "depends on":

```text
Applications / Surfaces
        ↓
Application Protocol / SDK
        ↓
Runtime + Domain Services
        ↓
Contracts
        ↓
Kernel
```

Infrastructure adapters, providers, plugins and engines implement or consume domain contracts without becoming dependencies of the kernel.

No reverse dependency is permitted from Kernel/Contracts into Applications or vendor implementations.

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