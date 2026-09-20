# ADR 0009 — Universal Capability and Runtime Seam Architecture

## Status

Accepted.

## Decision

AgentiCOS will expose APIs, providers, plugins, skills, memory backends, tools, terminals, jobs, browser/media attachments, code intelligence, multi-agent teams, MCP/A2A, credentials, profiles/scopes, scheduling, trajectories, supervisors, package updates, management operations and AI-generated changes through explicit contracts.

The canonical AgentEngine remains an orchestration consumer. It does not directly own extension discovery, provider selection, memory persistence, channel transport, terminal lifecycle, filesystem mutation, scheduling or package management.

## Design rules

1. Every extensible capability has a versioned descriptor and lifecycle.
2. Every cross-boundary interaction uses a versioned protocol or contract.
3. Security authority is granted by policy/capabilities, never by registry membership or feature flags.
4. Extension state is scoped and owned so it can be drained and disposed without leaks.
5. Durable state has a persistence and recovery model.
6. Large outputs spill to artifact-backed storage rather than overflowing model context.
7. Filesystem mutations require observed-version protection and rollback semantics.
8. Remote agents and untrusted extensions remain external principals.
9. AI-generated repository changes pass through the Change Plane before promotion.
10. No capability may require a vendor-specific branch inside AgentEngine when it can implement an existing contract.

## Consequence

AgentiCOS can grow toward Hermes/Harness-level extensibility without converting the runtime into a collection of vendor-specific code paths. New capabilities become implementations of stable contracts plus manifests, protocols, tests and recovery semantics.
