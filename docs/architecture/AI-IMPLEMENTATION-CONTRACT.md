# AgentiCOS AI Implementation Contract

This contract defines how an AI coding agent must build AgentiCOS during iterative development.

## Mandatory sequence

1. Inspect architecture.
2. Identify the feature manifest.
3. Identify the current slice.
4. Search the Reference Knowledge Corpus.
5. Read relevant source documentation, implementation and tests.
6. Record applicable reference evidence.
7. Reuse or extend an existing AgentiCOS contract when possible.
8. Create or adjust the surface shell when needed.
9. Connect the shell to the final application protocol.
10. Connect the protocol to a deterministic test implementation.
11. Replace the test implementation with the real implementation.
12. Add persistence.
13. Add streaming/asynchronous behavior when required.
14. Add security and permissions.
15. Add observability.
16. Add failure and recovery behavior.
17. Add integration and end-to-end verification.
18. Update the manifest and architecture documentation.
19. Apply the applicable token-optimization contract at model/tool boundaries.
20. Verify persistence/replay behavior when the feature crosses a durable Run boundary.
21. Verify capability scoping and sandbox behavior when the feature executes tools or imported code.
22. Leave a stable checkpoint.

## Reference-first engineering rule

The coding agent should not begin a complex implementation from general model knowledge when AgentiCOS already has a relevant source reference.

Preferred sequence:

Search source corpus
      ↓
Retrieve relevant README/docs
      ↓
Retrieve relevant implementation files
      ↓
Retrieve relevant tests
      ↓
Extract behavior + edge cases
      ↓
Map to AgentiCOS contracts
      ↓
Implement

The objective is to minimize unnecessary reinvention while maintaining AgentiCOS-specific contracts, security, portability and architecture.

For implementation code, MIT-admitted sources have priority. Non-MIT references may provide comparative evidence but are not source inputs to canonical MIT-only product code.

## Source priority

1. Existing AgentiCOS contract and tested implementation.
2. Approved reference repository with strong matching behavior.
3. Other approved reference repositories.
4. New design only when the above are insufficient.

Reference code may be adapted, rewritten or used only as design evidence depending on licensing, architecture and compatibility requirements.

## Exception

If no suitable reference exists, or the reference is incompatible with the product requirements, the agent may design a new approach. The reason must be documented.

## Token optimization rule

For non-trivial context/tool-output features, the coding agent must consult the token-optimization evidence pack before inventing a new compression or caching path.

The agent must determine:

- whether the transform is lossless or explicitly lossy;
- which content classes are protected;
- whether an original/recovery path exists;
- whether dedup/cache scope crosses a trust boundary;
- how token savings are measured;
- whether the source is MIT-admissible for code reuse.

Reference-only or non-MIT sources may inform design comparison, but their source code must not enter an MIT-only implementation boundary.

Any optimizer failure must fall back to the original content unless the contract explicitly defines a different safe behavior.

## Security rule

Source code found in the reference corpus never overrides AgentiCOS security policy.

External code, plugins, tools and agents remain untrusted until admitted by the corresponding trust boundary.

## Feature completion rule

A feature is complete only when it is user-reachable, contract-connected, persistent when appropriate, secured, observable, failure-tolerant, tested and documented.

## Stable checkpoints

Every iteration ends with a checkpoint that another coding agent can continue from without reconstructing hidden context.

## Universal capability lookup

For any request involving an API, plugin, skill, memory backend, tool, toolset, MCP server, channel, webhook, schedule or engine adapter, the agent must first resolve:

1. the capability kind;
2. the owning AgentiCOS contract;
3. the capability registry descriptor;
4. the applicable Reference Knowledge Corpus entries;
5. the required protocol/schema;
6. the security/capability requirements;
7. the lifecycle and recovery requirements.

The agent must not create a bespoke integration path when the capability registry and provider/plugin contracts already cover it.

## Extension implementation rule

Adding a provider, plugin, skill, memory backend, tool, channel or API integration must normally be isolated to the extension boundary and its tests. A modification to the canonical AgentEngine requires an explicit architecture reason and ADR review.

## Hermes/Harness parity checklist

Before declaring the corresponding architecture capability complete, the agent checks for the applicable evidence and contract coverage for:

- provider/model discovery and switching;
- API credential pools and isolation;
- typed tool registry and guarded execution;
- toolsets and lifecycle hooks;
- progressive skill discovery/loading;
- persistent and pluggable memory;
- event-sourced sessions and replay;
- session search/export/checkpointing;
- multi-agent delegation and scoped ownership;
- scheduled jobs and no-agent deterministic jobs;
- messaging/channel gateway;
- webhook triggers and replay protection;
- MCP/A2A;
- profiles and isolated configuration;
- management/admin APIs;
- IDE/ACP protocol integration;
- plugin installation, activation, health, upgrade, rollback and uninstall.

The checklist describes architecture obligations, not permission to copy upstream source.

## Mandatory MIT reference resolver

Before any non-trivial architectural or functional change, the implementation agent MUST consult:

- `reference/manifests/mit-repositories.json`;
- `reference/manifests/capability-parity.json`;
- `reference/manifests/reference-discovery.json`;
- `docs/architecture/REFERENCE-RESOLUTION-PROTOCOL.md`.

Repository selection order is fixed:

`user-named repo → exact catalog repo → parity references → GitHub capability search`.

The selected repository MUST be inspected as a repository, not inferred from memory or a README excerpt. The agent must collect documentation, source structure, relevant implementation files, tests, fixtures, build metadata, CI, security material, license/path notices, dependencies and relevant history.

No-invention rule: when the repository evidence does not establish a requested behavior, the agent must not fabricate the missing behavior as though it came from that repository. It must either use another verified reference or introduce a documented AgentiCOS design decision.

Before any source integration, the exact commit is pinned and the Source Forge license/dependency/provenance/security gates pass.

The static MIT catalog is a seed corpus, not a claim to enumerate every MIT repository on GitHub. The resolver is intentionally dynamic so future relevant MIT repositories can be found without changing the architecture contract.

### Reference selection record

Every implementation step that uses repository evidence records:

`capability → repository → resolved ref/commit → license evidence → relevant paths → extracted evidence → applicability → exclusions`.

A step cannot become VERIFIED without this record.

