# AgentiCOS Engine Fusion Architecture

## Principle

AgentiCOS must be able to reuse substantial portions of external agent runtimes without forcing every source project into one programming language.

The unification boundary is a typed protocol and capability contract.

## Engine plane

```text
                         AgentiCOS Kernel
                                │
                         Agent Runtime API
                                │
                    Engine Adapter Interface
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
      Hermes Engine       DeepSeek Harness       Codex Engine
       Python/other          Node/TS             Rust
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                        Unified Run Protocol
```

External engines may run in-process when safe and compatible, or out-of-process when language/runtime/security isolation requires it.

## Three integration levels

### Level 1 — Embedded component
A library/module is adapted directly behind an AgentiCOS contract.

### Level 2 — Engine adapter
An existing runtime remains intact and communicates through a protocol adapter.

### Level 3 — Reference implementation
Architecture/code is studied but not integrated because compatibility, licensing, security or maintenance cost is unfavorable.

## Engine contract

Every engine adapter exposes:
- engine ID/version;
- supported capabilities;
- supported protocols;
- task creation;
- event stream;
- tool invocation surface;
- approval requests;
- artifact publication;
- cancellation;
- shutdown;
- health;
- resource accounting.

## Engine selection

The main runtime decides whether to:
- use a native AgentiCOS implementation;
- delegate to a compatible external engine;
- compose multiple components;
- fall back to another engine.

This makes Hermes, DeepSeek Harness and Codex sources of reusable capability rather than competing application shells.

## Isolation rule

External engines never receive unrestricted access to AgentiCOS internal state. They receive a scoped task context, declared capabilities, explicit tool handles and a transport/session identity.

## Fusion result

The end state is one AgentiCOS user experience with multiple proven internal implementations behind a common contract. Over time, components can migrate from external engine adapters into native AgentiCOS implementations without changing the application protocol.