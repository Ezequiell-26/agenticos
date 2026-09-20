# ADR 0005 — Source Fusion, Not Source Overwrite

Status: Accepted

## Decision

Imported repositories remain immutable source snapshots. Fusion produces explicit integration records and changes under AgentiCOS-owned packages.

Source Forge never silently copies files over AgentiCOS code.

## Rationale

The product needs to combine functionality from many agent repositories while preserving exact provenance, allowing upstream refreshes and avoiding accidental loss of local improvements.

## Integration record

Each adopted component records:
- source repository;
- exact commit;
- source path/package;
- license evidence;
- dependency review;
- security review;
- adaptation summary;
- destination package;
- tests;
- maintainer notes.

## Consequence

AgentiCOS can legitimately evolve into its own product while retaining a reproducible relationship with the code it adopted.