#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable channel registry and inbound event journal.

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-channels";

/// Persistent channel configuration.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChannelDefinition {
    /// Stable channel identifier.
    pub channel_id: String,
    /// Human-readable name.
    pub name: String,
    /// Adapter type, such as webhook, telegram or desktop.
    pub channel_type: String,
    /// Whether inbound delivery is enabled.
    pub enabled: bool,
    /// Conversation mode.
    pub mode: String,
    /// Preserve message threads.
    pub threading: bool,
    /// Allow attachments.
    pub attachments: bool,
    /// Allow voice messages.
    pub voice: bool,
    /// Default delivery target.
    pub delivery: String,
}

/// Durable inbound channel event.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelEvent {
    /// Protocol schema version.
    pub schema_version: u8,
    /// Stable event identifier.
    pub event_id: String,
    /// Channel receiving the event.
    pub channel_id: String,
    /// Agent/profile receiving the event.
    pub profile_id: String,
    /// Associated session, when known.
    pub session_id: Option<String>,
    /// Sender identity, when provided.
    pub sender_id: Option<String>,
    /// RFC3339 receipt timestamp.
    pub received_at: String,
    /// Provider payload.
    pub payload: Value,
    /// Attachment metadata.
    pub attachments: Vec<Value>,
}

/// Durable channel registry.
#[derive(Debug, Clone)]
pub struct ChannelRegistry {
    channels: Arc<RwLock<std::collections::HashMap<String, ChannelDefinition>>>,
    db: Arc<SqlitePool>,
}

impl ChannelRegistry {
    /// Open the registry and recover persisted channels.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("channel database connection failed: {error}"))?;

        agenticos_sqlite_migrations::migrate(database_url)
            .await
            .map_err(|error| format!("sqlite migrations failed: {error}"))?;

        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT channel_id, payload FROM channel_definitions",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("channel recovery failed: {error}"))?;

        let mut channels = std::collections::HashMap::with_capacity(rows.len());
        for (channel_id, payload) in rows {
            let channel: ChannelDefinition = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted channel {channel_id}: {error}"))?;
            channels.insert(channel_id, channel);
        }

        Ok(Self {
            channels: Arc::new(RwLock::new(channels)),
            db: Arc::new(db),
        })
    }

    fn validate_channel(channel: &ChannelDefinition) -> Result<(), String> {
        for (field, value, max) in [
            ("channel_id", channel.channel_id.as_str(), 128),
            ("name", channel.name.as_str(), 256),
            ("channel_type", channel.channel_type.as_str(), 128),
            ("mode", channel.mode.as_str(), 64),
            ("delivery", channel.delivery.as_str(), 256),
        ] {
            if value.trim().is_empty() {
                return Err(format!("{field} is required"));
            }
            if value.len() > max {
                return Err(format!("{field} exceeds supported limits"));
            }
        }
        Ok(())
    }

    /// Register or replace a channel configuration.
    pub async fn register(&self, channel: ChannelDefinition) -> Result<ChannelDefinition, String> {
        Self::validate_channel(&channel)?;
        let payload = serde_json::to_string(&channel)
            .map_err(|error| format!("channel serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO channel_definitions (channel_id, payload) VALUES (?, ?) ON CONFLICT(channel_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&channel.channel_id)
        .bind(payload)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("channel persistence failed: {error}"))?;
        self.channels
            .write()
            .await
            .insert(channel.channel_id.clone(), channel.clone());
        Ok(channel)
    }

    /// List channels in stable identifier order.
    pub async fn list(&self) -> Vec<ChannelDefinition> {
        let mut channels: Vec<_> = self.channels.read().await.values().cloned().collect();
        channels.sort_by(|left, right| left.channel_id.cmp(&right.channel_id));
        channels
    }

    /// Delete a channel and its associated events.
    pub async fn remove(&self, channel_id: &str) -> Result<(), String> {
        let id = channel_id.trim();
        if id.is_empty() {
            return Err("channel_id is required".to_string());
        }
        let mut tx = self
            .db
            .begin()
            .await
            .map_err(|error| format!("channel transaction failed: {error}"))?;
        sqlx::query("DELETE FROM channel_events WHERE channel_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("channel event deletion failed: {error}"))?;
        let result = sqlx::query("DELETE FROM channel_definitions WHERE channel_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("channel deletion failed: {error}"))?;
        tx.commit()
            .await
            .map_err(|error| format!("channel transaction commit failed: {error}"))?;
        if result.rows_affected() == 0 {
            return Err("channel not found".to_string());
        }
        self.channels.write().await.remove(id);
        Ok(())
    }

    /// Append one validated inbound event.
    pub async fn append_event(
        &self,
        channel_id: &str,
        profile_id: &str,
        session_id: Option<String>,
        sender_id: Option<String>,
        payload: Value,
        attachments: Vec<Value>,
    ) -> Result<ChannelEvent, String> {
        if channel_id.trim().is_empty() || profile_id.trim().is_empty() {
            return Err("channel_id and profile_id are required".to_string());
        }
        if !payload.is_object() {
            return Err("channel event payload must be an object".to_string());
        }
        if payload.to_string().len() > 1_000_000 {
            return Err("channel event payload exceeds supported limits".to_string());
        }
        if attachments.len() > 64 {
            return Err("too many channel attachments".to_string());
        }
        if !self.channels.read().await.contains_key(channel_id.trim()) {
            return Err("channel not found".to_string());
        }

        let event = ChannelEvent {
            schema_version: 1,
            event_id: format!("evt-{}", uuid::Uuid::new_v4()),
            channel_id: channel_id.trim().to_string(),
            profile_id: profile_id.trim().to_string(),
            session_id,
            sender_id,
            received_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            payload,
            attachments,
        };
        let serialized = serde_json::to_string(&event)
            .map_err(|error| format!("channel event serialization failed: {error}"))?;

        sqlx::query(
            "INSERT INTO channel_events (event_id, channel_id, received_at, payload) VALUES (?, ?, ?, ?)",
        )
        .bind(&event.event_id)
        .bind(&event.channel_id)
        .bind(&event.received_at)
        .bind(serialized)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("channel event persistence failed: {error}"))?;

        Ok(event)
    }

    /// Return the newest events for a channel.
    pub async fn events(
        &self,
        channel_id: &str,
        limit: usize,
    ) -> Result<Vec<ChannelEvent>, String> {
        if !self.channels.read().await.contains_key(channel_id.trim()) {
            return Err("channel not found".to_string());
        }
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT payload FROM channel_events WHERE channel_id = ? ORDER BY received_at DESC LIMIT ?",
        )
        .bind(channel_id.trim())
        .bind(limit.clamp(1, 500) as i64)
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("channel event query failed: {error}"))?;

        let mut events = Vec::with_capacity(rows.len());
        for (payload,) in rows {
            let event: ChannelEvent = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted channel event: {error}"))?;
            events.push(event);
        }
        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn registry() -> ChannelRegistry {
        let database_url = format!(
            "sqlite:file:agenticos_channels_{}?mode=memory&cache=shared",
            uuid::Uuid::new_v4()
        );
        ChannelRegistry::open(&database_url).await.unwrap()
    }

    fn channel() -> ChannelDefinition {
        ChannelDefinition {
            channel_id: "desktop".to_string(),
            name: "Desktop".to_string(),
            channel_type: "native".to_string(),
            enabled: true,
            mode: "Interactive".to_string(),
            threading: true,
            attachments: true,
            voice: true,
            delivery: "Workspace inbox".to_string(),
        }
    }

    #[tokio::test]
    async fn registers_and_lists_channel() {
        let registry = registry().await;
        registry.register(channel()).await.unwrap();
        assert_eq!(registry.list().await[0].channel_id, "desktop");
    }

    #[tokio::test]
    async fn persists_and_reads_events() {
        let registry = registry().await;
        registry.register(channel()).await.unwrap();
        let event = registry
            .append_event(
                "desktop",
                "default",
                Some("session-1".to_string()),
                Some("user-1".to_string()),
                serde_json::json!({"message":"hello"}),
                Vec::new(),
            )
            .await
            .unwrap();
        let events = registry.events("desktop", 10).await.unwrap();
        assert_eq!(events[0].event_id, event.event_id);
        assert_eq!(events[0].schema_version, 1);
    }
}
