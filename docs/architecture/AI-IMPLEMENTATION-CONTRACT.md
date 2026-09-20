# AgentiCOS AI Implementation Contract

This contract defines how an AI coding agent must build AgentiCOS during iterative development.

## Mandatory sequence

1. Inspect architecture.
2. Identify the feature manifest.
3. Identify the current slice.
4. Create or adjust the surface shell when needed.
5. Connect the shell to the final application protocol.
6. Connect the protocol to a deterministic test implementation.
7. Replace the test implementation with the real implementation.
8. Add persistence.
9. Add streaming/asynchronous behavior when required.
10. Add security and permissions.
11. Add observability.
12. Add failure and recovery behavior.
13. Add integration and end-to-end verification.
14. Update the manifest and architecture documentation.
15. Leave a stable checkpoint.

## Example: Agent experience

The agent feature must not begin as a huge autonomous backend with no usable surface.

Correct progression:

Agent Window
→ Chat Shell
→ Canonical Thread Contract
→ Mock Provider through Provider Contract
→ Real Provider
→ Streaming
→ Tool Calls
→ Approval + Sandbox
→ Context + Skills
→ Memory
→ Verification + Repair
→ Subagents
→ Background Runs
→ MCP/A2A/Engine interoperability

At every stage the existing experience remains functional.

## Surface-first does not mean UI-owned architecture

The visible shell is created early so the product remains testable. It must immediately consume the same application protocol and canonical domain contracts used by the finished product.

The UI must never invent a feature-local transport, persistence store, agent loop or tool execution path.

## Existing-work rule

Before creating a new service, inspect existing services and contracts. Extend an existing abstraction when the capability belongs there.

If the current implementation violates the architecture, repair the boundary before adding dependent functionality.

## Feature completion rule

A feature is complete only when it is user-reachable, contract-connected, persistent when appropriate, secured, observable, failure-tolerant, tested and documented.

## Stable checkpoints

Every iteration ends with a checkpoint that another coding agent can continue from without reconstructing hidden context.