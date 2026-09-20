# AgentiCOS Source Forge Architecture

## Purpose

Source Forge turns external repositories into auditable candidate components and a structured reference knowledge corpus for AgentiCOS.

It must support complete repository import because AgentiCOS may study systems such as Hermes Agent, DeepSeek Harness, Codex and FreeLLMAPI while keeping source snapshots separate from first-party code.

## Two output modes

1. Reference evidence — reusable knowledge about how a capability is implemented, tested and operated.
2. Integration candidate — source/component proposed for adaptation or controlled integration.

Reference evidence does not automatically become executable product code.

## Pipeline

URL
 ↓
Git import
 ↓
commit snapshot
 ↓
license scan
 ↓
dependency scan
 ↓
language/package discovery
 ↓
documentation extraction
 ↓
architecture extraction
 ↓
symbol/component graph
 ↓
capability taxonomy
 ↓
test/evidence extraction
 ↓
duplicate detection
 ↓
compatibility analysis
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

## Source states

imported → audited → analyzed → evidence-ready
                         ├────────→ reference
                         └────────→ proposed integration
                                      ├→ integrated
                                      └→ rejected

## Reference evidence packs

For each approved repository, Forge should generate:

- repository and exact commit;
- license evidence;
- dependency/license findings;
- architecture summary;
- capability map;
- relevant files and symbols;
- key algorithms/patterns;
- failure/retry semantics;
- security boundaries;
- test references;
- API/protocol shape;
- compatibility constraints;
- applicability to AgentiCOS domains.

The evidence pack is designed so an AI implementation agent can retrieve relevant source material instead of reasoning from a blank page.

## FreeLLMAPI

Repository: https://github.com/tashfeenahmed/freellmapi

Pinned intake commit: b882473c3a23251be312a7270e2e0dc1eae1329d

At intake the repository declares an MIT license.

High-value reference areas include its gateway/router, provider adapter model, model catalog, free-tier aggregation, quota/rate-limit ledger, health/cooldown handling, failover, streaming, compatibility surfaces, credential handling, MCP and operational tooling.

It is a reference for these capabilities. AgentiCOS must not silently copy its architecture or dependencies.

## Component graph

A component record references:

- source repository;
- exact commit;
- package/module;
- symbols/files;
- dependencies;
- capabilities;
- license evidence;
- security findings;
- test evidence;
- API shape;
- integration/reference decision;
- modifications.

## Fusion algorithm

When multiple repositories implement the same capability, Forge compares interface compatibility, feature completeness, dependency weight, runtime behavior, test evidence, security characteristics, maintenance state, licensing constraints and integration complexity.

The output is a proposal, not an automatic overwrite.

## Legal/provenance gate

A repository-level MIT license is not enough to claim every file and dependency is MIT.

Every integrated or copied boundary must have appropriate license evidence and required notices.

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
