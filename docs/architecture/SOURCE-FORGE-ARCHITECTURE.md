# AgentiCOS Source Forge Architecture

## Purpose

Source Forge turns external repositories into auditable candidate components and a structured reference knowledge corpus for AgentiCOS.

It supports complete repository import because AgentiCOS may study systems such as Hermes Agent, DeepSeek Harness, Codex, FreeLLMAPI and OmniRoute while keeping source snapshots separate from first-party code.

## Two output modes

1. Reference evidence — reusable knowledge about how a capability is implemented, tested and operated.
2. Integration candidate — source/component proposed for adaptation or controlled integration.

Reference evidence does not automatically become executable product code.

## Repository learning pipeline

URL
 ↓
Git import
 ↓
commit/ref pin
 ↓
license scan
 ↓
dependency scan
 ↓
documentation extraction
 ↓
architecture extraction
 ↓
source-tree discovery
 ↓
symbol/component graph
 ↓
test/fixture extraction
 ↓
CI/quality-gate extraction
 ↓
capability taxonomy
 ↓
security review
 ↓
reference evidence pack
 ↓
integration proposal
 ↓
adapt/vendor/reference/exclude
 ↓
tests + provenance gates

## Mandatory full-repository learning

For approved repositories, the learner must inspect the useful project surface, not just the README.

Required inspection targets include:

- README and docs;
- architecture notes;
- source modules related to the capability;
- tests and fixtures;
- package/build metadata;
- CI and quality configuration;
- security documentation;
- agent instructions;
- LICENSE and third-party notices;
- dependency boundaries.

For very large repositories, Source Forge may summarize and index the whole tree while retrieving exact files/symbols on demand. It must preserve a mapping back to the exact source snapshot.

## Reference states

imported → audited → analyzed → evidence-ready
                         ├────────→ reference
                         └────────→ proposed integration
                                      ├→ integrated
                                      └→ rejected

## Reference evidence packs

Each approved repository should produce:

- repository and exact commit/ref;
- license evidence;
- dependency/license findings;
- architecture summary;
- capability map;
- relevant files and symbols;
- key algorithms/patterns;
- failure/retry semantics;
- security boundaries;
- test references;
- quality/CI gates;
- API/protocol shape;
- compatibility constraints;
- applicability to AgentiCOS domains.

## FreeLLMAPI

Repository: https://github.com/tashfeenahmed/freellmapi

Pinned intake commit: b882473c3a23251be312a7270e2e0dc1eae1329d

At intake the repository declares an MIT license.

High-value reference areas include its gateway/router, provider adapters, model catalog, free-tier aggregation, quota/rate-limit ledger, health/cooldown handling, failover, streaming, compatibility surfaces, credential handling, MCP and operational tooling.

## OmniRoute

Repository: https://github.com/diegosouzapw/OmniRoute

Pinned intake branch: release/v3.8.51
Representative source snapshot observed during intake: 7a921299c5b4c28dcf837f56a1c312b61414a646

At intake the repository declares an MIT license.

High-value reference areas include:

- multi-strategy combo routing;
- routing policy modules separate from execution;
- resilience layers with retry/backoff/breakers and emergency fallback;
- quota-share and live quota telemetry concepts;
- router evaluation and comparison tooling;
- prompt compression;
- semantic cache and opt-in controls;
- provider/model discovery and modality handling;
- MCP/A2A integration;
- CLI automation for AI coding clients;
- strict testing, linting, typecheck and release-quality gates;
- third-party notice enforcement.

AgentiCOS should use these as evidence for contracts and design. It must not blindly copy OmniRoute internals or dependencies.

## Fusion algorithm

When multiple repositories implement the same capability, Forge compares interface compatibility, feature completeness, dependency weight, runtime behavior, test evidence, security characteristics, maintenance state, licensing constraints and integration complexity.

The output is a proposal, not an automatic overwrite.

## Legal/provenance gate

A repository-level MIT license is not enough to claim every file and dependency is MIT.

Every integrated or copied boundary must have appropriate license evidence and required notices.

## MIT-only optimization admission

The token-optimization implementation plane has a stricter admission rule: copied, vendored or directly adapted third-party source must have sufficient MIT license evidence.

A non-MIT or unverified repository may still be fully learned as reference evidence, but its source code cannot enter the canonical optimization implementation under the MIT-only policy.

For every optimization reference, Forge records:

- repository and exact commit;
- license evidence and confidence;
- relevant files and symbols;
- dependency and third-party notice findings;
- compression algorithms and safety invariants;
- reversibility and recovery semantics;
- benchmark and golden fixtures;
- applicability to AgentiCOS contracts.

Optimization-specific learning targets include trimcp, sqz, gcf-rust, Ogham and RTK. Their current intake status is maintained in docs/architecture/TOKEN-OPTIMIZATION-ARCHITECTURE.md.

## Token optimization learning flow

Feature request
  ↓
Identify tool/context/provider boundary
  ↓
Retrieve optimization evidence
  ↓
Verify license admission
  ↓
Inspect implementation + tests
  ↓
Extract deterministic/lossless guarantees
  ↓
Map to Rust contracts
  ↓
Implement/adapt
  ↓
Benchmark + fuzz + replay
  ↓
Provenance record

## Agent implementation contract

The coding agent must consult the reference corpus before creating a non-trivial subsystem.

Source Forge therefore becomes part of the implementation workflow:

Feature request
 → capability lookup
 → evidence retrieval
 → architecture contract
 → implementation
 → verification

A reference is an input to engineering, not a substitute for AgentiCOS contracts or security policy.
