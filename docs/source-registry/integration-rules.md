# Source Integration Rules

## Goal

AgentiCOS can ingest complete upstream repositories and use their code where legally and technically appropriate. The product must remain identifiable as AgentiCOS while preserving required attribution and provenance.

## Required intake

For every source:
1. Pin an exact commit or release.
2. Capture repository license.
3. Scan licenses at package/subdirectory boundaries.
4. Build a dependency/license inventory.
5. Identify generated code and bundled third-party code.
6. Extract architecture and component graphs.
7. Map components to AgentiCOS capability contracts.
8. Run security review.
9. Run compatibility tests.
10. Record the integration decision.

## Integration modes

- `vendor`: preserve the upstream source tree as a versioned component.
- `adapt`: place an adapter around upstream behavior.
- `port`: move selected implementation code into an AgentiCOS-owned package while retaining provenance.
- `compose`: use multiple upstream components behind one AgentiCOS contract.
- `reference`: study behavior/architecture without importing source.
- `exclude`: do not integrate.

## Selection algorithm

For each capability, Source Forge compares candidate implementations using:
- feature completeness;
- correctness/test evidence;
- security posture;
- dependency footprint;
- performance;
- portability;
- API compatibility;
- maintenance activity;
- integration complexity;
- license compatibility;
- ability to keep upstream provenance.

The highest-scoring implementation is not automatically selected. The output is an engineering proposal for review.

## Composition rule

AgentiCOS may combine multiple implementations of one capability. The final canonical interface belongs to AgentiCOS.

Example:

Hermes memory retrieval + LlamaIndex retrieval + Pydantic typed validation can be composed behind the AgentiCOS Memory/Context contracts if compatibility and licensing gates pass.

## Upstream preservation

Imported sources remain available for diffing and regression tests. A source refresh never silently overwrites the AgentiCOS implementation.

## Attribution

Required copyright and license notices must remain in the distribution according to the source license. AgentiCOS must maintain generated third-party notices and a provenance manifest.

## Not an all-MIT assumption

A repository containing an MIT component can also contain other licenses. A non-MIT repository can still be an architectural reference. Source Forge therefore treats license status as evidence attached to a specific source boundary, not a repository-wide guess.

## AI coding rule

When an AI agent proposes incorporating upstream code, it must cite the exact source repository, commit, path/component, license evidence and reason for incorporation before changing a first-party package.