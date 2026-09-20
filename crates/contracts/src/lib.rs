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
#[async_trait::async_trait]
pub trait ModelProvider: Send + Sync + 'static {
    /// Provider identifier.
    fn provider_id(&self) -> &str;

    /// Execute a model request and return the response.
    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError>;
}

/// Model request for execution.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModelRequest {
    /// Request identifier.
    pub request_id: String,
    /// Model identifier.
    pub model: String,
    /// Input prompt or context.
    pub input: String,
    /// Optional parameters.
    pub parameters: Option<String>,
}

/// Model response from execution.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ModelResponse {
    /// Request identifier (echoed).
    pub request_id: String,
    /// Generated output.
    pub output: String,
    /// Optional metadata.
    pub metadata: Option<String>,
    /// Token usage statistics.
    pub tokens_used: Option<u64>,
}

/// Agent orchestration engine boundary.
#[async_trait::async_trait]
pub trait AgentEngine: Send + Sync + 'static {
    /// Engine identifier.
    fn engine_id(&self) -> &str;

    /// Start a new agent run with the given objective.
    async fn start_run(&self, run_id: RunId, objective: String) -> Result<(), ContractError>;

    /// Resume an existing agent run.
    async fn resume_run(&self, run_id: RunId) -> Result<(), ContractError>;

    /// Get the current state of a run.
    async fn get_run_state(&self, run_id: RunId) -> Result<RunState, ContractError>;
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

/// Structured log level.
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum LogLevel {
    /// Trace-level logging.
    Trace,
    /// Debug-level logging.
    Debug,
    /// Info-level logging.
    Info,
    /// Warning-level logging.
    Warn,
    /// Error-level logging.
    Error,
}

/// Structured log entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LogEntry {
    /// Log level.
    pub level: LogLevel,
    /// Timestamp.
    pub timestamp: u64,
    /// Component/module identifier.
    pub component: String,
    /// Log message.
    pub message: String,
    /// Structured fields.
    pub fields: Vec<(String, String)>,
    /// Optional correlation ID.
    pub correlation_id: Option<String>,
}

/// Configuration validation error.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConfigError {
    /// Missing required configuration value.
    MissingValue(String),
    /// Invalid configuration value.
    InvalidValue(String),
    /// Configuration parse error.
    ParseError(String),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingValue(key) => write!(f, "missing required configuration: {}", key),
            Self::InvalidValue(key) => write!(f, "invalid configuration value: {}", key),
            Self::ParseError(msg) => write!(f, "configuration parse error: {}", msg),
        }
    }
}

impl std::error::Error for ConfigError {}

impl From<ConfigError> for ContractError {
    fn from(_err: ConfigError) -> Self {
        ContractError::Persistence // Map config errors to persistence for now
    }
}

/// Capability grant type.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CapabilityType {
    /// Read-only capability.
    Read,
    /// Write capability.
    Write,
    /// Execute capability.
    Execute,
    /// Admin capability.
    Admin,
}

/// Capability grant with scope.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityGrant {
    /// Capability type.
    pub capability_type: CapabilityType,
    /// Resource scope.
    pub resource: String,
    /// Permission level.
    pub permission: String,
    /// Expiration timestamp (0 = no expiration).
    pub expires_at: u64,
    /// Grant ID.
    pub grant_id: String,
}

/// Structured logging trait.
#[async_trait::async_trait]
pub trait Logger: Send + Sync {
    /// Log a structured entry.
    async fn log(&self, entry: LogEntry) -> Result<(), ContractError>;

    /// Check if a log level is enabled.
    fn is_enabled(&self, level: LogLevel) -> bool;
}

/// Configuration layer trait.
pub trait ConfigLayer: Send + Sync {
    /// Get a configuration value.
    fn get(&self, key: &str) -> Result<String, ConfigError>;

    /// Set a configuration value.
    fn set(&mut self, key: String, value: String) -> Result<(), ConfigError>;

    /// Validate the configuration.
    fn validate(&self) -> Result<(), ConfigError>;
}

/// Capability issuer trait.
#[async_trait::async_trait]
pub trait CapabilityIssuer: Send + Sync {
    /// Issue a capability grant.
    async fn issue(&self, request: CapabilityGrant) -> Result<String, ContractError>;

    /// Revoke a capability grant.
    async fn revoke(&self, grant_id: &str) -> Result<(), ContractError>;

    /// Validate a capability grant.
    async fn validate(&self, grant_id: &str) -> Result<bool, ContractError>;
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
