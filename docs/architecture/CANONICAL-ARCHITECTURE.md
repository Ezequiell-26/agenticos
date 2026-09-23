# AgentiCOS — Canonical Architecture

AgentiCOS is a Rust-first universal agent runtime whose Brain coordinates model intelligence, planning, knowledge, memory, capabilities, tools, MCP, execution and verification. TypeScript remains a product/interface surface.

## Canonical repository layers

`crates/domain` owns contracts and Brain abstractions.
`crates/application` owns agent/application orchestration.
`crates/infrastructure` owns runtime, kernel, providers, tools, MCP, storage and integrations.
`crates/presentation` owns CLI, desktop, API and gateway surfaces.
`crates/utilities` owns reusable cross-cutting infrastructure.

Every first-party crate has exactly one canonical owner and one workspace manifest. Nested duplicate crate trees are prohibited.

## Brain architecture

The Brain must remain independent from concrete providers, tools, MCP servers and specific repositories. It discovers capabilities through contracts and registries rather than importing every external implementation.

External MIT/open-source projects enter through four controlled modes: vendored foundational code, replaceable adapters/plugins, isolated processes, or indexed knowledge sources. Provenance, license, version/commit and evidence are mandatory for canonical incorporation.

## Scale model

Large source corpora are ingested incrementally, normalized, deduplicated, indexed and retrieved selectively. The Brain never loads an entire repository corpus into RAM or model context. Caches are bounded and work is governed by CPU, RAM, disk, network, concurrency and token budgets.

## Dependency model

The dependency graph is a DAG. Shared third-party versions are inherited from the root workspace. Critical duplicate versions are CI-gated. New capabilities must not require changes to unrelated layers.

## Verification model

Architecture changes require continuity/state checks, TypeScript checks/tests, canonical workspace validation, rustfmt, workspace compile/test, clippy with warnings denied and dependency-tree inspection.

A green architecture gate means the structure is coherent and verifiable; it does not claim that every Brain capability is implemented.
