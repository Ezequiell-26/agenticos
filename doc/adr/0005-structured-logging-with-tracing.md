# Structured Logging with Tracing

## Status

Accepted

## Context and Problem Statement

AgentiCOS needs structured logging with correlation IDs for request tracking and debugging. The existing Logger contract provides basic logging but lacks structured output, correlation ID propagation, and integration with modern observability tooling.

## Decision Drivers

- Need for structured, queryable logs
- Correlation ID propagation across boundaries
- Integration with observability tooling
- Performance considerations
- Development vs production environments

## Considered Options

- **OpenTelemetry Tracing**: Full distributed tracing with exporters (Jaeger, Prometheus)
- **Tracing with Subscriber**: Structured logging with correlation IDs, simpler setup
- **Basic println/logging**: Simple but unstructured, no correlation

## Decision Outcome

Chosen option: "Tracing with Subscriber", because it provides structured logging with correlation IDs, integrates with tracing ecosystem, has simple setup, and can be extended to OpenTelemetry in the future if needed.

### Consequences

- Good, because structured logs are queryable
- Good, because correlation IDs enable request tracking
- Good, because integrates with tracing ecosystem
- Bad, because not full distributed tracing (can be added later)
- Bad, because requires tracing context propagation

## Validation

Validated by implementation in `crates/observability/src/lib.rs` with `init_logging()` and `new_correlation_id()` functions, 2 passing tests.

## Pros and Cons of the Options

### Tracing with Subscriber

- Good: Structured, queryable logs
- Good: Correlation ID support
- Good: Simple setup
- Good: Extensible to OpenTelemetry
- Bad: Not full distributed tracing initially

### OpenTelemetry Tracing

- Good: Full distributed tracing
- Good: Metrics integration
- Bad: Complex dependency management
- Bad: Heavier setup

### Basic println/logging

- Good: Simple to use
- Bad: Unstructured
- Bad: No correlation IDs
- Bad: Not queryable
