#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical MCP capability boundary for AgentiCOS.

use serde::{Deserialize, Serialize};

/// Stable MCP server identifier.
pub type McpServerId = String;

/// Stable MCP capability identifier.
pub type McpCapabilityId = String;

/// Supported MCP transport families.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum McpTransport {
    /// Standard input/output transport.
    Stdio,
    /// Server-Sent Events transport.
    Sse,
    /// Streamable HTTP transport.
    StreamableHttp,
}

/// Advertised MCP capability set.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpCapabilitySet {
    /// Server exposes tools.
    pub tools: bool,
    /// Server exposes resources.
    pub resources: bool,
    /// Server exposes prompts.
    pub prompts: bool,
}

/// Registered MCP server metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpServerDescriptor {
    /// Stable server identifier.
    pub server_id: McpServerId,
    /// Human-readable name.
    pub name: String,
    /// Transport used by the adapter.
    pub transport: McpTransport,
    /// Advertised capabilities.
    pub capabilities: McpCapabilitySet,
    /// Negotiated protocol version.
    pub protocol_version: String,
}

/// MCP tool descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpToolDescriptor {
    /// Owning server.
    pub server_id: McpServerId,
    /// Stable tool identifier.
    pub tool_id: McpCapabilityId,
    /// Human-readable name.
    pub name: String,
    /// JSON input schema.
    pub input_schema: serde_json::Value,
}

/// MCP resource descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpResourceDescriptor {
    /// Owning server.
    pub server_id: McpServerId,
    /// Resource URI.
    pub uri: String,
    /// Optional MIME type.
    pub mime_type: Option<String>,
}

/// Boundary implemented by MCP transport/server adapters.
#[async_trait::async_trait]
pub trait McpAdapter: Send + Sync {
    /// Describe the connected MCP server.
    async fn describe(&self) -> Result<McpServerDescriptor, agenticos_contracts::ContractError>;
    /// Discover tools.
    async fn list_tools(&self) -> Result<Vec<McpToolDescriptor>, agenticos_contracts::ContractError>;
    /// Discover resources.
    async fn list_resources(&self) -> Result<Vec<McpResourceDescriptor>, agenticos_contracts::ContractError>;
}
