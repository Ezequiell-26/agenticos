# AgentiCOS Source Forge

Source Forge is the repository-ingestion layer for AgentiCOS.

Its job is not simply to copy code. It creates a controlled pipeline for bringing large agent repositories into the project, understanding them, comparing them and selectively integrating useful components.

## Target workflow

```
Git repository
     |
     v
IMPORT
     |
     v
vendor/sources/<repo>
     |
     v
LICENSE AUDIT
     |
     v
REPOSITORY SCAN
     |
     v
COMPONENT INVENTORY
     |
     v
COMPARE / SCORE
     |
     v
INTEGRATION PLAN
     |
     v
ADAPT
     |
     v
AgentiCOS packages/
     |
     v
TEST + SECURITY
```

## Why repositories remain under vendor/sources

The upstream source is preserved separately from AgentiCOS first-party code.

This gives us:

- reproducible provenance;
- easy comparison against upstream;
- a clear boundary between third-party and first-party code;
- a place to inspect licenses and dependencies;
- the ability to update an upstream snapshot without silently overwriting AgentiCOS code.

The first imported sources should include the full Hermes Agent repository and the full DeepSeek Harness repository.

## Import

From a checked-out AgentiCOS repository:

```bash
npm install

npm run forge -- import https://github.com/NousResearch/hermes-agent.git
npm run forge -- import https://github.com/deepseek-ai/deepseek-harness.git
```

Use `--shallow` for a quick exploration clone. Omit it when a full Git history is needed.

## Scan

```bash
npm run forge -- scan hermes-agent
npm run forge -- scan deepseek-harness
```

The scanner records:

- source commit;
- license files;
- coarse license status;
- candidate files and capability categories.

The scanner is deliberately conservative: finding an MIT license at repository root is not proof that every dependency, vendored payload, generated artifact or subdirectory is MIT.

## Integration policy

A candidate is not automatically copied into the AgentiCOS first-party tree.

Each component must pass:

1. license/provenance audit;
2. dependency audit;
3. API compatibility review;
4. security review;
5. test coverage;
6. architectural fit.

Then it gets one of:

- `integrate`: safe to adopt with minimal changes;
- `adapt`: useful implementation adapted behind AgentiCOS interfaces;
- `reference`: design or implementation reference only;
- `exclude`: not suitable.

## Planned Source Forge expansion

The initial implementation is intentionally a foundation. Next capabilities:

- recursive repository manifests;
- license detection for every package/subdirectory;
- dependency graph and transitive license inventory;
- source-code symbol inventory;
- architecture map;
- duplicate implementation detection;
- component comparison across repositories;
- compatibility adapters;
- automatic extraction into AgentiCOS packages;
- generated third-party notices/SBOM;
- upstream refresh and diffing;
- regression tests against source snapshots;
- policy gates that block integration when license/security evidence is incomplete.

## Principle

The goal is exactly:

```
Many open-source agent repositories
              |
              v
      Source Forge
              |
     understand + compare
              |
              v
      best components
              |
              v
         AgentiCOS
```

AgentiCOS remains the product and runtime. Upstream projects remain identifiable sources, not hidden dependencies.
