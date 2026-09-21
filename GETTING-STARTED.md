# Getting Started with AgentiCOS

This guide will help you get started with AgentiCOS, from installation to running your first agent.

## Installation

### Prerequisites
- Rust 1.70 or later
- Cargo (comes with Rust)
- Git

### Clone and Build
```bash
git clone https://github.com/Ezequiell-26/agenticos.git
cd agenticos
cargo build --release
```

The compiled binary will be available at `target/release/agenticos` (or `target/release/agenticos.exe` on Windows).

## Quick Tour

### 1. Create Your First Run
```bash
agenticos run create --id hello-world --objective "Say hello to the world"
```

This creates a new run with ID "hello-world" and the objective "Say hello to the world".

### 2. List All Runs
```bash
agenticos run list
```

You'll see output like:
```
Listing all runs...
Found 1 runs:
  - RunId("hello-world"): Created
```

### 3. Check Run Status
```bash
agenticos run status --id hello-world
```

### 4. Manage Feature Flags
```bash
# List all flags
agenticos flags list

# Enable a flag
agenticos flags enable --id experimental-feature

# Check flag status
agenticos flags get --id experimental-feature

# Disable a flag
agenticos flags disable --id experimental-feature
```

### 5. Check System Status
```bash
agenticos status system
```

This shows the overall system status including runtime, kernel, providers, and tools.

## Architecture Overview

AgentiCOS is built with a layered architecture:

1. **Contracts Layer** - Domain contracts and traits (zero external dependencies)
2. **Kernel Layer** - Durable runtime with event sourcing and CQRS
3. **Execution Layer** - Command/query handling and projections
4. **Provider Layer** - Model provider integration
5. **Tool Layer** - Tool execution with policy-based approval
6. **CLI Layer** - Command-line interface

See [ENHANCED-ARCHITECTURE.md](docs/architecture/ENHANCED-ARCHITECTURE.md) for detailed architecture documentation.

## Understanding the Core Concepts

### Runs
A Run represents a single execution of an agent with a specific objective. Runs have:
- Unique ID
- State (Created, Admitted, Waiting, Running, Completed, Failed, Cancelled)
- Associated events
- Snapshot for recovery

### Event Sourcing
All state changes are recorded as events. This provides:
- Complete audit trail
- Event replay for debugging
- Temporal queries
- State recovery

### CQRS
Command-Query Responsibility Segregation separates:
- **Commands**: Write operations that change state
- **Queries**: Read operations that don't change state
- **Projections**: Optimized read models updated by events

### Outbox Pattern
Events are stored in an outbox before publication to ensure:
- Reliable event delivery
- Transactional consistency
- Idempotent publication

### Saga Coordinator
Multi-step workflows are orchestrated by sagas with:
- Step-by-step execution
- Compensating transactions for rollback
- Recovery from failures

### Feature Flags
Runtime configuration provides:
- Dynamic feature toggling
- A/B testing support
- Gradual rollout capabilities

## Next Steps

- Read the [Architecture Documentation](docs/architecture/) for deeper understanding
- Check the [Development Guide](DEVELOPMENT.md) for contribution guidelines
- Review the [ADRs](doc/adr/) for architectural decisions
- Explore the [Project Executive Summary](docs/PROJECT-EXECUTIVE-SUMMARY.md) for project status

## Troubleshooting

### Build Errors
If you encounter build errors:
1. Ensure Rust version is 1.70 or later: `rustc --version`
2. Update dependencies: `cargo update`
3. Clean build: `cargo clean && cargo build`

### Runtime Errors
If you encounter runtime errors:
1. Check system status: `agenticos status system`
2. Review logs for error messages
3. Verify feature flag configuration

### Test Failures
If tests fail:
1. Run tests with output: `cargo test --workspace -- --nocapture`
2. Check for specific test failures
3. Review test output for error details

## Getting Help

- Check the [Documentation](docs/)
- Review [ADRs](doc/adr/)
- Open an issue on GitHub
- Check the [Architecture Decision Records](doc/adr/) for design rationale
