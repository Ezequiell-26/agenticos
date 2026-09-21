# Use Rust as Canonical Runtime

## Status

Accepted

## Context and Problem Statement

AgentiCOS needs a canonical runtime language for core platform behavior. Multiple languages are used in the project (Rust, TypeScript, Python), but one must be the authoritative runtime to ensure consistency, performance, and safety.

## Decision Drivers

- Performance requirements for agent execution
- Memory safety guarantees
- Async runtime maturity
- WASM compatibility for portable plugins
- Ecosystem quality and maintenance

## Considered Options

- **Rust**: Systems language with strong safety guarantees, mature async ecosystem (Tokio), excellent WASM support
- **TypeScript**: Good for product surfaces but lacks systems-level control and has runtime overhead
- **Python**: Excellent for ecosystem integration but lacks memory safety and has runtime overhead

## Decision Outcome

Chosen option: "Rust", because it provides memory safety guarantees, mature async runtime with Tokio, excellent WASM support for portable plugins, and strong performance characteristics that meet the platform's requirements.

### Consequences

- Good, because memory safety prevents entire classes of bugs
- Good, because Tokio provides production-ready async runtime
- Good, because WASM support enables portable isolated plugins
- Bad, because steeper learning curve than TypeScript/Python
- Bad, because longer compile times

## Validation

Validated by implementation of kernel, providers, tools, and all core components in Rust with `#![forbid(unsafe_code)]` enforcement.

## Pros and Cons of the Options

### Rust

- Good: Memory safety guarantees
- Good: Mature async ecosystem (Tokio)
- Good: WASM support for plugins
- Good: Zero-cost abstractions
- Bad: Steeper learning curve
- Bad: Longer compile times

### TypeScript

- Good: Familiar to web developers
- Good: Good for product surfaces
- Bad: Runtime overhead
- Bad: No memory safety guarantees
- Bad: Limited WASM support

### Python

- Good: Extensive ML ecosystem
- Good: Easy to write
- Bad: No memory safety
- Bad: Runtime overhead
- Bad: Limited WASM support
