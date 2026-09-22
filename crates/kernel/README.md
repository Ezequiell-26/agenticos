# AgentiCOS Kernel

The core runtime engine and persistence foundation for AgentiCOS.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AgentiCOS Kernel                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ AgentEngine  │◄──►│  Event Bus   │◄──►│  Memory/     │    │
│  │              │    │              │    │  Context     │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│         │                    │                    │               │
│         ▼                    ▼                    ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool         │    │ Provider     │    │  Saga        │    │
│  │ Execution   │    │ Router       │    │  Coordinator │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### AgentEngine
The central execution engine that coordinates agent operations:
- Manages agent lifecycle (creation, execution, termination)
- Coordinates tool execution with capability validation
- Maintains run identity and state persistence
- Integrates with ModelProvider for LLM interactions

### Event Bus
Asynchronous event streaming system:
- Broadcast events to multiple subscribers
- Event data with type, payload, and timestamp
- EventProcessor for handling events
- Thread-safe with broadcast channels

### Memory/Context
Persistent storage for agent state:
- SQLite Tier 2 Memory with FTS5
- Conversation history storage
- Session management
- Context loading for ReAct loop
- Checkpoints and recovery

### Tool Execution Pipeline
Safe tool execution with policy enforcement:
- Pre-execution hooks for capability validation
- Post-execution hooks for result processing
- PermissionPolicyHook for security checks
- ToolExecutionContext for execution state

### LLM Router
Provider abstraction and routing:
- ModelEntry for provider configuration
- Capability grants and issuer
- Rate limiting and usage tracking
- Support for multiple LLM providers

### Saga Coordinator
Distributed transaction coordination:
- Saga contracts for multi-step operations
- Compensating transactions for recovery
- SagaStep and SagaStepStatus tracking
- Background event publishing

## Quickstart

```bash
# Build the kernel
cargo build -p agenticos-kernel

# Run tests
cargo test -p agenticos-kernel

# Example: Create an agent
use agenticos_kernel::AgentEngine;

let engine = AgentEngine::new();
let run_id = engine.create_run().await?;
```

## Persistence Layer

The kernel uses a dual-layer persistence strategy:

1. **EventStore**: Immutable event log for audit trail
2. **SnapshotStore**: Periodic state snapshots for fast recovery
3. **SQLite Tier 2**: Conversation history with full-text search

## Event Flow

```
User Request
    │
    ▼
┌──────────────┐
│ AgentEngine  │
└──────────────┘
    │
    ├──► Capability Validation
    ├──► Tool Execution
    ├──► LLM Inference
    └──► Event Publishing
         │
         ▼
    ┌──────────────┐
    │  Event Bus   │
    └──────────────┘
         │
         ├──► Memory Update
         ├──► Snapshot Store
         └──► Background Publisher
```

## Testing

Run concurrency stress tests:

```bash
cargo test -p concurrency-stress -- --nocapture
```

This simulates 10-20 concurrent agents working on the event bus to validate memory consumption and latency.

## Architecture Principles

1. **Durable Execution**: All operations are logged and recoverable
2. **Capability-Based Security**: Tools require explicit capability grants
3. **Event-Driven**: Asynchronous communication between components
4. **Provider Abstraction**: Multiple LLM providers supported through unified interface
5. **Multi-Agent Coordination**: Subagents and supervisor patterns supported

## License

MIT
