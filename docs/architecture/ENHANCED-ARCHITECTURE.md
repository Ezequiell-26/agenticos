# AgentiCOS Enhanced Architecture

> Modern architecture patterns based on professional MIT repositories (Tokio, Tower, Bulletproof Rust Web)

## Architectural Principles

### 1. Clean Architecture (Layered)

Based on patterns from IronFlow and Bulletproof Rust Web:

```
┌──────────────────────────────────────────────┐
│   Presentation Layer                        │
│   CLI, Web API, RPC endpoints               │
│   Knows about: clap, axum, HTTP, JSON       │
├──────────────────────────────────────────────┤
│   Application Layer                         │
│   Use cases, orchestration, DTOs           │
│   Knows about: nothing external            │
├──────────────────────────────────────────────┤
│   Domain Layer                              │
│   Entities, services, business rules       │
│   Knows about: nothing external            │
├──────────────────────────────────────────────┤
│   Infrastructure Layer                      │
│   Storage, external APIs, providers        │
│   Knows about: SQLite, HTTP, Tokio         │
└──────────────────────────────────────────────┘
```

**Dependency Rule**: Dependencies flow inward. Domain has NO external dependencies.

### 2. Tower Service/Layer Pattern

Based on Tower (MIT):

- **Service**: Async function `Request -> Future<Response/Error>`
- **Layer**: Composable middleware (circuit breaker, rate limiting, timeout)
- **ServiceBuilder**: Compose multiple layers

Benefits:
- Protocol-agnostic components
- Reusable middleware
- Testable in isolation

### 3. Workspace Organization

Based on LogRocket and Bulletproof Rust Web:

```
crates/
├── presentation/           # CLI, web handlers
│   ├── cli/
│   └── web/
├── application/            # Use cases, orchestration
│   ├── agent/
│   └── workflow/
├── domain/                # Core business logic
│   ├── entities/
│   ├── services/
│   └── ports/             # Repository/Provider traits
├── infrastructure/        # External implementations
│   ├── persistence/
│   ├── providers/
│   └── protocols/
└── shared/                # Common utilities
    ├── error/
    └── types/
```

## Current Architecture Analysis

### Current Structure

The active workspace has 26 crates. They are currently organized by functional responsibility; the layer-based structure below remains a target architecture rather than an already-migrated layout.

```
crates/
├── contracts/ kernel/ runtime/ execution/
├── providers/ router/ gateway/ tools/ sandbox/
├── context/ memory/ skills/ workflows/ agents/
├── projects/ artifacts/ plugins/ security/
├── observability/ evaluation/ source-forge/ protocols/
├── scheduler/ cli/ desktop/ api-server/
```

### Issues Identified

1. **Layer mixing**: `execution` mixes domain logic with infrastructure
2. **No clear boundaries**: Dependencies flow in multiple directions
3. **Tight coupling**: Direct concrete dependencies instead of traits
4. **No Tower pattern**: Missing composable middleware

## Recommended Enhancements

### Phase 1: Reorganize by Layer

**New Structure**:

```
crates/
├── presentation/
│   ├── cli/                    # Move from crates/cli
│   └── rest/                   # Future web API
├── application/
│   ├── agent/                  # Move AgentEngine here
│   └── workflow/               # Future workflow orchestration
├── domain/
│   ├── entities/               # Run, Agent, Model, Tool
│   ├── services/              # Business logic (no I/O)
│   └── ports/                 # Repository/Provider traits
├── infrastructure/
│   ├── persistence/           # Move kernel SQLite
│   ├── providers/             # Keep providers here
│   ├── tools/                 # Keep tools here
│   ├── memory/                # Keep memory here
│   ├── protocols/             # Keep protocols here
│   └── sandbox/               # Move source-forge here
└── shared/
    ├── contracts/             # Keep contracts as shared types
    ├── error/                 # Extract error types
    └── telemetry/             # Logging, metrics
```

### Phase 2: Apply Tower Pattern

**Service abstraction**:

```rust
// domain/ports/service.rs
pub trait Service<Request> {
    type Response;
    type Error;
    
    async fn call(&self, req: Request) -> Result<Self::Response, Self::Error>;
}
```

**Layer composition**:

```rust
// infrastructure/providers/middleware.rs
pub struct CircuitBreakerLayer<S> {
    inner: S,
    threshold: u32,
}

pub struct RateLimitLayer<S> {
    inner: S,
    rpm: u32,
}
```

### Phase 3: Dependency Inversion

**Before** (tight coupling):

```rust
// execution/src/lib.rs - BAD
use agenticos_memory::InMemoryMemoryStore;  // Concrete
use agenticos_providers::HttpModelProvider;  // Concrete
```

**After** (trait-based):

```rust
// domain/ports/memory.rs
pub trait MemoryStore {
    async fn store(&self, entry: MemoryEntry) -> Result<(), Error>;
}

// application/agent/engine.rs
pub struct AgentEngine<M: MemoryStore> {
    memory: Arc<M>,
}
```

## Token Optimization Strategy

### 1. Command Output Filtering

**Always use `rtk` prefix**:
- `rtk cargo build` → 80-90% reduction
- `rtk cargo test` → 90-99% reduction
- `rtk git log` → 59-80% reduction

### 2. Modular Architecture

**Benefits**:
- Each crate can be checked independently
- Smaller context needed per operation
- Parallel compilation
- Faster iteration

### 3. Concise Documentation

**Rule**: Document WHAT and WHY, not HOW obvious:

```rust
// BAD
/// This function increments the counter by one.
/// It takes a mutable reference to the counter.
/// It returns nothing.

// GOOD
/// Increment the counter atomically.
///
/// # Panics
/// Panics if the counter would overflow.
pub fn increment(&mut self) {
    self.count += 1;
}
```

### 4. Focused Vertical Slices

**Current approach**: ✅ Already good
- One step at a time
- Each step has clear scope
- Verification before proceeding

**Enhancement**: Use workspace checks per slice:
```bash
rtk cargo check -p agenticos-kernel  # Check only affected crate
rtk cargo test -p agenticos-providers
```

## Implementation Roadmap

### Step 1: Prepare Workspace (No code changes)
- Document new structure
- Identify migration path
- Plan dependency shifts

### Step 2: Create New Crates
- `crates/presentation/cli/` (move from `crates/cli/`)
- `crates/domain/` (extract entities/services)
- `crates/shared/error/` (extract error types)

### Step 3: Migrate Layer by Layer
1. Move CLI to presentation
2. Extract domain entities
3. Move infrastructure implementations
4. Update dependencies

### Step 4: Apply Tower Pattern
- Define Service trait in domain
- Implement middleware layers
- Compose with ServiceBuilder

### Step 5: Verification
- All Rust checks pass
- All tests pass
- Dependency graph is DAG (no cycles)
- Domain has zero external deps

## Benefits

### 1. Maintainability
- Clear boundaries
- Easy to locate code
- Change impact is predictable

### 2. Testability
- Domain can be tested without infrastructure
- Mock implementations via traits
- Unit tests over integration tests

### 3. Scalability
- Add new providers without touching domain
- Swap persistence without business logic changes
- Add new presentation layers (web, gRPC)

### 4. Token Efficiency
- Smaller context per operation
- Targeted checks per crate
- Less scrolling/re-reading

## References

### MIT Repositories Consulted

1. **Tokio** (MIT): Async runtime, Service trait pattern
2. **Tower** (MIT): Middleware composition, Layer pattern
3. **Bulletproof Rust Web** (MIT): Clean architecture examples
4. **LogRocket Blog**: Workspace organization best practices
5. **IronFlow**: 20-crate workspace with strict layering

### Documentation Sources

- Tokio Service: https://tokio-rs.github.io/tokio-service/
- Tower: https://tower-rs.github.io/tower/
- Bulletproof Rust Web: https://gruberb.github.io/bulletproof-rust-web/
- LogRocket: https://blog.logrocket.com/best-way-structure-rust-web-services/

## Status

- **Phase**: Architecture proposal
- **Implementation**: Not started
- **Decision required**: User approval to proceed with restructuring
