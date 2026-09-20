#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Minimal kernel boundary. Functional runtime construction starts in Step 1.

use agenticos_contracts::{ContractError, RunId, RunState};

/// Pure transition validator for the durable Run state machine.
pub fn validate_transition(from: RunState, to: RunState) -> Result<(), ContractError> {
    let allowed = matches!(
        (from, to),
        (RunState::Created, RunState::Admitted)
            | (RunState::Admitted, RunState::Waiting)
            | (RunState::Admitted, RunState::Running)
            | (RunState::Waiting, RunState::Running)
            | (RunState::Running, RunState::Cancelling)
            | (RunState::Cancelling, RunState::Cancelled)
            | (RunState::Running, RunState::Completed)
            | (RunState::Running, RunState::Failed)
            | (RunState::Waiting, RunState::Cancelled)
            | (RunState::Waiting, RunState::Failed)
    );
    allowed
        .then_some(())
        .ok_or(ContractError::IncompatibleVersion)
}

/// Kernel identity container used during bootstrap.
#[derive(Clone, Debug)]
pub struct KernelIdentity {
    /// Stable run identity.
    pub run_id: RunId,
    /// Current lifecycle state.
    pub state: RunState,
}
