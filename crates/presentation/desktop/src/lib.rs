#![forbid(unsafe_code)]

use agenticos_kernel::ReactAgent;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Agent state for Tauri.
pub struct AgentState {
    agent: Arc<ReactAgent>,
    api_base_url: String,
}

impl AgentState {
    /// Create a new agent state with API URL.
    pub fn new(agent: Arc<ReactAgent>, api_base_url: String) -> Self {
        Self {
            agent,
            api_base_url,
        }
    }

    /// Get the agent.
    pub fn agent(&self) -> Arc<ReactAgent> {
        self.agent.clone()
    }

    /// Get the API base URL.
    pub fn api_base_url(&self) -> &str {
        &self.api_base_url
    }
}

fn api_base_url() -> String {
    if let Ok(url) = std::env::var("AGENTICOS_API_URL") {
        if !url.trim().is_empty() {
            return url.trim_end_matches('/').to_string();
        }
    }

    let host = std::env::var("AGENTICOS_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("AGENTICOS_BIND_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let host = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host
    };
    format!("http://{host}:{port}")
}

/// Send a message to the agent via Tauri command.
#[tauri::command]
pub async fn send_agent_message(
    message: String,
    session_id: Option<String>,
) -> Result<AgentResponse, String> {
    let api_url = api_base_url();
    let user_message = UserMessage {
        content: message,
        session_id,
    };
    send_message(user_message, &api_url).await
}

/// Get conversation history for a session via Tauri command.
#[tauri::command]
pub async fn get_conversation_history(
    session_id: String,
) -> Result<Vec<ConversationEntry>, String> {
    let api_url = api_base_url();
    get_conversation_history_from_api(&session_id, &api_url).await
}

/// Get backend health status.
#[tauri::command]
pub async fn get_backend_health() -> Result<BackendHealth, String> {
    let api_url = api_base_url();
    let client = reqwest::Client::new();
    let url = format!("{api_url}/health");

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("API returned an error: {e}"))?;

    response
        .json::<BackendHealth>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))
}

/// Backend health status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendHealth {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
}

/// Message from the UI to the agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    pub content: String,
    pub session_id: Option<String>,
}

/// Response from the agent to the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub content: String,
    pub is_complete: bool,
    pub session_id: String,
}

/// Conversation history entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationEntry {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

/// Log the desktop integration entry point used by embedding hosts.
pub fn run() {
    println!("AgentiCOS Desktop runtime is managed by the canonical Tauri entry point.");
}

/// Send a message to the agent via backend API.
pub async fn send_message(message: UserMessage, api_url: &str) -> Result<AgentResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/chat", api_url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "message": message.content,
            "session_id": message.session_id
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("API returned an error: {e}"))?;

    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let content = json
        .get("response")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "API response did not contain a response field".to_string())?
        .to_string();

    let session_id = json
        .get("session_id")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .or(message.session_id)
        .unwrap_or_else(|| "default".to_string());

    Ok(AgentResponse {
        content,
        is_complete: true,
        session_id,
    })
}

/// Get conversation history from the backend API.
pub async fn get_conversation_history_from_api(
    session_id: &str,
    api_url: &str,
) -> Result<Vec<ConversationEntry>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/api/conversations/{}/history",
        api_url.trim_end_matches('/'),
        session_id
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("API returned an error: {e}"))?;

    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    let entries = json
        .get("history")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "history response did not contain an array".to_string())?;

    entries
        .iter()
        .map(|entry| {
            Ok(ConversationEntry {
                role: entry
                    .get("role")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("unknown")
                    .to_string(),
                content: entry
                    .get("content")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                timestamp: entry
                    .get("timestamp")
                    .and_then(serde_json::Value::as_i64)
                    .unwrap_or_default(),
            })
        })
        .collect()
}

/// Get the current agent name from the backend API.
pub async fn get_agent_status(api_url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/status", api_url.trim_end_matches('/'));

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("API returned an error: {e}"))?;

    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    Ok(json
        .get("agent_name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("Unknown")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_message_serialization() {
        let msg = UserMessage {
            content: "test".to_string(),
            session_id: Some("session-1".to_string()),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("test"));
    }

    #[test]
    fn test_agent_response_serialization() {
        let response = AgentResponse {
            content: "test response".to_string(),
            is_complete: true,
            session_id: "session-1".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("test response"));
    }

    #[tokio::test]
    async fn test_send_message() {
        let msg = UserMessage {
            content: "test".to_string(),
            session_id: Some("session-1".to_string()),
        };
        let response = send_message(msg, "http://127.0.0.1:8080").await;
        assert!(response.is_err());
    }

    #[tokio::test]
    async fn test_get_agent_status() {
        let status = get_agent_status("http://127.0.0.1:8080").await;
        assert!(status.is_err());
    }

    #[test]
    fn test_agent_state() {
        let agent = Arc::new(ReactAgent::new("Test agent".to_string()));
        let state = AgentState::new(agent, "http://127.0.0.1:8080".to_string());

        assert_eq!(state.api_base_url(), "http://127.0.0.1:8080");
    }
}
