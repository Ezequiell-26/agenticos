---
name: agenticos-ai-ui
description: AI-native UI rules for agent chat, tools, runs and streaming
---

# AgentiCOS AI UI Skill

An agent UI is a lifecycle surface, not only a chat transcript.

Represent explicitly:

- messages;
- streaming;
- tool calls/results;
- approvals;
- run status;
- retries/cancellation;
- errors/recovery;
- artifacts;
- provenance/citations;
- token/cost/latency metadata when available.

Persist durable generation/run identity in the runtime. Do not depend on React-only state for recoverability.

Use AI Elements or equivalent primitives where appropriate, but keep the canonical runtime in Rust.
