# AgentiCOS Source Registry

The Source Registry is the living catalog of agent products and components that AgentiCOS may study, import, adapt or integrate.

It is intentionally split into:

- `code-sources.yml`: a curated subset of high-value repositories eligible for deeper code-reuse review. The complete MIT seed corpus is authoritative in `reference/manifests/mit-repositories.json`.
- `reference-sources.yml`: important architectural/product references whose current license or product model does not permit treating them as MIT source code.
- `integration-rules.md`: the intake/fusion rules.

The registry is not a popularity ranking. It is an engineering intake system.

## Current MIT-oriented code source set

Initial high-value sources identified for deeper analysis:

- NousResearch/hermes-agent — MIT.
- deepseek-ai/deepseek-harness — MIT.
- pydantic/pydantic-ai — MIT.
- pydantic/pydantic-ai-harness — MIT.
- microsoft/autogen — MIT code license, with separate repository content licensing such as CC-BY documentation.
- stanfordnlp/dspy — MIT.
- run-llama/llama_index — MIT for the core package/repository areas reviewed.
- browser-use/browser-harness — MIT.
- browser-use/web-ui — MIT.
- OpenHands/OpenHands — MIT except the Enterprise directory.
- OpenHands/open-operator — MIT.
- VoltAgent/voltagent — MIT.

These are not blanket approvals for every transitive dependency, generated artifact or subdirectory. Source Forge must audit the exact commit and dependency closure before integration.

## Important non-MIT references

- openai/codex — Apache-2.0, not MIT.
- ag2ai/ag2 — Apache-2.0, not MIT.
- agno-agi/agno — Apache-2.0, not MIT.
- Google Antigravity — product/architecture reference, not an open-source MIT repository.

These sources can still inform architecture. They are not silently copied into an MIT-derived first-party component.

## Selection rule

AgentiCOS does not attempt to merge everything indiscriminately. It seeks the strongest implementation for each capability and tracks why that implementation was selected.

Capabilities include:
- agent loop;
- coding;
- planning;
- multi-agent orchestration;
- memory;
- retrieval/RAG;
- skills/capabilities;
- browser/computer use;
- sandbox/execution;
- model/provider abstraction;
- workflow/durable execution;
- protocol/app-server;
- observability/evaluation;
- UI/workspace;
- plugin architecture.