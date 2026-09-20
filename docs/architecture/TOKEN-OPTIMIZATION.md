# AgentiCOS Token Optimization Strategy

> Strategies to minimize token consumption while maintaining effectiveness

## Current Token Consumption Analysis

### Typical AI Operations

| Operation | Token Cost (no optimization) | With RTK | Savings |
|-----------|----------------------------|----------|---------|
| `cargo build` | ~2000 tokens | ~200-400 | 80-90% |
| `cargo test` | ~1500 tokens | ~15-150 | 90-99% |
| `git log` | ~800 tokens | ~160-320 | 60-80% |
| `git diff` | ~1000 tokens | ~200-400 | 60-80% |
| File read (large) | ~500-1000 tokens | ~200-400 | 60% |

### Project-Specific Hotspots

1. **Large crate files**: `providers/src/lib.rs` (660 lines)
2. **Repeated reads**: Reading same files multiple times
3. **Verbose output**: Raw cargo/test output without filtering
4. **Diff context**: Showing too much context in diffs

## Optimization Strategies

### 1. Always Use RTK Prefix

**Mandatory Rule**: Prefix ALL commands with `rtk`

```bash
# ALWAYS do this
rtk cargo build
rtk cargo test
rtk git status
rtk git diff
rtk git log

# NEVER do this
cargo build
cargo test
git status
git diff
git log
```

**Savings**: 60-90% per command

### 2. Modular Crate Structure

**Problem**: Large monolithic files (660+ lines)

**Solution**: Split into focused modules

```
providers/src/
├── lib.rs              # Re-exports only (50 lines)
├── registry.rs         # ProviderRegistry (100 lines)
├── catalog.rs          # ModelCatalog (100 lines)
├── credentials.rs      # CredentialPool (100 lines)
├── quota.rs            # QuotaTracker (100 lines)
├── health.rs           # HealthChecker (100 lines)
├── retry.rs            # RetryManager (100 lines)
├── fallback.rs         # FallbackManager (100 lines)
└── http.rs             # HttpModelProvider (100 lines)
```

**Benefits**:
- Smaller files to read
- Targeted file reads (only needed module)
- Easier to navigate
- Faster compilation (parallel)

**Savings**: 70% on file reads, 30% on compile time

### 3. Layered Architecture

**Problem**: Dependencies flow in multiple directions

**Solution**: Enforce DAG dependency graph

```
presentation → application → domain ← infrastructure
                                      ↑
                                    shared
```

**Benefits**:
- Clear dependency boundaries
- No circular dependencies
- Each crate can be checked independently
- Smaller context per operation

**Savings**: 50% on dependency analysis

### 4. Targeted Cargo Operations

**Problem**: Full workspace check when only one crate changed

**Solution**: Check only affected crates

```bash
# BAD - checks entire workspace
rtk cargo check --workspace

# GOOD - checks only affected crate
rtk cargo check -p agenticos-providers

# Multiple crates if needed
rtk cargo check -p agenticos-providers -p agenticos-tools
```

**Savings**: 80-90% on incremental builds

### 5. Focused File Reads

**Problem**: Reading entire files when only need specific section

**Solution**: Use line ranges

```bash
# BAD - reads entire file
read /path/to/file.rs

# GOOD - reads only needed section
read /path/to/file.rs offset=100 limit=20
```

**Savings**: 70-90% on file reads

### 6. Search Instead of Read

**Problem**: Reading files to find specific patterns

**Solution**: Use grep/code_search

```bash
# BAD - read entire file looking for pattern
read /path/to/file.rs
# then manually search

# GOOD - search directly
grep "pattern" /path/to/file.rs
code_search "find where ModelProvider is used"
```

**Savings**: 80-95% on pattern-finding operations

### 7. Batch Operations

**Problem**: Multiple sequential reads of related files

**Solution**: Read in parallel batch

```bash
# BAD - sequential reads
read file1.rs
read file2.rs
read file3.rs

# GOOD - parallel batch (built-in)
# The system automatically batches concurrent read calls
```

**Savings**: 50% on multi-file operations

### 8. Concise Documentation

**Problem**: Verbose docs consume tokens

**Solution**: Document only non-obvious aspects

```rust
// BAD - verbose
/// This function registers a provider in the registry.
/// It takes a ProviderEntry as a parameter.
/// The ProviderEntry contains the provider_id and other metadata.
/// It returns a Result with empty success or ContractError on failure.
/// The function is async and uses a write lock on the providers HashMap.
pub async fn register(&self, entry: ProviderEntry) -> Result<(), ContractError> {
    // ...
}

// GOOD - concise
/// Register a provider in the registry.
///
/// # Errors
/// Returns `ContractError` if the provider_id already exists.
pub async fn register(&self, entry: ProviderEntry) -> Result<(), ContractError> {
    // ...
}
```

**Savings**: 50-70% on documentation reads

### 9. Summary Mode for Large Outputs

**Problem**: Full test output when only need summary

**Solution**: Use summary mode

```bash
# BAD - full output
rtk cargo test

# GOOD - summary
rtk summary cargo test
```

**Savings**: 90% on test output

### 10. Use Git Features Efficiently

**Problem**: Full diff showing entire file

**Solution**: Use git features

```bash
# BAD - full diff
rtk git diff

# GOOD - diff only changed files
rtk git diff --stat

# GOOD - diff only specific file
rtk git diff crates/providers/src/lib.rs

# GOOD - show only commit message
rtk git log --oneline -5
```

**Savings**: 70-90% on git operations

## Recommended Workflow

### Before Any Operation

1. **Check status first**: `rtk git status`
2. **Identify affected crates**: Only work on what changed
3. **Use targeted operations**: Don't check entire workspace

### During Implementation

1. **Read only what's needed**: Use line ranges
2. **Search instead of read**: Use grep/code_search
3. **Batch related reads**: Let system parallelize

### After Implementation

1. **Check only affected crates**: `-p <crate-name>`
2. **Run targeted tests**: Only tests for changed code
3. **Use summary mode**: Don't read full output

## Concrete Examples

### Example 1: Add New Provider

**OLD workflow** (high token cost):
```bash
rtk cargo check --workspace           # ~2000 tokens
rtk cargo test --workspace            # ~1500 tokens
read crates/providers/src/lib.rs     # ~660 tokens
# ... read more files ...
# Total: ~4000 tokens
```

**NEW workflow** (optimized):
```bash
rtk grep "ProviderRegistry" crates/providers/src/lib.rs  # ~50 tokens
read crates/providers/src/lib.rs offset=1 limit=50      # ~50 tokens
rtk cargo check -p agenticos-providers                    # ~200 tokens
rtk cargo test -p agenticos-providers                     # ~100 tokens
# Total: ~400 tokens (90% savings)
```

### Example 2: Add New Test

**OLD workflow**:
```bash
read crates/kernel/tests/smoke_test.rs  # ~400 tokens
rtk cargo test --workspace              # ~1500 tokens
# Total: ~1900 tokens
```

**NEW workflow**:
```bash
read crates/kernel/tests/smoke_test.rs offset=50 limit=20  # ~50 tokens
rtk cargo test -p agenticos-kernel                            # ~100 tokens
# Total: ~150 tokens (92% savings)
```

## Tool Configuration

### RTK Configuration

Ensure RTK is configured for maximum efficiency:

```bash
# RTK should be in PATH
# Use rtk prefix always
# No special config needed - works by default
```

### Git Configuration

Optimize git for concise output:

```bash
# In .gitconfig
[diff]
    compact = true
[log]
    decorate = short
```

### Cargo Configuration

Optimize cargo for workspace:

```toml
# In Cargo.toml
[workspace]
resolver = "2"  # Enables cargo check -p
```

## Monitoring Token Usage

### Track Token Savings

Use `rtk gain` to see cumulative savings:

```bash
rtk gain              # Show total savings
rtk gain --history    # Show per-command history
```

### Audit Operations

Periodically review:

```bash
rtk discover           # Analyze for missed RTK usage
```

## Implementation Checklist

- [ ] Always use `rtk` prefix for commands
- [ ] Split large files into modules
- [ ] Enforce layered architecture
- [ ] Use `-p` for targeted cargo operations
- [ ] Use line ranges for file reads
- [ ] Use grep/code_search instead of reading
- [ ] Write concise documentation
- [ ] Use summary mode for large outputs
- [ ] Use git features efficiently
- [ ] Monitor token usage with `rtk gain`

## Expected Savings

With all optimizations:

| Operation Type | Before | After | Savings |
|----------------|--------|-------|---------|
| Typical workflow | ~4000 tokens | ~400 tokens | 90% |
| Large crate edit | ~6000 tokens | ~600 tokens | 90% |
| Multi-crate change | ~8000 tokens | ~800 tokens | 90% |
| Project session | ~20000 tokens | ~2000 tokens | 90% |

## References

- RTK Documentation: Built into CLI
- Tokio Architecture: https://tokio-rs.github.io/tokio/
- Tower Middleware: https://tower-rs.github.io/tower/
- Bulletproof Rust Web: https://gruberb.github.io/bulletproof-rust-web/

## Status

- **Phase**: Optimization strategy defined
- **Implementation**: Ready to apply
- **Decision required**: Apply optimizations immediately
