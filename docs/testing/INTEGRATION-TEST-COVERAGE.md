# Integration Test Coverage Analysis

## Current Test Coverage

### Test Summary
- **Baseline test count**: 54 tests before the current provider integration phase
- **Test Suites**: 25 suites
- **Coverage Areas**: Kernel, Execution, Providers, Contracts

### Current Test Coverage by Crate

#### crates/kernel/tests/smoke_test.rs (Primary test suite)
**Tests**: 47 tests
- Kernel runtime operations (Run lifecycle, event store, snapshot store)
- Configuration and logging
- Capability issuer
- Deterministic clock and ID generator
- Context manager and memory store
- Outbox store and background publisher
- Saga coordinator
- Feature flag store

#### crates/execution/src/lib.rs (Unit tests)
**Tests**: 4 tests
- Command handler (test_command_handler)
- Query handler (test_query_handler)
- Event-driven synchronization (test_event_driven_synchronization)
- Read/write isolation (test_read_write_isolation)

#### crates/providers/src/lib.rs (Unit tests)
**Tests**: 3 tests
- HTTP model provider (test_http_model_provider)
- Circuit breaker (test_circuit_breaker)

### Coverage Gaps

Based on the scope of integration-test-coverage-vertical-slice-1, the following areas need additional integration tests:

#### 1. Kernel Runtime Operations
- [x] Basic run lifecycle (covered)
- [x] Event store operations (covered)
- [x] Snapshot store operations (covered)
- [ ] **Gap**: Multi-run orchestration scenarios
- [ ] **Gap**: Run lifecycle edge cases (concurrent runs, race conditions)
- [ ] **Gap**: Event store recovery scenarios
- [ ] **Gap**: Snapshot consistency verification

#### 2. Execution Layer
- [x] Command/query separation (covered)
- [x] Event-driven synchronization (covered)
- [ ] **Gap**: End-to-end command execution with kernel
- [ ] **Gap**: Query performance scenarios
- [ ] **Gap**: Command validation edge cases
- [ ] **Gap**: Projection consistency verification

#### 3. Provider Layer
- [x] HTTP model provider integration through a deterministic local HTTP server
- [x] Provider failover ordering
- [x] Disabled auto-failover behavior
- [x] Provider health state drives fallback selection
- [x] Retry-policy and quota-state composition
- [x] Credential/provider isolation
- [x] Multiple-provider orchestration through registry + catalog + health + fallback + transport
- [ ] **Remaining gap**: Retry execution/backoff behavior is stored but not yet exercised by a real retry executor
- [ ] **Remaining gap**: Timeout behavior is not yet exposed by the current HTTP provider contract
- [ ] **Remaining gap**: Provider error normalization currently maps HTTP errors into ModelResponse rather than ContractError

#### 4. CQRS Operations
- [x] Command/query separation (covered)
- [x] Event-driven synchronization (covered)
- [ ] **Gap**: Projection update consistency
- [ ] **Gap**: Event ordering guarantees
- [ ] **Gap**: Concurrent command handling
- [ ] **Gap**: Query isolation guarantees

#### 5. Outbox Pattern
- [x] Outbox store operations (covered)
- [x] Background publisher (covered)
- [ ] **Gap**: Outbox event ordering
- [ ] **Gap**: Publisher failure scenarios
- [ ] **Gap**: Dead letter queue handling
- [ ] **Gap**: Event deduplication

#### 6. Saga Coordinator
- [x] Saga execution (covered)
- [x] Saga compensation (covered)
- [ ] **Gap**: Multi-saga orchestration
- [ ] **Gap**: Saga participant coordination
- [ ] **Gap**: Saga timeout handling
- [ ] **Gap**: Saga recovery scenarios

#### 7. Feature Flags
- [x] Flag store operations (covered)
- [x] Flag enable/disable (covered)
- [x] Flag types (covered)
- [ ] **Gap**: Flag runtime evaluation
- [ ] **Gap**: Flag persistence scenarios
- [ ] **Gap**: Flag value validation

## Integration Test Plan

### Phase 1: Kernel Runtime Integration Tests
1. Multi-run orchestration scenarios
2. Concurrent run handling
3. Event store recovery
4. Snapshot consistency

### Phase 2: Execution Layer Integration Tests
1. End-to-end command execution
2. Query performance
3. Command validation edge cases
4. Projection consistency

### Phase 3: Provider Layer Integration Tests
1. Provider failover
2. Health check integration
3. Resilience patterns
4. Multi-provider orchestration

### Phase 4: CQRS Integration Tests
1. Projection consistency
2. Event ordering
3. Concurrent commands
4. Query isolation

### Phase 5: Outbox Integration Tests
1. Event ordering
2. Publisher failure
3. Dead letter queue
4. Event deduplication

### Phase 6: Saga Integration Tests
1. Multi-saga orchestration
2. Participant coordination
3. Timeout handling
4. Recovery scenarios

### Phase 7: Feature Flag Integration Tests
1. Runtime evaluation
2. Persistence scenarios
3. Value validation

## Current Status

Phase 3 provider integration coverage is implemented in crates/infrastructure/providers/tests/provider_plane_integration.rs.
The suite now covers provider/model registration, ordered failover, disabled failover, health-driven selection, retry/quota state, credential isolation, deterministic HTTP transport, and end-to-end multi-provider orchestration.

The remaining provider gaps are intentionally recorded above rather than being implied as production-complete.

