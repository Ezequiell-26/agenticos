# ADR 0008 — Sequential Verified Implementation

## Status

Accepted.

## Decision

AgentiCOS will be implemented one vertical slice at a time. An AI coding agent may only modify the scope authorized by the active implementation step.

A step must pass its declared verification gates before the following step becomes eligible.

## Motivation

AgentiCOS is intentionally developed through repeated AI-assisted iterations. Large uncontrolled batches create hidden coupling, make regressions difficult to localize and allow future abstractions to contaminate foundational contracts.

The implementation protocol therefore treats step progression as a state machine and verification gate, not as an instruction in natural language alone.

## Required controls

- durable step-state manifest;
- one active step at a time;
- predecessor verification before successor activation;
- fail-closed verification;
- reference evidence lookup before non-trivial implementation;
- scope lock;
- contract/protocol compatibility checks;
- architecture/security/provenance gates;
- persisted verification evidence;
- explicit correction cycle after failure.

## Consequence

Functional implementation starts only after the architecture foundation itself passes its verification gate. Future phases cannot be silently pre-implemented.
