# ADR 0003 — Provider-Agnostic Agent Core

Status: Accepted

## Decision

The agent runtime never depends directly on a model vendor SDK, endpoint URL or authentication mechanism.

Providers implement the Provider Contract. The Router selects among compatible provider/model candidates using policy, capabilities, health, quota, latency and cost.

## Consequence

Adding a provider does not require changing agent-loop logic.

User-owned free-tier, paid, local and custom APIs are first-class provider categories.

Native adapters may expose provider-specific capabilities without leaking vendor types into the runtime.