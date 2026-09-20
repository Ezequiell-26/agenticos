#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS kernel - durable runtime lifecycle and persistence foundation.

use agenticos_contracts::{
    CancellationToken, ContractError, EventStore, IdempotencyRecord, IdempotencyStatus,
    LeaseRecord, RunId, RunState, SerializedEvent, SerializedSnapshot, SnapshotStore,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

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
        self.fencing_token += 1;
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
}

impl InMemoryLeaseStore {
    /// Create a new in-memory lease store.
    pub fn new() -> Self {
        Self {
            leases: Arc::new(RwLock::new(HashMap::new())),
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
        let fencing_token = store.len() as u64 + 1;

        let lease = LeaseRecord {
            resource_id: resource_id.clone(),
            owner_id,
            fencing_token,
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

/// Kernel runtime combining durable state with event/snapshot storage.
pub struct KernelRuntime {
    /// Event store for persistence.
    pub event_store: Arc<dyn EventStore>,
    /// Snapshot store for recovery.
    pub snapshot_store: Arc<dyn SnapshotStore>,
    /// In-memory run registry.
    pub runs: Arc<RwLock<HashMap<RunId, DurableRun>>>,
}

impl std::fmt::Debug for KernelRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KernelRuntime")
            .field("event_store", &"<EventStore>")
            .field("snapshot_store", &"<SnapshotStore>")
            .field("runs", &self.runs)
            .finish()
    }
}

impl KernelRuntime {
    /// Create a new kernel runtime with given stores.
    pub fn new(event_store: Arc<dyn EventStore>, snapshot_store: Arc<dyn SnapshotStore>) -> Self {
        Self {
            event_store,
            snapshot_store,
            runs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new run and persist its creation event.
    pub async fn create_run(&self, run_id: RunId) -> Result<DurableRun, ContractError> {
        let mut run = DurableRun::new(run_id.clone());

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
        self.event_store.append(&stream_id, 0, vec![event]).await?;

        // Increment version after successful persistence
        run.version = 1;

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
        let mut runs = self.runs.write().await;
        let run = runs
            .get_mut(run_id)
            .ok_or(ContractError::MissingCapability)?;

        let from_state = run.state;
        run.transition(to, expected_version)?;

        // Persist state transition event
        let event = SerializedEvent {
            event_type: "RunStateChanged".to_string(),
            data: format!(
                r#"{{"run_id":"{}","from":"{:?}","to":"{:?}","version":{}}}"#,
                run_id.as_str(),
                from_state,
                to,
                run.version
            ),
            schema_version: 1,
        };

        let stream_id = format!("run:{}", run_id.as_str());
        let current_version = run.version - 1; // Use version before increment
        self.event_store
            .append(&stream_id, current_version, vec![event])
            .await?;

        Ok(())
    }

    /// Acquire a lease for a run.
    pub async fn acquire_lease(
        &self,
        run_id: &RunId,
        owner_id: String,
        expires_at: u64,
    ) -> Result<LeaseRecord, ContractError> {
        let mut runs = self.runs.write().await;
        let run = runs
            .get_mut(run_id)
            .ok_or(ContractError::MissingCapability)?;

        run.acquire_lease(owner_id.clone(), expires_at)?;
        run.lease.clone().ok_or(ContractError::MissingCapability)
    }

    /// Request cancellation of a run.
    pub async fn cancel_run(&self, run_id: &RunId) -> Result<(), ContractError> {
        let mut runs = self.runs.write().await;
        let run = runs
            .get_mut(run_id)
            .ok_or(ContractError::MissingCapability)?;

        let before_version = run.version;
        run.request_cancellation()?;

        // Persist cancellation event
        let event = SerializedEvent {
            event_type: "RunCancellationRequested".to_string(),
            data: format!(
                r#"{{"run_id":"{}","state":"{:?}"}}"#,
                run_id.as_str(),
                run.state
            ),
            schema_version: 1,
        };

        let stream_id = format!("run:{}", run_id.as_str());
        self.event_store
            .append(&stream_id, before_version, vec![event])
            .await?;

        Ok(())
    }

    /// Create a snapshot of a run's current state.
    pub async fn create_snapshot(
        &self,
        run_id: &RunId,
    ) -> Result<SerializedSnapshot, ContractError> {
        let runs = self.runs.read().await;
        let run = runs.get(run_id).ok_or(ContractError::MissingCapability)?;

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
                if event.event_type == "RunStateChanged" {
                    let data: serde_json::Value = serde_json::from_str(&event.data)
                        .map_err(|_| ContractError::IncompatibleVersion)?;
                    if let Some(to_str) = data["to"].as_str() {
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
                } else if event.event_type == "RunStateChanged" {
                    let data: serde_json::Value = serde_json::from_str(&event.data)
                        .map_err(|_| ContractError::IncompatibleVersion)?;
                    if let Some(to_str) = data["to"].as_str() {
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
                        run.version += 1;
                        run.fencing_token += 1;
                    }
                }
            }

            run
        };

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
        let pool = sqlx::sqlite::SqlitePool::connect(connection_string).await?;

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

        // Verify expected version
        let count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM events WHERE stream_id = ? AND version >= ?")
                .bind(stream_id)
                .bind(expected_version as i64)
                .fetch_one(&mut *tx)
                .await
                .map_err(|_| ContractError::Persistence)?;

        if count > 0 {
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
            "SELECT event_type, data, schema_version FROM events WHERE stream_id = ? AND version > ? ORDER BY version ASC",
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
}

/// SQLite-based snapshot store for production persistence.
#[derive(Debug)]
pub struct SqliteSnapshotStore {
    pool: sqlx::sqlite::SqlitePool,
}

impl SqliteSnapshotStore {
    /// Create a new SQLite snapshot store with the given connection string.
    pub async fn new(connection_string: &str) -> Result<Self, sqlx::Error> {
        let pool = sqlx::sqlite::SqlitePool::connect(connection_string).await?;

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
