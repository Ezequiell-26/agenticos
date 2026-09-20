# AgentiCOS Provider Architecture

## Goal

One model-neutral agent runtime must support many free-tier, paid, local and custom providers.

## Provider stack

```text
Agent Runtime
    ↓
Capability Request
    ↓
Model Router
    ↓
Candidate Models
    ↓
Policy / Health / Quota / Cost
    ↓
Provider Adapter
    ↓
Provider API
```

## Integration levels

1. OpenAI-compatible adapter.
2. Native provider adapter.
3. Local inference adapter.
4. Custom protocol plugin.

## Provider contract

Every provider declares:
- provider identity;
- supported protocols;
- model catalog source;
- capabilities;
- credentials mechanism;
- health check;
- streaming support;
- tool calling support;
- structured output support;
- pricing metadata when available;
- quota metadata when available.

## Credential architecture

Credentials are separate from normal configuration.

```text
Provider
  └── Credential Pool
        ├── key/account A
        ├── key/account B
        └── key/account C
```

Credential selection is performed by the provider layer. Secrets never enter prompts or logs.

## Router policies

Supported policies:
- manual;
- free-only;
- free-first;
- balanced;
- speed-first;
- quality-first;
- local-first;
- paid-only;
- budget constrained.

## Candidate scoring

A candidate is scored using capability fit, provider health, quota availability, latency, estimated cost, user preference and policy constraints.

A provider is excluded when credentials are invalid, quota is exhausted, capability requirements are unmet or policy forbids it.

## Fallback

Fallback is capability-aware. A failure must not blindly retry a different model that cannot perform the task.

Example:

```text
coding + tool calling
        ↓
free candidates
        ↓ none
paid candidates
        ↓
best healthy candidate
        ↓ failure
next compatible candidate
```

## Quota and cost

Usage is normalized into a common structure. Provider-specific headers and response fields are preserved as raw metadata for later reconciliation.

Budgets can apply per run, day, month, provider or credential.