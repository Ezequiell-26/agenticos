# AgentiCOS Architecture Completeness Matrix

This matrix is the pre-implementation checklist.

| Area | Required capability | Architecture owner | Status |
|---|---|---|---|
| Kernel | lifecycle/DI/events/cancellation | Kernel | defined |
| Contracts | versioned domain interfaces | Contracts | defined |
| AI | provider/model/endpoint/account split | Providers | defined |
| AI | OpenAI Chat compatibility | Provider adapters | defined |
| AI | OpenAI Responses | Provider adapters | planned |
| AI | Anthropic Messages | Provider adapters | planned |
| AI | Gemini native | Provider adapters | planned |
| AI | local inference | Provider adapters | defined |
| AI | generic HTTP mapping | Provider adapters | defined |
| AI | streaming normalization | Provider adapters | planned |
| AI | multimodal | Model domain | defined |
| AI | embeddings/reranking | Model domain | defined |
| AI | image/audio/video | Model domain | defined |
| AI | realtime sessions | Model domain | defined |
| Routing | free-only/free-first | Router | defined |
| Routing | paid/budget policies | Router/Cost | defined |
| Routing | health/circuit breakers | Router | defined |
| Routing | quota/rate limits | Router/Quota | defined |
| Routing | credential pools | Credentials | defined |
| Routing | proxy chains | Endpoint/Gateway | defined |
| Agents | task/run/thread/turn/step/item | Runtime | defined |
| Agents | planning/act loop | Runtime | defined |
| Agents | continuation/steering/cancellation | Runtime | defined |
| Agents | verification/repair | Runtime | defined |
| Agents | durable background execution | Runtime/Scheduler | defined |
| Agents | subagents/parallelism | Multi-agent | defined |
| Agents | remote agents/A2A | Agent Interop | defined |
| Tools | native tool registry | Tools | defined |
| Tools | MCP client/server | MCP | defined |
| Tools | browser/computer use | Tools/Sandbox | defined |
| Tools | terminal/filesystem/git | Tools/Sandbox | defined |
| Execution | local sandbox | Sandbox | defined |
| Execution | remote worker | Sandbox/Scheduler | defined |
| Execution | resource leases | Scheduler | defined |
| Knowledge | context compiler | Context | defined |
| Knowledge | context budgets/caching | Context | defined |
| Knowledge | project memory | Memory | defined |
| Knowledge | user/session memory | Memory | defined |
| Knowledge | retrieval/reranking | Memory | defined |
| Knowledge | skills | Skills | defined |
| Automation | workflows | Workflows | defined |
| Automation | schedules/triggers/retries | Scheduler | defined |
| Output | first-class artifacts | Artifacts | defined |
| Security | approvals | Security | defined |
| Security | sandbox policy | Security/Sandbox | defined |
| Security | secret isolation | Security/Credentials | defined |
| Security | prompt injection boundaries | Security/Context | defined |
| Security | plugin trust | Plugins | defined |
| Security | remote-agent trust | A2A/Security | defined |
| Observability | structured events | Observability | defined |
| Observability | metrics/traces | Observability | defined |
| Observability | cost/usage | Cost/Observability | defined |
| Evaluation | replay/golden tasks | Evaluation | defined |
| Interop | application protocol | Protocol | defined |
| Interop | plugin protocol | Plugin SDK | defined |
| Interop | engine protocol | Engine adapters | defined |
| Interop | A2A | Agent Interop | defined |
| Interop | MCP | Tool/Context Interop | defined |
| Source | complete repo import | Source Forge | implemented prototype |
| Source | license/provenance | Source Forge | implemented prototype |
| Source | component comparison | Source Forge | defined |
| Source | automated fusion | Source Forge | planned |
| Distribution | CLI/TUI/Web/Desktop/IDE | Applications | defined |
| Distribution | SDK/API/Gateway | Applications | defined |
| Distribution | signed update/rollback | Distribution | defined |

## Critical gaps before production implementation

The architecture is complete at the conceptual level, but the following implementations must exist before calling the platform production-ready:

1. Kernel and contract runtime.
2. Full protocol adapter registry.
3. Streaming and multimodal normalized event model.
4. Capability-aware router with quotas, budgets and credential pools.
5. Tool + security + sandbox execution path.
6. Durable run persistence and recovery.
7. Context/memory/skills runtime.
8. Multi-agent scheduler and A2A bridge.
9. Application protocol and one reference client.
10. Replay/evaluation harness.
11. Source Forge fusion pipeline and provenance gates.

## Non-goals for the kernel

The kernel must never directly implement:
- a specific provider SDK;
- a specific database driver;
- a specific UI;
- a specific browser;
- a specific messaging platform;
- a specific vector database;
- a specific agent framework.

Those are adapters, plugins or domain implementations.