#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! typed tool registry boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    AgentTool, ContractError, PolicyDecision, PolicyEngine, ToolEntry, ToolRequest, ToolResponse,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-tools";

/// In-memory tool registry.
#[derive(Debug)]
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, ToolEntry>>>,
}

impl ToolRegistry {
    /// Create a new tool registry.
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a tool.
    pub async fn register(&self, entry: ToolEntry) -> Result<(), ContractError> {
        let mut tools = self.tools.write().await;
        tools.insert(entry.tool_id.clone(), entry);
        Ok(())
    }

    /// Get a tool by ID.
    pub async fn get(&self, tool_id: &str) -> Option<ToolEntry> {
        let tools = self.tools.read().await;
        tools.get(tool_id).cloned()
    }

    /// List all tools.
    pub async fn list(&self) -> Vec<ToolEntry> {
        let tools = self.tools.read().await;
        tools.values().cloned().collect()
    }

    /// Check if a tool exists.
    pub async fn exists(&self, tool_id: &str) -> bool {
        let tools = self.tools.read().await;
        tools.contains_key(tool_id)
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Basic policy engine for tool approval.
#[derive(Debug)]
pub struct BasicPolicyEngine {
    registry: Arc<ToolRegistry>,
}

impl BasicPolicyEngine {
    /// Create a new basic policy engine.
    pub fn new(registry: Arc<ToolRegistry>) -> Self {
        Self { registry }
    }

    /// Create with a tool registry.
    pub fn with_registry() -> Self {
        let registry = Arc::new(ToolRegistry::new());
        Self::new(registry)
    }
}

#[async_trait::async_trait]
impl PolicyEngine for BasicPolicyEngine {
    async fn evaluate(&self, request: &ToolRequest) -> Result<PolicyDecision, ContractError> {
        // Check if tool exists
        if !self.registry.exists(&request.tool_id).await {
            return Ok(PolicyDecision::Denied("Tool not found".to_string()));
        }

        // Check if tool has required permissions
        if let Some(tool) = self.registry.get(&request.tool_id).await {
            if !tool.required_permissions.is_empty() {
                // In a real implementation, we would check the grant_id against required permissions
                // For now, we'll approve if the grant is provided
                if request.grant_id.is_empty() {
                    return Ok(PolicyDecision::Denied(
                        "Required permissions not granted".to_string(),
                    ));
                }
            }
        }

        Ok(PolicyDecision::Approved)
    }

    async fn check_capability(
        &self,
        _grant_id: &str,
        capability: &str,
    ) -> Result<bool, ContractError> {
        // Simple implementation - in production this would check actual capability grants
        Ok(!capability.is_empty())
    }
}

/// Echo tool for testing.
#[derive(Debug)]
pub struct EchoTool {
    tool_id: String,
}

impl EchoTool {
    /// Create a new echo tool.
    pub fn new(tool_id: String) -> Self {
        Self { tool_id }
    }
}

impl Default for EchoTool {
    fn default() -> Self {
        Self::new("echo".to_string())
    }
}

#[async_trait::async_trait]
impl AgentTool for EchoTool {
    fn tool_id(&self) -> &str {
        &self.tool_id
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        Ok(ToolResponse {
            request_id: request.request_id,
            result: format!("Echo: {}", request.parameters),
            success: true,
            error: None,
            metadata: Some("echo tool execution".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_tool_registry() {
        let rt = test_runtime();
        rt.block_on(async {
            let registry = ToolRegistry::new();

            let entry = ToolEntry {
                tool_id: "test-tool".to_string(),
                name: "Test Tool".to_string(),
                description: "A test tool".to_string(),
                capabilities: vec!["echo".to_string()],
                required_permissions: vec!["read".to_string()],
                context_requirements: vec![],
            };

            registry.register(entry.clone()).await.unwrap();

            let retrieved = registry.get("test-tool").await.unwrap();
            assert_eq!(retrieved.tool_id, "test-tool");

            assert!(registry.exists("test-tool").await);
        });
    }

    #[test]
    fn test_basic_policy_engine() {
        let rt = test_runtime();
        rt.block_on(async {
            let registry = Arc::new(ToolRegistry::new());

            let entry = ToolEntry {
                tool_id: "test-tool".to_string(),
                name: "Test Tool".to_string(),
                description: "A test tool".to_string(),
                capabilities: vec!["echo".to_string()],
                required_permissions: vec![],
                context_requirements: vec![],
            };

            registry.register(entry).await.unwrap();

            let engine = BasicPolicyEngine::new(registry);

            let request = ToolRequest {
                request_id: "req-1".to_string(),
                tool_id: "test-tool".to_string(),
                parameters: "{}".to_string(),
                agent_id: "agent-1".to_string(),
                grant_id: "grant-1".to_string(),
            };

            let decision = engine.evaluate(&request).await.unwrap();
            assert!(matches!(decision, PolicyDecision::Approved));
        });
    }

    #[test]
    fn test_echo_tool() {
        let rt = test_runtime();
        rt.block_on(async {
            let tool = EchoTool::new("echo".to_string());

            let request = ToolRequest {
                request_id: "req-1".to_string(),
                tool_id: "echo".to_string(),
                parameters: "Hello, world!".to_string(),
                agent_id: "agent-1".to_string(),
                grant_id: "grant-1".to_string(),
            };

            let response = tool.execute(request).await.unwrap();

            assert_eq!(response.request_id, "req-1");
            assert!(response.result.contains("Hello, world!"));
            assert!(response.success);
        });
    }
}
