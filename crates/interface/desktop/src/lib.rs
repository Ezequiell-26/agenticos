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

/// Initialize the Tauri app.
/// Note: This is a basic implementation. Full Tauri integration with React UI
/// will require additional setup including Vite, React components, and shadcn/ui.
/// Based on MIT repositories: MrLightful/create-tauri-react, agmmnn/tauri-ui, kitlib/tauri-app-template
pub fn run() {
    // Basic placeholder for Tauri app initialization
    // TODO: Add full Tauri integration with React UI, Vite, and shadcn/ui
    println!("AgentiCOS Desktop - Tauri + React UI structure initialized");
    println!("API Server: http://127.0.0.1:8080");
}

/// Send a message to the agent via backend API.
/// Note: This uses the backend API server. Full React UI integration will use
/// Tauri IPC commands and a React chat interface.
pub async fn send_message(message: UserMessage, api_url: &str) -> Result<AgentResponse, String> {
    // Send request to backend API
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/chat", api_url);

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "message": message.content,
            "session_id": message.session_id
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = json["response"]
        .as_str()
        .unwrap_or("No response")
        .to_string();

    let session_id = message.session_id.unwrap_or_else(|| "default".to_string());

    Ok(AgentResponse {
        content,
        is_complete: true,
        session_id,
    })
}

/// Get conversation history from backend API.
pub async fn get_conversation_history(
    session_id: &str,
    api_url: &str,
) -> Result<Vec<ConversationEntry>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/conversations/{}/history", api_url, session_id);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let _json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // For now, return empty history (placeholder)
    // TODO: Parse actual history from API response
    Ok(vec![])
}

/// Get the current agent status from backend API.
pub async fn get_agent_status(api_url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/agent/status", api_url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let agent_name = json["agent_name"].as_str().unwrap_or("Unknown").to_string();

    Ok(agent_name)
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
        // Note: This test uses a placeholder API URL
        // TODO: Add test with mock API server
        let response = send_message(msg, "http://127.0.0.1:8080").await;
        // Expect API request to fail in test environment
        assert!(response.is_err());
    }

    #[tokio::test]
    async fn test_get_agent_status() {
        // Note: This test uses a placeholder API URL
        // TODO: Add test with mock API server
        let status = get_agent_status("http://127.0.0.1:8080").await;
        // Expect API request to fail in test environment
        assert!(status.is_err());
    }

    #[test]
    fn test_agent_state() {
        let agent = Arc::new(ReactAgent::new("Test agent".to_string()));
        let state = AgentState::new(agent, "http://127.0.0.1:8080".to_string());

        assert_eq!(state.api_base_url(), "http://127.0.0.1:8080");
    }
}
