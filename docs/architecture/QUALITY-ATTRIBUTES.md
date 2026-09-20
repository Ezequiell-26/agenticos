# AgentiCOS Quality Attributes

Architecture is judged by these system qualities, not only by feature count.

## Security
- least privilege by default;
- explicit approval for privileged actions;
- sandboxed execution;
- secret isolation;
- plugin capability declarations;
- auditable external actions.

## Reliability
- durable runs;
- restart recovery;
- bounded retries;
- idempotent side effects;
- provider failover;
- isolated child agents;
- explicit terminal states.

## Extensibility
- provider plugins;
- tool plugins;
- skill packages;
- engine adapters;
- sandbox backends;
- channel adapters;
- storage adapters.

Adding one provider or tool must not require changing the agent loop.

## Portability
The runtime must support desktop/local execution and remote execution without changing task semantics.

Language/runtime-specific components communicate through protocol boundaries.

## Performance
- streaming first for interactive paths;
- bounded context assembly;
- caching of stable context;
- asynchronous child runs;
- incremental project indexing;
- lazy skill loading;
- non-blocking UI.

No optimization may weaken determinism, security or recoverability.

## Cost efficiency
- free-first routing when policy allows;
- quota-aware selection;
- budget enforcement;
- model capability matching;
- local inference when configured;
- cache-aware provider use;
- per-run cost visibility.

## Observability
Every important action is correlated to a run/thread/step/item identity and produces structured events.

The system should answer:
- what happened;
- which agent did it;
- which model/provider was used;
- which tool executed;
- what permissions were granted;
- what it cost;
- what failed;
- what was produced.

## Maintainability
- small kernel;
- explicit contracts;
- one-way dependencies;
- no duplicate agent loops;
- no direct provider calls from domains outside Providers;
- architecture decisions recorded as ADRs;
- generated compatibility checks.

## Testability
External providers/tools must be replaceable by deterministic test doubles.

Every run can be replayed from recorded logical inputs without using production secrets.

## Upgradeability
Providers, plugins, skills and engine adapters can evolve independently through versioned contracts.

Persisted data uses explicit migrations.

## User control
Automation is never equivalent to unrestricted authority.

The user can inspect or override provider routing, permissions, task state and background work according to the product surface.

## Architecture success criterion
AgentiCOS succeeds when new capabilities can be added through existing extension points instead of creating new parallel runtimes or bypass paths.