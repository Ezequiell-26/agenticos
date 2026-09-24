#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! A2A 1.0 task and Agent Card boundary.
//!
//! The crate intentionally contains protocol objects and durable task metadata only.
//! AgentiCOS execution remains owned by the kernel/scheduler and is connected at the API layer.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Current A2A protocol version exposed by AgentiCOS.
pub const A2A_PROTOCOL_VERSION: &str = "1.0";

/// Transport binding used by the native A2A endpoint.
pub const A2A_PROTOCOL_BINDING: &str = "JSONRPC";

/// A2A Agent Card.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCard {
    /// Human-readable agent name.
    pub name: String,
    /// Human-readable description.
    pub description: String,
    /// Ordered protocol interfaces.
    pub supported_interfaces: Vec<AgentInterface>,
    /// Optional service provider information.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<AgentProvider>,
    /// Agent product version.
    pub version: String,
    /// Optional documentation URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation_url: Option<String>,
    /// Capability flags.
    pub capabilities: AgentCapabilities,
    /// Authentication scheme declarations.
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub security_schemes: HashMap<String, Value>,
    /// Authentication requirements.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub security_requirements: Vec<Value>,
    /// Supported input media types.
    pub default_input_modes: Vec<String>,
    /// Supported output media types.
    pub default_output_modes: Vec<String>,
    /// Advertised skills.
    pub skills: Vec<AgentSkill>,
    /// Optional signatures.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub signatures: Vec<Value>,
    /// Optional icon.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// A2A interface declaration.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInterface {
    /// Interface endpoint URL.
    pub url: String,
    /// Protocol binding.
    pub protocol_binding: String,
    /// Protocol version.
    pub protocol_version: String,
}

/// Provider information inside an Agent Card.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentProvider {
    /// Organization name.
    pub organization: String,
    /// Optional URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// A2A capability set.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCapabilities {
    /// Whether streaming is supported.
    #[serde(default)]
    pub streaming: bool,
    /// Whether push notifications are supported.
    #[serde(default)]
    pub push_notifications: bool,
    /// Whether an authenticated extended card is supported.
    #[serde(default)]
    pub extended_agent_card: bool,
    /// Optional extensions.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub extensions: Vec<Value>,
}

/// A2A skill description.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSkill {
    /// Stable skill identifier.
    pub id: String,
    /// Human-readable skill name.
    pub name: String,
    /// Description.
    pub description: String,
    /// Input media types.
    pub input_modes: Vec<String>,
    /// Output media types.
    pub output_modes: Vec<String>,
    /// Optional example prompts.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub examples: Vec<String>,
}

/// A2A message part. v1 uses member-based discrimination.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessagePart {
    /// Text part.
    Text {
        /// Text payload.
        text: String,
    },
    /// Structured data part.
    Data {
        /// Data payload.
        data: Value,
    },
    /// File part.
    File {
        /// File metadata/payload.
        file: Value,
    },
}

/// A2A message.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A2aMessage {
    /// Message identifier.
    pub message_id: String,
    /// Message role.
    pub role: String,
    /// Message parts.
    pub parts: Vec<MessagePart>,
    /// Optional context identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_id: Option<String>,
    /// Optional task identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
}

/// Durable A2A task record.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A2aTaskRecord {
    /// Task identifier.
    pub id: String,
    /// Context identifier.
    pub context_id: String,
    /// AgentiCOS Run identifier.
    pub run_id: String,
    /// Message history retained for protocol continuity.
    pub history: Vec<A2aMessage>,
    /// Creation timestamp.
    pub created_at: u64,
    /// Last update timestamp.
    pub updated_at: u64,
}

/// A2A task state.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskState {
    /// Task accepted and waiting for execution.
    Submitted,
    /// Task is executing.
    Working,
    /// Task completed.
    Completed,
    /// Task failed.
    Failed,
    /// Task was canceled.
    Canceled,
}

/// A2A task status.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStatus {
    /// Current task state.
    pub state: TaskState,
    /// Optional human-readable status message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<A2aMessage>,
}

/// A2A task response object.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskView {
    /// Task identifier.
    pub id: String,
    /// Context identifier.
    pub context_id: String,
    /// Current task status.
    pub status: TaskStatus,
    /// Artifacts produced by the task.
    #[serde(default)]
    pub artifacts: Vec<Value>,
    /// Message history.
    #[serde(default)]
    pub history: Vec<A2aMessage>,
}

/// JSON-RPC request.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC version.
    pub jsonrpc: String,
    /// Correlation id.
    pub id: Value,
    /// Method name.
    pub method: String,
    /// Method parameters.
    #[serde(default)]
    pub params: Value,
}

/// JSON-RPC response.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC version.
    pub jsonrpc: String,
    /// Correlation id.
    pub id: Value,
    /// Successful result.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    /// JSON-RPC error.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC error.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    /// Numeric error code.
    pub code: i32,
    /// Human-readable message.
    pub message: String,
    /// Optional structured data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Persisted A2A task registry.
#[derive(Debug, Clone)]
pub struct A2aTaskStore {
    pool: Arc<SqlitePool>,
    records: Arc<RwLock<HashMap<String, A2aTaskRecord>>>,
}

impl A2aTaskStore {
    /// Open a durable A2A task store and recover existing records.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let pool = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("A2A database connection failed: {error}"))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS a2a_tasks (
                task_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(|error| format!("A2A schema initialization failed: {error}"))?;

        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT task_id, payload FROM a2a_tasks ORDER BY task_id",
        )
        .fetch_all(&pool)
        .await
        .map_err(|error| format!("A2A task recovery failed: {error}"))?;

        let mut records = HashMap::with_capacity(rows.len());
        for (task_id, payload) in rows {
            let task: A2aTaskRecord = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted A2A task {task_id}: {error}"))?;
            records.insert(task_id, task);
        }

        Ok(Self {
            pool: Arc::new(pool),
            records: Arc::new(RwLock::new(records)),
        })
    }

    /// Create or replace a durable task.
    pub async fn put(&self, task: A2aTaskRecord) -> Result<(), String> {
        if task.id.trim().is_empty() || task.id.len() > 256 {
            return Err("invalid A2A task id".to_string());
        }
        if task.context_id.len() > 256 || task.run_id.len() > 256 {
            return Err("A2A task identifiers exceed supported limits".to_string());
        }

        let payload = serde_json::to_string(&task)
            .map_err(|error| format!("A2A task serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO a2a_tasks (task_id, payload) VALUES (?, ?)
             ON CONFLICT(task_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&task.id)
        .bind(payload)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| format!("A2A task persistence failed: {error}"))?;

        self.records.write().await.insert(task.id.clone(), task);
        Ok(())
    }

    /// Return a task by id.
    pub async fn get(&self, task_id: &str) -> Option<A2aTaskRecord> {
        self.records.read().await.get(task_id).cloned()
    }

    /// List all known tasks in stable order.
    pub async fn list(&self) -> Vec<A2aTaskRecord> {
        let mut tasks: Vec<_> = self.records.read().await.values().cloned().collect();
        tasks.sort_by(|left, right| left.id.cmp(&right.id));
        tasks
    }
}

/// Extract the text portions of an A2A message.
pub fn text_from_message(message: &A2aMessage) -> String {
    message
        .parts
        .iter()
        .filter_map(|part| match part {
            MessagePart::Text { text } => Some(text.as_str()),
            MessagePart::Data { .. } | MessagePart::File { .. } => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

impl TaskView {
    /// Build a task view from a durable record and a current task state.
    pub fn from_record(record: &A2aTaskRecord, state: TaskState) -> Self {
        Self {
            id: record.id.clone(),
            context_id: record.context_id.clone(),
            status: TaskStatus {
                state,
                message: None,
            },
            artifacts: Vec::new(),
            history: record.history.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_message_extracts_only_text_parts() {
        let message = A2aMessage {
            message_id: "m1".to_string(),
            role: "user".to_string(),
            parts: vec![
                MessagePart::Text {
                    text: "hello".to_string(),
                },
                MessagePart::Data {
                    data: serde_json::json!({"ignored": true}),
                },
                MessagePart::Text {
                    text: "world".to_string(),
                },
            ],
            context_id: None,
            task_id: None,
        };
        assert_eq!(text_from_message(&message), "hello\nworld");
    }

    #[test]
    fn task_view_preserves_history_and_state() {
        let record = A2aTaskRecord {
            id: "task-1".to_string(),
            context_id: "ctx-1".to_string(),
            run_id: "run-1".to_string(),
            history: Vec::new(),
            created_at: 1,
            updated_at: 2,
        };
        let view = TaskView::from_record(&record, TaskState::Submitted);
        assert_eq!(view.status.state, TaskState::Submitted);
        assert_eq!(view.id, "task-1");
    }
}


/// HTTP client for the AgentiCOS A2A boundary.
#[derive(Clone, Debug)]
pub struct A2aClient {
    client: reqwest::Client,
    endpoint: String,
    protocol_version: String,
}

impl A2aClient {
    /// Build an A2A client from a discovered Agent Card.
    pub fn from_agent_card(card: &AgentCard) -> Result<Self, String> {
        let interface = card
            .supported_interfaces
            .iter()
            .find(|interface| {
                interface
                    .protocol_binding
                    .eq_ignore_ascii_case(A2A_PROTOCOL_BINDING)
                    && interface.protocol_version == A2A_PROTOCOL_VERSION
            })
            .or_else(|| card.supported_interfaces.first())
            .ok_or_else(|| "Agent Card declares no supported interfaces".to_string())?;

        let endpoint = reqwest::Url::parse(&interface.url)
            .map_err(|error| format!("invalid A2A interface URL: {error}"))?
            .to_string();

        let client = reqwest::Client::builder()
            .user_agent(format!("AgentiCOS-A2A/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| format!("A2A HTTP client initialization failed: {error}"))?;

        Ok(Self {
            client,
            endpoint,
            protocol_version: interface.protocol_version.clone(),
        })
    }

    /// Discover and create a client from an Agent Card URL.
    pub async fn discover(card_url: &str) -> Result<Self, String> {
        let client = reqwest::Client::new();
        let response = client
            .get(card_url)
            .send()
            .await
            .map_err(|error| format!("A2A Agent Card request failed: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "A2A Agent Card request returned HTTP {}",
                response.status()
            ));
        }
        let card = response
            .json::<AgentCard>()
            .await
            .map_err(|error| format!("invalid A2A Agent Card: {error}"))?;
        Self::from_agent_card(&card)
    }

    async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        if method.trim().is_empty() {
            return Err("A2A method must not be empty".to_string());
        }

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Value::String(format!("a2a-{}", uuid::Uuid::new_v4())),
            method: method.to_string(),
            params,
        };

        let response = self
            .client
            .post(&self.endpoint)
            .header("Content-Type", "application/json")
            .header("A2A-Protocol-Version", &self.protocol_version)
            .json(&request)
            .send()
            .await
            .map_err(|error| format!("A2A request failed: {error}"))?;

        if !response.status().is_success() {
            return Err(format!("A2A request returned HTTP {}", response.status()));
        }

        let envelope = response
            .json::<JsonRpcResponse>()
            .await
            .map_err(|error| format!("invalid A2A JSON-RPC response: {error}"))?;

        if let Some(error) = envelope.error {
            return Err(format!("A2A error {}: {}", error.code, error.message));
        }

        envelope
            .result
            .ok_or_else(|| "A2A response contains neither result nor error".to_string())
    }

    /// Send a message to the remote agent and obtain its task.
    pub async fn send_message(&self, message: A2aMessage) -> Result<TaskView, String> {
        let value = self
            .call("message/send", serde_json::json!({ "message": message }))
            .await?;
        serde_json::from_value(value).map_err(|error| format!("invalid A2A task response: {error}"))
    }

    /// Retrieve a remote task by id.
    pub async fn get_task(&self, task_id: &str) -> Result<TaskView, String> {
        if task_id.trim().is_empty() || task_id.len() > 256 {
            return Err("invalid A2A task id".to_string());
        }
        let value = self
            .call("tasks/get", serde_json::json!({ "id": task_id }))
            .await?;
        serde_json::from_value(value).map_err(|error| format!("invalid A2A task response: {error}"))
    }

    /// Cancel a remote task by id.
    pub async fn cancel_task(&self, task_id: &str) -> Result<TaskView, String> {
        if task_id.trim().is_empty() || task_id.len() > 256 {
            return Err("invalid A2A task id".to_string());
        }
        let value = self
            .call("tasks/cancel", serde_json::json!({ "id": task_id }))
            .await?;
        serde_json::from_value(value).map_err(|error| format!("invalid A2A task response: {error}"))
    }
}
