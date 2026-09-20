# AgentiCOS Third-Party Sources

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

## Full learning rule

For registered repositories, especially MIT-licensed sources, Source Forge must ingest and index the relevant project documentation, source, tests, build/quality configuration, security material, licenses and third-party notices before the source is treated as implementation guidance.

## License rule

An MIT root repository does not automatically make all code in its dependency tree MIT.

AgentiCOS must preserve required copyright/license notices and must not remove third-party attribution when integrating source code.
