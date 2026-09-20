# AgentiCOS Reference Knowledge Corpus

## Implementation-source policy

The canonical implementation corpus is MIT-only.

Repositories with other licenses or insufficiently verified licensing may still be fully learned as comparative references, but they are not implementation sources for canonical AgentiCOS code.

## Purpose

AgentiCOS uses approved open-source repositories as an implementation reference corpus.

The goal is to prevent unnecessary reinvention during iterative development. Before a non-trivial feature is implemented, an AI coding agent must retrieve relevant reference evidence and map it to AgentiCOS contracts.

## Mandatory repository-learning policy

For every repository registered in this corpus, especially repositories whose relevant source is MIT-licensed, Source Forge must ingest and index the useful project knowledge rather than only storing a link.

At minimum, the ingestion pass must inspect:

- README and primary documentation;
- architecture/design documentation;
- source tree and relevant implementation modules;
- tests and fixtures;
- configuration and build metadata;
- CI/CD and quality gates where relevant;
- security and threat-model documentation where present;
- licenses and third-party notices;
- dependency manifests and important integration boundaries;
- agent/developer instructions such as AGENTS.md, CONTRIBUTING.md or equivalent.

The result is a searchable evidence pack. The coding agent retrieves the relevant portions for the current task instead of inventing an implementation from general model knowledge.

## Reference-first workflow

User requirement
  ↓
Capability classification
  ↓
Reference corpus lookup
  ↓
Relevant docs + source + tests
  ↓
Evidence extraction
  ↓
AgentiCOS contract mapping
  ↓
Implementation
  ↓
Verification
  ↓
Provenance record

## No-reinvention rule

Before adding a new subsystem or abstraction, the implementation agent must determine:

1. whether an AgentiCOS contract already exists;
2. which registered repositories implement a similar capability;
3. which relevant files, symbols and tests should be studied;
4. which behavior, edge cases, failure semantics and quality gates are demonstrated;
5. what license and provenance constraints apply;
6. whether an existing AgentiCOS adapter/domain can be extended instead.

If no suitable reference exists, or references conflict with requirements, a new design is permitted but the reason must be documented.

## Current high-value references

| Repository | Role | Primary domains |
|---|---|---|
| NousResearch/hermes-agent | agent runtime/product reference | agent loop, tools, skills, memory, providers, channels, scheduling |
| deepseek-ai/deepseek-harness | agent composition reference | provider composition, profiles, sessions, plugins, events |
| openai/codex | coding/runtime reference | Rust architecture, execution, sandboxing, developer workflows |
| tashfeenahmed/freellmapi | LLM gateway/router reference | provider aggregation, free-tier routing, fallback, quotas, model catalog, compatibility, key handling |
| diegosouzapw/OmniRoute | advanced routing/gateway/operations reference | routing strategies, resilience, quota-share, telemetry, compression, semantic cache, MCP/A2A, CLI tooling, quality gates |
| Microsoft AutoGen | multi-agent reference | delegation and orchestration |
| OpenHands/OpenHands | coding-agent reference | software engineering workflows and agent execution |
| browser-use/browser-use | browser-agent reference | browser automation and computer-use boundaries |
| langchain-ai/langgraph | workflow reference | durable graphs, checkpoints and orchestration |
| blackwell-systems/gcf-rust | token optimization reference | compact structured encoding, session dedup, delta encoding, streaming and conformance |
| rustkit-ai/trimcp | token optimization reference | MCP output compaction, lossless transforms, caching and metrics |
| ojuschugh1/sqz | token optimization reference | session deduplication, tool-output compression, MCP compression and recovery |
| signalbreak-labs/ogham | token optimization reference | reversible context compression, budgets, CCR and protected-content rules |
| rtk-ai/rtk | token optimization reference | CLI output filtering, recovery and token-savings analytics |

## FreeLLMAPI reference profile

Source: https://github.com/tashfeenahmed/freellmapi

Pinned reference commit at architecture intake: b882473c3a23251be312a7270e2e0dc1eae1329d

License at intake: MIT repository license. This does not imply every dependency is MIT; dependency-level notices remain authoritative.

Primary study areas:

- unified OpenAI-compatible gateway;
- provider adapters;
- free-tier aggregation;
- model catalogs;
- capability-aware selection;
- fallback chains;
- quota/rate-limit ledgers;
- key rotation and provider health;
- cooldown handling;
- streaming normalization;
- OpenAI/Anthropic/Gemini/Ollama compatibility;
- custom endpoints;
- tool-call compatibility;
- encrypted credential storage;
- MCP;
- sticky sessions/context handoff;
- prompt compression;
- self-updating catalogs;
- diagnostics and analytics.

## OmniRoute reference profile

Source: https://github.com/diegosouzapw/OmniRoute

Pinned reference branch at architecture intake: release/v3.8.51
Representative current source snapshot observed during intake: 7a921299c5b4c28dcf837f56a1c312b61414a646

License at intake: MIT repository license. This does not imply every dependency is MIT; OmniRoute itself also publishes third-party notices that must be inspected for integrated material.

Primary study areas:

- advanced multi-strategy routing and combo routing;
- policy-engine separation from execution pipelines;
- provider/model availability and degradation policy;
- retry/backoff/circuit-breaker orchestration;
- emergency fallback and model deprecation routing;
- quota-aware scheduling and quota-share concepts;
- live quota/routing telemetry;
- router evaluation and comparison tooling;
- prompt compression patterns;
- semantic caching and opt-in controls;
- provider/model discovery and modality detection;
- MCP and A2A server integration;
- CLI setup/configuration for coding agents;
- desktop/PWA deployment patterns;
- documentation, linting, typecheck and regression gates;
- third-party license/provenance enforcement.

These are reference patterns, not instructions to copy OmniRoute wholesale.

## Rust token optimization references

AgentiCOS treats token optimization as a first-class context/runtime capability. The coding agent must inspect the full relevant project surface of each registered source and then pass every source through the license-admission gate before using source code.

### gcf-rust

Source: https://github.com/blackwell-systems/gcf-rust

Pinned intake commit: 0f9b4a640b515b676544ed8ff9345393875a2251

License at intake: MIT confirmed.

Primary study areas: compact structured wire format, generic and graph encoding, streaming, session deduplication, delta encoding, content-addressed roots, re-anchoring and conformance fixtures.

### trimcp

Source: https://github.com/rustkit-ai/trimcp

Pinned intake commit: e88600b34fbb1f6c12d6061564b73f713a6905e0

The repository README declares MIT, but the GitHub repository metadata reported no machine-readable license and a root LICENSE file was not verified during intake. It therefore remains reference-only until Source Forge obtains sufficient license evidence.

Primary study areas: MCP proxying, ANSI stripping, JSON compaction, duplicate-line folding, lossless output transforms, exact cache hits, metrics and optional semantic code context.

### sqz

Source: https://github.com/ojuschugh1/sqz

Pinned intake commit: 9461782e6b5998bda68b49c92c864cf4900848b2

License at intake: Elastic License 2.0. It is not eligible for copied or vendored source under the MIT-only integration policy.

Primary study areas: pre-injection compression, session deduplication, MCP proxy compression, domain-specific command formatters, safe-mode handling, reversible references and recovery hooks.

### Ogham

Source: https://github.com/signalbreak-labs/ogham

Pinned intake commit: e4ccf8520483b2eb9d9d860c652f14091b48d7ad

License at intake: Apache-2.0. It is reference-only under the MIT-only integration policy.

Primary study areas: reversible context compaction, agent-aware protected-content rules, token budgets, CCR stores, incremental sessions, searchable fold records, cache planning, deterministic behavior and fail-closed semantics.

### RTK

Source: https://github.com/rtk-ai/rtk

Pinned intake commit: 727ee6e6c1fb5da3d0dd6c333b3be2edf8f3655c

License at intake: Apache-2.0. It is reference-only under the MIT-only integration policy.

Primary study areas: command-output filtering, smart routing of CLI commands, failure recovery/retrieval, native hooks, configuration preservation and token-savings analytics.

## MIT-only source admission

For the token-optimization implementation boundary, only sources with sufficient MIT license evidence may contribute copied/vendored/adapted source. Other sources may still contribute architectural evidence, test ideas or comparative analysis, but the final implementation must not embed their source code.

A root MIT declaration is not sufficient by itself: Source Forge must review relevant files, dependencies, notices and generated/static assets.

## Source evidence model

Source Forge should produce durable evidence records for consulted material:

Reference
 ├── repository
 ├── exact commit or pinned ref
 ├── path
 ├── symbol/component
 ├── capability
 ├── behavior
 ├── edge cases
 ├── tests
 ├── quality gates
 ├── license evidence
 └── applicability

An implementation decision should be traceable from:

AgentiCOS requirement
    ↓
Architecture contract
    ↓
Reference evidence
    ↓
Implementation
    ↓
Verification

## Update policy

References are not frozen forever.

Source Forge should periodically inspect configured upstreams, detect new commits/releases, re-audit licenses/dependencies, regenerate capability/evidence records and flag changes that could materially affect architecture.

A moving upstream must never silently change an AgentiCOS implementation. Updates become candidate references and pass architecture, provenance and verification gates first.
