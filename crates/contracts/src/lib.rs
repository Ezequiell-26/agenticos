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
    pub fn as_str(&self) -> &str {
        &self.0
    }
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
    /// A persistence or storage operation failed.
    Persistence,
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId => write!(f, "invalid identifier"),
            Self::IncompatibleVersion => write!(f, "incompatible contract version"),
            Self::MissingCapability => write!(f, "missing required capability"),
            Self::Persistence => write!(f, "persistence or storage failure"),
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

/// Durable event storage contract.
#[async_trait::async_trait]
pub trait EventStore: Send + Sync {
    /// Append events to a stream with optimistic concurrency control.
    async fn append(
        &self,
        stream_id: &str,
        expected_version: u64,
        events: Vec<SerializedEvent>,
    ) -> Result<u64, ContractError>;

    /// Read events from a stream after a given version.
    async fn read_after(
        &self,
        stream_id: &str,
        after_version: u64,
    ) -> Result<Vec<SerializedEvent>, ContractError>;
}

/// Snapshot storage contract for state recovery.
#[async_trait::async_trait]
pub trait SnapshotStore: Send + Sync {
    /// Store a snapshot for a stream.
    async fn put(&self, snapshot: SerializedSnapshot) -> Result<(), ContractError>;

    /// Retrieve the latest snapshot for a stream.
    async fn latest(&self, stream_id: &str) -> Result<Option<SerializedSnapshot>, ContractError>;
}

/// Serialized event for persistence.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SerializedEvent {
    /// Event type identifier.
    pub event_type: String,
    /// Event data as JSON.
    pub data: String,
    /// Event schema version.
    pub schema_version: u16,
}

/// Serialized snapshot for recovery.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SerializedSnapshot {
    /// Stream identifier.
    pub stream_id: String,
    /// Snapshot version (corresponds to event sequence).
    pub version: u64,
    /// Snapshot data as JSON.
    pub data: String,
    /// Snapshot schema version.
    pub schema_version: u16,
}

/// Idempotency record for retryable operations.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdempotencyRecord {
    /// Operation key.
    pub key: String,
    /// Input fingerprint.
    pub fingerprint: String,
    /// Operation status.
    pub status: IdempotencyStatus,
    /// Cached result if completed.
    pub result: Option<String>,
}

/// Idempotency operation status.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IdempotencyStatus {
    /// Operation is in progress.
    InProgress,
    /// Operation completed successfully.
    Completed,
    /// Operation failed.
    Failed,
}

/// Lease record for distributed execution ownership.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaseRecord {
    /// Resource identifier (e.g., run_id).
    pub resource_id: String,
    /// Owner identifier.
    pub owner_id: String,
    /// Monotonic fencing token.
    pub fencing_token: u64,
    /// Lease expiration timestamp.
    pub expires_at: u64,
}

/// Cancellation token for cooperative cancellation.
#[derive(Clone, Debug)]
pub struct CancellationToken {
    /// Inner cancellation state.
    inner: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl CancellationToken {
    /// Create a new cancellation token.
    pub fn new() -> Self {
        Self {
            inner: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    /// Check if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.inner.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Request cancellation.
    pub fn cancel(&self) {
        self.inner.store(true, std::sync::atomic::Ordering::Relaxed);
    }
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}
