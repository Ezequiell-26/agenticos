# AgentiCOS — Canonical Architecture

AgentiCOS is a Rust-first universal agent runtime. Its Brain coordinates model intelligence, planning, memory, knowledge, capabilities, tools, MCP, execution and verification. TypeScript remains a product/interface surface.

## Canonical ownership

- `domain`: stable contracts and Brain abstractions.
- `application`: agent/application orchestration.
- `infrastructure`: kernel, runtime, providers, tools, MCP, memory, source ingestion and adapters.
- `presentation`: CLI, API server, desktop and gateway.
- `utilities`: reusable cross-cutting infrastructure.

Every first-party crate has exactly one canonical owner and one workspace manifest. Duplicate top-level and nested crate trees are prohibited.

## Brain and external capability model

The Brain must not depend structurally on a concrete model, provider, tool, MCP server or repository. Capabilities are discovered through stable contracts and registries.

External MIT/open-source projects are controlled sources, not automatic kernel dependencies. After provenance/license admission, a source may be:
1. vendored as foundational code;
2. wrapped by an adapter/plugin;
3. isolated as a process;
4. indexed as knowledge.

Every admitted source records repository, version/commit, hash, license and evidence.

## Scale and performance

Massive repositories and knowledge corpora are ingested incrementally, normalized, deduplicated, indexed and retrieved selectively. The Brain must not load the full corpus into RAM or model context.

Resource budgets are explicit for CPU, RAM, disk, network, concurrency and tokens. Large outputs use spill storage; caches are bounded; backpressure is required; production registries prefer pagination/streaming over unbounded list-all operations.

## Dependency and verification policy

Shared third-party versions are inherited from the workspace. Critical duplicate versions are CI-gated. CI also verifies crate ownership and the layer DAG.

The architecture is a structural foundation, not a claim that every future Brain feature is already implemented.
