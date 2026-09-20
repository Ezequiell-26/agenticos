# AgentiCOS Third-Party Sources

## Global implementation rule

Canonical AgentiCOS product code uses only third-party source that Source Forge has explicitly admitted under the project's MIT-only implementation policy. Non-MIT repositories listed below are reference-only and cannot supply copied, vendored or directly adapted source.

AgentiCOS intentionally incorporates or evaluates open-source agent software.

Every imported or reference repository must be recorded with:

- repository URL;
- exact commit/ref;
- license evidence;
- imported path when source is mirrored;
- integration/reference mode;
- modifications;
- dependency/license review status;
- reference domains.

## Current sources

| Source | Intake license | Mode | Intended use |
|---|---|---|---|
| NousResearch/hermes-agent | MIT repository license | reference / candidate integration | agent loop, skills, memory, tools, providers, channels, scheduling |
| deepseek-ai/deepseek-harness | MIT repository license | reference / candidate integration | provider composition, profiles, sessions, plugins, events |
| openai/codex | Apache-2.0 | reference / adapter | Rust runtime, coding-agent execution and developer workflows |
| tashfeenahmed/freellmapi | MIT repository license | reference / candidate integration | provider gateway, free-tier aggregation, routing, quotas, fallback, model catalog, compatibility |
| diegosouzapw/OmniRoute | MIT repository license | reference / candidate integration | advanced routing strategies, resilience, quota telemetry, compression, caching, MCP/A2A, quality gates |
| Microsoft AutoGen | MIT code license; repository can contain separately licensed material | reference | multi-agent orchestration |
| OpenHands/OpenHands | MIT for core project; enterprise content requires separate review | reference | coding agents, runtimes, sessions |
| browser-use/browser-use | MIT package metadata | reference | browser automation |
| langchain-ai/langgraph | MIT for LangGraph package | reference | durable graph/workflow orchestration |
| blackwell-systems/gcf-rust | MIT repository license | reference / candidate integration | compact structured encoding, session deduplication, delta encoding, streaming and conformance |
| rustkit-ai/trimcp | README declares MIT; license artifact not verified at intake | reference only pending audit | MCP output compaction, lossless transforms, caching and metrics |
| ojuschugh1/sqz | Elastic License 2.0 | reference only | session deduplication, tool-output compression, MCP compression and recovery |
| signalbreak-labs/ogham | Apache-2.0 | reference only | reversible context compression, budgets, CCR and protected-content rules |
| rtk-ai/rtk | Apache-2.0 | reference only | CLI output filtering, recovery and token-savings analytics |

## OmniRoute intake record

- Repository: https://github.com/diegosouzapw/OmniRoute
- Pinned branch: release/v3.8.51
- Representative source snapshot observed during intake: 7a921299c5b4c28dcf837f56a1c312b61414a646
- License file at intake: MIT
- Reference profile: docs/architecture/REFERENCE-KNOWLEDGE-CORPUS.md
- Primary domains: Advanced Routing + Resilience + Telemetry + Compression/Cache + MCP/A2A

The representative snapshot is evidence provenance. Source Forge should refresh the pinned ref before any future source-level integration.

## FreeLLMAPI intake record

- Repository: https://github.com/tashfeenahmed/freellmapi
- Pinned commit: b882473c3a23251be312a7270e2e0dc1eae1329d
- License file at intake: MIT
- Reference profile: docs/architecture/REFERENCE-KNOWLEDGE-CORPUS.md
- Primary domain: Provider Gateway + Smart Routing

The source's live catalog and quotas are time-sensitive. They must be refreshed through Source Forge rather than hard-coded into architecture documents.

## Token optimization intake records

### gcf-rust

- Repository: https://github.com/blackwell-systems/gcf-rust
- Pinned commit: 0f9b4a640b515b676544ed8ff9345393875a2251
- License: MIT
- Mode: reference / candidate integration, subject to dependency and file-level review
- Domains: compact structured encoding, session deduplication, delta encoding, streaming, re-anchoring and conformance

### trimcp

- Repository: https://github.com/rustkit-ai/trimcp
- Pinned commit: e88600b34fbb1f6c12d6061564b73f713a6905e0
- License status: README declares MIT; root license artifact was not verified at intake
- Mode: reference only pending license audit
- Domains: MCP proxy, ANSI stripping, JSON compaction, deduplication, exact caching and metrics

### sqz

- Repository: https://github.com/ojuschugh1/sqz
- Pinned commit: 9461782e6b5998bda68b49c92c864cf4900848b2
- License: Elastic License 2.0
- Mode: reference only; excluded from MIT-only source integration
- Domains: pre-injection compression, session deduplication, MCP compression, recovery references and safe-mode handling

### ogham

- Repository: https://github.com/signalbreak-labs/ogham
- Pinned commit: e4ccf8520483b2eb9d9d860c652f14091b48d7ad
- License: Apache-2.0
- Mode: reference only; excluded from MIT-only source integration
- Domains: reversible compaction, budgets, CCR, protected content, deterministic/fail-closed behavior

### rtk

- Repository: https://github.com/rtk-ai/rtk
- Pinned commit: 727ee6e6c1fb5da3d0dd6c333b3be2edf8f3655c
- License: Apache-2.0
- Mode: reference only; excluded from MIT-only source integration
- Domains: shell-output filtering, agent hooks, failure recovery and analytics

## Full learning rule

For registered repositories, especially MIT-licensed sources, Source Forge must ingest and index the relevant project documentation, source, tests, build/quality configuration, security material, licenses and third-party notices before the source is treated as implementation guidance.

## License rule

An MIT root repository does not automatically make all code in its dependency tree MIT.

AgentiCOS must preserve required copyright/license notices and must not remove third-party attribution when integrating source code.

For the optimization plane, source integration is MIT-only. A non-MIT or unverified source can still be learned and benchmarked, but no copied/vendored source from it may enter the canonical implementation.
