# Adopt Vertical Slice Protocol

## Status

Accepted

## Context and Problem Statement

AgentiCOS needs a disciplined approach to implementation to prevent premature complexity and ensure each capability is verified before the next is unlocked. Traditional waterfall or big-bang approaches lead to unverified code and technical debt.

## Decision Drivers

- Sequential verification requirements
- Need for provenance tracking
- Architecture-first development philosophy
- Risk minimization through incremental delivery
- Clear stopping points for each capability

## Considered Options

- **Vertical Slice Protocol**: Implement one capability end-to-end, verify, then unlock next
- **Horizontal Layer Implementation**: Implement layers (contracts, persistence, UI) before integration
- **Feature-Based Sprints**: Implement related features together regardless of boundaries

## Decision Outcome

Chosen option: "Vertical Slice Protocol", because it ensures each capability is production-complete before moving forward, provides clear verification gates, and maintains architectural boundaries through end-to-end slices.

### Consequences

- Good, because each capability is verified before building on it
- Good, because clear stopping points enable safe interruptions
- Good, because provenance is tracked per slice
- Bad, because may feel slower initially
- Bad, because requires careful planning of slice boundaries

## Validation

Validated by implementation of Steps 0-10 (architecture foundation, kernel, agent engine, provider plane, tool plane, memory/context, protocols, CLI, source-forge) with explicit verification gates in `reference/manifests/implementation-state.json`.

## Pros and Cons of the Options

### Vertical Slice Protocol

- Good: Each capability verified before next
- Good: Clear stopping points
- Good: Provenance tracking
- Bad: Slower initial progress
- Bad: Requires careful planning

### Horizontal Layer Implementation

- Good: Faster initial code generation
- Bad: Unverified integration
- Bad: Higher risk of rework
- Bad: Unclear stopping points

### Feature-Based Sprints

- Good: Delivers visible features quickly
- Bad: May violate architectural boundaries
- Bad: Harder to verify architectural contracts
- Bad: Less predictable integration
