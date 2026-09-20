# AgentiCOS Full Repository Import Strategy

## Objective

AgentiCOS must be able to import complete upstream repositories because important behavior is often distributed across packages, tests, examples, tooling and runtime layers.

Full import does not mean automatic full merge.

## Source lifecycle

upstream repository
→ immutable source snapshot
→ license/dependency audit
→ package/module graph
→ architecture extraction
→ capability graph
→ test/evaluation discovery
→ component extraction
→ AgentiCOS contract mapping
→ integration branch/adapter
→ conformance tests
→ AgentiCOS-owned implementation

## Why keep the full snapshot

Keeping the source lets Source Forge inspect dependencies, upstream tests, examples, documentation, generated code, bundled code and future changes.

## Large repositories

Source Forge must support:
- shallow clone for discovery;
- full clone for integration;
- sparse checkout for targeted packages;
- exact commit pinning;
- incremental indexing;
- content-addressed caches;
- parallel analysis workers.

## Promotion

Only components that satisfy an AgentiCOS contract and pass provenance, license, security, compatibility and test gates are promoted to production packages.

## Non-destructive fusion

Fusion generates a proposal, patch or isolated integration branch. It never silently overwrites first-party code.

## Reproducibility

Every promoted component records exact source commit, repository URL, source path, transformation steps, dependency evidence and tests.