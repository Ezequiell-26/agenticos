#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical MCP boundary for AgentiCOS.
//!
//! Transport implementations remain in adapters; this crate defines stable,
//! product-owned MCP descriptors and capability ports.

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

/// Advertised MCP capabilities.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpCapabilitySet {
    /// Tools are available.
    pub tools: bool,
    /// Resources are available.
    pub resources: bool,
    /// Prompts are available.
    pub prompts: bool,
}

/// MCP server descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpServerDescriptor {
    /// Stable server identifier.
    pub server_id: McpServerId,
    /// Human-readable name.
    pub name: String,
    /// Transport family.
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
    /// Input JSON schema.
    pub input_schema: serde_json::Value,
}

/// MCP resource descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpResourceDescriptor {
    /// Owning server.
    pub server_id: McpServerId,
    /// Owning server resource URI.
    pub uri: String,
    /// Optional MIME type.
    pub mime_type: Option<String>,
}

/// MCP server adapter boundary.
#[async_trait::async_trait]
pub trait McpAdapter: Send + Sync {
    /// Describe the connected MCP server.
    async fn describe(&self) -> Result<McpServerDescriptor, agenticos_contracts::ContractError>;

    /// Discover server tools.
    async fn list_tools(&self) -> Result<Vec<McpToolDescriptor>, agenticos_contracts::ContractError>;

    /// Discover server resources.
    async fn list_resources(&self) -> Result<Vec<McpResourceDescriptor>, agenticos_contracts::ContractError>;
}
