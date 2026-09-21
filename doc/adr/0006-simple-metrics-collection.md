# Simple Metrics Collection

## Status

Accepted

## Context and Problem Statement

AgentiCOS needs metrics collection for monitoring run duration, token usage, error rates, and system health. The observability boundary was created but no metrics implementation existed.

## Decision Drivers

- Need for performance monitoring
- Need for error rate tracking
- Need for resource usage metrics
- Simplicity vs feature completeness
- Integration with existing tracing

## Considered Options

- **OpenTelemetry Metrics**: Full metrics with exporters (Prometheus, etc.)
- **Simple Atomic Counters**: Basic counters and histograms with atomic operations
- **No Metrics**: Rely only on logs

## Decision Outcome

Chosen option: "Simple Atomic Counters", because it provides basic metrics (counters, histograms) with minimal dependencies, atomic operations for thread safety, and can be extended to OpenTelemetry Metrics in the future.

### Consequences

- Good, because basic metrics available immediately
- Good, because minimal dependencies
- Good, because thread-safe with atomic operations
- Bad, because not Prometheus-compatible initially
- Bad, because limited metric types

## Validation

Validated by implementation in `crates/observability/src/metrics.rs` with Counter and Histogram, 2 passing tests.

## Pros and Cons of the Options

### Simple Atomic Counters

- Good: Basic metrics available
- Good: Minimal dependencies
- Good: Thread-safe
- Bad: Not Prometheus-compatible initially
- Bad: Limited metric types

### OpenTelemetry Metrics

- Good: Full metrics ecosystem
- Good: Prometheus compatibility
- Bad: Complex dependencies
- Bad: Heavier setup

### No Metrics

- Good: No implementation needed
- Bad: No monitoring capability
- Bad: Blind to performance issues
