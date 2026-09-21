# AgentiCOS

> Universal, model-agnostic agent runtime and application platform

## Overview

AgentiCOS is a Rust-first agent runtime and application platform in active development. The repository contains verified vertical slices, but it is not yet production-complete. It provides a universal, model-agnostic foundation for building, deploying, and managing AI agents with robust architecture, event sourcing, CQRS patterns, and comprehensive observability.

## Features

### Core Capabilities
- **Durable Runtime**: Event-sourced run lifecycle with state persistence and recovery
- **Model Agnostic**: Support for multiple model providers through a unified interface
- **CQRS Pattern**: Separation of command and query operations with event-driven synchronization
- **Event Sourcing**: Reliable event publication with outbox pattern
- **Workflow Orchestration**: Saga coordinator for multi-step workflows with compensating transactions
- **Runtime Configuration**: Feature flags for dynamic configuration
- **Observability**: Structured logging, metrics, and tracing
- **Tool Execution**: Secure tool execution with policy-based approval
- **Memory Management**: Context window management with compression and summarization

### Architecture
- **Architecture**: Functional crate boundaries with a documented Clean Architecture target; full layer migration is not yet complete
- **Vertical Slices**: Sequential, verified implementation protocol
- **Contract-First**: Domain contracts drive implementation
- **MIT References**: Patterns from Tokio, Tower, Bulletproof Rust Web, ddd-cqres-es, Mnesis

## Quick Start

### Prerequisites
- Rust 1.70+ with edition 2021
- Cargo workspace support
- Git

### Installation
```bash
git clone https://github.com/Ezequiell-26/agenticos.git
cd agenticos
cargo build --release
```

### CLI Usage

#### Run Management
```bash
# Create a new run
agenticos run create --id my-run --objective "Test objective"

# List all runs
agenticos run list

# Get run status
agenticos run status --id my-run
```

#### Feature Flags
```bash
# List all feature flags
agenticos flags list

# Get feature flag details
agenticos flags get --id my-flag

# Enable a feature flag
agenticos flags enable --id my-flag

# Disable a feature flag
agenticos flags disable --id my-flag
```

#### System Status
```bash
# Show system status
agenticos status system

# Show provider status
agenticos status providers

# Show tool status
agenticos status tools
```

#### Configuration
```bash
# Show current configuration
agenticos config show

# Set configuration value
agenticos config set key value
```

## Development

### Building
```bash
# Build all crates
cargo build --workspace

# Build specific crate
cargo build -p agenticos-kernel

# Run tests
cargo test --workspace

# Run clippy
cargo clippy --workspace --all-targets -- -D warnings

# Format code
cargo fmt --all
```

### Project Structure
```
agenticos/
├── crates/              # Workspace crates
│   ├── contracts/       # Domain contracts and traits
│   ├── kernel/          # Durable runtime kernel
│   ├── execution/      # CQRS execution layer
│   ├── providers/       # Model provider integration
│   ├── tools/           # Tool execution
│   ├── memory/          # Context and memory
│   ├── observability/   # Logging and metrics
│   ├── cli/             # Command-line interface
│   └── ...              # Additional crates
├── docs/                # Architecture documentation
├── doc/adr/             # Architecture Decision Records
├── reference/           # Project state and manifests
└── Cargo.toml           # Workspace configuration
```

### Architecture Documentation
- [ENHANCED-ARCHITECTURE.md](docs/architecture/ENHANCED-ARCHITECTURE.md) - Clean Architecture and Tower patterns
- [TOKEN-OPTIMIZATION.md](docs/architecture/TOKEN-OPTIMIZATION.md) - Token consumption optimization
- [ADVANCED-ARCHITECTURE.md](docs/architecture/ADVANCED-ARCHITECTURE.md) - CQRS, Event Sourcing, Outbox, Saga
- [CRATE-ORGANIZATION-ANALYSIS.md](docs/architecture/CRATE-ORGANIZATION-ANALYSIS.md) - Crate organization and migration plan
- [PROJECT-EXECUTIVE-SUMMARY.md](docs/PROJECT-EXECUTIVE-SUMMARY.md) - Executive summary of all verified steps

### Testing
```bash
# Run all tests
cargo test --workspace

# Run specific test suite
cargo test -p agenticos-kernel

# Run tests with output
cargo test --workspace -- --nocapture
```

## Verification

All 19 vertical slices have been verified with:
- Rust fmt/formatting check
- Cargo build verification
- Cargo test suite (54 tests passing)
- Cargo clippy (no warnings)
- Security gate (#![forbid(unsafe_code)] enforced)
- Architecture gate (contract boundaries maintained)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Development Protocol
The project follows a sequential, architecture-first development protocol with verified vertical slices. Each step must:
1. Reference MIT repository evidence for non-trivial features
2. Implement according to acceptance contract
3. Pass all verification gates (security, architecture, fmt, check, test, clippy)
4. Record evidence in implementation-state.json
5. Create ADR for architectural decisions

### Code Style
- Rust edition 2021
- `#![forbid(unsafe_code)]` enforced
- `#![warn(missing_docs)]` enforced
- `#![warn(missing_debug_implementations)]` enforced
- Use `rtk` prefix for all commands (token optimization)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

Based on patterns from:
- [Tokio](https://github.com/tokio-rs/tokio) - Async runtime and modular service abstractions
- [Tower](https://github.com/tower-rs/tower) - Service, Layer, and composable middleware
- [Bulletproof Rust Web](https://github.com/lf94/bulletproof-rust-web) - Clean architecture
- [ddd-cqres-es](https://github.com/ddd-by-examples/library-ddd-cqres-es) - CQRS, Event Sourcing, Sagas
- [Mnesis](https://github.com/mneisiago/mnesis) - Rust event sourcing and projections

## Status

**Version**: 0.1.0  
**Status**: Advanced development / architecture reconciliation  
**Verified Steps**: 51/53 records  
**Latest recorded Rust acceptance evidence**: 145/145 tests passing  
**Architecture**: Contract-first Rust runtime with CQRS, event-sourcing, workflows, observability and desktop/API surfaces; production hardening remains
