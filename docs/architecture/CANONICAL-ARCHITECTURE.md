# AgentiCOS — Canonical Architecture

## Mission

AgentiCOS is a Rust-first universal agent runtime. Its Brain coordinates models, knowledge, memory, capabilities, tools, MCP, execution and verification. TypeScript is a product/interface surface, not a second runtime.

## Canonical ownership

- `contracts`: stable types, protocols and ports.
- `brain`: reasoning, planning, capability discovery and source/knowledge/resource orchestration contracts.
- `kernel`: durable lifecycle, events, leases, fencing, snapshots and core invariants.
- `runtime`: application composition and runtime assembly.
- `providers`: concrete model/provider transports.
- `adapters`: replaceable external integration infrastructure.
- `mcp`: canonical MCP boundary.
- `tools`: tool registry, policy and execution boundary.
- `memory`, `context`, `source-forge`: knowledge and source boundaries.
- `cli`, `api-server`, `desktop`: product surfaces.

Exactly one first-party crate owns each domain. Nested copies under `kernel/`, `runtime/`, `adapters/` and `interface/` are forbidden.

## Dependency direction

The dependency graph is a DAG. Stable contracts are lower-level; concrete integrations and product surfaces are higher-level. The canonical kernel does not depend on concrete providers, tools, MCP servers, UI or vendor storage.

The Brain is intentionally isolated from concrete providers/tools/models. It consumes stable contracts and registry data so new capabilities can be added without modifying the canonical reasoning loop merely to register them.

## External MIT/open-source strategy

External repositories are not automatically compiled into the core. After license/provenance admission, a source may be:

1. vendored/integrated when foundational;
2. adapted/pluginized when replaceable;
3. isolated as a process when its runtime or dependencies are incompatible;
4. indexed as knowledge when execution is unnecessary.

Every imported source preserves repository, commit/hash, version, license and evidence.

## Scale and resource model

Large corpora are ingested incrementally, normalized, deduplicated, indexed and retrieved selectively. The Brain must not load an entire repository corpus into RAM or model context. Large outputs use spill storage, caches are bounded and all execution has explicit resource/token budgets and backpressure.

Production registries must prefer paginated/streaming retrieval over unbounded list-all operations.

## Verification

Architecture-affecting changes must pass:

- continuity/state verification;
- TypeScript checks/tests;
- canonical crate-boundary verification;
- formatting;
- workspace compile;
- workspace tests;
- clippy with warnings denied;
- dependency duplicate inspection.

The canonical layout has now been normalized on the architecture branch; implementation completeness remains governed by the active vertical-slice state manifest.

A verified architecture slice does not imply that future capabilities are already implemented.
