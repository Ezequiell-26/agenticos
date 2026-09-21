#![forbid(unsafe_code)]

use agenticos_kernel::ReactAgent;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Agent state for Tauri.
pub struct AgentState {
    _agent: Arc<ReactAgent>,
}

impl AgentState {
    pub fn new(agent: Arc<ReactAgent>) -> Self {
        Self { _agent: agent }
    }
}

/// Message from the UI to the agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    pub content: String,
}

/// Response from the agent to the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub content: String,
    pub is_complete: bool,
}

/// Initialize the Tauri app.
/// Note: This is a basic implementation. Full Tauri integration with build scripts
/// and bundle configuration will be added in a future slice.
pub fn run() {
    // Basic placeholder for Tauri app initialization
    // TODO: Add full Tauri integration with build scripts and bundle configuration
    println!("AgentiCOS Desktop - Basic Tauri structure initialized");
}

/// Send a message to the agent.
/// Note: This is a basic implementation. Full IPC integration will be added in a future slice.
pub async fn send_message(message: UserMessage) -> Result<AgentResponse, String> {
    // For now, return a simple response
    // TODO: Integrate with ReactAgent execute_turn
    Ok(AgentResponse {
        content: format!("Received: {}", message.content),
        is_complete: true,
    })
}

/// Get the current agent status.
/// Note: This is a basic implementation. Full state management will be added in a future slice.
pub async fn get_agent_status() -> Result<String, String> {
    Ok("AgentiCOS".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_message_serialization() {
        let msg = UserMessage {
            content: "test".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("test"));
    }

    #[test]
    fn test_agent_response_serialization() {
        let response = AgentResponse {
            content: "test response".to_string(),
            is_complete: true,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("test response"));
    }

    #[tokio::test]
    async fn test_send_message() {
        let msg = UserMessage {
            content: "test".to_string(),
        };
        let response = send_message(msg).await.unwrap();
        assert!(response.content.contains("test"));
        assert!(response.is_complete);
    }

    #[tokio::test]
    async fn test_get_agent_status() {
        let status = get_agent_status().await.unwrap();
        assert_eq!(status, "AgentiCOS");
    }
}
