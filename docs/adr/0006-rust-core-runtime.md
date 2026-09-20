# ADR-0006 — Rust as the AgentiCOS Core Runtime

- Status: Accepted
- Date: 2026-09-21
- Scope: runtime, kernel, execution platform and first-party infrastructure

## Context

AgentiCOS is intended to be a long-lived universal agent runtime rather than only a chat application.

The platform needs durable background execution, high-concurrency provider/tool/child-agent workloads, strict lifecycle enforcement, process and sandbox orchestration, cancellation, retries, leases, recovery, capability-based security, deterministic contract testing, and multiple client surfaces.

The repository currently contains a TypeScript architecture prototype. That prototype is useful for validating contracts and vertical slices, but it must not accidentally become the long-term runtime boundary.

## Decision

**Rust is the canonical implementation language for the AgentiCOS core runtime.**

| Layer | Primary technology |
|---|---|
| Kernel / runtime | Rust |
| Async runtime | Tokio |
| Domain contracts | Rust traits + versioned protocol schemas |
| Execution / workers | Rust |
| Provider normalization and routing | Rust |
| Tool registry and execution | Rust |
| Sandbox / process control | Rust + platform-specific isolation |
| Persistence adapters | Rust |
| API / application protocol | Rust |
| CLI / TUI | Rust |
| Web application | TypeScript / React |
| Desktop shell | Tauri + Web UI |
| Python integrations | Python SDK / adapters |
| Portable plugins | WASM where isolation and portability are useful |

## Architectural consequences

1. The kernel stays independent of provider SDKs, UI frameworks and storage vendors.
2. Python and TypeScript become integration/surface languages rather than competing runtime implementations.
3. Cross-language behavior is defined by versioned protocols and schemas, not shared internal objects.
4. The runtime must not expose language-specific internals as public product contracts.
5. The existing TypeScript implementation is a **transitional architecture prototype** until equivalent Rust slices replace it.
6. Migration must happen by vertical slice rather than a large semantic rewrite.
7. Every Rust subsystem must have a documented contract before implementation expands.

## Non-goals

This ADR does not require rewriting every integration in Rust. Python remains valid where its ecosystem gives a material advantage, and TypeScript remains valid for web/product surfaces.

## Migration rule

A Rust slice may replace a TypeScript prototype only after contract conformance, lifecycle/state tests, security tests, persistence/recovery tests where applicable, replay tests where applicable, and an exercised integration or end-to-end path.

## Result

AgentiCOS gets a canonical strongly typed concurrent runtime while preserving practical ecosystem boundaries for Python, TypeScript, WASM and external agent engines.
