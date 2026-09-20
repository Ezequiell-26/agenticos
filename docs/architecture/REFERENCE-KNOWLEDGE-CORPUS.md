# AgentiCOS Reference Knowledge Corpus

## Purpose

AgentiCOS uses approved open-source repositories as an implementation reference corpus.

The goal is to prevent unnecessary reinvention during iterative development:

User requirement
  ↓
Capability classification
  ↓
Reference corpus lookup
  ↓
Relevant source/docs/tests extracted
  ↓
Architecture contract
  ↓
Implementation
  ↓
Verification

An AI coding agent working on AgentiCOS must consult this corpus before designing a subsystem that already has a relevant reference implementation.

The agent should prefer reading and adapting proven patterns over inventing a new mechanism without evidence.

## Mandatory reference-first policy

For every non-trivial feature:

1. Identify the capability/domain.
2. Search the reference corpus for relevant repositories, documentation, tests and implementation files.
3. Record which references were consulted.
4. Extract applicable behavior, interfaces, failure handling and test patterns.
5. Map those findings to AgentiCOS contracts.
6. Implement only the necessary AgentiCOS-owned code.
7. Preserve source provenance and license obligations.
8. Verify that the result satisfies both the AgentiCOS contract and the feature requirements.

### No-reinvention rule

The implementation agent must not create a new abstraction merely because it is easier to write.

Before adding a new subsystem, it must determine whether AgentiCOS already has a contract, whether the corpus has an implementation or documented pattern, whether an existing adapter/domain can be extended, what behavior and failure semantics the reference demonstrates, and what license/provenance constraints apply.

If no suitable reference exists, or the reference conflicts with AgentiCOS requirements, the agent may design a new solution and must document the reason in an ADR or architecture note.

## Current high-value references

| Repository | Role | Primary domains |
|---|---|---|
| NousResearch/hermes-agent | agent runtime/product reference | agent loop, tools, skills, memory, providers, channels, scheduling |
| deepseek-ai/deepseek-harness | agent composition reference | provider composition, profiles, sessions, plugins, events |
| openai/codex | coding/runtime reference | Rust architecture, execution, sandboxing, developer workflows |
| tashfeenahmed/freellmapi | LLM gateway/router reference | provider aggregation, free-tier routing, fallback, quotas, model catalog, compatibility, key handling |
| Microsoft AutoGen | multi-agent reference | delegation and orchestration |
| OpenHands/OpenHands | coding-agent reference | software engineering workflows and agent execution |
| browser-use/browser-use | browser-agent reference | browser automation and computer-use boundaries |
| langchain-ai/langgraph | workflow reference | durable graphs, checkpoints and orchestration |

## FreeLLMAPI reference profile

Source: https://github.com/tashfeenahmed/freellmapi

Pinned reference commit at architecture intake: b882473c3a23251be312a7270e2e0dc1eae1329d

License at intake: MIT repository license. This does not imply every dependency is MIT; dependency-level notices remain authoritative.

AgentiCOS should study FreeLLMAPI especially for:

- unified OpenAI-compatible gateway design;
- provider adapter boundaries;
- free-tier/provider aggregation;
- model catalogs;
- capability-aware model selection;
- fallback chains;
- quota and rate-limit ledgers;
- key rotation and provider health;
- cooldown behavior after upstream failures;
- streaming normalization;
- compatibility across OpenAI, Anthropic, Gemini and Ollama-style client surfaces;
- custom OpenAI-compatible endpoints;
- tool-call compatibility/rescue;
- encrypted credential storage;
- MCP exposure;
- sticky sessions/context handoff;
- optional prompt compression;
- self-updating model catalogs;
- operational diagnostics and analytics.

These are reference patterns, not an instruction to copy the FreeLLMAPI architecture wholesale.

## Source evidence model

Source Forge should produce durable evidence records for consulted material:

Reference
 ├── repository
 ├── exact commit
 ├── path
 ├── symbol/component
 ├── capability
 ├── behavior
 ├── tests
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

Source Forge should periodically inspect configured upstreams, detect new commits, re-audit licenses/dependencies, regenerate capability/evidence records and flag architectural changes that could materially improve AgentiCOS.

A moving upstream must never silently change an AgentiCOS implementation. Updates become candidate references and pass normal architecture, provenance and verification gates first.
