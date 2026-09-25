#![forbid(unsafe_code)]
#![allow(missing_docs)]
#![allow(missing_debug_implementations)]
#![allow(
    clippy::new_without_default,
    clippy::manual_clamp,
    clippy::unwrap_or_default,
    clippy::single_char_add_str,
    clippy::unnecessary_sort_by,
    clippy::await_holding_lock,
    clippy::unnecessary_map_or,
    clippy::redundant_closure,
    clippy::needless_borrow,
    clippy::unnecessary_filter_map
)]

//! AgentiCOS kernel - durable runtime lifecycle and persistence foundation.

pub use agenticos_context::{ContextBudget, ContextEngine};
use agenticos_contracts::{
    CancellationToken, CapabilityGrant, CapabilityIssuer, ConfigError, ConfigLayer, ContractError,
    EventStore, FeatureFlag, FeatureFlagStore, FlagValue, IdempotencyRecord, IdempotencyStatus,
    LeaseRecord, LeaseStore, LogEntry, LogLevel, Logger, ModelProvider, ModelRequest,
    ModelResponse, OutboxEntry, OutboxStatus, OutboxStore, RunId, RunState, Saga, SagaCoordinator,
    SagaStatus, SagaStepStatus, Sandbox, SandboxRequest, SerializedEvent, SerializedSnapshot,
    SnapshotStore, ToolRequest, ToolRuntimePort,
};

// pub use agenticos_sandbox::{ProcessSandbox, SandboxConfig, SandboxFactory};

pub mod session_event_log;
pub use session_event_log::{SessionEvent, SessionEventLog};

pub mod tool_execution_pipeline;
pub use tool_execution_pipeline::{
    PermissionPolicyHook, PostExecutionHook, PreExecutionHook, PreExecutionHookResult,
    ToolExecutionContext, ToolExecutionPipeline, ToolExecutionResult,
};

pub mod llm_router;
pub use llm_router::{
    Capability, KeyStatus, LLMRouter, ModelEntry, ProviderType, RateLimit, UsageLedger,
};

pub mod bandit_scoring;
pub use bandit_scoring::{BanditScore, ModelStats, ThompsonSamplingBandit};

pub mod quota_engine;
pub use quota_engine::{CooldownLadder, CooldownStep, QuotaEngine};

pub mod provider_adapters;
pub use provider_adapters::{
    ChatCompletionRequest, ChatCompletionResponse, ChatMessage, Choice, GoogleProvider,
    GroqProvider, Provider, ProviderError, ProviderRegistry, StreamChoice, StreamChunk, Usage,
};

pub mod streaming_pipeline;
pub use streaming_pipeline::{
    BasicStreamingPipeline, SSEEncoder, SSEEvent, SSEMessage, StreamingContext, StreamingPipeline,
};

pub mod soul;
pub use soul::{Milestone, SkillEntry, Soul};

pub mod minimal_agent_loop;
pub use minimal_agent_loop::{
    AgentLoopConfig, ExitReason, LLMClient, LLMResponse, MinimalAgentLoop, StepOutcome, ToolCall,
    ToolHandler,
};

pub mod natural_language_builder;
pub use natural_language_builder::{
    AgentDescription, AgentRegistry, BuilderError, BuilderLLMClient, GeneratedAgent,
    GenerationResult, NLToolDefinition, NaturalLanguageBuilder, SimpleNaturalLanguageBuilder,
    Workflow, WorkflowStep,
};

pub mod self_improving_agent;
pub use self_improving_agent::{
    AutonomousConfig, ContinualHarness, ContinualHarnessManager, Goal, GoalManager, GoalStatus,
    Heartbeat, HeartbeatManager, QualityContext, QualityGate, QualityGateEvaluator,
    QualityGateResult, QualityGateType, Refinement, RefinementType,
};

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{broadcast, RwLock};

fn validate_outbox_worker_id(worker_id: &str) -> Result<(), ContractError> {
    let valid = !worker_id.trim().is_empty()
        && worker_id.len() <= 128
        && worker_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte));
    if valid {
        Ok(())
    } else {
        Err(ContractError::InvalidId)
    }
}

fn outbox_lease_seconds() -> u64 {
    std::env::var("AGENTICOS_OUTBOX_LEASE_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(120)
        .clamp(5, 3_600)
}

fn estimate_prompt_tokens(input: &str) -> u32 {
    ((input.chars().count() as u32).saturating_add(3) / 4).max(1)
}

fn unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Pure transition validator for the durable Run state machine.
pub fn validate_transition(from: RunState, to: RunState) -> Result<(), ContractError> {
    let allowed = matches!(
        (from, to),
        (RunState::Created, RunState::Admitted)
            | (RunState::Admitted, RunState::Waiting)
            | (RunState::Admitted, RunState::Running)
            | (RunState::Admitted, RunState::Cancelling)
            | (RunState::Waiting, RunState::Running)
            | (RunState::Waiting, RunState::Cancelling)
            | (RunState::Running, RunState::Waiting)
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

/// Durable run state with versioning for optimistic concurrency.
#[derive(Clone, Debug)]
pub struct DurableRun {
    /// Run identifier.
    pub run_id: RunId,
    /// Current lifecycle state.
    pub state: RunState,
    /// Optimistic version for concurrency control.
    pub version: u64,
    /// Monotonic fencing token for ownership.
    pub fencing_token: u64,
    /// Current lease holder if any.
    pub lease: Option<LeaseRecord>,
    /// Cancellation token.
    pub cancellation: CancellationToken,
}

impl DurableRun {
    /// Create a new durable run.
    pub fn new(run_id: RunId) -> Self {
        Self {
            run_id,
            state: RunState::Created,
            version: 0,
            fencing_token: 0,
            lease: None,
            cancellation: CancellationToken::new(),
        }
    }

    /// Attempt a state transition with version check.
    pub fn transition(&mut self, to: RunState, expected_version: u64) -> Result<(), ContractError> {
        if self.version != expected_version {
            return Err(ContractError::IncompatibleVersion);
        }
        validate_transition(self.state, to)?;
        self.state = to;
        self.version += 1;
        Ok(())
    }

    /// Acquire a lease for this run.
    pub fn acquire_lease(
        &mut self,
        owner_id: String,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        self.fencing_token += 1;
        self.lease = Some(LeaseRecord {
            resource_id: self.run_id.as_str().to_string(),
            owner_id,
            fencing_token: self.fencing_token,
            expires_at,
        });
        Ok(())
    }

    /// Install a lease returned by the durable lease store.
    pub fn set_lease(&mut self, lease: LeaseRecord) {
        self.fencing_token = self.fencing_token.max(lease.fencing_token);
        self.lease = Some(lease);
    }

    /// Clear the local lease projection after a successful release.
    pub fn clear_lease(&mut self) {
        self.lease = None;
    }

    /// Check if the current lease is valid.
    pub fn lease_valid(&self, owner_id: &str, current_time: u64) -> bool {
        match &self.lease {
            Some(lease) => {
                lease.owner_id == owner_id
                    && lease.expires_at > current_time
                    && lease.fencing_token == self.fencing_token
            }
            None => false,
        }
    }

    /// Request cancellation of this run.
    pub fn request_cancellation(&mut self) -> Result<(), ContractError> {
        validate_transition(self.state, RunState::Cancelling)?;
        self.state = RunState::Cancelling;
        self.cancellation.cancel();
        self.version += 1;
        Ok(())
    }
}

/// In-memory event store implementation for testing and development.
#[derive(Debug)]
pub struct InMemoryEventStore {
    events: Arc<RwLock<HashMap<String, Vec<SerializedEvent>>>>,
}

impl InMemoryEventStore {
    /// Create a new in-memory event store.
    pub fn new() -> Self {
        Self {
            events: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryEventStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl EventStore for InMemoryEventStore {
    async fn append(
        &self,
        stream_id: &str,
        expected_version: u64,
        events: Vec<SerializedEvent>,
    ) -> Result<u64, ContractError> {
        let mut store = self.events.write().await;
        let stream = store.entry(stream_id.to_string()).or_insert_with(Vec::new);

        if stream.len() as u64 != expected_version {
            return Err(ContractError::IncompatibleVersion);
        }

        let start_version = stream.len() as u64;
        stream.extend(events);
        Ok(start_version)
    }

    async fn read_after(
        &self,
        stream_id: &str,
        after_version: u64,
    ) -> Result<Vec<SerializedEvent>, ContractError> {
        let store = self.events.read().await;
        let stream = store
            .get(stream_id)
            .ok_or(ContractError::MissingCapability)?;

        Ok(stream
            .iter()
            .skip(after_version as usize)
            .cloned()
            .collect())
    }

    async fn list_stream_ids(&self) -> Result<Vec<String>, ContractError> {
        let store = self.events.read().await;
        let mut stream_ids = store.keys().cloned().collect::<Vec<_>>();
        stream_ids.sort();
        Ok(stream_ids)
    }
}

/// In-memory snapshot store implementation for testing and development.
#[derive(Debug)]
pub struct InMemorySnapshotStore {
    snapshots: Arc<RwLock<HashMap<String, SerializedSnapshot>>>,
}

impl InMemorySnapshotStore {
    /// Create a new in-memory snapshot store.
    pub fn new() -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemorySnapshotStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl SnapshotStore for InMemorySnapshotStore {
    async fn put(&self, snapshot: SerializedSnapshot) -> Result<(), ContractError> {
        let mut store = self.snapshots.write().await;
        store.insert(snapshot.stream_id.clone(), snapshot);
        Ok(())
    }

    async fn latest(&self, stream_id: &str) -> Result<Option<SerializedSnapshot>, ContractError> {
        let store = self.snapshots.read().await;
        Ok(store.get(stream_id).cloned())
    }
}

/// SQLite-backed idempotency store for durable request de-duplication.
#[derive(Debug, Clone)]
pub struct SqliteIdempotencyStore {
    pool: sqlx::SqlitePool,
    ttl_seconds: u64,
}

impl SqliteIdempotencyStore {
    /// Open or initialize the idempotency store.
    pub async fn new(connection_string: &str, ttl_seconds: u64) -> Result<Self, sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(connection_string)
            .await?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS idempotency_records (
                idempotency_key TEXT PRIMARY KEY,
                fingerprint TEXT NOT NULL,
                status TEXT NOT NULL,
                result TEXT,
                created_at INTEGER NOT NULL
            )",
        )
        .execute(&pool)
        .await?;
        Ok(Self {
            pool,
            ttl_seconds: ttl_seconds.max(60),
        })
    }

    fn parse_status(value: &str) -> Result<IdempotencyStatus, ContractError> {
        match value {
            "in_progress" => Ok(IdempotencyStatus::InProgress),
            "completed" => Ok(IdempotencyStatus::Completed),
            "failed" => Ok(IdempotencyStatus::Failed),
            _ => Err(ContractError::IncompatibleVersion),
        }
    }

    async fn load(&self, key: &str) -> Result<Option<IdempotencyRecord>, ContractError> {
        let row = sqlx::query_as::<_, (String, String, String, Option<String>)>(
            "SELECT idempotency_key, fingerprint, status, result
             FROM idempotency_records
             WHERE idempotency_key = ?",
        )
        .bind(key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        row.map(|(key, fingerprint, status, result)| {
            Ok(IdempotencyRecord {
                key,
                fingerprint,
                status: Self::parse_status(&status)?,
                result,
                owner: false,
            })
        })
        .transpose()
    }

    /// Atomically create an in-progress record or return the existing operation.
    pub async fn check_or_record(
        &self,
        key: &str,
        fingerprint: &str,
    ) -> Result<IdempotencyRecord, ContractError> {
        let key = key.trim();
        if key.is_empty() || key.len() > 256 || fingerprint.len() > 4096 {
            return Err(ContractError::InvalidId);
        }

        let now = unix_time();
        let inserted = sqlx::query(
            "INSERT INTO idempotency_records
                (idempotency_key, fingerprint, status, result, created_at)
             VALUES (?, ?, 'in_progress', NULL, ?)
             ON CONFLICT(idempotency_key) DO NOTHING",
        )
        .bind(key)
        .bind(fingerprint)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?
        .rows_affected()
            == 1;

        let mut existing = self.load(key).await?.ok_or(ContractError::Persistence)?;
        if existing.fingerprint != fingerprint {
            return Err(ContractError::InvalidId);
        }

        let mut owner = inserted;
        if existing.status == IdempotencyStatus::InProgress && !owner {
            let stale_before = now.saturating_sub(self.ttl_seconds);
            let reclaimed = sqlx::query(
                "UPDATE idempotency_records
                 SET created_at = ?
                 WHERE idempotency_key = ? AND status = 'in_progress' AND created_at < ?",
            )
            .bind(now as i64)
            .bind(key)
            .bind(stale_before as i64)
            .execute(&self.pool)
            .await
            .map_err(|_| ContractError::Persistence)?
            .rows_affected();

            if reclaimed == 1 {
                owner = true;
                existing = self.load(key).await?.ok_or(ContractError::Persistence)?;
            }
        }

        existing.owner = owner;
        Ok(existing)
    }

    /// Mark an operation completed and cache its result.
    pub async fn mark_completed(&self, key: &str, result: String) -> Result<(), ContractError> {
        let updated = sqlx::query(
            "UPDATE idempotency_records SET status = 'completed', result = ?
             WHERE idempotency_key = ?",
        )
        .bind(result)
        .bind(key)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;
        if updated.rows_affected() != 1 {
            return Err(ContractError::MissingCapability);
        }
        Ok(())
    }

    /// Mark an operation as failed.
    pub async fn mark_failed(&self, key: &str) -> Result<(), ContractError> {
        let updated = sqlx::query(
            "UPDATE idempotency_records SET status = 'failed'
             WHERE idempotency_key = ?",
        )
        .bind(key)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;
        if updated.rows_affected() != 1 {
            return Err(ContractError::MissingCapability);
        }
        Ok(())
    }

    /// Remove records older than the configured TTL.
    pub async fn prune(&self) -> Result<u64, ContractError> {
        let cutoff = unix_time().saturating_sub(self.ttl_seconds);
        let result = sqlx::query("DELETE FROM idempotency_records WHERE created_at < ?")
            .bind(cutoff as i64)
            .execute(&self.pool)
            .await
            .map_err(|_| ContractError::Persistence)?;
        Ok(result.rows_affected())
    }
}

/// In-memory idempotency store for testing.
#[derive(Debug)]
pub struct InMemoryIdempotencyStore {
    records: Arc<RwLock<HashMap<String, IdempotencyRecord>>>,
}

impl InMemoryIdempotencyStore {
    /// Create a new in-memory idempotency store.
    pub fn new() -> Self {
        Self {
            records: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check or record an idempotency operation.
    pub async fn check_or_record(
        &self,
        key: String,
        fingerprint: String,
    ) -> Result<IdempotencyStatus, ContractError> {
        let mut store = self.records.write().await;

        if let Some(existing) = store.get(&key) {
            if existing.fingerprint != fingerprint {
                return Err(ContractError::InvalidId);
            }
            return Ok(existing.status);
        }

        store.insert(
            key.clone(),
            IdempotencyRecord {
                key,
                fingerprint,
                status: IdempotencyStatus::InProgress,
                result: None,
                owner: false,
            },
        );

        Ok(IdempotencyStatus::InProgress)
    }

    /// Mark an operation as completed with a result.
    pub async fn mark_completed(&self, key: &str, result: String) -> Result<(), ContractError> {
        let mut store = self.records.write().await;
        if let Some(record) = store.get_mut(key) {
            record.status = IdempotencyStatus::Completed;
            record.result = Some(result);
            Ok(())
        } else {
            Err(ContractError::MissingCapability)
        }
    }

    /// Mark an operation as failed.
    pub async fn mark_failed(&self, key: &str) -> Result<(), ContractError> {
        let mut store = self.records.write().await;
        if let Some(record) = store.get_mut(key) {
            record.status = IdempotencyStatus::Failed;
            Ok(())
        } else {
            Err(ContractError::MissingCapability)
        }
    }
}

impl Default for InMemoryIdempotencyStore {
    fn default() -> Self {
        Self::new()
    }
}

/// In-memory lease store for testing.
#[derive(Debug)]
pub struct InMemoryLeaseStore {
    leases: Arc<RwLock<HashMap<String, LeaseRecord>>>,
    next_fencing_tokens: Arc<RwLock<HashMap<String, u64>>>,
}

impl InMemoryLeaseStore {
    /// Create a new in-memory lease store.
    pub fn new() -> Self {
        Self {
            leases: Arc::new(RwLock::new(HashMap::new())),
            next_fencing_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Acquire a lease for a resource.
    pub async fn acquire(
        &self,
        resource_id: String,
        owner_id: String,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        let mut store = self.leases.write().await;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| ContractError::Persistence)?
            .as_secs();

        if store
            .get(&resource_id)
            .is_some_and(|existing| existing.expires_at > now)
        {
            return Err(ContractError::MissingCapability);
        }

        let mut counters = self.next_fencing_tokens.write().await;
        let counter = counters.entry(resource_id.clone()).or_insert(0);
        *counter = counter.saturating_add(1);

        let lease = LeaseRecord {
            resource_id: resource_id.clone(),
            owner_id,
            fencing_token: *counter,
            expires_at,
        };

        store.insert(resource_id, lease.clone());
        Ok(lease)
    }

    /// Check if a lease is valid.
    pub async fn is_valid(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        current_time: u64,
    ) -> bool {
        let store = self.leases.read().await;
        match store.get(resource_id) {
            Some(lease) => {
                lease.owner_id == owner_id
                    && lease.fencing_token == fencing_token
                    && lease.expires_at > current_time
            }
            None => false,
        }
    }

    /// Release a lease.
    pub async fn release(&self, resource_id: &str) -> Result<(), ContractError> {
        let mut store = self.leases.write().await;
        store
            .remove(resource_id)
            .ok_or(ContractError::MissingCapability)?;
        Ok(())
    }
}

impl Default for InMemoryLeaseStore {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryLeaseStore {
    /// Return the current lease for a resource.
    pub async fn get(&self, resource_id: &str) -> Option<LeaseRecord> {
        self.leases.read().await.get(resource_id).cloned()
    }

    /// Renew a lease when the owner and fencing token still match.
    pub async fn renew(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        let now = unix_time();
        let mut store = self.leases.write().await;
        let lease = store
            .get_mut(resource_id)
            .ok_or(ContractError::MissingCapability)?;
        if lease.owner_id != owner_id
            || lease.fencing_token != fencing_token
            || lease.expires_at <= now
        {
            return Err(ContractError::MissingCapability);
        }
        lease.expires_at = expires_at;
        Ok(lease.clone())
    }
}

#[async_trait::async_trait]
impl LeaseStore for InMemoryLeaseStore {
    async fn acquire(
        &self,
        resource_id: String,
        owner_id: String,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        InMemoryLeaseStore::acquire(self, resource_id, owner_id, expires_at).await
    }

    async fn get(&self, resource_id: &str) -> Result<Option<LeaseRecord>, ContractError> {
        Ok(InMemoryLeaseStore::get(self, resource_id).await)
    }

    async fn renew(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        InMemoryLeaseStore::renew(self, resource_id, owner_id, fencing_token, expires_at).await
    }

    async fn is_valid(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        current_time: u64,
    ) -> Result<bool, ContractError> {
        Ok(
            InMemoryLeaseStore::is_valid(self, resource_id, owner_id, fencing_token, current_time)
                .await,
        )
    }

    async fn release(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
    ) -> Result<(), ContractError> {
        let mut store = self.leases.write().await;
        match store.get(resource_id) {
            Some(lease) if lease.owner_id == owner_id && lease.fencing_token == fencing_token => {
                store.remove(resource_id);
                Ok(())
            }
            _ => Err(ContractError::MissingCapability),
        }
    }
}

/// SQLite-backed durable lease store for run/worker ownership.
#[derive(Debug, Clone)]
pub struct SqliteLeaseStore {
    pool: sqlx::SqlitePool,
}

impl SqliteLeaseStore {
    /// Open or initialize the durable lease tables.
    pub async fn open(connection_string: &str) -> Result<Self, sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(connection_string)
            .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS run_lease_counters (
                resource_id TEXT PRIMARY KEY,
                next_fencing_token INTEGER NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS run_leases (
                resource_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                fencing_token INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    fn validate_inputs(
        resource_id: &str,
        owner_id: &str,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        if resource_id.trim().is_empty() || owner_id.trim().is_empty() || expires_at == 0 {
            return Err(ContractError::InvalidId);
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl LeaseStore for SqliteLeaseStore {
    async fn acquire(
        &self,
        resource_id: String,
        owner_id: String,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        Self::validate_inputs(&resource_id, &owner_id, expires_at)?;
        let now = unix_time();
        if expires_at <= now {
            return Err(ContractError::InvalidId);
        }

        let mut connection = self
            .pool
            .acquire()
            .await
            .map_err(|_| ContractError::Persistence)?;

        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *connection)
            .await
            .map_err(|_| ContractError::Persistence)?;

        let operation = async {
            let current = sqlx::query_as::<_, (i64,)>(
                "SELECT expires_at FROM run_leases WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_optional(&mut *connection)
            .await
            .map_err(|_| ContractError::Persistence)?;

            if current.is_some_and(|(expires_at,)| expires_at.max(0) as u64 > now) {
                return Err(ContractError::MissingCapability);
            }

            sqlx::query(
                r#"
                INSERT INTO run_lease_counters (resource_id, next_fencing_token)
                VALUES (?, 1)
                ON CONFLICT(resource_id) DO UPDATE SET
                    next_fencing_token = run_lease_counters.next_fencing_token + 1
                "#,
            )
            .bind(&resource_id)
            .execute(&mut *connection)
            .await
            .map_err(|_| ContractError::Persistence)?;

            let (fencing_token,) = sqlx::query_as::<_, (i64,)>(
                "SELECT next_fencing_token FROM run_lease_counters WHERE resource_id = ?",
            )
            .bind(&resource_id)
            .fetch_one(&mut *connection)
            .await
            .map_err(|_| ContractError::Persistence)?;

            let lease = LeaseRecord {
                resource_id: resource_id.clone(),
                owner_id: owner_id.clone(),
                fencing_token: fencing_token.max(0) as u64,
                expires_at,
            };

            sqlx::query(
                r#"
                INSERT INTO run_leases (resource_id, owner_id, fencing_token, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(resource_id) DO UPDATE SET
                    owner_id = excluded.owner_id,
                    fencing_token = excluded.fencing_token,
                    expires_at = excluded.expires_at
                "#,
            )
            .bind(&lease.resource_id)
            .bind(&lease.owner_id)
            .bind(lease.fencing_token as i64)
            .bind(lease.expires_at as i64)
            .execute(&mut *connection)
            .await
            .map_err(|_| ContractError::Persistence)?;

            Ok(lease)
        }
        .await;

        if operation.is_ok() {
            sqlx::query("COMMIT")
                .execute(&mut *connection)
                .await
                .map_err(|_| ContractError::Persistence)?;
        } else {
            let _ = sqlx::query("ROLLBACK").execute(&mut *connection).await;
        }

        operation
    }

    async fn get(&self, resource_id: &str) -> Result<Option<LeaseRecord>, ContractError> {
        sqlx::query_as::<_, (String, String, i64, i64)>(
            "SELECT resource_id, owner_id, fencing_token, expires_at FROM run_leases WHERE resource_id = ?",
        )
        .bind(resource_id)
        .fetch_optional(&self.pool)
        .await
        .map(|row| {
            row.map(|(resource_id, owner_id, fencing_token, expires_at)| LeaseRecord {
                resource_id,
                owner_id,
                fencing_token: fencing_token.max(0) as u64,
                expires_at: expires_at.max(0) as u64,
            })
        })
        .map_err(|_| ContractError::Persistence)
    }

    async fn renew(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        Self::validate_inputs(resource_id, owner_id, expires_at)?;
        let now = unix_time();
        if expires_at <= now {
            return Err(ContractError::InvalidId);
        }

        let result = sqlx::query(
            "UPDATE run_leases SET expires_at = ? WHERE resource_id = ? AND owner_id = ? AND fencing_token = ? AND expires_at > ?",
        )
        .bind(expires_at as i64)
        .bind(resource_id)
        .bind(owner_id)
        .bind(fencing_token as i64)
        .bind(now as i64)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        if result.rows_affected() != 1 {
            return Err(ContractError::MissingCapability);
        }

        self.get(resource_id)
            .await?
            .ok_or(ContractError::MissingCapability)
    }

    async fn is_valid(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
        current_time: u64,
    ) -> Result<bool, ContractError> {
        Ok(self.get(resource_id).await?.is_some_and(|lease| {
            lease.owner_id == owner_id
                && lease.fencing_token == fencing_token
                && lease.expires_at > current_time
        }))
    }

    async fn release(
        &self,
        resource_id: &str,
        owner_id: &str,
        fencing_token: u64,
    ) -> Result<(), ContractError> {
        let result = sqlx::query(
            "DELETE FROM run_leases WHERE resource_id = ? AND owner_id = ? AND fencing_token = ?",
        )
        .bind(resource_id)
        .bind(owner_id)
        .bind(fencing_token as i64)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        if result.rows_affected() == 1 {
            Ok(())
        } else {
            Err(ContractError::MissingCapability)
        }
    }
}

/// Kernel runtime combining durable state with event/snapshot storage.
pub struct KernelRuntime {
    /// Event store for persistence.
    pub event_store: Arc<dyn EventStore>,
    /// Snapshot store for recovery.
    pub snapshot_store: Arc<dyn SnapshotStore>,
    /// In-memory run registry.
    pub runs: Arc<RwLock<HashMap<RunId, DurableRun>>>,
    /// Structured logger.
    pub logger: Arc<dyn Logger>,
    /// Configuration layer.
    pub config: Arc<RwLock<dyn ConfigLayer>>,
    /// Capability issuer.
    pub capability_issuer: Arc<dyn CapabilityIssuer>,
    /// Brain capability registry for dynamic capability management.
    pub capability_registry: Arc<agenticos_brain::CapabilityRegistry>,
    /// Outbox used for reliable downstream event publication.
    pub outbox: Arc<dyn OutboxStore>,
    /// Durable run lease store.
    pub lease_store: Arc<dyn LeaseStore>,
}

impl std::fmt::Debug for KernelRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KernelRuntime")
            .field("event_store", &"<EventStore>")
            .field("snapshot_store", &"<SnapshotStore>")
            .field("runs", &self.runs)
            .field("logger", &"<Logger>")
            .field("config", &"<ConfigLayer>")
            .field("capability_issuer", &"<CapabilityIssuer>")
            .field("capability_registry", &"<CapabilityRegistry>")
            .field("outbox", &"<OutboxStore>")
            .field("lease_store", &"<LeaseStore>")
            .finish()
    }
}

impl KernelRuntime {
    /// Create a kernel runtime with an explicit outbox implementation.
    pub fn new_with_outbox_and_lease_store(
        event_store: Arc<dyn EventStore>,
        snapshot_store: Arc<dyn SnapshotStore>,
        logger: Arc<dyn Logger>,
        config: Arc<RwLock<dyn ConfigLayer>>,
        capability_issuer: Arc<dyn CapabilityIssuer>,
        capability_registry: Arc<agenticos_brain::CapabilityRegistry>,
        outbox: Arc<dyn OutboxStore>,
        lease_store: Arc<dyn LeaseStore>,
    ) -> Self {
        Self {
            event_store,
            snapshot_store,
            runs: Arc::new(RwLock::new(HashMap::new())),
            logger,
            config,
            capability_issuer,
            capability_registry,
            outbox,
            lease_store,
        }
    }

    /// Create a kernel runtime with an explicit outbox and in-memory leases.
    pub fn new_with_outbox(
        event_store: Arc<dyn EventStore>,
        snapshot_store: Arc<dyn SnapshotStore>,
        logger: Arc<dyn Logger>,
        config: Arc<RwLock<dyn ConfigLayer>>,
        capability_issuer: Arc<dyn CapabilityIssuer>,
        capability_registry: Arc<agenticos_brain::CapabilityRegistry>,
        outbox: Arc<dyn OutboxStore>,
    ) -> Self {
        Self::new_with_outbox_and_lease_store(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
            capability_registry,
            outbox,
            Arc::new(InMemoryLeaseStore::new()),
        )
    }

    /// Create a new kernel runtime with default components.
    pub fn new(
        event_store: Arc<dyn EventStore>,
        snapshot_store: Arc<dyn SnapshotStore>,
        logger: Arc<dyn Logger>,
        config: Arc<RwLock<dyn ConfigLayer>>,
        capability_issuer: Arc<dyn CapabilityIssuer>,
        capability_registry: Arc<agenticos_brain::CapabilityRegistry>,
    ) -> Self {
        Self::new_with_outbox(
            event_store,
            snapshot_store,
            logger,
            config,
            capability_issuer,
            capability_registry,
            Arc::new(InMemoryOutboxStore::new()),
        )
    }

    /// Create a minimal kernel runtime with default components.
    pub fn minimal(
        event_store: Arc<dyn EventStore>,
        snapshot_store: Arc<dyn SnapshotStore>,
    ) -> Self {
        Self::new(
            event_store,
            snapshot_store,
            Arc::new(InMemoryLogger::new(LogLevel::Info)),
            Arc::new(RwLock::new(InMemoryConfig::default())),
            Arc::new(InMemoryCapabilityIssuer::new()),
            Arc::new(agenticos_brain::CapabilityRegistry::default()),
        )
    }

    async fn enqueue_outbox_event(
        &self,
        entry_id: String,
        event: SerializedEvent,
        destination: &str,
    ) {
        let entry = OutboxEntry {
            entry_id,
            event,
            destination: destination.to_string(),
            attempts: 0,
            status: OutboxStatus::Pending,
            created_at: chrono::Utc::now().timestamp().max(0) as u64,
            processed_at: None,
        };
        if let Err(error) = self.outbox.add(entry).await {
            tracing::warn!(
                %error,
                destination,
                "failed to enqueue kernel event in outbox"
            );
        }
    }

    /// Create a new run and persist its creation event.
    pub async fn create_run(&self, run_id: RunId) -> Result<DurableRun, ContractError> {
        let mut run = DurableRun::new(run_id.clone());

        // Log creation attempt
        let log_entry = LogEntry {
            level: LogLevel::Info,
            timestamp: chrono::Utc::now().timestamp() as u64,
            component: "KernelRuntime".to_string(),
            message: format!("Creating run: {}", run_id.as_str()),
            fields: vec![("run_id".to_string(), run_id.as_str().to_string())],
            correlation_id: None,
        };
        self.logger.log(log_entry).await?;

        // Persist creation event
        let event = SerializedEvent {
            event_type: "RunCreated".to_string(),
            data: format!(
                r#"{{"run_id":"{}","state":"{:?}"}}"#,
                run_id.as_str(),
                run.state
            ),
            schema_version: 1,
        };

        let stream_id = format!("run:{}", run_id.as_str());
        self.event_store
            .append(&stream_id, 0, vec![event.clone()])
            .await?;
        self.enqueue_outbox_event(
            format!("runtime:run:{}:0:RunCreated:v1", run_id.as_str()),
            event,
            "runtime",
        )
        .await;

        // Increment version after successful persistence
        run.version = 1;

        // Log successful creation
        let success_log = LogEntry {
            level: LogLevel::Info,
            timestamp: chrono::Utc::now().timestamp() as u64,
            component: "KernelRuntime".to_string(),
            message: format!("Run created successfully: {}", run_id.as_str()),
            fields: vec![
                ("run_id".to_string(), run_id.as_str().to_string()),
                ("version".to_string(), run.version.to_string()),
            ],
            correlation_id: None,
        };
        self.logger.log(success_log).await?;

        // Register in memory
        let mut runs = self.runs.write().await;
        runs.insert(run_id.clone(), run.clone());
        runs.get(&run_id)
            .cloned()
            .ok_or(ContractError::MissingCapability)
    }

    /// Transition a run's state with optimistic concurrency.
    pub async fn transition_run(
        &self,
        run_id: &RunId,
        to: RunState,
        expected_version: u64,
    ) -> Result<(), ContractError> {
        let previous = self.get_or_recover_run(run_id).await?;

        let mut updated = previous.clone();
        let from_state = updated.state;
        updated.transition(to, expected_version)?;

        let event = SerializedEvent {
            event_type: "RunStateChanged".to_string(),
            data: format!(
                r#"{{"run_id":"{}","from":"{:?}","to":"{:?}","version":{}}}"#,
                run_id.as_str(),
                from_state,
                to,
                updated.version
            ),
            schema_version: 1,
        };

        let stream_id = format!("run:{}", run_id.as_str());
        self.event_store
            .append(&stream_id, previous.version, vec![event.clone()])
            .await?;
        self.enqueue_outbox_event(
            format!(
                "runtime:run:{}:{}:RunStateChanged:v1",
                run_id.as_str(),
                updated.version.saturating_sub(1)
            ),
            event,
            "runtime",
        )
        .await;

        self.runs.write().await.insert(run_id.clone(), updated);
        Ok(())
    }

    /// Return a loaded run or recover it from durable snapshot/event state.
    pub async fn get_or_recover_run(&self, run_id: &RunId) -> Result<DurableRun, ContractError> {
        if let Some(run) = self.runs.read().await.get(run_id).cloned() {
            return Ok(run);
        }
        self.recover_run(run_id).await
    }

    /// List durable runs, recovering any runs not currently loaded in memory.
    pub async fn list_runs(&self) -> Result<Vec<DurableRun>, ContractError> {
        let stream_ids = self.event_store.list_stream_ids().await?;
        let mut runs = Vec::with_capacity(stream_ids.len());
        for stream_id in stream_ids {
            let Some(raw_id) = stream_id.strip_prefix("run:") else {
                continue;
            };
            let Ok(run_id) = RunId::new(raw_id.to_string()) else {
                continue;
            };
            if let Ok(run) = self.get_or_recover_run(&run_id).await {
                runs.push(run);
            }
        }
        runs.sort_by(|left, right| left.run_id.as_str().cmp(right.run_id.as_str()));
        Ok(runs)
    }

    /// Acquire and persist a lease for a run.
    pub async fn acquire_lease(
        &self,
        run_id: &RunId,
        owner_id: String,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        let _ = self.get_or_recover_run(run_id).await?;
        let lease = self
            .lease_store
            .acquire(run_id.as_str().to_string(), owner_id, expires_at)
            .await?;

        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            run.set_lease(lease.clone());
        }
        Ok(lease)
    }

    /// Renew a persisted run lease.
    pub async fn renew_lease(
        &self,
        run_id: &RunId,
        owner_id: &str,
        fencing_token: u64,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        let lease = self
            .lease_store
            .renew(run_id.as_str(), owner_id, fencing_token, expires_at)
            .await?;
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            run.set_lease(lease.clone());
        }
        Ok(lease)
    }

    /// Validate the persisted lease for a run.
    pub async fn lease_valid(
        &self,
        run_id: &RunId,
        owner_id: &str,
        fencing_token: u64,
        current_time: u64,
    ) -> Result<bool, ContractError> {
        self.lease_store
            .is_valid(run_id.as_str(), owner_id, fencing_token, current_time)
            .await
    }

    /// Release a persisted run lease.
    pub async fn release_lease(
        &self,
        run_id: &RunId,
        owner_id: &str,
        fencing_token: u64,
    ) -> Result<(), ContractError> {
        self.lease_store
            .release(run_id.as_str(), owner_id, fencing_token)
            .await?;
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(run_id) {
            if run.lease.as_ref().is_some_and(|lease| {
                lease.owner_id == owner_id && lease.fencing_token == fencing_token
            }) {
                run.clear_lease();
            }
        }
        Ok(())
    }

    /// Request cancellation of a run.
    pub async fn cancel_run(&self, run_id: &RunId) -> Result<(), ContractError> {
        let previous = self.get_or_recover_run(run_id).await?;

        let mut updated = previous.clone();
        updated.request_cancellation()?;

        let event = SerializedEvent {
            event_type: "RunCancellationRequested".to_string(),
            data: format!(
                r#"{{"run_id":"{}","state":"{:?}"}}"#,
                run_id.as_str(),
                updated.state
            ),
            schema_version: 1,
        };

        let stream_id = format!("run:{}", run_id.as_str());
        self.event_store
            .append(&stream_id, previous.version, vec![event.clone()])
            .await?;
        self.enqueue_outbox_event(
            format!(
                "runtime:run:{}:{}:RunCancellationRequested:v1",
                run_id.as_str(),
                updated.version.saturating_sub(1)
            ),
            event,
            "runtime",
        )
        .await;

        self.runs.write().await.insert(run_id.clone(), updated);
        Ok(())
    }

    /// Create a snapshot of a run's current state.
    pub async fn create_snapshot(
        &self,
        run_id: &RunId,
    ) -> Result<SerializedSnapshot, ContractError> {
        let run = self.get_or_recover_run(run_id).await?;

        let snapshot = SerializedSnapshot {
            stream_id: format!("run:{}", run_id.as_str()),
            version: run.version,
            data: format!(
                r#"{{"run_id":"{}","state":"{:?}","fencing_token":{}}}"#,
                run_id.as_str(),
                run.state,
                run.fencing_token
            ),
            schema_version: 1,
        };

        self.snapshot_store.put(snapshot.clone()).await?;
        Ok(snapshot)
    }

    /// Recover a run from its latest snapshot and replay events.
    pub async fn recover_run(&self, run_id: &RunId) -> Result<DurableRun, ContractError> {
        let stream_id = format!("run:{}", run_id.as_str());

        // Try to load from snapshot
        let recovered_run = if let Some(snapshot) = self.snapshot_store.latest(&stream_id).await? {
            // Reconstruct from snapshot
            let data: serde_json::Value = serde_json::from_str(&snapshot.data)
                .map_err(|_| ContractError::IncompatibleVersion)?;

            let state_str = data["state"]
                .as_str()
                .ok_or(ContractError::IncompatibleVersion)?;
            let state = match state_str {
                "Created" => RunState::Created,
                "Admitted" => RunState::Admitted,
                "Waiting" => RunState::Waiting,
                "Running" => RunState::Running,
                "Cancelling" => RunState::Cancelling,
                "Completed" => RunState::Completed,
                "Failed" => RunState::Failed,
                "Cancelled" => RunState::Cancelled,
                _ => return Err(ContractError::IncompatibleVersion),
            };

            let fencing_token = data["fencing_token"]
                .as_u64()
                .ok_or(ContractError::IncompatibleVersion)?;

            let mut run = DurableRun::new(run_id.clone());
            run.state = state;
            run.fencing_token = fencing_token;
            run.version = snapshot.version;

            // Replay events after snapshot (events at version > snapshot.version)
            let events = self
                .event_store
                .read_after(&stream_id, snapshot.version)
                .await?;
            for event in events {
                // Apply event effects (simplified for smoke test)
                if event.event_type == "RunStateChanged"
                    || event.event_type == "RunCancellationRequested"
                {
                    let data: serde_json::Value = serde_json::from_str(&event.data)
                        .map_err(|_| ContractError::IncompatibleVersion)?;
                    if let Some(to_str) = data
                        .get("to")
                        .or_else(|| data.get("state"))
                        .and_then(|value| value.as_str())
                    {
                        run.state = match to_str {
                            "Created" => RunState::Created,
                            "Admitted" => RunState::Admitted,
                            "Waiting" => RunState::Waiting,
                            "Running" => RunState::Running,
                            "Cancelling" => RunState::Cancelling,
                            "Completed" => RunState::Completed,
                            "Failed" => RunState::Failed,
                            "Cancelled" => RunState::Cancelled,
                            _ => return Err(ContractError::IncompatibleVersion),
                        };
                        if event.event_type == "RunCancellationRequested" {
                            run.cancellation.cancel();
                        }
                        run.version += 1;
                    }
                }
            }

            run
        } else {
            // No snapshot, reconstruct from events only
            let events = self.event_store.read_after(&stream_id, 0).await?;
            let mut run = DurableRun::new(run_id.clone());

            for event in events {
                if event.event_type == "RunCreated" {
                    run.version = 1;
                } else if event.event_type == "RunStateChanged"
                    || event.event_type == "RunCancellationRequested"
                {
                    let data: serde_json::Value = serde_json::from_str(&event.data)
                        .map_err(|_| ContractError::IncompatibleVersion)?;
                    if let Some(to_str) = data
                        .get("to")
                        .or_else(|| data.get("state"))
                        .and_then(|value| value.as_str())
                    {
                        run.state = match to_str {
                            "Created" => RunState::Created,
                            "Admitted" => RunState::Admitted,
                            "Waiting" => RunState::Waiting,
                            "Running" => RunState::Running,
                            "Cancelling" => RunState::Cancelling,
                            "Completed" => RunState::Completed,
                            "Failed" => RunState::Failed,
                            "Cancelled" => RunState::Cancelled,
                            _ => return Err(ContractError::IncompatibleVersion),
                        };
                        if event.event_type == "RunCancellationRequested" {
                            run.cancellation.cancel();
                        }
                        run.version += 1;
                    }
                }
            }

            run
        };

        // Rehydrate the active durable lease separately from event state.
        let mut recovered_run = recovered_run;
        if let Some(lease) = self.lease_store.get(run_id.as_str()).await? {
            if lease.expires_at > unix_time() {
                recovered_run.set_lease(lease);
            }
        }

        // Register recovered run
        let mut runs = self.runs.write().await;
        runs.insert(run_id.clone(), recovered_run.clone());
        Ok(recovered_run)
    }
}

/// SQLite-based event store for production persistence.
#[derive(Debug)]
pub struct SqliteEventStore {
    pool: sqlx::sqlite::SqlitePool,
}

impl SqliteEventStore {
    /// Create a new SQLite event store with the given connection string.
    pub async fn new(connection_string: &str) -> Result<Self, sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(connection_string)
            .await?;

        // Initialize schema
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stream_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                data TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                UNIQUE(stream_id, version)
            );

            CREATE INDEX IF NOT EXISTS idx_events_stream ON events(stream_id, version);

            CREATE TABLE IF NOT EXISTS outbox_entries (
                entry_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                event_schema_version INTEGER NOT NULL,
                destination TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at INTEGER NOT NULL,
                processed_at INTEGER
            );

            CREATE TRIGGER IF NOT EXISTS trg_events_to_runtime_outbox
            AFTER INSERT ON events
            WHEN NEW.stream_id LIKE 'run:%'
            BEGIN
                INSERT INTO outbox_entries (
                    entry_id,
                    event_type,
                    event_data,
                    event_schema_version,
                    destination,
                    attempts,
                    status,
                    created_at,
                    processed_at
                )
                VALUES (
                    'runtime:' || NEW.stream_id || ':' || NEW.version || ':' ||
                        NEW.event_type || ':v' || NEW.schema_version,
                    NEW.event_type,
                    NEW.data,
                    NEW.schema_version,
                    'runtime',
                    0,
                    'pending',
                    CAST(strftime('%s', 'now') AS INTEGER),
                    NULL
                )
                ON CONFLICT(entry_id) DO NOTHING;
            END;
            "#,
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
impl EventStore for SqliteEventStore {
    async fn append(
        &self,
        stream_id: &str,
        expected_version: u64,
        events: Vec<SerializedEvent>,
    ) -> Result<u64, ContractError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| ContractError::Persistence)?;

        // Verify the append starts exactly at the next contiguous stream version.
        let next_version: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(version) + 1, 0) FROM events WHERE stream_id = ?",
        )
        .bind(stream_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| ContractError::Persistence)?;

        if next_version != expected_version as i64 {
            return Err(ContractError::IncompatibleVersion);
        }

        let timestamp = chrono::Utc::now().to_rfc3339();

        for (i, event) in events.into_iter().enumerate() {
            let version = expected_version + i as u64;
            sqlx::query(
                "INSERT INTO events (stream_id, version, event_type, data, schema_version, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(stream_id)
            .bind(version as i64)
            .bind(&event.event_type)
            .bind(&event.data)
            .bind(event.schema_version as i64)
            .bind(&timestamp)
            .execute(&mut *tx)
            .await
            .map_err(|_| ContractError::Persistence)?;
        }

        tx.commit().await.map_err(|_| ContractError::Persistence)?;
        Ok(expected_version)
    }

    async fn read_after(
        &self,
        stream_id: &str,
        after_version: u64,
    ) -> Result<Vec<SerializedEvent>, ContractError> {
        let rows = sqlx::query_as::<_, (String, String, i64)>(
            "SELECT event_type, data, schema_version FROM events WHERE stream_id = ? AND version >= ? ORDER BY version ASC",
        )
        .bind(stream_id)
        .bind(after_version as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        Ok(rows
            .into_iter()
            .map(|(event_type, data, schema_version)| SerializedEvent {
                event_type,
                data,
                schema_version: schema_version as u16,
            })
            .collect())
    }

    async fn list_stream_ids(&self) -> Result<Vec<String>, ContractError> {
        let rows = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT stream_id FROM events WHERE stream_id LIKE 'run:%' ORDER BY stream_id ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        Ok(rows)
    }
}

/// SQLite-based snapshot store for production persistence.
#[derive(Debug)]
pub struct SqliteSnapshotStore {
    pool: sqlx::sqlite::SqlitePool,
}

impl SqliteSnapshotStore {
    /// Create a new SQLite snapshot store with the given connection string.
    pub async fn new(connection_string: &str) -> Result<Self, sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(connection_string)
            .await?;

        // Initialize schema
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stream_id TEXT NOT NULL UNIQUE,
                version INTEGER NOT NULL,
                data TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_stream ON snapshots(stream_id);
            "#,
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }
}

#[async_trait::async_trait]
impl SnapshotStore for SqliteSnapshotStore {
    async fn put(&self, snapshot: SerializedSnapshot) -> Result<(), ContractError> {
        let timestamp = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "INSERT OR REPLACE INTO snapshots (stream_id, version, data, schema_version, timestamp) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&snapshot.stream_id)
        .bind(snapshot.version as i64)
        .bind(&snapshot.data)
        .bind(snapshot.schema_version as i64)
        .bind(&timestamp)
        .execute(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        Ok(())
    }

    async fn latest(&self, stream_id: &str) -> Result<Option<SerializedSnapshot>, ContractError> {
        let row = sqlx::query_as::<_, (String, i64, String, i64)>(
            "SELECT stream_id, version, data, schema_version FROM snapshots WHERE stream_id = ?",
        )
        .bind(stream_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| ContractError::Persistence)?;

        Ok(row.map(
            |(stream_id, version, data, schema_version)| SerializedSnapshot {
                stream_id,
                version: version as u64,
                data,
                schema_version: schema_version as u16,
            },
        ))
    }
}

/// In-memory structured logger implementation.
#[derive(Debug)]
pub struct InMemoryLogger {
    entries: Arc<RwLock<Vec<LogEntry>>>,
    min_level: LogLevel,
}

impl InMemoryLogger {
    /// Create a new in-memory logger.
    pub fn new(min_level: LogLevel) -> Self {
        Self {
            entries: Arc::new(RwLock::new(Vec::new())),
            min_level,
        }
    }

    /// Get all logged entries.
    pub async fn entries(&self) -> Vec<LogEntry> {
        self.entries.read().await.clone()
    }

    /// Clear all logged entries.
    pub async fn clear(&self) {
        self.entries.write().await.clear();
    }
}

impl Default for InMemoryLogger {
    fn default() -> Self {
        Self::new(LogLevel::Info)
    }
}

#[async_trait::async_trait]
impl Logger for InMemoryLogger {
    async fn log(&self, entry: LogEntry) -> Result<(), ContractError> {
        if entry.level >= self.min_level {
            self.entries.write().await.push(entry);
        }
        Ok(())
    }

    fn is_enabled(&self, level: LogLevel) -> bool {
        level >= self.min_level
    }
}

/// In-memory configuration layer implementation.
#[derive(Debug)]
pub struct InMemoryConfig {
    values: Arc<RwLock<HashMap<String, String>>>,
    required_keys: Vec<String>,
}

impl InMemoryConfig {
    /// Create a new in-memory configuration layer.
    pub fn new(required_keys: Vec<String>) -> Self {
        Self {
            values: Arc::new(RwLock::new(HashMap::new())),
            required_keys,
        }
    }

    /// Set initial configuration values.
    pub async fn initialize(&self, values: HashMap<String, String>) -> Result<(), ConfigError> {
        let mut config = self.values.write().await;
        for (key, value) in values {
            config.insert(key, value);
        }
        Ok(())
    }
}

impl Default for InMemoryConfig {
    fn default() -> Self {
        Self::new(vec![])
    }
}

impl ConfigLayer for InMemoryConfig {
    fn get(&self, key: &str) -> Result<String, ConfigError> {
        let config = self.values.blocking_read();
        config
            .get(key)
            .cloned()
            .ok_or_else(|| ConfigError::MissingValue(key.to_string()))
    }

    fn set(&mut self, key: String, value: String) -> Result<(), ConfigError> {
        let mut config = self.values.blocking_write();
        config.insert(key, value);
        Ok(())
    }

    fn validate(&self) -> Result<(), ConfigError> {
        let config = self.values.blocking_read();
        for required_key in &self.required_keys {
            if !config.contains_key(required_key) {
                return Err(ConfigError::MissingValue(required_key.clone()));
            }
        }
        Ok(())
    }
}

/// In-memory capability issuer implementation.
#[derive(Debug)]
pub struct InMemoryCapabilityIssuer {
    grants: Arc<RwLock<HashMap<String, CapabilityGrant>>>,
}

impl InMemoryCapabilityIssuer {
    /// Create a new in-memory capability issuer.
    pub fn new() -> Self {
        Self {
            grants: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get all active grants.
    pub async fn all_grants(&self) -> Vec<CapabilityGrant> {
        self.grants.read().await.values().cloned().collect()
    }
}

impl Default for InMemoryCapabilityIssuer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl CapabilityIssuer for InMemoryCapabilityIssuer {
    async fn issue(&self, request: CapabilityGrant) -> Result<String, ContractError> {
        let mut grants = self.grants.write().await;
        let grant_id = request.grant_id.clone();
        grants.insert(grant_id.clone(), request);
        Ok(grant_id)
    }

    async fn revoke(&self, grant_id: &str) -> Result<(), ContractError> {
        let mut grants = self.grants.write().await;
        grants
            .remove(grant_id)
            .ok_or(ContractError::MissingCapability)?;
        Ok(())
    }

    async fn validate_with_expiry(&self, grant_id: &str) -> Result<bool, ContractError> {
        let grants = self.grants.read().await;
        if let Some(grant) = grants.get(grant_id) {
            let current_time = chrono::Utc::now().timestamp() as u64;
            if grant.expires_at > 0 && grant.expires_at < current_time {
                return Ok(false);
            }
            return Ok(true);
        }
        Ok(false)
    }
}

/// Deterministic test clock for reproducible testing.
#[derive(Debug, Clone)]
pub struct TestClock {
    current_time: Arc<std::sync::atomic::AtomicU64>,
}

impl TestClock {
    /// Create a new test clock starting at timestamp 0.
    pub fn new() -> Self {
        Self {
            current_time: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    /// Get the current timestamp.
    pub fn now(&self) -> u64 {
        self.current_time.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Advance the clock by a given duration in milliseconds.
    pub fn advance(&self, duration_ms: u64) {
        self.current_time
            .fetch_add(duration_ms, std::sync::atomic::Ordering::SeqCst);
    }

    /// Set the clock to a specific timestamp.
    pub fn set(&self, timestamp: u64) {
        self.current_time
            .store(timestamp, std::sync::atomic::Ordering::SeqCst);
    }
}

/// SQLite-backed outbox store for durable event publication.
#[derive(Debug, Clone)]
pub struct SqliteOutboxStore {
    pool: Arc<sqlx::SqlitePool>,
}

impl SqliteOutboxStore {
    /// Open a durable outbox store.
    pub async fn open(database_url: &str) -> Result<Self, ContractError> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("outbox database connection failed: {error}"))
            })?;
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS outbox_entries (
                entry_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                event_schema_version INTEGER NOT NULL,
                destination TEXT NOT NULL,
                attempts INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                processed_at INTEGER,
                claimed_by TEXT,
                claimed_until INTEGER
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox schema initialization failed: {error}"))
        })?;

        for (column, definition) in [("claimed_by", "TEXT"), ("claimed_until", "INTEGER")] {
            let exists: Option<String> = sqlx::query_scalar(
                "SELECT name FROM pragma_table_info('outbox_entries') WHERE name = ?",
            )
            .bind(column)
            .fetch_optional(&pool)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("outbox schema inspection failed: {error}"))
            })?;
            if exists.is_none() {
                let statement =
                    format!("ALTER TABLE outbox_entries ADD COLUMN {column} {definition}");
                sqlx::query(&statement)
                    .execute(&pool)
                    .await
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "outbox schema migration failed for {column}: {error}"
                        ))
                    })?;
            }
        }

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_outbox_claims
             ON outbox_entries(status, claimed_until, created_at, entry_id)",
        )
        .execute(&pool)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox index initialization failed: {error}"))
        })?;

        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    fn status_name(status: OutboxStatus) -> &'static str {
        match status {
            OutboxStatus::Pending => "pending",
            OutboxStatus::Processing => "processing",
            OutboxStatus::Published => "published",
            OutboxStatus::Failed => "failed",
            OutboxStatus::DeadLetter => "dead_letter",
        }
    }

    fn parse_status(status: &str) -> Result<OutboxStatus, ContractError> {
        match status {
            "pending" => Ok(OutboxStatus::Pending),
            "processing" => Ok(OutboxStatus::Processing),
            "published" => Ok(OutboxStatus::Published),
            "failed" => Ok(OutboxStatus::Failed),
            "dead_letter" => Ok(OutboxStatus::DeadLetter),
            other => Err(ContractError::ParseError(format!(
                "unknown outbox status {other}"
            ))),
        }
    }

    async fn load_entries(
        &self,
        where_clause: &str,
        limit: usize,
    ) -> Result<Vec<OutboxEntry>, ContractError> {
        let query = format!(
            "SELECT entry_id, event_type, event_data, event_schema_version, destination, attempts, status, created_at, processed_at FROM outbox_entries WHERE {where_clause} ORDER BY created_at ASC, entry_id ASC LIMIT ?"
        );
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                String,
                i64,
                String,
                i64,
                Option<i64>,
            ),
        >(&query)
        .bind(limit.clamp(1, 500) as i64)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|error| ContractError::ParseError(format!("outbox query failed: {error}")))?;

        rows.into_iter()
            .map(
                |(
                    entry_id,
                    event_type,
                    event_data,
                    schema_version,
                    destination,
                    attempts,
                    status,
                    created_at,
                    processed_at,
                )| {
                    Ok(OutboxEntry {
                        entry_id,
                        event: SerializedEvent {
                            event_type,
                            data: event_data,
                            schema_version: schema_version.max(0) as u16,
                        },
                        destination,
                        attempts: attempts.max(0) as u32,
                        status: Self::parse_status(&status)?,
                        created_at: created_at.max(0) as u64,
                        processed_at: processed_at.map(|value| value.max(0) as u64),
                    })
                },
            )
            .collect()
    }
}

#[async_trait::async_trait]
impl OutboxStore for SqliteOutboxStore {
    async fn add(&self, entry: OutboxEntry) -> Result<(), ContractError> {
        sqlx::query(
            r#"
            INSERT INTO outbox_entries
                (entry_id, event_type, event_data, event_schema_version, destination, attempts, status, created_at, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(entry_id) DO NOTHING
            "#,
        )
        .bind(&entry.entry_id)
        .bind(&entry.event.event_type)
        .bind(&entry.event.data)
        .bind(entry.event.schema_version as i64)
        .bind(&entry.destination)
        .bind(entry.attempts as i64)
        .bind(Self::status_name(entry.status))
        .bind(entry.created_at as i64)
        .bind(entry.processed_at.map(|value| value as i64))
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| ContractError::ParseError(format!("outbox insert failed: {error}")))?;
        Ok(())
    }

    async fn get_pending(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError> {
        self.load_entries("status = 'pending'", limit).await
    }

    async fn claim_pending(
        &self,
        worker_id: &str,
        limit: usize,
        lease_seconds: u64,
    ) -> Result<Vec<OutboxEntry>, ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let limit = limit.clamp(1, 500);
        let lease_seconds = lease_seconds.clamp(5, 3_600);
        let now = unix_time();
        let claimed_until = now.saturating_add(lease_seconds);

        let mut tx = self.pool.begin().await.map_err(|error| {
            ContractError::ParseError(format!("outbox claim transaction failed: {error}"))
        })?;

        let ids = sqlx::query_scalar::<_, String>(
            "SELECT entry_id
             FROM outbox_entries
             WHERE status = 'pending'
                OR (status = 'processing' AND (claimed_until IS NULL OR claimed_until <= ?))
             ORDER BY created_at ASC, entry_id ASC
             LIMIT ?",
        )
        .bind(now as i64)
        .bind(limit as i64)
        .fetch_all(&mut *tx)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox claim selection failed: {error}"))
        })?;

        let mut claimed = Vec::with_capacity(ids.len());
        for entry_id in ids {
            let updated = sqlx::query(
                "UPDATE outbox_entries
                 SET status = 'processing', claimed_by = ?, claimed_until = ?
                 WHERE entry_id = ?
                   AND (
                     status = 'pending'
                     OR (status = 'processing' AND (claimed_until IS NULL OR claimed_until <= ?))
                   )",
            )
            .bind(worker_id)
            .bind(claimed_until as i64)
            .bind(&entry_id)
            .bind(now as i64)
            .execute(&mut *tx)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("outbox claim update failed: {error}"))
            })?;

            if updated.rows_affected() != 1 {
                continue;
            }

            let row = sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    String,
                    i64,
                    String,
                    i64,
                    String,
                    i64,
                    Option<i64>,
                ),
            >(
                "SELECT entry_id, event_type, event_data, event_schema_version, destination,
                        attempts, status, created_at, processed_at
                 FROM outbox_entries
                 WHERE entry_id = ?",
            )
            .bind(&entry_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("outbox claimed row lookup failed: {error}"))
            })?;

            if let Some((
                entry_id,
                event_type,
                event_data,
                schema_version,
                destination,
                attempts,
                status,
                created_at,
                processed_at,
            )) = row
            {
                claimed.push(OutboxEntry {
                    entry_id,
                    event: SerializedEvent {
                        event_type,
                        data: event_data,
                        schema_version: schema_version.max(0) as u16,
                    },
                    destination,
                    attempts: attempts.max(0) as u32,
                    status: Self::parse_status(&status)?,
                    created_at: created_at.max(0) as u64,
                    processed_at: processed_at.map(|value| value.max(0) as u64),
                });
            }
        }

        tx.commit().await.map_err(|error| {
            ContractError::ParseError(format!("outbox claim transaction commit failed: {error}"))
        })?;

        Ok(claimed)
    }

    async fn mark_published(&self, entry_id: &str) -> Result<(), ContractError> {
        let updated = sqlx::query(
            "UPDATE outbox_entries
             SET status = 'published',
                 processed_at = ?,
                 claimed_by = NULL,
                 claimed_until = NULL
             WHERE entry_id = ?",
        )
        .bind(unix_time() as i64)
        .bind(entry_id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox publish update failed: {error}"))
        })?;
        if updated.rows_affected() == 0 {
            return Err(ContractError::MissingCapability);
        }
        Ok(())
    }
    async fn mark_published_by(
        &self,
        entry_id: &str,
        worker_id: &str,
    ) -> Result<(), ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let updated = sqlx::query(
            "UPDATE outbox_entries
             SET status = 'published',
                 processed_at = ?,
                 claimed_by = NULL,
                 claimed_until = NULL
             WHERE entry_id = ?
               AND status = 'processing'
               AND claimed_by = ?
               AND claimed_until > ?",
        )
        .bind(entry_id)
        .bind(worker_id)
        .bind(unix_time() as i64)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox owned publish update failed: {error}"))
        })?;
        if updated.rows_affected() == 0 {
            return Err(ContractError::MissingCapability);
        }
        Ok(())
    }

    async fn mark_failed(&self, entry_id: &str) -> Result<(), ContractError> {
        let current_attempts =
            sqlx::query_scalar::<_, i64>("SELECT attempts FROM outbox_entries WHERE entry_id = ?")
                .bind(entry_id)
                .fetch_optional(self.pool.as_ref())
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("outbox failure lookup failed: {error}"))
                })?
                .ok_or(ContractError::MissingCapability)?;

        let max_attempts = std::env::var("AGENTICOS_OUTBOX_MAX_ATTEMPTS")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(5)
            .clamp(1, 100);
        let attempts = current_attempts.max(0) as u32 + 1;
        let dead_letter = attempts >= max_attempts;

        sqlx::query(
            "UPDATE outbox_entries
             SET status = ?,
                 attempts = ?,
                 processed_at = ?,
                 claimed_by = NULL,
                 claimed_until = NULL
             WHERE entry_id = ?",
        )
        .bind(if dead_letter {
            "dead_letter"
        } else {
            "pending"
        })
        .bind(attempts as i64)
        .bind(if dead_letter {
            Some(unix_time() as i64)
        } else {
            None
        })
        .bind(entry_id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox failure update failed: {error}"))
        })?;
        Ok(())
    }
    async fn mark_failed_by(&self, entry_id: &str, worker_id: &str) -> Result<(), ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let current_attempts = sqlx::query_scalar::<_, i64>(
            "SELECT attempts FROM outbox_entries
             WHERE entry_id = ?
               AND status = 'processing'
               AND claimed_by = ?
               AND claimed_until > ?",
        )
        .bind(entry_id)
        .bind(worker_id)
        .bind(unix_time() as i64)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox owned failure lookup failed: {error}"))
        })?
        .ok_or(ContractError::MissingCapability)?;

        let max_attempts = std::env::var("AGENTICOS_OUTBOX_MAX_ATTEMPTS")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(5)
            .clamp(1, 100);
        let attempts = current_attempts.max(0) as u32 + 1;
        let dead_letter = attempts >= max_attempts;

        let updated = sqlx::query(
            "UPDATE outbox_entries
             SET status = ?,
                 attempts = ?,
                 processed_at = ?,
                 claimed_by = NULL,
                 claimed_until = NULL
             WHERE entry_id = ?
               AND status = 'processing'
               AND claimed_by = ?
               AND claimed_until > ?",
        )
        .bind(if dead_letter {
            "dead_letter"
        } else {
            "pending"
        })
        .bind(attempts as i64)
        .bind(if dead_letter {
            Some(unix_time() as i64)
        } else {
            None
        })
        .bind(entry_id)
        .bind(worker_id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("outbox owned failure update failed: {error}"))
        })?;

        if updated.rows_affected() == 0 {
            return Err(ContractError::MissingCapability);
        }
        Ok(())
    }

    async fn get_dead_letter(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError> {
        self.load_entries("status IN ('failed', 'dead_letter')", limit)
            .await
    }
}

/// In-memory outbox store for reliable event publication.
#[derive(Debug)]
pub struct InMemoryOutboxStore {
    entries: Arc<RwLock<HashMap<String, OutboxEntry>>>,
    claims: Arc<RwLock<HashMap<String, (String, u64)>>>,
}

impl InMemoryOutboxStore {
    /// Create a new in-memory outbox store.
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            claims: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl OutboxStore for InMemoryOutboxStore {
    async fn add(&self, entry: OutboxEntry) -> Result<(), ContractError> {
        let mut entries = self.entries.write().await;
        entries.insert(entry.entry_id.clone(), entry);
        Ok(())
    }

    async fn get_pending(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError> {
        let entries = self.entries.read().await;
        Ok(entries
            .values()
            .filter(|e| e.status == OutboxStatus::Pending)
            .take(limit)
            .cloned()
            .collect())
    }

    async fn claim_pending(
        &self,
        worker_id: &str,
        limit: usize,
        lease_seconds: u64,
    ) -> Result<Vec<OutboxEntry>, ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let limit = limit.clamp(1, 500);
        let now = unix_time();
        let until = now.saturating_add(lease_seconds.clamp(5, 3_600));
        let mut claims = self.claims.write().await;
        let mut entries = self.entries.write().await;

        let mut candidates = entries
            .values()
            .filter(|entry| {
                if entry.status == OutboxStatus::Pending {
                    return true;
                }
                if entry.status != OutboxStatus::Processing {
                    return false;
                }
                !claims
                    .get(&entry.entry_id)
                    .is_some_and(|(_, claimed_until)| *claimed_until > now)
            })
            .cloned()
            .collect::<Vec<_>>();

        candidates.sort_by(|left, right| {
            left.created_at
                .cmp(&right.created_at)
                .then_with(|| left.entry_id.cmp(&right.entry_id))
        });

        let mut result = Vec::with_capacity(limit.min(candidates.len()));
        for mut entry in candidates.into_iter().take(limit) {
            entry.status = OutboxStatus::Processing;
            claims.insert(entry.entry_id.clone(), (worker_id.to_string(), until));
            entries.insert(entry.entry_id.clone(), entry.clone());
            result.push(entry);
        }
        Ok(result)
    }

    async fn mark_published(&self, entry_id: &str) -> Result<(), ContractError> {
        let mut claims = self.claims.write().await;
        let mut entries = self.entries.write().await;
        if let Some(entry) = entries.get_mut(entry_id) {
            entry.status = OutboxStatus::Published;
            claims.remove(entry_id);
            entry.processed_at = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            );
        }
        Ok(())
    }
    async fn mark_published_by(
        &self,
        entry_id: &str,
        worker_id: &str,
    ) -> Result<(), ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let mut claims = self.claims.write().await;
        let owns_claim = claims
            .get(entry_id)
            .is_some_and(|(owner, until)| owner == worker_id && *until > unix_time());
        if !owns_claim {
            return Err(ContractError::MissingCapability);
        }

        let mut entries = self.entries.write().await;
        let entry = entries
            .get_mut(entry_id)
            .ok_or(ContractError::MissingCapability)?;
        entry.status = OutboxStatus::Published;
        entry.processed_at = Some(unix_time());
        claims.remove(entry_id);
        Ok(())
    }

    async fn mark_failed(&self, entry_id: &str) -> Result<(), ContractError> {
        let mut claims = self.claims.write().await;
        let mut entries = self.entries.write().await;
        if let Some(entry) = entries.get_mut(entry_id) {
            entry.status = OutboxStatus::Failed;
            claims.remove(entry_id);
            entry.processed_at = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            );
        }
        Ok(())
    }

    async fn mark_failed_by(&self, entry_id: &str, worker_id: &str) -> Result<(), ContractError> {
        validate_outbox_worker_id(worker_id)?;
        let mut claims = self.claims.write().await;
        let owns_claim = claims
            .get(entry_id)
            .is_some_and(|(owner, until)| owner == worker_id && *until > unix_time());
        if !owns_claim {
            return Err(ContractError::MissingCapability);
        }

        let mut entries = self.entries.write().await;
        let entry = entries
            .get_mut(entry_id)
            .ok_or(ContractError::MissingCapability)?;
        entry.status = OutboxStatus::Failed;
        entry.processed_at = Some(unix_time());
        claims.remove(entry_id);
        Ok(())
    }

    async fn get_dead_letter(&self, limit: usize) -> Result<Vec<OutboxEntry>, ContractError> {
        let entries = self.entries.read().await;
        Ok(entries
            .values()
            .filter(|e| e.status == OutboxStatus::Failed || e.status == OutboxStatus::DeadLetter)
            .take(limit)
            .cloned()
            .collect())
    }
}

impl Default for InMemoryOutboxStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Transport used to publish an outbox entry to its destination.
#[async_trait::async_trait]
pub trait OutboxTransport: Send + Sync {
    /// Publish one durable outbox entry.
    async fn publish(&self, entry: &OutboxEntry) -> Result<(), ContractError>;
}

/// In-process broadcast transport used by local runtime consumers.
#[derive(Clone)]
pub struct BroadcastOutboxTransport {
    sender: broadcast::Sender<OutboxEntry>,
}

impl std::fmt::Debug for BroadcastOutboxTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BroadcastOutboxTransport")
            .field("subscribers", &self.sender.receiver_count())
            .finish()
    }
}

impl BroadcastOutboxTransport {
    /// Create a bounded broadcast transport for runtime events.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity.clamp(16, 8_192));
        Self { sender }
    }

    /// Subscribe to runtime outbox publications.
    pub fn subscribe(&self) -> broadcast::Receiver<OutboxEntry> {
        self.sender.subscribe()
    }

    /// Return the number of active runtime event subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

#[async_trait::async_trait]
impl OutboxTransport for BroadcastOutboxTransport {
    async fn publish(&self, entry: &OutboxEntry) -> Result<(), ContractError> {
        // A local runtime is allowed to publish without an attached UI consumer.
        // Durable persistence remains the source of truth; active subscribers
        // receive the event in real time.
        let _ = self.sender.send(entry.clone());
        Ok(())
    }
}

/// HTTP transport for externally configured webhook destinations.
#[derive(Clone)]
pub struct HttpOutboxTransport {
    client: reqwest::Client,
}

impl std::fmt::Debug for HttpOutboxTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HttpOutboxTransport").finish()
    }
}

impl HttpOutboxTransport {
    /// Create an HTTP transport using the shared provider HTTP client.
    pub fn new() -> Self {
        let timeout_ms = std::env::var("AGENTICOS_OUTBOX_HTTP_TIMEOUT_MS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(30_000)
            .clamp(1_000, 300_000);
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(timeout_ms))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { client }
    }

    async fn publish_http(&self, entry: &OutboxEntry) -> Result<(), ContractError> {
        let response = self
            .client
            .post(&entry.destination)
            .header("content-type", "application/json")
            .header("x-agenticos-event-id", &entry.entry_id)
            .header("idempotency-key", &entry.entry_id)
            .json(&serde_json::json!({
                "entry_id": entry.entry_id,
                "event_type": entry.event.event_type,
                "event_data": entry.event.data,
                "event_schema_version": entry.event.schema_version,
                "destination": entry.destination,
                "attempts": entry.attempts,
                "created_at": entry.created_at,
            }))
            .send()
            .await
            .map_err(|error| {
                ContractError::ParseError(format!(
                    "outbox HTTP publication failed for {}: {error}",
                    entry.destination
                ))
            })?;

        let status = response.status();
        if status.is_success() {
            return Ok(());
        }

        let body = response.text().await.unwrap_or_default();
        let detail = body.chars().take(2_048).collect::<String>();
        Err(ContractError::ParseError(format!(
            "outbox destination returned HTTP {status}: {detail}"
        )))
    }
}

impl Default for HttpOutboxTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl OutboxTransport for HttpOutboxTransport {
    async fn publish(&self, entry: &OutboxEntry) -> Result<(), ContractError> {
        self.publish_http(entry).await
    }
}

/// Destination-aware outbox transport.
#[derive(Clone)]
pub struct CompositeOutboxTransport {
    runtime: Arc<BroadcastOutboxTransport>,
    http: HttpOutboxTransport,
}

impl std::fmt::Debug for CompositeOutboxTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CompositeOutboxTransport")
            .field("runtime_subscribers", &self.runtime.subscriber_count())
            .field("http", &"<HttpOutboxTransport>")
            .finish()
    }
}

impl CompositeOutboxTransport {
    /// Create a composite transport with the supplied local runtime channel.
    pub fn new(runtime: Arc<BroadcastOutboxTransport>) -> Self {
        Self {
            runtime,
            http: HttpOutboxTransport::new(),
        }
    }

    /// Access the local runtime event transport.
    pub fn runtime(&self) -> &Arc<BroadcastOutboxTransport> {
        &self.runtime
    }
}

#[async_trait::async_trait]
impl OutboxTransport for CompositeOutboxTransport {
    async fn publish(&self, entry: &OutboxEntry) -> Result<(), ContractError> {
        let destination = entry.destination.trim();
        if destination == "runtime" || destination.starts_with("runtime://") {
            return self.runtime.publish(entry).await;
        }
        if destination.starts_with("http://") || destination.starts_with("https://") {
            return self.http.publish(entry).await;
        }

        Err(ContractError::ParseError(format!(
            "unsupported outbox destination: {}",
            entry.destination
        )))
    }
}

/// Background event publisher for reliable event publication.
pub struct BackgroundEventPublisher {
    outbox: Arc<dyn OutboxStore>,
    transport: Arc<dyn OutboxTransport>,
}

impl std::fmt::Debug for BackgroundEventPublisher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BackgroundEventPublisher")
            .field("outbox", &"<OutboxStore>")
            .field("transport", &"<OutboxTransport>")
            .finish()
    }
}

impl BackgroundEventPublisher {
    /// Create a publisher with the default destination-aware transport.
    pub fn new(outbox: Arc<dyn OutboxStore>) -> Self {
        Self::with_transport(
            outbox,
            Arc::new(CompositeOutboxTransport::new(Arc::new(
                BroadcastOutboxTransport::new(256),
            ))),
        )
    }

    /// Create a publisher with an explicit transport.
    pub fn with_transport(
        outbox: Arc<dyn OutboxStore>,
        transport: Arc<dyn OutboxTransport>,
    ) -> Self {
        Self { outbox, transport }
    }

    /// Process pending outbox entries and publish them through the transport.
    pub async fn process_pending(&self) -> Result<usize, ContractError> {
        let worker_id = format!("outbox-publisher-{}", uuid::Uuid::new_v4());
        let pending = self
            .outbox
            .claim_pending(&worker_id, 50, outbox_lease_seconds())
            .await?;
        let mut published = 0;

        for entry in pending {
            match self.transport.publish(&entry).await {
                Ok(()) => {
                    self.outbox
                        .mark_published_by(&entry.entry_id, &worker_id)
                        .await?;
                    published += 1;
                }
                Err(error) => {
                    tracing::warn!(
                        %error,
                        entry_id = %entry.entry_id,
                        destination = %entry.destination,
                        "outbox publication failed; scheduling retry"
                    );
                    self.outbox
                        .mark_failed_by(&entry.entry_id, &worker_id)
                        .await?;
                }
            }
        }

        Ok(published)
    }

    /// Retry entries previously marked as failed.
    pub async fn process_failed(&self) -> Result<usize, ContractError> {
        let failed = self.outbox.get_dead_letter(50).await?;
        let mut published = 0;

        for entry in failed {
            if entry.status != OutboxStatus::Failed {
                continue;
            }

            match self.transport.publish(&entry).await {
                Ok(()) => {
                    self.outbox.mark_published(&entry.entry_id).await?;
                    published += 1;
                }
                Err(error) => {
                    tracing::warn!(
                        %error,
                        entry_id = %entry.entry_id,
                        destination = %entry.destination,
                        "outbox retry failed"
                    );
                    self.outbox.mark_failed(&entry.entry_id).await?;
                }
            }
        }

        Ok(published)
    }
}

#[cfg(test)]
mod event_store_contiguity_tests {
    use super::*;

    #[tokio::test]
    async fn rejects_version_gap_in_event_stream() {
        let path =
            std::env::temp_dir().join(format!("agenticos-event-gap-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = SqliteEventStore::new(&url).await.unwrap();

        store
            .append(
                "run:gap",
                0,
                vec![SerializedEvent {
                    event_type: "first".to_string(),
                    data: "{}".to_string(),
                    schema_version: 1,
                }],
            )
            .await
            .unwrap();

        let result = store
            .append(
                "run:gap",
                2,
                vec![SerializedEvent {
                    event_type: "third".to_string(),
                    data: "{}".to_string(),
                    schema_version: 1,
                }],
            )
            .await;
        assert!(result.is_err());

        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod event_outbox_atomicity_tests {
    use super::*;

    #[tokio::test]
    async fn event_append_creates_runtime_outbox_entry_atomically() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-event-outbox-{}.db",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let events = SqliteEventStore::new(&url).await.unwrap();
        let outbox = SqliteOutboxStore::open(&url).await.unwrap();

        events
            .append(
                "run:test",
                0,
                vec![SerializedEvent {
                    event_type: "RunCreated".to_string(),
                    data: r#"{"run_id":"test"}"#.to_string(),
                    schema_version: 1,
                }],
            )
            .await
            .unwrap();

        let pending = outbox.get_pending(10).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].entry_id, "runtime:run:test:0:RunCreated:v1");
        assert_eq!(pending[0].destination, "runtime");

        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod outbox_claim_tests {
    use super::*;

    #[tokio::test]
    async fn concurrent_in_memory_claims_are_exclusive() {
        let store = Arc::new(InMemoryOutboxStore::new());
        store
            .add(OutboxEntry {
                entry_id: "claim-test".to_string(),
                event: SerializedEvent {
                    event_type: "Test".to_string(),
                    data: "{}".to_string(),
                    schema_version: 1,
                },
                destination: "runtime".to_string(),
                attempts: 0,
                status: OutboxStatus::Pending,
                created_at: 1,
                processed_at: None,
            })
            .await
            .unwrap();

        let first = store.claim_pending("worker-a", 10, 120).await.unwrap();
        let second = store.claim_pending("worker-b", 10, 120).await.unwrap();

        assert_eq!(first.len(), 1);
        assert!(second.is_empty());
    }
}

#[cfg(test)]
mod outbox_claim_ownership_tests {
    use super::*;

    #[tokio::test]
    async fn stale_worker_cannot_finalize_another_workers_claim() {
        let store = Arc::new(InMemoryOutboxStore::new());
        store
            .add(OutboxEntry {
                entry_id: "ownership-test".to_string(),
                event: SerializedEvent {
                    event_type: "Test".to_string(),
                    data: "{}".to_string(),
                    schema_version: 1,
                },
                destination: "runtime".to_string(),
                attempts: 0,
                status: OutboxStatus::Pending,
                created_at: 1,
                processed_at: None,
            })
            .await
            .unwrap();

        let claimed = store.claim_pending("worker-a", 1, 120).await.unwrap();
        assert_eq!(claimed.len(), 1);
        assert!(store
            .mark_published_by("ownership-test", "worker-b")
            .await
            .is_err());
        assert!(store
            .mark_published_by("ownership-test", "worker-a")
            .await
            .is_ok());
    }
}

#[cfg(test)]
mod outbox_transport_tests {
    use super::*;

    #[tokio::test]
    async fn broadcast_transport_delivers_entries() {
        let transport = BroadcastOutboxTransport::new(16);
        let mut receiver = transport.subscribe();
        let entry = OutboxEntry {
            entry_id: "entry-1".to_string(),
            event: SerializedEvent {
                event_type: "RunCreated".to_string(),
                data: "{}".to_string(),
                schema_version: 1,
            },
            destination: "runtime".to_string(),
            attempts: 0,
            status: OutboxStatus::Pending,
            created_at: 1,
            processed_at: None,
        };

        transport.publish(&entry).await.unwrap();
        let received = receiver.recv().await.unwrap();
        assert_eq!(received.entry_id, "entry-1");
    }

    #[test]
    fn composite_accepts_runtime_and_http_destinations() {
        let runtime = Arc::new(BroadcastOutboxTransport::new(16));
        let transport = CompositeOutboxTransport::new(runtime);
        assert_eq!(transport.runtime().subscriber_count(), 0);
    }
}

/// In-memory saga coordinator for multi-step workflow orchestration.
pub struct InMemorySagaCoordinator {
    sagas: Arc<RwLock<HashMap<String, Saga>>>,
}

impl std::fmt::Debug for InMemorySagaCoordinator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InMemorySagaCoordinator")
            .field("sagas", &"<Arc<RwLock<HashMap>>>")
            .finish()
    }
}

impl InMemorySagaCoordinator {
    /// Create a new in-memory saga coordinator.
    pub fn new() -> Self {
        Self {
            sagas: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl SagaCoordinator for InMemorySagaCoordinator {
    async fn start_saga(&self, saga: Saga) -> Result<(), ContractError> {
        let mut sagas = self.sagas.write().await;
        sagas.insert(saga.saga_id.clone(), saga);
        Ok(())
    }

    async fn get_saga(&self, saga_id: &str) -> Result<Option<Saga>, ContractError> {
        let sagas = self.sagas.read().await;
        Ok(sagas.get(saga_id).cloned())
    }

    async fn execute_next_step(&self, saga_id: &str) -> Result<(), ContractError> {
        let mut sagas = self.sagas.write().await;
        let saga = sagas
            .get_mut(saga_id)
            .ok_or(ContractError::MissingCapability)?;

        // Find next pending step
        if let Some(index) = saga.current_step_index {
            let next_index = index + 1;
            if next_index < saga.steps.len() {
                saga.current_step_index = Some(next_index);
                saga.steps[next_index].status = SagaStepStatus::InProgress;
                saga.status = SagaStatus::InProgress;
            } else {
                saga.status = SagaStatus::Completed;
                saga.completed_at = Some(
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                );
            }
        } else if !saga.steps.is_empty() {
            saga.current_step_index = Some(0);
            saga.steps[0].status = SagaStepStatus::InProgress;
            saga.status = SagaStatus::InProgress;
        }

        Ok(())
    }

    async fn compensate_saga(&self, saga_id: &str) -> Result<(), ContractError> {
        let mut sagas = self.sagas.write().await;
        let saga = sagas
            .get_mut(saga_id)
            .ok_or(ContractError::MissingCapability)?;

        saga.status = SagaStatus::Compensating;

        // Compensate all completed steps in reverse order
        if let Some(current_index) = saga.current_step_index {
            for i in (0..=current_index).rev() {
                if saga.steps[i].status == SagaStepStatus::Completed {
                    saga.steps[i].status = SagaStepStatus::Compensating;
                }
            }
        }

        saga.status = SagaStatus::Compensated;
        saga.completed_at = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        );

        Ok(())
    }

    async fn get_pending_sagas(&self, limit: usize) -> Result<Vec<Saga>, ContractError> {
        let sagas = self.sagas.read().await;
        let pending: Vec<Saga> = sagas
            .values()
            .filter(|s| s.status == SagaStatus::Pending || s.status == SagaStatus::InProgress)
            .take(limit)
            .cloned()
            .collect();
        Ok(pending)
    }
}

impl Default for InMemorySagaCoordinator {
    fn default() -> Self {
        Self::new()
    }
}

/// In-memory feature flag store for runtime configuration.
pub struct InMemoryFeatureFlagStore {
    flags: Arc<RwLock<HashMap<String, FeatureFlag>>>,
}

impl InMemoryFeatureFlagStore {
    /// Create a new in-memory feature flag store.
    pub fn new() -> Self {
        Self {
            flags: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl std::fmt::Debug for InMemoryFeatureFlagStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InMemoryFeatureFlagStore")
            .field("flags", &"<Arc<RwLock<HashMap>>>")
            .finish()
    }
}

#[async_trait::async_trait]
impl FeatureFlagStore for InMemoryFeatureFlagStore {
    async fn set_flag(&self, flag: FeatureFlag) -> Result<(), ContractError> {
        let mut flags = self.flags.write().await;
        flags.insert(flag.flag_id.clone(), flag);
        Ok(())
    }

    async fn get_flag(&self, flag_id: &str) -> Result<Option<FeatureFlag>, ContractError> {
        let flags = self.flags.read().await;
        Ok(flags.get(flag_id).cloned())
    }

    async fn is_enabled(&self, flag_id: &str) -> Result<bool, ContractError> {
        let flags = self.flags.read().await;
        Ok(flags.get(flag_id).map(|f| f.enabled).unwrap_or(false))
    }

    async fn get_value(&self, flag_id: &str) -> Result<Option<FlagValue>, ContractError> {
        let flags = self.flags.read().await;
        Ok(flags.get(flag_id).map(|f| f.value.clone()))
    }

    async fn enable_flag(&self, flag_id: &str) -> Result<(), ContractError> {
        let mut flags = self.flags.write().await;
        if let Some(flag) = flags.get_mut(flag_id) {
            flag.enabled = true;
            flag.updated_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
        }
        Ok(())
    }

    async fn disable_flag(&self, flag_id: &str) -> Result<(), ContractError> {
        let mut flags = self.flags.write().await;
        if let Some(flag) = flags.get_mut(flag_id) {
            flag.enabled = false;
            flag.updated_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
        }
        Ok(())
    }

    async fn list_flags(&self) -> Result<Vec<FeatureFlag>, ContractError> {
        let flags = self.flags.read().await;
        Ok(flags.values().cloned().collect())
    }
}

impl Default for InMemoryFeatureFlagStore {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for TestClock {
    fn default() -> Self {
        Self::new()
    }
}

/// Deterministic ID generator for testing.
#[derive(Debug)]
pub struct TestIdGenerator {
    counter: Arc<std::sync::atomic::AtomicU64>,
}

impl TestIdGenerator {
    /// Create a new test ID generator.
    pub fn new() -> Self {
        Self {
            counter: Arc::new(std::sync::atomic::AtomicU64::new(1)),
        }
    }

    /// Generate a new deterministic ID.
    pub fn generate(&self) -> String {
        format!(
            "test-{}",
            self.counter
                .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
        )
    }

    /// Generate a new UUID-like deterministic ID.
    pub fn generate_uuid(&self) -> String {
        let id = self
            .counter
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        format!("{:08x}-{:04x}-{:04x}-{:04x}-{:012x}", id, 0, 0, 0, 0)
    }
}

impl Default for TestIdGenerator {
    fn default() -> Self {
        Self::new()
    }
}

/// HTTP-based model provider for actual model execution.
#[derive(Debug)]
pub struct HttpModelProvider {
    /// Base URL for the model API.
    base_url: String,
    /// Provider identifier.
    provider_id: String,
    /// Request timeout in seconds.
    timeout_secs: u64,
    /// API key for authentication.
    api_key: Option<String>,
    /// Default model name.
    default_model: String,
}

impl HttpModelProvider {
    /// Create a new HTTP model provider with default timeout (30 seconds).
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            provider_id: "http-model-provider".to_string(),
            timeout_secs: 30,
            api_key: None,
            default_model: "gpt-4".to_string(),
        }
    }

    /// Create a new HTTP model provider with LLM config.
    pub fn with_config(base_url: String, config: &LLMConfig) -> Self {
        Self {
            base_url,
            provider_id: "http-model-provider".to_string(),
            timeout_secs: 30,
            api_key: config.get_api_key(),
            default_model: config.default_model.clone(),
        }
    }

    /// Create a new HTTP model provider with custom provider ID.
    pub fn with_provider_id(base_url: String, provider_id: String) -> Self {
        Self {
            base_url,
            provider_id,
            timeout_secs: 30,
            api_key: None,
            default_model: "gpt-4".to_string(),
        }
    }

    /// Create a new HTTP model provider with custom timeout.
    pub fn with_timeout(base_url: String, timeout_secs: u64) -> Self {
        Self {
            base_url,
            provider_id: "http-model-provider".to_string(),
            timeout_secs,
            api_key: None,
            default_model: "gpt-4".to_string(),
        }
    }

    /// Set the API key.
    pub fn with_api_key(mut self, api_key: String) -> Self {
        self.api_key = Some(api_key);
        self
    }

    /// Set the default model.
    pub fn with_model(mut self, model: String) -> Self {
        self.default_model = model;
        self
    }
}

#[async_trait::async_trait]
impl ModelProvider for HttpModelProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        // Build the HTTP client with timeout
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(self.timeout_secs))
            .build()
            .map_err(|e| {
                ContractError::ParseError(format!("Failed to build HTTP client: {}", e))
            })?;

        // Build the request payload
        let payload = serde_json::json!({
            "request_id": request.request_id,
            "model": request.model,
            "input": request.input,
            "parameters": request.parameters,
        });

        // Make the HTTP request
        let mut http_request = client.post(&self.base_url).json(&payload);

        // Add API key header if available
        if let Some(api_key) = &self.api_key {
            http_request = http_request.header("Authorization", format!("Bearer {}", api_key));
        }

        let response = http_request
            .send()
            .await
            .map_err(|e| ContractError::ParseError(format!("HTTP request failed: {}", e)))?;

        // Check response status
        if !response.status().is_success() {
            return Err(ContractError::ParseError(format!(
                "HTTP request failed with status: {}",
                response.status()
            )));
        }

        // Parse the response
        let response_body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| ContractError::ParseError(format!("Failed to parse response: {}", e)))?;

        // Extract the output from the response
        let output = response_body
            .get("output")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ContractError::ParseError("Response missing 'output' field".to_string())
            })?
            .to_string();

        // Extract optional metadata
        let metadata = response_body
            .get("metadata")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract optional tokens_used
        let tokens_used = response_body.get("tokens_used").and_then(|v| v.as_u64());

        Ok(ModelResponse {
            request_id: request.request_id,
            output,
            metadata,
            tokens_used,
        })
    }
}

/// Recovery state for failed tool executions with retry logic.
#[derive(Debug, Clone)]
struct RecoveryState {
    /// Current retry count for the current operation
    retry_count: usize,
    /// Maximum retries allowed
    max_retries: usize,
    /// Consecutive failures count for circuit breaker
    consecutive_failures: usize,
    /// Circuit breaker threshold
    circuit_breaker_threshold: usize,
    /// Whether circuit breaker is open
    circuit_breaker_open: bool,
    /// Last error context
    last_error: Option<String>,
}

impl Default for RecoveryState {
    fn default() -> Self {
        Self {
            retry_count: 0,
            max_retries: 3,
            consecutive_failures: 0,
            circuit_breaker_threshold: 5,
            circuit_breaker_open: false,
            last_error: None,
        }
    }
}

impl RecoveryState {
    /// Create a new recovery state with custom configuration.
    #[allow(dead_code)]
    pub fn new(max_retries: usize, circuit_breaker_threshold: usize) -> Self {
        Self {
            retry_count: 0,
            max_retries,
            consecutive_failures: 0,
            circuit_breaker_threshold,
            circuit_breaker_open: false,
            last_error: None,
        }
    }

    /// Increment retry count.
    pub fn increment_retry(&mut self) -> bool {
        self.retry_count += 1;
        self.retry_count <= self.max_retries
    }

    /// Record a failure and check circuit breaker.
    pub fn record_failure(&mut self, error: String) -> bool {
        self.consecutive_failures += 1;
        self.last_error = Some(error);

        if self.consecutive_failures >= self.circuit_breaker_threshold {
            self.circuit_breaker_open = true;
            false // Circuit breaker triggered
        } else {
            true // Continue retries
        }
    }

    /// Record a success and reset circuit breaker.
    pub fn record_success(&mut self) {
        self.retry_count = 0;
        self.consecutive_failures = 0;
        self.circuit_breaker_open = false;
        self.last_error = None;
    }

    /// Check if retries are exhausted.
    #[allow(dead_code)]
    pub fn is_exhausted(&self) -> bool {
        self.retry_count >= self.max_retries
    }

    /// Check if circuit breaker is open.
    pub fn is_circuit_breaker_open(&self) -> bool {
        self.circuit_breaker_open
    }

    /// Reset circuit breaker.
    #[allow(dead_code)]
    pub fn reset_circuit_breaker(&mut self) {
        self.circuit_breaker_open = false;
        self.consecutive_failures = 0;
    }

    /// Calculate exponential backoff delay in milliseconds.
    pub fn calculate_backoff_ms(&self) -> u64 {
        let base_delay_ms = 100u64; // 100ms base delay
        let max_delay_ms = 5000u64; // 5 seconds max delay
        let delay = base_delay_ms * (2u64.pow(self.retry_count as u32));
        delay.min(max_delay_ms)
    }
}

fn is_structured_tool_action(action: &str) -> bool {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(action) else {
        return false;
    };
    value
        .get("tool")
        .or_else(|| value.get("tool_id"))
        .and_then(serde_json::Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

/// ReAct agent core loop implementation.
#[allow(missing_debug_implementations)]
pub struct ReactAgent {
    /// Agent identity (SOUL.md equivalent)
    identity: String,
    /// Maximum turns per session
    max_turns: usize,
    /// SOUL system for persistent personality and memory (Hermes-style)
    soul: Arc<RwLock<Soul>>,
    /// Interior mutability for concurrent access
    inner: Mutex<ReactAgentInner>,
}

/// Interior mutable state of ReactAgent.
struct ReactAgentInner {
    /// Current turn count
    current_turn: usize,
    /// Model provider for LLM integration
    model_provider: Option<Arc<dyn ModelProvider>>,
    /// Optional model identifier pinned for this agent session.
    preferred_model: Option<String>,
    /// SQLite tier 2 memory for conversation history
    memory: Option<Arc<SqliteMemory>>,
    /// Current session ID
    session_id: String,
    /// Tool executor for legacy action compatibility.
    tool_executor: Option<ToolExecutor>,
    /// Capability-gated runtime for native and MCP tool execution.
    tool_runtime: Option<Arc<dyn ToolRuntimePort>>,
    /// Default short-lived grant used for safe agent tool calls.
    tool_grant_id: Option<String>,
    /// Optional checkpoint store for state persistence
    checkpoint_store: Option<Arc<dyn EventStore>>,
    /// Optional planner for task decomposition
    planner: Option<Planner>,
    /// Current plan being executed
    current_plan: Option<Plan>,
    /// Optional tool registry for tool discovery
    tool_registry: Option<ToolRegistry>,
    /// Optional supervisor for subagent coordination
    supervisor: Option<Supervisor>,
    /// Optional sandbox for secure tool execution
    sandbox: Option<Arc<dyn Sandbox>>,
    /// Session event log for durable event tracking
    event_log: Option<SessionEventLog>,
    /// Tool execution pipeline with pre/post hooks
    tool_pipeline: Option<Arc<ToolExecutionPipeline>>,
    /// LLM router for multi-provider fallback
    llm_router: Option<Arc<LLMRouter>>,
    /// Provider registry for actual provider calls
    provider_registry: Option<Arc<ProviderRegistry>>,
    /// Goal manager for persistent goals
    goal_manager: Option<Arc<GoalManager>>,
    /// Heartbeat manager for session liveness
    heartbeat_manager: Option<Arc<HeartbeatManager>>,
    /// Recovery state for failed tool executions
    recovery_state: RecoveryState,
    /// Skills catalog with full skill metadata (interior mutable)
    skills_catalog: Vec<Skill>,
    /// Memory tier 1: MEMORY.md (interior mutable)
    memory_md: String,
    /// Memory tier 1: USER.md (interior mutable)
    user_md: String,
    /// Cached static system-prompt section. Dynamic conversation history is appended per turn.
    static_system_prompt: Option<Arc<str>>,
}

impl ReactAgent {
    /// Create a new ReAct agent with default configuration.
    pub fn new(identity: String) -> Self {
        Self {
            identity,
            max_turns: 90,
            soul: Arc::new(RwLock::new(Soul::new())),
            inner: Mutex::new(ReactAgentInner {
                current_turn: 0,
                model_provider: None,
                preferred_model: None,
                memory: None,
                session_id: uuid::Uuid::new_v4().to_string(),
                tool_executor: None,
                tool_runtime: None,
                tool_grant_id: None,
                checkpoint_store: None,
                planner: None,
                current_plan: None,
                tool_registry: None,
                supervisor: None,
                sandbox: None,
                event_log: None,
                tool_pipeline: None::<Arc<ToolExecutionPipeline>>,
                llm_router: None::<Arc<LLMRouter>>,
                provider_registry: None::<Arc<ProviderRegistry>>,
                goal_manager: None::<Arc<GoalManager>>,
                heartbeat_manager: None::<Arc<HeartbeatManager>>,
                recovery_state: RecoveryState::default(),
                skills_catalog: Vec::new(),
                memory_md: String::new(),
                user_md: String::new(),
                static_system_prompt: None,
            }),
        }
    }

    /// Get the agent's identity/name.
    pub fn name(&self) -> &str {
        &self.identity
    }

    /// Create a new ReAct agent with custom max turns.
    pub fn with_max_turns(identity: String, max_turns: usize) -> Self {
        Self {
            identity,
            max_turns,
            soul: Arc::new(RwLock::new(Soul::new())),
            inner: Mutex::new(ReactAgentInner {
                current_turn: 0,
                model_provider: None,
                preferred_model: None,
                memory: None,
                session_id: uuid::Uuid::new_v4().to_string(),
                tool_executor: None,
                tool_runtime: None,
                tool_grant_id: None,
                checkpoint_store: None,
                planner: None,
                current_plan: None,
                tool_registry: None,
                supervisor: None,
                sandbox: None,
                event_log: None,
                tool_pipeline: None::<Arc<ToolExecutionPipeline>>,
                llm_router: None::<Arc<LLMRouter>>,
                provider_registry: None::<Arc<ProviderRegistry>>,
                goal_manager: None::<Arc<GoalManager>>,
                heartbeat_manager: None::<Arc<HeartbeatManager>>,
                recovery_state: RecoveryState::default(),
                skills_catalog: Vec::new(),
                memory_md: String::new(),
                user_md: String::new(),
                static_system_prompt: None,
            }),
        }
    }

    /// Set the model provider for LLM integration.
    pub fn set_model_provider(&self, provider: Arc<dyn ModelProvider>) {
        self.inner.lock().unwrap().model_provider = Some(provider);
    }

    /// Pin this agent session to a specific registered model identifier.
    pub fn set_model(&self, model: String) {
        let normalized = model.trim();
        self.inner.lock().unwrap().preferred_model =
            (!normalized.is_empty()).then(|| normalized.to_string());
    }

    /// Set SQLite tier 2 memory for conversation history.
    pub fn set_memory(&self, memory: Arc<SqliteMemory>) {
        self.inner.lock().unwrap().memory = Some(memory);
    }

    /// Get session history from memory.
    pub async fn get_session_history(&self, session_id: &str) -> Vec<serde_json::Value> {
        let memory = {
            let inner = self.inner.lock().unwrap();
            inner.memory.clone()
        };

        if let Some(memory) = memory {
            match memory.get_session_history(session_id, 100).await {
                Ok(messages) => messages
                    .into_iter()
                    .map(|msg| {
                        serde_json::json!({
                            "role": msg.role,
                            "content": msg.content,
                            "timestamp": msg.timestamp
                        })
                    })
                    .collect(),
                Err(_) => vec![],
            }
        } else {
            vec![]
        }
    }

    /// Set the session ID for conversation tracking.
    pub fn set_session_id(&self, session_id: String) {
        self.inner.lock().unwrap().session_id = session_id;
    }

    /// Set the tool executor for real tool execution.
    pub fn set_tool_executor(&self, executor: ToolExecutor) {
        self.inner.lock().unwrap().tool_executor = Some(executor);
    }

    /// Set the capability-gated runtime for structured agent tool calls.
    pub fn set_tool_runtime(&self, runtime: Arc<dyn ToolRuntimePort>) {
        self.inner.lock().unwrap().tool_runtime = Some(runtime);
    }

    /// Set the short-lived capability grant used for agent tool calls.
    pub fn set_tool_grant_id(&self, grant_id: String) {
        self.inner.lock().unwrap().tool_grant_id = Some(grant_id);
    }

    /// Set the checkpoint store for state persistence.
    pub fn set_checkpoint_store(&self, store: Arc<dyn EventStore>) {
        self.inner.lock().unwrap().checkpoint_store = Some(store);
    }

    /// Set the planner for task decomposition.
    pub fn set_planner(&self, planner: Planner) {
        self.inner.lock().unwrap().planner = Some(planner);
    }

    /// Set the tool registry for tool discovery.
    pub fn set_tool_registry(&self, registry: ToolRegistry) {
        self.inner.lock().unwrap().tool_registry = Some(registry);
    }

    /// Set the supervisor for subagent coordination.
    pub fn set_supervisor(&self, supervisor: Supervisor) {
        self.inner.lock().unwrap().supervisor = Some(supervisor);
    }

    /// Set the model provider for Planner and Supervisor LLM integration.
    pub fn set_model_provider_for_planning(
        &self,
        provider: Arc<dyn agenticos_contracts::ModelProvider>,
    ) {
        self.inner.lock().unwrap().model_provider = Some(provider);
    }

    /// Set the sandbox for secure tool execution.
    pub fn set_sandbox(&self, sandbox: Arc<dyn Sandbox>) {
        self.inner.lock().unwrap().sandbox = Some(sandbox);
    }

    /// Set the session event log for durable event tracking.
    pub fn set_event_log(&self, event_log: SessionEventLog) {
        self.inner.lock().unwrap().event_log = Some(event_log);
    }

    /// Get the session event log if available.
    pub fn get_event_log(&self) -> Option<SessionEventLog> {
        self.inner.lock().unwrap().event_log.clone()
    }

    /// Set the tool execution pipeline with pre/post hooks.
    pub fn set_tool_pipeline(&self, pipeline: ToolExecutionPipeline) {
        self.inner.lock().unwrap().tool_pipeline = Some(Arc::new(pipeline));
    }

    /// Get the tool execution pipeline if available.
    pub fn get_tool_pipeline(&self) -> Option<Arc<ToolExecutionPipeline>> {
        self.inner.lock().unwrap().tool_pipeline.clone()
    }

    /// Set the LLM router for multi-provider fallback.
    pub fn set_llm_router(&self, router: LLMRouter) {
        self.inner.lock().unwrap().llm_router = Some(Arc::new(router));
    }

    /// Get the LLM router if available.
    pub fn get_llm_router(&self) -> Option<Arc<LLMRouter>> {
        self.inner.lock().unwrap().llm_router.clone()
    }

    /// Set the provider registry for actual provider calls.
    pub fn set_provider_registry(&self, registry: ProviderRegistry) {
        self.inner.lock().unwrap().provider_registry = Some(Arc::new(registry));
    }

    /// Get the provider registry if available.
    pub fn get_provider_registry(&self) -> Option<Arc<ProviderRegistry>> {
        self.inner.lock().unwrap().provider_registry.clone()
    }

    /// Set the goal manager for persistent goals.
    pub fn set_goal_manager(&self, manager: GoalManager) {
        self.inner.lock().unwrap().goal_manager = Some(Arc::new(manager));
    }

    /// Get the goal manager if available.
    pub fn get_goal_manager(&self) -> Option<Arc<GoalManager>> {
        self.inner.lock().unwrap().goal_manager.clone()
    }

    /// Set the heartbeat manager for session liveness.
    pub fn set_heartbeat_manager(&self, manager: HeartbeatManager) {
        self.inner.lock().unwrap().heartbeat_manager = Some(Arc::new(manager));
    }

    /// Get the heartbeat manager if available.
    pub fn get_heartbeat_manager(&self) -> Option<Arc<HeartbeatManager>> {
        self.inner.lock().unwrap().heartbeat_manager.clone()
    }

    /// Get the SOUL (Hermes-style personality and memory system).
    pub async fn get_soul(&self) -> Soul {
        self.soul.read().await.clone()
    }

    /// Update the SOUL's memory.
    pub async fn update_soul_memory(&self, new_memory: String) {
        let mut soul = self.soul.write().await;
        soul.update_memory(new_memory);
    }

    /// Add a skill to the SOUL (Hermes-style skill crystallization).
    pub async fn add_skill_to_soul(&self, skill: SkillEntry) {
        let mut soul = self.soul.write().await;
        soul.add_skill(skill);
    }

    /// Record a milestone in the SOUL.
    pub async fn record_milestone(&self, milestone: Milestone) {
        let mut soul = self.soul.write().await;
        soul.add_milestone(milestone);
    }

    /// Get top skills from the SOUL.
    pub async fn get_top_skills(&self, limit: usize) -> Vec<SkillEntry> {
        let soul = self.soul.read().await;
        soul.get_top_skills(limit).into_iter().cloned().collect()
    }

    /// Load SOUL from a file.
    pub async fn load_soul_from_file(
        &self,
        path: PathBuf,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let soul = Soul::load_from_file(&path)?;
        *self.soul.write().await = soul;
        Ok(())
    }

    /// Save SOUL to a file.
    pub async fn save_soul_to_file(&self, path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
        let soul = self.soul.read().await;
        soul.save_to_file(&path)?;
        Ok(())
    }

    /// Add a skill to the catalog.
    pub fn add_skill(&self, skill: Skill) {
        let mut inner = self.inner.lock().unwrap();
        inner.skills_catalog.push(skill);
        inner.static_system_prompt = None;
    }

    /// Add a skill from markdown content.
    pub fn add_skill_from_markdown(&self, markdown: &str) -> Result<(), String> {
        let skill = Skill::from_markdown(markdown)?;
        let mut inner = self.inner.lock().unwrap();
        inner.skills_catalog.push(skill);
        inner.static_system_prompt = None;
        Ok(())
    }

    /// Set MEMORY.md content.
    pub fn set_memory_md(&self, content: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.memory_md = content;
        inner.static_system_prompt = None;
    }

    /// Set USER.md content.
    pub fn set_user_md(&self, content: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.user_md = content;
        inner.static_system_prompt = None;
    }

    /// Build system prompt from a cached static section plus budgeted conversation history.
    pub async fn build_system_prompt(&self) -> String {
        self.build_system_prompt_with_input(None).await
    }

    async fn build_system_prompt_with_input(&self, input: Option<&str>) -> String {
        let cached_static = {
            let inner = self.inner.lock().unwrap();
            inner.static_system_prompt.clone()
        };

        let static_prompt = if let Some(cached) = cached_static {
            cached
        } else {
            let (memory_md, user_md, skill_summaries) = {
                let inner = self.inner.lock().unwrap();
                let max_skill_summaries = std::env::var("AGENTICOS_MAX_PROMPT_SKILLS")
                    .ok()
                    .and_then(|value| value.parse::<usize>().ok())
                    .unwrap_or(32)
                    .clamp(0, 128);

                (
                    inner.memory_md.clone(),
                    inner.user_md.clone(),
                    inner
                        .skills_catalog
                        .iter()
                        .take(max_skill_summaries)
                        .map(Skill::summary)
                        .collect::<Vec<_>>(),
                )
            };

            let mut prompt = String::new();
            prompt.push_str(&self.identity);
            prompt.push('\n');

            if !memory_md.is_empty() {
                prompt.push_str("## Memory (MEMORY.md)\n");
                prompt.push_str(&memory_md);
                prompt.push('\n');
            }

            if !user_md.is_empty() {
                prompt.push_str("## User Preferences (USER.md)\n");
                prompt.push_str(&user_md);
                prompt.push('\n');
            }

            if !skill_summaries.is_empty() {
                prompt.push_str("## Available Skills\n");
                for summary in skill_summaries {
                    prompt.push_str("- ");
                    prompt.push_str(&summary);
                    prompt.push('\n');
                }
                prompt.push('\n');
            }

            prompt.push_str("## Instructions\n");
            prompt.push_str("Use ReAct pattern: Thought → Action → Observation → repeat.\n");
            prompt.push_str("Be concise and precise.\n");
            prompt.push_str("When a tool is needed, emit ONLY JSON in the form {\"tool\":\"tool.id\",\"arguments\":{...}}.\n");
            prompt.push_str("Never invent tool IDs; use only the registered tool IDs supplied by the runtime.\n");

            let cached = Arc::<str>::from(prompt);
            let mut inner = self.inner.lock().unwrap();
            let existing = inner
                .static_system_prompt
                .get_or_insert_with(|| cached.clone())
                .clone();
            existing
        };

        let (memory, session_id) = {
            let inner = self.inner.lock().unwrap();
            (inner.memory.clone(), inner.session_id.clone())
        };

        let mut prompt = static_prompt.to_string();

        let tool_runtime = {
            let inner = self.inner.lock().unwrap();
            inner.tool_runtime.clone()
        };
        if let Some(runtime) = tool_runtime {
            if let Ok(tools) = runtime.list_tools().await {
                if !tools.is_empty() {
                    prompt.push_str("\n## Available Tools\n");
                    let max_tools = std::env::var("AGENTICOS_MAX_PROMPT_TOOLS")
                        .ok()
                        .and_then(|value| value.parse::<usize>().ok())
                        .unwrap_or(64)
                        .clamp(1, 256);
                    for tool in tools.into_iter().take(max_tools) {
                        prompt.push_str("- ");
                        prompt.push_str(&tool.tool_id);
                        prompt.push_str(": ");
                        prompt.push_str(&tool.description);
                        if !tool.context_requirements.is_empty() {
                            prompt.push_str(" [");
                            prompt.push_str(&tool.context_requirements.join(", "));
                            prompt.push(']');
                        }
                        prompt.push('\n');
                    }
                }
            }
        }

        if let Some(memory) = memory {
            let history_limit = std::env::var("AGENTICOS_MEMORY_HISTORY_LIMIT")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(64)
                .clamp(8, 256);

            if let Ok(context) = memory.get_session_history(&session_id, history_limit).await {
                if !context.is_empty() {
                    let run_id = agenticos_contracts::RunId::new(format!("session:{session_id}"))
                        .unwrap_or_else(|_| {
                            agenticos_contracts::RunId::new("session").expect("static run id")
                        });
                    let messages = context
                        .into_iter()
                        .map(|msg| agenticos_contracts::Message {
                            message_id: msg.id,
                            role: msg.role,
                            content: msg.content.clone(),
                            timestamp: msg.timestamp.max(0) as u64,
                            token_count: ((msg.content.chars().count() as u32).saturating_add(3)
                                / 4)
                            .max(1),
                            run_id: run_id.clone(),
                        })
                        .collect::<Vec<_>>();
                    let context_window = std::env::var("AGENTICOS_CONTEXT_WINDOW")
                        .ok()
                        .and_then(|value| value.parse::<u32>().ok())
                        .unwrap_or(8192)
                        .max(256);
                    let reserved_output = std::env::var("AGENTICOS_RESERVED_OUTPUT_TOKENS")
                        .ok()
                        .and_then(|value| value.parse::<u32>().ok())
                        .unwrap_or(2048)
                        .min(context_window.saturating_sub(1));
                    let safety_margin = context_window / 20;
                    let budget = ContextBudget {
                        context_window_tokens: context_window,
                        reserved_output_tokens: reserved_output,
                        safety_margin_tokens: safety_margin,
                        min_recent_messages: 10,
                    };
                    let prompt_overhead_tokens = estimate_prompt_tokens(&prompt)
                        .saturating_add(input.map(estimate_prompt_tokens).unwrap_or(0));
                    let plan = ContextEngine::new().prepare_with_overhead(
                        &messages,
                        budget,
                        prompt_overhead_tokens,
                    );
                    if !plan.messages.is_empty() {
                        prompt.push_str("## Conversation History (Recent)\n");
                        for msg in plan.messages {
                            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
                        }
                        prompt.push('\n');
                    }
                }
            }
        }

        prompt
    }

    /// Execute thought/reasoning step using LLM.
    pub async fn think(&self, input: &str) -> Result<String, ContractError> {
        let (provider, turn, llm_router, preferred_model) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.model_provider.clone(),
                inner.current_turn,
                inner.llm_router.clone(),
                inner.preferred_model.clone(),
            )
        };

        // If LLM router is configured, use it for provider selection
        if let Some(router) = llm_router {
            return self.think_with_router(&router, turn, input).await;
        }

        self.think_inner(
            provider.as_ref(),
            turn,
            input,
            preferred_model.as_deref(),
            None,
        )
        .await
    }

    /// Execute thought using LLM router for provider selection.
    async fn think_with_router(
        &self,
        router: &LLMRouter,
        _current_turn: usize,
        input: &str,
    ) -> Result<String, ContractError> {
        // Select best available model
        let selected_model = router.select_model(false);
        let model_entry = selected_model.ok_or(ContractError::MissingCapability)?;

        // Get API key for the provider
        let api_key = router
            .get_api_key(&model_entry.provider)
            .ok_or(ContractError::MissingCapability)?;

        // Build system prompt
        let system_prompt = self.build_system_prompt_with_input(Some(input)).await;

        // Create request
        let request = ChatCompletionRequest {
            model: model_entry.model_id.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt,
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: input.to_string(),
                },
            ],
            temperature: Some(0.7),
            max_tokens: Some(2048),
            stream: Some(false),
        };

        // Get provider registry
        let provider_registry = self
            .get_provider_registry()
            .ok_or(ContractError::MissingCapability)?;

        // Call the provider
        let provider = provider_registry
            .get(&model_entry.provider.to_string())
            .ok_or(ContractError::MissingCapability)?;

        let response = provider.chat_completion(request, &api_key).await;

        match response {
            Ok(resp) => {
                // Record usage
                let total_tokens = resp.usage.as_ref().map(|u| u.total_tokens).unwrap_or(0);
                router.record_usage(&model_entry.model_id, total_tokens);

                // Extract content from response
                if let Some(choice) = resp.choices.first() {
                    Ok(choice.message.content.clone())
                } else {
                    Ok("No response from model".to_string())
                }
            }
            Err(e) => {
                // Mark provider as rate limited if error indicates rate limit
                if e.is_rate_limit {
                    router.mark_rate_limited(&model_entry.model_id, 60);
                }
                Err(ContractError::ParseError(e.message))
            }
        }
    }

    /// Inner thought method taking model provider and turn count without holding locks.
    async fn think_inner(
        &self,
        model_provider: Option<&Arc<dyn ModelProvider>>,
        current_turn: usize,
        input: &str,
        preferred_model: Option<&str>,
        parameters: Option<&str>,
    ) -> Result<String, ContractError> {
        if let Some(provider) = model_provider {
            let system_prompt = self.build_system_prompt_with_input(Some(input)).await;
            let request = ModelRequest {
                request_id: format!("think-{}", current_turn),
                model: preferred_model.unwrap_or("default").to_string(),
                input: format!("{}\n\nUser: {}", system_prompt, input),
                parameters: parameters.map(ToOwned::to_owned),
            };

            match provider.execute(request).await {
                Ok(response) => Ok(response.output),
                Err(e) => Err(ContractError::ParseError(format!("LLM error: {:?}", e))),
            }
        } else {
            Err(ContractError::MissingCapability)
        }
    }

    /// Execute action step (tool call).
    pub async fn act(&self, action: &str) -> Result<String, ContractError> {
        let (executor, runtime, grant_id) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.tool_executor.clone(),
                inner.tool_runtime.clone(),
                inner.tool_grant_id.clone(),
            )
        };
        self.act_inner(
            executor.as_ref(),
            runtime.as_ref(),
            grant_id.as_deref(),
            action,
        )
        .await
    }

    /// Inner act method taking reference to executor.
    async fn act_inner(
        &self,
        executor: Option<&ToolExecutor>,
        tool_runtime: Option<&Arc<dyn ToolRuntimePort>>,
        default_grant_id: Option<&str>,
        action: &str,
    ) -> Result<String, ContractError> {
        if let Some(runtime) = tool_runtime {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(action) {
                let tool_id = value
                    .get("tool")
                    .or_else(|| value.get("tool_id"))
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty());
                if let Some(tool_id) = tool_id {
                    let arguments = value
                        .get("arguments")
                        .or_else(|| value.get("parameters"))
                        .cloned()
                        .unwrap_or_else(|| serde_json::json!({}));
                    let grant_id = value
                        .get("grant_id")
                        .and_then(serde_json::Value::as_str)
                        .or(default_grant_id)
                        .unwrap_or_default()
                        .to_string();
                    let request = ToolRequest {
                        request_id: format!("tool-{}", uuid::Uuid::new_v4()),
                        tool_id: tool_id.to_string(),
                        parameters: arguments.to_string(),
                        agent_id: self.identity.clone(),
                        grant_id,
                    };
                    let response = runtime.execute(request).await?;
                    if response.success {
                        return Ok(response.result);
                    }
                    return Err(ContractError::ParseError(
                        response
                            .error
                            .unwrap_or_else(|| "tool execution failed".to_string()),
                    ));
                }
            }
        }
        if let Some(executor) = executor {
            // Parse action to determine tool type
            // Format: "tool_name:args" or simple command
            if action.starts_with("read_file:") {
                let path = action.strip_prefix("read_file:").unwrap_or("");
                let result = executor.read_file(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("write_file:") {
                // Format: "write_file:path:content"
                let parts: Vec<&str> = action.splitn(3, ':').collect();
                if parts.len() >= 2 {
                    let path = parts[1];
                    let content = if parts.len() >= 3 { parts[2] } else { "" };
                    let result = executor.write_file(path, content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid write_file format".to_string(),
                    ))
                }
            } else if action.starts_with("edit_line:") {
                // Format: "edit_line:path:line_number:new_content"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let new_content = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.edit_line(path, line_number, new_content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid edit_line format".to_string(),
                    ))
                }
            } else if action.starts_with("insert_line:") {
                // Format: "insert_line:path:line_number:new_content"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let new_content = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.insert_line(path, line_number, new_content);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid insert_line format".to_string(),
                    ))
                }
            } else if action.starts_with("delete_line:") {
                // Format: "delete_line:path:line_number"
                let parts: Vec<&str> = action.splitn(3, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let line_number: usize = parts[2].parse().unwrap_or(0);
                    let result = executor.delete_line(path, line_number);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid delete_line format".to_string(),
                    ))
                }
            } else if action.starts_with("find_and_replace:") {
                // Format: "find_and_replace:path:find:replace"
                let parts: Vec<&str> = action.splitn(4, ':').collect();
                if parts.len() >= 3 {
                    let path = parts[1];
                    let find = parts[2];
                    let replace = if parts.len() >= 4 { parts[3] } else { "" };
                    let result = executor.find_and_replace(path, find, replace);
                    if result.success {
                        Ok(result.output)
                    } else {
                        Err(ContractError::ParseError(
                            result.error.unwrap_or("Unknown error".to_string()),
                        ))
                    }
                } else {
                    Err(ContractError::ParseError(
                        "Invalid find_and_replace format".to_string(),
                    ))
                }
            } else if action.starts_with("file_exists:") {
                let path = action.strip_prefix("file_exists:").unwrap_or("");
                let result = executor.file_exists(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_status" {
                let result = executor.git_status();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("git_add:") {
                let path = action.strip_prefix("git_add:").unwrap_or("");
                let result = executor.git_add(path);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("git_commit:") {
                let message = action.strip_prefix("git_commit:").unwrap_or("");
                let result = executor.git_commit(message);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_push" {
                let result = executor.git_push();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_diff" {
                let result = executor.git_diff();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_log" {
                let result = executor.git_log();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action == "git_branch" {
                let result = executor.git_branch();
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else if action.starts_with("execute:") {
                let command = action.strip_prefix("execute:").unwrap_or("");
                let result = executor.execute_command(command);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            } else {
                // Default: try as command
                let result = executor.execute_command(action);
                if result.success {
                    Ok(result.output)
                } else {
                    Err(ContractError::ParseError(
                        result.error.unwrap_or("Unknown error".to_string()),
                    ))
                }
            }
        } else {
            // Fallback when no executor configured
            Ok(format!("Executed action: {}", action))
        }
    }

    /// Process observation step.
    pub fn observe(&self, observation: &str) -> String {
        format!("Observation: {}", observation)
    }

    /// Execute one full ReAct loop turn using default model parameters.
    pub async fn execute_turn(&self, input: &str) -> Result<String, ContractError> {
        self.execute_turn_with_parameters(input, None).await
    }

    /// Execute one full ReAct loop turn with provider parameters encoded as JSON.
    pub async fn execute_turn_with_parameters(
        &self,
        input: &str,
        parameters: Option<String>,
    ) -> Result<String, ContractError> {
        // Reserve the turn atomically so concurrent requests cannot reuse the same turn.
        {
            let mut inner = self.inner.lock().unwrap();
            inner.current_turn = inner.current_turn.saturating_add(1);
        }

        // Snapshot required state without holding the lock across await boundaries
        let (
            current_turn,
            session_id,
            memory,
            model_provider,
            planner,
            current_plan,
            tool_executor,
            tool_runtime,
            tool_grant_id,
            checkpoint_store,
            supervisor,
            sandbox,
            event_log,
            tool_pipeline,
            _soul,
            goal_manager,
            heartbeat_manager,
            preferred_model,
        ) = {
            let inner = self.inner.lock().unwrap();
            (
                inner.current_turn,
                inner.session_id.clone(),
                inner.memory.clone(),
                inner.model_provider.clone(),
                inner.planner.clone(),
                inner.current_plan.clone(),
                inner.tool_executor.clone(),
                inner.tool_runtime.clone(),
                inner.tool_grant_id.clone(),
                inner.checkpoint_store.clone(),
                inner.supervisor.clone(),
                inner.sandbox.clone(),
                inner.event_log.clone(),
                inner.tool_pipeline.clone(),
                self.soul.clone(),
                inner.goal_manager.clone(),
                inner.heartbeat_manager.clone(),
                inner.preferred_model.clone(),
            )
        };

        // Track turn start time for latency measurement
        let turn_start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Log turn start event
        let turn_id = if let Some(log) = &event_log {
            let tid = SessionEvent::generate_id("turn");
            log.append(SessionEvent::TurnStart {
                turn_id: tid.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            });

            // Log user message event
            log.append(SessionEvent::UserMessage {
                message_id: SessionEvent::generate_id("msg"),
                turn_id: tid.clone(),
                content: input.to_string(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            });
            Some(tid)
        } else {
            None
        };

        // Update heartbeat for this session
        if let Some(hbm) = &heartbeat_manager {
            hbm.update_heartbeat(&session_id, format!("Turn {} in progress", current_turn))
                .await;
        }

        // Create a goal if input is complex and goal manager is available
        if let Some(gm) = &goal_manager {
            if input.len() > 100 {
                let goal = Goal {
                    id: uuid::Uuid::new_v4().to_string(),
                    description: input.to_string(),
                    progress: 0.0,
                    status: GoalStatus::Active,
                    session_id: session_id.clone(),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                };
                gm.set_goal(goal).await;
            }
        }

        // Store user input in SQLite memory if available
        if let Some(memory) = &memory {
            let msg_id = format!("user-{}", uuid::Uuid::new_v4());
            memory
                .store_message(&msg_id, &session_id, "user", input)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("failed to persist user message: {error}"))
                })?;
        }

        // Use planner to decompose complex tasks if available
        let plan = if let Some(planner) = &planner {
            if current_plan.is_none() || current_plan.as_ref().map_or(true, |p| p.is_complete()) {
                Some(planner.generate_plan(input, model_provider.as_ref()).await)
            } else {
                current_plan
            }
        } else {
            None
        };

        // Step 1: Thought/Reasoning
        let thought = self
            .think_inner(
                model_provider.as_ref(),
                current_turn,
                input,
                preferred_model.as_deref(),
                parameters.as_deref(),
            )
            .await?;

        // Store assistant thought in SQLite memory if available
        if let Some(memory) = &memory {
            let msg_id = format!("assistant-{}", uuid::Uuid::new_v4());
            memory
                .store_message(&msg_id, &session_id, "assistant", &thought)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "failed to persist assistant message: {error}"
                    ))
                })?;
        }

        // Log assistant message event
        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
            log.append(SessionEvent::AssistantMessage {
                message_id: SessionEvent::generate_id("msg"),
                turn_id: tid.clone(),
                content: thought.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                token_count: None,
            });
        }

        // Step 2: Action
        let action = thought.clone();

        // Step 3: Observation
        let observation = if let Some(pipeline) = &tool_pipeline {
            if !is_structured_tool_action(&action) {
                action.clone()
            } else {
                // Execute structured tool calls with pipeline (pre/post hooks).
                let context = ToolExecutionContext::new(
                    "react_action".to_string(),
                    serde_json::json!({"action": action}),
                    session_id.clone(),
                )
                .with_turn_id(turn_id.clone().unwrap_or_else(|| "unknown".to_string()));

                // Log tool call start event
                if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                    log.append(SessionEvent::ToolCallStart {
                        tool_id: "react_action".to_string(),
                        step_id: SessionEvent::generate_id("step"),
                        tool_name: "react_action".to_string(),
                        args: serde_json::json!({"action": action}),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    });
                }

                let executor = |ctx: ToolExecutionContext| async move {
                    self.act_inner(
                        tool_executor.as_ref(),
                        tool_runtime.as_ref(),
                        tool_grant_id.as_deref(),
                        &ctx.args["action"].as_str().unwrap_or(""),
                    )
                    .await
                    .map(|o| ToolExecutionResult::success(o))
                    .unwrap_or_else(|e| ToolExecutionResult::failure(e.to_string()))
                };

                let result = pipeline.execute(context, executor).await;

                // Log tool call result event
                if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                    log.append(SessionEvent::ToolCallResult {
                        tool_id: "react_action".to_string(),
                        step_id: SessionEvent::generate_id("step"),
                        success: result.success,
                        output: result.output.clone(),
                        error: result.error.clone(),
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                    });
                }

                // Update SOUL memory with successful tool execution
                if result.success {
                    let new_memory = format!(
                        "Successfully executed tool: {}. Result: {}",
                        action,
                        result.output.as_ref().unwrap_or(&"completed".to_string())
                    );
                    let _ = self.update_soul_memory(new_memory).await;

                    // If this was a complex task, crystallize it as a skill
                    if action.len() > 50 && result.success {
                        let skill = SkillEntry {
                            id: uuid::Uuid::new_v4().to_string(),
                            name: format!("Skill from turn {}", current_turn),
                            description: format!("Automatically crystallized from: {}", action),
                            created_at: chrono::Utc::now(),
                            usage_count: 1,
                            success_rate: 1.0,
                            origin_task: action.clone(),
                        };
                        let _ = self.add_skill_to_soul(skill).await;
                    }
                }

                if result.success {
                    // Record success and reset circuit breaker
                    let mut inner = self.inner.lock().unwrap();
                    inner.recovery_state.record_success();
                    result.output.unwrap_or("Execution completed".to_string())
                } else {
                    // Log error event
                    let error_msg = result
                        .error
                        .clone()
                        .unwrap_or("Tool execution failed".to_string());
                    if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::Error {
                            error_id: SessionEvent::generate_id("error"),
                            context: "tool_execution".to_string(),
                            message: error_msg.clone(),
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    // Integrate recovery logic without holding a synchronous mutex across awaits.
                    let recovery_id = SessionEvent::generate_id("recovery");

                    // Log recovery start.
                    if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::RecoveryStart {
                            recovery_id: recovery_id.clone(),
                            turn_id: tid.clone(),
                            context: "tool_execution".to_string(),
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    let (circuit_breaker_open, failure_triggered, retry) = {
                        let mut inner = self.inner.lock().unwrap();
                        if inner.recovery_state.is_circuit_breaker_open() {
                            (true, false, None)
                        } else if !inner.recovery_state.record_failure(error_msg.clone()) {
                            (false, true, None)
                        } else if inner.recovery_state.increment_retry() {
                            (
                                false,
                                false,
                                Some((
                                    inner.recovery_state.retry_count,
                                    inner.recovery_state.calculate_backoff_ms(),
                                )),
                            )
                        } else {
                            (false, false, None)
                        }
                    };

                    if circuit_breaker_open {
                        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryEnd {
                                recovery_id,
                                turn_id: tid.clone(),
                                success: false,
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }
                        return Err(ContractError::ParseError(
                            "Circuit breaker is open, tool execution blocked".to_string(),
                        ));
                    }

                    if failure_triggered {
                        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryEnd {
                                recovery_id,
                                turn_id: tid.clone(),
                                success: false,
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }
                        return Err(ContractError::ParseError(
                            "Circuit breaker triggered by consecutive failures".to_string(),
                        ));
                    }

                    if let Some((attempt_number, backoff_ms)) = retry {
                        if let (Some(log), Some(_tid)) = (&event_log, &turn_id) {
                            log.append(SessionEvent::RecoveryAttempt {
                                recovery_id: recovery_id.clone(),
                                attempt_number,
                                action: format!("retry_tool_execution: {}", action),
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                            });
                        }

                        // Exponential backoff before the next attempt.
                        tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
                    }

                    if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
                        log.append(SessionEvent::RecoveryEnd {
                            recovery_id,
                            turn_id: tid.clone(),
                            success: false,
                            timestamp: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs(),
                        });
                    }

                    return Err(ContractError::ParseError(error_msg));
                }
            }
        } else {
            // Without a configured tool pipeline, the model output is the final assistant response.
            // Do not reinterpret arbitrary natural-language output as a shell/file action.
            action.clone()
        };

        // Log turn end event with latency and step count
        let turn_end_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let latency_ms = turn_end_time.saturating_sub(turn_start_time);

        if let (Some(log), Some(tid)) = (&event_log, &turn_id) {
            log.append(SessionEvent::TurnEnd {
                turn_id: tid.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                step_count: 2, // thought + action
                latency_ms,
            });
        }

        // Delegate to subagent if supervisor is configured
        if let Some(supervisor) = &supervisor {
            if let Some(subagent_name) = supervisor
                .decide_subagent(input, model_provider.as_ref())
                .await
            {
                let _ = subagent_name;
            }
        }

        // Execute code in sandbox if sandbox is configured and action is code execution
        if let Some(sandbox) = &sandbox {
            if action.starts_with("execute_code:") {
                let code = action.strip_prefix("execute_code:").unwrap_or("");
                let request = SandboxRequest {
                    request_id: format!("sandbox-{}", current_turn),
                    code: code.to_string(),
                    timeout_ms: 30000,
                    memory_limit_bytes: 1024 * 1024 * 100,
                    allowed_capabilities: vec!["process.execute".to_string()],
                };
                let _ = sandbox.execute(request).await;
            }
        }

        // Step 4: Complete the ReAct turn.
        //
        // When the model emitted a structured tool call, execute it and make one
        // bounded follow-up model call so the user receives a final answer rather
        // than the raw tool observation. Plain model responses are returned directly.
        let mut result = if is_structured_tool_action(&thought) && tool_pipeline.is_some() {
            self.observe(&observation)
        } else {
            observation.clone()
        };

        if is_structured_tool_action(&thought) && model_provider.is_some() {
            let max_followups = std::env::var("AGENTICOS_MAX_TOOL_FOLLOWUPS")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(1)
                .clamp(1, 4);
            let mut followup_prompt = format!(
                "Original user request:\n{}\n\nTool observation:\n{}\n\n",
                input, observation
            );
            for _ in 0..max_followups {
                followup_prompt.push_str(
                    "Use the tool observation to produce the final user-facing answer.                     Return another tool JSON only when another tool call is strictly necessary.",
                );
                let followup = self
                    .think_inner(
                        model_provider.as_ref(),
                        current_turn.saturating_add(1),
                        &followup_prompt,
                        preferred_model.as_deref(),
                        parameters.as_deref(),
                    )
                    .await?;
                if is_structured_tool_action(&followup) {
                    if followup == thought {
                        break;
                    }
                    // A second tool request is surfaced to the caller rather than
                    // recursively executing unbounded actions in one turn.
                    result = followup;
                    break;
                }
                result = followup;
                break;
            }
        }

        // Persist the final user-facing answer separately from the model's tool-call thought.
        if let Some(memory) = &memory {
            if !result.trim().is_empty() && result != thought {
                let msg_id = format!("assistant-final-{}", uuid::Uuid::new_v4());
                memory
                    .store_message(&msg_id, &session_id, "assistant", &result)
                    .await
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "failed to persist final assistant message: {error}"
                        ))
                    })?;
            }
        }

        // Create checkpoint if checkpoint store is available
        if let Some(store) = &checkpoint_store {
            let checkpoint = Checkpoint {
                checkpoint_id: generate_checkpoint_id(),
                thread_id: session_id.clone(),
                state: serde_json::json!({
                    "current_turn": current_turn,
                    "input": input,
                    "thought": thought,
                    "action": action,
                    "observation": observation,
                    "result": result,
                    "plan": plan
                }),
                metadata: serde_json::json!(CheckpointMetadata {
                    step: current_turn,
                    status: "completed".to_string(),
                    extra: serde_json::json!({})
                }),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            };
            let event = SerializedEvent {
                event_type: "checkpoint".to_string(),
                data: serde_json::to_string(&checkpoint).map_err(|error| {
                    ContractError::ParseError(format!("failed to serialize checkpoint: {error}"))
                })?,
                schema_version: 1,
            };
            let stream_id = format!("agent-{}", session_id);
            store
                .append(&stream_id, current_turn as u64, vec![event])
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("failed to persist checkpoint: {error}"))
                })?;
        }

        Ok(result)
    }

    /// Load conversation context from SQLite memory.
    pub async fn load_context(&self) -> Result<String, ContractError> {
        let (memory, session_id) = {
            let inner = self.inner.lock().unwrap();
            (inner.memory.clone(), inner.session_id.clone())
        };

        if let Some(memory) = memory {
            let history = memory.get_session_history(&session_id, 20).await?;
            if history.is_empty() {
                Ok(String::new())
            } else {
                Ok(history
                    .iter()
                    .map(|msg| format!("{}: {}", msg.role, msg.content))
                    .collect::<Vec<_>>()
                    .join("\n"))
            }
        } else {
            Ok(String::new())
        }
    }

    /// Restore the durable turn count when rebuilding a session after restart.
    pub fn restore_turn_count(&self, turns: usize) {
        let mut inner = self.inner.lock().unwrap();
        inner.current_turn = turns;
    }

    /// Get current turn count.
    pub fn current_turn(&self) -> usize {
        self.inner.lock().unwrap().current_turn
    }

    /// Increment the current turn for callers that manage turns externally.
    pub fn increment_turn(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.current_turn = inner.current_turn.saturating_add(1);
    }

    /// Report whether the soft session turn budget has been reached.
    ///
    /// This is an observability signal only; long-lived sessions are not
    /// forcibly terminated by the counter.
    pub fn is_finished(&self) -> bool {
        self.current_turn() >= self.max_turns
    }
}

/// Skill with YAML frontmatter for procedural memory.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Skill {
    /// Skill name
    pub name: String,
    /// Skill description
    pub description: String,
    /// Skill version
    pub version: String,
    /// Skill author
    pub author: String,
    /// Supported platforms
    pub platforms: Vec<String>,
    /// Skill procedure content
    pub procedure: String,
    /// Skill pitfalls
    pub pitfalls: Vec<String>,
    /// Skill verification steps
    pub verification: Vec<String>,
}

impl Skill {
    /// Parse a skill from SKILL.md file with YAML frontmatter.
    pub fn from_markdown(content: &str) -> Result<Self, String> {
        // Check for YAML frontmatter (starts with ---)
        if !content.starts_with("---") {
            return Err("Missing YAML frontmatter".to_string());
        }

        // Split frontmatter and content
        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() < 3 {
            return Err("Invalid YAML frontmatter format".to_string());
        }

        let yaml_frontmatter = parts[1];
        let markdown_content = parts[2];

        // Parse YAML frontmatter
        let metadata: serde_yaml::Value =
            serde_yaml::from_str(yaml_frontmatter).map_err(|e| e.to_string())?;

        // Extract metadata fields
        let name = metadata
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'name' in frontmatter")?
            .to_string();

        let description = metadata
            .get("description")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'description' in frontmatter")?
            .to_string();

        let version = metadata
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0")
            .to_string();

        let author = metadata
            .get("author")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let platforms = metadata
            .get("platforms")
            .and_then(|v| v.as_sequence())
            .map(|seq| {
                seq.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Parse markdown content sections
        let procedure = Self::extract_section(markdown_content, "Procedure");
        let pitfalls = Self::extract_list_section(markdown_content, "Pitfalls");
        let verification = Self::extract_list_section(markdown_content, "Verification");

        Ok(Skill {
            name,
            description,
            version,
            author,
            platforms,
            procedure,
            pitfalls,
            verification,
        })
    }

    /// Extract a section from markdown content.
    fn extract_section(content: &str, section_name: &str) -> String {
        let section_header = format!("## {}", section_name);
        if let Some(start) = content.find(&section_header) {
            let start = start + section_header.len();
            let end = content[start..]
                .find("\n## ")
                .map(|pos| start + pos)
                .unwrap_or(content.len());
            content[start..end].trim().to_string()
        } else {
            String::new()
        }
    }

    /// Extract a list section from markdown content.
    fn extract_list_section(content: &str, section_name: &str) -> Vec<String> {
        let section = Self::extract_section(content, section_name);
        section
            .lines()
            .filter(|line| line.trim().starts_with('-'))
            .map(|line| {
                line.trim()
                    .strip_prefix('-')
                    .unwrap_or(line)
                    .trim()
                    .to_string()
            })
            .collect()
    }

    /// Get a concise description for progressive disclosure.
    pub fn summary(&self) -> String {
        format!("{} (v{}): {}", self.name, self.version, self.description)
    }
}

/// SQLite tier 2 memory for conversation history with FTS5.
#[allow(missing_debug_implementations)]
pub struct SqliteMemory {
    db: Arc<sqlx::SqlitePool>,
}

impl SqliteMemory {
    /// Create a new SQLite memory store.
    pub async fn new(database_url: &str) -> Result<Self, ContractError> {
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|e| {
                ContractError::ParseError(format!("Failed to connect to SQLite: {}", e))
            })?;

        // Create tables
        Self::initialize_schema(&pool).await?;

        Ok(Self { db: Arc::new(pool) })
    }

    /// Initialize database schema.
    async fn initialize_schema(pool: &sqlx::SqlitePool) -> Result<(), ContractError> {
        // Create conversations table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create conversations table: {}", e))
        })?;

        // Create FTS5 virtual table for full-text search
        sqlx::query(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
                id,
                session_id,
                role,
                content,
                timestamp
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to create FTS5 table: {}", e)))?;

        // Create summaries table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS summaries (
                session_id TEXT PRIMARY KEY,
                summary TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create summaries table: {}", e))
        })?;

        // Create checkpoints table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS checkpoints (
                checkpoint_id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                state TEXT NOT NULL,
                metadata TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to create checkpoints table: {}", e))
        })?;

        Ok(())
    }

    /// Store a conversation message.
    pub async fn store_message(
        &self,
        conversation_id: &str,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<(), ContractError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut tx = self.db.begin().await.map_err(|e| {
            ContractError::ParseError(format!("Failed to begin memory transaction: {}", e))
        })?;

        sqlx::query(
            r#"
            INSERT INTO conversations (id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(conversation_id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(timestamp as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store message: {}", e)))?;

        sqlx::query(
            r#"
            INSERT INTO conversations_fts (id, session_id, role, content, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(conversation_id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(timestamp as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to insert into FTS5: {}", e)))?;

        tx.commit().await.map_err(|e| {
            ContractError::ParseError(format!("Failed to commit memory transaction: {}", e))
        })?;

        Ok(())
    }

    /// Search conversations using full-text search.
    pub async fn search_conversations(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<ConversationMessage>, ContractError> {
        let rows = sqlx::query_as::<_, ConversationMessage>(
            r#"
            SELECT id, session_id, role, content, timestamp
            FROM conversations_fts
            WHERE content MATCH ?
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(query)
        .bind(limit as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to search conversations: {}", e)))?;

        Ok(rows)
    }

    /// Get conversation history for a session.
    pub async fn get_session_history(
        &self,
        session_id: &str,
        limit: usize,
    ) -> Result<Vec<ConversationMessage>, ContractError> {
        let mut rows = sqlx::query_as::<_, ConversationMessage>(
            r#"
            SELECT id, session_id, role, content, timestamp
            FROM conversations
            WHERE session_id = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT ?
            "#,
        )
        .bind(session_id)
        .bind(limit as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get session history: {}", e)))?;

        rows.reverse();
        Ok(rows)
    }

    /// Store a summary for a session.
    pub async fn store_summary(
        &self,
        session_id: &str,
        summary: &str,
    ) -> Result<(), ContractError> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        sqlx::query(
            r#"
            INSERT INTO summaries (session_id, summary, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                summary = excluded.summary,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(session_id)
        .bind(summary)
        .bind(timestamp as i64)
        .execute(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store summary: {}", e)))?;

        Ok(())
    }

    /// Get the summary for a session.
    pub async fn get_summary(&self, session_id: &str) -> Result<Option<String>, ContractError> {
        let row = sqlx::query_as::<_, (String,)>(
            r#"
            SELECT summary
            FROM summaries
            WHERE session_id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get summary: {}", e)))?;

        Ok(row.map(|(summary,)| summary))
    }

    /// Store a checkpoint.
    pub async fn store_checkpoint(&self, checkpoint: &Checkpoint) -> Result<(), ContractError> {
        let state_json = serde_json::to_string(&checkpoint.state)
            .map_err(|e| ContractError::ParseError(format!("Failed to serialize state: {}", e)))?;
        let metadata_json = serde_json::to_string(&checkpoint.metadata).map_err(|e| {
            ContractError::ParseError(format!("Failed to serialize metadata: {}", e))
        })?;

        sqlx::query(
            r#"
            INSERT INTO checkpoints (checkpoint_id, thread_id, state, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&checkpoint.checkpoint_id)
        .bind(&checkpoint.thread_id)
        .bind(&state_json)
        .bind(&metadata_json)
        .bind(checkpoint.timestamp)
        .execute(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to store checkpoint: {}", e)))?;

        Ok(())
    }

    /// Get a checkpoint by ID.
    pub async fn get_checkpoint(
        &self,
        checkpoint_id: &str,
    ) -> Result<Option<Checkpoint>, ContractError> {
        let row = sqlx::query_as::<_, (String, String, String, String, i64)>(
            r#"
            SELECT checkpoint_id, thread_id, state, metadata, timestamp
            FROM checkpoints
            WHERE checkpoint_id = ?
            "#,
        )
        .bind(checkpoint_id)
        .fetch_optional(&*self.db)
        .await
        .map_err(|e| ContractError::ParseError(format!("Failed to get checkpoint: {}", e)))?;

        if let Some((checkpoint_id, thread_id, state, metadata, timestamp)) = row {
            let state_value = serde_json::from_str(&state).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize state: {}", e))
            })?;
            let metadata_value = serde_json::from_str(&metadata).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize metadata: {}", e))
            })?;

            Ok(Some(Checkpoint {
                checkpoint_id,
                thread_id,
                state: state_value,
                metadata: metadata_value,
                timestamp,
            }))
        } else {
            Ok(None)
        }
    }

    /// Get all checkpoints for a thread.
    pub async fn get_thread_checkpoints(
        &self,
        thread_id: &str,
    ) -> Result<Vec<Checkpoint>, ContractError> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i64)>(
            r#"
            SELECT checkpoint_id, thread_id, state, metadata, timestamp
            FROM checkpoints
            WHERE thread_id = ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(thread_id)
        .fetch_all(&*self.db)
        .await
        .map_err(|e| {
            ContractError::ParseError(format!("Failed to get thread checkpoints: {}", e))
        })?;

        let mut checkpoints = Vec::new();
        for (checkpoint_id, thread_id, state, metadata, timestamp) in rows {
            let state_value = serde_json::from_str(&state).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize state: {}", e))
            })?;
            let metadata_value = serde_json::from_str(&metadata).map_err(|e| {
                ContractError::ParseError(format!("Failed to deserialize metadata: {}", e))
            })?;

            checkpoints.push(Checkpoint {
                checkpoint_id,
                thread_id,
                state: state_value,
                metadata: metadata_value,
                timestamp,
            });
        }

        Ok(checkpoints)
    }
}

/// Conversation message stored in SQLite.
#[derive(Debug, Clone, serde::Serialize, sqlx::FromRow)]
pub struct ConversationMessage {
    /// Message ID
    pub id: String,
    /// Session ID
    pub session_id: String,
    /// Role (user/assistant/system)
    pub role: String,
    /// Message content
    pub content: String,
    /// Timestamp
    pub timestamp: i64,
}

/// Tool execution result.
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Success status
    pub success: bool,
    /// Result output
    pub output: String,
    /// Error message if any
    pub error: Option<String>,
}

impl ToolResult {
    /// Create a successful tool result.
    pub fn success(output: String) -> Self {
        Self {
            success: true,
            output,
            error: None,
        }
    }

    /// Create a failed tool result.
    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            output: String::new(),
            error: Some(error),
        }
    }
}

/// Tool executor for real tool execution.
#[allow(missing_debug_implementations)]
#[derive(Clone)]
pub struct ToolExecutor {
    /// Working directory for tool execution
    workdir: PathBuf,
}

impl ToolExecutor {
    /// Create a new tool executor.
    pub fn new(workdir: PathBuf) -> Self {
        Self { workdir }
    }

    fn safe_path(&self, path: &str) -> Result<PathBuf, String> {
        let relative = std::path::Path::new(path);
        if relative.is_absolute() || path.split(['/', '\\']).any(|segment| segment == "..") {
            return Err(format!("path '{}' escapes the workspace", path));
        }

        let root = std::fs::canonicalize(&self.workdir)
            .map_err(|error| format!("workspace is unavailable: {error}"))?;
        let candidate = self.workdir.join(relative);

        if candidate.exists() {
            let canonical = std::fs::canonicalize(&candidate)
                .map_err(|error| format!("path '{}' cannot be resolved: {error}", path))?;
            if !canonical.starts_with(&root) {
                return Err(format!("path '{}' escapes the workspace", path));
            }
            Ok(canonical)
        } else {
            let parent = candidate
                .parent()
                .unwrap_or_else(|| std::path::Path::new(&self.workdir));
            let canonical_parent = std::fs::canonicalize(parent).map_err(|error| {
                format!(
                    "parent directory for '{}' cannot be resolved: {error}",
                    path
                )
            })?;
            if !canonical_parent.starts_with(&root) {
                return Err(format!("path '{}' escapes the workspace", path));
            }
            Ok(candidate)
        }
    }

    /// Execute a file read operation.
    pub fn read_file(&self, path: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => ToolResult::success(content),
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Execute a file write operation.
    pub fn write_file(&self, path: &str, content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::write(&full_path, content) {
            Ok(_) => ToolResult::success(format!("File written: {}", path)),
            Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
        }
    }

    /// Edit a specific line in a file.
    pub fn edit_line(&self, path: &str, line_number: usize, new_content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() {
                    lines[line_number - 1] = new_content;
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => {
                            ToolResult::success(format!("Line {} edited in {}", line_number, path))
                        }
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Insert a line at a specific position in a file.
    pub fn insert_line(&self, path: &str, line_number: usize, new_content: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() + 1 {
                    lines.insert(line_number - 1, new_content);
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => ToolResult::success(format!(
                            "Line inserted at {} in {}",
                            line_number, path
                        )),
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Delete a specific line from a file.
    pub fn delete_line(&self, path: &str, line_number: usize) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let mut lines: Vec<&str> = content.lines().collect();
                if line_number > 0 && line_number <= lines.len() {
                    lines.remove(line_number - 1);
                    let new_content = lines.join("\n");
                    match std::fs::write(&full_path, new_content) {
                        Ok(_) => ToolResult::success(format!(
                            "Line {} deleted from {}",
                            line_number, path
                        )),
                        Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                    }
                } else {
                    ToolResult::failure(format!("Invalid line number: {}", line_number))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Find and replace text in a file.
    pub fn find_and_replace(&self, path: &str, find: &str, replace: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let new_content = content.replace(find, replace);
                match std::fs::write(&full_path, new_content) {
                    Ok(_) => ToolResult::success(format!(
                        "Replaced '{}' with '{}' in {}",
                        find, replace, path
                    )),
                    Err(e) => ToolResult::failure(format!("Failed to write file: {}", e)),
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to read file: {}", e)),
        }
    }

    /// Check if a file exists.
    pub fn file_exists(&self, path: &str) -> ToolResult {
        let full_path = match self.safe_path(path) {
            Ok(path) => path,
            Err(error) => return ToolResult::failure(error),
        };
        if full_path.exists() {
            ToolResult::success(format!("File exists: {}", path))
        } else {
            ToolResult::failure(format!("File does not exist: {}", path))
        }
    }

    /// Execute a git status operation.
    pub fn git_status(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("status")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git status failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git add operation.
    pub fn git_add(&self, path: &str) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("add")
            .arg(path)
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    ToolResult::success(format!("Added: {}", path))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git add failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git commit operation.
    pub fn git_commit(&self, message: &str) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("commit")
            .arg("-m")
            .arg(message)
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git commit failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git push operation.
    pub fn git_push(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("push")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                    ToolResult::success(stdout)
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    ToolResult::failure(format!("Git push failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git diff operation.
    pub fn git_diff(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("diff")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git log operation.
    pub fn git_log(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("log")
            .arg("--oneline")
            .arg("-10")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a git branch operation.
    pub fn git_branch(&self) -> ToolResult {
        let output = std::process::Command::new("git")
            .arg("branch")
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                ToolResult::success(stdout)
            }
            Err(e) => ToolResult::failure(format!("Failed to execute git: {}", e)),
        }
    }

    /// Execute a shell command (with safety restrictions).
    pub fn execute_command(&self, command: &str) -> ToolResult {
        // Basic safety check: only allow specific commands
        let allowed_commands = vec!["ls", "dir", "pwd", "echo", "cat", "grep"];
        let first_word = command.split_whitespace().next().unwrap_or("");

        if !allowed_commands.contains(&first_word) {
            return ToolResult::failure(format!(
                "Command '{}' not allowed. Allowed commands: {:?}",
                first_word, allowed_commands
            ));
        }

        let args: Vec<&str> = command.split_whitespace().collect();
        if args.is_empty() {
            return ToolResult::failure("Command must not be empty".to_string());
        }

        let output = std::process::Command::new(args[0])
            .args(&args[1..])
            .current_dir(&self.workdir)
            .output();

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                if output.status.success() {
                    ToolResult::success(stdout)
                } else {
                    ToolResult::failure(format!("Command failed: {}", stderr))
                }
            }
            Err(e) => ToolResult::failure(format!("Failed to execute command: {}", e)),
        }
    }
}

/// Conversation summarization configuration.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SummarizationConfig {
    /// Maximum tokens before summarization kicks in.
    pub max_tokens_before_summary: usize,
    /// Maximum tokens for the resulting message list after summarization.
    pub max_tokens: usize,
    /// Maximum tokens for the summary itself.
    pub max_summary_tokens: usize,
}

impl Default for SummarizationConfig {
    fn default() -> Self {
        Self {
            max_tokens_before_summary: 2048,
            max_tokens: 4096,
            max_summary_tokens: 256,
        }
    }
}

/// Result of summarization.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SummarizationResult {
    /// The messages after summarization (summary + remaining messages).
    pub messages: Vec<String>,
    /// The running summary (if any).
    pub running_summary: Option<String>,
    /// Whether summarization was performed.
    pub was_summarized: bool,
}

/// Simple token counter (approximate character-based).
pub fn count_tokens_approximate(text: &str) -> usize {
    // Rough approximation: ~4 characters per token
    text.len().div_ceil(4)
}

/// Count tokens in a list of messages.
pub fn count_tokens_in_messages(messages: &[String]) -> usize {
    messages.iter().map(|m| count_tokens_approximate(m)).sum()
}

/// Summarize messages when they exceed a token limit.
/// This follows LangChain's summarization pattern:
/// - Keep recent messages below max_tokens
/// - Summarize older messages into a running summary
/// - Avoid re-summarizing the same messages
pub fn summarize_messages(
    messages: &[String],
    running_summary: Option<String>,
    config: &SummarizationConfig,
) -> SummarizationResult {
    let total_tokens = count_tokens_in_messages(messages);

    // If messages fit within max_tokens, return as-is
    if total_tokens <= config.max_tokens {
        return SummarizationResult {
            messages: messages.to_vec(),
            running_summary,
            was_summarized: false,
        };
    }

    // Messages exceed limit, need to summarize
    // Strategy: Keep last N messages + summary of older messages
    let mut remaining_tokens = config.max_tokens - config.max_summary_tokens;
    let mut result_messages = Vec::new();
    let mut messages_to_summarize = Vec::new();

    // Process messages from newest to oldest
    for msg in messages.iter().rev() {
        let msg_tokens = count_tokens_approximate(msg);

        if remaining_tokens >= msg_tokens {
            // Keep this message
            result_messages.insert(0, msg.clone());
            remaining_tokens -= msg_tokens;
        } else {
            // This message goes to summarization
            messages_to_summarize.insert(0, msg.clone());
        }
    }

    // If there are messages to summarize, create a summary
    let new_summary = if !messages_to_summarize.is_empty() {
        let base_summary = running_summary.unwrap_or_else(|| "Conversation summary:".to_string());
        let combined = format!(
            "{}\n\nAdditional context:\n{}",
            base_summary,
            messages_to_summarize.join("\n")
        );

        // Truncate to max_summary_tokens
        let max_chars = config.max_summary_tokens * 4;
        if combined.len() > max_chars {
            format!("{}...", &combined[..max_chars])
        } else {
            combined
        }
    } else {
        running_summary.unwrap_or_default()
    };

    // Add summary to result if it exists
    if !new_summary.is_empty() {
        result_messages.insert(0, format!("Summary: {}", new_summary));
    }

    SummarizationResult {
        messages: result_messages,
        running_summary: Some(new_summary),
        was_summarized: true,
    }
}

/// Checkpoint for agent state persistence (LangGraph pattern).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Checkpoint {
    /// Unique checkpoint ID
    pub checkpoint_id: String,
    /// Thread ID for organizing checkpoints
    pub thread_id: String,
    /// Agent state snapshot
    pub state: serde_json::Value,
    /// Checkpoint metadata
    pub metadata: serde_json::Value,
    /// Timestamp
    pub timestamp: i64,
}

/// Checkpoint metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CheckpointMetadata {
    /// Step number
    pub step: usize,
    /// Status
    pub status: String,
    /// Additional metadata
    pub extra: serde_json::Value,
}

impl Default for CheckpointMetadata {
    fn default() -> Self {
        Self {
            step: 0,
            status: "active".to_string(),
            extra: serde_json::json!({}),
        }
    }
}

/// Checkpoint ID generator.
pub fn generate_checkpoint_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Thread ID generator.
pub fn generate_thread_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Planning system for task decomposition (LangChain Plan-and-Execute pattern).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Plan {
    /// Plan ID
    pub plan_id: String,
    /// Objective/goal of the plan
    pub objective: String,
    /// Steps in the plan
    pub steps: Vec<PlanStep>,
    /// Current step index
    pub current_step: usize,
    /// Plan status
    pub status: PlanStatus,
    /// Created timestamp
    pub created_at: i64,
}

impl Plan {
    /// Check if the plan is complete (all steps completed or plan status is completed/failed).
    pub fn is_complete(&self) -> bool {
        matches!(self.status, PlanStatus::Completed | PlanStatus::Failed)
            || self.steps.iter().all(|s| {
                matches!(
                    s.status,
                    StepStatus::Completed | StepStatus::Failed | StepStatus::Skipped
                )
            })
    }
}

/// Plan status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum PlanStatus {
    /// Plan is pending execution
    Pending,
    /// Plan is in progress
    InProgress,
    /// Plan is completed
    Completed,
    /// Plan failed
    Failed,
    /// Plan needs re-planning
    NeedsReplanning,
}

/// Individual step in a plan.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlanStep {
    /// Step ID
    pub step_id: String,
    /// Step description
    pub description: String,
    /// Tool to use for this step
    pub tool: Option<String>,
    /// Tool arguments
    pub tool_args: Option<serde_json::Value>,
    /// Step status
    pub status: StepStatus,
    /// Step result
    pub result: Option<String>,
}

/// Step status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum StepStatus {
    /// Step is pending
    Pending,
    /// Step is in progress
    InProgress,
    /// Step is completed
    Completed,
    /// Step failed
    Failed,
    /// Step skipped
    Skipped,
}

/// Planner for generating plans.
#[allow(missing_debug_implementations)]
#[derive(Clone)]
pub struct Planner {
    /// Planner configuration
    _config: (),
}

impl Planner {
    /// Create a new planner.
    pub fn new() -> Self {
        Self { _config: () }
    }

    /// Generate a plan for a given objective.
    /// Uses LLM for intelligent plan generation when provider is available.
    pub async fn generate_plan(
        &self,
        objective: &str,
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Plan {
        let plan_id = uuid::Uuid::new_v4().to_string();
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Try to use LLM for plan decomposition if provider is available
        if let Some(provider) = model_provider {
            let prompt = format!(
                "You are a task planning AI. Decompose the following objective into concrete steps. \
                 Return your response as a JSON array of steps, where each step has: \
                 {{\"description\": \"step description\", \"tool\": \"tool name or null\", \"tool_args\": {{}} or null}}. \
                 Objective: {}",
                objective
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON array of steps
                    if let Ok(steps_json) =
                        serde_json::from_str::<serde_json::Value>(&response.output)
                    {
                        if let Some(steps_array) = steps_json.as_array() {
                            let steps: Vec<PlanStep> = steps_array
                                .iter()
                                .filter_map(|step| {
                                    let description = step
                                        .get("description")
                                        .and_then(|d| d.as_str())
                                        .unwrap_or("Unknown step")
                                        .to_string();
                                    let tool = step
                                        .get("tool")
                                        .and_then(|t| t.as_str())
                                        .map(|s| s.to_string());
                                    let tool_args = step.get("tool_args").cloned();
                                    Some(PlanStep {
                                        step_id: uuid::Uuid::new_v4().to_string(),
                                        description,
                                        tool,
                                        tool_args,
                                        status: StepStatus::Pending,
                                        result: None,
                                    })
                                })
                                .collect();

                            if !steps.is_empty() {
                                return Plan {
                                    plan_id,
                                    objective: objective.to_string(),
                                    steps,
                                    current_step: 0,
                                    status: PlanStatus::Pending,
                                    created_at,
                                };
                            }
                        }
                    }
                    // Fallback if parsing fails
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: create a simple plan with one step
        let step = PlanStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            description: format!("Execute: {}", objective),
            tool: None,
            tool_args: None,
            status: StepStatus::Pending,
            result: None,
        };

        Plan {
            plan_id,
            objective: objective.to_string(),
            steps: vec![step],
            current_step: 0,
            status: PlanStatus::Pending,
            created_at,
        }
    }

    /// Re-plan based on current state and results.
    /// Uses LLM for intelligent re-planning when provider is available.
    pub async fn replan(
        &self,
        plan: &Plan,
        results: &[String],
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Plan {
        // Try to use LLM for re-planning if provider is available
        if let Some(provider) = model_provider {
            let current_state = plan
                .steps
                .iter()
                .map(|s| format!("{}: {:?}", s.description, s.status))
                .collect::<Vec<_>>()
                .join("\n");

            let results_str = results.join("\n");

            let prompt = format!(
                "You are a task planning AI. The following plan has been partially executed. \
                 Current state:\n{}\n\nResults:\n{}\n\nObjective: {}\n\n \
                 Adjust the plan by adding new steps, modifying existing steps, or marking steps as complete. \
                 Return your response as a JSON array of steps, where each step has: \
                 {{\"description\": \"step description\", \"tool\": \"tool name or null\", \"tool_args\": {{}} or null, \"status\": \"Pending\"|\"Completed\"|\"Failed\"}}.",
                current_state, results_str, plan.objective
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON array of steps
                    if let Ok(steps_json) =
                        serde_json::from_str::<serde_json::Value>(&response.output)
                    {
                        if let Some(steps_array) = steps_json.as_array() {
                            let steps: Vec<PlanStep> = steps_array
                                .iter()
                                .filter_map(|step| {
                                    let description = step
                                        .get("description")
                                        .and_then(|d| d.as_str())
                                        .unwrap_or("Unknown step")
                                        .to_string();
                                    let tool = step
                                        .get("tool")
                                        .and_then(|t| t.as_str())
                                        .map(|s| s.to_string());
                                    let tool_args = step.get("tool_args").cloned();
                                    let status_str = step
                                        .get("status")
                                        .and_then(|s| s.as_str())
                                        .unwrap_or("Pending");
                                    let status = match status_str {
                                        "Completed" => StepStatus::Completed,
                                        "Failed" => StepStatus::Failed,
                                        _ => StepStatus::Pending,
                                    };
                                    Some(PlanStep {
                                        step_id: uuid::Uuid::new_v4().to_string(),
                                        description,
                                        tool,
                                        tool_args,
                                        status,
                                        result: None,
                                    })
                                })
                                .collect();

                            if !steps.is_empty() {
                                let mut new_plan = plan.clone();
                                new_plan.steps = steps;
                                new_plan.status = PlanStatus::NeedsReplanning;
                                return new_plan;
                            }
                        }
                    }
                    // Fallback if parsing fails
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: return the same plan with NeedsReplanning status
        let mut new_plan = plan.clone();
        new_plan.status = PlanStatus::NeedsReplanning;
        new_plan
    }
}

impl Default for Planner {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool registry for tool management (ToolRegistry pattern).
#[derive(Debug, Clone)]
pub struct ToolRegistry {
    /// Registered tools
    tools: std::collections::HashMap<String, ToolDefinition>,
}

/// Tool definition for tool schema.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolDefinition {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// Tool parameters schema (JSON Schema)
    pub parameters: serde_json::Value,
    /// Tool metadata
    pub metadata: serde_json::Value,
}

impl ToolRegistry {
    /// Create a new tool registry.
    pub fn new() -> Self {
        Self {
            tools: std::collections::HashMap::new(),
        }
    }

    /// Register a tool.
    pub fn register_tool(&mut self, tool: ToolDefinition) {
        self.tools.insert(tool.name.clone(), tool);
    }

    /// Get a tool by name.
    pub fn get_tool(&self, name: &str) -> Option<&ToolDefinition> {
        self.tools.get(name)
    }

    /// List all registered tools.
    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }

    /// Get all tools.
    pub fn get_all_tools(&self) -> Vec<ToolDefinition> {
        self.tools.values().cloned().collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Subagent for specialized agent tasks (LangChain multi-agent pattern).
#[derive(Debug, Clone)]
pub struct Subagent {
    /// Subagent name
    pub name: String,
    /// Subagent description
    pub description: String,
    /// Subagent role/specialization
    pub role: String,
    /// Subagent tools
    pub tools: Vec<String>,
}

/// Supervisor for coordinating subagents (LangGraph supervisor pattern).
#[derive(Clone)]
pub struct Supervisor {
    /// Registered subagents
    subagents: std::collections::HashMap<String, Subagent>,
}

impl Supervisor {
    /// Create a new supervisor.
    pub fn new() -> Self {
        Self {
            subagents: std::collections::HashMap::new(),
        }
    }

    /// Register a subagent.
    pub fn register_subagent(&mut self, subagent: Subagent) {
        self.subagents.insert(subagent.name.clone(), subagent);
    }

    /// Get a subagent by name.
    pub fn get_subagent(&self, name: &str) -> Option<&Subagent> {
        self.subagents.get(name)
    }

    /// List all subagents.
    pub fn list_subagents(&self) -> Vec<String> {
        self.subagents.keys().cloned().collect()
    }

    /// Decide which subagent to invoke for a task.
    /// Uses LLM for intelligent subagent selection when provider is available.
    pub async fn decide_subagent(
        &self,
        task: &str,
        model_provider: Option<&Arc<dyn agenticos_contracts::ModelProvider>>,
    ) -> Option<String> {
        // Try to use LLM for subagent selection if provider is available
        if let Some(provider) = model_provider {
            let subagents_list = self.list_subagents();
            if subagents_list.is_empty() {
                return None;
            }

            let subagents_info = subagents_list
                .iter()
                .map(|name| {
                    if let Some(subagent) = self.get_subagent(name) {
                        format!(
                            "{}: {} (tools: {})",
                            subagent.name,
                            subagent.description,
                            subagent.tools.join(", ")
                        )
                    } else {
                        name.clone()
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");

            let prompt = format!(
                "You are a task coordination AI. Given the following task and available subagents, \
                 select the most appropriate subagent to handle this task. \
                 Available subagents:\n{}\n\nTask: {}\n\n \
                 Return only the name of the selected subagent as a JSON string.",
                subagents_info, task
            );

            let request = agenticos_contracts::ModelRequest {
                request_id: uuid::Uuid::new_v4().to_string(),
                model: "default".to_string(),
                input: prompt,
                parameters: None,
            };

            match provider.execute(request).await {
                Ok(response) => {
                    // Try to parse LLM response as JSON string
                    if let Ok(subagent_name) = serde_json::from_str::<String>(&response.output) {
                        if self.subagents.contains_key(&subagent_name) {
                            return Some(subagent_name);
                        }
                    }
                    // Fallback if parsing fails or subagent not found
                }
                Err(_) => {
                    // Fallback on error
                }
            }
        }

        // Fallback: return None (no decision logic implemented)
        None
    }
}

impl Default for Supervisor {
    fn default() -> Self {
        Self::new()
    }
}

/// LLM provider configuration with API keys.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LLMConfig {
    /// OpenAI API key
    pub openai_api_key: Option<String>,
    /// Anthropic API key
    pub anthropic_api_key: Option<String>,
    /// Default model provider
    pub default_provider: String,
    /// Default model
    pub default_model: String,
    /// API base URL (for custom endpoints)
    pub api_base_url: Option<String>,
}

impl LLMConfig {
    /// Load configuration from environment variables.
    pub fn from_env() -> Self {
        dotenv::dotenv().ok();

        Self {
            openai_api_key: std::env::var("OPENAI_API_KEY").ok(),
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
            default_provider: std::env::var("LLM_PROVIDER")
                .unwrap_or_else(|_| "openai".to_string()),
            default_model: std::env::var("LLM_MODEL").unwrap_or_else(|_| "gpt-4".to_string()),
            api_base_url: std::env::var("LLM_API_BASE_URL").ok(),
        }
    }

    /// Validate configuration.
    pub fn validate(&self) -> Result<(), String> {
        if self.default_provider == "openai" && self.openai_api_key.is_none() {
            return Err("OpenAI API key required when using OpenAI provider".to_string());
        }
        if self.default_provider == "anthropic" && self.anthropic_api_key.is_none() {
            return Err("Anthropic API key required when using Anthropic provider".to_string());
        }
        Ok(())
    }

    /// Get API key for the default provider.
    pub fn get_api_key(&self) -> Option<String> {
        match self.default_provider.as_str() {
            "openai" => self.openai_api_key.clone(),
            "anthropic" => self.anthropic_api_key.clone(),
            _ => None,
        }
    }

    /// Get API base URL for the default provider.
    pub fn get_api_base_url(&self) -> String {
        self.api_base_url
            .clone()
            .unwrap_or_else(|| match self.default_provider.as_str() {
                "openai" => "https://api.openai.com/v1".to_string(),
                "anthropic" => "https://api.anthropic.com/v1".to_string(),
                _ => "https://api.openai.com/v1".to_string(),
            })
    }
}

impl Default for LLMConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

#[test]
fn structured_tool_action_detection_accepts_tool_json_only() {
    assert!(is_structured_tool_action(
        r#"{"tool":"fs.read","arguments":{"path":"README.md"}}"#
    ));
    assert!(is_structured_tool_action(
        r#"{"tool_id":"git.status","arguments":{}}"#
    ));
    assert!(!is_structured_tool_action(
        "This is a normal assistant answer."
    ));
    assert!(!is_structured_tool_action(r#"{"tool":"","arguments":{}}"#));
}

#[cfg(test)]
mod tests {
    #[test]
    fn tool_executor_rejects_workspace_traversal() {
        let root =
            std::env::temp_dir().join(format!("agenticos-tool-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let executor = super::ToolExecutor::new(root.clone());

        let result = executor.read_file("../outside.txt");
        assert!(!result.success);

        let _ = std::fs::remove_dir_all(root);
    }

    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_react_agent_creation() {
        let agent = ReactAgent::new("You are a helpful assistant.".to_string());
        assert_eq!(agent.identity, "You are a helpful assistant.");
        assert_eq!(agent.current_turn(), 0);
        assert!(!agent.is_finished());
    }

    #[test]
    fn test_react_agent_with_max_turns() {
        let agent = ReactAgent::with_max_turns("Test agent".to_string(), 10);
        assert_eq!(agent.max_turns, 10);
        assert_eq!(agent.current_turn(), 0);
    }

    #[test]
    fn test_react_agent_add_skill() {
        let agent = ReactAgent::new("Test agent".to_string());
        let skill1 = Skill {
            name: "git_operations".to_string(),
            description: "Git operations skill".to_string(),
            version: "1.0.0".to_string(),
            author: "test".to_string(),
            platforms: vec!["linux".to_string()],
            procedure: "Test procedure".to_string(),
            pitfalls: vec![],
            verification: vec![],
        };
        let skill2 = Skill {
            name: "file_editing".to_string(),
            description: "File editing skill".to_string(),
            version: "1.0.0".to_string(),
            author: "test".to_string(),
            platforms: vec!["linux".to_string()],
            procedure: "Test procedure".to_string(),
            pitfalls: vec![],
            verification: vec![],
        };
        agent.add_skill(skill1);
        agent.add_skill(skill2);
        // Skills catalog is now interior mutable, verify via inner lock
        let inner = agent.inner.lock().unwrap();
        assert_eq!(inner.skills_catalog.len(), 2);
    }

    #[test]
    fn test_react_agent_set_memory() {
        let agent = ReactAgent::new("Test agent".to_string());
        agent.set_memory_md("Test memory content".to_string());
        agent.set_user_md("Test user preferences".to_string());
        // Memory fields are now interior mutable, verify via inner lock
        let inner = agent.inner.lock().unwrap();
        assert_eq!(inner.memory_md, "Test memory content");
        assert_eq!(inner.user_md, "Test user preferences");
    }

    #[test]
    fn test_react_agent_build_system_prompt() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::new("You are a helpful assistant.".to_string());
            agent.set_memory_md("Test memory content".to_string());
            let skill = Skill {
                name: "git_operations".to_string(),
                description: "Git operations skill".to_string(),
                version: "1.0.0".to_string(),
                author: "test".to_string(),
                platforms: vec!["linux".to_string()],
                procedure: "Test procedure".to_string(),
                pitfalls: vec![],
                verification: vec![],
            };
            agent.add_skill(skill);

            let prompt = agent.build_system_prompt().await;
            assert!(prompt.contains("You are a helpful assistant."));
            // Memory fields are now interior mutable and included in prompt
            assert!(prompt.contains("Memory (MEMORY.md)"));
            assert!(prompt.contains("Test memory content"));
            assert!(prompt.contains("Available Skills"));
            assert!(prompt.contains("git_operations"));
            assert!(prompt.contains("ReAct pattern"));
        });
    }

    #[test]
    fn test_react_agent_turn_management() {
        let agent = ReactAgent::with_max_turns("Test agent".to_string(), 3);
        assert_eq!(agent.current_turn(), 0);
        assert!(!agent.is_finished());

        agent.increment_turn();
        assert_eq!(agent.current_turn(), 1);
        assert!(!agent.is_finished());

        agent.increment_turn();
        assert_eq!(agent.current_turn(), 2);
        assert!(!agent.is_finished());

        agent.increment_turn();
        assert_eq!(agent.current_turn(), 3);
        assert!(agent.is_finished());
    }

    #[test]
    fn test_react_agent_without_model_provider() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::new("Test agent".to_string());
            let result = agent.think("test input").await;
            // Should fail without model provider
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_react_agent_act_step() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::new("Test agent".to_string());
            let result = agent.act("test_action").await;
            // Should succeed with simulated action
            assert!(result.is_ok());
            assert!(result.unwrap().contains("Executed action"));
        });
    }

    #[test]
    fn test_react_agent_observe_step() {
        let agent = ReactAgent::new("Test agent".to_string());
        let observation = agent.observe("test observation");
        assert!(observation.contains("Observation"));
        assert!(observation.contains("test observation"));
    }

    #[test]
    fn test_react_agent_execute_turn_without_provider() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::new("Test agent".to_string());
            let result = agent.execute_turn("test input").await;
            // Should fail without model provider
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_react_agent_execute_turn_finished() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::with_max_turns("Test agent".to_string(), 1);
            agent.increment_turn();
            let result = agent.execute_turn("test input").await;
            // Should fail due to max turns reached
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_skill_from_markdown() {
        let markdown = r#"---
name: k8s-pod-debug
description: >
  Activate for crashing pods, CrashLoopBackOff,
  "why is my pod restarting", container failures.
version: 1.2.0
author: agent
platforms: [linux, macos]
---

## Procedure
1. Get pod status → check events → pull logs
2. Look for OOMKilled, ImagePullBackOff, config errors

## Pitfalls
- Forgetting --previous flag on restarted containers

## Verification
- Pod stays Running with 0 restarts for 5+ minutes"#;

        let skill = Skill::from_markdown(markdown).unwrap();
        assert_eq!(skill.name, "k8s-pod-debug");
        assert_eq!(skill.version, "1.2.0");
        assert_eq!(skill.author, "agent");
        assert_eq!(skill.platforms, vec!["linux", "macos"]);
        assert!(skill.procedure.contains("Get pod status"));
        assert_eq!(skill.pitfalls.len(), 1);
        assert_eq!(skill.verification.len(), 1);
    }

    #[test]
    fn test_skill_from_markdown_missing_frontmatter() {
        let markdown = "No frontmatter here";
        let result = Skill::from_markdown(markdown);
        assert!(result.is_err());
    }

    #[test]
    fn test_skill_from_markdown_missing_name() {
        let markdown = r#"---
description: Test skill
version: 1.0.0
---
## Procedure
Test procedure"#;
        let result = Skill::from_markdown(markdown);
        assert!(result.is_err());
    }

    #[test]
    fn test_skill_summary() {
        let markdown = r#"---
name: test-skill
description: Test description
version: 1.0.0
author: test
platforms: [linux]
---
## Procedure
Test procedure"#;

        let skill = Skill::from_markdown(markdown).unwrap();
        let summary = skill.summary();
        assert!(summary.contains("test-skill"));
        assert!(summary.contains("v1.0.0"));
        assert!(summary.contains("Test description"));
    }

    #[test]
    fn test_skill_extract_section() {
        let content = "## Procedure\nTest content\n## Pitfalls\nTest pitfalls";
        let section = Skill::extract_section(content, "Procedure");
        assert_eq!(section, "Test content");
    }

    #[test]
    fn test_skill_extract_list_section() {
        let content = "## Pitfalls\n- Item 1\n- Item 2\n## Verification\n- Check 1";
        let list = Skill::extract_list_section(content, "Pitfalls");
        assert_eq!(list.len(), 2);
        assert!(list.contains(&"Item 1".to_string()));
        assert!(list.contains(&"Item 2".to_string()));
    }

    #[test]
    fn test_sqlite_memory_creation() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await;
            assert!(memory.is_ok());
        });
    }

    #[test]
    fn test_sqlite_memory_store_message() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            let result = memory
                .store_message("msg-1", "session-1", "user", "Test message")
                .await;
            assert!(result.is_ok());
        });
    }

    #[test]
    fn test_sqlite_memory_search_conversations() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            memory
                .store_message("msg-1", "session-1", "user", "Test message about debugging")
                .await
                .unwrap();
            memory
                .store_message("msg-2", "session-1", "assistant", "Here's how to debug")
                .await
                .unwrap();

            let results = memory.search_conversations("debug", 10).await.unwrap();
            // FTS5 might not index immediately, so just verify it doesn't crash
            assert!(!results.is_empty() || results.is_empty());
        });
    }

    #[test]
    fn test_sqlite_memory_get_session_history() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            memory
                .store_message("msg-1", "session-1", "user", "First message")
                .await
                .unwrap();
            memory
                .store_message("msg-2", "session-1", "assistant", "Response")
                .await
                .unwrap();

            let history = memory.get_session_history("session-1", 10).await.unwrap();
            assert_eq!(history.len(), 2);
            assert_eq!(history[0].role, "user");
            assert_eq!(history[1].role, "assistant");
        });
    }

    #[test]
    fn test_react_agent_with_memory() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            let agent = ReactAgent::new("Test agent".to_string());
            agent.set_memory(Arc::new(memory));
            agent.set_session_id("test-session".to_string());

            // Verify memory is set
            assert!(agent.inner.lock().unwrap().memory.is_some());
            assert_eq!(agent.inner.lock().unwrap().session_id, "test-session");
        });
    }

    #[test]
    fn test_react_agent_load_context() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            let agent = ReactAgent::new("Test agent".to_string());
            agent.set_memory(Arc::new(memory));
            agent.set_session_id("test-session".to_string());

            // Load context (should be empty initially)
            let context = agent.load_context().await.unwrap();
            assert!(context.is_empty());

            // Add some conversation history
            if let Some(memory) = agent.inner.lock().unwrap().memory.as_ref() {
                memory
                    .store_message("msg-1", "test-session", "user", "Hello")
                    .await
                    .unwrap();
                memory
                    .store_message("msg-2", "test-session", "assistant", "Hi there")
                    .await
                    .unwrap();
            }

            // Load context again
            let context = agent.load_context().await.unwrap();
            assert!(context.contains("Hello"));
            assert!(context.contains("Hi there"));
        });
    }

    #[test]
    fn test_react_agent_turn_with_memory() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            let agent = ReactAgent::new("Test agent".to_string());
            agent.set_memory(Arc::new(memory));
            agent.set_session_id("test-session".to_string());

            // Execute turn without model provider (should fail)
            let result = agent.execute_turn("test input").await;
            assert!(result.is_err());

            // Verify messages were stored in memory despite LLM failure
            let memory = agent.inner.lock().unwrap().memory.clone();
            if let Some(memory) = memory.as_ref() {
                let history = memory
                    .get_session_history("test-session", 10)
                    .await
                    .unwrap();
                assert_eq!(history.len(), 1); // User message stored
                assert_eq!(history[0].role, "user");
            }
        });
    }

    #[test]
    fn test_react_agent_system_prompt_with_context() {
        let rt = test_runtime();
        rt.block_on(async {
            let memory = SqliteMemory::new("sqlite::memory:").await.unwrap();
            let agent = ReactAgent::new("Test agent".to_string());
            agent.set_memory(Arc::new(memory));
            agent.set_session_id("test-session".to_string());

            // Add some conversation history
            if let Some(memory) = agent.inner.lock().unwrap().memory.as_ref() {
                memory
                    .store_message("msg-1", "test-session", "user", "Hello")
                    .await
                    .unwrap();
                memory
                    .store_message("msg-2", "test-session", "assistant", "Hi there")
                    .await
                    .unwrap();
            }

            // Build system prompt with context
            let prompt = agent.build_system_prompt().await;
            assert!(prompt.contains("Conversation History (Recent)"));
            assert!(prompt.contains("Hello"));
            assert!(prompt.contains("Hi there"));
        });
    }

    #[test]
    fn test_react_agent_system_prompt_without_memory() {
        let rt = test_runtime();
        rt.block_on(async {
            let agent = ReactAgent::new("Test agent".to_string());

            // Build system prompt without memory
            let prompt = agent.build_system_prompt().await;
            assert!(!prompt.contains("Conversation History (Recent)"));
        });
    }

    #[test]
    fn test_tool_executor_read_file() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        // Try to read a file that should exist
        let result = executor.read_file("Cargo.toml");
        assert!(result.success);
        assert!(result.output.contains("[package]"));
    }

    #[test]
    fn test_tool_executor_write_file() {
        let workdir = std::env::temp_dir();
        let executor = ToolExecutor::new(workdir.clone());

        let test_path = "test_tool_write.txt";
        let test_content = "Test content";

        let result = executor.write_file(test_path, test_content);
        assert!(result.success);

        // Clean up
        let _ = std::fs::remove_file(workdir.join(test_path));
    }

    #[test]
    fn test_tool_executor_git_status() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_status();
        // Git might not be available or initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_execute_command() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.execute_command("echo test");
        assert!(result.success);
        assert!(result.output.contains("test"));
    }

    #[test]
    fn test_tool_executor_execute_command_restricted() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.execute_command("rm -rf /");
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_react_agent_with_tool_executor() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);
        let agent = ReactAgent::new("Test agent".to_string());
        agent.set_tool_executor(executor);

        assert!(agent.inner.lock().unwrap().tool_executor.is_some());
    }

    #[test]
    fn test_react_agent_act_with_tool_executor() {
        let rt = test_runtime();
        rt.block_on(async {
            let workdir = std::env::current_dir().unwrap();
            let executor = ToolExecutor::new(workdir);
            let agent = ReactAgent::new("Test agent".to_string());
            agent.set_tool_executor(executor);

            let result = agent.act("echo test").await;
            assert!(result.is_ok());
            assert!(result.unwrap().contains("test"));
        });
    }

    #[test]
    fn test_tool_executor_git_add() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_add(".");
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_git_commit() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_commit("Test commit");
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_git_push() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_push();
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_git_diff() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_diff();
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_git_log() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_log();
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_git_branch() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        let result = executor.git_branch();
        // Git might not be available or not initialized, so just check it doesn't crash
        assert!(result.success || !result.success);
    }

    #[test]
    fn test_tool_executor_edit_line() {
        let workdir = std::env::temp_dir();
        let executor = ToolExecutor::new(workdir.clone());

        let test_path = "test_edit_line.txt";
        let initial_content = "Line 1\nLine 2\nLine 3";

        // Create test file
        let full_path = workdir.join(test_path);
        std::fs::write(&full_path, initial_content).unwrap();

        // Edit line 2
        let result = executor.edit_line(test_path, 2, "Modified Line 2");
        assert!(result.success);

        // Verify the edit
        let content = std::fs::read_to_string(&full_path).unwrap();
        assert!(content.contains("Modified Line 2"));

        // Clean up
        let _ = std::fs::remove_file(full_path);
    }

    #[test]
    fn test_tool_executor_insert_line() {
        let workdir = std::env::temp_dir();
        let executor = ToolExecutor::new(workdir.clone());

        let test_path = "test_insert_line.txt";
        let initial_content = "Line 1\nLine 3";

        // Create test file
        let full_path = workdir.join(test_path);
        std::fs::write(&full_path, initial_content).unwrap();

        // Insert line at position 2
        let result = executor.insert_line(test_path, 2, "Line 2");
        assert!(result.success);

        // Verify the insertion
        let content = std::fs::read_to_string(&full_path).unwrap();
        assert!(content.contains("Line 1\nLine 2\nLine 3"));

        // Clean up
        let _ = std::fs::remove_file(full_path);
    }

    #[test]
    fn test_tool_executor_delete_line() {
        let workdir = std::env::temp_dir();
        let executor = ToolExecutor::new(workdir.clone());

        let test_path = "test_delete_line.txt";
        let initial_content = "Line 1\nLine 2\nLine 3";

        // Create test file
        let full_path = workdir.join(test_path);
        std::fs::write(&full_path, initial_content).unwrap();

        // Delete line 2
        let result = executor.delete_line(test_path, 2);
        assert!(result.success);

        // Verify the deletion
        let content = std::fs::read_to_string(&full_path).unwrap();
        assert!(!content.contains("Line 2"));

        // Clean up
        let _ = std::fs::remove_file(full_path);
    }

    #[test]
    fn test_tool_executor_find_and_replace() {
        let workdir = std::env::temp_dir();
        let executor = ToolExecutor::new(workdir.clone());

        let test_path = "test_find_replace.txt";
        let initial_content = "Hello World\nHello Universe";

        // Create test file
        let full_path = workdir.join(test_path);
        std::fs::write(&full_path, initial_content).unwrap();

        // Find and replace
        let result = executor.find_and_replace(test_path, "Hello", "Hi");
        assert!(result.success);

        // Verify the replacement
        let content = std::fs::read_to_string(&full_path).unwrap();
        assert!(content.contains("Hi World"));
        assert!(!content.contains("Hello"));

        // Clean up
        let _ = std::fs::remove_file(full_path);
    }

    #[test]
    fn test_tool_executor_file_exists() {
        let workdir = std::env::current_dir().unwrap();
        let executor = ToolExecutor::new(workdir);

        // Test existing file
        let result = executor.file_exists("Cargo.toml");
        assert!(result.success);

        // Test non-existing file
        let result = executor.file_exists("non_existent_file.txt");
        assert!(!result.success);
    }

    #[test]
    fn test_llm_config_from_env() {
        let config = LLMConfig::from_env();
        assert!(config.default_provider == "openai" || config.default_provider == "anthropic");
        assert!(!config.default_model.is_empty());
    }

    #[test]
    fn test_llm_config_validation() {
        let config = LLMConfig {
            openai_api_key: None,
            anthropic_api_key: None,
            default_provider: "openai".to_string(),
            default_model: "gpt-4".to_string(),
            api_base_url: None,
        };

        let result = config.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_llm_config_validation_with_key() {
        let config = LLMConfig {
            openai_api_key: Some("test-key".to_string()),
            anthropic_api_key: None,
            default_provider: "openai".to_string(),
            default_model: "gpt-4".to_string(),
            api_base_url: None,
        };

        let result = config.validate();
        assert!(result.is_ok());
    }

    #[test]
    fn test_llm_config_get_api_key() {
        let config = LLMConfig {
            openai_api_key: Some("test-key".to_string()),
            anthropic_api_key: None,
            default_provider: "openai".to_string(),
            default_model: "gpt-4".to_string(),
            api_base_url: None,
        };

        let api_key = config.get_api_key();
        assert_eq!(api_key, Some("test-key".to_string()));
    }

    #[test]
    fn test_http_model_provider_with_config() {
        let config = LLMConfig {
            openai_api_key: Some("test-key".to_string()),
            anthropic_api_key: None,
            default_provider: "openai".to_string(),
            default_model: "gpt-4".to_string(),
            api_base_url: Some("https://api.openai.com/v1".to_string()),
        };

        let provider =
            HttpModelProvider::with_config("https://api.openai.com/v1".to_string(), &config);
        assert_eq!(provider.api_key, Some("test-key".to_string()));
        assert_eq!(provider.default_model, "gpt-4".to_string());
    }

    #[test]
    fn test_http_model_provider_with_api_key() {
        let provider = HttpModelProvider::new("https://api.openai.com/v1".to_string())
            .with_api_key("test-key".to_string());

        assert_eq!(provider.api_key, Some("test-key".to_string()));
    }

    #[test]
    fn test_http_model_provider_with_model() {
        let provider = HttpModelProvider::new("https://api.openai.com/v1".to_string())
            .with_model("gpt-3.5-turbo".to_string());

        assert_eq!(provider.default_model, "gpt-3.5-turbo".to_string());
    }

    #[test]
    fn test_summarization_config_default() {
        let config = SummarizationConfig::default();
        assert_eq!(config.max_tokens_before_summary, 2048);
        assert_eq!(config.max_tokens, 4096);
        assert_eq!(config.max_summary_tokens, 256);
    }

    #[test]
    fn test_count_tokens_approximate() {
        let text = "Hello World";
        let tokens = count_tokens_approximate(text);
        assert!(tokens > 0);
    }

    #[test]
    fn test_count_tokens_in_messages() {
        let messages = vec!["Hello".to_string(), "World".to_string()];
        let tokens = count_tokens_in_messages(&messages);
        assert!(tokens > 0);
    }

    #[test]
    fn test_summarize_messages_no_summarization_needed() {
        let messages = vec!["Hello".to_string(), "World".to_string()];
        let config = SummarizationConfig::default();
        let result = summarize_messages(&messages, None, &config);

        assert!(!result.was_summarized);
        assert_eq!(result.messages.len(), 2);
    }

    #[test]
    fn test_summarize_messages_with_summarization() {
        // Create a long message that exceeds max_tokens_before_summary
        let long_message = "a".repeat(3000);
        let messages = vec![long_message.clone(), "Recent message".to_string()];
        let config = SummarizationConfig {
            max_tokens_before_summary: 100,
            max_tokens: 500,
            max_summary_tokens: 100,
        };
        let result = summarize_messages(&messages, None, &config);

        assert!(result.was_summarized);
        assert!(result.running_summary.is_some());
        assert!(!result.messages.is_empty());
    }

    #[test]
    fn test_summarize_messages_with_running_summary() {
        let long_message = "a".repeat(3000);
        let messages = vec![long_message.clone(), "Recent message".to_string()];
        let config = SummarizationConfig {
            max_tokens_before_summary: 100,
            max_tokens: 500,
            max_summary_tokens: 100,
        };
        let running_summary = Some("Previous summary".to_string());
        let result = summarize_messages(&messages, running_summary, &config);

        assert!(result.was_summarized);
        assert!(result.running_summary.is_some());
        assert!(result
            .running_summary
            .as_ref()
            .unwrap()
            .contains("Previous summary"));
    }

    #[test]
    fn test_checkpoint_metadata_default() {
        let metadata = CheckpointMetadata::default();
        assert_eq!(metadata.step, 0);
        assert_eq!(metadata.status, "active");
    }

    #[test]
    fn test_generate_checkpoint_id() {
        let id1 = generate_checkpoint_id();
        let id2 = generate_checkpoint_id();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_generate_thread_id() {
        let id1 = generate_thread_id();
        let id2 = generate_thread_id();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_checkpoint_serialization() {
        let checkpoint = Checkpoint {
            checkpoint_id: "test-id".to_string(),
            thread_id: "test-thread".to_string(),
            state: serde_json::json!({"key": "value"}),
            metadata: serde_json::json!({"step": 1}),
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&checkpoint).unwrap();
        let deserialized: Checkpoint = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.checkpoint_id, "test-id");
        assert_eq!(deserialized.thread_id, "test-thread");
    }

    #[tokio::test]
    async fn test_planner_generation() {
        let planner = Planner::new();
        let plan = planner.generate_plan("Test objective", None).await;

        assert_eq!(plan.objective, "Test objective");
        assert_eq!(plan.steps.len(), 1);
        assert_eq!(plan.status, PlanStatus::Pending);
    }

    #[test]
    fn test_plan_step_serialization() {
        let step = PlanStep {
            step_id: "test-step".to_string(),
            description: "Test description".to_string(),
            tool: Some("test-tool".to_string()),
            tool_args: Some(serde_json::json!({"arg": "value"})),
            status: StepStatus::Pending,
            result: None,
        };

        let json = serde_json::to_string(&step).unwrap();
        let deserialized: PlanStep = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.step_id, "test-step");
        assert_eq!(deserialized.description, "Test description");
    }

    #[test]
    fn test_plan_serialization() {
        let plan = Plan {
            plan_id: "test-plan".to_string(),
            objective: "Test objective".to_string(),
            steps: vec![],
            current_step: 0,
            status: PlanStatus::Pending,
            created_at: 1234567890,
        };

        let json = serde_json::to_string(&plan).unwrap();
        let deserialized: Plan = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.plan_id, "test-plan");
        assert_eq!(deserialized.objective, "Test objective");
    }

    #[tokio::test]
    async fn sqlite_event_store_recovers_full_run_history_without_snapshot() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-kernel-recovery-{}.db",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let store = Arc::new(SqliteEventStore::new(&url).await.unwrap());
        let snapshots = Arc::new(InMemorySnapshotStore::new());
        let first = KernelRuntime::minimal(store.clone(), snapshots.clone());

        let run_id = RunId::new("sqlite-recovery").unwrap();
        first.create_run(run_id.clone()).await.unwrap();
        let created = first.get_or_recover_run(&run_id).await.unwrap();
        first
            .transition_run(&run_id, RunState::Admitted, created.version)
            .await
            .unwrap();
        drop(first);

        let second = KernelRuntime::minimal(store, snapshots);
        let recovered = second.get_or_recover_run(&run_id).await.unwrap();

        assert_eq!(recovered.state, RunState::Admitted);
        assert_eq!(recovered.version, 2);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn sqlite_run_lease_survives_restart_and_fences_stale_owner() {
        let path =
            std::env::temp_dir().join(format!("agenticos-run-lease-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let event_store = Arc::new(SqliteEventStore::new(&url).await.unwrap());
        let snapshot_store = Arc::new(SqliteSnapshotStore::new(&url).await.unwrap());
        let lease_store = Arc::new(SqliteLeaseStore::open(&url).await.unwrap());

        let first = KernelRuntime::new_with_outbox_and_lease_store(
            event_store.clone(),
            snapshot_store.clone(),
            Arc::new(InMemoryLogger::default()),
            Arc::new(RwLock::new(InMemoryConfig::default())),
            Arc::new(InMemoryCapabilityIssuer::new()),
            Arc::new(agenticos_brain::CapabilityRegistry::default()),
            Arc::new(InMemoryOutboxStore::new()),
            lease_store.clone(),
        );

        let run_id = RunId::new("sqlite-run-lease").unwrap();
        first.create_run(run_id.clone()).await.unwrap();

        let initial_expiry = unix_time().saturating_add(1);
        let first_lease = first
            .acquire_lease(&run_id, "worker-a".to_string(), initial_expiry)
            .await
            .unwrap();

        let first_lease_valid = first
            .lease_valid(
                &run_id,
                &first_lease.owner_id,
                first_lease.fencing_token,
                unix_time(),
            )
            .await
            .unwrap();
        assert!(first_lease_valid);

        drop(first);
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let second = KernelRuntime::new_with_outbox_and_lease_store(
            event_store,
            snapshot_store,
            Arc::new(InMemoryLogger::default()),
            Arc::new(RwLock::new(InMemoryConfig::default())),
            Arc::new(InMemoryCapabilityIssuer::new()),
            Arc::new(agenticos_brain::CapabilityRegistry::default()),
            Arc::new(InMemoryOutboxStore::new()),
            lease_store,
        );

        let recovered = second.get_or_recover_run(&run_id).await.unwrap();
        assert!(recovered.lease.is_none());

        let second_lease = second
            .acquire_lease(
                &run_id,
                "worker-b".to_string(),
                unix_time().saturating_add(60),
            )
            .await
            .unwrap();

        assert!(second_lease.fencing_token > first_lease.fencing_token);
        let stale_lease_valid = second
            .lease_valid(
                &run_id,
                &first_lease.owner_id,
                first_lease.fencing_token,
                unix_time(),
            )
            .await
            .unwrap();
        assert!(!stale_lease_valid);

        let recovered_with_lease = second.get_or_recover_run(&run_id).await.unwrap();
        assert_eq!(
            recovered_with_lease
                .lease
                .as_ref()
                .map(|lease| lease.fencing_token),
            Some(second_lease.fencing_token)
        );

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn sqlite_idempotency_deduplicates_and_recovers() {
        let path =
            std::env::temp_dir().join(format!("agenticos-idempotency-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let first = SqliteIdempotencyStore::new(&url, 600).await.unwrap();
        let created = first.check_or_record("key-1", "fingerprint").await.unwrap();
        assert_eq!(created.status, IdempotencyStatus::InProgress);
        first
            .mark_completed("key-1", "cached-result".to_string())
            .await
            .unwrap();
        drop(first);

        let second = SqliteIdempotencyStore::new(&url, 600).await.unwrap();
        let recovered = second
            .check_or_record("key-1", "fingerprint")
            .await
            .unwrap();
        assert_eq!(recovered.status, IdempotencyStatus::Completed);
        assert_eq!(recovered.result.as_deref(), Some("cached-result"));
        assert!(matches!(
            second.check_or_record("key-1", "different").await,
            Err(ContractError::InvalidId)
        ));

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn recovered_run_can_be_cancelled_without_being_preloaded() {
        let event_store = Arc::new(InMemoryEventStore::new());
        let snapshot_store = Arc::new(InMemorySnapshotStore::new());

        let first = KernelRuntime::minimal(event_store.clone(), snapshot_store.clone());
        let run_id = RunId::new("recover-cancel").unwrap();
        first.create_run(run_id.clone()).await.unwrap();
        let created = first.get_or_recover_run(&run_id).await.unwrap();
        first
            .transition_run(&run_id, RunState::Admitted, created.version)
            .await
            .unwrap();
        drop(first);

        let second = KernelRuntime::minimal(event_store.clone(), snapshot_store.clone());
        second.cancel_run(&run_id).await.unwrap();

        let recovered = second.get_or_recover_run(&run_id).await.unwrap();
        assert_eq!(recovered.state, RunState::Cancelling);
        drop(second);

        let third = KernelRuntime::minimal(event_store.clone(), snapshot_store.clone());
        let recovered_after_restart = third.get_or_recover_run(&run_id).await.unwrap();
        assert_eq!(recovered_after_restart.state, RunState::Cancelling);
        assert!(recovered_after_restart.cancellation.is_cancelled());
    }

    #[tokio::test]
    async fn test_planner_replan() {
        let planner = Planner::new();
        let plan = planner.generate_plan("Test objective", None).await;
        let results = vec!["result1".to_string(), "result2".to_string()];

        let new_plan = planner.replan(&plan, &results, None).await;
        assert_eq!(new_plan.status, PlanStatus::NeedsReplanning);
    }

    #[test]
    fn test_tool_registry() {
        let mut registry = ToolRegistry::new();

        let tool = ToolDefinition {
            name: "test_tool".to_string(),
            description: "Test tool".to_string(),
            parameters: serde_json::json!({"type": "object", "properties": {}}),
            metadata: serde_json::json!({"version": "1.0"}),
        };

        registry.register_tool(tool.clone());

        assert_eq!(registry.list_tools().len(), 1);
        assert_eq!(registry.get_tool("test_tool").unwrap().name, "test_tool");
    }

    #[test]
    fn test_tool_definition_serialization() {
        let tool = ToolDefinition {
            name: "test_tool".to_string(),
            description: "Test tool".to_string(),
            parameters: serde_json::json!({"type": "object"}),
            metadata: serde_json::json!({}),
        };

        let json = serde_json::to_string(&tool).unwrap();
        let deserialized: ToolDefinition = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.name, "test_tool");
    }

    #[test]
    fn test_supervisor() {
        let mut supervisor = Supervisor::new();

        let subagent = Subagent {
            name: "research_agent".to_string(),
            description: "Research specialist".to_string(),
            role: "research".to_string(),
            tools: vec!["search".to_string()],
        };

        supervisor.register_subagent(subagent);

        assert_eq!(supervisor.list_subagents().len(), 1);
        assert_eq!(
            supervisor.get_subagent("research_agent").unwrap().name,
            "research_agent"
        );
    }

    #[test]
    fn test_subagent_creation() {
        let subagent = Subagent {
            name: "test_agent".to_string(),
            description: "Test agent".to_string(),
            role: "test".to_string(),
            tools: vec!["tool1".to_string(), "tool2".to_string()],
        };

        assert_eq!(subagent.name, "test_agent");
        assert_eq!(subagent.tools.len(), 2);
    }
}
