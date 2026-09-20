# AgentiCOS Third-Party Sources

AgentiCOS intentionally incorporates or evaluates open-source agent software.

Every imported or reference repository must be recorded with:

- repository URL;
- exact commit;
- license evidence;
- imported path when source is mirrored;
- integration/reference mode;
- modifications;
- dependency/license review status.

## Current sources

| Source | Intake license | Mode | Intended use |
|---|---|---|---|
| NousResearch/hermes-agent | MIT repository license | reference / candidate integration | agent loop, skills, memory, tools, providers, channels, scheduling |
| deepseek-ai/deepseek-harness | MIT repository license | reference / candidate integration | provider composition, profiles, sessions, plugins, events |
| openai/codex | Apache-2.0 | reference / adapter | Rust runtime, coding-agent execution and developer workflows |
| tashfeenahmed/freellmapi | MIT repository license | reference / candidate integration | provider gateway, free-tier aggregation, routing, quotas, fallback, model catalog, compatibility |
| Microsoft AutoGen | MIT code license; repository can contain separately licensed material | reference | multi-agent orchestration |
| OpenHands/OpenHands | MIT for core project; enterprise content requires separate review | reference | coding agents, runtimes, sessions |
| browser-use/browser-use | MIT package metadata | reference | browser automation |
| langchain-ai/langgraph | MIT for LangGraph package | reference | durable graph/workflow orchestration |

## FreeLLMAPI intake record

- Repository: https://github.com/tashfeenahmed/freellmapi
- Pinned commit: b882473c3a23251be312a7270e2e0dc1eae1329d
- License file at intake: MIT
- Reference profile: docs/architecture/REFERENCE-KNOWLEDGE-CORPUS.md
- Primary domain: Provider Gateway + Smart Routing

The source's live catalog and quotas are time-sensitive. They must be refreshed through Source Forge rather than hard-coded into architecture documents.

## License rule

An MIT root repository does not automatically make all code in its dependency tree MIT.

AgentiCOS must preserve required copyright/license notices and must not remove third-party attribution when integrating source code.
