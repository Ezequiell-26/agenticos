# AgentiCOS Proxy and Gateway Architecture

## Goal

Support direct providers and arbitrary user-controlled proxies without changing agent semantics.

## Proxy as a pipeline

```text
Agent Request
   ↓
Route Resolver
   ↓
Hop 1: local/enterprise gateway
   ↓
Hop 2: model router/proxy
   ↓
Hop 3: provider endpoint
   ↓
Model
```

## Proxy hop contract

Each hop declares:
- protocol;
- URL;
- authentication;
- headers;
- request transformation;
- response transformation;
- streaming transformation;
- health check;
- timeout;
- retry;
- circuit breaker;
- observability.

## Interceptors

The route pipeline may have interceptors:
- auth;
- logging;
- redaction;
- cost accounting;
- rate limiting;
- caching;
- retries;
- safety validation;
- response normalization.

Interceptors must be ordered and deterministic.

## Circuit breaker

A failing hop can enter:
```text
closed → open → half-open → closed
```

The circuit is scoped to an endpoint/account/model combination where appropriate.

## Proxy health

A healthy provider behind a broken proxy is not considered healthy for that route. Health is measured per route and can also be aggregated by provider.

## Generic proxy import

A user can configure a proxy with:

```yaml
id: my-gateway
protocol: openai-chat-completions
base_url: https://gateway.example/v1
auth:
  type: bearer
  secret_ref: my-key
```

Advanced endpoints can define request/response mappings without changing core code.

## Gateway deployment mode

AgentiCOS may itself expose a gateway API so other applications can use its routing layer.

```text
Client
  ↓ OpenAI-compatible request
AgentiCOS Gateway
  ↓ internal routing
provider/model
```

This enables AgentiCOS to function as an AI gateway as well as an agent runtime.