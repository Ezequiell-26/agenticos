#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable audit trail for state-changing and security-sensitive backend actions.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use uuid::Uuid;

/// A durable runtime audit event.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Stable identifier.
    pub event_id: String,
    /// Unix timestamp in seconds.
    pub timestamp: u64,
    /// Event category.
    pub category: String,
    /// Action name.
    pub action: String,
    /// Optional actor identifier.
    pub actor: Option<String>,
    /// Resource affected.
    pub resource: String,
    /// Optional correlation identifier.
    pub correlation_id: Option<String>,
    /// Outcome.
    pub outcome: String,
    /// Structured metadata.
    pub metadata: serde_json::Value,
}

impl AuditEvent {
    /// Create an audit event with a generated identifier and current timestamp.
    pub fn new(
        category: impl Into<String>,
        action: impl Into<String>,
        actor: Option<String>,
        resource: impl Into<String>,
        correlation_id: Option<String>,
        outcome: impl Into<String>,
        metadata: serde_json::Value,
    ) -> Self {
        Self {
            event_id: format!("audit-{}", Uuid::new_v4()),
            timestamp: unix_time(),
            category: category.into(),
            action: action.into(),
            actor,
            resource: resource.into(),
            correlation_id,
            outcome: outcome.into(),
            metadata,
        }
    }
}

/// SQLite-backed durable audit store.
#[derive(Clone, Debug)]
pub struct AuditStore {
    db: Arc<SqlitePool>,
}

impl AuditStore {
    /// Open the audit store and initialize the schema.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("audit database connection failed: {error}"))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS audit_events (
                event_id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                category TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT,
                resource TEXT NOT NULL,
                correlation_id TEXT,
                outcome TEXT NOT NULL,
                metadata TEXT NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| format!("audit schema initialization failed: {error}"))?;

        Ok(Self { db: Arc::new(db) })
    }

    /// Append an audit event durably.
    pub async fn append(&self, event: AuditEvent) -> Result<(), String> {
        let metadata = serde_json::to_string(&event.metadata)
            .map_err(|error| format!("audit metadata serialization failed: {error}"))?;

        sqlx::query(
            r#"
            INSERT INTO audit_events
                (event_id, timestamp, category, action, actor, resource, correlation_id, outcome, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.event_id)
        .bind(event.timestamp as i64)
        .bind(&event.category)
        .bind(&event.action)
        .bind(event.actor.as_deref())
        .bind(&event.resource)
        .bind(event.correlation_id.as_deref())
        .bind(&event.outcome)
        .bind(metadata)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("audit persistence failed: {error}"))?;

        Ok(())
    }

    /// Return recent events, newest first.
    pub async fn list_recent(&self, limit: usize) -> Result<Vec<AuditEvent>, String> {
        let limit = limit.clamp(1, 1_000) as i64;
        let rows = sqlx::query_as::<
            _,
            (
                String,
                i64,
                String,
                String,
                Option<String>,
                String,
                Option<String>,
                String,
                String,
            ),
        >(
            r#"
            SELECT event_id, timestamp, category, action, actor, resource,
                   correlation_id, outcome, metadata
            FROM audit_events
            ORDER BY timestamp DESC, event_id DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("audit query failed: {error}"))?;

        rows.into_iter()
            .map(
                |(
                    event_id,
                    timestamp,
                    category,
                    action,
                    actor,
                    resource,
                    correlation_id,
                    outcome,
                    metadata,
                )| {
                    Ok(AuditEvent {
                        event_id,
                        timestamp: timestamp.max(0) as u64,
                        category,
                        action,
                        actor,
                        resource,
                        correlation_id,
                        outcome,
                        metadata: serde_json::from_str(&metadata)
                            .map_err(|error| format!("invalid audit metadata: {error}"))?,
                    })
                },
            )
            .collect()
    }
}

fn unix_time() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn audit_events_survive_reopen() {
        let path = std::env::temp_dir().join(format!("agenticos-audit-{}.db", Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let store = AuditStore::open(&url).await.unwrap();
        store
            .append(AuditEvent::new(
                "run",
                "create",
                Some("test-user".to_string()),
                "run/test",
                Some("corr-1".to_string()),
                "success",
                serde_json::json!({"source":"test"}),
            ))
            .await
            .unwrap();
        drop(store);

        let reopened = AuditStore::open(&url).await.unwrap();
        let events = reopened.list_recent(10).await.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].resource, "run/test");
        assert_eq!(events[0].metadata["source"], "test");

        let _ = std::fs::remove_file(path);
    }
}
