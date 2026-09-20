# AgentiCOS

AgentiCOS is being designed as a universal, model-agnostic agent runtime and application platform.

## Architecture-first

Before broad implementation, the repository freezes the complete product architecture:

- one runtime for CLI, TUI, Web, Desktop, IDE, API, SDK and messaging;
- multi-provider AI access for free-tier, paid, local and custom APIs;
- typed task/run/thread/turn/step/item execution;
- pluggable tools, sandboxes, memory, skills, workflows and agents;
- asynchronous and parallel child agents;
- first-class artifacts and verification;
- durable sessions, persistence, replay and recovery;
- capability-based security and explicit approvals;
- plugin and engine adapter architecture;
- Source Forge for importing and fusing external agent repositories.

## Reference architecture

The design studies current public architectures from:

- Hermes Agent;
- DeepSeek Harness;
- OpenAI Codex;
- Google Antigravity.

These are used as architectural references. AgentiCOS defines its own contracts instead of treating any one project as the product core.

## Source Forge

Source Forge can import complete repositories, preserve their source snapshots and commits, audit licenses and dependencies, extract capabilities, compare implementations and prepare integration proposals.

The target is to combine useful implementations from multiple projects while retaining provenance and keeping AgentiCOS-owned code behind stable contracts.

## Current status

Provider Engine and Source Forge prototypes exist. The repository is now in an architecture-first stage; production feature implementation should follow the architecture documents before expanding the prototypes.

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first.

Then read [docs/architecture/README.md](./docs/architecture/README.md).

## References

- Hermes Agent: https://github.com/NousResearch/hermes-agent
- DeepSeek Harness: https://github.com/deepseek-ai/deepseek-harness
- OpenAI Codex: https://github.com/openai/codex
- Google Antigravity: https://antigravity.google/docs/ide/overview
