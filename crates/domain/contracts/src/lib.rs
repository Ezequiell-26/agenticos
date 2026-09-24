#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Stable, versioned domain contracts for AgentiCOS.

use serde::{Deserialize, Serialize};
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
    /// A parsing or serialization error occurred.
    ParseError(String),
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidId => write!(f, "invalid identifier"),
            Self::IncompatibleVersion => write!(f, "incompatible contract version"),
            Self::MissingCapability => write!(f, "missing required capability"),
            Self::Persistence => write!(f, "persistence or storage failure"),
            Self::ParseError(msg) => write!(f, "parse error: {}", msg),
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
#[async_trait::async_trait]
pub trait AgentTool: Send + Sync + 'static {
    /// Stable tool identifier.
    fn tool_id(&self) -> &str;

    /// Execute the tool with given request.
    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError>;
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

    /// List known durable stream identifiers.
    async fn list_stream_ids(&self) -> Result<Vec<String>, ContractError> {
        Ok(Vec::new())
    }
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
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
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
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
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
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
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

    /// Validate a capability grant against scope and expiry.
    async fn validate_with_expiry(&self, grant_id: &str) -> Result<bool, ContractError>;
}

/// Command for write operations.
#[derive(Clone, Debug)]
pub struct Command {
    /// Command type.
    pub command_type: String,
    /// Command payload.
    pub payload: serde_json::Value,
    /// Correlation ID for tracking.
    pub correlation_id: String,
}

/// Result of a command execution.
#[derive(Clone, Debug)]
pub struct CommandResult {
    /// Whether the command succeeded.
    pub success: bool,
    /// Result message.
    pub message: String,
    /// Generated events from command execution.
    pub events: Vec<SerializedEvent>,
}

/// Query for read operations.
#[derive(Clone, Debug)]
pub struct Query {
    /// Query type.
    pub query_type: String,
    /// Query parameters.
    pub parameters: serde_json::Value,
}

/// Result of a query execution.
#[derive(Clone, Debug)]
pub struct QueryResult {
    /// Query result data.
    pub data: serde_json::Value,
    /// Metadata about the query.
    pub metadata: serde_json::Value,
}

/// Command handler trait for write operations.
#[async_trait::async_trait]
pub trait CommandHandler: Send + Sync {
    /// Handle a command and return the result.
    async fn handle(&self, command: Command) -> Result<CommandResult, ContractError>;
}

/// Query handler trait for read operations.
#[async_trait::async_trait]
pub trait QueryHandler: Send + Sync {
    /// Handle a query and return the result.
    async fn handle(&self, query: Query) -> Result<QueryResult, ContractError>;
}

/// Projection trait for read model updates.
#[async_trait::async_trait]
pub trait Projection: Send + Sync {
    /// Update the read model based on an event.
    async fn update(&self, event: SerializedEvent) -> Result<(), ContractError>;
}

/// Outbox entry for reliable event publication.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OutboxEntry {
    /// Unique outbox entry ID.
    pub entry_id: String,
    /// Event data to publish.
    pub event: SerializedEvent,
    /// Target destination (e.g., queue, topic).
    pub destination: String,
    /// Number of delivery attempts.
    pub attempts: u32,
    /// Status of the entry.
    pub status: OutboxStatus,
    /// When the entry was created.
    pub created_at: u64,
    /// When the entry was processed.
    pub processed_at: Option<u64>,
}

/// Outbox entry status.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OutboxStatus {
    /// Entry is pending publication.
    Pending,
    /// Entry is being processed.
    Processing,
    /// Entry was successfully published.
    Published,
    /// Entry failed to publish (moved to dead letter queue).
    Failed,
    /// Entry is in dead letter queue.
    DeadLetter,
}

/// Outbox store for reliable event publication.
#[async_trait::async_trait]
pub trait OutboxStore: Send + Sync {
    /// Add an entry to the outbox.
    async fn add(&self, entry: OutboxEntry) -> Result<(), ContractError>;

    /// Get pending entries for processing.
    async fn get_pending(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError>;

    /// Mark entry as published.
    async fn mark_published(&self, entry_id: &str) -> Result<(), ContractError>;

    /// Mark entry as failed (move to dead letter queue).
    async fn mark_failed(&self, entry_id: &str) -> Result<(), ContractError>;

    /// Get dead letter queue entries.
    async fn get_dead_letter(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError>;
}

/// Saga step for multi-step workflow orchestration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SagaStep {
    /// Unique step identifier.
    pub step_id: String,
    /// Step name/description.
    pub name: String,
    /// Step type (execute or compensate).
    pub step_type: SagaStepType,
    /// Step payload (command data).
    pub payload: serde_json::Value,
    /// Step status.
    pub status: SagaStepStatus,
    /// Timestamp when step was created.
    pub created_at: u64,
    /// Timestamp when step was completed (if applicable).
    pub completed_at: Option<u64>,
}

/// Saga step type.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SagaStepType {
    /// Execute step (forward action).
    Execute,
    /// Compensate step (rollback action).
    Compensate,
}

/// Saga step status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SagaStepStatus {
    /// Step is pending.
    Pending,
    /// Step is in progress.
    InProgress,
    /// Step completed successfully.
    Completed,
    /// Step failed.
    Failed,
    /// Step is being compensated.
    Compensating,
    /// Step compensation completed.
    Compensated,
}

/// Saga for multi-step workflow orchestration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Saga {
    /// Unique saga identifier.
    pub saga_id: String,
    /// Saga name/description.
    pub name: String,
    /// Saga steps in execution order.
    pub steps: Vec<SagaStep>,
    /// Current saga status.
    pub status: SagaStatus,
    /// Timestamp when saga was created.
    pub created_at: u64,
    /// Timestamp when saga was completed (if applicable).
    pub completed_at: Option<u64>,
    /// Current step index (for tracking progress).
    pub current_step_index: Option<usize>,
}

/// Saga status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SagaStatus {
    /// Saga is pending execution.
    Pending,
    /// Saga is in progress.
    InProgress,
    /// Saga completed successfully.
    Completed,
    /// Saga is compensating (rolling back).
    Compensating,
    /// Saga compensation completed.
    Compensated,
    /// Saga failed.
    Failed,
}

/// Saga coordinator for orchestrating multi-step workflows.
#[async_trait::async_trait]
pub trait SagaCoordinator: Send + Sync {
    /// Start a new saga.
    async fn start_saga(&self, saga: Saga) -> Result<(), ContractError>;

    /// Get saga by ID.
    async fn get_saga(&self, saga_id: &str) -> Result<Option<Saga>, ContractError>;

    /// Execute next step in saga.
    async fn execute_next_step(&self, saga_id: &str) -> Result<(), ContractError>;

    /// Compensate saga (rollback all completed steps).
    async fn compensate_saga(&self, saga_id: &str) -> Result<(), ContractError>;

    /// Get pending sagas for processing.
    async fn get_pending_sagas(&self, limit: usize) -> Result<Vec<Saga>, ContractError>;
}

/// Provider registry entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderEntry {
    /// Provider identifier.
    pub provider_id: String,
    /// Provider name.
    pub name: String,
    /// Base URL for the provider.
    pub base_url: String,
    /// Supported models.
    pub models: Vec<String>,
    /// Provider capabilities.
    pub capabilities: Vec<String>,
}

/// Model catalog entry.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ModelEntry {
    /// Model identifier.
    pub model_id: String,
    /// Provider that hosts this model.
    pub provider_id: String,
    /// Model name.
    pub name: String,
    /// Model context window.
    pub context_window: Option<u32>,
    /// Model capabilities.
    pub capabilities: Vec<String>,
}

/// Credential for provider authentication.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Credential {
    /// Credential identifier.
    pub credential_id: String,
    /// Provider this credential is for.
    pub provider_id: String,
    /// Credential type (e.g., "api_key", "bearer").
    pub credential_type: String,
    /// Credential value.
    pub value: String,
    /// Expiration timestamp (0 = no expiration).
    pub expires_at: u64,
    /// Credential scope (optional).
    pub scope: Option<String>,
}

/// Health status for a provider.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum HealthStatus {
    /// Provider is healthy.
    Healthy,
    /// Provider is degraded.
    Degraded,
    /// Provider is unhealthy.
    Unhealthy,
    /// Provider status unknown.
    Unknown,
}

/// Health check result.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HealthCheck {
    /// Provider identifier.
    pub provider_id: String,
    /// Health status.
    pub status: HealthStatus,
    /// Last check timestamp.
    pub last_check: u64,
    /// Optional message.
    pub message: Option<String>,
}

/// Retry policy for provider requests.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetryPolicy {
    /// Maximum number of retry attempts.
    pub max_attempts: u32,
    /// Initial backoff delay in milliseconds.
    pub initial_backoff_ms: u64,
    /// Maximum backoff delay in milliseconds.
    pub max_backoff_ms: u64,
    /// Whether to use exponential backoff.
    pub exponential_backoff: bool,
}

/// Fallback configuration.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FallbackConfig {
    /// Primary provider ID.
    pub primary_provider: String,
    /// Fallback provider IDs (in order of preference).
    pub fallback_providers: Vec<String>,
    /// Whether to failover automatically.
    pub auto_failover: bool,
}

/// Tool registration entry.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolEntry {
    /// Tool identifier.
    pub tool_id: String,
    /// Tool name.
    pub name: String,
    /// Tool description.
    pub description: String,
    /// Tool capabilities.
    pub capabilities: Vec<String>,
    /// Required permissions.
    pub required_permissions: Vec<String>,
    /// Execution context requirements.
    pub context_requirements: Vec<String>,
}

/// Tool execution request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolRequest {
    /// Request identifier.
    pub request_id: String,
    /// Tool to execute.
    pub tool_id: String,
    /// Input parameters.
    pub parameters: String,
    /// Requesting agent ID.
    pub agent_id: String,
    /// Capability grant ID.
    pub grant_id: String,
}

/// Tool execution response.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ToolResponse {
    /// Request identifier (echoed).
    pub request_id: String,
    /// Execution result.
    pub result: String,
    /// Success status.
    pub success: bool,
    /// Error message if failed.
    pub error: Option<String>,
    /// Output metadata.
    pub metadata: Option<String>,
}

/// Policy decision.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PolicyDecision {
    /// Request approved.
    Approved,
    /// Request denied.
    Denied(String),
    /// Request requires additional approval.
    RequiresApproval(String),
}

/// Policy engine for tool approval.
#[async_trait::async_trait]
pub trait PolicyEngine: Send + Sync + 'static {
    /// Evaluate a tool execution request.
    async fn evaluate(&self, request: &ToolRequest) -> Result<PolicyDecision, ContractError>;

    /// Check if a capability grant allows the operation.
    async fn check_capability(
        &self,
        grant_id: &str,
        capability: &str,
    ) -> Result<bool, ContractError>;
}

/// Message in conversation history.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Message {
    /// Message identifier.
    pub message_id: String,
    /// Role (user, assistant, system, tool).
    pub role: String,
    /// Message content.
    pub content: String,
    /// Timestamp.
    pub timestamp: u64,
    /// Token count.
    pub token_count: u32,
    /// Associated run ID.
    pub run_id: RunId,
}

/// Context window configuration.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContextWindow {
    /// Maximum tokens in context.
    pub max_tokens: u32,
    /// Current token count.
    pub current_tokens: u32,
    /// Reserved tokens for system prompt.
    pub reserved_tokens: u32,
}

/// Memory entry for persistence.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemoryEntry {
    /// Memory identifier.
    pub memory_id: String,
    /// Associated run ID.
    pub run_id: RunId,
    /// Memory key.
    pub key: String,
    /// Memory value.
    pub value: String,
    /// Timestamp.
    pub timestamp: u64,
    /// Expiration (0 = no expiration).
    pub expires_at: u64,
}

/// Context manager contract.
#[async_trait::async_trait]
pub trait ContextManager: Send + Sync {
    /// Add a message to context.
    async fn add_message(&self, message: Message) -> Result<(), ContractError>;

    /// Get current context messages.
    async fn get_context(&self, run_id: RunId) -> Result<Vec<Message>, ContractError>;

    /// Trim context to fit budget.
    async fn trim_context(&self, run_id: RunId, max_tokens: u32) -> Result<(), ContractError>;

    /// Get current token count.
    async fn get_token_count(&self, run_id: RunId) -> Result<u32, ContractError>;
}

/// Memory store contract.
#[async_trait::async_trait]
pub trait MemoryStore: Send + Sync {
    /// Store a memory entry.
    async fn store(&self, entry: MemoryEntry) -> Result<(), ContractError>;

    /// Retrieve a memory entry.
    async fn retrieve(&self, memory_id: &str) -> Result<Option<MemoryEntry>, ContractError>;

    /// Retrieve memories by run ID.
    async fn retrieve_by_run(&self, run_id: RunId) -> Result<Vec<MemoryEntry>, ContractError>;

    /// Delete a memory entry.
    async fn delete(&self, memory_id: &str) -> Result<(), ContractError>;

    /// Delete expired memories.
    async fn delete_expired(&self, now: u64) -> Result<usize, ContractError>;
}

/// Protocol message for agent communication.
#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ProtocolMessage {
    /// Message identifier.
    pub message_id: String,
    /// Protocol version.
    pub protocol_version: String,
    /// Source agent ID.
    pub source: String,
    /// Destination agent ID.
    pub destination: String,
    /// Message type.
    pub message_type: String,
    /// Message payload.
    pub payload: String,
    /// Timestamp.
    pub timestamp: u64,
    /// Correlation ID for request/response matching.
    pub correlation_id: Option<String>,
}

/// Protocol message serialization contract.
#[async_trait::async_trait]
pub trait ProtocolSerializer: Send + Sync {
    /// Serialize a protocol message to bytes.
    async fn serialize(&self, message: ProtocolMessage) -> Result<Vec<u8>, ContractError>;

    /// Deserialize bytes to a protocol message.
    async fn deserialize(&self, data: Vec<u8>) -> Result<ProtocolMessage, ContractError>;
}

/// Protocol validation contract.
#[async_trait::async_trait]
pub trait ProtocolValidator: Send + Sync {
    /// Validate a protocol message.
    async fn validate(&self, message: &ProtocolMessage) -> Result<bool, ContractError>;

    /// Check protocol version compatibility.
    async fn check_version(&self, version: &str) -> Result<bool, ContractError>;
}

/// Protocol transport contract.
#[async_trait::async_trait]
pub trait ProtocolTransport: Send + Sync {
    /// Send a protocol message.
    async fn send(&self, message: ProtocolMessage) -> Result<(), ContractError>;

    /// Receive a protocol message.
    async fn receive(&self) -> Result<Option<ProtocolMessage>, ContractError>;
}

/// Sandbox execution request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SandboxRequest {
    /// Request identifier.
    pub request_id: String,
    /// Code to execute.
    pub code: String,
    /// Execution timeout in milliseconds.
    pub timeout_ms: u64,
    /// Memory limit in bytes.
    pub memory_limit_bytes: u64,
    /// Allowed capabilities.
    pub allowed_capabilities: Vec<String>,
}

/// Sandbox execution response.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SandboxResponse {
    /// Request identifier (echoed).
    pub request_id: String,
    /// Execution success status.
    pub success: bool,
    /// Output from execution.
    pub output: String,
    /// Error message if failed.
    pub error: Option<String>,
    /// Resource usage statistics.
    pub resource_usage: ResourceUsage,
}

/// Resource usage statistics.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResourceUsage {
    /// CPU time in milliseconds.
    pub cpu_time_ms: u64,
    /// Memory used in bytes.
    pub memory_used_bytes: u64,
    /// Execution time in milliseconds.
    pub execution_time_ms: u64,
}

/// Sandbox execution boundary.
#[async_trait::async_trait]
pub trait Sandbox: Send + Sync {
    /// Execute code in sandbox.
    async fn execute(&self, request: SandboxRequest) -> Result<SandboxResponse, ContractError>;

    /// Check if sandbox is available.
    async fn is_available(&self) -> Result<bool, ContractError>;

    /// Get sandbox status.
    async fn get_status(&self) -> Result<SandboxStatus, ContractError>;
}

/// Sandbox status.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SandboxStatus {
    /// Sandbox is ready.
    Ready,
    /// Sandbox is busy.
    Busy,
    /// Sandbox is unavailable.
    Unavailable,
    /// Sandbox is in error state.
    Error(String),
}

/// Quota information for a provider.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QuotaInfo {
    /// Provider identifier.
    pub provider_id: String,
    /// Requests per minute limit.
    pub requests_per_minute: Option<u32>,
    /// Tokens per minute limit.
    pub tokens_per_minute: Option<u32>,
    /// Current usage count.
    pub current_usage: u64,
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

/// Feature flag value type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FlagValue {
    /// Boolean flag.
    Boolean(bool),
    /// String flag.
    String(String),
    /// Numeric flag (f64 for flexibility).
    Numeric(f64),
}

/// Feature flag entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFlag {
    /// Unique flag identifier.
    pub flag_id: String,
    /// Flag name/description.
    pub name: String,
    /// Flag value.
    pub value: FlagValue,
    /// Whether the flag is enabled.
    pub enabled: bool,
    /// Timestamp when flag was created.
    pub created_at: u64,
    /// Timestamp when flag was last updated.
    pub updated_at: u64,
}

/// Feature flag store for runtime configuration.
#[async_trait::async_trait]
pub trait FeatureFlagStore: Send + Sync {
    /// Add or update a feature flag.
    async fn set_flag(&self, flag: FeatureFlag) -> Result<(), ContractError>;

    /// Get a feature flag by ID.
    async fn get_flag(&self, flag_id: &str) -> Result<Option<FeatureFlag>, ContractError>;

    /// Check if a flag is enabled.
    async fn is_enabled(&self, flag_id: &str) -> Result<bool, ContractError>;

    /// Get flag value.
    async fn get_value(&self, flag_id: &str) -> Result<Option<FlagValue>, ContractError>;

    /// Enable a flag.
    async fn enable_flag(&self, flag_id: &str) -> Result<(), ContractError>;

    /// Disable a flag.
    async fn disable_flag(&self, flag_id: &str) -> Result<(), ContractError>;

    /// List all flags.
    async fn list_flags(&self) -> Result<Vec<FeatureFlag>, ContractError>;
}
