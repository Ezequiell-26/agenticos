# AgentiCOS Domain Map

## Domain ownership

| Domain | Owns | Boundary |
|---|---|---|
| Kernel | lifecycle, IDs, cancellation, events, contracts, plugin lifecycle, policy primitives | zero vendor-specific logic |
| Runtime | task admission, agent loop, planning, continuation, delegation, verification | consumes provider/tool/context contracts |
| Providers | provider adapters, model catalog, credentials metadata, quota, cost, health | never executes tools or owns conversations |
| Router | model/provider selection and fallback policy | never calls vendor SDK directly |
| Tools | tool contracts, discovery, invocation | all external actions pass policy/sandbox |
| Sandbox | processes, filesystem, network, environments, PTY | below tools/runtime |
| Context | context assembly, budgeting, compression, caching, provenance | read-oriented toward other domains |
| Memory | durable knowledge, retrieval, indexing | no external side effects |
| Skills | procedural knowledge, dependencies, progressive loading | no direct persistence mutation |
| Workflows | durable orchestration definitions and runs | uses runtime, not raw model HTTP |
| Agents | specialist policies, roles, subagent templates | child runs are isolated |
| Projects | repository intelligence, project map, instructions | no provider-specific behavior |
| Artifacts | typed outputs, provenance, retention | output storage only |
| Plugins | extension registration/lifecycle | public APIs only |
| Gateway | channel identity, routing, authorization, delivery | no second agent loop |
| Protocol | client/server messages, versioning, streaming events | transport-neutral |
| Observability | metrics, structured logs, traces, run timeline | secret-safe |
| Security | authorization, approval, secret boundaries, policy evaluation | below tool execution |
| Source Forge | source import, license/provenance, component extraction and fusion | cannot silently overwrite first-party code |

## Dependency direction

Kernel <- Contracts <- Runtime/Domains <- Adapters/Plugins <- Applications.

Applications must use the application protocol or SDK. They do not call providers, tools or persistence directly.

## Forbidden dependencies

- Agent core importing a provider SDK.
- UI invoking shell/filesystem directly.
- Provider adapter writing conversation state directly.
- Skill executing a destructive action without the Tool/Security path.
- Child agent mutating parent durable state directly.
- Channel implementing its own planning loop.
- Source Forge overwriting first-party code without an integration record.

## Data ownership rule

Every durable record has exactly one owning domain. Other domains consume it through a contract or projection.

## Side-effect rule

Only Tool and Infrastructure domains may cause external side effects. Runtime decisions are pure until they invoke a tool or approved provider operation.