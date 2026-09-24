# AgentiCOS Runtime Efficiency Architecture

## Goal

AgentiCOS is designed for long-lived desktop operation, including continuous twenty-four-hour use. Resource efficiency is treated as an architectural property: reduce idle memory, process churn, connection setup, duplicate model input and uncontrolled concurrency without reducing active-work quality.

## Resource-sensitive execution

The resource-sensitive path remains implemented in Rust. TypeScript stays at the presentation boundary. Runtime ownership covers concurrency, process lifetime, transport pooling, context budgeting, storage and capability enforcement.

## AI token efficiency

- Reserve output tokens and a safety margin before assembling model input.
- Preserve system instructions and prioritize recent useful turns.
- Bound history recovery and skill-summary loading.
- Cache static system-prompt material and append only dynamic context per turn.
- Normalize model-visible process and MCP text without deleting recoverable raw artifacts.
- Keep large raw tool output in the artifact plane instead of repeatedly placing it in model context.

## Provider efficiency

- Reuse a process-wide HTTP client so connection pools and keep-alive sockets are reused.
- Bound provider request concurrency with a semaphore.
- Cache short-lived health results so monitoring does not repeatedly perform model discovery.
- Keep connection pool idle limits and request timeouts configurable.

## MCP efficiency

- Registration is lazy; configured servers do not start processes until used.
- Initialized stdio sessions are reused.
- Tool discovery uses a time-to-live cache with a maximum entry count.
- Global MCP concurrency is bounded.
- Active MCP sessions have a resident-process cap and use least-recently-used eviction.
- Disabled or failing servers release their resident session.

## Agents and subagents

- Session agents are cached with a bounded resident count.
- Historical session state remains durable in SQLite so evicted agents can be reconstructed.
- Agent execution has a global concurrency limit.
- Existing subagent delegation depth and child-count controls remain in force.
- Long-lived conversations are not forcibly terminated by a fixed turn counter.

## Tools and plugins

- Native and MCP tools share the ToolRuntime execution plane.
- Tool execution has an independent global concurrency limit.
- Capability checks remain fail-closed.
- Plugin components that register through the tool/runtime plane inherit the same execution and capability boundaries.
- The plugin SDK is a contract layer; a full dynamic plugin process manager must preserve these limits when introduced.

## Storage

- High-frequency SQLite components use bounded connection pools.
- Cache replacement accounting is corrected so duplicate keys do not inflate resident-size accounting.
- Cache eviction repeatedly frees capacity until the requested entry can fit.
- Context deduplication state is local to each operation rather than process-global.

## Configuration

The main resource controls are documented in `.env.example`, including agent concurrency, cached sessions, prompt history, skill budgets, context window, provider concurrency and pooling, MCP concurrency and resident sessions, MCP cache limits, and tool concurrency.

## Principle

Never improve efficiency by silently removing information required for correctness. Prefer resource reuse, lazy activation, bounded residency, deterministic compaction, artifact spillover and measured concurrency.

## Verification

Performance changes must continue to pass the repository's architecture checks, TypeScript and Vite build, Rust workspace checks, provider integration tests, clippy, dependency checks and frontend verification.
