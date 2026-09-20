# AgentiCOS Fusion Pipeline

## Purpose

The Fusion Engine combines useful implementations from multiple upstream repositories behind one AgentiCOS contract.

## Pipeline

Capability
→ candidate discovery
→ source evidence
→ API and symbol extraction
→ feature comparison
→ dependency comparison
→ test/evaluation comparison
→ security/license gates
→ composition design
→ adapter or port
→ conformance suite
→ integration proposal

## Evidence

A candidate should have evidence for:
- functionality;
- tests;
- benchmarks where available;
- compatibility;
- security;
- license;
- maintenance;
- dependency cost.

## Composition

Multiple projects may contribute to one capability.

Example:

AgentiCOS Memory Contract
→ Hermes memory behavior
→ LlamaIndex retrieval
→ Pydantic validation
→ unified AgentiCOS memory service

The final service is owned by AgentiCOS while the provenance graph retains every upstream contribution.

## Conflict resolution

When implementations overlap, prefer the smallest compatible component that satisfies the AgentiCOS contract, then compose additional capabilities around it.

Do not make a large upstream framework a transitive dependency of the whole product unless that dependency is an explicit architectural decision.

## Generated integration artifacts

Source Forge may generate:
- adapters;
- compatibility shims;
- import maps;
- test scaffolding;
- provenance records;
- dependency notices;
- migration plans.

Generated output still passes the same source, license, security and test gates.