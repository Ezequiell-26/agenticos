# AgentiCOS Source Registry — Capability Matrix

This is a capability map, not a ranking.

| Capability | Primary sources to analyze |
|---|---|
| Agent core | Hermes, DeepSeek Harness, Pydantic AI, Pydantic AI Harness, DeepAgents |
| Coding agent | Hermes, Pydantic AI Harness, OpenHands, DeepAgents |
| Multi-agent | AutoGen, Hermes, DeepSeek Harness, DeepAgents |
| Planning/orchestration | Pydantic AI, Pydantic AI Harness, LangGraph, DeepAgents |
| Memory/context | Hermes, Pydantic AI Harness, LlamaIndex, LangChain |
| Retrieval/RAG | LlamaIndex, LangChain, DSPy |
| Browser/computer use | Browser Harness, Browser-use Web UI, OpenHands Operator |
| Skills/capabilities | Hermes, Pydantic AI Harness, DeepSeek Harness, DeepAgents |
| Optimization/evaluation | DSPy, Pydantic AI, OpenHands |
| TypeScript agent runtime | VoltAgent, DeepSeek Harness |
| Protocol/interoperability | DeepSeek Harness, AutoGen, VoltAgent |
| Agent UI | Browser-use Web UI, AutoGen Studio |

Source Forge must compare concrete implementations at exact commits rather than automatically choosing a repository as a whole.

## Selection principles

Evidence comes from functionality, tests, security, dependencies, portability, maintenance, license compatibility and integration complexity.

A source may contribute one component even when another source contributes the same capability differently.

The final contract belongs to AgentiCOS.