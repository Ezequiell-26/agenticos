# Reference Resolution Protocol

## Objective

AgentiCOS uses repositories as primary engineering evidence. The AI must locate the repository that best matches the requested capability before inventing an implementation.

## Resolution

The resolver follows:

`exact user URL/repository → exact catalog entry → capability parity → GitHub capability search → license admission → full repository evidence → exact commit pin`

A named repository supplied by the user takes precedence over generic alternatives, subject to license and security checks.

## Evidence rule

A README is insufficient for non-trivial implementation. The resolver reads documentation, source structure and relevant source files, tests, build manifests, CI, security policy, license/notice material, dependencies and relevant change history.

The result is an evidence pack containing repository identity, resolved commit, license evidence, relevant paths, extracted architectural patterns, test/CI evidence, dependency findings, security findings, applicability and exclusions.

## No-invention rule

The implementation agent may not claim that a capability exists in a reference when the evidence pack does not establish it.

When multiple repositories address the same capability, their documented behavior is compared. AgentiCOS contracts are the canonical boundary; references are implementation evidence, not permission to bypass the architecture.

## MIT admission

The static catalog is a verified seed corpus, not an enumeration of every MIT repository on GitHub. New repositories are discovered dynamically and must pass the same license/path/dependency audit.

A repository with a license transition, non-MIT enterprise subtree, missing license artifact or unresolved path-level licensing remains reference-only until Source Forge establishes a safe disposition.

## Before source integration

An exact commit must be pinned. The admission record must include source provenance, license notices, dependency/license graph and affected files. Imported code is untrusted until isolated tests and security checks pass.

## Before each implementation step

`requirement → capability lookup → reference evidence → contract impact → implementation → verification → evidence → unlock`

Failure to resolve evidence blocks the step rather than triggering an invented design.
