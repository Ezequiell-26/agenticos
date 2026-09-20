# ADR 0004 — Polyglot Engine Boundary

Status: Accepted

## Decision

AgentiCOS will not require Hermes, DeepSeek Harness, Codex and future source engines to share a programming language.

The unification boundary is a versioned protocol plus capability contracts.

External engines may be embedded or executed as isolated workers according to compatibility and security requirements.

## Rationale

Hermes currently spans Python/runtime tooling, DeepSeek Harness is built around Node/TypeScript and Cordis, while Codex is a Rust-based runtime with a typed app-server boundary. Forcing these into one language would create unnecessary rewrites and erase useful upstream implementations.

## Consequence

AgentiCOS becomes a product/runtime above implementations rather than a monolithic language-specific fork.