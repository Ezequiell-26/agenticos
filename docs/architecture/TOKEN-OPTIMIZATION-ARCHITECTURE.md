# AgentiCOS Token Optimization Architecture

## Purpose

Token optimization is a first-class runtime concern in AgentiCOS, not a post-processing utility.

The objective is to minimize model-visible context, tool-output noise, duplicated state and avoidable protocol overhead while preserving correctness, recoverability, provenance and security.

The optimization system is Rust-native and sits across the tool, knowledge, model and gateway planes.

## MIT-only source integration policy

AgentiCOS uses a strict MIT-only policy for copied, vendored or directly adapted third-party source code in the optimization subsystem.

A repository may be learned as reference evidence without being eligible for source integration.

At intake, each source receives one of these states:

- **MIT-admissible** — license evidence is sufficient for source integration, subject to dependency and file-level review.
- **Reference-only** — useful implementation evidence exists, but its license is not MIT or is not sufficiently verified.
- **Rejected** — provenance, security, compatibility or licensing is unacceptable.

This policy does not mean every Rust dependency is itself MIT. Cargo dependencies remain subject to their own SPDX/license audit and required notices.

## Current reference disposition

| Repository | Rust | License evidence at intake | Optimization role | Source status |
|---|---:|---|---|---|
| blackwell-systems/gcf-rust | Yes | MIT confirmed by GitHub repository metadata and project README | structured token-efficient wire format, session dedup, delta encoding, streaming, generic/graph context | **MIT-admissible** |
| rustkit-ai/trimcp | Yes | README declares MIT, but GitHub repository metadata reported no machine-readable license and a root LICENSE was not verified during intake | MCP proxy, lossless tool-output compaction, caching, metrics | **Reference-only until license evidence is verified** |
| ojuschugh1/sqz | Yes | Elastic License 2.0 (ELv2) | tool-output compression, session dedup, MCP compression, recovery references | **Reference-only; not eligible for copied source under MIT-only policy** |
| signalbreak-labs/ogham | Yes | Apache-2.0 confirmed by GitHub repository metadata and README | reversible context compression, budgets, CCR, protected-content rules, deterministic compaction | **Reference-only; not eligible for copied source under MIT-only policy** |
| rtk-ai/rtk | Yes | Apache-2.0 confirmed by GitHub repository metadata and README | CLI output filtering, failure recovery, analytics and agent hook patterns | **Reference-only; not eligible for copied source under MIT-only policy** |

Pinned intake commits:

- trimcp: `e88600b34fbb1f6c12d6061564b73f713a6905e0`
- sqz: `9461782e6b5998bda68b49c92c864cf4900848b2`
- gcf-rust: `0f9b4a640b515b676544ed8ff9345393875a2251`
- ogham: `e4ccf8520483b2eb9d9d860c652f14091b48d7ad`
- rtk: `727ee6e6c1fb5da3d0dd6c333b3be2edf8f3655c`

These pins are evidence snapshots. Source Forge must re-audit moving upstreams before source-level integration.

## Optimization pipeline

All model-visible content passes through an optimization decision point:

```
Raw provider/tool/context data
        ↓
Content classification
        ↓
Security/protected-content check
        ↓
Token estimation + budget check
        ↓
Lossless normalization
        ↓
Exact deduplication / content-addressed cache
        ↓
Structured encoding / delta encoding when applicable
        ↓
Context pruning / compaction
        ↓
Final budget enforcement
        ↓
Model-visible payload
```

Optimization is applied at the lowest safe boundary. The system must prefer transforming tool results and structured context before modifying user intent or model-generated reasoning.

## Core components

### 1. Tool-output optimizer

Responsible for deterministic, lossless transformations on tool/MCP results.

Candidate transformations include:

- ANSI/control-sequence removal;
- whitespace and pretty-JSON compaction;
- repeated-line collapsing;
- redundant boilerplate filtering;
- structured result grouping;
- domain-aware test/build/log formatting;
- output size measurement;
- full-output retention for recovery.

The optimizer must preserve error diagnostics, secrets, security evidence and content explicitly marked as non-compressible.

### 2. Content-addressed deduplication store

Repeated content is stored once and represented in the active context by a stable reference.

Requirements:

- cryptographic content identity;
- session/workspace scope;
- bounded retention;
- provenance;
- TTL and eviction;
- integrity verification;
- reversible retrieval;
- access control;
- no cross-principal leakage.

A dedup reference is valid only when its original content remains retrievable under the same trust boundary.

### 3. Structured context encoding

GCF is the primary MIT-admissible reference for structured data that crosses the model boundary.

AgentiCOS should support a pluggable encoder contract:

```text
StructuredPayload
   ├── JSON-compatible representation
   ├── compact wire representation
   └── delta representation relative to a known base
```

GCF-oriented capabilities to evaluate:

- generic structured encoding;
- graph-oriented encoding;
- session deduplication;
- delta encoding;
- content-addressed roots;
- streaming encoding;
- re-anchoring;
- lossless decode;
- conformance fixtures.

The format must remain opt-in and bilateral. If a client/model does not support the encoding, AgentiCOS falls back to a canonical representation.

### 4. Context compiler

The context compiler decides what should reach the model.

It must operate on structured message/item types rather than raw text alone.

Priority ordering:

1. system/developer policy and security instructions;
2. latest user intent;
3. explicit pinned content;
4. unresolved tool errors and required recovery evidence;
5. current task state and active files;
6. recent relevant context;
7. durable memory selected by relevance;
8. older successful tool output;
9. redundant historical material.

Dropping lower-priority information must never silently erase the durable source. It should create a recoverable reference or an auditable compaction record when feasible.

### 5. Budget controller

Every model call has an explicit token budget:

```text
context_limit
  - system_reserve
  - output_reserve
  - safety_margin
  = available_input_budget
```

The controller must refuse an unsafe overflow instead of silently producing an oversized request.

Budgets propagate through:

- parent run;
- child run;
- provider/model route;
- tool-call batch;
- context compilation;
- background workflow.

### 6. Semantic cache

Semantic caching is optional and policy-controlled.

Cache keys must include enough information to avoid unsafe reuse, potentially including:

- normalized input;
- model/provider compatibility class;
- tool/environment capabilities;
- workspace/project identity where relevant;
- policy version;
- cache schema version.

Every cache hit records provenance and cache policy. Security-sensitive or highly dynamic operations must be bypassable.

### 7. Token accounting and telemetry

AgentiCOS must distinguish:

- exact tokenizer counts;
- provider-reported counts;
- calibrated estimates;
- pre-compression tokens;
- post-compression tokens;
- cache-hit tokens;
- recovered tokens;
- budget failures.

Metrics should include compression ratio, bytes/tokens before and after, dedup hit rate, cache hit rate, expansion/retrieval rate, protected-content bypass rate and regressions.

Optimization claims must be benchmarked against actual payloads; architecture must not hard-code advertised percentages as guarantees.

## Safety invariants

1. Never compress system/developer policy.
2. Never alter credentials, secrets or security-sensitive evidence.
3. Never remove an error if it is needed for diagnosis or recovery.
4. Never create a cache entry that crosses an unauthorized trust boundary.
5. Never use a lossy transform where the contract requires byte preservation.
6. Every reversible transform has an expansion/recovery path.
7. Every optimization is measurable and feature-flagged.
8. Any optimizer failure falls back to the original content.
9. Context budgeting fails closed when the safe budget cannot be met.
10. Compression cannot change tool semantics.
11. Model-visible references must remain resolvable for their declared lifetime.
12. Optimization decisions are observable and replayable.

## Architecture placement

```text
                    Rust Runtime
                         │
          ┌──────────────┼──────────────┐
          │              │              │
      Tool/MCP       Context Plane   Provider Gateway
          │              │              │
      classifier       compiler       router
          │              │              │
      compaction ─── dedup/cache ─── encoding
          │              │              │
          └──────────────┼──────────────┘
                         │
                    Model request
```

No UI, SDK or individual provider is allowed to implement its own independent token-optimization loop. All canonical decisions live behind Rust-owned contracts.

## Recommended Rust boundary

The canonical workspace should evolve toward:

```text
crates/context/
├── budget.rs
├── classify.rs
├── compress.rs
├── dedup.rs
├── encode.rs
├── delta.rs
├── cache.rs
├── protected.rs
├── recovery.rs
├── metrics.rs
└── pipeline.rs
```

The exact module split may change, but ownership remains in the context plane and contracts remain stable.

## Reference-first implementation rules

For a token-optimization feature, the coding agent must:

```text
Requirement
  ↓
Reference corpus search
  ↓
License admission check
  ↓
Read docs + source + tests
  ↓
Extract algorithm/edge cases/quality gates
  ↓
Map to AgentiCOS contract
  ↓
Implement or adapt
  ↓
Benchmark
  ↓
Verify reversibility + safety
  ↓
Record provenance
```

MIT source is never pasted into AgentiCOS without first recording repository, commit, path, license evidence, dependency findings and modifications.

## Verification strategy

Every optimizer requires:

- golden fixtures for representative inputs;
- property tests for losslessness where claimed;
- fuzz testing for parsers/decoders;
- budget boundary tests;
- protected-content survival tests;
- dedup integrity tests;
- replay tests;
- cross-version compatibility tests;
- benchmark regression thresholds;
- failure fallback tests;
- provenance and license gates.

The optimization layer is considered production-ready only after it proves that lower token usage does not reduce correctness, safety, observability or recoverability.
