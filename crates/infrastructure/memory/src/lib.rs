#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! durable memory and retrieval boundary. Functionality is introduced only through verified vertical slices.
//!
//! This module implements Engram-inspired persistent memory that maintains context across sessions.
//! Key concepts adapted from gentle-ai:
//! - **Session Persistence**: Context survives agent restarts
//! - **Decision Tracking**: Important decisions are recorded and retrievable
//! - **Context Compaction**: Session boundaries are preserved while memory persists

use agenticos_contracts::{
    ContextManager, ContextWindow, ContractError, MemoryEntry, MemoryStore, Message, RunId,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Session snapshot that preserves context across agent restarts.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionSnapshot {
    /// Unique session identifier.
    pub session_id: String,
    /// Project or workspace namespace.
    pub namespace: String,
    /// Timestamp when snapshot was created.
    pub created_at: i64,
    /// Important decisions made during this session.
    pub decisions: Vec<DecisionRecord>,
    /// Summary of work completed.
    pub summary: String,
    /// File paths that were modified.
    pub modified_files: Vec<String>,
}

/// A decision made by the agent that should persist across sessions.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DecisionRecord {
    /// Decision identifier.
    pub decision_id: String,
    /// Context of the decision (what was being solved).
    pub context: String,
    /// The decision that was made.
    pub decision: String,
    /// Reasoning behind the decision.
    pub reasoning: String,
    /// Timestamp of the decision.
    pub timestamp: i64,
    /// File path if decision relates to a specific file.
    pub file_path: Option<String>,
}

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-memory";

/// In-memory context manager with Engram-inspired session persistence.
#[derive(Debug)]
pub struct InMemoryContextManager {
    messages: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    context_windows: Arc<RwLock<HashMap<String, ContextWindow>>>,
    /// Session snapshots for cross-session memory.
    session_snapshots: Arc<RwLock<HashMap<String, SessionSnapshot>>>,
}

impl InMemoryContextManager {
    /// Create a new in-memory context manager with session persistence.
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            context_windows: Arc::new(RwLock::new(HashMap::new())),
            session_snapshots: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a session snapshot for cross-session memory.
    pub async fn create_session_snapshot(
        &self,
        session_id: &str,
        namespace: &str,
        summary: &str,
        modified_files: Vec<String>,
    ) -> Result<(), ContractError> {
        let snapshot = SessionSnapshot {
            session_id: session_id.to_string(),
            namespace: namespace.to_string(),
            created_at: unix_time() as i64,
            decisions: Vec::new(),
            summary: summary.to_string(),
            modified_files,
        };
        let mut snapshots = self.session_snapshots.write().await;
        snapshots.insert(session_id.to_string(), snapshot);
        Ok(())
    }

    /// Record a decision that should persist across sessions.
    pub async fn record_decision(
        &self,
        session_id: &str,
        context: &str,
        decision: &str,
        reasoning: &str,
        file_path: Option<String>,
    ) -> Result<(), ContractError> {
        let mut snapshots = self.session_snapshots.write().await;
        if let Some(snapshot) = snapshots.get_mut(session_id) {
            let decision_record = DecisionRecord {
                decision_id: format!("dec-{}", uuid::Uuid::new_v4()),
                context: context.to_string(),
                decision: decision.to_string(),
                reasoning: reasoning.to_string(),
                timestamp: unix_time() as i64,
                file_path,
            };
            snapshot.decisions.push(decision_record);
            Ok(())
        } else {
            Err(ContractError::ParseError("session not found".to_string()))
        }
    }

    /// Retrieve decisions from a previous session.
    pub async fn get_session_decisions(
        &self,
        session_id: &str,
    ) -> Result<Vec<DecisionRecord>, ContractError> {
        let snapshots = self.session_snapshots.read().await;
        if let Some(snapshot) = snapshots.get(session_id) {
            Ok(snapshot.decisions.clone())
        } else {
            Ok(Vec::new())
        }
    }

    /// Search decisions across all sessions for a given namespace.
    pub async fn search_decisions(
        &self,
        namespace: &str,
        query: &str,
    ) -> Result<Vec<DecisionRecord>, ContractError> {
        let snapshots = self.session_snapshots.read().await;
        let query_lower = query.to_lowercase();
        let mut results = Vec::new();

        for snapshot in snapshots.values() {
            if snapshot.namespace == namespace {
                for decision in &snapshot.decisions {
                    if decision.context.to_lowercase().contains(&query_lower)
                        || decision.decision.to_lowercase().contains(&query_lower)
                        || decision.reasoning.to_lowercase().contains(&query_lower)
                    {
                        results.push(decision.clone());
                    }
                }
            }
        }

        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(results)
    }

    /// Set context window for a run.
    pub async fn set_context_window(
        &self,
        run_id: RunId,
        window: ContextWindow,
    ) -> Result<(), ContractError> {
        let mut context_windows = self.context_windows.write().await;
        context_windows.insert(run_id.as_str().to_string(), window);
        Ok(())
    }
}

impl Default for InMemoryContextManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ContextManager for InMemoryContextManager {
    async fn add_message(&self, message: Message) -> Result<(), ContractError> {
        let mut messages = self.messages.write().await;
        let run_id = message.run_id.as_str().to_string();
        messages
            .entry(run_id.clone())
            .or_insert_with(Vec::new)
            .push(message);

        // Update token count
        let mut context_windows = self.context_windows.write().await;
        if let Some(window) = context_windows.get_mut(&run_id) {
            if let Some(msgs) = messages.get(&run_id) {
                window.current_tokens = msgs.iter().map(|m| m.token_count).sum();
            }
        }

        Ok(())
    }

    async fn get_context(&self, run_id: RunId) -> Result<Vec<Message>, ContractError> {
        let messages = self.messages.read().await;
        Ok(messages.get(run_id.as_str()).cloned().unwrap_or_default())
    }

    async fn trim_context(&self, run_id: RunId, max_tokens: u32) -> Result<(), ContractError> {
        let mut messages = self.messages.write().await;
        let run_id_str = run_id.as_str().to_string();

        if let Some(msgs) = messages.get_mut(&run_id_str) {
            let mut current_tokens: u32 = msgs.iter().map(|m| m.token_count).sum();

            while current_tokens > max_tokens && !msgs.is_empty() {
                let removed = msgs.remove(0);
                current_tokens -= removed.token_count;
            }

            // Update context window
            let mut context_windows = self.context_windows.write().await;
            if let Some(window) = context_windows.get_mut(&run_id_str) {
                window.current_tokens = current_tokens;
            }
        }

        Ok(())
    }

    async fn get_token_count(&self, run_id: RunId) -> Result<u32, ContractError> {
        let messages = self.messages.read().await;
        if let Some(msgs) = messages.get(run_id.as_str()) {
            Ok(msgs.iter().map(|m| m.token_count).sum())
        } else {
            Ok(0)
        }
    }
}

/// In-memory memory store.
#[derive(Debug)]
pub struct InMemoryMemoryStore {
    memories: Arc<RwLock<HashMap<String, MemoryEntry>>>,
}

impl InMemoryMemoryStore {
    /// Create a new in-memory memory store.
    pub fn new() -> Self {
        Self {
            memories: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryMemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl MemoryStore for InMemoryMemoryStore {
    async fn store(&self, entry: MemoryEntry) -> Result<(), ContractError> {
        let mut memories = self.memories.write().await;
        memories.insert(entry.memory_id.clone(), entry);
        Ok(())
    }

    async fn retrieve(&self, memory_id: &str) -> Result<Option<MemoryEntry>, ContractError> {
        let memories = self.memories.read().await;
        Ok(memories.get(memory_id).cloned())
    }

    async fn retrieve_by_run(&self, run_id: RunId) -> Result<Vec<MemoryEntry>, ContractError> {
        let memories = self.memories.read().await;
        Ok(memories
            .values()
            .filter(|m| m.run_id.as_str() == run_id.as_str())
            .cloned()
            .collect())
    }

    async fn delete(&self, memory_id: &str) -> Result<(), ContractError> {
        let mut memories = self.memories.write().await;
        memories.remove(memory_id);
        Ok(())
    }

    async fn delete_expired(&self, now: u64) -> Result<usize, ContractError> {
        let mut memories = self.memories.write().await;
        let before = memories.len();
        memories.retain(|_, m| m.expires_at == 0 || m.expires_at > now);
        Ok(before - memories.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_context_manager() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = InMemoryContextManager::new();

            let run_id = RunId::new("test-run").unwrap();

            let message = Message {
                message_id: "msg-1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: 12345,
                token_count: 5,
                run_id: run_id.clone(),
            };

            manager.add_message(message.clone()).await.unwrap();

            let context = manager.get_context(run_id.clone()).await.unwrap();
            assert_eq!(context.len(), 1);

            let token_count = manager.get_token_count(run_id.clone()).await.unwrap();
            assert_eq!(token_count, 5);
        });
    }

    #[test]
    fn test_context_trim() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = InMemoryContextManager::new();

            let run_id = RunId::new("test-run").unwrap();

            let message1 = Message {
                message_id: "msg-1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: 12345,
                token_count: 5,
                run_id: run_id.clone(),
            };

            let message2 = Message {
                message_id: "msg-2".to_string(),
                role: "assistant".to_string(),
                content: "World".to_string(),
                timestamp: 12346,
                token_count: 5,
                run_id: run_id.clone(),
            };

            manager.add_message(message1).await.unwrap();
            manager.add_message(message2).await.unwrap();

            manager.trim_context(run_id.clone(), 5).await.unwrap();

            let context = manager.get_context(run_id.clone()).await.unwrap();
            assert_eq!(context.len(), 1);
        });
    }

    #[test]
    fn test_memory_store() {
        let rt = test_runtime();
        rt.block_on(async {
            let store = InMemoryMemoryStore::new();

            let run_id = RunId::new("test-run").unwrap();

            let entry = MemoryEntry {
                memory_id: "mem-1".to_string(),
                run_id: run_id.clone(),
                key: "test_key".to_string(),
                value: "test_value".to_string(),
                timestamp: 12345,
                expires_at: 0,
            };

            store.store(entry.clone()).await.unwrap();

            let retrieved = store.retrieve("mem-1").await.unwrap();
            assert!(retrieved.is_some());

            let by_run = store.retrieve_by_run(run_id.clone()).await.unwrap();
            assert_eq!(by_run.len(), 1);
        });
    }

    #[test]
    fn test_memory_expiration() {
        let rt = test_runtime();
        rt.block_on(async {
            let store = InMemoryMemoryStore::new();

            let run_id = RunId::new("test-run").unwrap();

            let entry = MemoryEntry {
                memory_id: "mem-1".to_string(),
                run_id: run_id.clone(),
                key: "test_key".to_string(),
                value: "test_value".to_string(),
                timestamp: 12345,
                expires_at: 100,
            };

            store.store(entry).await.unwrap();

            let deleted = store.delete_expired(200).await.unwrap();
            assert_eq!(deleted, 1);

            let retrieved = store.retrieve("mem-1").await.unwrap();
            assert!(retrieved.is_none());
        });
    }
}

/// Persistent, namespace-aware long-term memory record.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct PersistentMemoryRecord {
    /// Stable memory identifier.
    pub memory_id: String,
    /// Isolation namespace such as project, user, agent, or run.
    pub namespace: String,
    /// Logical memory key.
    pub key: String,
    /// Stored value.
    pub value: String,
    /// JSON-encoded tags.
    pub tags: String,
    /// Importance used for retrieval ordering.
    pub importance: f64,
    /// Creation timestamp in seconds.
    pub created_at: i64,
    /// Optional expiration timestamp in seconds.
    pub expires_at: i64,
}

/// Embedding coverage for a namespace.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MemoryEmbeddingCoverage {
    /// Namespace covered by the report.
    pub namespace: String,
    /// Total live records in the namespace.
    pub total_records: u64,
    /// Live records with a usable embedding.
    pub embedded_records: u64,
    /// Live records without an embedding.
    pub missing_records: u64,
}

/// One offline semantic retrieval evaluation case.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticRetrievalCase {
    /// Query embedding.
    pub query_embedding: Vec<f32>,
    /// Memory IDs considered relevant for the query.
    pub relevant_memory_ids: Vec<String>,
}

/// Aggregate retrieval metrics for a set of semantic queries.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SemanticRetrievalReport {
    /// Number of evaluated queries.
    pub evaluated_queries: u64,
    /// Queries where the first result was relevant.
    pub hit_at_1: u64,
    /// Queries where at least one of the top-k results was relevant.
    pub hit_at_k: u64,
    /// Mean reciprocal rank across evaluated queries.
    pub mean_reciprocal_rank: f64,
}

/// SQLite-backed long-term memory store.
#[derive(Debug, Clone)]
pub struct PersistentMemoryStore {
    db: Arc<sqlx::SqlitePool>,
}

impl PersistentMemoryStore {
    /// Open or initialize the memory database.
    pub async fn new(database_url: &str) -> Result<Self, ContractError> {
        let db = sqlx::sqlite::SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("memory database connection failed: {error}"))
            })?;

        agenticos_sqlite_migrations::migrate_pool(&db)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("sqlite migrations failed: {error}"))
            })?;

        Ok(Self { db: Arc::new(db) })
    }

    /// Insert or update a namespace/key record.
    pub async fn upsert(
        &self,
        namespace: &str,
        key: &str,
        value: &str,
        tags: &[String],
        importance: f64,
        expires_at: i64,
    ) -> Result<PersistentMemoryRecord, ContractError> {
        let memory_id = format!("mem-{}", uuid::Uuid::new_v4());
        let now = unix_time() as i64;
        let tags_json = serde_json::to_string(tags).map_err(|error| {
            ContractError::ParseError(format!("memory tags serialization failed: {error}"))
        })?;

        sqlx::query(
            r#"
            INSERT INTO memory_records
                (memory_id, namespace, key, value, tags, importance, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
                value = excluded.value,
                tags = excluded.tags,
                importance = excluded.importance,
                expires_at = excluded.expires_at
            "#,
        )
        .bind(&memory_id)
        .bind(namespace)
        .bind(key)
        .bind(value)
        .bind(tags_json)
        .bind(importance.clamp(0.0, 1.0))
        .bind(now)
        .bind(expires_at.max(0))
        .execute(&*self.db)
        .await
        .map_err(|error| ContractError::ParseError(format!("memory upsert failed: {error}")))?;

        let record = self
            .get(namespace, key)
            .await?
            .ok_or(ContractError::Persistence)?;

        sqlx::query("DELETE FROM memory_embeddings WHERE memory_id = ?")
            .bind(&record.memory_id)
            .execute(&*self.db)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!(
                    "memory embedding invalidation failed: {error}"
                ))
            })?;

        Ok(record)
    }

    /// Get a live record by namespace and key.
    pub async fn get(
        &self,
        namespace: &str,
        key: &str,
    ) -> Result<Option<PersistentMemoryRecord>, ContractError> {
        sqlx::query_as::<_, PersistentMemoryRecord>(
            r#"
            SELECT memory_id, namespace, key, value, tags, importance, created_at, expires_at
            FROM memory_records
            WHERE namespace = ? AND key = ?
              AND (expires_at = 0 OR expires_at > ?)
            "#,
        )
        .bind(namespace)
        .bind(key)
        .bind(unix_time() as i64)
        .fetch_optional(&*self.db)
        .await
        .map_err(|error| ContractError::ParseError(format!("memory lookup failed: {error}")))
    }

    /// List live records for a namespace.
    pub async fn list(
        &self,
        namespace: &str,
        limit: usize,
    ) -> Result<Vec<PersistentMemoryRecord>, ContractError> {
        sqlx::query_as::<_, PersistentMemoryRecord>(
            r#"
            SELECT memory_id, namespace, key, value, tags, importance, created_at, expires_at
            FROM memory_records
            WHERE namespace = ?
              AND (expires_at = 0 OR expires_at > ?)
            ORDER BY importance DESC, created_at DESC
            LIMIT ?
            "#,
        )
        .bind(namespace)
        .bind(unix_time() as i64)
        .bind(limit.clamp(1, 500) as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|error| ContractError::ParseError(format!("memory list failed: {error}")))
    }

    /// Search keys, values, and tags for a namespace.
    pub async fn search(
        &self,
        namespace: &str,
        query: &str,
        limit: usize,
    ) -> Result<Vec<PersistentMemoryRecord>, ContractError> {
        let query = query.trim();
        if query.is_empty() {
            return self.list(namespace, limit).await;
        }

        let escaped = escape_like_pattern(query);
        let pattern = format!("%{escaped}%");
        let candidates = sqlx::query_as::<_, PersistentMemoryRecord>(
            r#"
            SELECT memory_id, namespace, key, value, tags, importance, created_at, expires_at
            FROM memory_records
            WHERE namespace = ?
              AND (expires_at = 0 OR expires_at > ?)
              AND (
                    key LIKE ? ESCAPE '\\'
                    OR value LIKE ? ESCAPE '\\'
                    OR tags LIKE ? ESCAPE '\\'
              )
            ORDER BY importance DESC, created_at DESC
            LIMIT 500
            "#,
        )
        .bind(namespace)
        .bind(unix_time() as i64)
        .bind(&pattern)
        .bind(&pattern)
        .bind(&pattern)
        .fetch_all(&*self.db)
        .await
        .map_err(|error| ContractError::ParseError(format!("memory search failed: {error}")))?;

        let terms = query
            .split_whitespace()
            .map(|term| term.trim_matches(|ch: char| !ch.is_alphanumeric()))
            .filter(|term| term.len() >= 2)
            .map(|term| term.to_lowercase())
            .collect::<Vec<_>>();

        let now = unix_time() as i64;
        let mut ranked = candidates
            .into_iter()
            .map(|record| {
                let haystack = format!(
                    "{} {} {}",
                    record.key.to_lowercase(),
                    record.value.to_lowercase(),
                    record.tags.to_lowercase()
                );
                let matched_terms = terms
                    .iter()
                    .filter(|term| haystack.contains(term.as_str()))
                    .count();
                let phrase_bonus = if haystack.contains(&query.to_lowercase()) {
                    1.0
                } else {
                    0.0
                };
                let coverage = if terms.is_empty() {
                    0.0
                } else {
                    matched_terms as f64 / terms.len() as f64
                };
                let age_hours = ((now - record.created_at).max(0) as f64 / 3600.0).min(720.0);
                let freshness = 1.0 / (1.0 + age_hours / 24.0);
                let score = coverage * 0.60
                    + phrase_bonus * 0.20
                    + record.importance.clamp(0.0, 1.0) * 0.15
                    + freshness * 0.05;
                (score, record)
            })
            .collect::<Vec<_>>();

        ranked.sort_by(|(left_score, left), (right_score, right)| {
            right_score
                .partial_cmp(left_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    right
                        .importance
                        .partial_cmp(&left.importance)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| right.created_at.cmp(&left.created_at))
                .then_with(|| left.memory_id.cmp(&right.memory_id))
        });

        Ok(ranked
            .into_iter()
            .take(limit.clamp(1, 500))
            .map(|(_, record)| record)
            .collect())
    }

    /// Store or replace the embedding associated with a memory record.
    pub async fn set_embedding(
        &self,
        memory_id: &str,
        embedding: &[f32],
    ) -> Result<(), ContractError> {
        if memory_id.trim().is_empty() || embedding.is_empty() || embedding.len() > 16_384 {
            return Err(ContractError::ParseError(
                "invalid memory embedding".to_string(),
            ));
        }
        if embedding.iter().any(|value| !value.is_finite()) {
            return Err(ContractError::ParseError(
                "memory embedding contains a non-finite value".to_string(),
            ));
        }
        let payload = serde_json::to_string(embedding).map_err(|error| {
            ContractError::ParseError(format!("memory embedding serialization failed: {error}"))
        })?;
        let updated = sqlx::query(
            "INSERT INTO memory_embeddings(memory_id, embedding, dimension)
             SELECT ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM memory_records WHERE memory_id = ?)
             ON CONFLICT(memory_id) DO UPDATE SET embedding = excluded.embedding, dimension = excluded.dimension",
        )
        .bind(memory_id)
        .bind(payload)
        .bind(embedding.len() as i64)
        .bind(memory_id)
        .execute(&*self.db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory embedding persistence failed: {error}"))
        })?;
        if updated.rows_affected() == 0 {
            return Err(ContractError::Persistence);
        }
        Ok(())
    }

    /// Search memory records by cosine similarity against a query embedding.
    pub async fn search_semantic(
        &self,
        namespace: &str,
        embedding: &[f32],
        limit: usize,
    ) -> Result<Vec<PersistentMemoryRecord>, ContractError> {
        if embedding.is_empty()
            || embedding.len() > 16_384
            || embedding.iter().any(|value| !value.is_finite())
        {
            return Err(ContractError::ParseError(
                "invalid query embedding".to_string(),
            ));
        }

        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                f64,
                String,
                i64,
                i64,
                String,
                i64,
            ),
        >(
            "SELECT
                m.memory_id, m.namespace, m.key, m.value, m.importance, m.tags,
                m.created_at, m.expires_at, e.embedding, e.dimension
             FROM memory_records m
             INNER JOIN memory_embeddings e ON e.memory_id = m.memory_id
             WHERE m.namespace = ?
               AND (m.expires_at = 0 OR m.expires_at > ?)
             ORDER BY m.created_at DESC
             LIMIT 500",
        )
        .bind(namespace)
        .bind(unix_time() as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("semantic memory query failed: {error}"))
        })?;

        let query_norm = embedding
            .iter()
            .map(|value| (*value as f64) * (*value as f64))
            .sum::<f64>()
            .sqrt();
        if query_norm == 0.0 {
            return Err(ContractError::ParseError(
                "query embedding has zero magnitude".to_string(),
            ));
        }

        let mut ranked = Vec::with_capacity(rows.len());
        for (
            memory_id,
            namespace_value,
            key,
            value,
            importance,
            tags,
            created_at,
            expires_at,
            payload,
            dimension,
        ) in rows
        {
            if dimension <= 0 || dimension as usize != embedding.len() {
                continue;
            }
            let record = PersistentMemoryRecord {
                memory_id,
                namespace: namespace_value,
                key,
                value,
                tags,
                importance,
                created_at,
                expires_at,
            };
            let candidate = match serde_json::from_str::<Vec<f32>>(&payload) {
                Ok(value) => value,
                Err(_) => continue,
            };
            if candidate.len() != embedding.len()
                || candidate.iter().any(|value| !value.is_finite())
            {
                continue;
            }
            let mut dot = 0.0_f64;
            let mut candidate_norm = 0.0_f64;
            for (left, right) in embedding.iter().zip(candidate.iter()) {
                dot += (*left as f64) * (*right as f64);
                candidate_norm += (*right as f64) * (*right as f64);
            }
            if candidate_norm == 0.0 {
                continue;
            }
            let cosine = dot / (query_norm * candidate_norm.sqrt());
            let score = cosine * 0.85 + record.importance.clamp(0.0, 1.0) * 0.10;
            ranked.push((score, record));
        }

        ranked.sort_by(|(left_score, left), (right_score, right)| {
            right_score
                .partial_cmp(left_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    right
                        .importance
                        .partial_cmp(&left.importance)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| right.created_at.cmp(&left.created_at))
                .then_with(|| left.memory_id.cmp(&right.memory_id))
        });

        Ok(ranked
            .into_iter()
            .take(limit.clamp(1, 500))
            .map(|(_, record)| record)
            .collect())
    }

    /// Report embedding coverage for a namespace.
    pub async fn embedding_coverage(
        &self,
        namespace: &str,
    ) -> Result<MemoryEmbeddingCoverage, ContractError> {
        let row = sqlx::query_as::<_, (i64, i64)>(
            "SELECT
                COUNT(*) AS total_records,
                COUNT(e.memory_id) AS embedded_records
             FROM memory_records m
             LEFT JOIN memory_embeddings e ON e.memory_id = m.memory_id
             WHERE m.namespace = ?
               AND (m.expires_at = 0 OR m.expires_at > ?)",
        )
        .bind(namespace)
        .bind(unix_time() as i64)
        .fetch_one(&*self.db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory embedding coverage failed: {error}"))
        })?;

        let total_records = row.0.max(0) as u64;
        let embedded_records = row.1.max(0) as u64;
        Ok(MemoryEmbeddingCoverage {
            namespace: namespace.to_string(),
            total_records,
            embedded_records: embedded_records.min(total_records),
            missing_records: total_records.saturating_sub(embedded_records),
        })
    }

    /// Load live records that still need embeddings.
    pub async fn records_missing_embeddings(
        &self,
        namespace: &str,
        limit: usize,
    ) -> Result<Vec<PersistentMemoryRecord>, ContractError> {
        sqlx::query_as::<_, PersistentMemoryRecord>(
            "SELECT
                m.memory_id, m.namespace, m.key, m.value, m.tags, m.importance,
                m.created_at, m.expires_at
             FROM memory_records m
             LEFT JOIN memory_embeddings e ON e.memory_id = m.memory_id
             WHERE m.namespace = ?
               AND e.memory_id IS NULL
               AND (m.expires_at = 0 OR m.expires_at > ?)
             ORDER BY m.importance DESC, m.created_at DESC
             LIMIT ?",
        )
        .bind(namespace)
        .bind(unix_time() as i64)
        .bind(limit.clamp(1, 500) as i64)
        .fetch_all(&*self.db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory embedding backfill query failed: {error}"))
        })
    }

    /// Evaluate semantic retrieval against known relevant memory IDs.
    pub async fn evaluate_semantic_retrieval(
        &self,
        namespace: &str,
        cases: &[SemanticRetrievalCase],
        limit: usize,
    ) -> Result<SemanticRetrievalReport, ContractError> {
        if cases.is_empty() {
            return Ok(SemanticRetrievalReport {
                evaluated_queries: 0,
                hit_at_1: 0,
                hit_at_k: 0,
                mean_reciprocal_rank: 0.0,
            });
        }

        let k = limit.clamp(1, 100);
        let mut hit_at_1 = 0_u64;
        let mut hit_at_k = 0_u64;
        let mut reciprocal_rank_sum = 0.0_f64;

        for case in cases {
            if case.relevant_memory_ids.is_empty() {
                continue;
            }
            let relevant = case
                .relevant_memory_ids
                .iter()
                .map(String::as_str)
                .collect::<std::collections::HashSet<_>>();
            let results = self
                .search_semantic(namespace, &case.query_embedding, k)
                .await?;

            if results
                .first()
                .map(|record| relevant.contains(record.memory_id.as_str()))
                .unwrap_or(false)
            {
                hit_at_1 += 1;
            }

            let mut reciprocal_rank = 0.0_f64;
            for (index, record) in results.iter().enumerate() {
                if relevant.contains(record.memory_id.as_str()) {
                    hit_at_k += 1;
                    reciprocal_rank = 1.0 / (index as f64 + 1.0);
                    break;
                }
            }
            reciprocal_rank_sum += reciprocal_rank;
        }

        let evaluated_queries = cases
            .iter()
            .filter(|case| !case.relevant_memory_ids.is_empty())
            .count() as u64;
        let mean_reciprocal_rank = if evaluated_queries == 0 {
            0.0
        } else {
            reciprocal_rank_sum / evaluated_queries as f64
        };

        Ok(SemanticRetrievalReport {
            evaluated_queries,
            hit_at_1,
            hit_at_k,
            mean_reciprocal_rank,
        })
    }

    /// Delete a record by namespace and key.
    pub async fn delete(&self, namespace: &str, key: &str) -> Result<bool, ContractError> {
        let memory_id = sqlx::query_scalar::<_, String>(
            "SELECT memory_id FROM memory_records WHERE namespace = ? AND key = ?",
        )
        .bind(namespace)
        .bind(key)
        .fetch_optional(&*self.db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory delete lookup failed: {error}"))
        })?;

        let result = sqlx::query("DELETE FROM memory_records WHERE namespace = ? AND key = ?")
            .bind(namespace)
            .bind(key)
            .execute(&*self.db)
            .await
            .map_err(|error| ContractError::ParseError(format!("memory delete failed: {error}")))?;
        if let Some(memory_id) = memory_id {
            sqlx::query("DELETE FROM memory_embeddings WHERE memory_id = ?")
                .bind(memory_id)
                .execute(&*self.db)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("memory embedding delete failed: {error}"))
                })?;
        }
        Ok(result.rows_affected() > 0)
    }

    /// Remove expired records and their associated embeddings.
    pub async fn purge_expired(&self) -> Result<u64, ContractError> {
        let now = unix_time() as i64;
        let mut transaction = self.db.begin().await.map_err(|error| {
            ContractError::ParseError(format!("memory purge transaction failed: {error}"))
        })?;

        sqlx::query(
            "DELETE FROM memory_embeddings
             WHERE memory_id IN (
                 SELECT memory_id
                 FROM memory_records
                 WHERE expires_at != 0 AND expires_at <= ?
             )",
        )
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory embedding purge failed: {error}"))
        })?;

        let result =
            sqlx::query("DELETE FROM memory_records WHERE expires_at != 0 AND expires_at <= ?")
                .bind(now)
                .execute(&mut *transaction)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("memory purge failed: {error}"))
                })?;

        transaction.commit().await.map_err(|error| {
            ContractError::ParseError(format!("memory purge commit failed: {error}"))
        })?;

        Ok(result.rows_affected())
    }
}

fn escape_like_pattern(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn unix_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod persistent_memory_tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn persists_and_searches_records() {
        let path =
            std::env::temp_dir().join(format!("agenticos-memory-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();
        store
            .upsert(
                "project:test",
                "goal",
                "build a resilient agent runtime",
                &["architecture".to_string()],
                0.9,
                0,
            )
            .await
            .unwrap();

        assert_eq!(store.list("project:test", 10).await.unwrap().len(), 1);
        assert_eq!(
            store
                .search("project:test", "resilient", 10)
                .await
                .unwrap()
                .len(),
            1
        );
        assert!(store.get("project:test", "goal").await.unwrap().is_some());

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn set_embedding_rejects_unknown_memory() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-memory-orphan-{}.db",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        let result = store
            .set_embedding("missing-memory", &[1.0, 0.0, 0.0])
            .await;
        assert!(matches!(result, Err(ContractError::Persistence)));

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn upsert_invalidates_stale_embedding() {
        let path =
            std::env::temp_dir().join(format!("agenticos-memory-invalidate-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        let first = store
            .upsert("project:invalidate", "goal", "old value", &[], 0.8, 0)
            .await
            .unwrap();
        store
            .set_embedding(&first.memory_id, &[1.0, 0.0, 0.0])
            .await
            .unwrap();
        assert_eq!(
            store
                .embedding_coverage("project:invalidate")
                .await
                .unwrap()
                .embedded_records,
            1
        );

        let updated = store
            .upsert(
                "project:invalidate",
                "goal",
                "new value",
                &["updated".to_string()],
                0.9,
                0,
            )
            .await
            .unwrap();

        assert_eq!(updated.memory_id, first.memory_id);
        assert_eq!(
            store
                .embedding_coverage("project:invalidate")
                .await
                .unwrap()
                .missing_records,
            1
        );
        assert!(
            store
                .search_semantic("project:invalidate", &[1.0, 0.0, 0.0], 10)
                .await
                .unwrap()
                .is_empty(),
            "stale embedding must not remain searchable after memory content changes"
        );

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn search_ranks_term_coverage_and_importance() {
        let path =
            std::env::temp_dir().join(format!("agenticos-memory-rank-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        store
            .upsert(
                "project:test",
                "rust-runtime",
                "durable scheduler workers and recovery",
                &["backend".to_string()],
                0.9,
                0,
            )
            .await
            .unwrap();
        store
            .upsert(
                "project:test",
                "rust-notes",
                "scheduler notes",
                &["backend".to_string()],
                0.2,
                0,
            )
            .await
            .unwrap();

        let results = store
            .search("project:test", "durable scheduler workers", 2)
            .await
            .unwrap();
        assert_eq!(
            results.first().map(|record| record.key.as_str()),
            Some("rust-runtime")
        );

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn embedding_coverage_reports_missing_records() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-memory-coverage-{}.db",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        let record = store
            .upsert("project:coverage", "record", "semantic memory", &[], 0.8, 0)
            .await
            .unwrap();

        let coverage = store.embedding_coverage("project:coverage").await.unwrap();
        assert_eq!(coverage.total_records, 1);
        assert_eq!(coverage.embedded_records, 0);
        assert_eq!(coverage.missing_records, 1);

        store
            .set_embedding(&record.memory_id, &[1.0, 0.0, 0.0])
            .await
            .unwrap();
        let coverage = store.embedding_coverage("project:coverage").await.unwrap();
        assert_eq!(coverage.embedded_records, 1);
        assert_eq!(coverage.missing_records, 0);

        let missing = store
            .records_missing_embeddings("project:coverage", 10)
            .await
            .unwrap();
        assert!(missing.is_empty());

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn semantic_retrieval_evaluation_reports_hits() {
        let path =
            std::env::temp_dir().join(format!("agenticos-memory-eval-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        let first = store
            .upsert("project:eval", "rust", "durable rust runtime", &[], 0.9, 0)
            .await
            .unwrap();
        let second = store
            .upsert("project:eval", "python", "python scripting", &[], 0.5, 0)
            .await
            .unwrap();

        store
            .set_embedding(&first.memory_id, &[1.0, 0.0])
            .await
            .unwrap();
        store
            .set_embedding(&second.memory_id, &[0.0, 1.0])
            .await
            .unwrap();

        let report = store
            .evaluate_semantic_retrieval(
                "project:eval",
                &[SemanticRetrievalCase {
                    query_embedding: vec![1.0, 0.0],
                    relevant_memory_ids: vec![first.memory_id.clone()],
                }],
                2,
            )
            .await
            .unwrap();

        assert_eq!(report.evaluated_queries, 1);
        assert_eq!(report.hit_at_1, 1);
        assert_eq!(report.hit_at_k, 1);
        assert_eq!(report.mean_reciprocal_rank, 1.0);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn purge_expired_removes_embeddings() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-memory-purge-{}.db",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();

        let now = unix_time() as i64;
        let record = store
            .upsert(
                "project:purge",
                "expired",
                "expired memory",
                &[],
                0.5,
                now.saturating_sub(1),
            )
            .await
            .unwrap();
        store
            .set_embedding(&record.memory_id, &[1.0, 0.0])
            .await
            .unwrap();

        assert_eq!(store.purge_expired().await.unwrap(), 1);
        assert!(store.get("project:purge", "expired").await.unwrap().is_none());

        let embedding_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM memory_embeddings WHERE memory_id = ?",
        )
        .bind(&record.memory_id)
        .fetch_one(&*store.db)
        .await
        .unwrap();
        assert_eq!(embedding_count, 0);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn expired_records_are_not_returned() {
        let path =
            std::env::temp_dir().join(format!("agenticos-memory-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let store = PersistentMemoryStore::new(&url).await.unwrap();
        let expired = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
            - 1;
        store
            .upsert("session:test", "old", "expired", &[], 0.2, expired)
            .await
            .unwrap();
        assert!(store.get("session:test", "old").await.unwrap().is_none());
        assert_eq!(store.purge_expired().await.unwrap(), 1);
        let _ = std::fs::remove_file(path);
    }
}
