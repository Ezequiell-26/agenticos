# Development Guide

This guide covers how to develop, test, and contribute to AgentiCOS.

## Development Setup

### Prerequisites
- Rust 1.70+ with edition 2021
- Cargo workspace support
- Git
- (Optional) `rtk` for token-optimized commands

### Clone and Setup
```bash
git clone https://github.com/Ezequiell-26/agenticos.git
cd agenticos
```

### Build
```bash
# Build all crates
cargo build --workspace

# Build specific crate
cargo build -p agenticos-kernel

# Build release binary
cargo build --release --bin agenticos
```

## Development Workflow

### Token Optimization (RTK)
AgentiCOS uses `rtk` prefix for token optimization. Always use:
```bash
rtk cargo build
rtk cargo test
rtk cargo clippy
rtk git status
rtk git add .
rtk git commit -m "message"
```

This provides 60-90% token reduction on common operations.

### Workspace Structure
```
crates/
├── contracts/       # Domain contracts (zero external dependencies)
├── kernel/          # Durable runtime kernel
├── execution/      # CQRS execution layer
├── providers/       # Model provider integration
├── tools/           # Tool execution
├── memory/          # Context and memory
├── observability/   # Logging and metrics
├── cli/             # Command-line interface
└── ...              # Additional crates
```

### Adding a New Crate
1. Add to `Cargo.toml` workspace members
2. Create `crates/<name>/Cargo.toml`
3. Create `crates/<name>/src/lib.rs`
4. Add `#![forbid(unsafe_code)]` and `#![warn(missing_docs)]`
5. Update dependency declarations if needed

### Contract-First Development
When adding new capabilities:
1. Define contracts in `crates/contracts/src/lib.rs`
2. Implement traits in appropriate kernel crate
3. Add tests in kernel smoke tests
4. Verify with full workspace check/test/clippy
5. Create ADR for architectural decisions

## Testing

### Run All Tests
```bash
rtk cargo test --workspace
```

### Run Specific Test Suite
```bash
rtk cargo test -p agenticos-kernel
```

### Run Tests with Output
```bash
rtk cargo test --workspace -- --nocapture
```

### Run Specific Test
```bash
rtk cargo test test_name
```

### Test Organization
- Unit tests: In `src/lib.rs` or `src/tests/` modules
- Integration tests: In `tests/` directory or kernel smoke tests
- CLI tests: In `crates/cli/src/main.rs` test module

## Code Style

### Rust Lints
All crates enforce:
- `#![forbid(unsafe_code)]` - No unsafe code allowed
- `#![warn(missing_docs)]` - Public items must be documented
- `#![warn(missing_debug_implementations)]` - Types should implement Debug

### Formatting
```bash
rtk cargo fmt --all
```

### Linting
```bash
rtk cargo clippy --workspace --all-targets -- -D warnings
```

### Pre-commit Checks
Before committing:
1. `rtk cargo fmt --all`
2. `rtk cargo check --workspace --all-targets`
3. `rtk cargo test --workspace --all-targets`
4. `rtk cargo clippy --workspace --all-targets -- -D warnings`

## Architecture Patterns

### Clean Architecture
- Dependencies flow inward (contracts = zero external dependencies)
- Domain logic is independent of infrastructure
- Use traits for boundaries

### Contract-First
- Define contracts before implementation
- Implementations depend on contracts, not concrete types
- Use Arc<dyn Trait> for runtime polymorphism

### Vertical Slices
- Implement one capability at a time
- Verify each slice completely before next
- Follow acceptance contracts in implementation-state.json

### Reference Evidence
- Use MIT repositories for architectural patterns
- Reference specific repos: Tokio, Tower, ddd-cqres-es, Mnesis
- Document evidence in ADRs

## Common Patterns

### Async Runtime
```rust
use tokio::sync::Arc;

#[async_trait::async_trait]
pub trait MyTrait: Send + Sync {
    async fn my_method(&self) -> Result<(), ContractError>;
}
```

### Error Handling
```rust
use anyhow::Result;

pub fn my_function() -> Result<()> {
    // Use ? for error propagation
    some_operation()?;
    Ok(())
}
```

### Logging
```rust
use tracing::{info, error, debug};

info!("Information message");
error!("Error message: {}", error);
debug!("Debug message");
```

## Debugging

### Using Debug Prints
```rust
println!("Debug: {:?}", variable);
```

### Using Tracing
```bash
RUST_LOG=debug rtk cargo test
```

### Test Debugging
```bash
rtk cargo test --workspace -- --nocapture -- --test-threads=1
```

## Documentation

### Code Documentation
```rust
/// Brief description.
///
/// Longer description with details.
///
/// # Examples
///
/// ```
/// let result = function();
/// ```
pub fn function() -> Result<()> {
    Ok(())
}
```

### Architecture Documentation
- [ENHANCED-ARCHITECTURE.md](docs/architecture/ENHANCED-ARCHITECTURE.md)
- [ADVANCED-ARCHITECTURE.md](docs/architecture/ADVANCED-ARCHITECTURE.md)
- [TOKEN-OPTIMIZATION.md](docs/architecture/TOKEN-OPTIMIZATION.md)

### ADRs
Architecture Decision Records are in `doc/adr/`. Create new ADRs for significant architectural decisions:
```bash
rtk adrs new "decision title"
```

## Troubleshooting

### Build Failures
1. Check Rust version: `rustc --version`
2. Clean build: `cargo clean && cargo build`
3. Update dependencies: `cargo update`
4. Check for circular dependencies

### Test Failures
1. Run specific test with output: `cargo test test_name -- --nocapture`
2. Check for missing dependencies
3. Verify contract implementations
4. Review async runtime initialization

### Clippy Warnings
- Fix clippy warnings before committing
- Use `-- -D warnings` to treat warnings as errors
- Common issues: unused imports, dead code, complexity

## Performance

### Profile Builds
```bash
cargo build --release
```

### Benchmarking
(Not yet implemented - planned for future)

### Memory Profiling
(Not yet implemented - planned for future)

## Continuous Integration

The project uses GitHub Actions for CI:
- Rust build verification
- Rust test execution
- Clippy linting
- Formatting checks

All checks must pass before merging.

## Further Reading

- [Tokio Guide](https://tokio.rs/tokio/tutorial/)
- [Tower Guide](https://github.com/tower-rs/tower)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Cargo Book](https://doc.rust-lang.org/cargo/)
