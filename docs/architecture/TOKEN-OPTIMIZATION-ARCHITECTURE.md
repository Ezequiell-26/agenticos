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

## Canonical optimization data model

AgentiCOS does not hash or cache an arbitrary serialized string and then mutate that
string through later compression stages. Instead it separates **logical identity**
from **wire representation**.

Every optimizable payload has a canonical identity record:

```
Logical content
 ├── source_hash          # identity of the original protected/logical payload
 ├── normalized_hash      # identity after deterministic lossless normalization
 ├── structured_root      # logical structured snapshot root, when applicable
 ├── representation_id    # JSON / compact / GCF / text / delta / etc.
 ├── schema_version
 └── policy_version
```

A transform may change the representation hash without changing the logical content
identity. Delta encoding is computed from logical structured snapshots and their
canonical roots, not from the bytes of a previously compressed representation.

This prevents one optimization stage from invalidating another stage's references.

## Canonical optimization pipeline

The default pipeline is explicitly ordered:

```
1. Ingest
   ↓
2. Classify + protected-content policy
   ↓
3. Deterministic lossless normalization
   ↓
4. Logical identity + normalized identity
   ↓
5. Exact deduplication / content-addressed retention
   ↓
6. Structured materialization
   ↓
7. Structured dedup + delta planning (when supported)
   ↓
8. Representation selection
   ↓
9. Context compaction / priority pruning
   ↓
10. Final token-budget enforcement
   ↓
11. Provider-specific rendering
   ↓
12. Model request
```

The pipeline is not a blind universal sequence for every content type. Each stage
declares its input/output representation and whether it is lossless.

### Stage 1–4: normalize before identity

ANSI/control-noise removal, whitespace normalization, pretty-JSON compaction and
other deterministic transforms happen before the canonical normalized hash is
created. The original source hash remains available for provenance and exact
recovery.

### Stage 5: exact deduplication

Exact deduplication operates on canonical logical/normalized content identity.
Repeated content can therefore resolve to an existing retained object without
depending on the later wire representation.

### Stage 6–8: structured representation and delta

For structured data, AgentiCOS may materialize a canonical structured snapshot and
derive a content-addressed root. GCF is the primary MIT-admissible reference for
this boundary. Its specification defines pack roots and requires atomic delta
application plus root verification; deltas contain complete declarations rather
than session-only references where reconstruction requires them. citeturn514029search2turn514029search3

Session deduplication and delta encoding are therefore treated as separate,
composable optimizations. A session reference must never be required to validate
the integrity of a delta snapshot.

### Stage 9–10: context compaction and budget

Only after safe normalization/dedup/encoding does the context planner decide which
historical items fit the model budget. Protected instructions, latest user intent,
required errors and explicitly pinned content remain policy-protected.

The budget controller is fail-closed: when the safe budget cannot be achieved,
the call is rejected or escalated for a stronger model/context strategy rather
than silently overflowing the provider limit.

### Stage 11: provider rendering

The final optimized context is rendered into the provider's required protocol only
at the boundary. Internal hashes and logical roots remain independent from provider
serialization so provider-specific formatting changes do not invalidate durable
content identity.

## Cache invalidation contract

A cache entry is valid only when all cache-key dimensions required by its operation
remain compatible.

Minimum key material is:

```
operation_kind
+ normalized_input_hash
+ relevant_source_snapshot
+ model/provider compatibility class
+ tool/environment capability fingerprint
+ policy_version
+ optimizer_schema_version
+ representation_version
```

Source changes are handled by content identity, not by TTL alone. For example, a
one-character change in a Forge-managed source file changes its file hash and, when
relevant, the workspace/source snapshot root; downstream cached context derived from
that source therefore misses automatically.

Caches must support:

- dependency-aware invalidation;
- workspace/project generation or snapshot IDs;
- TTL as a secondary eviction mechanism, not the correctness mechanism;
- explicit invalidation events;
- negative-cache expiry;
- stale-while-revalidate only for operations whose contract permits it;
- per-trust-boundary isolation.

Cache hits must record the exact key dimensions and provenance used to accept the hit.

## Compression and loss classification

Every optimizer declares:

```
loss_class = Lossless | Lossy(policy)
input_representation
output_representation
recovery_mode
```

The default is **Lossless**.

The architecture permits lossy summarization only as a later budget-recovery tier and
only when the policy explicitly authorizes it. A lossy result can never replace the
canonical durable source.

## Tool-output optimizer

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

The trimcp reference demonstrates MCP proxying, deterministic output transforms,
caching and metrics, including ANSI stripping, compact JSON, duplicate-line folding
and minification. Its README declares MIT, but Source Forge keeps its source
integration status pending sufficient license-file verification. citeturn514029search0

## Context compiler

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

## Budget controller

Every model call has an explicit token budget:

```
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

## Semantic cache

Semantic caching is optional and policy-controlled.

Cache keys must include enough information to avoid unsafe reuse, potentially including:

- normalized input;
- model/provider compatibility class;
- tool/environment capabilities;
- workspace/project identity where relevant;
- policy version;
- cache schema version.

Every cache hit records provenance and cache policy. Security-sensitive or highly dynamic operations must be bypassable.

## Token accounting and telemetry
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
