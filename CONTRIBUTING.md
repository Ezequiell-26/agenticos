# Contributing to AgentiCOS

Thank you for your interest in contributing to AgentiCOS! This document provides guidelines for contributing.

## Code of Conduct

Be respectful, constructive, and collaborative. We aim to maintain a welcoming community.

## Development Protocol

AgentiCOS follows a **sequential, architecture-first development protocol** with verified vertical slices. Before contributing:

1. **Read the Architecture Documentation**
   - [ENHANCED-ARCHITECTURE.md](docs/architecture/ENHANCED-ARCHITECTURE.md)
   - [ADVANCED-ARCHITECTURE.md](docs/architecture/ADVANCED-ARCHITECTURE.md)
   - [PROJECT-EXECUTIVE-SUMMARY.md](docs/PROJECT-EXECUTIVE-SUMMARY.md)

2. **Check Current Status**
   - Read `reference/PROJECT-STATE.md`
   - Read `reference/manifests/implementation-state.json`
   - Check the current authorized step

3. **Reference-First Rule**
   - Consult MIT repositories for architectural patterns
   - Document evidence in ADRs
   - Don't invent behavior without repository evidence

4. **Vertical Slice Protocol**
   - Only work on the authorized step
   - Implement according to acceptance contract
   - Verify all gates before marking complete
   - Record evidence in manifest

## How to Contribute

### Bug Reports
1. Check existing issues first
2. Create issue with:
   - Clear title
   - Description of bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Rust version, OS)

### Feature Requests
1. Check existing issues and roadmap
2. Create issue with:
   - Clear description of feature
   - Use case and motivation
   - Proposed implementation approach
   - Reference to MIT repositories if applicable

### Pull Requests
1. Fork the repository
2. Create a branch for your work
3. Make your changes following the development protocol
4. Ensure all checks pass:
   - `cargo fmt --all`
   - `cargo check --workspace --all-targets`
   - `cargo test --workspace --all-targets`
   - `cargo clippy --workspace --all-targets -- -D warnings`
5. Update documentation if needed
6. Create ADR for architectural decisions
7. Submit PR with clear description

### Code Style
- Follow existing code style
- Use `#![forbid(unsafe_code)]` in all crates
- Document public items with `///`
- Implement `Debug` for public types
- Use `rtk` prefix for all commands

### Commit Messages
Follow conventional commits:
```
feat(scope): brief description

Longer description if needed.

Refs: #issue-number
```

## Development Guidelines

### Adding New Capabilities
1. Define contracts in `crates/contracts/src/lib.rs`
2. Implement in appropriate kernel crate
3. Add tests in kernel smoke tests
4. Update documentation
5. Create ADR
6. Verify all gates

### Adding Tests
- Add unit tests in the same file
- Add integration tests in `tests/` or kernel smoke tests
- Ensure tests are deterministic
- Use test clocks/IDs for determinism

### Documentation
- Update README.md for user-facing changes
- Update DEVELOPMENT.md for developer changes
- Create/update ADRs for architectural changes
- Update architecture docs for structural changes

## Architecture Principles

### Dependency Inversion
- Dependencies flow inward
- Contracts have zero external dependencies
- Implementation depends on contracts

### Contract-First
- Define contracts before implementation
- Use traits for boundaries
- Implementations are swappable

### Clean Architecture
- Separate domain from infrastructure
- Use layers for organization
- Maintain clear boundaries

### MIT References
- Use patterns from Tokio, Tower, ddd-cqres-es, Mnesis
- Document specific repos used
- Reference exact patterns

## Review Process

### Self-Review Checklist
- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] No clippy warnings
- [ ] Documentation updated
- [ ] ADR created if needed
- [ ] Contract-first approach followed
- [ ] MIT references documented

### PR Review
- Maintainers will review for:
  - Architectural correctness
  - Contract adherence
  - Test coverage
  - Documentation
  - Security (no unsafe code)
  - Token optimization (rtk usage)

### Approval
- Maintainer approval required for:
  - Architectural changes
  - Contract changes
  - New capabilities
  - Breaking changes

## Project Structure

### Crates
- `contracts/` - Domain contracts (only this crate has zero external dependencies)
- `kernel/` - Durable runtime implementation
- `execution/` - CQRS execution layer
- `providers/` - Model provider integration
- `tools/` - Tool execution
- `memory/` - Context and memory
- `observability/` - Logging and metrics
- `cli/` - Command-line interface
- Others: See workspace for complete list

### Documentation
- `docs/architecture/` - Architecture documentation
- `doc/adr/` - Architecture Decision Records
- `reference/` - Project state and manifests
- `README.md` - Project overview
- `GETTING-STARTED.md` - User guide
- `DEVELOPMENT.md` - Developer guide
- `CONTRIBUTING.md` - This file

## Security

### No Unsafe Code
All crates use `#![forbid(unsafe_code)]`. This is enforced at the workspace level.

### Credential Safety
- Never commit secrets or API keys
- Use environment variables for configuration
- Never log sensitive data

### Vulnerability Reporting
- Report security issues privately
- Do not create public issues for security bugs
- Contact maintainers directly

## Questions?

- Check the [Documentation](docs/)
- Review [ADRs](doc/adr/)
- Check existing issues
- Open a question issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
