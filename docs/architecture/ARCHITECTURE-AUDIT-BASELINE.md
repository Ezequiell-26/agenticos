# Architecture Audit — Pre-Implementation Baseline

## Audit purpose

Review the architecture before the first functional Rust slice and eliminate structural inconsistencies that could cause false readiness, provenance drift, regressions or ambiguous ownership.

## Scope reviewed

- repository layout and workspace boundaries;
- Rust workspace and crate ownership;
- contracts and versioned schemas;
- readiness and architecture guards;
- implementation-step state machine;
- reference/MIT corpus and resolver;
- continuity memory and operation journal;
- Change Plane;
- persistence/recovery architecture;
- provider/API boundary;
- security/threat model;
- source registry;
- CI configuration;
- dependency direction;
- documentation consistency.

## Findings fixed

### 1. Readiness corpus validation bug

The readiness implementation was passing the architecture-completeness manifest into the MIT-corpus validator. It now loads and validates the actual MIT corpus separately.

### 2. Continuity path portability

The continuity verifier now uses `pathToFileURL` instead of constructing file URLs manually, making path handling portable across operating systems.

### 3. Untracked-file policy mismatch

The continuity manifest declared that untracked files are prohibited, while the verifier previously emitted only a warning. The verifier now fails when untracked files exist.

### 4. Canonical project license

The Rust workspace declared MIT while the repository had no root `LICENSE`. A root MIT license has been added.

### 5. Cargo reproducibility baseline

The repository architecture documented `Cargo.lock` but the file was absent. A workspace lockfile has been added for the current dependency graph.

### 6. MIT corpus integrity

The MIT reference catalog was reconciled and expanded. It now contains the verified MIT-focused seed corpus and mandatory core references. Entries with mixed/restricted licensing are explicitly labeled.

FastAPI and FreeLLMAPI are recorded as MIT with their current official GitHub evidence; Source Forge still requires an exact source artifact at the pinned commit before source integration.

### 7. Source-registry ambiguity

The secondary source registry is now explicitly treated as a curated high-value subset, while the machine-readable MIT manifest remains authoritative for the complete MIT-focused seed corpus.

### 8. Dependency-direction ambiguity

The dependency graph was rewritten to define one canonical arrow direction: applications/surfaces depend on application protocol/runtime/domain contracts/kernel. Vendor implementations do not become kernel dependencies.

### 9. Embedded citation artifacts

Assistant-internal citation markers that had entered architecture documents were removed. Repository documentation now contains ordinary source references rather than tool-specific citation syntax.

### 10. State consistency

The readiness gate now compares `PROJECT-STATE.md` with `implementation-state.json` and rejects disagreement.

### 11. Foundation gate hardening

The readiness gate now requires the root license, Cargo.lock, continuity artifacts, reference resolver, MIT corpus integrity, runtime seam schemas and contract coverage.

## Current architectural conclusion

The architecture has explicit boundaries for the planned universal runtime and no unresolved structural contradiction was found during this audit.

This is **architecture readiness**, not functional readiness.

## Verification not yet available

The following checks remain unverified because the current execution environment does not contain Rust/Cargo and cannot access the public Git repository over the network:

- `cargo fmt --all -- --check`;
- `cargo check --workspace --all-targets`;
- `cargo test --workspace --all-targets`;
- `cargo clippy --workspace --all-targets -- -D warnings`;
- final remote GitHub Actions result for the latest commit.

These must remain marked `UNVERIFIED` until actual evidence exists.

## Implementation lock

Do not unlock `rust-kernel-vertical-slice-1` until the architecture-foundation verification evidence is complete.

## Next authorized step

Run the architecture-foundation verification suite, record exact results in the continuity journal, correct any failure, rerun failed checks and only then unlock the Rust kernel slice.
