# Crate Organization Analysis and Migration Plan

## Current Crate Organization

The AgentiCOS workspace currently has 26 crates organized by functional domain:

```
crates/
├── agents/           # Agent execution and management
├── artifacts/        # Artifact storage and retrieval
├── cli/              # Command-line interface (binary)
├── context/          # Context window management
├── contracts/       # Domain contracts and traits
├── evaluation/       # Model evaluation and testing
├── execution/       # Command/query execution layer
├── gateway/         # API gateway and routing
├── kernel/          # Durable runtime kernel
├── memory/          # Memory persistence
├── observability/   # Logging, metrics, tracing
├── plugins/         # Plugin system
├── projects/        # Project management
├── protocols/       # Protocol implementations (MCP, etc.)
├── providers/       # Model provider integration
├── router/          # Request routing
├── runtime/         # Runtime orchestration
├── sandbox/         # Execution sandbox
├── scheduler/       # Task scheduling
├── security/        # Security and capabilities
├── skills/          # Skill definitions
├── source-forge/    # Source code operations
├── tools/           # Tool execution
└── workflows/       # Workflow orchestration
```

## Current Dependency Flow

Based on ENHANCED-ARCHITECTURE.md analysis:

- **contracts/**: Zero external dependencies (domain contracts)
- **kernel/**: Depends on contracts (runtime implementation)
- **execution/**: Depends on contracts, kernel (CQRS implementation)
- **providers/**: Depends on contracts (provider integration)
- **memory/**: Depends on contracts (context/memory)
- **observability/**: Minimal dependencies (logging/metrics)
- **cli/**: Depends on contracts, kernel, execution, providers, tools, memory, protocols (product surface)

## Target Layer-Based Structure

According to ENHANCED-ARCHITECTURE.md and Clean Architecture principles:

```
crates/
├── domain/           # Pure domain logic (zero external dependencies)
│   ├── contracts/    # Existing contracts/ moved here
│   └── entities/     # Domain entities and value objects
├── application/     # Use cases and orchestration
│   ├── execution/    # Existing execution/ moved here
│   ├── workflows/    # Existing workflows/ moved here
│   └── scheduler/    # Existing scheduler/ moved here
├── infrastructure/  # External integrations
│   ├── providers/    # Existing providers/ moved here
│   ├── protocols/    # Existing protocols/ moved here
│   ├── storage/      # Existing kernel/, memory/ moved here
│   └── observability/ # Existing observability/ moved here
├── presentation/    # Product surfaces
│   ├── cli/          # Existing cli/ moved here
│   └── gateway/      # Existing gateway/ moved here
└── shared/           # Shared utilities
    ├── tools/        # Existing tools/ moved here
    ├── security/     # Existing security/ moved here
    └── plugins/      # Existing plugins/ moved here
```

## Migration Plan

### Phase 1: Documentation (Current Step)
- [x] Document current crate organization
- [x] Define target layer-based structure
- [x] Create migration plan
- [ ] Update architecture documentation
- [ ] Verify all tests pass

### Phase 2: Create Layer Structure (Future Step)
- Create new directory structure (domain/, application/, infrastructure/, presentation/, shared/)
- Move crates without breaking changes (using workspace paths)
- Update Cargo.toml workspace members
- Verify compilation

### Phase 3: Update Dependencies (Future Step)
- Update internal dependencies to use new paths
- Verify all tests pass
- Update documentation

### Phase 4: Cleanup (Future Step)
- Remove old directory structure
- Final verification
- Update ADR

## Benefits of Layer-Based Organization

According to ENHANCED-ARCHITECTURE.md:

1. **Maintainability**: Clear boundaries make changes predictable
2. **Testability**: Domain layer can be tested without infrastructure
3. **Scalability**: Adding providers doesn't touch domain logic
4. **Onboarding**: New developers understand structure quickly
5. **Dependency Inversion**: Dependencies flow inward (domain = zero external deps)

## Risks and Mitigations

**Risk**: Breaking existing workspace configuration
**Mitigation**: Use gradual migration with workspace path aliases

**Risk**: Test failures during migration
**Mitigation**: Verify tests after each phase

**Risk**: Documentation inconsistency
**Mitigation**: Update documentation in sync with code changes

## Current Status

This document remains a target-state migration analysis. The current workspace has 26 functional crates; the proposed layer-based reorganization has not been executed. Verification of the existing workspace must remain separate from approval to migrate crate boundaries.

## Next Steps

The next authorized step would be Phase 2: Create Layer Structure, which involves:
- Creating new directory structure
- Moving crates without breaking changes
- Updating workspace configuration
- Verifying compilation

This step should only proceed after explicit authorization from the project maintainers, as it involves structural changes to the workspace.
