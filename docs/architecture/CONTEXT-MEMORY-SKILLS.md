# AgentiCOS Context, Memory and Skills Architecture

## Context is a compiled view

The model does not own the canonical state. A Context Engine compiles a bounded model input from durable and ephemeral sources.

```text
Durable state       Ephemeral state
     │                    │
     ├── project rules    ├── current user input
     ├── memory           ├── live tool result
     ├── skills           └── current observations
     ├── thread history
     └── project map
              │
              ↓
        Context Planner
              │
      budget + relevance + provenance
              │
              ↓
        Compiled Context
              │
              ↓
             Model
```

## Context budgets

Every contributor has:
- maximum size;
- priority;
- cache eligibility;
- provenance;
- truncation policy.

The system must avoid unbounded prompt growth. Stable prefixes should be reused where provider/model capabilities allow.

## Memory tiers

| Tier | Lifetime | Example |
|---|---|---|
| Working | current turn/run | current plan |
| Session | current thread | recent decisions |
| Project | project lifetime | stack, conventions, architecture |
| User | profile lifetime | preferences |
| Semantic | long lifetime | retrieved facts |
| Procedural | reusable | skills |
 
Memory capture is policy-controlled. The agent should not silently persist arbitrary sensitive information.

## Skills

Skills are reusable procedures loaded progressively.

A skill declares:
- name/version;
- purpose;
- triggers;
- instructions;
- required tools;
- required provider capabilities;
- dependencies;
- scripts;
- trust level.

Skills can be bundled, project-local, user-local or installed from a trusted registry.

## Rules versus skills

Persistent rules provide context constraints. Skills provide procedures. Workflows coordinate multiple tasks.

This separation is deliberate and also aligns with current agent-product direction: Antigravity is migrating its older workflow mechanism toward skills, while Hermes treats skills as procedural memory with progressive loading.

## Retrieval

Retrieval is a separate service with pluggable backends.

```text
query
 ↓
retrieval policy
 ↓
candidate memories/documents
 ↓
rerank
 ↓
bounded context fragments
```

The retrieval layer never directly executes tools.