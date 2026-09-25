#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Capability-gated native tools owned by the infrastructure tool layer.

use agenticos_artifacts::{ArtifactRecord, ArtifactStore};
use agenticos_browser::{BrowserActionResult, BrowserRuntime};
use agenticos_context::optimize_tool_output;
use agenticos_contracts::{AgentTool, CapabilityType, ContractError, ToolRequest, ToolResponse};
use agenticos_observability::{
    audit::{AuditEvent, AuditStore},
    metrics::RuntimeMetrics,
};
use agenticos_source_forge::GitHubSourceClient;
use agenticos_security::CapabilityManager;
use agenticos_terminal::TerminalManager;
use agenticos_workspace::WorkspaceFs;
use serde::Deserialize;
use std::sync::Arc;

use crate::SecureToolService;

/// Native tool adapter for capability-gated process execution.
#[derive(Clone, Debug)]
pub struct SecureCommandTool {
    service: Arc<SecureToolService>,
    artifacts: Arc<ArtifactStore>,
}

impl SecureCommandTool {
    /// Construct a process execution tool.
    pub fn new(service: Arc<SecureToolService>, artifacts: Arc<ArtifactStore>) -> Self {
        Self { service, artifacts }
    }
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

impl GitWorkspaceTool {
    /// Construct a Git workspace tool for one stable operation identifier.
    pub fn new(
        service: Arc<SecureToolService>,
        workspace: Arc<WorkspaceFs>,
        artifacts: Arc<ArtifactStore>,
        operation: &'static str,
    ) -> Self {
        Self {
            service,
            workspace,
            artifacts,
            operation,
        }
    }
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

impl WorkspaceTool {
    /// Construct a workspace filesystem tool for one stable operation identifier.
    pub fn new(workspace: Arc<WorkspaceFs>, operation: &'static str) -> Self {
        Self {
            workspace,
            operation,
        }
    }
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

impl TerminalTool {
    /// Construct a terminal tool for one stable operation identifier.
    pub fn new(
        terminal: Arc<TerminalManager>,
        capabilities: Arc<CapabilityManager>,
        operation: &'static str,
    ) -> Self {
        Self {
            terminal,
            capabilities,
            operation,
        }
    }
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
pub struct GitHubSourceTool {
    pub source_forge: Arc<GitHubSourceClient>,
    pub capabilities: Arc<CapabilityManager>,
    pub audit: Arc<AuditStore>,
    pub metrics: Arc<RuntimeMetrics>,
    pub operation: &'static str,
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
pub struct BrowserTool {
    pub browser: Arc<BrowserRuntime>,
    pub capabilities: Arc<CapabilityManager>,
    pub audit: Arc<AuditStore>,
    pub metrics: Arc<RuntimeMetrics>,
    pub artifacts: Arc<ArtifactStore>,
    pub operation: &'static str,
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

async fn capture_browser_screenshot_artifact(
    browser: &BrowserRuntime,
    artifacts: &ArtifactStore,
    session_id: &str,
) -> Result<(BrowserActionResult, Option<ArtifactRecord>), ContractError> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "agenticos-browser-screenshot-{}-{}.png",
        std::process::id(),
        nonce
    ));

    let result = browser.screenshot_to(session_id, &path).await?;
    if !result.success {
        let _ = tokio::fs::remove_file(&path).await;
        return Ok((result, None));
    }

    let bytes = tokio::fs::read(&path).await.map_err(|error| {
        ContractError::ParseError(format!("browser screenshot read failed: {error}"))
    })?;
    let artifact = artifacts
        .put_bytes(
            None,
            "browser-screenshot",
            "image/png",
            &bytes,
            None,
            false,
            serde_json::json!({
                "tool": "browser.screenshot",
                "session_id": session_id,
            }),
        )
        .await
        .map_err(|error| {
            ContractError::ParseError(format!(
                "browser screenshot artifact persistence failed: {error}"
            ))
        })?;

    let _ = tokio::fs::remove_file(&path).await;
    Ok((result, Some(artifact)))
}

