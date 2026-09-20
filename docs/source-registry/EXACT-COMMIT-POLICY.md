# AgentiCOS Exact Commit and License Policy

## Source pinning

Every integrated third-party component is pinned to an exact upstream commit or immutable release.

Branches and moving tags are discovery references, not sufficient provenance for an integration.

## License evidence

Record:
- repository URL;
- exact commit;
- license file path;
- package or subdirectory license when different;
- copyright holder;
- third-party notices;
- dependency license closure.

## Current verified source examples

The current registry includes MIT sources such as Hermes Agent, DeepSeek Harness, Pydantic AI, Pydantic AI Harness, DSPy, LlamaIndex core, LangChain, Browser Harness, Browser-use Web UI and VoltAgent. OpenHands is MIT except its Enterprise directory. AutoGen uses MIT for code but has separately licensed repository content such as documentation. The exact commit and dependency tree still require audit before integration. 

Codex is Apache-2.0, AG2 is Apache-2.0 and Agno is Apache-2.0. They can remain architectural or separate-license source references, but they are not treated as MIT code. Google Antigravity is a product reference rather than an open-source repository.

## Enforcement

No component may move from vendor/sources into first-party packages without a complete provenance record.

No license conclusion may be inferred only from a README badge, repository popularity or dependency name.