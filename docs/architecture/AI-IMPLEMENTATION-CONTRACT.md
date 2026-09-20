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
19. Apply the applicable token-optimization contract at model/tool boundaries.\n20. Leave a stable checkpoint.

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
