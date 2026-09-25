#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! durable memory and retrieval boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContextManager, ContextWindow, ContractError, MemoryEntry, MemoryStore, Message, RunId,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-memory";

/// In-memory context manager.
#[derive(Debug)]
pub struct InMemoryContextManager {
    messages: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    context_windows: Arc<RwLock<HashMap<String, ContextWindow>>>,
}

impl InMemoryContextManager {
    /// Create a new in-memory context manager.
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            context_windows: Arc::new(RwLock::new(HashMap::new())),
        }
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

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS memory_records (
                memory_id TEXT PRIMARY KEY,
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                importance REAL NOT NULL DEFAULT 0.5,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL DEFAULT 0,
                UNIQUE(namespace, key)
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory schema initialization failed: {error}"))
        })?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_memory_namespace_created ON memory_records(namespace, created_at DESC)",
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("memory index initialization failed: {error}"))
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

        self.get(namespace, key)
            .await?
            .ok_or(ContractError::Persistence)
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

    /// Delete a record by namespace and key.
    pub async fn delete(&self, namespace: &str, key: &str) -> Result<bool, ContractError> {
        let result = sqlx::query("DELETE FROM memory_records WHERE namespace = ? AND key = ?")
            .bind(namespace)
            .bind(key)
            .execute(&*self.db)
            .await
            .map_err(|error| ContractError::ParseError(format!("memory delete failed: {error}")))?;
        Ok(result.rows_affected() > 0)
    }

    /// Remove expired records.
    pub async fn purge_expired(&self) -> Result<u64, ContractError> {
        let result =
            sqlx::query("DELETE FROM memory_records WHERE expires_at != 0 AND expires_at <= ?")
                .bind(unix_time() as i64)
                .execute(&*self.db)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("memory purge failed: {error}"))
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
