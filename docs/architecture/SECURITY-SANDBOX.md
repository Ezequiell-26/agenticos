# AgentiCOS Security and Sandbox Architecture

## Security layers

```text
User identity
   ↓
Profile/workspace trust
   ↓
Capability declaration
   ↓
Policy evaluation
   ↓
Approval decision
   ↓
Sandbox policy
   ↓
Tool execution
   ↓
Audit event
```

Approval and sandbox are separate. Approval answers whether an action is authorized. Sandbox answers where and with what capabilities it can execute.

## Access profiles

| Profile | Filesystem | Network | Destructive actions |
|---|---|---|---|
| read-only | read | restricted | denied |
| workspace-write | workspace only | restricted | ask |
| development | workspace + configured roots | controlled | ask |
| autonomous-safe | declared writable roots | allowlisted | ask |
| full-access | unrestricted | unrestricted | explicit user choice |

The product should default to a restricted profile.

## Capability model

Capabilities are **unforgeable, attenuated runtime grants**, not global access tokens
handed to the model.

A grant has at minimum:

```
capability_id
principal_id
run_id
step_id
tool_id
scope
operation
resource
constraints
issued_at
expires_at
nonce
revocation_epoch
```

The model can request an action, but it cannot mint or widen a capability.

A capability may be attenuated from parent policy:

```
workspace-write
   ↓
project-write
   ↓
path-write(/project/src/main.rs)
   ↓
single-operation grant
```

For sensitive operations, the grant may be single-use or short-lived. After the
step completes, expires, is revoked or is consumed, the handle becomes invalid.

The runtime should prefer an opaque capability handle whose authoritative details
remain server-side rather than putting credential-bearing material into model
context.

Tools declare capabilities such as:
- filesystem.read;
- filesystem.write;
- process.execute;
- network.request;
- browser.control;
- credentials.use;
- git.write;
- deployment.execute.

The policy engine evaluates each requested capability against profile, project trust, user choice and tool metadata.

## Capability evaluation sequence

```
requested capability
       ↓
parent capability/policy
       ↓
scope attenuation
       ↓
approval requirement
       ↓
resource binding
       ↓
time/usage limits
       ↓
runtime-issued grant
       ↓
tool executor validates grant
       ↓
consume/revoke
```

The tool executor rejects grants whose run, step, tool, resource scope, nonce,
expiration or revocation epoch no longer match.

## Secret boundaries

Provider keys, OAuth tokens and credentials live in a secret manager.
Secrets are never injected into model-visible context unless a tool explicitly requires a secret and policy permits that injection.
Logs contain secret-safe identifiers, never raw secret values.

## Sandbox backends

The abstraction must support local and remote backends:
- native OS sandbox;
- container;
- VM/isolated runtime;
- remote execution worker;
- hosted sandbox.

The agent and tool contracts do not depend on one sandbox implementation.

## Safety invariants

1. UI cannot bypass the policy engine.
2. Model output cannot directly execute an OS command.
3. A tool must declare its capability requirements.
4. Additional permissions are scoped to the smallest required action.
5. Dangerous operations produce auditable decisions.
6. Model text is never itself an authorization credential.
6. Cancellation terminates or detaches tool execution safely.
7. Sandboxed execution is the default for model-generated code/processes.
8. Capabilities are attenuable, time-bounded and revocable.
9. A stale/expired/consumed capability cannot be reused.
10. Capability grants are bound to run + step + tool + resource.
11. Secrets are never represented as general-purpose capabilities.

These principles follow the same architectural separation emphasized by Codex: filesystem/network sandboxing and approval policy are distinct controls, and scoped permission escalation is preferred over unrestricted execution.