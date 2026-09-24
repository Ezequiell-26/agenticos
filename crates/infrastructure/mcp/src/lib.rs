#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! MCP server registry and stdio JSON-RPC transport boundary.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, RwLock, Semaphore};
use tokio::time::{timeout, Instant};
use uuid::Uuid;

/// Architectural owner of this crate.
pub const OWNER: &str = "agenticos-mcp";

/// Supported MCP transport.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum McpTransport {
    /// Local process using MCP stdio JSON-RPC.
    Stdio {
        /// Executable to launch.
        command: String,
        /// Arguments passed to the executable.
        args: Vec<String>,
    },
}

/// Registered MCP server.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McpServerDefinition {
    /// Stable server identifier.
    pub server_id: String,
    /// Human-readable display name.
    pub name: String,
    /// Transport configuration.
    pub transport: McpTransport,
    /// Whether the server is currently enabled.
    pub enabled: bool,
    /// Optional configured startup timeout in milliseconds.
    pub timeout_ms: Option<u64>,
}

/// JSON-RPC request envelope used by MCP stdio.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC protocol version.
    pub jsonrpc: String,
    /// Request identifier.
    pub id: String,
    /// Method name.
    pub method: String,
    /// Optional method parameters.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// JSON-RPC response envelope.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC protocol version.
    pub jsonrpc: String,
    /// Request identifier.
    pub id: Option<String>,
    /// Result payload.
    pub result: Option<serde_json::Value>,
    /// Error payload.
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC error.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    /// Numeric error code.
    pub code: i64,
    /// Human-readable error.
    pub message: String,
    /// Optional provider-specific details.
    pub data: Option<serde_json::Value>,
}

/// MCP tool descriptor returned from discovery.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McpTool {
    /// Tool name.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// JSON Schema for input arguments.
    #[serde(rename = "inputSchema")]
    pub input_schema: serde_json::Value,
}

/// MCP manager errors.
#[derive(Debug, Error)]
pub enum McpError {
    /// The requested server does not exist.
    #[error("MCP server not found: {0}")]
    ServerNotFound(String),
    /// The server is disabled.
    #[error("MCP server is disabled: {0}")]
    ServerDisabled(String),
    /// Server configuration is invalid.
    #[error("invalid MCP server configuration: {0}")]
    InvalidConfiguration(String),
    /// Process I/O failure.
    #[error("MCP process I/O failed: {0}")]
    Io(#[from] std::io::Error),
    /// Serialization failure.
    #[error("MCP JSON serialization failed: {0}")]
    Serialization(#[from] serde_json::Error),
    /// RPC-level failure.
    #[error("MCP RPC error {code}: {message}")]
    Rpc {
        /// RPC error code.
        code: i64,
        /// RPC error message.
        message: String,
    },
    /// Operation timed out.
    #[error("MCP operation timed out")]
    Timeout,
}

#[derive(Debug, Clone)]
struct CachedTools {
    fetched_at: Instant,
    tools: Vec<McpTool>,
}

/// Server registry plus lazy, reusable stdio client operations.
#[derive(Clone, Debug)]
pub struct McpManager {
    servers: Arc<RwLock<HashMap<String, McpServerDefinition>>>,
    db: Option<Arc<sqlx::SqlitePool>>,
    default_timeout_ms: u64,
    sessions: Arc<RwLock<HashMap<String, Arc<Mutex<StdioClient>>>>>,
    tools_cache: Arc<RwLock<HashMap<String, CachedTools>>>,
    concurrency: Arc<Semaphore>,
    tool_cache_ttl: Duration,
}

impl McpManager {
    /// Create an empty manager.
    pub fn new(default_timeout_ms: u64) -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
            db: None,
            default_timeout_ms: default_timeout_ms.clamp(1_000, 300_000),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            tools_cache: Arc::new(RwLock::new(HashMap::new())),
            concurrency: Arc::new(Semaphore::new(mcp_concurrency_limit())),
            tool_cache_ttl: mcp_tool_cache_ttl(),
        }
    }

    /// Open a SQLite-backed manager and recover registered servers.
    pub async fn open(database_url: &str, default_timeout_ms: u64) -> Result<Self, McpError> {
        let db = sqlx::SqlitePool::connect(database_url)
            .await
            .map_err(|error| {
                McpError::InvalidConfiguration(format!("MCP database connection failed: {error}"))
            })?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS mcp_servers (
                server_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                transport TEXT NOT NULL,
                enabled INTEGER NOT NULL,
                timeout_ms INTEGER
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            McpError::InvalidConfiguration(format!("MCP schema initialization failed: {error}"))
        })?;

        let rows = sqlx::query_as::<_, (String, String, String, i64, Option<i64>)>(
            "SELECT server_id, name, transport, enabled, timeout_ms FROM mcp_servers",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| {
            McpError::InvalidConfiguration(format!("MCP recovery query failed: {error}"))
        })?;

        let mut servers = HashMap::with_capacity(rows.len());
        for (server_id, name, transport_json, enabled, timeout_ms) in rows {
            let transport = serde_json::from_str::<McpTransport>(&transport_json)?;
            let definition = McpServerDefinition {
                server_id: server_id.clone(),
                name,
                transport,
                enabled: enabled != 0,
                timeout_ms: timeout_ms.map(|value| value as u64),
            };
            validate_server(&definition)?;
            servers.insert(server_id, definition);
        }

        Ok(Self {
            servers: Arc::new(RwLock::new(servers)),
            db: Some(Arc::new(db)),
            default_timeout_ms: default_timeout_ms.clamp(1_000, 300_000),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            tools_cache: Arc::new(RwLock::new(HashMap::new())),
            concurrency: Arc::new(Semaphore::new(mcp_concurrency_limit())),
            tool_cache_ttl: mcp_tool_cache_ttl(),
        })
    }

    async fn persist(&self, server: &McpServerDefinition) -> Result<(), McpError> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let transport = serde_json::to_string(&server.transport)?;
        sqlx::query(
            r#"
            INSERT INTO mcp_servers (server_id, name, transport, enabled, timeout_ms)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(server_id) DO UPDATE SET
                name = excluded.name,
                transport = excluded.transport,
                enabled = excluded.enabled,
                timeout_ms = excluded.timeout_ms
            "#,
        )
        .bind(&server.server_id)
        .bind(&server.name)
        .bind(transport)
        .bind(if server.enabled { 1_i64 } else { 0_i64 })
        .bind(server.timeout_ms.map(|value| value as i64))
        .execute(db.as_ref())
        .await
        .map_err(|error| {
            McpError::InvalidConfiguration(format!("MCP persistence failed: {error}"))
        })?;
        Ok(())
    }

    async fn delete_persisted(&self, server_id: &str) -> Result<(), McpError> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        sqlx::query("DELETE FROM mcp_servers WHERE server_id = ?")
            .bind(server_id)
            .execute(db.as_ref())
            .await
            .map_err(|error| {
                McpError::InvalidConfiguration(format!("MCP persistence delete failed: {error}"))
            })?;
        Ok(())
    }

    /// Register or replace a server definition.
    pub async fn register(&self, server: McpServerDefinition) -> Result<(), McpError> {
        validate_server(&server)?;
        let mut servers = self.servers.write().await;
        let previous = servers.insert(server.server_id.clone(), server.clone());
        drop(servers);

        self.invalidate_runtime(&server.server_id).await;
        if let Err(error) = self.persist(&server).await {
            let mut servers = self.servers.write().await;
            match previous {
                Some(previous) => {
                    servers.insert(server.server_id.clone(), previous);
                }
                None => {
                    servers.remove(&server.server_id);
                }
            }
            return Err(error);
        }
        Ok(())
    }

    /// Enable a server.
    pub async fn enable(&self, server_id: &str) -> Result<(), McpError> {
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(server_id)
            .ok_or_else(|| McpError::ServerNotFound(server_id.to_string()))?;
        server.enabled = true;
        let snapshot = server.clone();
        drop(servers);
        self.invalidate_runtime(&snapshot.server_id).await;
        self.persist(&snapshot).await
    }

    /// Disable a server.
    pub async fn disable(&self, server_id: &str) -> Result<(), McpError> {
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(server_id)
            .ok_or_else(|| McpError::ServerNotFound(server_id.to_string()))?;
        server.enabled = false;
        let snapshot = server.clone();
        drop(servers);
        self.invalidate_runtime(&snapshot.server_id).await;
        self.persist(&snapshot).await
    }

    /// Remove a server definition.
    pub async fn unregister(&self, server_id: &str) -> bool {
        let removed = self.servers.write().await.remove(server_id).is_some();
        if removed {
            self.invalidate_runtime(server_id).await;
            let _ = self.delete_persisted(server_id).await;
        }
        removed
    }

    /// Return all registered servers.
    pub async fn list(&self) -> Vec<McpServerDefinition> {
        let mut servers: Vec<_> = self.servers.read().await.values().cloned().collect();
        servers.sort_by(|left, right| left.server_id.cmp(&right.server_id));
        servers
    }

    /// Discover tools from an enabled MCP server.
    ///
    /// Discovery is cached and the stdio process is reused across calls.
    pub async fn list_tools(&self, server_id: &str) -> Result<Vec<McpTool>, McpError> {
        let _permit = self
            .concurrency
            .acquire()
            .await
            .map_err(|_| McpError::InvalidConfiguration("MCP concurrency limiter closed".to_string()))?;

        if let Some(tools) = self.cached_tools(server_id).await {
            return Ok(tools);
        }

        let server = self.get_enabled(server_id).await?;
        let session = self.get_or_spawn_session(&server).await?;
        let response = {
            let mut client = session.lock().await;
            client.request("tools/list", None).await
        };

        match response {
            Ok(response) => {
                let tools = parse_tools(response)?;
                self.store_tools_cache(server_id, tools.clone()).await;
                Ok(tools)
            }
            Err(error) => {
                self.drop_session(server_id).await;
                Err(error)
            }
        }
    }

    /// Call a tool on an enabled MCP server using its persistent session.
    pub async fn call_tool(
        &self,
        server_id: &str,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<serde_json::Value, McpError> {
        if tool_name.trim().is_empty() {
            return Err(McpError::InvalidConfiguration(
                "tool_name is required".to_string(),
            ));
        }

        let _permit = self
            .concurrency
            .acquire()
            .await
            .map_err(|_| McpError::InvalidConfiguration("MCP concurrency limiter closed".to_string()))?;

        let server = self.get_enabled(server_id).await?;
        let session = self.get_or_spawn_session(&server).await?;
        let response = {
            let mut client = session.lock().await;
            client
                .request(
                    "tools/call",
                    Some(serde_json::json!({
                        "name": tool_name,
                        "arguments": arguments,
                    })),
                )
                .await
        };

        match response {
            Ok(response) => {
                if let Some(result) = response.result {
                    return Ok(result);
                }
                if let Some(error) = response.error {
                    return Err(McpError::Rpc {
                        code: error.code,
                        message: error.message,
                    });
                }
                Err(McpError::InvalidConfiguration(
                    "MCP response contained neither result nor error".to_string(),
                ))
            }
            Err(error) => {
                self.drop_session(server_id).await;
                Err(error)
            }
        }
    }

    async fn cached_tools(&self, server_id: &str) -> Option<Vec<McpTool>> {
        let cache = self.tools_cache.read().await;
        cache.get(server_id).and_then(|entry| {
            (entry.fetched_at.elapsed() <= self.tool_cache_ttl).then(|| entry.tools.clone())
        })
    }

    async fn store_tools_cache(&self, server_id: &str, tools: Vec<McpTool>) {
        self.tools_cache.write().await.insert(
            server_id.to_string(),
            CachedTools {
                fetched_at: Instant::now(),
                tools,
            },
        );
    }

    async fn get_or_spawn_session(
        &self,
        server: &McpServerDefinition,
    ) -> Result<Arc<Mutex<StdioClient>>, McpError> {
        if let Some(session) = self.sessions.read().await.get(&server.server_id).cloned() {
            return Ok(session);
        }

        let mut client = StdioClient::spawn(server, self.timeout_for(server)).await?;
        client.initialize().await?;
        let session = Arc::new(Mutex::new(client));

        let mut sessions = self.sessions.write().await;
        if let Some(existing) = sessions.get(&server.server_id).cloned() {
            return Ok(existing);
        }
        sessions.insert(server.server_id.clone(), session.clone());
        Ok(session)
    }

    async fn drop_session(&self, server_id: &str) {
        self.sessions.write().await.remove(server_id);
    }

    async fn invalidate_runtime(&self, server_id: &str) {
        self.drop_session(server_id).await;
        self.tools_cache.write().await.remove(server_id);
    }

    async fn get_enabled(&self, server_id: &str) -> Result<McpServerDefinition, McpError> {
        let server = self
            .servers
            .read()
            .await
            .get(server_id)
            .cloned()
            .ok_or_else(|| McpError::ServerNotFound(server_id.to_string()))?;
        if !server.enabled {
            return Err(McpError::ServerDisabled(server_id.to_string()));
        }
        Ok(server)
    }

    fn timeout_for(&self, server: &McpServerDefinition) -> Duration {
        Duration::from_millis(
            server
                .timeout_ms
                .unwrap_or(self.default_timeout_ms)
                .clamp(1_000, 300_000),
        )
    }
}

impl Default for McpManager {
    fn default() -> Self {
        Self::new(30_000)
    }
}

fn validate_server(server: &McpServerDefinition) -> Result<(), McpError> {
    if server.server_id.trim().is_empty() || server.server_id.len() > 128 {
        return Err(McpError::InvalidConfiguration(
            "server_id must be 1..=128 characters".to_string(),
        ));
    }
    if server.name.trim().is_empty() || server.name.len() > 256 {
        return Err(McpError::InvalidConfiguration(
            "name must be 1..=256 characters".to_string(),
        ));
    }
    let McpTransport::Stdio { command, args } = &server.transport;
    if command.trim().is_empty() || command.len() > 2048 {
        return Err(McpError::InvalidConfiguration(
            "stdio command must be 1..=2048 characters".to_string(),
        ));
    }
    if args.len() > 256 {
        return Err(McpError::InvalidConfiguration(
            "too many stdio arguments".to_string(),
        ));
    }
    if let Some(timeout_ms) = server.timeout_ms {
        if !(1_000..=300_000).contains(&timeout_ms) {
            return Err(McpError::InvalidConfiguration(
                "timeout_ms must be between 1000 and 300000".to_string(),
            ));
        }
    }
    Ok(())
}

#[derive(Debug)]
struct StdioClient {
    child: Child,
    reader: BufReader<tokio::process::ChildStdout>,
    timeout: Duration,
}

impl StdioClient {
    async fn spawn(
        server: &McpServerDefinition,
        timeout_duration: Duration,
    ) -> Result<Self, McpError> {
        let McpTransport::Stdio { command, args } = &server.transport;
        let mut child = Command::new(command)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()?;

        let stdout = child.stdout.take().ok_or_else(|| {
            McpError::InvalidConfiguration("MCP stdout pipe unavailable".to_string())
        })?;

        Ok(Self {
            child,
            reader: BufReader::new(stdout),
            timeout: timeout_duration,
        })
    }

    async fn initialize(&mut self) -> Result<(), McpError> {
        let response = self
            .request(
                "initialize",
                Some(serde_json::json!({
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "AgentiCOS",
                        "version": env!("CARGO_PKG_VERSION"),
                    }
                })),
            )
            .await?;

        if response.error.is_some() {
            return Err(response
                .error
                .map(|error| McpError::Rpc {
                    code: error.code,
                    message: error.message,
                })
                .expect("error was checked"));
        }

        self.notify("notifications/initialized", None).await
    }

    async fn notify(
        &mut self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<(), McpError> {
        let payload = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });
        let stdin = self.child.stdin.as_mut().ok_or_else(|| {
            McpError::InvalidConfiguration("MCP stdin pipe unavailable".to_string())
        })?;
        stdin
            .write_all(serde_json::to_string(&payload)?.as_bytes())
            .await?;
        stdin.write_all(b"\n").await?;
        stdin.flush().await?;
        Ok(())
    }

    async fn request(
        &mut self,
        method: &str,
        params: Option<serde_json::Value>,
    ) -> Result<JsonRpcResponse, McpError> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: Uuid::new_v4().to_string(),
            method: method.to_string(),
            params,
        };
        let expected_id = request.id.clone();

        let stdin = self.child.stdin.as_mut().ok_or_else(|| {
            McpError::InvalidConfiguration("MCP stdin pipe unavailable".to_string())
        })?;
        stdin
            .write_all(serde_json::to_string(&request)?.as_bytes())
            .await?;
        stdin.write_all(b"\n").await?;
        stdin.flush().await?;

        let deadline = Instant::now() + self.timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(McpError::Timeout);
            }

            let mut line = String::new();
            let bytes = timeout(remaining, self.reader.read_line(&mut line))
                .await
                .map_err(|_| McpError::Timeout)?
                .map_err(McpError::Io)?;
            if bytes == 0 {
                return Err(McpError::Io(std::io::Error::new(
                    std::io::ErrorKind::UnexpectedEof,
                    "MCP server closed stdout before returning JSON-RPC response",
                )));
            }

            let response = serde_json::from_str::<JsonRpcResponse>(line.trim())
                .map_err(McpError::Serialization)?;

            // MCP servers may emit notifications or unrelated responses while
            // processing a request. Only the matching JSON-RPC id completes it.
            if response.id.as_deref() == Some(expected_id.as_str()) {
                return Ok(response);
            }
        }
    }
}

fn parse_tools(response: JsonRpcResponse) -> Result<Vec<McpTool>, McpError> {
    if let Some(error) = response.error {
        return Err(McpError::Rpc {
            code: error.code,
            message: error.message,
        });
    }
    let result = response.result.ok_or_else(|| {
        McpError::InvalidConfiguration("MCP tools/list returned no result".to_string())
    })?;
    serde_json::from_value(
        result
            .get("tools")
            .cloned()
            .unwrap_or_else(|| serde_json::json!([])),
    )
    .map_err(McpError::Serialization)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn manager_registers_and_toggles_servers() {
        let manager = McpManager::new(10_000);
        manager
            .register(McpServerDefinition {
                server_id: "filesystem".to_string(),
                name: "Filesystem".to_string(),
                transport: McpTransport::Stdio {
                    command: "example-mcp".to_string(),
                    args: vec!["--stdio".to_string()],
                },
                enabled: false,
                timeout_ms: Some(15_000),
            })
            .await
            .unwrap();

        assert_eq!(manager.list().await.len(), 1);
        assert!(manager.list().await[0].server_id == "filesystem");
        assert!(manager.list_tools("filesystem").await.is_err());
        manager.enable("filesystem").await.unwrap();
        assert!(manager.list().await[0].enabled);
    }

    #[tokio::test]
    async fn sqlite_registry_recovers_server_configuration() {
        let path = std::env::temp_dir().join(format!("agenticos-mcp-{}.db", Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let manager = McpManager::open(&url, 10_000).await.unwrap();
        manager
            .register(McpServerDefinition {
                server_id: "persistent-server".to_string(),
                name: "Persistent MCP".to_string(),
                transport: McpTransport::Stdio {
                    command: "example-mcp".to_string(),
                    args: vec!["--stdio".to_string()],
                },
                enabled: true,
                timeout_ms: Some(7_500),
            })
            .await
            .unwrap();
        drop(manager);

        let recovered = McpManager::open(&url, 10_000).await.unwrap();
        let servers = recovered.list().await;
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].server_id, "persistent-server");
        assert!(servers[0].enabled);
        assert_eq!(servers[0].timeout_ms, Some(7_500));

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn server_validation_rejects_empty_commands() {
        let result = validate_server(&McpServerDefinition {
            server_id: "bad".to_string(),
            name: "Bad".to_string(),
            transport: McpTransport::Stdio {
                command: String::new(),
                args: vec![],
            },
            enabled: true,
            timeout_ms: None,
        });
        assert!(result.is_err());
    }
}


fn mcp_concurrency_limit() -> usize {
    std::env::var("AGENTICOS_MCP_MAX_CONCURRENCY")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(16)
        .clamp(1, 128)
}

fn mcp_tool_cache_ttl() -> Duration {
    let ttl_ms = std::env::var("AGENTICOS_MCP_TOOL_CACHE_TTL_MS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(300_000)
        .clamp(1_000, 3_600_000);
    Duration::from_millis(ttl_ms)
}
