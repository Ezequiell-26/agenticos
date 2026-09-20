# AgentiCOS Universal AI Interoperability

## Objective

AgentiCOS must not be defined by a fixed provider list. It must be able to connect to future AI systems through a stable adapter contract.

The architecture separates five concepts:

1. Model — the logical inference model.
2. Provider — the organization/service exposing models.
3. Account/Credential — the user's authorization against a provider.
4. Endpoint — the concrete network destination and protocol.
5. Proxy/Gateway — an optional intermediary that can transform, route, observe or authorize requests.

This prevents assumptions such as one provider having one endpoint or one API key.

## Provider graph

```text
AgentiCOS
   │
   ↓
Router
   │
   ↓
Provider/Account
   │
   ↓
Endpoint chain
   ├── direct provider
   ├── OpenAI-compatible proxy
   ├── LiteLLM-style gateway
   ├── OpenRouter-style gateway
   ├── enterprise gateway
   └── user-defined proxy
   │
   ↓
Protocol adapter
   │
   ↓
Model service
```

A route may contain multiple hops. Each hop has independent authentication, timeout, retry and observability metadata.

## Protocol adapter layers

### Layer A — OpenAI Chat Completions
Baseline compatibility for providers and proxies exposing the familiar `/chat/completions` shape.

### Layer B — OpenAI Responses
Native support for response items, tools, multimodal content and provider-specific reasoning features.

### Layer C — Anthropic Messages
Native adapter for Messages semantics, content blocks, tool use and streaming.

### Layer D — Google Gemini
Native Gemini adapter plus the documented OpenAI-compatibility endpoint where appropriate.

### Layer E — Generic HTTP/JSON
User-definable request/response mappings for providers that do not match a standard protocol.

### Layer F — Local inference
Adapters for local servers and runtimes such as Ollama, vLLM, llama.cpp and SGLang.

The compatibility layer is a baseline. Native adapters remain available whenever a provider exposes capabilities that cannot be represented safely through a generic protocol.

Google currently documents Gemini access through an OpenAI-compatible endpoint, while vLLM documents an OpenAI-compatible HTTP server. This validates the value of the compatibility layer but also shows why AgentiCOS must not hard-code one API shape. citeturn902940search1turn902940search0

## Generic endpoint descriptor

```text
Endpoint
├── endpointId
├── baseUrl
├── transport
├── protocol
├── auth
├── headers
├── requestTemplate
├── responseMapping
├── streamMapping
├── timeout
├── retryPolicy
├── healthCheck
├── TLS policy
└── proxy chain
```

A custom endpoint can therefore represent APIs that are not OpenAI-compatible.

## Capability negotiation

Model capabilities are explicit and granular:
- text input/output;
- image input/output;
- audio input/output;
- video input/output;
- file input/output;
- tool calling;
- parallel tool calls;
- structured output;
- JSON schema;
- reasoning effort;
- streaming;
- prompt caching;
- embeddings;
- reranking;
- batch inference;
- computer use;
- code execution.

The router may require a capability set rather than a model name.

## Parameter normalization

AgentiCOS defines canonical semantics for common parameters:
- temperature;
- top-p;
- max output tokens;
- stop;
- reasoning effort;
- tool choice;
- structured output;
- modalities;
- metadata.

Adapters translate canonical values to provider-specific fields. Unsupported parameters are rejected or explicitly downgraded according to policy; they are never silently ignored when doing so could change task semantics.

## Streaming normalization

All protocols map into a common stream:

```text
StreamEvent
├── response.started
├── output.text.delta
├── reasoning.delta
├── tool.call.started
├── tool.call.delta
├── tool.call.completed
├── artifact.delta
├── usage.updated
├── response.completed
└── response.failed
```

Raw provider events remain attached as non-canonical metadata for diagnostics.

## Proxy interoperability

A proxy is treated as a first-class Endpoint Hop, not as a special provider.

Therefore AgentiCOS can support:
- provider behind proxy;
- proxy behind proxy;
- local gateway forwarding to cloud provider;
- enterprise gateway;
- load-balancing gateway;
- caching gateway;
- audit gateway.

Each hop has independent health and retry semantics.

## Vendor extensions

Canonical contracts are intentionally small. Vendor-specific features live in extension namespaces.

```text
canonical capability
      +
vendor extension namespace
      ↓
adapter
```

This prevents vendor fields from leaking into the kernel.

## Provider SDK rule

Provider SDKs may be used inside provider adapters. They must never be imported by Agent Runtime, Context, Memory, Workflows or UI packages.

## Future-proofing rule

A new AI provider should require either:
- configuration only, if it matches an existing protocol; or
- one adapter/plugin, if it needs a new protocol.

It must never require modification to the agent loop.