# AgentiCOS — Agent Working Preferences

## Remote workspace preference

For AgentiCOS development, the assistant should attempt to use **Remote Desktop Commander first** whenever an authorized local device is online.

Use the remote workspace for:
- inspecting the local repository and developer environment;
- running local builds, tests, formatters, linters, and diagnostics;
- verifying runtime behavior when the local environment is required;
- checking the local checkout against `origin/main`.

When Remote Desktop Commander is unavailable, use the connected GitHub repository as the authoritative project source and clearly distinguish remote-repository verification from local-environment verification.

## Source of truth

- Canonical repository: `Ezequiell-26/agenticos`
- Canonical branch: `main`
- Preserve Git history.
- Do not claim local verification unless the local environment was actually checked.
