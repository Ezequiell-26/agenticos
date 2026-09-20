# AgentiCOS Distribution and Update Architecture

## Targets

AgentiCOS should support:
- source checkout;
- developer install;
- packaged CLI;
- desktop bundle;
- worker/daemon;
- container;
- remote service.

All targets use the same runtime contracts.

## Runtime packaging

The product can ship:
- core runtime;
- selected built-in plugins;
- optional plugin packs;
- optional external engine adapters.

## Update channels

- stable;
- beta;
- nightly/development.

Plugin and protocol compatibility are checked before activation.

## Safe update

1. Download metadata.
2. Verify integrity/signature.
3. Resolve compatibility.
4. Stage update separately.
5. Run startup/contract checks.
6. Activate.
7. Roll back if boot health fails.

## Source dependency updates

Source Forge must be able to pin exact source commits and update them as separate snapshots.

No automatic source update may silently change first-party behavior.