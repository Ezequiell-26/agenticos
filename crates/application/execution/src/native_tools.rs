#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Concrete capability-gated tools used by the execution application service.
//!
//! The API server is a transport/composition boundary; tool behavior belongs in
//! the application execution layer so it can be reused by CLI, desktop and other
//! presentation surfaces without duplicating authorization-aware implementations.

use agenticos_artifacts::ArtifactStore;
use agenticos_context::optimize_tool_output;
use agenticos_contracts::{AgentTool, CapabilityType, ContractError, ToolRequest, ToolResponse};
use agenticos_security::CapabilityManager;
use agenticos_terminal::TerminalManager;
use agenticos_workspace::WorkspaceFs;
use std::sync::Arc;

use crate::SecureToolService;

/// Native tool adapter for capability-gated process execution.
#[derive(Clone, Debug)]
pub struct SecureCommandTool {
    service: Arc<SecureToolService>,
    artifacts: Arc<ArtifactStore>,
}

#[async_trait::async_trait]
impl AgentTool for SecureCommandTool {
    fn tool_id(&self) -> &str {
        "process.execute"
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        #[derive(Debug, Deserialize)]
        struct CommandArgs {
            command: String,
            timeout_ms: Option<u64>,
            session_id: Option<String>,
        }

        let args = serde_json::from_str::<CommandArgs>(&request.parameters).map_err(|error| {
            ContractError::ParseError(format!("invalid process.execute arguments: {error}"))
        })?;

        if args.command.trim().is_empty() {
            return Err(ContractError::ParseError(
                "process.execute command must not be empty".to_string(),
            ));
        }

        let session_id = args
            .session_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(&request.agent_id);

        let result = self
            .service
            .execute_command(
                session_id,
                Some(&request.agent_id),
                &request.grant_id,
                args.command.trim(),
                args.timeout_ms,
            )
            .await?;

        let output = result.output.unwrap_or_default();
        let (optimized_output, optimization) = optimize_tool_output(&output);
        if self.artifacts.should_spill(output.len()) {
            let artifact = self
                .artifacts
                .put_bytes(
                    None,
                    "tool-output",
                    "text/plain; charset=utf-8",
                    output.as_bytes(),
                    None,
                    false,
                    serde_json::json!({
                        "tool": "process.execute",
                        "session_id": session_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "tool output spill persistence failed: {error}"
                    ))
                })?;

            return Ok(ToolResponse {
                request_id: request.request_id,
                result: serde_json::json!({
                    "artifact_id": artifact.artifact_id,
                    "size_bytes": artifact.size_bytes,
                    "checksum": artifact.checksum,
                    "content_url": format!(
                        "/api/artifacts/{}/content",
                        artifact.artifact_id
                    ),
                })
                .to_string(),
                success: result.success,
                error: result.error,
                metadata: Some(
                    "native capability-gated process execution; output spilled to artifact"
                        .to_string(),
                ),
            });
        }

        Ok(ToolResponse {
            request_id: request.request_id,
            result: optimized_output,
            success: result.success,
            error: result.error,
            metadata: Some(format!(
                "native capability-gated process execution; normalized tool output saved {} bytes ({:.1}%)",
                optimization.bytes_saved,
                optimization.savings_ratio() * 100.0
            )),
        })
    }
}

/// Capability-gated Git inspection tool.
#[derive(Clone, Debug)]
pub struct GitWorkspaceTool {
    service: Arc<SecureToolService>,
    workspace: Arc<WorkspaceFs>,
    artifacts: Arc<ArtifactStore>,
    operation: &'static str,
}

#[async_trait::async_trait]
impl AgentTool for GitWorkspaceTool {
    fn tool_id(&self) -> &str {
        self.operation
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        let command = match self.operation {
            "git.status" => "git status --short --branch".to_string(),
            "git.diff" => "git diff --no-ext-diff --unified=3".to_string(),
            "git.log" => "git log -n 20 --oneline --decorate".to_string(),
            "git.branches" => "git branch --list".to_string(),
            "git.show" => "git show --stat --oneline HEAD".to_string(),
            _ => return Err(ContractError::MissingCapability),
        };

        let result = self
            .service
            .execute_scoped(
                &request.agent_id,
                Some(&request.agent_id),
                &request.grant_id,
                &command,
                Some(30_000),
                "git/workspace",
                "git.read",
                Some(self.workspace.root()),
            )
            .await?;

        let output = result.output.unwrap_or_default();
        if self.artifacts.should_spill(output.len()) {
            let artifact = self
                .artifacts
                .put_bytes(
                    None,
                    "git-output",
                    "text/plain; charset=utf-8",
                    output.as_bytes(),
                    None,
                    false,
                    serde_json::json!({
                        "tool": self.operation,
                        "workspace": self.workspace.root().display().to_string(),
                    }),
                )
                .await
                .map_err(ContractError::ParseError)?;

            return Ok(ToolResponse {
                request_id: request.request_id,
                result: serde_json::json!({
                    "artifact_id": artifact.artifact_id,
                    "size_bytes": artifact.size_bytes,
                    "checksum": artifact.checksum,
                    "content_url": format!(
                        "/api/artifacts/{}/content",
                        artifact.artifact_id
                    ),
                })
                .to_string(),
                success: result.success,
                error: result.error,
                metadata: Some(format!(
                    "{} executed in confined workspace; output spilled to artifact",
                    self.operation
                )),
            });
        }

        Ok(ToolResponse {
            request_id: request.request_id,
            result: serde_json::json!({
                "operation": self.operation,
                "output": output,
            })
            .to_string(),
            success: result.success,
            error: result.error,
            metadata: Some("read-only Git workspace operation".to_string()),
        })
    }
}

/// Capability-gated workspace filesystem tool.
#[derive(Clone, Debug)]
pub struct WorkspaceTool {
    workspace: Arc<WorkspaceFs>,
    operation: &'static str,
}

#[async_trait::async_trait]
impl AgentTool for WorkspaceTool {
    fn tool_id(&self) -> &str {
        self.operation
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        #[derive(Debug, Deserialize)]
        struct ReadArgs {
            path: String,
        }
        #[derive(Debug, Deserialize)]
        struct WriteArgs {
            path: String,
            content: String,
        }

        let value = match self.operation {
            "fs.read" => {
                let args =
                    serde_json::from_str::<ReadArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!("invalid fs.read arguments: {error}"))
                    })?;
                serde_json::json!({
                    "path": args.path,
                    "content": self.workspace.read_text(&args.path).await.map_err(ContractError::ParseError)?,
                })
            }
            "fs.write" => {
                let args =
                    serde_json::from_str::<WriteArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!("invalid fs.write arguments: {error}"))
                    })?;
                self.workspace
                    .write_text(&args.path, &args.content)
                    .await
                    .map_err(ContractError::ParseError)?;
                serde_json::json!({
                    "path": args.path,
                    "written": true,
                    "bytes": args.content.len(),
                })
            }
            "fs.list" => {
                let args =
                    serde_json::from_str::<ReadArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!("invalid fs.list arguments: {error}"))
                    })?;
                serde_json::json!({
                    "path": args.path,
                    "entries": self.workspace.list(&args.path).await.map_err(ContractError::ParseError)?,
                })
            }
            "fs.patch" => {
                let args = serde_json::from_str::<serde_json::Value>(&request.parameters).map_err(
                    |error| {
                        ContractError::ParseError(format!("invalid fs.patch arguments: {error}"))
                    },
                )?;
                let path = args
                    .get("path")
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| {
                        ContractError::ParseError("fs.patch path is required".to_string())
                    })?;
                let expected = args
                    .get("expected")
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| {
                        ContractError::ParseError("fs.patch expected is required".to_string())
                    })?;
                let replacement = args
                    .get("replacement")
                    .and_then(|value| value.as_str())
                    .ok_or_else(|| {
                        ContractError::ParseError("fs.patch replacement is required".to_string())
                    })?;
                self.workspace
                    .apply_patch(path, expected, replacement)
                    .await
                    .map_err(ContractError::ParseError)?;
                serde_json::json!({
                    "path": path,
                    "patched": true,
                })
            }
            _ => return Err(ContractError::MissingCapability),
        };

        Ok(ToolResponse {
            request_id: request.request_id,
            result: value.to_string(),
            success: true,
            error: None,
            metadata: Some(format!("confined workspace tool {}", self.operation)),
        })
    }
}

#[derive(Clone, Debug)]
pub struct TerminalTool {
    terminal: Arc<TerminalManager>,
    capabilities: Arc<CapabilityManager>,
    operation: &'static str,
}

#[async_trait::async_trait]
impl AgentTool for TerminalTool {
    fn tool_id(&self) -> &str {
        self.operation
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        #[derive(Debug, Deserialize)]
        struct OpenArgs {
            command: String,
            cwd: Option<String>,
        }
        #[derive(Debug, Deserialize)]
        struct InputArgs {
            terminal_id: String,
            input: String,
        }
        #[derive(Debug, Deserialize)]
        struct ReadArgs {
            terminal_id: String,
            after: Option<i64>,
            limit: Option<u32>,
        }
        #[derive(Debug, Deserialize)]
        struct CloseArgs {
            terminal_id: String,
        }

        let (required_type, resource, permission) = match self.operation {
            "terminal.open" => (
                CapabilityType::Execute,
                "terminal/*".to_string(),
                "terminal.open",
            ),
            "terminal.write" => {
                let args =
                    serde_json::from_str::<InputArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.write arguments: {error}"
                        ))
                    })?;
                (
                    CapabilityType::Write,
                    format!("terminal/{}", args.terminal_id),
                    "terminal.write",
                )
            }
            "terminal.read" => {
                let args =
                    serde_json::from_str::<ReadArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.read arguments: {error}"
                        ))
                    })?;
                (
                    CapabilityType::Read,
                    format!("terminal/{}", args.terminal_id),
                    "terminal.read",
                )
            }
            "terminal.close" => {
                let args =
                    serde_json::from_str::<CloseArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.close arguments: {error}"
                        ))
                    })?;
                (
                    CapabilityType::Execute,
                    format!("terminal/{}", args.terminal_id),
                    "terminal.close",
                )
            }
            _ => return Err(ContractError::MissingCapability),
        };

        if !self
            .capabilities
            .authorize(&request.grant_id, required_type, &resource, permission)
            .await?
        {
            return Err(ContractError::MissingCapability);
        }

        let mut screenshot_artifact: Option<ArtifactRecord> = None;
        let result = match self.operation {
            "terminal.open" => {
                let args =
                    serde_json::from_str::<OpenArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.open arguments: {error}"
                        ))
                    })?;
                serde_json::to_value(
                    self.terminal
                        .create(&args.command, args.cwd.as_deref())
                        .await
                        .map_err(ContractError::ParseError)?,
                )
                .map_err(|error| ContractError::ParseError(error.to_string()))?
            }
            "terminal.write" => {
                let args =
                    serde_json::from_str::<InputArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.write arguments: {error}"
                        ))
                    })?;
                self.terminal
                    .write_input(&args.terminal_id, &args.input)
                    .await
                    .map_err(ContractError::ParseError)?;
                serde_json::json!({
                    "terminal_id": args.terminal_id,
                    "written": true,
                })
            }
            "terminal.read" => {
                let args =
                    serde_json::from_str::<ReadArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.read arguments: {error}"
                        ))
                    })?;
                serde_json::json!({
                    "terminal_id": args.terminal_id,
                    "events": self
                        .terminal
                        .read_output(&args.terminal_id, args.after.unwrap_or(0), args.limit.unwrap_or(128))
                        .await
                        .map_err(ContractError::ParseError)?,
                })
            }
            "terminal.close" => {
                let args =
                    serde_json::from_str::<CloseArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid terminal.close arguments: {error}"
                        ))
                    })?;
                serde_json::json!({
                    "terminal_id": args.terminal_id,
                    "closed": self.terminal.close(&args.terminal_id).await.map_err(ContractError::ParseError)?,
                })
            }
            _ => return Err(ContractError::MissingCapability),
        };

        Ok(ToolResponse {
            request_id: request.request_id,
            result: result.to_string(),
            success: true,
            error: None,
            metadata: Some(format!("capability-gated terminal tool {}", self.operation)),
        })
    }
}

#[derive(Clone, Debug)]
struct GitHubSourceTool {
    source_forge: Arc<GitHubSourceClient>,
    capabilities: Arc<CapabilityManager>,
    audit: Arc<AuditStore>,
    metrics: Arc<RuntimeMetrics>,
    operation: &'static str,
}

#[async_trait::async_trait]
impl AgentTool for GitHubSourceTool {
    fn tool_id(&self) -> &str {
        self.operation
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        #[derive(Debug, Deserialize)]
        struct WriteArgs {
            repo: String,
            path: String,
            content: String,
            reference: Option<String>,
            message: String,
            expected_sha: Option<String>,
        }
        #[derive(Debug, Deserialize)]
        struct DeleteArgs {
            repo: String,
            path: String,
            reference: Option<String>,
            message: String,
            expected_sha: String,
        }

        let (repo, path, result) = match self.operation {
            "source.github.write" => {
                let args =
                    serde_json::from_str::<WriteArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid source.github.write arguments: {error}"
                        ))
                    })?;
                let resource = format!("github/{}/*", args.repo);
                if !self
                    .capabilities
                    .authorize(
                        &request.grant_id,
                        CapabilityType::Write,
                        &resource,
                        "source.github.write",
                    )
                    .await?
                {
                    return Err(ContractError::MissingCapability);
                }
                let result = self
                    .source_forge
                    .write_file(
                        &args.repo,
                        &args.path,
                        &args.content,
                        args.reference.as_deref(),
                        &args.message,
                        args.expected_sha.as_deref(),
                    )
                    .await
                    .map_err(|error| ContractError::ParseError(error.to_string()))?;
                (
                    args.repo,
                    args.path,
                    serde_json::to_value(result)
                        .map_err(|error| ContractError::ParseError(error.to_string()))?,
                )
            }
            "source.github.delete" => {
                let args =
                    serde_json::from_str::<DeleteArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid source.github.delete arguments: {error}"
                        ))
                    })?;
                let resource = format!("github/{}/*", args.repo);
                if !self
                    .capabilities
                    .authorize(
                        &request.grant_id,
                        CapabilityType::Write,
                        &resource,
                        "source.github.delete",
                    )
                    .await?
                {
                    return Err(ContractError::MissingCapability);
                }
                let result = self
                    .source_forge
                    .delete_file(
                        &args.repo,
                        &args.path,
                        args.reference.as_deref(),
                        &args.message,
                        &args.expected_sha,
                    )
                    .await
                    .map_err(|error| ContractError::ParseError(error.to_string()))?;
                (
                    args.repo,
                    args.path,
                    serde_json::to_value(result)
                        .map_err(|error| ContractError::ParseError(error.to_string()))?,
                )
            }
            _ => return Err(ContractError::MissingCapability),
        };

        self.metrics.record_tool(false);
        if let Err(error) = self
            .audit
            .append(AuditEvent::new(
                "source-forge",
                self.operation,
                Some(request.agent_id.clone()),
                format!("github/{repo}"),
                Some(request.request_id.clone()),
                "success",
                serde_json::json!({
                    "path": path,
                    "operation": self.operation,
                }),
            ))
            .await
        {
            tracing::warn!(%error, operation = self.operation, "failed to persist GitHub tool audit");
        }

        Ok(ToolResponse {
            request_id: request.request_id,
            result: result.to_string(),
            success: true,
            error: None,
            metadata: Some(format!("capability-gated GitHub tool {}", self.operation)),
        })
    }
}

#[derive(Clone, Debug)]
struct BrowserTool {
    browser: Arc<BrowserRuntime>,
    capabilities: Arc<CapabilityManager>,
    audit: Arc<AuditStore>,
    metrics: Arc<RuntimeMetrics>,
    artifacts: Arc<ArtifactStore>,
    operation: &'static str,
}

#[async_trait::async_trait]
impl AgentTool for BrowserTool {
    fn tool_id(&self) -> &str {
        self.operation
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        #[derive(Debug, Deserialize)]
        struct SessionArgs {
            session_id: String,
        }
        #[derive(Debug, Deserialize)]
        struct OpenArgs {
            session_id: String,
            url: String,
        }
        #[derive(Debug, Deserialize)]
        struct ClickArgs {
            session_id: String,
            target: String,
        }
        #[derive(Debug, Deserialize)]
        struct FillArgs {
            session_id: String,
            target: String,
            text: String,
        }

        let session_id = match serde_json::from_str::<SessionArgs>(&request.parameters) {
            Ok(args) => args.session_id,
            Err(error) => {
                return Err(ContractError::ParseError(format!(
                    "invalid browser arguments: {error}"
                )))
            }
        };

        if !self
            .capabilities
            .authorize(
                &request.grant_id,
                CapabilityType::Execute,
                &format!("browser/{session_id}"),
                "browser.use",
            )
            .await?
        {
            return Err(ContractError::MissingCapability);
        }

        let result = match self.operation {
            "browser.open" => {
                let args =
                    serde_json::from_str::<OpenArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid browser.open arguments: {error}"
                        ))
                    })?;
                self.browser.open(&args.session_id, &args.url).await?
            }
            "browser.snapshot" => self.browser.snapshot(&session_id).await?,
            "browser.click" => {
                let args =
                    serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid browser.click arguments: {error}"
                        ))
                    })?;
                self.browser.click(&args.session_id, &args.target).await?
            }
            "browser.fill" => {
                let args =
                    serde_json::from_str::<FillArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid browser.fill arguments: {error}"
                        ))
                    })?;
                self.browser
                    .fill(&args.session_id, &args.target, &args.text)
                    .await?
            }
            "browser.wait" => {
                let args =
                    serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid browser.wait arguments: {error}"
                        ))
                    })?;
                self.browser.wait(&args.session_id, &args.target).await?
            }
            "browser.get_text" => {
                let args =
                    serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid browser.get_text arguments: {error}"
                        ))
                    })?;
                self.browser
                    .get_text(&args.session_id, &args.target)
                    .await?
            }
            "browser.screenshot" => {
                let (result, artifact) = capture_browser_screenshot_artifact(
                    &self.browser,
                    &self.artifacts,
                    &session_id,
                )
                .await?;
                screenshot_artifact = artifact;
                result
            }
            "browser.close" => self.browser.close(&session_id).await?,
            _ => return Err(ContractError::MissingCapability),
        };

        self.metrics.record_tool(!result.success);
        let audit_outcome = if result.success { "success" } else { "failure" };
        if let Err(error) = self
            .audit
            .append(AuditEvent::new(
                "browser",
                self.operation,
                Some(request.agent_id.clone()),
                format!("browser/{}", session_id),
                Some(request.request_id.clone()),
                audit_outcome,
                serde_json::json!({
                    "action": self.operation,
                    "session_id": session_id,
                }),
            ))
            .await
        {
            tracing::warn!(%error, operation = self.operation, "failed to persist browser audit event");
        }

        let mut result_json = serde_json::to_value(&result)
            .map_err(|error| ContractError::ParseError(error.to_string()))?;
        if let Some(artifact) = screenshot_artifact {
            if let Some(object) = result_json.as_object_mut() {
                object.insert(
                    "artifact".to_string(),
                    serde_json::to_value(artifact)
                        .map_err(|error| ContractError::ParseError(error.to_string()))?,
                );
            }
        }

        Ok(ToolResponse {
            request_id: request.request_id,
            result: result_json.to_string(),
            success: result.success,
            error: if result.success {
                None
            } else {
                Some(result.output.clone())
            },
            metadata: Some(format!("capability-gated browser tool {}", self.operation)),
        })
    }
}

/// Default model used by the runtime when no explicit model is supplied.
const DEFAULT_MODEL: &str = "gpt-4o-mini";

#[derive(Clone)]
struct SessionCacheEntry {
    agent: Arc<ReactAgent>,
    last_used_at: u64,
}

/// Shared runtime state for the HTTP process.
#[derive(Clone)]
pub struct RuntimeState {
    sessions: Arc<RwLock<HashMap<String, SessionCacheEntry>>>,
    session_cache_capacity: usize,
    agent_execution_concurrency: Arc<Semaphore>,
    memory: Arc<SqliteMemory>,
    persistent_memory: Arc<PersistentMemoryStore>,
    mcp: Arc<McpManager>,
    channels: Arc<ChannelRegistry>,
    projects: Arc<ProjectRegistry>,
    audit: Arc<AuditStore>,
    provider: Arc<ProviderPlatform>,
    kernel: Arc<KernelRuntime>,
    outbox_transport: Arc<BroadcastOutboxTransport>,
    outbox_publisher: Arc<BackgroundEventPublisher>,
    subagents: Arc<SubagentManager>,
    scheduler: Arc<JobScheduler>,
    workflows: Arc<WorkflowEngine>,
    capabilities: Arc<CapabilityManager>,
    sandbox: Arc<ProcessSandbox>,
    secure_tools: Arc<SecureToolService>,
    tool_runtime: Arc<ToolRuntime>,
    reasoning: Arc<ReasoningEngine>,
    source_intelligence: Arc<agenticos_brain::SourceIntelligenceEngine>,
    metrics: Arc<RuntimeMetrics>,
    evaluation: Arc<EvaluationRegistry>,
    idempotency: Arc<SqliteIdempotencyStore>,
    source_forge: Arc<GitHubSourceClient>,
    a2a_tasks: Arc<A2aTaskStore>,
    browser: Arc<BrowserRuntime>,
    artifacts: Arc<ArtifactStore>,
    workspace: Arc<WorkspaceFs>,
    terminal: Arc<TerminalManager>,
    cost_ledger: Arc<CostLedger>,
    skills: Arc<Vec<Skill>>,
    model: String,
}

impl std::fmt::Debug for RuntimeState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RuntimeState")
            .field("sessions", &"<session registry>")
            .field("memory", &"<sqlite>")
            .field("provider", &self.model)
            .field("kernel", &"<kernel>")
            .finish()
    }
}

impl RuntimeState {
    /// Build the full backend runtime from environment configuration.
    pub async fn from_env() -> Result<Self, ContractError> {
        let database_url = std::env::var("AGENTICOS_DATABASE_URL")
            .unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
        let memory = Arc::new(SqliteMemory::new(&database_url).await?);
        let persistent_memory = Arc::new(PersistentMemoryStore::new(&database_url).await?);
        let mcp = Arc::new(
            McpManager::open(&database_url, 30_000)
                .await
                .map_err(|error| ContractError::ParseError(error.to_string()))?,
        );
        let channels = Arc::new(
            ChannelRegistry::open(&database_url)
                .await
                .map_err(ContractError::ParseError)?,
        );
        let projects = Arc::new(
            ProjectRegistry::open(&database_url)
                .await
                .map_err(ContractError::ParseError)?,
        );
        let audit = Arc::new(
            AuditStore::open(&database_url)
                .await
                .map_err(ContractError::ParseError)?,
        );
        let config = Arc::new(RwLock::new(InMemoryConfig::default()));
        let event_store = Arc::new(SqliteEventStore::new(&database_url).await.map_err(
            |error| {
                ContractError::ParseError(format!("event store initialization failed: {error}"))
            },
        )?);
        let snapshot_store = Arc::new(SqliteSnapshotStore::new(&database_url).await.map_err(
            |error| {
                ContractError::ParseError(format!("snapshot store initialization failed: {error}"))
            },
        )?);
        let logger = Arc::new(InMemoryLogger::default());
        let capabilities = Arc::new(
            CapabilityManager::open(&database_url)
                .await
                .map_err(|error| ContractError::ParseError(error.to_string()))?,
        );
        let outbox = Arc::new(SqliteOutboxStore::open(&database_url).await?);
        let leases = Arc::new(
            SqliteLeaseStore::open(&database_url)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("lease store initialization failed: {error}"))
                })?,
        );
        let outbox_transport = Arc::new(BroadcastOutboxTransport::new(runtime_env_usize(
            "AGENTICOS_OUTBOX_BROADCAST_CAPACITY",
            1024,
            16,
            8_192,
        )));
        let outbox_publisher = Arc::new(BackgroundEventPublisher::with_transport(
            outbox.clone(),
            Arc::new(CompositeOutboxTransport::new(outbox_transport.clone())),
        ));
        let kernel = Arc::new(KernelRuntime::new_with_outbox_and_lease_store(
            event_store,
            snapshot_store,
            logger,
            config,
            capabilities.clone(),
            Arc::new(CapabilityRegistry::default()),
            outbox,
            leases,
        ));

        let provider = Arc::new(ProviderPlatform::open_from_env(&database_url).await?);
        let sandbox = Arc::new(ProcessSandbox::new(SandboxPolicy::default()));
        let secure_tools = Arc::new(SecureToolService::new(
            capabilities.clone(),
            sandbox.clone(),
        ));
        let artifacts = Arc::new(
            ArtifactStore::open(
                &database_url,
                std::env::var("AGENTICOS_ARTIFACT_ROOT")
                    .unwrap_or_else(|_| ".agenticos/artifacts".to_string()),
                std::env::var("AGENTICOS_MAX_ARTIFACT_BYTES")
                    .ok()
                    .and_then(|value| value.parse::<u64>().ok())
                    .unwrap_or(agenticos_artifacts::DEFAULT_MAX_ARTIFACT_BYTES),
            )
            .await
            .map_err(ContractError::ParseError)?,
        );
        let workspace = Arc::new(
            WorkspaceFs::from_env()
                .await
                .map_err(ContractError::ParseError)?,
        );
        if projects.list().await.is_empty() {
            let default_project = ProjectDefinition {
                project_id: std::env::var("AGENTICOS_PROJECT_ID")
                    .unwrap_or_else(|_| "agenticos".to_string()),
                name: std::env::var("AGENTICOS_PROJECT_NAME")
                    .unwrap_or_else(|_| "AgentiCOS".to_string()),
                path: std::env::var("AGENTICOS_PROJECT_PATH").unwrap_or_else(|_| ".".to_string()),
                default_branch: std::env::var("AGENTICOS_PROJECT_BRANCH")
                    .unwrap_or_else(|_| "main".to_string()),
                description: "Configured AgentiCOS workspace".to_string(),
                status: "Active".to_string(),
            };
            if let Err(error) = workspace.list(&default_project.path).await {
                return Err(ContractError::ParseError(format!(
                    "default project path is invalid: {error}"
                )));
            }
            projects
                .register(default_project)
                .await
                .map_err(ContractError::ParseError)?;
        }
        let terminal = Arc::new(
            TerminalManager::from_env(&database_url, workspace.root())
                .await
                .map_err(ContractError::ParseError)?,
        );
        let cost_ledger = Arc::new(
            CostLedger::open(&database_url)
                .await
                .map_err(ContractError::ParseError)?,
        );
        let browser = Arc::new(BrowserRuntime::from_env());
        let skills = Arc::new(Self::load_skills().await);
        let session_cache_capacity =
            runtime_env_usize("AGENTICOS_MAX_CACHED_SESSIONS", 256, 16, 4096);
        let agent_execution_concurrency =
            Arc::new(Semaphore::new(agent_execution_concurrency_limit()));

        let metrics = Arc::new(RuntimeMetrics::new());

        let tool_registry = Arc::new(ToolRegistry::new());
        let tool_policy = Arc::new(BasicPolicyEngine::with_capabilities(
            tool_registry.clone(),
            capabilities.clone(),
        ));
        let tool_runtime = Arc::new(ToolRuntime::new(tool_registry, tool_policy));
        tool_runtime
            .register(
                ToolEntry {
                    tool_id: "process.execute".to_string(),
                    name: "Execute Process".to_string(),
                    description: "Execute an allowlisted local process through the sandbox"
                        .to_string(),
                    capabilities: vec!["process".to_string()],
                    required_permissions: vec!["process.execute".to_string()],
                    context_requirements: vec!["capability:process.execute".to_string()],
                },
                Arc::new(SecureCommandTool {
                    service: secure_tools.clone(),
                    artifacts: artifacts.clone(),
                }),
            )
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("native tool registration failed: {error}"))
            })?;
        for (tool_id, name, capability) in [
            ("fs.read", "Read workspace file", "filesystem.read"),
            ("fs.write", "Write workspace file", "filesystem.write"),
            ("fs.list", "List workspace directory", "filesystem.list"),
            (
                "fs.patch",
                "Apply exact workspace patch",
                "filesystem.patch",
            ),
        ] {
            tool_runtime
                .register(
                    ToolEntry {
                        tool_id: tool_id.to_string(),
                        name: name.to_string(),
                        description: name.to_string(),
                        capabilities: vec!["filesystem".to_string()],
                        required_permissions: vec![capability.to_string()],
                        context_requirements: vec![format!("capability:{capability}")],
                    },
                    Arc::new(WorkspaceTool {
                        workspace: workspace.clone(),
                        operation: tool_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "workspace tool registration failed: {error}"
                    ))
                })?;
        }

        for (tool_id, name) in [
            ("source.github.write", "Write GitHub file"),
            ("source.github.delete", "Delete GitHub file"),
        ] {
            tool_runtime
                .register(
                    ToolEntry {
                        tool_id: tool_id.to_string(),
                        name: name.to_string(),
                        description: name.to_string(),
                        capabilities: vec!["source-forge".to_string()],
                        required_permissions: vec![tool_id.to_string()],
                        context_requirements: vec![format!("capability:{tool_id}")],
                    },
                    Arc::new(GitHubSourceTool {
                        source_forge: source_forge.clone(),
                        capabilities: capabilities.clone(),
                        audit: audit.clone(),
                        metrics: metrics.clone(),
                        operation: tool_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("GitHub tool registration failed: {error}"))
                })?;
        }

        for (tool_id, name) in [
            ("browser.open", "Open browser page"),
            ("browser.snapshot", "Inspect browser DOM"),
            ("browser.click", "Click browser target"),
            ("browser.fill", "Fill browser target"),
            ("browser.wait", "Wait for browser condition"),
            ("browser.get_text", "Read browser text"),
            ("browser.screenshot", "Capture browser screenshot"),
            ("browser.close", "Close browser session"),
        ] {
            tool_runtime
                .register(
                    ToolEntry {
                        tool_id: tool_id.to_string(),
                        name: name.to_string(),
                        description: name.to_string(),
                        capabilities: vec!["browser".to_string()],
                        required_permissions: vec!["browser.use".to_string()],
                        context_requirements: vec!["capability:browser.use".to_string()],
                    },
                    Arc::new(BrowserTool {
                        browser: browser.clone(),
                        capabilities: capabilities.clone(),
                        audit: audit.clone(),
                        metrics: metrics.clone(),
                        artifacts: artifacts.clone(),
                        operation: tool_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("browser tool registration failed: {error}"))
                })?;
        }

        for (tool_id, name) in [
            ("git.status", "Inspect Git status"),
            ("git.diff", "Inspect working tree diff"),
            ("git.log", "Inspect recent Git history"),
            ("git.branches", "List local Git branches"),
            ("git.show", "Inspect HEAD summary"),
        ] {
            tool_runtime
                .register(
                    ToolEntry {
                        tool_id: tool_id.to_string(),
                        name: name.to_string(),
                        description: name.to_string(),
                        capabilities: vec!["git".to_string()],
                        required_permissions: vec!["git.read".to_string()],
                        context_requirements: vec!["capability:git.read".to_string()],
                    },
                    Arc::new(GitWorkspaceTool {
                        service: secure_tools.clone(),
                        workspace: workspace.clone(),
                        artifacts: artifacts.clone(),
                        operation: tool_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("Git tool registration failed: {error}"))
                })?;
        }

        for (tool_id, name, capability) in [
            ("terminal.open", "Open terminal session", "terminal.open"),
            ("terminal.write", "Write terminal input", "terminal.write"),
            ("terminal.read", "Read terminal output", "terminal.read"),
            ("terminal.close", "Close terminal session", "terminal.close"),
        ] {
            tool_runtime
                .register(
                    ToolEntry {
                        tool_id: tool_id.to_string(),
                        name: name.to_string(),
                        description: name.to_string(),
                        capabilities: vec!["terminal".to_string()],
                        required_permissions: vec![capability.to_string()],
                        context_requirements: vec![format!("capability:{capability}")],
                    },
                    Arc::new(TerminalTool {
                        terminal: terminal.clone(),
                        capabilities: capabilities.clone(),
                        operation: tool_id,
                    }),
                )
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("terminal tool registration failed: {error}"))
                })?;
        }

        let model = std::env::var("AGENTICOS_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());

        let mut default_agent = AgentDefinition {
            agent_id: "default".to_string(),
            role: "general".to_string(),
            capabilities: vec![
                "reasoning".to_string(),
                "code".to_string(),
                "research".to_string(),
            ],
            providers: Vec::new(),
            skills: Vec::new(),
            sandbox_profile: "default".to_string(),
            budget: AgentBudget::default(),
        };
        if let Ok(raw) = std::env::var("AGENTICOS_DEFAULT_AGENT_JSON") {
            if let Ok(parsed) = serde_json::from_str::<AgentDefinition>(&raw) {
                default_agent = parsed;
            }
        }

        let subagents = Arc::new(
            SubagentManager::open(&database_url, 16)
                .await
                .map_err(ContractError::ParseError)?,
        );
        subagents
            .register(default_agent)
            .await
            .map_err(ContractError::ParseError)?;

        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            session_cache_capacity,
            agent_execution_concurrency,
            memory,
            persistent_memory,
            mcp,
            channels,
            projects,
            audit,
            provider,
            kernel,
            outbox_transport,
            outbox_publisher,
            subagents,
            scheduler: Arc::new(
                JobScheduler::open(&database_url)
                    .await
                    .map_err(ContractError::ParseError)?,
            ),
            workflows: Arc::new(
                WorkflowEngine::open(&database_url)
                    .await
                    .map_err(ContractError::ParseError)?,
            ),
            capabilities,
            sandbox,
            secure_tools,
            tool_runtime,
            reasoning: Arc::new(ReasoningEngine::new(EngineConfig {
                max_steps: 12,
                enable_learning: true,
                selection_strategy: SelectionStrategy::Balanced,
            })),
            source_intelligence: Arc::new(
                agenticos_brain::SourceIntelligenceEngine::open(
                    &database_url,
                    agenticos_brain::EngineConfig::default(),
                )
                .await
                .map_err(|error| ContractError::ParseError(error.to_string()))?,
            ),
            metrics,
            evaluation: Arc::new(
                EvaluationRegistry::open(&database_url)
                    .await
                    .map_err(ContractError::ParseError)?,
            ),
            idempotency: Arc::new(
                SqliteIdempotencyStore::new(&database_url, 86_400)
                    .await
                    .map_err(|error| ContractError::ParseError(error.to_string()))?,
            ),
            source_forge: Arc::new(
                GitHubSourceClient::from_env()
                    .map_err(|error| ContractError::ParseError(error.to_string()))?,
            ),
            a2a_tasks: Arc::new(
                A2aTaskStore::open(&database_url)
                    .await
                    .map_err(ContractError::ParseError)?,
            ),
            artifacts: artifacts.clone(),
            workspace: workspace.clone(),
            terminal: terminal.clone(),
            cost_ledger,
            browser,
            skills,
            model,
        })
    }

    async fn load_skills() -> Vec<Skill> {
        let root = std::env::var("AGENTICOS_SKILLS_ROOT").unwrap_or_else(|_| "skills".to_string());
        let mut directory = match tokio::fs::read_dir(&root).await {
            Ok(directory) => directory,
            Err(error) => {
                tracing::warn!(%error, root = %root, "skill directory unavailable");
                return Vec::new();
            }
        };

        let max_total_bytes = runtime_env_usize(
            "AGENTICOS_SKILL_TOTAL_BYTES",
            8 * 1024 * 1024,
            512 * 1024,
            64 * 1024 * 1024,
        );
        let mut total_bytes = 0usize;
        let mut skills = Vec::new();
        while let Ok(Some(entry)) = directory.next_entry().await {
            if skills.len() >= 128 {
                break;
            }
            let path = entry.path().join("SKILL.md");
            let metadata = match tokio::fs::metadata(&path).await {
                Ok(metadata) if metadata.is_file() && metadata.len() <= 512 * 1024 => metadata,
                _ => continue,
            };
            let skill_bytes = metadata.len() as usize;
            if total_bytes.saturating_add(skill_bytes) > max_total_bytes {
                tracing::warn!(
                    root = %root,
                    limit = max_total_bytes,
                    "skill loading budget reached; remaining skills loaded lazily"
                );
                break;
            }
            let content = match tokio::fs::read_to_string(&path).await {
                Ok(content) => content,
                Err(error) => {
                    tracing::warn!(%error, path = %path.display(), "failed to read skill");
                    continue;
                }
            };
            total_bytes = total_bytes.saturating_add(skill_bytes);
            match Skill::from_markdown(&content) {
                Ok(skill) => skills.push(skill),
                Err(error) => tracing::warn!(
                    %error,
                    path = %path.display(),
                    "invalid SKILL.md skipped"
                ),
            }
        }

        skills.sort_by(|left, right| left.name.cmp(&right.name));
        skills
    }

    async fn session_agent(&self, session_id: &str, model: Option<&str>) -> Arc<ReactAgent> {
        self.session_agent_with_definition(session_id, model, None)
            .await
    }

    async fn session_agent_with_definition(
        &self,
        session_id: &str,
        model: Option<&str>,
        definition: Option<&AgentDefinition>,
    ) -> Arc<ReactAgent> {
        let agent_id = definition.map(|value| value.agent_id.as_str());
        let agent_key = match (agent_id, model) {
            (Some(agent_id), Some(model)) => {
                format!("{session_id}::agent::{agent_id}::model::{model}")
            }
            (Some(agent_id), None) => format!("{session_id}::agent::{agent_id}"),
            (None, Some(model)) => format!("{session_id}::model::{model}"),
            (None, None) => session_id.to_string(),
        };
        let now = unix_time();
        {
            let mut sessions = self.sessions.write().await;
            if let Some(entry) = sessions.get_mut(&agent_key) {
                entry.last_used_at = now;
                return entry.agent.clone();
            }
        }

        let max_turns = definition
            .map(|value| value.budget.max_tool_calls.max(1) as usize)
            .unwrap_or(90)
            .clamp(1, 512);
        let agent = Arc::new(ReactAgent::with_max_turns(
            "AgentiCOS".to_string(),
            max_turns,
        ));
        agent.set_session_id(session_id.to_string());
        if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
            agent.set_model(model.to_string());
        }
        agent.set_memory(self.memory.clone());
        agent.set_model_provider(self.provider.clone());
        agent.set_tool_runtime(Arc::new(RuntimeToolBridge {
            runtime: self.tool_runtime.clone(),
        }));
        agent.set_tool_pipeline(ToolExecutionPipeline::new().add_pre_hook(Arc::new(
            PermissionPolicyHook::new().allow_tool("react_action".to_string()),
        )));
        let grant_id = format!("agent-read-{}", uuid::Uuid::new_v4());
        match self
            .capabilities
            .issue(CapabilityGrant {
                capability_type: CapabilityType::Read,
                resource: "tool/*".to_string(),
                permission: "*".to_string(),
                expires_at: unix_time().saturating_add(3600),
                grant_id: grant_id.clone(),
            })
            .await
        {
            Ok(_) => agent.set_tool_grant_id(grant_id),
            Err(error) => tracing::warn!(
                session_id,
                %error,
                "failed to issue read-only tool grant; protected tool calls will require explicit authorization"
            ),
        }

        let requested_skills = definition.map(|value| value.skills.clone());
        for skill in self.skills.iter().cloned() {
            let include = requested_skills
                .as_ref()
                .map(|requested| {
                    requested.is_empty() || requested.iter().any(|name| name == &skill.name)
                })
                .unwrap_or(true);
            if include {
                agent.add_skill(skill);
            }
        }

        let recovery_history_limit =
            runtime_env_usize("AGENTICOS_SESSION_RECOVERY_HISTORY_LIMIT", 64, 8, 256);
        if let Ok(history) = self
            .memory
            .get_session_history(session_id, recovery_history_limit)
            .await
        {
            let completed_turns = history
                .iter()
                .filter(|message| message.role == "user")
                .count();
            agent.restore_turn_count(completed_turns);
        }

        let namespace = std::env::var("AGENTICOS_MEMORY_NAMESPACE")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "agenticos".to_string());
        let memory_limit = std::env::var("AGENTICOS_MEMORY_CONTEXT_LIMIT")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(12)
            .clamp(1, 50);
        if let Ok(records) = self.persistent_memory.list(&namespace, memory_limit).await {
            let memory_context = records
                .into_iter()
                .map(|record| format!("- {}: {}", record.key, record.value))
                .collect::<Vec<_>>()
                .join("\n");
            if !memory_context.is_empty() {
                agent.set_memory_md(memory_context);
            }
        }

        let mut sessions = self.sessions.write().await;
        if let Some(entry) = sessions.get_mut(&agent_key) {
            entry.last_used_at = now;
            return entry.agent.clone();
        }

        if sessions.len() >= self.session_cache_capacity {
            if let Some(oldest_key) = sessions
                .iter()
                .min_by_key(|(_, entry)| entry.last_used_at)
                .map(|(key, _)| key.clone())
            {
                sessions.remove(&oldest_key);
            }
        }

        sessions.insert(
            agent_key,
            SessionCacheEntry {
                agent: agent.clone(),
                last_used_at: now,
            },
        );
        agent
    }

    fn agent_execution_parameters(definition: Option<&AgentDefinition>) -> Option<String> {
        let definition = definition?;
        let mut agenticos = serde_json::Map::new();
        if !definition.providers.is_empty() {
            agenticos.insert(
                "providers".to_string(),
                serde_json::Value::Array(
                    definition
                        .providers
                        .iter()
                        .filter(|provider| !provider.trim().is_empty())
                        .take(32)
                        .cloned()
                        .map(serde_json::Value::String)
                        .collect(),
                ),
            );
        }
        if definition.budget.max_tokens > 0 {
            agenticos.insert(
                "max_tokens".to_string(),
                serde_json::json!(definition.budget.max_tokens),
            );
        }
        if agenticos.is_empty() {
            None
        } else {
            Some(serde_json::json!({ "agenticos": agenticos }).to_string())
        }
    }

    async fn hydrate_relevant_memory(&self, agent: &Arc<ReactAgent>, query: &str) {
        if query.trim().is_empty() {
            return;
        }
        let namespace = std::env::var("AGENTICOS_MEMORY_NAMESPACE")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "agenticos".to_string());
        let limit = runtime_env_usize("AGENTICOS_RELEVANT_MEMORY_LIMIT", 8, 1, 24);
        let records = if memory_embeddings_enabled() {
            if let Some(model) = configured_embedding_model() {
                match self
                    .provider
                    .embed(EmbeddingRequest {
                        request_id: format!("memory-hydrate-{}", uuid::Uuid::new_v4()),
                        model,
                        inputs: vec![query.to_string()],
                    })
                    .await
                {
                    Ok(response) if response.embeddings.len() == 1 => self
                        .persistent_memory
                        .search_semantic(&namespace, &response.embeddings[0], limit)
                        .await
                        .or_else(|_| {
                            self.persistent_memory
                                .search(&namespace, query, limit)
                                .await
                        }),
                    _ => {
                        self.persistent_memory
                            .search(&namespace, query, limit)
                            .await
                    }
                }
            } else {
                self.persistent_memory
                    .search(&namespace, query, limit)
                    .await
            }
        } else {
            self.persistent_memory
                .search(&namespace, query, limit)
                .await
        };

        match records {
            Ok(records) => {
                let relevant = records
                    .into_iter()
                    .map(|record| format!("- {}: {}", record.key, record.value))
                    .collect::<Vec<_>>()
                    .join("\n");
                if !relevant.is_empty() {
                    agent.set_memory_md(relevant);
                }
            }
            Err(error) => {
                tracing::debug!(%error, "relevant memory retrieval failed");
            }
        }
    }

    async fn configured(&self) -> bool {
        self.provider
            .list_status()
            .await
            .iter()
            .any(|provider| provider.configured)
    }
}


