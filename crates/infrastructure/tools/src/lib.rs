#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! typed tool registry boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    AgentTool, CapabilityType, ContractError, PolicyDecision, PolicyEngine, ToolEntry, ToolRequest,
    ToolResponse,
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
    capabilities: Option<Arc<agenticos_security::CapabilityManager>>,
}

impl BasicPolicyEngine {
    /// Create a new basic policy engine.
    pub fn new(registry: Arc<ToolRegistry>) -> Self {
        Self {
            registry,
            capabilities: None,
        }
    }

    /// Create a policy engine backed by the central capability manager.
    pub fn with_capabilities(
        registry: Arc<ToolRegistry>,
        capabilities: Arc<agenticos_security::CapabilityManager>,
    ) -> Self {
        Self {
            registry,
            capabilities: Some(capabilities),
        }
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

        // Check required permissions against an issued, scoped, time-valid grant.
        if let Some(tool) = self.registry.get(&request.tool_id).await {
            for permission in &tool.required_permissions {
                if request.grant_id.is_empty() {
                    return Ok(PolicyDecision::Denied(
                        "Required permissions not granted".to_string(),
                    ));
                }
                let Some(capabilities) = &self.capabilities else {
                    return Ok(PolicyDecision::RequiresApproval(
                        "A central capability manager is required for protected tools".to_string(),
                    ));
                };
                let capability_type = capability_type_for_permission(permission);
                let allowed = capabilities
                    .authorize(
                        &request.grant_id,
                        capability_type,
                        &format!("tool/{}", request.tool_id),
                        permission,
                    )
                    .await?;
                if !allowed {
                    return Ok(PolicyDecision::Denied(format!(
                        "Capability grant does not authorize permission '{}'",
                        permission
                    )));
                }
            }
        }

        Ok(PolicyDecision::Approved)
    }

    async fn check_capability(
        &self,
        grant_id: &str,
        capability: &str,
    ) -> Result<bool, ContractError> {
        if grant_id.trim().is_empty() || capability.trim().is_empty() {
            return Ok(false);
        }
        let Some(capabilities) = &self.capabilities else {
            return Ok(false);
        };
        capabilities
            .authorize(
                grant_id,
                capability_type_for_permission(capability),
                &format!("tool/{capability}"),
                capability,
            )
            .await
    }
}

/// Common execution plane for native and MCP-backed tools.
#[derive(Clone)]
pub struct ToolRuntime {
    registry: Arc<ToolRegistry>,
    policy: Arc<dyn PolicyEngine>,
    executors: Arc<RwLock<HashMap<String, Arc<dyn AgentTool>>>>,
}

impl std::fmt::Debug for ToolRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ToolRuntime")
            .field("registry", &"<ToolRegistry>")
            .field("policy", &"<PolicyEngine>")
            .finish()
    }
}

impl ToolRuntime {
    /// Create a tool runtime with a registry and policy engine.
    pub fn new(registry: Arc<ToolRegistry>, policy: Arc<dyn PolicyEngine>) -> Self {
        Self {
            registry,
            policy,
            executors: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register one executable tool.
    pub async fn register(
        &self,
        entry: ToolEntry,
        executor: Arc<dyn AgentTool>,
    ) -> Result<(), ContractError> {
        if entry.tool_id != executor.tool_id() {
            return Err(ContractError::ParseError(
                "tool metadata ID and executor ID must match".to_string(),
            ));
        }
        self.registry.register(entry).await?;
        self.executors
            .write()
            .await
            .insert(executor.tool_id().to_string(), executor);
        Ok(())
    }

    /// Return all registered tool metadata.
    pub async fn list(&self) -> Vec<ToolEntry> {
        self.registry.list().await
    }

    /// Execute a registered tool after policy evaluation.
    pub async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        match self.policy.evaluate(&request).await? {
            PolicyDecision::Approved => {}
            PolicyDecision::Denied(reason) => {
                return Err(ContractError::ParseError(format!(
                    "tool execution denied: {reason}"
                )))
            }
            PolicyDecision::RequiresApproval(reason) => {
                return Err(ContractError::ParseError(format!(
                    "tool execution requires approval: {reason}"
                )))
            }
        }

        let executor = self
            .executors
            .read()
            .await
            .get(&request.tool_id)
            .cloned()
            .ok_or(ContractError::MissingCapability)?;

        executor.execute(request).await
    }

    /// Register all tools discovered from an MCP server.
    pub async fn sync_mcp_server(
        &self,
        mcp: &agenticos_mcp::McpManager,
        server_id: &str,
    ) -> Result<Vec<ToolEntry>, ContractError> {
        let tools = mcp
            .list_tools(server_id)
            .await
            .map_err(|error| ContractError::ParseError(error.to_string()))?;
        let mut entries = Vec::with_capacity(tools.len());

        for tool in tools {
            let tool_id = format!("mcp/{server_id}/{}", tool.name);
            let entry = ToolEntry {
                tool_id: tool_id.clone(),
                name: tool.name.clone(),
                description: tool.description.clone().unwrap_or_default(),
                capabilities: vec!["mcp".to_string()],
                required_permissions: vec!["mcp.call".to_string()],
                context_requirements: vec![],
            };
            let executor = Arc::new(McpAgentTool::new(
                tool_id,
                server_id.to_string(),
                tool.name,
                mcp.clone(),
            ));
            self.register(entry.clone(), executor).await?;
            entries.push(entry);
        }

        Ok(entries)
    }
}

/// MCP-backed implementation of the common AgentTool contract.
#[derive(Clone, Debug)]
pub struct McpAgentTool {
    tool_id: String,
    server_id: String,
    tool_name: String,
    manager: agenticos_mcp::McpManager,
}

impl McpAgentTool {
    /// Create an MCP-backed tool adapter.
    pub fn new(
        tool_id: String,
        server_id: String,
        tool_name: String,
        manager: agenticos_mcp::McpManager,
    ) -> Self {
        Self {
            tool_id,
            server_id,
            tool_name,
            manager,
        }
    }
}

#[async_trait::async_trait]
impl AgentTool for McpAgentTool {
    fn tool_id(&self) -> &str {
        &self.tool_id
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        let arguments = if request.parameters.trim().is_empty() {
            serde_json::json!({})
        } else {
            serde_json::from_str::<serde_json::Value>(&request.parameters).map_err(|error| {
                ContractError::ParseError(format!("invalid MCP tool arguments: {error}"))
            })?
        };

        let result = self
            .manager
            .call_tool(&self.server_id, &self.tool_name, arguments)
            .await
            .map_err(|error| ContractError::ParseError(error.to_string()))?;

        let rendered = serde_json::to_string(&result)
            .map_err(|error| ContractError::ParseError(error.to_string()))?;

        Ok(ToolResponse {
            request_id: request.request_id,
            result: rendered,
            success: true,
            error: None,
            metadata: Some(format!(
                "mcp server={} tool={}",
                self.server_id, self.tool_name
            )),
        })
    }
}

fn capability_type_for_permission(permission: &str) -> CapabilityType {
    let normalized = permission.to_ascii_lowercase();
    if normalized.starts_with("admin.") {
        CapabilityType::Admin
    } else if normalized.starts_with("write.") {
        CapabilityType::Write
    } else if normalized.starts_with("read.") {
        CapabilityType::Read
    } else {
        CapabilityType::Execute
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
    #[tokio::test]
    async fn tool_runtime_executes_echo_through_policy() {
        use agenticos_contracts::CapabilityIssuer;

        let registry = Arc::new(ToolRegistry::new());
        registry
            .register(ToolEntry {
                tool_id: "echo".to_string(),
                name: "Echo".to_string(),
                description: "Echo".to_string(),
                capabilities: vec!["echo".to_string()],
                required_permissions: vec![],
                context_requirements: vec![],
            })
            .await
            .unwrap();

        let policy = Arc::new(BasicPolicyEngine::new(registry.clone()));
        let runtime = ToolRuntime::new(registry, policy);
        runtime
            .register(
                ToolEntry {
                    tool_id: "echo".to_string(),
                    name: "Echo".to_string(),
                    description: "Echo".to_string(),
                    capabilities: vec!["echo".to_string()],
                    required_permissions: vec![],
                    context_requirements: vec![],
                },
                Arc::new(EchoTool::default()),
            )
            .await
            .unwrap();

        let response = runtime
            .execute(ToolRequest {
                request_id: "runtime-1".to_string(),
                tool_id: "echo".to_string(),
                parameters: "hello".to_string(),
                agent_id: "agent".to_string(),
                grant_id: "unused".to_string(),
            })
            .await
            .unwrap();

        assert!(response.success);
        assert!(response.result.contains("hello"));
    }

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

    #[tokio::test]
    async fn protected_policy_requires_matching_capability() {
        let registry = Arc::new(ToolRegistry::new());
        registry
            .register(ToolEntry {
                tool_id: "protected-tool".to_string(),
                name: "Protected".to_string(),
                description: "Protected tool".to_string(),
                capabilities: vec!["execute".to_string()],
                required_permissions: vec!["execute.run".to_string()],
                context_requirements: vec![],
            })
            .await
            .unwrap();

        let capabilities = Arc::new(agenticos_security::CapabilityManager::new());
        let engine = BasicPolicyEngine::with_capabilities(registry, capabilities.clone());
        let request = ToolRequest {
            request_id: "req-protected".to_string(),
            tool_id: "protected-tool".to_string(),
            parameters: "{}".to_string(),
            agent_id: "agent-1".to_string(),
            grant_id: "missing".to_string(),
        };
        assert!(matches!(
            engine.evaluate(&request).await.unwrap(),
            PolicyDecision::Denied(_)
        ));

        use agenticos_contracts::CapabilityIssuer;
        capabilities
            .issue(agenticos_contracts::CapabilityGrant {
                capability_type: CapabilityType::Execute,
                resource: "tool/protected-tool".to_string(),
                permission: "execute.run".to_string(),
                expires_at: 0,
                grant_id: "grant-protected".to_string(),
            })
            .await
            .unwrap();
        let request = ToolRequest {
            grant_id: "grant-protected".to_string(),
            ..request
        };
        assert!(matches!(
            engine.evaluate(&request).await.unwrap(),
            PolicyDecision::Approved
        ));
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
