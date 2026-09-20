#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Stable, versioned domain contracts for AgentiCOS.

use std::fmt;

/// Contract schema version supported by this workspace.
pub const CONTRACT_SCHEMA_VERSION: u16 = 1;

/// Stable identifier for a durable execution run.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct RunId(String);

impl RunId {
    /// Creates a validated run identifier.
    pub fn new(value: impl Into<String>) -> Result<Self, ContractError> {
        let value = value.into();
        if value.is_empty() || value.len() > 256 {
            return Err(ContractError::InvalidId);
        }
        Ok(Self(value))
    }

    /// Returns the identifier as text.
    pub fn as_str(&self) -> &str { &self.0 }
}

/// Stable error category used across protocol boundaries.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ErrorCategory {
    /// Validation or malformed input.
    Validation,
    /// Protocol or compatibility mismatch.
    Protocol,
    /// Persistence or storage failure.
    Persistence,
    /// Policy/security rejection.
    Security,
    /// Transient execution failure.
    Transient,
    /// Unrecoverable execution failure.
    Fatal,
}

/// Contract-layer error.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    /// An ID was empty or exceeded its maximum length.
    InvalidId,
    /// A contract version is incompatible.
    IncompatibleVersion,
    /// A capability required by a contract is missing.
    MissingCapability,
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId => write!(f, "invalid identifier"),
            Self::IncompatibleVersion => write!(f, "incompatible contract version"),
            Self::MissingCapability => write!(f, "missing required capability"),
        }
    }
}

impl std::error::Error for ContractError {}

/// Durable run lifecycle states. Illegal transitions are rejected by the kernel.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RunState {
    /// Run record exists but has not entered execution.
    Created,
    /// Run is admitted to the scheduler.
    Admitted,
    /// Run is waiting for execution capacity.
    Waiting,
    /// Run is actively executing.
    Running,
    /// Cancellation was requested.
    Cancelling,
    /// Run completed successfully.
    Completed,
    /// Run terminated with a failure.
    Failed,
    /// Run was cancelled.
    Cancelled,
}

/// Versioned event metadata envelope.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEnvelope {
    /// Stable event identifier.
    pub event_id: String,
    /// Aggregate/run identifier.
    pub aggregate_id: RunId,
    /// Monotonic stream sequence.
    pub sequence: u64,
    /// Event schema version.
    pub schema_version: u16,
    /// Correlation identifier.
    pub correlation_id: String,
    /// Causation identifier when known.
    pub causation_id: Option<String>,
}

/// Model transport is deliberately separated from agent orchestration.
pub trait ModelProvider: Send + Sync + 'static {
    /// Provider identifier.
    fn provider_id(&self) -> &str;
}

/// Agent orchestration engine boundary.
pub trait AgentEngine: Send + Sync + 'static {
    /// Starts or resumes one durable run.
    fn engine_id(&self) -> &str;
}

/// Typed tool execution boundary.
pub trait AgentTool: Send + Sync + 'static {
    /// Stable tool identifier.
    fn tool_id(&self) -> &str;
}
