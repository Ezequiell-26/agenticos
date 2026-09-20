# AgentiCOS Repository Structure

The repository is organized around architectural boundaries rather than individual upstream projects.

```text
agenticos/
├── apps/
│   ├── cli/
│   ├── tui/
│   ├── web/
│   ├── desktop/
│   └── ide/
│
├── packages/
│   ├── kernel/
│   ├── contracts/
│   ├── runtime/
│   ├── protocol/
│   ├── providers/
│   ├── router/
│   ├── tools/
│   ├── sandbox/
│   ├── context/
│   ├── memory/
│   ├── skills/
│   ├── workflows/
│   ├── agents/
│   ├── projects/
│   ├── artifacts/
│   ├── plugins/
│   ├── gateway/
│   ├── observability/
│   ├── security/
│   ├── source-forge/
│   └── sdk/
│
├── engines/
│   ├── adapters/
│   │   ├── hermes/
│   │   ├── deepseek-harness/
│   │   └── codex/
│   └── manifests/
│
├── vendor/
│   └── sources/
│       ├── hermes-agent/
│       ├── deepseek-harness/
│       └── codex/
│
├── protocols/
│   ├── application/
│   ├── engine/
│   └── plugin/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── reference/
│
├── tests/
│   ├── contract/
│   ├── integration/
│   ├── engine/
│   ├── sandbox/
│   ├── e2e/
│   └── replay/
│
└── third-party/
    ├── licenses/
    ├── notices/
    ├── sbom/
    └── provenance/
```

## Vendor boundary

vendor/ contains source snapshots and must not become an unreviewed import path for production code.

engines/ contains adapters and integration glue.

packages/ contains AgentiCOS-owned contracts and implementations.

apps/ contains clients.

This structure lets Source Forge import entire repositories while keeping the product architecture clean.