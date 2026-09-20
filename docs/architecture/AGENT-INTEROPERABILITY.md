# AgentiCOS Agent Interoperability

## Agent-to-agent architecture

MCP and A2A solve different problems and must not be conflated.

MCP is the tool/context integration plane: agents connect to tools, resources, prompts and external capabilities.

A2A is the horizontal agent collaboration plane: independent agents discover capabilities, exchange messages and manage long-running tasks without exposing internal tools or memory.

The current A2A specification defines Agent Cards, stateful Tasks, Messages, Parts, Artifacts and multiple HTTP transports; current released A2A is 1.0.

The current MCP specification direction emphasizes a stateless core, extensions, Tasks and hardened authorization; MCP remains the internal capability integration layer.

## Two-plane architecture

```text
                    AGENTICOS
                       │
          ┌────────────┴────────────┐
          │                         │
     VERTICAL PLANE            HORIZONTAL PLANE
          │                         │
         MCP                       A2A
          │                         │
    tools/resources             remote agents
    prompts/apps                tasks/messages
          │                         │
          └────────────┬────────────┘
                       │
                  Agent Runtime
```

## Remote agent discovery

AgentiCOS should support A2A Agent Cards and treat remote agents as capability endpoints.

Remote agent metadata can describe:
- skills;
- modalities;
- endpoint;
- authentication;
- streaming;
- task behavior;
- extensions.

## Agent delegation contract

A parent agent delegates a typed objective:

```text
DelegateRequest
├── task
├── requiredCapabilities
├── inputArtifacts
├── contextBudget
├── permissionProfile
├── timeBudget
├── costBudget
└── completionPolicy
```

The child returns:
- status;
- result;
- artifacts;
- citations/references where applicable;
- usage;
- failure reason.

The child does not gain implicit access to the parent's memory, secrets or filesystem.

## Local versus remote subagents

The same contract applies to:
- in-process child agents;
- worker processes;
- containerized agents;
- remote AgentiCOS agents;
- third-party A2A agents.

This lets the orchestrator replace the implementation without changing the task semantics.

## Collaboration modes

- sequential delegation;
- parallel fan-out/fan-in;
- auction/race;
- reviewer/critic;
- planner/executor;
- specialist pipeline;
- long-running remote task.

## Conflict handling

Parallel agents must not share mutable canonical state directly. They exchange typed artifacts/results or use a coordinator-managed workspace with locks/leases.