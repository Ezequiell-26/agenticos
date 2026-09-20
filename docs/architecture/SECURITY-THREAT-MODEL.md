# AgentiCOS Security Threat Model

## Threat classes

AgentiCOS is exposed to threats beyond ordinary application security because model output is untrusted input.

Primary classes:
- prompt injection;
- indirect prompt injection from retrieved content/web pages;
- malicious tool arguments;
- malicious skills/plugins;
- compromised provider/proxy;
- secret exfiltration;
- path traversal;
- sandbox escape;
- dependency compromise;
- poisoned source repositories;
- runaway agent loops;
- cross-project data access;
- unauthorized autonomous actions.

## Trust zones

```text
TRUSTED
Kernel / policy / credential vault
        ↓
CONTROLLED
Runtime / context / router
        ↓
UNTRUSTED
Model output / external content / remote agents
        ↓
CONTROLLED ACTION
Tool + sandbox + approval
```

Model output is never treated as a policy decision.

## Prompt injection

Retrieved text, web pages, repository files and tool output can contain instructions hostile to the agent.

The Context Engine must label external content by provenance and the runtime must distinguish:
- authority-bearing instructions;
- user content;
- external data;
- tool observations.

External data cannot override higher-trust instructions.

## Secret exfiltration

Credential values are isolated. Tool inputs should receive opaque secret references or scoped secret handles rather than raw secrets whenever possible.

Outbound network policy should be able to block requests containing protected data according to policy.

## Plugin risk

Plugins are untrusted until authorized. High-risk plugins should run out-of-process or sandboxed.

## Remote-agent risk

A2A remote agents are separate trust domains. Their claims, artifacts and instructions are untrusted input.

Remote agents receive only scoped task context and declared capabilities.

## Source Forge risk

Imported source can be malicious even when its repository has a permissive license. Source Forge therefore treats imported code as untrusted during build and analysis.

Build scripts from imported repositories must not execute automatically in the host environment.

## Runaway execution

Every run has limits:
- maximum duration;
- maximum steps;
- maximum child depth;
- maximum child count;
- maximum tool calls;
- maximum cost/tokens;
- maximum resource usage.

## Security posture

The secure default is least privilege. Autonomy is a product setting, not an implicit privilege escalation.