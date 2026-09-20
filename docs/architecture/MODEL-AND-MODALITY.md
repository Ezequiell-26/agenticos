# AgentiCOS Model and Modality Architecture

## Model is a capability provider, not just a chat endpoint

The canonical Model contract must support multiple task families.

```text
Model
├── generation
├── reasoning
├── tool calling
├── structured output
├── embeddings
├── reranking
├── image generation
├── audio generation
├── speech recognition
├── video generation
├── vision
└── computer interaction
```

A provider may expose one or several of these capabilities.

## Task-family contracts

Text generation, embeddings, reranking, image, audio, video and realtime interaction must have separate contracts even when one provider exposes them from one SDK.

The router selects a task contract first and then an implementation.

## Multimodal input

Canonical content parts include:
- text;
- image reference or bytes;
- audio reference or bytes;
- video reference or bytes;
- file reference;
- structured data;
- tool result.

Adapters translate these parts into provider-specific formats.

## Streaming

Every streaming task uses a normalized event vocabulary with sequence numbers and resumable correlation.

## Structured output

Structured output is represented as a schema contract rather than a provider-specific JSON flag.

The adapter may use native schema support or a validated fallback strategy. When native strictness is unavailable, AgentiCOS must mark the result as non-strict rather than claiming schema guarantees.

## Prompt caching

Caching is an optimization owned by the provider/runtime boundary.

The Context Engine identifies cacheable prefixes while the adapter determines whether the selected endpoint supports them.

## Batch and asynchronous inference

Batch requests are first-class asynchronous tasks. They share the same Task/Run lifecycle as interactive generation.

## Realtime

Realtime voice/multimodal sessions are long-lived resources managed by a session adapter. They must still emit normalized events and enforce the same policy/credential boundaries.

## Capability honesty

A model capability is either:
- verified by provider metadata/contract tests;
- configured manually with explicit trust;
- inferred with low-confidence metadata.

The router should prefer verified capability evidence.