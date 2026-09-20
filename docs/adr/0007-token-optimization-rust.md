# ADR 0007 — Rust Token Optimization Plane

## Status

Accepted.

## Decision

AgentiCOS treats token/context optimization as a first-class Rust runtime capability owned by the context plane.

The implementation must be source-reuse-first: approved MIT-licensed Rust repositories may provide reusable implementation material after license, dependency, security and provenance gates pass.

The optimization plane includes:

- tool/MCP output compaction;
- deterministic lossless normalization;
- content-addressed deduplication;
- structured compact encoding;
- delta encoding;
- context compaction and pruning;
- token budget enforcement;
- semantic/exact caching;
- recovery and expansion;
- optimization telemetry and regression evaluation.

## Why

Agent workloads repeatedly transport verbose tool output, structured payloads, logs, source trees and unchanged context across model turns. Optimizing only at the UI or provider layer creates duplicated logic and inconsistent safety behavior.

A Rust-owned plane lets all surfaces share:

- one budget model;
- one security policy;
- one provenance model;
- one recovery model;
- deterministic behavior;
- low-overhead local execution;
- versioned contracts.

## Source policy

The following sources were inspected as token-optimization references at intake:

- rustkit-ai/trimcp — README declares MIT, but license evidence was not sufficient to admit source integration at intake.
- ojuschugh1/sqz — Elastic License 2.0; reference-only under the MIT-only integration policy.
- blackwell-systems/gcf-rust — MIT; admissible candidate for structured encoding/delta/session dedup after dependency and provenance review.
- signalbreak-labs/ogham — Apache-2.0; reference-only under the MIT-only integration policy.
- rtk-ai/rtk — Apache-2.0; reference-only under the MIT-only integration policy.

Non-MIT repositories may inform architectural comparison, but their source is not copied or vendored into an MIT-only implementation boundary.

## Required safeguards

Optimization must never silently change system/developer policy, secrets, security evidence or required error information.

Lossy transforms require an explicit policy and must never be substituted for a lossless transform merely to fit a budget.

Reversible transforms require retrievable originals, bounded lifetime and trust-boundary enforcement.

Optimizer failures fall back to the original payload and emit an observable event.

## Consequences

Positive:

- token efficiency becomes a shared platform capability;
- tool and provider integrations do not each reinvent compression;
- token savings can be benchmarked and regressed;
- structured context can use compact, delta-aware representations;
- recovery remains possible when content is compacted.

Tradeoffs:

- additional state and cache lifecycle management;
- more protocol/versioning work;
- license and dependency auditing before source reuse;
- optimization must be evaluated for correctness, not only size.

## Implementation boundary

The canonical public behavior is defined by AgentiCOS contracts, not upstream APIs.

Likely Rust modules live under `crates/context/` and include budget, classification, compression, dedup, encoding, delta, cache, protected-content, recovery, metrics and pipeline concerns.
