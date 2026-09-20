# AgentiCOS Source Forge Architecture

## Purpose

Source Forge turns external repositories into auditable candidate components for AgentiCOS.

It must support complete repository import because AgentiCOS may study and integrate broad systems such as Hermes Agent and DeepSeek Harness, while keeping the source snapshot separate from first-party code.

## Pipeline

```text
URL
 ↓
Git import
 ↓
commit snapshot
 ↓
license scan
 ↓
dependency scan
 ↓
language/package discovery
 ↓
architecture extraction
 ↓
symbol/component graph
 ↓
capability taxonomy
 ↓
duplicate detection
 ↓
compatibility analysis
 ↓
security review
 ↓
integration proposal
 ↓
adapt/vendor/reference/exclude
 ↓
tests + provenance gates
```

## Source states

```text
imported → audited → analyzed → compared → proposed → integrated
                         └──────────────→ reference
                         └──────────────→ excluded
```

## Component graph

The Forge must understand both files and higher-level components.

A component record should be able to reference:
- source repository;
- exact commit;
- package/module;
- symbols/files;
- dependencies;
- capabilities;
- license evidence;
- security findings;
- test evidence;
- API shape;
- integration decision;
- modifications.

## Fusion algorithm

When multiple repositories implement the same capability, Forge should compare:
- interface compatibility;
- feature completeness;
- dependency weight;
- runtime behavior;
- test coverage;
- security characteristics;
- maintenance state;
- licensing constraints;
- integration complexity.

The output is a proposal, not an automatic overwrite.

## Source preservation

Imported source remains under vendor/sources with immutable source identity. First-party code lives under packages.

An integration record links the first-party implementation to its source material.

## Legal/provenance gate

A repository-level MIT license is not enough to claim that every file and dependency is MIT. Each integrated boundary must have appropriate license evidence and required notices.

The same rule applies when source repositories use Apache-2.0, BSD, or mixed licensing.

## Research targets

Initial target sources:
- Hermes Agent;
- DeepSeek Harness;
- OpenAI Codex;
- other agent runtimes;
- browser/computer-use systems;
- workflow/orchestration libraries;
- memory/retrieval systems;
- sandbox/execution systems.

Codex is currently Apache-2.0, not MIT; it is therefore an architectural/code source candidate with separate license handling.