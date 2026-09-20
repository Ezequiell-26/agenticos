# Provider Engine

## Objective

AgentiCOS must be able to use multiple AI APIs from one runtime. A user may configure several free-tier and paid providers and switch between them without changing the agent implementation.

## Provider families

The initial implementation uses an OpenAI-shaped chat contract where the provider supports it.

Current verified examples:

- OpenRouter exposes an OpenAI-compatible endpoint at `https://openrouter.ai/api/v1` and currently lists a Free plan with free models. OpenRouter also supports paid models/providers from the same API. 
- Groq exposes an OpenAI-compatible API at `https://api.groq.com/openai/v1` and currently has both a Free tier and a paid Developer tier.
- Google documents an OpenAI compatibility endpoint at `https://generativelanguage.googleapis.com/v1beta/openai/`; selected Gemini models have free-tier access and paid usage is also available.
- DeepSeek exposes an OpenAI-compatible API at `https://api.deepseek.com` and currently supports Chat Completions plus its Responses API. Its current API pricing is usage based.
- OpenAI uses its native OpenAI API. The adapter boundary is intentionally generic so it can remain compatible with OpenAI-shaped requests where appropriate.

## Free does not mean unlimited

AgentiCOS treats `free` and `free-tier` as routing metadata, not as unlimited capacity.

The runtime must recognize:

- HTTP 429;
- quota exhaustion;
- credit/balance exhaustion;
- transient 5xx failures;
- connection errors;
- timeouts.

A failed provider can then be skipped by the fallback executor.

## Credentials

Provider definitions contain environment-variable names, not secrets.

The future credential manager will support:

- multiple keys per provider;
- encrypted storage;
- per-key health;
- per-key quota tracking;
- key rotation;
- key cooldowns.

## Runtime state

Every configured provider gets a runtime snapshot:

```
health
requests
failures
rate limits
quota exhaustions
consecutive failures
last error
last request
```

This state will later feed the intelligent router.

## Routing policy

The first router should support at least:

```
free-first
balanced
quality-first
speed-first
local-only
manual
```

A request should be evaluated against a model capability set before a provider is selected.

Example:

```
coding + tool-calling
       |
       v
candidate models
       |
       +--> free-tier provider
       +--> paid provider
       +--> local provider
       |
       v
health/quota/cost score
       |
       v
selected model
       |
       v
fallback chain if needed
```

## Roadmap

1. streaming normalization;
2. native Responses adapter;
3. model capability discovery;
4. per-key credential pools;
5. rate-limit header parsing;
6. quota/budget tracking;
7. cost estimation;
8. health-aware routing;
9. persistent usage history;
10. provider-specific feature adapters;
11. web UI for providers, models, quotas and routing policies.
