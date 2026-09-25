#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS backend HTTP surface.
//!
//! The API is intentionally thin: durable state and execution live in the
//! Rust runtime, while this crate exposes typed commands, queries and control
//! plane operations to the desktop frontend.

use actix_cors::Cors;
use actix_web::{
    dev::ServiceRequest,
    middleware::{from_fn, Next},
    web, App, Error, HttpMessage, HttpRequest, HttpResponse, HttpServer, Responder,
};
use agenticos_a2a::{
    text_from_message, A2aMessage, A2aTaskRecord, A2aTaskStore, AgentCapabilities, AgentCard,
    AgentInterface, AgentSkill, JsonRpcError, JsonRpcRequest, JsonRpcResponse, TaskState, TaskView,
};
use agenticos_agents::{AgentBudget, AgentDefinition, SubagentManager};
use agenticos_artifacts::{ArtifactRange, ArtifactStore};
use agenticos_browser::BrowserRuntime;
use agenticos_brain::{
    reasoning_engine::{EngineConfig, ReasoningEngine, SelectionStrategy},
    CapabilityRegistry,
};
use agenticos_channels::{ChannelDefinition, ChannelRegistry};
use agenticos_context::optimize_tool_output;
use agenticos_contracts::{
    AgentTool, CapabilityGrant, CapabilityIssuer, CapabilityType, ContractError, ModelProvider,
    RunId, RunState, Sandbox, SandboxStatus, ToolEntry, ToolRequest, ToolResponse,
};
use agenticos_evaluation::{EvaluationCase, EvaluationRegistry};
use agenticos_execution::SecureToolService;
use agenticos_kernel::{
    InMemoryConfig, InMemoryLogger, KernelRuntime, PermissionPolicyHook, ReactAgent, Skill,
    SqliteEventStore, SqliteIdempotencyStore, SqliteMemory, SqliteSnapshotStore,
    ToolExecutionPipeline,
};
use agenticos_mcp::{McpManager, McpServerDefinition};
use agenticos_memory::PersistentMemoryStore;
use agenticos_observability::{
    audit::{AuditEvent, AuditStore},
    cost::{CostLedger, TokenPricing},
    metrics::RuntimeMetrics,
};
use agenticos_projects::{ProjectDefinition, ProjectRegistry};
use agenticos_providers::{ProviderPlatform, ProviderStatus};
use agenticos_sandbox::{ProcessSandbox, SandboxPolicy};
use agenticos_scheduler::{JobRecord, JobScheduler, JobSpec, JobState};
use agenticos_security::{ApprovalRequest, CapabilityManager};
use agenticos_source_forge::GitHubSourceClient;
use agenticos_terminal::TerminalManager;
use agenticos_tools::{BasicPolicyEngine, ToolRegistry, ToolRuntime};
use agenticos_workflows::{WorkflowDefinition, WorkflowEngine, WorkflowNodeState};
use agenticos_workspace::WorkspaceFs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tracing::Instrument;

/// Default local SQLite URL.
const DEFAULT_DATABASE_URL: &str = "sqlite://agenticos.db?mode=rwc";
#[derive(Clone)]
struct RuntimeToolBridge {
    runtime: Arc<ToolRuntime>,
}

#[async_trait::async_trait]
impl agenticos_contracts::ToolRuntimePort for RuntimeToolBridge {
    async fn list_tools(&self) -> Result<Vec<ToolEntry>, ContractError> {
        Ok(self.runtime.list().await)
    }

    async fn execute(&self, request: ToolRequest) -> Result<ToolResponse, ContractError> {
        self.runtime.execute(request).await
    }
}

/// Native tool adapter for capability-gated process execution.
#[derive(Clone, Debug)]
struct SecureCommandTool {
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
struct GitWorkspaceTool {
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
struct WorkspaceTool {
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
struct TerminalTool {
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
struct BrowserTool {
    browser: Arc<BrowserRuntime>,
    capabilities: Arc<CapabilityManager>,
    audit: Arc<AuditStore>,
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
                let args = serde_json::from_str::<OpenArgs>(&request.parameters).map_err(|error| {
                    ContractError::ParseError(format!("invalid browser.open arguments: {error}"))
                })?;
                self.browser.open(&args.session_id, &args.url).await?
            }
            "browser.snapshot" => {
                self.browser.snapshot(&session_id).await?
            }
            "browser.click" => {
                let args = serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                    ContractError::ParseError(format!("invalid browser.click arguments: {error}"))
                })?;
                self.browser.click(&args.session_id, &args.target).await?
            }
            "browser.fill" => {
                let args = serde_json::from_str::<FillArgs>(&request.parameters).map_err(|error| {
                    ContractError::ParseError(format!("invalid browser.fill arguments: {error}"))
                })?;
                self.browser
                    .fill(&args.session_id, &args.target, &args.text)
                    .await?
            }
            "browser.wait" => {
                let args = serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                    ContractError::ParseError(format!("invalid browser.wait arguments: {error}"))
                })?;
                self.browser.wait(&args.session_id, &args.target).await?
            }
            "browser.get_text" => {
                let args = serde_json::from_str::<ClickArgs>(&request.parameters).map_err(|error| {
                    ContractError::ParseError(format!("invalid browser.get_text arguments: {error}"))
                })?;
                self.browser.get_text(&args.session_id, &args.target).await?
            }
            "browser.screenshot" => self.browser.screenshot(&session_id).await?,
            "browser.close" => self.browser.close(&session_id).await?,
            _ => return Err(ContractError::MissingCapability),
        };

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

        Ok(ToolResponse {
            request_id: request.request_id,
            result: serde_json::to_string(&result)
                .map_err(|error| ContractError::ParseError(error.to_string()))?,
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
        let kernel = Arc::new(KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capabilities.clone(),
            Arc::new(CapabilityRegistry::default()),
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
            metrics: Arc::new(RuntimeMetrics::new()),
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

    async fn configured(&self) -> bool {
        self.provider
            .list_status()
            .await
            .iter()
            .any(|provider| provider.configured)
    }
}

#[derive(Debug, Deserialize)]
struct ChatRequest {
    message: String,
    session_id: Option<String>,
    model: Option<String>,
    parameters: Option<serde_json::Value>,
    run_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DirectModelRequest {
    request_id: Option<String>,
    model: String,
    input: String,
    parameters: Option<String>,
}

#[derive(Debug, Serialize)]
struct ChatResponse {
    response: String,
    agent: String,
    session_id: String,
    model: String,
    run_id: String,
}

fn provider_id_from_metadata(metadata: Option<&str>) -> Option<&str> {
    metadata?
        .split(';')
        .find_map(|part| part.trim().strip_prefix("provider=").map(str::trim))
        .filter(|value| !value.is_empty())
}

async fn record_model_usage(
    state: &RuntimeState,
    request_id: &str,
    provider_id: Option<&str>,
    model_id: &str,
    tokens_used: Option<u64>,
) {
    let Some(tokens) = tokens_used else {
        return;
    };
    let Some(provider_id) = provider_id else {
        tracing::debug!(
            request_id = %request_id,
            model = %model_id,
            "model usage returned without provider metadata"
        );
        return;
    };

    if let Err(error) = state
        .cost_ledger
        .record(
            request_id,
            provider_id,
            model_id,
            tokens,
            unix_time(),
        )
        .await
    {
        tracing::warn!(
            request_id = %request_id,
            provider = %provider_id,
            model = %model_id,
            %error,
            "failed to persist model usage"
        );
    }
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    code: &'static str,
}

#[derive(Debug, Deserialize)]
struct CreateRunRequest {
    objective: String,
    run_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RunResponse {
    run_id: String,
    state: String,
    version: u64,
}

#[derive(Debug, Deserialize)]
struct CreateAgentRequest {
    agent: AgentDefinition,
}

#[derive(Debug, Deserialize)]
struct SpawnAgentRequest {
    agent_id: String,
    parent_depth: Option<u16>,
    objective: String,
}

#[derive(Debug, Deserialize)]
struct CreateJobRequest {
    job: JobSpec,
}

#[derive(Debug, Deserialize)]
struct PlanRequest {
    objective: String,
}

#[derive(Debug, Deserialize)]
struct ApprovalDecision {
    approved: bool,
}

#[derive(Debug, Deserialize)]
struct CreateApprovalRequest {
    run_id: String,
    action: String,
    resource: String,
    expires_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CreateWorkflowRequest {
    workflow: WorkflowDefinition,
}

#[derive(Debug, Deserialize)]
struct CreateEvaluationCaseRequest {
    case: EvaluationCase,
}

#[derive(Debug, Deserialize)]
struct EvaluateCaseRequest {
    output: String,
}

#[derive(Debug, Deserialize)]
struct InspectRepositoryRequest {
    source: String,
}

#[derive(Debug, Deserialize)]
struct AnalyzeRepositoryRequest {
    source: String,
}

#[derive(Debug, Deserialize)]
struct SourceFileQuery {
    path: String,
    reference: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BrowserGrantRequest {
    grant_id: String,
}

#[derive(Debug, Deserialize)]
struct BrowserOpenRequest {
    grant_id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct BrowserFillRequest {
    grant_id: String,
    target: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct BrowserClickRequest {
    grant_id: String,
    target: String,
}

#[derive(Debug, Deserialize)]
struct BrowserWaitRequest {
    grant_id: String,
    target: String,
}

#[derive(Debug, Deserialize)]
struct BrowserTextRequest {
    grant_id: String,
    target: String,
}



#[derive(Debug, Deserialize)]
struct WriteSourceFileRequest {
    grant_id: String,
    path: String,
    content: String,
    reference: Option<String>,
    message: String,
    expected_sha: Option<String>,
}

#[derive(Debug, Deserialize)]
struct A2aSendMessageParams {
    message: A2aMessage,
}

#[derive(Debug, Deserialize)]
struct A2aTaskParams {
    id: String,
}

#[derive(Debug, Serialize)]
struct A2aErrorBody {
    code: i32,
    message: String,
}

#[derive(Debug, Deserialize)]
struct AuditQuery {
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct WorkflowTransitionRequest {
    state: WorkflowNodeState,
}

#[derive(Debug, Deserialize)]
struct MemorySearchQuery {
    namespace: String,
    q: Option<String>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct CreateMemoryRequest {
    namespace: String,
    key: String,
    value: String,
    tags: Option<Vec<String>>,
    importance: Option<f64>,
    expires_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateCapabilityRequest {
    capability_type: String,
    resource: String,
    permission: String,
    expires_at: Option<u64>,
    grant_id: String,
}

#[derive(Debug, Deserialize)]
struct RegisterMcpRequest {
    server: McpServerDefinition,
}

#[derive(Debug, Deserialize)]
struct McpToolCallRequest {
    arguments: Option<serde_json::Value>,
    grant_id: String,
}

#[derive(Debug, Deserialize)]
struct RegisterProviderRequest {
    provider_id: String,
    name: String,
    base_url: String,
    models: Vec<String>,
    capabilities: Vec<String>,
    api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProviderQuotaRequest {
    requests_per_minute: Option<u32>,
    tokens_per_minute: Option<u32>,
    current_usage: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ProviderRetryRequest {
    max_attempts: u32,
    initial_backoff_ms: u64,
    max_backoff_ms: u64,
    exponential_backoff: bool,
}

#[derive(Debug, Deserialize)]
struct ProviderFallbackRequest {
    fallback_providers: Vec<String>,
    auto_failover: bool,
}

#[derive(Debug, Serialize)]
struct ProviderFallbackResponse {
    primary_provider: String,
    fallback_providers: Vec<String>,
    auto_failover: bool,
}

#[derive(Debug, Deserialize)]
struct WorkerClaimRequest {
    worker_id: String,
    lease_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct WorkerHeartbeatRequest {
    worker_id: String,
    lease_token: u64,
    lease_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct WorkerCompletionRequest {
    worker_id: String,
    lease_token: u64,
    success: bool,
    output: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolExecutionRequest {
    session_id: String,
    user_id: Option<String>,
    grant_id: String,
    command: String,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ToolCallRequest {
    tool_id: String,
    agent_id: String,
    grant_id: String,
    parameters: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TerminalCreateRequest {
    command: String,
    cwd: Option<String>,
    grant_id: String,
}

#[derive(Debug, Deserialize)]
struct TerminalInputRequest {
    input: String,
    grant_id: String,
}

#[derive(Debug, Deserialize)]
struct TerminalOutputQuery {
    grant_id: String,
    after: Option<i64>,
    limit: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct WorkspacePathQuery {
    grant_id: String,
    path: String,
}

#[derive(Debug, Deserialize)]
struct WorkspaceSearchQuery {
    grant_id: String,
    path: Option<String>,
    q: String,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct WorkspaceWriteRequest {
    grant_id: String,
    path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct WorkspacePatchRequest {
    grant_id: String,
    path: String,
    expected: String,
    replacement: String,
}

#[derive(Debug, Deserialize)]
struct RegisterProjectRequest {
    project: ProjectDefinition,
}

#[derive(Debug, Deserialize)]
struct RegisterChannelRequest {
    channel: ChannelDefinition,
}

#[derive(Debug, Deserialize)]
struct ChannelEventRequest {
    profile_id: String,
    session_id: Option<String>,
    sender_id: Option<String>,
    payload: serde_json::Value,
    attachments: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
struct ChannelEventsQuery {
    limit: Option<usize>,
}

async fn list_workspace(
    query: web::Query<WorkspacePathQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let path = query.path.trim();
    if path.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace path is required".to_string(),
            code: "WORKSPACE_PATH_REQUIRED",
        });
    }

    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            "workspace/*",
            "workspace.list",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "workspace.list capability denied".to_string(),
                code: "WORKSPACE_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "WORKSPACE_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state.workspace.list(path).await {
        Ok(entries) => HttpResponse::Ok().json(serde_json::json!({
            "path": path,
            "entries": entries,
            "count": entries.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "WORKSPACE_LIST_FAILED",
        }),
    }
}

async fn search_workspace(
    query: web::Query<WorkspaceSearchQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let path = query.path.as_deref().unwrap_or(".");
    if query.q.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace search query is required".to_string(),
            code: "WORKSPACE_SEARCH_QUERY_REQUIRED",
        });
    }

    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            "workspace/*",
            "workspace.search",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "workspace.search capability denied".to_string(),
                code: "WORKSPACE_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "WORKSPACE_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state
        .workspace
        .search_text(path, &query.q, query.limit.unwrap_or(50))
        .await
    {
        Ok(matches) => HttpResponse::Ok().json(serde_json::json!({
            "path": path,
            "query": query.q.trim(),
            "matches": matches,
            "count": matches.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "WORKSPACE_SEARCH_FAILED",
        }),
    }
}

async fn read_workspace_file(
    query: web::Query<WorkspacePathQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let path = query.path.trim();
    if path.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace path is required".to_string(),
            code: "WORKSPACE_PATH_REQUIRED",
        });
    }

    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            "workspace/*",
            "workspace.read",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "workspace.read capability denied".to_string(),
                code: "WORKSPACE_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "WORKSPACE_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state.workspace.read_text(path).await {
        Ok(content) => HttpResponse::Ok().json(serde_json::json!({
            "path": path,
            "content": content,
            "bytes": content.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "WORKSPACE_READ_FAILED",
        }),
    }
}

async fn write_workspace_file(
    request: web::Json<WorkspaceWriteRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.path.trim().is_empty() || request.content.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace path and content are required".to_string(),
            code: "WORKSPACE_WRITE_INVALID",
        });
    }

    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Write,
            "workspace/*",
            "workspace.write",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "workspace.write capability denied".to_string(),
                code: "WORKSPACE_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "WORKSPACE_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state
        .workspace
        .write_text(&request.path, &request.content)
        .await
    {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "path": request.path.trim(),
            "bytes": request.content.len(),
            "written": true,
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "WORKSPACE_WRITE_FAILED",
        }),
    }
}

async fn patch_workspace_file(
    request: web::Json<WorkspacePatchRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.path.trim().is_empty() || request.expected.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace path and expected patch fragment are required".to_string(),
            code: "WORKSPACE_PATCH_INVALID",
        });
    }
    if request.replacement.len() > 8 * 1024 * 1024 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "workspace replacement exceeds supported size".to_string(),
            code: "WORKSPACE_PATCH_TOO_LARGE",
        });
    }

    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Write,
            "workspace/*",
            "workspace.patch",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "workspace.patch capability denied".to_string(),
                code: "WORKSPACE_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "WORKSPACE_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state
        .workspace
        .apply_patch(&request.path, &request.expected, &request.replacement)
        .await
    {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "path": request.path.trim(),
            "patched": true,
        })),
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "WORKSPACE_PATCH_REJECTED",
        }),
    }
}

async fn list_projects(state: web::Data<RuntimeState>) -> impl Responder {
    let projects = state.projects.list().await;
    HttpResponse::Ok().json(serde_json::json!({
        "projects": projects,
        "count": projects.len(),
    }))
}

async fn register_project(
    request: web::Json<RegisterProjectRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.project.path == "." {
        // Root project is always valid for the configured workspace.
    } else if let Err(error) = state.workspace.list(&request.project.path).await {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: format!("project path is not a readable workspace directory: {error}"),
            code: "PROJECT_PATH_INVALID",
        });
    }
    match state.projects.register(request.project.clone()).await {
        Ok(project) => HttpResponse::Ok().json(project),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "PROJECT_INVALID",
        }),
    }
}

async fn delete_project(
    project_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.projects.remove(&project_id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "PROJECT_NOT_FOUND",
        }),
    }
}

async fn list_channels(state: web::Data<RuntimeState>) -> impl Responder {
    let channels: Vec<ChannelDefinition> = state.channels.list().await;
    HttpResponse::Ok().json(serde_json::json!({
        "channels": channels,
        "count": channels.len(),
    }))
}

async fn register_channel(
    request: web::Json<RegisterChannelRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.channels.register(request.channel.clone()).await {
        Ok(channel) => HttpResponse::Ok().json(channel),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "CHANNEL_INVALID",
        }),
    }
}

async fn delete_channel(
    channel_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.channels.remove(&channel_id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "CHANNEL_NOT_FOUND",
        }),
    }
}

async fn append_channel_event(
    channel_id: web::Path<String>,
    request: web::Json<ChannelEventRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .channels
        .append_event(
            &channel_id,
            &request.profile_id,
            request.session_id.clone(),
            request.sender_id.clone(),
            request.payload.clone(),
            request.attachments.clone().unwrap_or_default(),
        )
        .await
    {
        Ok(event) => HttpResponse::Created().json(event),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "CHANNEL_EVENT_REJECTED",
        }),
    }
}

async fn list_channel_events(
    path: web::Path<String>,
    query: web::Query<ChannelEventsQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .channels
        .events(&path, query.limit.unwrap_or(50).clamp(1, 500))
        .await
    {
        Ok(events) => HttpResponse::Ok().json(serde_json::json!({
            "channel_id": path.into_inner(),
            "events": events,
            "count": events.len(),
        })),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "CHANNEL_EVENTS_QUERY_FAILED",
        }),
    }
}

async fn create_terminal(
    request: web::Json<TerminalCreateRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.command.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "terminal command is required".to_string(),
            code: "TERMINAL_COMMAND_REQUIRED",
        });
    }

    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Execute,
            "terminal/*",
            "terminal.open",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.open capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state
        .terminal
        .create(&request.command, request.cwd.as_deref())
        .await
    {
        Ok(record) => HttpResponse::Created().json(record),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "TERMINAL_CREATE_FAILED",
        }),
    }
}

async fn list_terminals(
    query: web::Query<TerminalOutputQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            "terminal/*",
            "terminal.read",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.read capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state.terminal.list().await {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "terminals": records,
            "count": records.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "TERMINAL_LIST_FAILED",
        }),
    }
}

async fn get_terminal(
    terminal_id: web::Path<String>,
    query: web::Query<TerminalOutputQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            &format!("terminal/{}", terminal_id.as_str()),
            "terminal.read",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.read capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state.terminal.get(&terminal_id).await {
        Ok(Some(record)) => HttpResponse::Ok().json(record),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "terminal not found".to_string(),
            code: "TERMINAL_NOT_FOUND",
        }),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "TERMINAL_QUERY_FAILED",
        }),
    }
}

async fn write_terminal(
    terminal_id: web::Path<String>,
    request: web::Json<TerminalInputRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Write,
            &format!("terminal/{}", terminal_id.as_str()),
            "terminal.write",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.write capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state
        .terminal
        .write_input(&terminal_id, &request.input)
        .await
    {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "TERMINAL_WRITE_FAILED",
        }),
    }
}

async fn read_terminal(
    terminal_id: web::Path<String>,
    query: web::Query<TerminalOutputQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &query.grant_id,
            CapabilityType::Read,
            &format!("terminal/{}", terminal_id.as_str()),
            "terminal.read",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.read capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state
        .terminal
        .read_output(
            &terminal_id,
            query.after.unwrap_or(0),
            query.limit.unwrap_or(128),
        )
        .await
    {
        Ok(events) => HttpResponse::Ok().json(serde_json::json!({
            "terminal_id": terminal_id.into_inner(),
            "events": events,
            "count": events.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "TERMINAL_READ_FAILED",
        }),
    }
}

async fn close_terminal(
    terminal_id: web::Path<String>,
    request: web::Query<TerminalOutputQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Execute,
            &format!("terminal/{}", terminal_id.as_str()),
            "terminal.close",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.close capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state.terminal.close(&terminal_id).await {
        Ok(true) => HttpResponse::NoContent().finish(),
        Ok(false) => HttpResponse::NotFound().json(ErrorResponse {
            error: "terminal is not running".to_string(),
            code: "TERMINAL_NOT_FOUND",
        }),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "TERMINAL_CLOSE_FAILED",
        }),
    }
}

async fn delete_terminal(
    terminal_id: web::Path<String>,
    request: web::Query<TerminalOutputQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .authorize(
            &request.grant_id,
            CapabilityType::Execute,
            &format!("terminal/{}", terminal_id.as_str()),
            "terminal.close",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "terminal.close capability denied".to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TERMINAL_CAPABILITY_REQUIRED",
            })
        }
    }

    match state.terminal.delete(&terminal_id).await {
        Ok(true) => HttpResponse::NoContent().finish(),
        Ok(false) => HttpResponse::NotFound().json(ErrorResponse {
            error: "terminal not found".to_string(),
            code: "TERMINAL_NOT_FOUND",
        }),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "TERMINAL_DELETE_FAILED",
        }),
    }
}

async fn create_artifact(
    request: HttpRequest,
    body: web::Bytes,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let metadata_value = match request
        .headers()
        .get("x-artifact-metadata")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(raw) if raw.len() <= 64 * 1024 => match serde_json::from_str(raw) {
            Ok(value) => value,
            Err(error) => {
                return HttpResponse::BadRequest().json(ErrorResponse {
                    error: format!("invalid x-artifact-metadata: {error}"),
                    code: "ARTIFACT_METADATA_INVALID",
                })
            }
        },
        Some(_) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "artifact metadata exceeds supported limits".to_string(),
                code: "ARTIFACT_METADATA_TOO_LARGE",
            })
        }
        None => serde_json::json!({}),
    };

    let kind = request
        .headers()
        .get("x-artifact-kind")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("generic");
    let mime_type = request
        .headers()
        .get(actix_web::http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream");
    let run_id = request
        .headers()
        .get("x-run-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let trusted = request
        .headers()
        .get("x-artifact-trusted")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.eq_ignore_ascii_case("true"));
    let expires_at = request
        .headers()
        .get("x-artifact-expires-at")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    match state
        .artifacts
        .put_bytes(
            run_id,
            kind,
            mime_type,
            &body,
            expires_at,
            trusted,
            metadata_value,
        )
        .await
    {
        Ok(record) => HttpResponse::Created().json(record),
        Err(error) if error.contains("size limit") => {
            HttpResponse::PayloadTooLarge().json(ErrorResponse {
                error,
                code: "ARTIFACT_TOO_LARGE",
            })
        }
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "ARTIFACT_CREATE_FAILED",
        }),
    }
}

#[derive(Debug, Deserialize)]
struct ArtifactListQuery {
    run_id: Option<String>,
    limit: Option<usize>,
}

async fn list_artifacts(
    query: web::Query<ArtifactListQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let run_id = query
        .run_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    match state.artifacts.list(run_id, limit).await {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "artifacts": records,
            "count": records.len(),
            "limit": limit,
            "run_id": run_id,
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "ARTIFACT_LIST_FAILED",
        }),
    }
}

async fn get_artifact(
    artifact_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.artifacts.get(&artifact_id).await {
        Ok(Some(record)) => HttpResponse::Ok().json(record),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "artifact not found".to_string(),
            code: "ARTIFACT_NOT_FOUND",
        }),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "ARTIFACT_QUERY_FAILED",
        }),
    }
}

async fn get_artifact_content(
    artifact_id: web::Path<String>,
    request: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let id = artifact_id.into_inner();
    let record = match state.artifacts.get(&id).await {
        Ok(Some(record)) => record,
        Ok(None) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "artifact not found".to_string(),
                code: "ARTIFACT_NOT_FOUND",
            })
        }
        Err(error) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error,
                code: "ARTIFACT_QUERY_FAILED",
            })
        }
    };

    let requested_range = parse_single_byte_range(
        request
            .headers()
            .get(actix_web::http::header::RANGE)
            .and_then(|value| value.to_str().ok()),
        record.size_bytes,
    );

    match state
        .artifacts
        .read_range(&id, requested_range.clone())
        .await
    {
        Ok(bytes) => {
            let mut response = HttpResponse::Ok();
            response.content_type(record.mime_type);
            if let Some(range) = requested_range {
                response.status(actix_web::http::StatusCode::PARTIAL_CONTENT);
                response.insert_header((
                    actix_web::http::header::CONTENT_RANGE,
                    format!(
                        "bytes {}-{}/{}",
                        range.start,
                        range.end.saturating_sub(1),
                        record.size_bytes
                    ),
                ));
            }
            response.body(bytes)
        }
        Err(error) => HttpResponse::build(actix_web::http::StatusCode::RANGE_NOT_SATISFIABLE).json(
            ErrorResponse {
                error,
                code: "ARTIFACT_RANGE_INVALID",
            },
        ),
    }
}

async fn list_run_artifacts(
    run_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.artifacts.list_for_run(&run_id).await {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "run_id": run_id.into_inner(),
            "artifacts": records,
            "count": records.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "ARTIFACT_RUN_QUERY_FAILED",
        }),
    }
}

async fn delete_artifact(
    artifact_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.artifacts.delete(&artifact_id).await {
        Ok(true) => HttpResponse::NoContent().finish(),
        Ok(false) => HttpResponse::NotFound().json(ErrorResponse {
            error: "artifact not found".to_string(),
            code: "ARTIFACT_NOT_FOUND",
        }),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "ARTIFACT_DELETE_FAILED",
        }),
    }
}

fn parse_single_byte_range(value: Option<&str>, size: u64) -> Option<ArtifactRange> {
    let value = value?.trim();
    let spec = value.strip_prefix("bytes=")?;
    if spec.contains(',') {
        return None;
    }
    let (start, end) = spec.split_once('-')?;

    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?;
        if suffix == 0 {
            return None;
        }
        let length = suffix.min(size);
        return Some(ArtifactRange {
            start: size.saturating_sub(length),
            end: size,
        });
    }

    let start = start.parse::<u64>().ok()?;
    if start >= size {
        return None;
    }
    let end = if end.is_empty() {
        size
    } else {
        end.parse::<u64>().ok()?.saturating_add(1).min(size)
    };
    if end <= start {
        None
    } else {
        Some(ArtifactRange { start, end })
    }
}

async fn list_tools(state: web::Data<RuntimeState>) -> impl Responder {
    let tools = state.tool_runtime.list().await;
    HttpResponse::Ok().json(serde_json::json!({
        "tools": tools,
        "count": tools.len(),
    }))
}

async fn sync_mcp_tools(
    server_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let server_id = server_id.into_inner();
    match state
        .tool_runtime
        .sync_mcp_server(&state.mcp, &server_id)
        .await
    {
        Ok(tools) => {
            state.metrics.record_tool(false);
            state.metrics.record_http(false);
            HttpResponse::Ok().json(serde_json::json!({
                "server_id": server_id,
                "tools": tools,
                "count": tools.len(),
            }))
        }
        Err(error) => {
            state.metrics.record_tool(true);
            state.metrics.record_http(true);
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "MCP_TOOL_SYNC_FAILED",
            })
        }
    }
}

async fn execute_registered_tool(
    request: web::Json<ToolCallRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.tool_id.trim().is_empty() || request.agent_id.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "tool_id and agent_id are required".to_string(),
            code: "INVALID_TOOL_REQUEST",
        });
    }
    if request.grant_id.trim().is_empty() {
        let required_permission = state
            .tool_runtime
            .list()
            .await
            .into_iter()
            .find(|tool| tool.tool_id == request.tool_id)
            .and_then(|tool| tool.required_permissions.first().cloned())
            .unwrap_or_else(|| format!("tool.{}", request.tool_id.replace('/', ".")));
        let approval = match state
            .capabilities
            .request_approval(
                format!("tool-call-{}", request.agent_id),
                required_permission.clone(),
                format!("tool/{}", request.tool_id),
                unix_time().saturating_add(900),
            )
            .await
        {
            Ok(approval) => approval,
            Err(error) => {
                return HttpResponse::InternalServerError().json(ErrorResponse {
                    error: error.to_string(),
                    code: "APPROVAL_PERSIST_FAILED",
                })
            }
        };
        state.metrics.record_http(false);
        return HttpResponse::Accepted().json(serde_json::json!({
            "approval_required": true,
            "approval": approval,
            "required_permission": required_permission,
        }));
    }

    let parameters = match &request.parameters {
        Some(value) => match serde_json::to_string(value) {
            Ok(value) => value,
            Err(error) => {
                return HttpResponse::BadRequest().json(ErrorResponse {
                    error: error.to_string(),
                    code: "INVALID_TOOL_PARAMETERS",
                })
            }
        },
        None => "{}".to_string(),
    };

    match state
        .tool_runtime
        .execute(agenticos_contracts::ToolRequest {
            request_id: format!("tool-{}", uuid::Uuid::new_v4()),
            tool_id: request.tool_id.clone(),
            parameters,
            agent_id: request.agent_id.clone(),
            grant_id: request.grant_id.clone(),
        })
        .await
    {
        Ok(response) => {
            state.metrics.record_tool(false);
            state.metrics.record_http(false);
            HttpResponse::Ok().json(response)
        }
        Err(error) => {
            state.metrics.record_tool(true);
            state.metrics.record_http(true);
            HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TOOL_EXECUTION_DENIED",
            })
        }
    }
}

async fn list_audit(
    query: web::Query<AuditQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.audit.list_recent(query.limit.unwrap_or(100)).await {
        Ok(events) => HttpResponse::Ok().json(serde_json::json!({
            "events": events,
            "count": events.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "AUDIT_QUERY_FAILED",
        }),
    }
}

async fn list_mcp_servers(state: web::Data<RuntimeState>) -> impl Responder {
    let servers = state.mcp.list().await;
    HttpResponse::Ok().json(serde_json::json!({
        "servers": servers,
        "count": servers.len(),
    }))
}

async fn register_mcp_server(
    request: web::Json<RegisterMcpRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.mcp.register(request.server.clone()).await {
        Ok(()) => HttpResponse::Created().json(request.server.clone()),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "MCP_REGISTRATION_FAILED",
        }),
    }
}

async fn delete_mcp_server(
    server_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if state.mcp.unregister(&server_id).await {
        HttpResponse::NoContent().finish()
    } else {
        HttpResponse::NotFound().json(ErrorResponse {
            error: "MCP server not found".to_string(),
            code: "MCP_SERVER_NOT_FOUND",
        })
    }
}

async fn set_mcp_enabled(
    path: web::Path<(String, String)>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (server_id, action) = path.into_inner();
    let result = match action.as_str() {
        "enable" => state.mcp.enable(&server_id).await,
        "disable" => state.mcp.disable(&server_id).await,
        _ => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "action must be enable or disable".to_string(),
                code: "INVALID_MCP_ACTION",
            })
        }
    };

    match result {
        Ok(()) => HttpResponse::Ok()
            .json(serde_json::json!({"server_id": server_id, "enabled": action == "enable"})),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error: error.to_string(),
            code: "MCP_SERVER_NOT_FOUND",
        }),
    }
}

async fn list_mcp_tools(
    server_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.mcp.list_tools(&server_id).await {
        Ok(tools) => HttpResponse::Ok().json(serde_json::json!({
            "server_id": server_id.into_inner(),
            "tools": tools,
            "count": tools.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "MCP_TOOL_DISCOVERY_FAILED",
        }),
    }
}

async fn call_mcp_tool(
    path: web::Path<(String, String)>,
    request: web::Json<McpToolCallRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (server_id, tool_name) = path.into_inner();
    let grant_id = request.grant_id.trim();
    if grant_id.is_empty() {
        return HttpResponse::Forbidden().json(ErrorResponse {
            error: "grant_id is required for MCP tool execution".to_string(),
            code: "MCP_CAPABILITY_REQUIRED",
        });
    }

    let resource = format!("mcp/{server_id}/{tool_name}");
    match state
        .capabilities
        .authorize(grant_id, CapabilityType::Execute, &resource, "mcp.call")
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "MCP tool execution is not authorized".to_string(),
                code: "MCP_EXECUTION_DENIED",
            })
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "MCP_CAPABILITY_CHECK_FAILED",
            })
        }
    }

    match state
        .mcp
        .call_tool(
            &server_id,
            &tool_name,
            request
                .arguments
                .clone()
                .unwrap_or_else(|| serde_json::json!({})),
        )
        .await
    {
        Ok(result) => {
            let _ = state
                .audit
                .append(AuditEvent::new(
                    "mcp",
                    "tool.call",
                    None,
                    format!("mcp/{server_id}/{tool_name}"),
                    None,
                    "success",
                    serde_json::json!({}),
                ))
                .await;
            HttpResponse::Ok().json(serde_json::json!({
                "server_id": server_id,
                "tool": tool_name,
                "result": result,
            }))
        }
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "MCP_TOOL_CALL_FAILED",
        }),
    }
}

async fn analyze_github_repository(
    request: web::Json<AnalyzeRepositoryRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.source.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "source is required".to_string(),
            code: "SOURCE_INVALID",
        });
    }

    let info = match state.source_forge.inspect_repository(&request.source).await {
        Ok(info) => info,
        Err(error) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "SOURCE_INSPECTION_FAILED",
            })
        }
    };

    let metadata = agenticos_brain::RepositoryMetadata {
        repo_id: info.repo_id.clone(),
        url: info.url.clone(),
        default_branch: info.default_branch.clone(),
        last_indexed: chrono::Utc::now(),
        license: info.license.clone(),
        language: info.language.clone(),
        stars: info.stars,
        status: agenticos_brain::RepositoryStatus::Discovered,
    };
    if let Err(error) = state.source_intelligence.register_metadata(metadata).await {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "SOURCE_METADATA_REJECTED",
        });
    }

    let candidates = [
        "README.md",
        "Cargo.toml",
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "LICENSE",
    ];
    let mut documents = HashMap::new();
    for path in candidates {
        if let Ok(file) = state
            .source_forge
            .fetch_file(&info.repo_id, path, Some(&info.default_branch))
            .await
        {
            documents.insert(path.to_string(), file.content);
        }
    }

    match state
        .source_intelligence
        .analyze_documents(&info.repo_id, &documents)
        .await
    {
        Ok(analysis) => HttpResponse::Ok().json(serde_json::json!({
            "repository": info,
            "documents_fetched": documents.keys().cloned().collect::<Vec<_>>(),
            "analysis": analysis,
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "SOURCE_ANALYSIS_FAILED",
        }),
    }
}

async fn inspect_github_repository(
    request: web::Json<InspectRepositoryRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.source.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "source is required".to_string(),
            code: "SOURCE_INVALID",
        });
    }
    match state.source_forge.inspect_repository(&request.source).await {
        Ok(info) => HttpResponse::Ok().json(info),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "SOURCE_INSPECTION_FAILED",
        }),
    }
}

async fn fetch_github_source_file(
    path: web::Path<(String, String)>,
    query: web::Query<SourceFileQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (owner, repo) = path.into_inner();
    let repo_id = format!("{owner}/{repo}");
    match state
        .source_forge
        .fetch_file(&repo_id, &query.path, query.reference.as_deref())
        .await
    {
        Ok(file) => HttpResponse::Ok().json(file),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "SOURCE_FILE_FETCH_FAILED",
        }),
    }
}

async fn write_github_source_file(
    path: web::Path<(String, String)>,
    request: web::Json<WriteSourceFileRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (owner, repo) = path.into_inner();
    let repo_id = format!("{owner}/{repo}");
    let grant_id = request.grant_id.trim();
    let file_path = request.path.trim();
    let message = request.message.trim();

    if grant_id.is_empty() || file_path.is_empty() || message.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "grant_id, path and message are required".to_string(),
            code: "SOURCE_WRITE_REQUEST_INVALID",
        });
    }
    if request.content.len() > 16 * 1024 * 1024 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "source content exceeds the supported size limit".to_string(),
            code: "SOURCE_WRITE_TOO_LARGE",
        });
    }

    let resource = format!("github/{repo_id}/*");
    match state
        .capabilities
        .authorize(
            grant_id,
            CapabilityType::Write,
            &resource,
            "source.github.write",
        )
        .await
    {
        Ok(true) => {}
        Ok(false) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: "source.github.write capability denied".to_string(),
                code: "SOURCE_WRITE_CAPABILITY_REQUIRED",
            });
        }
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "SOURCE_WRITE_CAPABILITY_CHECK_FAILED",
            });
        }
    }

    match state
        .source_forge
        .write_file(
            &repo_id,
            file_path,
            &request.content,
            request.reference.as_deref(),
            message,
            request.expected_sha.as_deref(),
        )
        .await
    {
        Ok(result) => {
            let correlation_id = request_correlation_id(&request_http);
            if let Err(error) = state
                .audit
                .append(AuditEvent::new(
                    "source-forge",
                    "source.github.write",
                    None,
                    format!("github/{repo_id}"),
                    Some(correlation_id),
                    "success",
                    serde_json::json!({
                        "path": file_path,
                        "reference": request.reference,
                        "commit_sha": result.commit_sha,
                    }),
                ))
                .await
            {
                tracing::warn!(%error, "failed to persist GitHub write audit event");
            }
            state.metrics.record_http(false);
            HttpResponse::Ok().json(result)
        }
        Err(agenticos_source_forge::SourceForgeError::Conflict) => {
            let correlation_id = request_correlation_id(&request_http);
            let _ = state
                .audit
                .append(AuditEvent::new(
                    "source-forge",
                    "source.github.write",
                    None,
                    format!("github/{repo_id}"),
                    Some(correlation_id),
                    "conflict",
                    serde_json::json!({"path": file_path}),
                ))
                .await;
            state.metrics.record_http(true);
            HttpResponse::Conflict().json(ErrorResponse {
                error: "GitHub file changed since the supplied expected SHA".to_string(),
                code: "SOURCE_WRITE_CONFLICT",
            })
        }
        Err(error) => {
            let correlation_id = request_correlation_id(&request_http);
            let _ = state
                .audit
                .append(AuditEvent::new(
                    "source-forge",
                    "source.github.write",
                    None,
                    format!("github/{repo_id}"),
                    Some(correlation_id),
                    "failure",
                    serde_json::json!({"path": file_path}),
                ))
                .await;
            state.metrics.record_http(true);
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "SOURCE_WRITE_FAILED",
            })
        }
    }
}

async fn authorize_browser(
    state: &RuntimeState,
    session_id: &str,
    grant_id: &str,
) -> Result<(), HttpResponse> {
    if grant_id.trim().is_empty() {
        return Err(HttpResponse::BadRequest().json(ErrorResponse {
                error: "grant_id is required".to_string(),
            code: "BROWSER_GRANT_REQUIRED",
        }));
    }
    let resource = format!("browser/{session_id}");
    match state
        .capabilities
        .authorize(grant_id.trim(), CapabilityType::Execute, &resource, "browser.use")
        .await
    {
        Ok(true) => Ok(()),
        Ok(false) => Err(HttpResponse::Forbidden().json(ErrorResponse {
            error: "browser.use capability denied".to_string(),
            code: "BROWSER_CAPABILITY_REQUIRED",
        })),
        Err(error) => Err(HttpResponse::Forbidden().json(ErrorResponse {
            error: error.to_string(),
            code: "BROWSER_CAPABILITY_CHECK_FAILED",
        })),
    }
}

async fn browser_status(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "available": state.browser.is_available().await,
        "runtime": "agent-browser",
    }))
}

fn request_correlation_id(request: &HttpRequest) -> String {
    request
        .extensions()
        .get::<String>()
        .cloned()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
}

async fn browser_audit_event(
    state: &RuntimeState,
    request_id: &str,
    operation: &str,
    session_id: &str,
    success: bool,
) {
    if let Err(error) = state
        .audit
        .append(AuditEvent::new(
            "browser",
            operation,
            None,
            format!("browser/{session_id}"),
            Some(request_id.to_string()),
            if success { "success" } else { "failure" },
            serde_json::json!({
                "action": operation,
                "session_id": session_id,
                "surface": "http",
            }),
        ))
        .await
    {
        tracing::warn!(
            %error,
            operation,
            session_id,
            "failed to persist browser HTTP audit event"
        );
    }
}

async fn browser_open(
    path: web::Path<String>,
    request: web::Json<BrowserOpenRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.open(&session_id, request.url.trim()).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "open",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "open",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_OPEN_FAILED",
            })
        },
    }
}

async fn browser_snapshot(
    path: web::Path<String>,
    request: web::Json<BrowserGrantRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.snapshot(&session_id).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "snapshot",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "snapshot",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_SNAPSHOT_FAILED",
            })
        },
    }
}

async fn browser_click(
    path: web::Path<String>,
    request: web::Json<BrowserClickRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.click(&session_id, request.target.trim()).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "click",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "click",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_CLICK_FAILED",
            })
        },
    }
}

async fn browser_fill(
    path: web::Path<String>,
    request: web::Json<BrowserFillRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state
        .browser
        .fill(&session_id, request.target.trim(), &request.text)
        .await
    {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "fill",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "fill",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_FILL_FAILED",
            })
        },
    }
}

async fn browser_wait(
    path: web::Path<String>,
    request: web::Json<BrowserWaitRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.wait(&session_id, request.target.trim()).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "wait",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "wait",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_WAIT_FAILED",
            })
        },
    }
}

async fn browser_get_text(
    path: web::Path<String>,
    request: web::Json<BrowserTextRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state
        .browser
        .get_text(&session_id, request.target.trim())
        .await
    {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "get_text",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "get_text",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_GET_TEXT_FAILED",
            })
        },
    }
}

async fn browser_screenshot(
    path: web::Path<String>,
    request: web::Json<BrowserGrantRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.screenshot(&session_id).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "screenshot",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "screenshot",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_SCREENSHOT_FAILED",
            })
        },
    }
}

async fn browser_close(
    path: web::Path<String>,
    request: web::Json<BrowserGrantRequest>,
    request_http: HttpRequest,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let session_id = path.into_inner();
    if let Err(response) = authorize_browser(&state, &session_id, &request.grant_id).await {
        return response;
    }
    match state.browser.close(&session_id).await {
        Ok(result) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "close",
                &session_id,
                result.success,
            )
            .await;
            HttpResponse::Ok().json(result)
        },
        Err(error) => {
            browser_audit_event(
                &state,
                &request_correlation_id(&request_http),
                "close",
                &session_id,
                false,
            )
            .await;
            HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "BROWSER_CLOSE_FAILED",
            })
        },
    }
}

async fn list_evaluation_cases(state: web::Data<RuntimeState>) -> impl Responder {
    let cases = state.evaluation.list_cases().await;
    HttpResponse::Ok().json(serde_json::json!({
        "cases": cases,
        "count": cases.len(),
    }))
}

async fn create_evaluation_case(
    request: web::Json<CreateEvaluationCaseRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.evaluation.register(request.case.clone()).await {
        Ok(()) => HttpResponse::Created().json(request.case.clone()),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "EVALUATION_CASE_INVALID",
        }),
    }
}

async fn run_evaluation_case(
    case_id: web::Path<String>,
    request: web::Json<EvaluateCaseRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.output.len() > 2_000_000 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "evaluation output exceeds the supported limit".to_string(),
            code: "EVALUATION_OUTPUT_TOO_LARGE",
        });
    }
    match state.evaluation.evaluate(&case_id, &request.output).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "EVALUATION_CASE_NOT_FOUND",
        }),
    }
}

async fn get_evaluation_result(
    case_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.evaluation.result(&case_id).await {
        Some(result) => HttpResponse::Ok().json(result),
        None => HttpResponse::NotFound().json(ErrorResponse {
            error: "evaluation result not found".to_string(),
            code: "EVALUATION_RESULT_NOT_FOUND",
        }),
    }
}

#[derive(Debug, Deserialize)]
struct UsageQuery {
    since: Option<u64>,
    limit: Option<usize>,
}

async fn usage_summary(
    query: web::Query<UsageQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .cost_ledger
        .summary_since(query.since.unwrap_or(0))
        .await
    {
        Ok((tokens, cost_usd)) => HttpResponse::Ok().json(serde_json::json!({
            "tokens": tokens,
            "cost_usd": cost_usd,
            "since": query.since.unwrap_or(0),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "USAGE_SUMMARY_FAILED",
        }),
    }
}

async fn usage_records(
    query: web::Query<UsageQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .cost_ledger
        .list_recent(query.limit.unwrap_or(50))
        .await
    {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "records": records,
            "count": records.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error,
            code: "USAGE_LIST_FAILED",
        }),
    }
}

async fn set_usage_pricing(
    request: web::Json<TokenPricing>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.cost_ledger.set_pricing(request.into_inner()).await {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "USAGE_PRICING_INVALID",
        }),
    }
}

async fn list_skills(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "skills": state.skills.iter().map(|skill| {
            serde_json::json!({
                "name": skill.name,
                "version": skill.version,
                "author": skill.author,
                "platforms": skill.platforms,
                "description": skill.description,
            })
        }).collect::<Vec<_>>(),
        "count": state.skills.len(),
    }))
}

async fn runtime_metrics(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(state.metrics.snapshot())
}

fn build_a2a_agent_card() -> AgentCard {
    let base_url = std::env::var("AGENTICOS_PUBLIC_BASE_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "http://localhost:8080".to_string())
        .trim_end_matches('/')
        .to_string();

    AgentCard {
        name: "AgentiCOS".to_string(),
        description: "Universal durable AI agent runtime".to_string(),
        supported_interfaces: vec![AgentInterface {
            url: format!("{base_url}/a2a"),
            protocol_binding: agenticos_a2a::A2A_PROTOCOL_BINDING.to_string(),
            protocol_version: agenticos_a2a::A2A_PROTOCOL_VERSION.to_string(),
        }],
        provider: Some(agenticos_a2a::AgentProvider {
            organization: "AgentiCOS".to_string(),
            url: Some(base_url.clone()),
        }),
        version: env!("CARGO_PKG_VERSION").to_string(),
        documentation_url: Some(format!("{base_url}/health")),
        capabilities: AgentCapabilities {
            streaming: false,
            push_notifications: false,
            extended_agent_card: false,
            extensions: Vec::new(),
        },
        security_schemes: HashMap::new(),
        security_requirements: Vec::new(),
        default_input_modes: vec!["text/plain".to_string()],
        default_output_modes: vec!["text/plain".to_string()],
        skills: vec![AgentSkill {
            id: "general-agent".to_string(),
            name: "General Agent".to_string(),
            description: "Execute durable objectives through the AgentiCOS runtime".to_string(),
            input_modes: vec!["text/plain".to_string()],
            output_modes: vec!["text/plain".to_string()],
            examples: vec!["Solve this task and report the result.".to_string()],
        }],
        signatures: Vec::new(),
        icon_url: None,
    }
}

async fn a2a_agent_card() -> impl Responder {
    HttpResponse::Ok().json(build_a2a_agent_card())
}

fn a2a_error(id: serde_json::Value, code: i32, message: impl Into<String>) -> HttpResponse {
    HttpResponse::Ok().json(JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id,
        result: None,
        error: Some(JsonRpcError {
            code,
            message: message.into(),
            data: None,
        }),
    })
}

fn map_run_state_to_a2a(state: RunState) -> TaskState {
    match state {
        RunState::Created | RunState::Admitted | RunState::Waiting => TaskState::Submitted,
        RunState::Running | RunState::Cancelling => TaskState::Working,
        RunState::Completed => TaskState::Completed,
        RunState::Failed => TaskState::Failed,
        RunState::Cancelled => TaskState::Canceled,
    }
}

async fn a2a_rpc(
    request: web::Json<JsonRpcRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.jsonrpc != "2.0" {
        return a2a_error(request.id.clone(), -32600, "jsonrpc must be 2.0");
    }

    match request.method.as_str() {
        "message/send" => {
            let params =
                match serde_json::from_value::<A2aSendMessageParams>(request.params.clone()) {
                    Ok(value) => value,
                    Err(error) => {
                        return a2a_error(request.id.clone(), -32602, error.to_string());
                    }
                };

            let objective = text_from_message(&params.message);
            if objective.trim().is_empty() {
                return a2a_error(
                    request.id.clone(),
                    -32602,
                    "message must contain at least one text part",
                );
            }
            if objective.len() > 1_000_000 {
                return a2a_error(request.id.clone(), -32602, "message is too large");
            }

            let task_id = format!("task-{}", uuid::Uuid::new_v4());
            let context_id = params
                .message
                .context_id
                .clone()
                .unwrap_or_else(|| format!("context-{}", uuid::Uuid::new_v4()));
            let run_id = match RunId::new(format!("a2a-{task_id}")) {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32602, error.to_string()),
            };

            let created = match state.kernel.create_run(run_id.clone()).await {
                Ok(value) => value,
                Err(error) => {
                    return a2a_error(request.id.clone(), -32001, error.to_string());
                }
            };
            if let Err(error) = state
                .kernel
                .transition_run(&run_id, RunState::Admitted, created.version)
                .await
            {
                return a2a_error(request.id.clone(), -32001, error.to_string());
            }

            if let Err(error) = state
                .memory
                .store_message(
                    &format!("{}-objective", run_id.as_str()),
                    run_id.as_str(),
                    "objective",
                    &objective,
                )
                .await
            {
                return a2a_error(request.id.clone(), -32001, error.to_string());
            }

            let job_id = format!("a2a-job-{task_id}");
            if let Err(error) = state
                .scheduler
                .enqueue(JobSpec {
                    job_id,
                    run_id: run_id.as_str().to_string(),
                    task: objective,
                    dependencies: Vec::new(),
                    priority: 80,
                    max_attempts: 2,

                    job_type: "agent".to_string(),

                    metadata: serde_json::json!({}),
                })
                .await
            {
                return a2a_error(request.id.clone(), -32001, error);
            }

            let mut message = params.message;
            message.context_id = Some(context_id.clone());
            message.task_id = Some(task_id.clone());
            let now = chrono::Utc::now().timestamp().max(0) as u64;
            let record = A2aTaskRecord {
                id: task_id.clone(),
                context_id,
                run_id: run_id.as_str().to_string(),
                history: vec![message],
                created_at: now,
                updated_at: now,
            };
            if let Err(error) = state.a2a_tasks.put(record.clone()).await {
                return a2a_error(request.id.clone(), -32001, error);
            }

            let view = TaskView::from_record(&record, TaskState::Submitted);
            HttpResponse::Ok().json(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id.clone(),
                result: Some(serde_json::to_value(view).unwrap_or_else(|_| serde_json::json!({}))),
                error: None,
            })
        }
        "tasks/get" => {
            let params = match serde_json::from_value::<A2aTaskParams>(request.params.clone()) {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32602, error.to_string()),
            };
            let record = match state.a2a_tasks.get(&params.id).await {
                Some(value) => value,
                None => return a2a_error(request.id.clone(), -32004, "task not found"),
            };
            let run_id = match RunId::new(record.run_id.clone()) {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32001, error.to_string()),
            };
            let run = match state.kernel.get_or_recover_run(&run_id).await {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32001, error.to_string()),
            };
            let view = TaskView::from_record(&record, map_run_state_to_a2a(run.state));
            HttpResponse::Ok().json(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id.clone(),
                result: Some(serde_json::to_value(view).unwrap_or_else(|_| serde_json::json!({}))),
                error: None,
            })
        }
        "tasks/cancel" => {
            let params = match serde_json::from_value::<A2aTaskParams>(request.params.clone()) {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32602, error.to_string()),
            };
            let record = match state.a2a_tasks.get(&params.id).await {
                Some(value) => value,
                None => return a2a_error(request.id.clone(), -32004, "task not found"),
            };
            let run_id = match RunId::new(record.run_id.clone()) {
                Ok(value) => value,
                Err(error) => return a2a_error(request.id.clone(), -32001, error.to_string()),
            };
            if let Err(error) = state.kernel.cancel_run(&run_id).await {
                return a2a_error(request.id.clone(), -32001, error.to_string());
            }
            let view = TaskView::from_record(&record, TaskState::Canceled);
            HttpResponse::Ok().json(JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id.clone(),
                result: Some(serde_json::to_value(view).unwrap_or_else(|_| serde_json::json!({}))),
                error: None,
            })
        }
        _ => a2a_error(request.id.clone(), -32601, "A2A method not supported"),
    }
}

async fn readiness_check(state: web::Data<RuntimeState>) -> impl Responder {
    let configured = state.configured().await;
    let has_healthy_provider = state
        .provider
        .list_status()
        .await
        .iter()
        .any(|provider| provider.health == "Healthy");

    let payload = serde_json::json!({
        "status": if configured && has_healthy_provider { "ready" } else { "not_ready" },
        "provider_configured": configured,
        "healthy_provider": has_healthy_provider,
    });

    if configured && has_healthy_provider {
        HttpResponse::Ok().json(payload)
    } else {
        HttpResponse::ServiceUnavailable().json(payload)
    }
}

async fn health_check(state: web::Data<RuntimeState>) -> impl Responder {
    let configured = state.configured().await;
    let sandbox_status = state
        .sandbox
        .get_status()
        .await
        .ok()
        .map(|status| format!("{status:?}"));
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "AgentiCOS API Server",
        "backend": "rust",
        "database": "sqlite",
        "provider_configured": configured,
        "sandbox": sandbox_status,
    }))
}

async fn agent_status(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "agent_name": "AgentiCOS",
        "state": if state.configured().await { "ready" } else { "configuration_required" },
        "model": state.model,
        "providers": state.provider.list_status().await,
    }))
}

async fn stream_model_execute(
    request: web::Json<DirectModelRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let model = request.model.trim();
    let input = request.input.trim();
    if model.is_empty() || input.is_empty() {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model and input are required".to_string(),
            code: "INVALID_MODEL_REQUEST",
        });
    }
    if model.len() > 256 || input.len() > 1_000_000 {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model request exceeds supported limits".to_string(),
            code: "MODEL_REQUEST_TOO_LARGE",
        });
    }

    let request_id = request
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let mut upstream = match state
        .provider
        .stream(agenticos_contracts::ModelRequest {
            request_id: request_id.clone(),
            model: model.to_string(),
            input: input.to_string(),
            parameters: request.parameters.clone(),
        })
        .await
    {
        Ok(stream) => {
            state.metrics.record_provider(false);
            stream
        }
        Err(error) => {
            state.metrics.record_provider(true);
            state.metrics.record_http(true);
            return HttpResponse::BadGateway().json(ErrorResponse {
                error: error.to_string(),
                code: "MODEL_STREAM_INIT_FAILED",
            });
        }
    };

    let request_id_for_stream = request_id.clone();
    let metrics = state.metrics.clone();
    let stream = async_stream::stream! {
        use futures::StreamExt;

        while let Some(item) = upstream.next().await {
            match item {
                Ok(chunk) if chunk == "[DONE]" => {
                    let payload = serde_json::json!({
                        "request_id": request_id_for_stream,
                        "done": true,
                    });
                    yield Ok::<_, actix_web::Error>(actix_web::web::Bytes::from(format!(
                        "event: done\ndata: {}\n\n",
                        payload
                    )));
                    metrics.record_http(false);
                }
                Ok(chunk) => {
                    let payload = serde_json::json!({
                        "request_id": request_id_for_stream,
                        "delta": chunk,
                        "done": false,
                    });
                    yield Ok::<_, actix_web::Error>(actix_web::web::Bytes::from(format!(
                        "event: message\ndata: {}\n\n",
                        payload
                    )));
                }
                Err(error) => {
                    let payload = serde_json::json!({
                        "request_id": request_id_for_stream,
                        "error": error.to_string(),
                    });
                    metrics.record_provider(true);
                    metrics.record_http(true);
                    yield Ok::<_, actix_web::Error>(actix_web::web::Bytes::from(format!(
                        "event: error\ndata: {}\n\n",
                        payload
                    )));
                    break;
                }
            }
        }
    };

    HttpResponse::Ok()
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("X-Accel-Buffering", "no"))
        .content_type("text/event-stream")
        .streaming(stream)
}

async fn direct_model_execute(
    request: web::Json<DirectModelRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let model = request.model.trim();
    let input = request.input.trim();
    if model.is_empty() || input.is_empty() {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model and input are required".to_string(),
            code: "INVALID_MODEL_REQUEST",
        });
    }
    if model.len() > 256 || input.len() > 1_000_000 {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model request exceeds supported limits".to_string(),
            code: "MODEL_REQUEST_TOO_LARGE",
        });
    }
    if request
        .parameters
        .as_ref()
        .is_some_and(|value| value.len() > 64 * 1024)
    {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model parameters exceed supported limits".to_string(),
            code: "MODEL_PARAMETERS_TOO_LARGE",
        });
    }

    let request_id = request
        .request_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let started_at = std::time::Instant::now();
    state.metrics.record_provider(false);
    match state
        .provider
        .execute(agenticos_contracts::ModelRequest {
            request_id,
            model: model.to_string(),
            input: input.to_string(),
            parameters: request.parameters.clone(),
        })
        .await
    {
        Ok(response) => {
            record_model_usage(
                &state,
                &response.request_id,
                provider_id_from_metadata(response.metadata.as_deref()),
                model,
                response.tokens_used,
            )
            .await;
            state.metrics.record_http(false);
            state
                .metrics
                .record_llm_latency(started_at.elapsed().as_millis() as u64);
            HttpResponse::Ok().json(response)
        }
        Err(error) => {
            state.metrics.record_provider(true);
            state.metrics.record_http(true);
            state
                .metrics
                .record_llm_latency(started_at.elapsed().as_millis() as u64);
            HttpResponse::BadGateway().json(ErrorResponse {
                error: error.to_string(),
                code: "MODEL_EXECUTION_FAILED",
            })
        }
    }
}

async fn agent_chat(
    request: web::Json<ChatRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let message = request.message.trim();
    if message.is_empty() {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "message must not be empty".to_string(),
            code: "INVALID_MESSAGE",
        });
    }
    if !state.configured().await {
        state.metrics.record_http(true);
        return HttpResponse::ServiceUnavailable().json(ErrorResponse {
            error: "No provider credential is configured".to_string(),
            code: "PROVIDER_NOT_CONFIGURED",
        });
    }

    let session_id = request
        .session_id
        .clone()
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let run_id = match RunId::new(
        request
            .run_id
            .clone()
            .filter(|id| !id.trim().is_empty())
            .unwrap_or_else(|| format!("chat-{}", uuid::Uuid::new_v4())),
    ) {
        Ok(id) => id,
        Err(error) => {
            state.metrics.record_http(true);
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "INVALID_RUN_ID",
            });
        }
    };

    let requested_model = request
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if requested_model.is_some_and(|model| model.len() > 256) {
        state.metrics.record_http(true);
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "model exceeds supported limits".to_string(),
            code: "MODEL_ID_TOO_LARGE",
        });
    }

    let provider_parameters = match request.parameters.as_ref() {
        Some(value) if value.is_object() => serde_json::to_string(value).ok(),
        Some(_) => {
            state.metrics.record_http(true);
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "parameters must be a JSON object".to_string(),
                code: "INVALID_MODEL_PARAMETERS",
            });
        }
        None => None,
    };

    if let Some(parameters) = provider_parameters.as_deref() {
        if parameters.len() > 64 * 1024 {
            state.metrics.record_http(true);
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "parameters exceed supported limits".to_string(),
                code: "MODEL_PARAMETERS_TOO_LARGE",
            });
        }
    }

    let agent = state.session_agent(&session_id, requested_model).await;

    let created_run = match state.kernel.create_run(run_id.clone()).await {
        Ok(run) => run,
        Err(error) => {
            state.metrics.record_http(true);
            return HttpResponse::Conflict().json(ErrorResponse {
                error: error.to_string(),
                code: "CHAT_RUN_CREATE_FAILED",
            });
        }
    };
    if let Err(error) = state
        .kernel
        .transition_run(&run_id, RunState::Admitted, created_run.version)
        .await
    {
        state.metrics.record_http(true);
        return HttpResponse::Conflict().json(ErrorResponse {
            error: error.to_string(),
            code: "CHAT_RUN_ADMISSION_FAILED",
        });
    }
    let admitted = match state.kernel.get_or_recover_run(&run_id).await {
        Ok(run) => run,
        Err(error) => {
            state.metrics.record_http(true);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: error.to_string(),
                code: "CHAT_RUN_STATE_FAILED",
            });
        }
    };
    if let Err(error) = state
        .kernel
        .transition_run(&run_id, RunState::Running, admitted.version)
        .await
    {
        state.metrics.record_http(true);
        return HttpResponse::Conflict().json(ErrorResponse {
            error: error.to_string(),
            code: "CHAT_RUN_START_FAILED",
        });
    }
    if let Err(error) = state
        .memory
        .store_message(
            &format!("{}-objective", run_id.as_str()),
            run_id.as_str(),
            "objective",
            message,
        )
        .await
    {
        if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
            let _ = state
                .kernel
                .transition_run(&run_id, RunState::Failed, current.version)
                .await;
        }
        state.metrics.record_http(true);
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "CHAT_RUN_OBJECTIVE_PERSIST_FAILED",
        });
    }

    let _agent_permit = state
        .agent_execution_concurrency
        .acquire()
        .await
        .map_err(|_| ())
        .ok();
    if _agent_permit.is_none() {
        state.metrics.record_http(true);
        return HttpResponse::ServiceUnavailable().json(ErrorResponse {
            error: "agent execution capacity is unavailable".to_string(),
            code: "AGENT_CAPACITY_UNAVAILABLE",
        });
    }
    let started_at = std::time::Instant::now();
    state.metrics.record_provider(false);

    let execution = agent.execute_turn_with_parameters(message, provider_parameters);
    tokio::pin!(execution);

    let execution_result = loop {
        tokio::select! {
            result = &mut execution => break result,
            _ = tokio::time::sleep(std::time::Duration::from_millis(75)) => {
                match state.kernel.get_or_recover_run(&run_id).await {
                    Ok(run) if run.state == RunState::Cancelling || run.cancellation.is_cancelled() => {
                        break Err(ContractError::ParseError("run was cancelled".to_string()));
                    }
                    Ok(_) => {}
                    Err(error) => break Err(error),
                }
            }
        }
    };

    match execution_result {
        Ok(response) => {
            let current = match state.kernel.get_or_recover_run(&run_id).await {
                Ok(run) => run,
                Err(error) => {
                    state.metrics.record_http(true);
                    return HttpResponse::InternalServerError().json(ErrorResponse {
                        error: error.to_string(),
                        code: "CHAT_RUN_STATE_FAILED",
                    });
                }
            };
            if current.state == RunState::Cancelling || current.cancellation.is_cancelled() {
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Cancelled, current.version)
                    .await;
                state.metrics.record_http(true);
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: "run was cancelled".to_string(),
                    code: "RUN_CANCELLED",
                });
            }
            if let Err(error) = state
                .kernel
                .transition_run(&run_id, RunState::Completed, current.version)
                .await
            {
                state.metrics.record_http(true);
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: error.to_string(),
                    code: "CHAT_RUN_COMPLETE_FAILED",
                });
            }
            state.metrics.record_http(false);
            state
                .metrics
                .record_llm_latency(started_at.elapsed().as_millis() as u64);
            HttpResponse::Ok().json(ChatResponse {
                response,
                agent: agent.name().to_string(),
                session_id,
                model: requested_model.unwrap_or(state.model.as_str()).to_string(),
                run_id: run_id.as_str().to_string(),
            })
        }
        Err(error) => {
            state.metrics.record_provider(true);
            state.metrics.record_http(true);
            state
                .metrics
                .record_llm_latency(started_at.elapsed().as_millis() as u64);
            let current = state.kernel.get_or_recover_run(&run_id).await.ok();
            if let Some(current) = current {
                if current.state == RunState::Cancelling || current.cancellation.is_cancelled() {
                    let _ = state
                        .kernel
                        .transition_run(&run_id, RunState::Cancelled, current.version)
                        .await;
                    state.metrics.record_http(true);
                    return HttpResponse::Conflict().json(ErrorResponse {
                        error: "run was cancelled".to_string(),
                        code: "RUN_CANCELLED",
                    });
                }
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Failed, current.version)
                    .await;
            }
            state.metrics.record_http(true);
            state
                .metrics
                .record_llm_latency(started_at.elapsed().as_millis() as u64);
            tracing::error!(error = ?error, "agent execution failed");
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: error.to_string(),
                code: "AGENT_EXECUTION_FAILED",
            })
        }
    }
}

async fn conversation_history(
    session_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let id = session_id.into_inner();
    match state.memory.get_session_history(&id, 200).await {
        Ok(history) => HttpResponse::Ok().json(serde_json::json!({
            "session_id": id,
            "history": history,
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_READ_FAILED",
        }),
    }
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: String,
    limit: Option<usize>,
}

async fn conversation_search(
    query: web::Query<SearchQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let q = query.q.trim();
    if q.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "q must not be empty".to_string(),
            code: "INVALID_QUERY",
        });
    }
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    match state.memory.search_conversations(q, limit).await {
        Ok(results) => HttpResponse::Ok().json(serde_json::json!({
            "query": q,
            "results": results,
            "count": results.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_SEARCH_FAILED",
        }),
    }
}

async fn list_providers(state: web::Data<RuntimeState>) -> impl Responder {
    let providers: Vec<ProviderStatus> = state.provider.list_status().await;
    HttpResponse::Ok().json(serde_json::json!({
        "providers": providers,
        "count": providers.len()
    }))
}

async fn refresh_provider_models(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    match state.provider.refresh_models(&provider_id).await {
        Ok(models) => HttpResponse::Ok().json(serde_json::json!({
            "provider_id": provider_id,
            "models": models,
            "count": models.len(),
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PROVIDER_MODEL_REFRESH_FAILED",
        }),
    }
}

async fn check_provider_health(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    match state.provider.check_health(&provider_id).await {
        Ok(check) => HttpResponse::Ok().json(check),
        Err(error) => HttpResponse::ServiceUnavailable().json(ErrorResponse {
            error: error.to_string(),
            code: "PROVIDER_HEALTH_CHECK_FAILED",
        }),
    }
}

async fn get_provider_quota(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    if state
        .provider
        .list_status()
        .await
        .iter()
        .all(|provider| provider.provider_id != provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    match state
        .provider
        .list_status()
        .await
        .into_iter()
        .find(|p| p.provider_id == provider_id)
    {
        Some(status) => HttpResponse::Ok().json(serde_json::json!({
            "provider_id": status.provider_id,
            "requests_per_minute": status.requests_per_minute,
            "tokens_per_minute": status.tokens_per_minute,
            "current_usage": status.requests_used,
            "current_token_usage": status.tokens_used,
        })),
        None => HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        }),
    }
}

async fn set_provider_quota(
    provider_id: web::Path<String>,
    request: web::Json<ProviderQuotaRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    if state
        .provider
        .list_status()
        .await
        .iter()
        .all(|provider| provider.provider_id != provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    let current_usage = match request.current_usage {
        Some(value) => value,
        None => state
            .provider
            .get_quota(&provider_id)
            .await
            .map(|quota| quota.current_usage)
            .unwrap_or(0),
    };

    let quota = agenticos_contracts::QuotaInfo {
        provider_id: provider_id.clone(),
        requests_per_minute: request.requests_per_minute,
        tokens_per_minute: request.tokens_per_minute,
        current_usage,
    };

    match state.provider.set_quota(quota.clone()).await {
        Ok(()) => HttpResponse::Ok().json(quota),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PROVIDER_QUOTA_UPDATE_FAILED",
        }),
    }
}

async fn get_provider_retry_policy(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    if state
        .provider
        .list_status()
        .await
        .iter()
        .all(|provider| provider.provider_id != provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    match state.provider.get_retry_policy(&provider_id).await {
        Some(policy) => HttpResponse::Ok().json(policy),
        None => HttpResponse::Ok().json(agenticos_contracts::RetryPolicy {
            max_attempts: 3,

            job_type: "agent".to_string(),

            metadata: serde_json::json!({}),
            initial_backoff_ms: 250,
            max_backoff_ms: 4_000,
            exponential_backoff: true,
        }),
    }
}

async fn set_provider_retry_policy(
    provider_id: web::Path<String>,
    request: web::Json<ProviderRetryRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    if state
        .provider
        .list_status()
        .await
        .iter()
        .all(|provider| provider.provider_id != provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    if request.max_attempts == 0 || request.max_attempts > 20 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "max_attempts must be between 1 and 20".to_string(),
            code: "INVALID_RETRY_POLICY",
        });
    }
    if request.max_backoff_ms < request.initial_backoff_ms {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "max_backoff_ms must be >= initial_backoff_ms".to_string(),
            code: "INVALID_RETRY_POLICY",
        });
    }

    let policy = agenticos_contracts::RetryPolicy {
        max_attempts: request.max_attempts,

        job_type: "agent".to_string(),

        metadata: serde_json::json!({}),
        initial_backoff_ms: request.initial_backoff_ms,
        max_backoff_ms: request.max_backoff_ms,
        exponential_backoff: request.exponential_backoff,
    };

    match state
        .provider
        .set_retry_policy(provider_id, policy.clone())
        .await
    {
        Ok(()) => HttpResponse::Ok().json(policy),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PROVIDER_RETRY_UPDATE_FAILED",
        }),
    }
}

async fn get_provider_fallback(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    let exists = state
        .provider
        .list_status()
        .await
        .iter()
        .any(|provider| provider.provider_id == provider_id);
    if !exists {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    match state.provider.get_fallback_config(&provider_id).await {
        Some(config) => HttpResponse::Ok().json(ProviderFallbackResponse {
            primary_provider: config.primary_provider,
            fallback_providers: config.fallback_providers,
            auto_failover: config.auto_failover,
        }),
        None => HttpResponse::Ok().json(ProviderFallbackResponse {
            primary_provider: provider_id,
            fallback_providers: Vec::new(),
            auto_failover: false,
        }),
    }
}

async fn set_provider_fallback(
    provider_id: web::Path<String>,
    request: web::Json<ProviderFallbackRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    let providers = state.provider.list_status().await;
    if !providers
        .iter()
        .any(|provider| provider.provider_id == provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }

    let mut seen = std::collections::HashSet::new();
    let mut fallback_providers = Vec::with_capacity(request.fallback_providers.len());
    for fallback in &request.fallback_providers {
        let fallback = fallback.trim();
        if fallback.is_empty() || fallback.len() > 128 {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "fallback provider identifiers must be non-empty and <= 128 characters"
                    .to_string(),
                code: "INVALID_FALLBACK_POLICY",
            });
        }
        if fallback == provider_id {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "primary provider cannot be its own fallback".to_string(),
                code: "INVALID_FALLBACK_POLICY",
            });
        }
        if !seen.insert(fallback.to_string()) {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "fallback provider identifiers must be unique".to_string(),
                code: "INVALID_FALLBACK_POLICY",
            });
        }
        if !providers
            .iter()
            .any(|provider| provider.provider_id == fallback)
        {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: format!("fallback provider '{fallback}' is not registered"),
                code: "INVALID_FALLBACK_POLICY",
            });
        }
        fallback_providers.push(fallback.to_string());
    }

    let config = agenticos_contracts::FallbackConfig {
        primary_provider: provider_id.clone(),
        fallback_providers,
        auto_failover: request.auto_failover,
    };

    match state.provider.set_fallback_config(config.clone()).await {
        Ok(()) => HttpResponse::Ok().json(ProviderFallbackResponse {
            primary_provider: config.primary_provider,
            fallback_providers: config.fallback_providers,
            auto_failover: config.auto_failover,
        }),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PROVIDER_FALLBACK_UPDATE_FAILED",
        }),
    }
}

async fn register_provider(
    request: web::Json<RegisterProviderRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = request.provider_id.trim();
    if provider_id.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "provider_id must not be empty".to_string(),
            code: "INVALID_PROVIDER_ID",
        });
    }
    if request
        .api_key
        .as_ref()
        .is_some_and(|key| key.len() > 4_096)
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "api_key exceeds supported limits".to_string(),
            code: "PROVIDER_KEY_TOO_LARGE",
        });
    }
    let entry = agenticos_contracts::ProviderEntry {
        provider_id: provider_id.to_string(),
        name: request.name.trim().to_string(),
        base_url: request.base_url.trim().to_string(),
        models: request.models.clone(),
        capabilities: request.capabilities.clone(),
    };

    match state
        .provider
        .register(entry, request.api_key.clone())
        .await
    {
        Ok(()) => {
            let provider = state
                .provider
                .list_status()
                .await
                .into_iter()
                .find(|item| item.provider_id == provider_id);
            HttpResponse::Created().json(provider)
        }
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PROVIDER_REGISTRATION_FAILED",
        }),
    }
}

async fn delete_provider(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    match state.provider.unregister(&provider_id).await {
        Ok(true) => HttpResponse::NoContent().finish(),
        Ok(false) => HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        }),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "PROVIDER_DELETE_FAILED",
        }),
    }
}

async fn list_provider_models(
    provider_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = provider_id.into_inner();
    if state
        .provider
        .list_status()
        .await
        .iter()
        .all(|p| p.provider_id != provider_id)
    {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "provider not found".to_string(),
            code: "PROVIDER_NOT_FOUND",
        });
    }
    let models = state.provider.list_models_for_provider(&provider_id).await;
    HttpResponse::Ok().json(serde_json::json!({
        "provider_id": provider_id,
        "models": models,
        "count": models.len(),
    }))
}

async fn list_models(state: web::Data<RuntimeState>) -> impl Responder {
    let models = state.provider.list_models().await;
    HttpResponse::Ok().json(serde_json::json!({
        "models": models,
        "count": models.len()
    }))
}

async fn create_run(
    http_request: HttpRequest,
    request: web::Json<CreateRunRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let objective = request.objective.trim();
    if objective.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "objective must not be empty".to_string(),
            code: "INVALID_OBJECTIVE",
        });
    }
    let requested_run_id = request.run_id.clone();
    let run_id_text = requested_run_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let idempotency_key = http_request
        .headers()
        .get("idempotency-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let idempotency_storage_key = idempotency_key
        .as_ref()
        .map(|key| format!("run.create:{key}"));
    let idempotency_fingerprint = format!(
        "{}\0{objective}",
        requested_run_id.as_deref().unwrap_or("auto")
    );

    if let Some(storage_key) = &idempotency_storage_key {
        if storage_key.len() > 240 {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "Idempotency-Key exceeds supported limits".to_string(),
                code: "IDEMPOTENCY_KEY_TOO_LARGE",
            });
        }
        match state
            .idempotency
            .check_or_record(storage_key, &idempotency_fingerprint)
            .await
        {
            Ok(record) if record.status == agenticos_contracts::IdempotencyStatus::Completed => {
                if let Some(cached) = record.result {
                    if let Ok(response) = serde_json::from_str::<RunResponse>(&cached) {
                        return HttpResponse::Ok().json(response);
                    }
                }
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: "cached idempotent result is invalid".to_string(),
                    code: "IDEMPOTENCY_CACHE_INVALID",
                });
            }
            Ok(record)
                if record.status == agenticos_contracts::IdempotencyStatus::InProgress
                    && !record.owner =>
            {
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: "equivalent run creation is already in progress".to_string(),
                    code: "IDEMPOTENCY_IN_PROGRESS",
                });
            }
            Ok(_) => {}
            Err(ContractError::InvalidId) => {
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: "Idempotency-Key was already used for a different request".to_string(),
                    code: "IDEMPOTENCY_KEY_REUSED",
                });
            }
            Err(error) => {
                return HttpResponse::InternalServerError().json(ErrorResponse {
                    error: error.to_string(),
                    code: "IDEMPOTENCY_STORE_FAILED",
                });
            }
        }
    }
    let run_id = match RunId::new(run_id_text.clone()) {
        Ok(id) => id,
        Err(error) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "INVALID_RUN_ID",
            })
        }
    };

    match state.kernel.create_run(run_id.clone()).await {
        Ok(created_run) => {
            if let Err(error) = state
                .kernel
                .transition_run(&run_id, RunState::Admitted, created_run.version)
                .await
            {
                if let Some(key) = &idempotency_storage_key {
                    let _ = state.idempotency.mark_failed(key).await;
                }
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: error.to_string(),
                    code: "RUN_ADMISSION_FAILED",
                });
            }
            if let Err(error) = state
                .memory
                .store_message(
                    &format!("{}-objective", run_id.as_str()),
                    run_id.as_str(),
                    "objective",
                    objective,
                )
                .await
            {
                tracing::error!(
                    error = ?error,
                    run_id = %run_id.as_str(),
                    "failed to persist run objective"
                );
                if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
                    if let Err(transition_error) = state
                        .kernel
                        .transition_run(&run_id, RunState::Waiting, current.version)
                        .await
                    {
                        tracing::error!(
                            run_id = %run_id.as_str(),
                            %transition_error,
                            "failed to move run into waiting state after objective persistence failure"
                        );
                    } else if let Ok(waiting) = state.kernel.get_or_recover_run(&run_id).await {
                        let _ = state
                            .kernel
                            .transition_run(&run_id, RunState::Failed, waiting.version)
                            .await;
                    }
                }
                if let Some(key) = &idempotency_storage_key {
                    let _ = state.idempotency.mark_failed(key).await;
                }
                return HttpResponse::InternalServerError().json(ErrorResponse {
                    error: error.to_string(),
                    code: "RUN_OBJECTIVE_PERSIST_FAILED",
                });
            }

            if let Err(error) = state
                .scheduler
                .enqueue(JobSpec {
                    job_id: format!("job-{}", run_id.as_str()),
                    run_id: run_id.as_str().to_string(),
                    task: objective.to_string(),
                    dependencies: vec![],
                    priority: 100,
                    max_attempts: 3,

                    job_type: "agent".to_string(),

                    metadata: serde_json::json!({}),
                })
                .await
            {
                tracing::error!(
                    error = ?error,
                    run_id = %run_id.as_str(),
                    "failed to enqueue initial run job"
                );
                if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
                    if let Err(transition_error) = state
                        .kernel
                        .transition_run(&run_id, RunState::Waiting, current.version)
                        .await
                    {
                        tracing::error!(
                            run_id = %run_id.as_str(),
                            %transition_error,
                            "failed to move run into waiting state after scheduler failure"
                        );
                    } else if let Ok(waiting) = state.kernel.get_or_recover_run(&run_id).await {
                        let _ = state
                            .kernel
                            .transition_run(&run_id, RunState::Failed, waiting.version)
                            .await;
                    }
                }
                if let Some(key) = &idempotency_storage_key {
                    let _ = state.idempotency.mark_failed(key).await;
                }
                return HttpResponse::InternalServerError().json(ErrorResponse {
                    error,
                    code: "RUN_JOB_ENQUEUE_FAILED",
                });
            }

            let _ = state
                .audit
                .append(AuditEvent::new(
                    "run",
                    "create",
                    None,
                    format!("run/{}", run_id.as_str()),
                    Some(run_id.as_str().to_string()),
                    "success",
                    serde_json::json!({"objective_length": objective.len()}),
                ))
                .await;

            let current = state
                .kernel
                .get_or_recover_run(&run_id)
                .await
                .unwrap_or(created_run);

            HttpResponse::Created().json(RunResponse {
                run_id: run_id_text,
                state: format!("{:?}", current.state),
                version: current.version,
            })
        }
        Err(error) => {
            if let Some(key) = &idempotency_storage_key {
                let _ = state.idempotency.mark_failed(key).await;
            }
            HttpResponse::Conflict().json(ErrorResponse {
                error: error.to_string(),
                code: "RUN_CREATE_FAILED",
            })
        }
    }
}

async fn get_run(run_id: web::Path<String>, state: web::Data<RuntimeState>) -> impl Responder {
    let id = match RunId::new(run_id.into_inner()) {
        Ok(id) => id,
        Err(error) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "INVALID_RUN_ID",
            })
        }
    };
    match state.kernel.get_or_recover_run(&id).await {
        Ok(run) => HttpResponse::Ok().json(RunResponse {
            run_id: id.as_str().to_string(),
            state: format!("{:?}", run.state),
            version: run.version,
        }),
        Err(_) => HttpResponse::NotFound().json(ErrorResponse {
            error: "run not found".to_string(),
            code: "RUN_NOT_FOUND",
        }),
    }
}

async fn cancel_run(run_id: web::Path<String>, state: web::Data<RuntimeState>) -> impl Responder {
    let id = match RunId::new(run_id.into_inner()) {
        Ok(id) => id,
        Err(error) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "INVALID_RUN_ID",
            })
        }
    };
    if state.kernel.get_or_recover_run(&id).await.is_err() {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "run not found".to_string(),
            code: "RUN_NOT_FOUND",
        });
    }
    match state.kernel.cancel_run(&id).await {
        Ok(()) => {
            let _ = state
                .audit
                .append(AuditEvent::new(
                    "run",
                    "cancel",
                    None,
                    format!("run/{}", id.as_str()),
                    Some(id.as_str().to_string()),
                    "success",
                    serde_json::json!({"state":"Cancelling"}),
                ))
                .await;
            HttpResponse::Ok()
                .json(serde_json::json!({"run_id": id.as_str(), "state": "Cancelling"}))
        }
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error: error.to_string(),
            code: "RUN_CANCEL_FAILED",
        }),
    }
}

async fn snapshot_run(run_id: web::Path<String>, state: web::Data<RuntimeState>) -> impl Responder {
    let id = match RunId::new(run_id.into_inner()) {
        Ok(id) => id,
        Err(error) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
                code: "INVALID_RUN_ID",
            })
        }
    };
    if state.kernel.get_or_recover_run(&id).await.is_err() {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "run not found".to_string(),
            code: "RUN_NOT_FOUND",
        });
    }
    match state.kernel.create_snapshot(&id).await {
        Ok(snapshot) => HttpResponse::Ok().json(snapshot),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error: error.to_string(),
            code: "SNAPSHOT_FAILED",
        }),
    }
}

async fn create_agent(
    request: web::Json<CreateAgentRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.subagents.register(request.agent.clone()).await {
        Ok(()) => HttpResponse::Created().json(request.agent.clone()),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "AGENT_REGISTRATION_FAILED",
        }),
    }
}

async fn list_agents(state: web::Data<RuntimeState>) -> impl Responder {
    let agents = state.subagents.definitions().await;
    HttpResponse::Ok().json(serde_json::json!({"agents": agents, "count": agents.len()}))
}

async fn spawn_agent(
    path: web::Path<String>,
    request: web::Json<SpawnAgentRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let parent_run_id = path.into_inner();
    let objective = request.objective.trim();
    if objective.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "objective is required for a child agent".to_string(),
            code: "SUBAGENT_OBJECTIVE_REQUIRED",
        });
    }
    if objective.len() > 100_000 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "subagent objective exceeds supported limits".to_string(),
            code: "SUBAGENT_OBJECTIVE_TOO_LARGE",
        });
    }

    match state
        .kernel
        .get_or_recover_run(&match RunId::new(parent_run_id.clone()) {
            Ok(run_id) => run_id,
            Err(error) => {
                return HttpResponse::BadRequest().json(ErrorResponse {
                    error: error.to_string(),
                    code: "INVALID_PARENT_RUN_ID",
                })
            }
        })
        .await
    {
        Ok(run)
            if matches!(
                run.state,
                RunState::Completed | RunState::Failed | RunState::Cancelled
            ) =>
        {
            return HttpResponse::Conflict().json(ErrorResponse {
                error: format!("parent run is already terminal: {:?}", run.state),
                code: "SUBAGENT_PARENT_TERMINAL",
            });
        }
        Ok(_) => {}
        Err(error) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: error.to_string(),
                code: "SUBAGENT_PARENT_NOT_FOUND",
            });
        }
    }

    let child = match state
        .subagents
        .spawn_child(
            &parent_run_id,
            &request.agent_id,
            request.parent_depth.unwrap_or(0),
        )
        .await
    {
        Ok(child) => child,
        Err(error) => {
            return HttpResponse::Conflict().json(ErrorResponse {
                error,
                code: "SUBAGENT_SPAWN_FAILED",
            })
        }
    };

    let child_run_id = match RunId::new(child.child_run_id.clone()) {
        Ok(run_id) => run_id,
        Err(error) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: error.to_string(),
                code: "SUBAGENT_RUN_ID_INVALID",
            })
        }
    };

    let created = match state.kernel.create_run(child_run_id.clone()).await {
        Ok(run) => run,
        Err(error) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("child run creation failed: {error}"),
                code: "SUBAGENT_RUN_CREATE_FAILED",
            })
        }
    };

    if let Err(error) = state
        .kernel
        .transition_run(&child_run_id, RunState::Admitted, created.version)
        .await
    {
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("child run admission failed: {error}"),
            code: "SUBAGENT_RUN_ADMISSION_FAILED",
        });
    }

    let job_id = format!("subagent-job-{}", child.child_run_id);
    if let Err(error) = state
        .memory
        .store_message(
            &format!("{}-objective", child.child_run_id),
            &child.child_run_id,
            "objective",
            objective,
        )
        .await
    {
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("child objective persistence failed: {error}"),
            code: "SUBAGENT_OBJECTIVE_PERSIST_FAILED",
        });
    }

    if let Err(error) = state
        .scheduler
        .enqueue(JobSpec {
            job_id: job_id.clone(),
            run_id: child.child_run_id.clone(),
            task: objective.to_string(),
            dependencies: vec![],
            priority: 75,
            max_attempts: 2,
            job_type: "subagent".to_string(),
            metadata: serde_json::json!({
                "child_run_id": child.child_run_id,
                "agent_id": child.agent_id,
            }),
        })
        .await
    {
        if let Ok(run) = state.kernel.get_or_recover_run(&child_run_id).await {
            let _ = state
                .kernel
                .transition_run(&child_run_id, RunState::Failed, run.version)
                .await;
        }
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: format!("child job creation failed: {error}"),
            code: "SUBAGENT_JOB_CREATE_FAILED",
        });
    }

    HttpResponse::Created().json(serde_json::json!({
        "child": child,
        "run_id": child.child_run_id,
        "job_id": job_id,
        "state": "Admitted",
    }))
}

async fn list_children(
    run_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let children = state.subagents.children_of(&run_id).await;
    HttpResponse::Ok().json(serde_json::json!({
        "parent_run_id": run_id.into_inner(),
        "children": children,
    }))
}

async fn create_job(
    request: web::Json<CreateJobRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.scheduler.enqueue(request.job.clone()).await {
        Ok(()) => HttpResponse::Created().json(request.job.clone()),
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "JOB_CREATE_FAILED",
        }),
    }
}

async fn list_runs(state: web::Data<RuntimeState>) -> impl Responder {
    match state.kernel.list_runs().await {
        Ok(runs) => {
            let result: Vec<RunResponse> = runs
                .into_iter()
                .map(|run| RunResponse {
                    run_id: run.run_id.as_str().to_string(),
                    state: format!("{:?}", run.state),
                    version: run.version,
                })
                .collect();
            HttpResponse::Ok().json(serde_json::json!({
                "runs": result,
                "count": result.len(),
            }))
        }
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "RUN_LIST_FAILED",
        }),
    }
}

async fn get_job(job_id: web::Path<String>, state: web::Data<RuntimeState>) -> impl Responder {
    let job_id = job_id.into_inner();
    match state.scheduler.get(&job_id).await {
        Some(job) => HttpResponse::Ok().json(job),
        None => HttpResponse::NotFound().json(ErrorResponse {
            error: "job not found".to_string(),
            code: "JOB_NOT_FOUND",
        }),
    }
}

async fn list_ready_jobs(state: web::Data<RuntimeState>) -> impl Responder {
    let jobs = state.scheduler.next_ready(100).await;
    HttpResponse::Ok().json(serde_json::json!({
        "jobs": jobs,
        "count": jobs.len(),
    }))
}

async fn cancel_job(job_id: web::Path<String>, state: web::Data<RuntimeState>) -> impl Responder {
    let job_id = job_id.into_inner();
    match state.scheduler.cancel(&job_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "job_id": job_id,
            "state": "Cancelled",
        })),
        Err(error) => {
            if state.scheduler.get(&job_id).await.is_none() {
                HttpResponse::NotFound().json(ErrorResponse {
                    error: "job not found".to_string(),
                    code: "JOB_NOT_FOUND",
                })
            } else {
                HttpResponse::Conflict().json(ErrorResponse {
                    error,
                    code: "JOB_CANCEL_FAILED",
                })
            }
        }
    }
}

async fn list_jobs(state: web::Data<RuntimeState>) -> impl Responder {
    let jobs = state.scheduler.list().await;
    HttpResponse::Ok().json(serde_json::json!({"jobs": jobs, "count": jobs.len()}))
}

async fn create_workflow(
    request: web::Json<CreateWorkflowRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.workflows.register(request.workflow.clone()).await {
        Ok(()) => HttpResponse::Created().json(request.workflow.clone()),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error,
            code: "WORKFLOW_INVALID",
        }),
    }
}

async fn start_workflow(
    workflow_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.workflows.initial_state(&workflow_id).await {
        Ok(workflow_state) => {
            match schedule_workflow_ready_nodes(&state, &workflow_id, workflow_state).await {
                Ok(updated) => HttpResponse::Ok().json(updated),
                Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error,
                    code: "WORKFLOW_SCHEDULING_FAILED",
                }),
            }
        }
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "WORKFLOW_START_FAILED",
        }),
    }
}

async fn workflow_ready_nodes(
    workflow_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.workflows.initial_state(&workflow_id).await {
        Ok(workflow_state) => match state
            .workflows
            .ready_nodes(&workflow_id, &workflow_state)
            .await
        {
            Ok(nodes) => HttpResponse::Ok().json(serde_json::json!({
                "workflow_id": workflow_id.into_inner(),
                "nodes": nodes,
                "count": nodes.len(),
            })),
            Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error,
                code: "WORKFLOW_READY_QUERY_FAILED",
            }),
        },
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "WORKFLOW_NOT_FOUND",
        }),
    }
}

async fn transition_workflow_node(
    path: web::Path<(String, String)>,
    request: web::Json<WorkflowTransitionRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (workflow_id, node_id) = path.into_inner();
    let mut workflow_state = match state.workflows.initial_state(&workflow_id).await {
        Ok(value) => value,
        Err(error) => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error,
                code: "WORKFLOW_NOT_FOUND",
            })
        }
    };

    match state
        .workflows
        .transition_node(
            &workflow_id,
            &mut workflow_state,
            &node_id,
            request.state.clone(),
        )
        .await
    {
        Ok(()) => HttpResponse::Ok().json(workflow_state),
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "WORKFLOW_TRANSITION_REJECTED",
        }),
    }
}

async fn list_workflows(state: web::Data<RuntimeState>) -> impl Responder {
    let workflows = state.workflows.list().await;
    HttpResponse::Ok().json(serde_json::json!({"workflows": workflows, "count": workflows.len()}))
}

async fn workflow_state(
    workflow_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.workflows.initial_state(&workflow_id).await {
        Ok(workflow_state) => HttpResponse::Ok().json(workflow_state),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error,
            code: "WORKFLOW_NOT_FOUND",
        }),
    }
}

async fn create_plan(
    request: web::Json<PlanRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.reasoning.generate_plan(&request.objective).await {
        Ok(plan) => {
            let evaluation = state.reasoning.evaluate(&plan).await.ok();
            HttpResponse::Ok().json(serde_json::json!({
                "plan": plan,
                "evaluation": evaluation,
            }))
        }
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "PLAN_GENERATION_FAILED",
        }),
    }
}

async fn list_approvals(state: web::Data<RuntimeState>) -> impl Responder {
    let approvals: Vec<ApprovalRequest> = state.capabilities.pending_approvals().await;
    HttpResponse::Ok().json(serde_json::json!({"approvals": approvals, "count": approvals.len()}))
}

fn capability_type_for_action(action: &str) -> CapabilityType {
    let normalized = action.trim().to_ascii_lowercase();
    if normalized == "admin" || normalized.starts_with("admin.") || normalized.ends_with(".admin") {
        CapabilityType::Admin
    } else if normalized == "write"
        || normalized.starts_with("write.")
        || normalized.ends_with(".write")
        || normalized.ends_with(".patch")
        || normalized.ends_with(".delete")
        || normalized.ends_with(".close")
    {
        CapabilityType::Write
    } else if normalized == "read"
        || normalized.starts_with("read.")
        || normalized.ends_with(".read")
    {
        CapabilityType::Read
    } else {
        CapabilityType::Execute
    }
}

fn approval_grant_expiry(approval: &ApprovalRequest) -> u64 {
    let now = unix_time();
    if approval.expires_at == 0 {
        now.saturating_add(900)
    } else {
        approval.expires_at
    }
}

async fn create_approval(
    request: web::Json<CreateApprovalRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.run_id.trim().is_empty()
        || request.action.trim().is_empty()
        || request.resource.trim().is_empty()
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "run_id, action and resource are required".to_string(),
            code: "INVALID_APPROVAL",
        });
    }
    match state
        .capabilities
        .request_approval(
            request.run_id.clone(),
            request.action.clone(),
            request.resource.clone(),
            request.expires_at.unwrap_or(0),
        )
        .await
    {
        Ok(approval) => HttpResponse::Created().json(approval),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "APPROVAL_PERSIST_FAILED",
        }),
    }
}

async fn resolve_approval(
    approval_id: web::Path<String>,
    decision: web::Json<ApprovalDecision>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .capabilities
        .resolve_approval(&approval_id, decision.approved)
        .await
    {
        Ok(approval) if decision.approved => {
            let grant = CapabilityGrant {
                capability_type: capability_type_for_action(&approval.action),
                resource: approval.resource.clone(),
                permission: approval.action.clone(),
                expires_at: approval_grant_expiry(&approval),
                grant_id: format!("grant-{}", approval.approval_id),
            };
            match state.capabilities.issue(grant.clone()).await {
                Ok(grant_id) => HttpResponse::Ok().json(serde_json::json!({
                    "approval": approval,
                    "grant": grant,
                    "grant_id": grant_id,
                })),
                Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: error.to_string(),
                    code: "APPROVAL_GRANT_ISSUE_FAILED",
                }),
            }
        }
        Ok(approval) => HttpResponse::Ok().json(serde_json::json!({
            "approval": approval,
            "grant_id": null,
        })),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error: error.to_string(),
            code: "APPROVAL_NOT_FOUND",
        }),
    }
}

async fn list_memory(
    query: web::Query<MemorySearchQuery>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let namespace = query.namespace.trim();
    if namespace.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "namespace must not be empty".to_string(),
            code: "INVALID_MEMORY_NAMESPACE",
        });
    }

    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let result = match query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(search) => {
            state
                .persistent_memory
                .search(namespace, search, limit)
                .await
        }
        None => state.persistent_memory.list(namespace, limit).await,
    };

    match result {
        Ok(records) => HttpResponse::Ok().json(serde_json::json!({
            "namespace": namespace,
            "records": records,
            "count": records.len(),
        })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_QUERY_FAILED",
        }),
    }
}

async fn upsert_memory(
    request: web::Json<CreateMemoryRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let namespace = request.namespace.trim();
    let key = request.key.trim();
    if namespace.is_empty() || key.is_empty() || request.value.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "namespace, key and value are required".to_string(),
            code: "INVALID_MEMORY",
        });
    }
    if namespace.len() > 256 || key.len() > 512 || request.value.len() > 1_000_000 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "memory field exceeds supported limits".to_string(),
            code: "MEMORY_TOO_LARGE",
        });
    }
    if request.tags.as_ref().is_some_and(|tags| tags.len() > 64) {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "too many memory tags".to_string(),
            code: "MEMORY_TAG_LIMIT",
        });
    }
    if request
        .importance
        .is_some_and(|importance| !importance.is_finite())
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "importance must be a finite number".to_string(),
            code: "INVALID_MEMORY_IMPORTANCE",
        });
    }
    if request.expires_at.is_some_and(|expires_at| expires_at < 0) {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "expires_at must not be negative".to_string(),
            code: "INVALID_MEMORY_EXPIRY",
        });
    }

    match state
        .persistent_memory
        .upsert(
            namespace,
            key,
            &request.value,
            request.tags.as_deref().unwrap_or(&[]),
            request.importance.unwrap_or(0.5),
            request.expires_at.unwrap_or(0),
        )
        .await
    {
        Ok(record) => HttpResponse::Ok().json(record),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_WRITE_FAILED",
        }),
    }
}

async fn delete_memory(
    path: web::Path<(String, String)>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let (namespace, key) = path.into_inner();
    match state.persistent_memory.delete(&namespace, &key).await {
        Ok(true) => HttpResponse::NoContent().finish(),
        Ok(false) => HttpResponse::NotFound().json(ErrorResponse {
            error: "memory record not found".to_string(),
            code: "MEMORY_NOT_FOUND",
        }),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_DELETE_FAILED",
        }),
    }
}

async fn purge_memory(state: web::Data<RuntimeState>) -> impl Responder {
    match state.persistent_memory.purge_expired().await {
        Ok(removed) => HttpResponse::Ok().json(serde_json::json!({ "removed": removed })),
        Err(error) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: error.to_string(),
            code: "MEMORY_PURGE_FAILED",
        }),
    }
}

async fn list_capabilities(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "grants": state.capabilities.list_grants().await,
    }))
}

async fn issue_capability(
    request: web::Json<CreateCapabilityRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let capability_type = match request.capability_type.trim().to_ascii_lowercase().as_str() {
        "read" => CapabilityType::Read,
        "write" => CapabilityType::Write,
        "execute" => CapabilityType::Execute,
        "admin" => CapabilityType::Admin,
        _ => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "capability_type must be read, write, execute or admin".to_string(),
                code: "INVALID_CAPABILITY_TYPE",
            });
        }
    };

    let resource = request.resource.trim();
    let permission = request.permission.trim();
    let grant_id = request.grant_id.trim();
    if resource.is_empty() || permission.is_empty() || grant_id.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "resource, permission and grant_id are required".to_string(),
            code: "INVALID_CAPABILITY",
        });
    }
    if grant_id.len() > 256 || resource.len() > 512 || permission.len() > 128 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "capability fields exceed supported limits".to_string(),
            code: "CAPABILITY_TOO_LARGE",
        });
    }

    let expires_at = request.expires_at.unwrap_or(0);
    if expires_at != 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        if expires_at <= now {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "expires_at must be in the future".to_string(),
                code: "INVALID_CAPABILITY_EXPIRY",
            });
        }
    }

    let grant = CapabilityGrant {
        capability_type,
        resource: resource.to_string(),
        permission: permission.to_string(),
        expires_at,
        grant_id: grant_id.to_string(),
    };

    match state.capabilities.issue(grant.clone()).await {
        Ok(grant_id) => HttpResponse::Created().json(serde_json::json!({
            "grant_id": grant_id,
            "capability_type": format!("{:?}", grant.capability_type),
            "resource": grant.resource,
            "permission": grant.permission,
            "expires_at": grant.expires_at,
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
                error: error.to_string(),
            code: "CAPABILITY_ISSUE_FAILED",
        }),
    }
}

async fn revoke_capability(
    grant_id: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state.capabilities.revoke(&grant_id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(error) => HttpResponse::NotFound().json(ErrorResponse {
            error: error.to_string(),
            code: "CAPABILITY_NOT_FOUND",
        }),
    }
}

async fn execute_tool(
    request: web::Json<ToolExecutionRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.command.trim().is_empty() || request.session_id.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "session_id and command are required".to_string(),
            code: "INVALID_TOOL_REQUEST",
        });
    }

    match state
        .secure_tools
        .execute_command(
            request.session_id.trim(),
            request.user_id.as_deref(),
            request.grant_id.trim(),
            request.command.trim(),
            request.timeout_ms,
        )
        .await
    {
        Ok(result) if result.success => HttpResponse::Ok().json(result),
        Ok(result) => HttpResponse::BadRequest().json(result),
        Err(error) => HttpResponse::Forbidden().json(ErrorResponse {
            error: error.to_string(),
            code: "TOOL_EXECUTION_DENIED",
        }),
    }
}

async fn worker_claim(
    request: web::Json<WorkerClaimRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let worker_id = request.worker_id.trim();
    if worker_id.is_empty() || worker_id.len() > 256 {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "worker_id must be 1..=256 characters".to_string(),
            code: "WORKER_ID_INVALID",
        });
    }

    let ready = state.scheduler.next_ready(8).await;
    for job in ready {
        match state
            .scheduler
            .start_as(
                &job.spec.job_id,
                worker_id.to_string(),
                request.lease_seconds.unwrap_or(120).clamp(5, 3_600),
            )
            .await
        {
            Ok(claimed) => {
                return HttpResponse::Ok().json(serde_json::json!({
                    "job": claimed,
                    "worker_id": worker_id,
                }))
            }
            Err(_) => continue,
        }
    }

    HttpResponse::NoContent().finish()
}

async fn worker_heartbeat(
    path: web::Path<String>,
    request: web::Json<WorkerHeartbeatRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    match state
        .scheduler
        .renew_as(
            &path,
            request.worker_id.trim(),
            request.lease_token,
            request.lease_seconds.unwrap_or(120).clamp(5, 3_600),
        )
        .await
    {
        Ok(job) => HttpResponse::Ok().json(job),
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "WORKER_LEASE_RENEW_FAILED",
        }),
    }
}

async fn worker_complete(
    path: web::Path<String>,
    request: web::Json<WorkerCompletionRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.worker_id.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
                error: "worker_id is required".to_string(),
            code: "WORKER_ID_INVALID",
        });
    }

    let job = match state.scheduler.get(&path).await {
        Some(job) => job,
        None => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "job not found".to_string(),
                code: "WORKER_JOB_NOT_FOUND",
            })
        }
    };

    if let Some(output) = request.output.as_deref() {
        if output.len() > 8 * 1024 * 1024 {
            return HttpResponse::PayloadTooLarge().json(ErrorResponse {
                error: "worker output exceeds supported limits".to_string(),
                code: "WORKER_OUTPUT_TOO_LARGE",
            });
        }
    }

    if let Err(error) = state
        .scheduler
        .complete_as(
            &path,
            Some(request.worker_id.trim()),
            Some(request.lease_token),
            request.success,
            request.error.clone(),
        )
        .await
    {
        return HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "WORKER_COMPLETION_REJECTED",
        });
    }

    if job.spec.job_type == "workflow_node" {
        let workflow_id = job
            .spec
            .metadata
            .get("workflow_id")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        let node_id = job
            .spec
            .metadata
            .get("node_id")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        if !workflow_id.is_empty() && !node_id.is_empty() {
            if let Ok(mut workflow_state) = state.workflows.initial_state(workflow_id).await {
                if workflow_state.nodes.get(node_id) == Some(&WorkflowNodeState::Ready) {
                    let _ = state
                        .workflows
                        .transition_node(
                            workflow_id,
                            &mut workflow_state,
                            node_id,
                            WorkflowNodeState::Running,
                        )
                        .await;
                }
                let final_attempt = request.success || job.attempts >= job.spec.max_attempts.max(1);
                if request.success {
                    let _ = state
                        .workflows
                        .transition_node(
                            workflow_id,
                            &mut workflow_state,
                            node_id,
                            WorkflowNodeState::Succeeded,
                        )
                        .await;
                    let _ =
                        schedule_workflow_ready_nodes(&state, workflow_id, workflow_state).await;
                } else if final_attempt {
                    let _ = state
                        .workflows
                        .transition_node(
                            workflow_id,
                            &mut workflow_state,
                            node_id,
                            WorkflowNodeState::Failed,
                        )
                        .await;
                }
            }
        }
    } else if job.spec.job_type == "subagent" {
        let child_run_id = job
            .spec
            .metadata
            .get("child_run_id")
            .and_then(|value| value.as_str())
            .unwrap_or(job.spec.run_id.as_str());
        if let Ok(child_run_id) = RunId::new(child_run_id.to_string()) {
            if let Ok(current) = state.kernel.get_or_recover_run(&child_run_id).await {
                let final_attempt = request.success || job.attempts >= job.spec.max_attempts.max(1);
                if request.success && current.state == RunState::Admitted {
                    let _ = state
                        .kernel
                        .transition_run(&child_run_id, RunState::Running, current.version)
                        .await;
                } else if !request.success && !final_attempt && current.state == RunState::Running {
                    let _ = state
                        .kernel
                        .transition_run(&child_run_id, RunState::Waiting, current.version)
                        .await;
                }
                if final_attempt {
                    if let Ok(current) = state.kernel.get_or_recover_run(&child_run_id).await {
                        let _ = state
                            .kernel
                            .transition_run(
                                &child_run_id,
                                if request.success {
                                    RunState::Completed
                                } else {
                                    RunState::Failed
                                },
                                current.version,
                            )
                            .await;
                    }
                }
            }
        }
    }

    let Ok(run_id) = RunId::new(job.spec.run_id.clone()) else {
        return HttpResponse::InternalServerError().json(ErrorResponse {
            error: "job run_id is invalid".to_string(),
            code: "WORKER_RUN_ID_INVALID",
        });
    };

    if let Ok(run) = state.kernel.get_or_recover_run(&run_id).await {
        let related_jobs = state
            .scheduler
            .list()
            .await
            .into_iter()
            .filter(|candidate| candidate.spec.run_id == job.spec.run_id)
            .collect::<Vec<_>>();

        let any_failed = related_jobs
            .iter()
            .any(|candidate| candidate.state == JobState::Failed);
        let any_active = related_jobs.iter().any(|candidate| {
            matches!(
                candidate.state,
                JobState::Pending | JobState::Ready | JobState::Running
            )
        });
        let all_succeeded = !related_jobs.is_empty()
            && related_jobs
                .iter()
                .all(|candidate| candidate.state == JobState::Succeeded);

        let target = if any_failed {
            RunState::Failed
        } else if all_succeeded {
            RunState::Completed
        } else if any_active {
            RunState::Waiting
        } else if !request.success && job.attempts >= job.spec.max_attempts.max(1) {
            RunState::Failed
        } else {
            RunState::Waiting
        };

        if matches!(
            run.state,
            RunState::Running | RunState::Waiting | RunState::Admitted
        ) && target != run.state
        {
            let _ = state
                .kernel
                .transition_run(&run_id, target, run.version)
                .await;
        }
    }

    if let Some(output) = request.output.as_deref().filter(|value| !value.is_empty()) {
        let _ = state
            .memory
            .store_message(
                &format!("{}-remote-result", job.spec.run_id),
                &job.spec.run_id,
                "assistant",
                output,
            )
            .await;
    }

    state.metrics.record_scheduler_completion(request.success);
    HttpResponse::Ok().json(serde_json::json!({
        "job_id": path.into_inner(),
        "success": request.success,
        "run_id": job.spec.run_id,
    }))
}

fn workflow_job_id(workflow_id: &str, node_id: &str) -> String {
    fn compact(value: &str, limit: usize) -> String {
        let mut result = value
            .chars()
            .map(|ch| {
                if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                    ch
                } else {
                    '-'
                }
            })
            .collect::<String>();
        result.truncate(limit);
        if result.is_empty() {
            result.push_str("item");
        }
        result
    }
    format!(
        "workflow-job-{}-{}",
        compact(workflow_id, 40),
        compact(node_id, 40)
    )
}

async fn schedule_workflow_ready_nodes(
    state: &RuntimeState,
    workflow_id: &str,
    mut workflow_state: WorkflowState,
) -> Result<WorkflowState, String> {
    let ready_nodes = state
        .workflows
        .ready_nodes(workflow_id, &workflow_state)
        .await?;
    for node in ready_nodes {
        let mut next_state = workflow_state.clone();
        state
            .workflows
            .transition_node(
                workflow_id,
                &mut next_state,
                &node.id,
                WorkflowNodeState::Ready,
            )
            .await?;
        workflow_state = next_state;

        let job_id = workflow_job_id(workflow_id, &node.id);
        if state.scheduler.get(&job_id).await.is_some() {
            continue;
        }

        let run_id = RunId::new(format!("workflow-node-{}", uuid::Uuid::new_v4()))
            .map_err(|error| error.to_string())?;
        let created = state
            .kernel
            .create_run(run_id.clone())
            .await
            .map_err(|error| error.to_string())?;
        state
            .kernel
            .transition_run(&run_id, RunState::Admitted, created.version)
            .await
            .map_err(|error| error.to_string())?;
        state
            .memory
            .store_message(
                &format!("{}-objective", run_id.as_str()),
                run_id.as_str(),
                "objective",
                &node.task,
            )
            .await
            .map_err(|error| error.to_string())?;

        state
            .scheduler
            .enqueue(JobSpec {
                job_id,
                run_id: run_id.as_str().to_string(),
                task: node.task,
                dependencies: vec![],
                priority: 80,
                max_attempts: 2,
                job_type: "workflow_node".to_string(),
                metadata: serde_json::json!({
                    "workflow_id": workflow_id,
                    "node_id": node.id,
                    "run_id": run_id.as_str(),
                }),
            })
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(workflow_state)
}

async fn execute_workflow_job(state: RuntimeState, _worker_id: String, started_job: JobRecord) {
    let workflow_id = started_job
        .spec
        .metadata
        .get("workflow_id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let node_id = started_job
        .spec
        .metadata
        .get("node_id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    if workflow_id.is_empty() || node_id.is_empty() {
        let _ = state
            .scheduler
            .complete_as(
                &started_job.spec.job_id,
                started_job.lease_owner.as_deref(),
                Some(started_job.lease_token),
                false,
                Some("workflow job metadata is incomplete".to_string()),
            )
            .await;
        return;
    }

    let mut workflow_state = match state.workflows.initial_state(&workflow_id).await {
        Ok(value) => value,
        Err(error) => {
            let _ = state
                .scheduler
                .complete_as(
                    &started_job.spec.job_id,
                    started_job.lease_owner.as_deref(),
                    Some(started_job.lease_token),
                    false,
                    Some(error),
                )
                .await;
            return;
        }
    };

    if matches!(
        workflow_state.nodes.get(&node_id),
        Some(WorkflowNodeState::Ready)
    ) {
        if state
            .workflows
            .transition_node(
                &workflow_id,
                &mut workflow_state,
                &node_id,
                WorkflowNodeState::Running,
            )
            .await
            .is_err()
        {
            let _ = state
                .scheduler
                .complete_as(
                    &started_job.spec.job_id,
                    started_job.lease_owner.as_deref(),
                    Some(started_job.lease_token),
                    false,
                    Some("workflow node could not enter running state".to_string()),
                )
                .await;
            return;
        }
    }

    let session_id = format!("workflow:{workflow_id}:{node_id}");
    let agent = state.session_agent(&session_id, None).await;
    let result = agent.execute_turn(&started_job.spec.task).await;
    let success = result.is_ok();
    let final_attempt = success || started_job.attempts >= started_job.spec.max_attempts.max(1);

    let final_state = match state.workflows.initial_state(&workflow_id).await {
        Ok(value) => value,
        Err(_) => workflow_state,
    };
    let mut mutable_state = final_state;
    let node_transition = if success {
        state
            .workflows
            .transition_node(
                &workflow_id,
                &mut mutable_state,
                &node_id,
                WorkflowNodeState::Succeeded,
            )
            .await
    } else if final_attempt {
        state
            .workflows
            .transition_node(
                &workflow_id,
                &mut mutable_state,
                &node_id,
                WorkflowNodeState::Failed,
            )
            .await
    } else {
        Ok(())
    };

    if node_transition.is_ok() && success {
        let _ = schedule_workflow_ready_nodes(&state, &workflow_id, mutable_state).await;
    }

    let run_id = started_job
        .spec
        .metadata
        .get("run_id")
        .and_then(|value| value.as_str())
        .and_then(|value| RunId::new(value.to_string()).ok());
    if let Some(run_id) = run_id {
        if let Ok(run) = state.kernel.get_or_recover_run(&run_id).await {
            let final_attempt =
                success || started_job.attempts >= started_job.spec.max_attempts.max(1);
            if success && run.state == RunState::Admitted {
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Running, run.version)
                    .await;
            } else if !success && !final_attempt && run.state == RunState::Admitted {
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Running, run.version)
                    .await;
            }
            if final_attempt {
                if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
                    let _ = state
                        .kernel
                        .transition_run(
                            &run_id,
                            if success {
                                RunState::Completed
                            } else {
                                RunState::Failed
                            },
                            current.version,
                        )
                        .await;
                }
            } else if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
                if current.state == RunState::Running {
                    let _ = state
                        .kernel
                        .transition_run(&run_id, RunState::Waiting, current.version)
                        .await;
                }
            }
        }
    }

    let _ = state
        .scheduler
        .complete_as(
            &started_job.spec.job_id,
            started_job.lease_owner.as_deref(),
            Some(started_job.lease_token),
            success,
            result.err().map(|error| error.to_string()),
        )
        .await;
    state.metrics.record_scheduler_completion(success);
}

async fn execute_subagent_job(state: RuntimeState, _worker_id: String, started_job: JobRecord) {
    let child_run_id = started_job
        .spec
        .metadata
        .get("child_run_id")
        .and_then(|value| value.as_str())
        .unwrap_or(started_job.spec.run_id.as_str());

    let child = match state.subagents.child(child_run_id).await {
        Some(value) => value,
        None => {
            let _ = state
                .scheduler
                .complete_as(
                    &started_job.spec.job_id,
                    started_job.lease_owner.as_deref(),
                    Some(started_job.lease_token),
                    false,
                    Some("persisted subagent child metadata was not found".to_string()),
                )
                .await;
            return;
        }
    };
    let definition = state.subagents.definition(&child.agent_id).await;
    let session_id = format!("subagent:{}", child.child_run_id);
    let agent = state
        .session_agent_with_definition(&session_id, None, definition.as_ref())
        .await;
    let parameters = RuntimeState::agent_execution_parameters(definition.as_ref());
    let timeout_seconds = definition
        .as_ref()
        .map(|value| value.budget.max_wall_seconds.max(1))
        .unwrap_or(1800)
        .clamp(1, 86_400);

    let execution = agent.execute_turn_with_parameters(&started_job.spec.task, parameters);
    let result = match tokio::time::timeout(
        std::time::Duration::from_secs(timeout_seconds),
        execution,
    )
    .await
    {
        Ok(result) => result,
        Err(_) => Err(ContractError::ParseError(format!(
            "subagent exceeded wall-clock budget of {timeout_seconds}s"
        ))),
    };

    let success = result.is_ok();
    let final_attempt = success || started_job.attempts >= started_job.spec.max_attempts.max(1);
    let run_id = RunId::new(child.child_run_id.clone()).ok();
    if let Some(run_id) = run_id {
        if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
            if success && current.state == RunState::Admitted {
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Running, current.version)
                    .await;
            } else if !success && !final_attempt && current.state == RunState::Running {
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Waiting, current.version)
                    .await;
            }
            if final_attempt {
                if let Ok(current) = state.kernel.get_or_recover_run(&run_id).await {
                    let _ = state
                        .kernel
                        .transition_run(
                            &run_id,
                            if success {
                                RunState::Completed
                            } else {
                                RunState::Failed
                            },
                            current.version,
                        )
                        .await;
                }
            }
        }
    }

    let _ = state
        .scheduler
        .complete_as(
            &started_job.spec.job_id,
            started_job.lease_owner.as_deref(),
            Some(started_job.lease_token),
            success,
            result.err().map(|error| error.to_string()),
        )
        .await;
    state.metrics.record_scheduler_completion(success);
}

async fn scheduler_worker(state: RuntimeState) {
    let worker_id = format!("scheduler-worker-{}", uuid::Uuid::new_v4());
    let concurrency = std::env::var("AGENTICOS_WORKER_CONCURRENCY")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(4)
        .clamp(1, 32);
    let semaphore = Arc::new(tokio::sync::Semaphore::new(concurrency));

    loop {
        let ready_jobs = state.scheduler.next_ready(concurrency * 2).await;
        if ready_jobs.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            continue;
        }

        for queued_job in ready_jobs {
            let permit = match semaphore.clone().try_acquire_owned() {
                Ok(permit) => permit,
                Err(_) => {
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    break;
                }
            };

            let state = state.clone();
            let worker_id = worker_id.clone();
            tokio::spawn(async move {
                let _permit = permit;
                execute_scheduled_job(state, worker_id, queued_job).await;
            });
        }
    }
}

async fn execute_scheduled_job(state: RuntimeState, worker_id: String, queued_job: JobRecord) {
    let started_job = match state
        .scheduler
        .start_as(&queued_job.spec.job_id, worker_id.clone(), 120)
        .await
    {
        Ok(job) => {
            state.metrics.record_scheduler_claim();
            job
        }
        Err(error) => {
            tracing::warn!(job_id = %queued_job.spec.job_id, %error, "scheduler failed to claim job");
            return;
        }
    };

    if started_job.state == JobState::Failed {
        tracing::warn!(
            job_id = %started_job.spec.job_id,
            "scheduler rejected execution because the job exhausted its attempts"
        );
        return;
    }

    match started_job.spec.job_type.as_str() {
        "workflow_node" => {
            execute_workflow_job(state, worker_id, started_job).await;
            return;
        }
        "subagent" => {
            execute_subagent_job(state, worker_id, started_job).await;
            return;
        }
        _ => {}
    }

    let run_id = RunId::new(started_job.spec.run_id.clone()).ok();
    if let Some(run_id) = run_id.clone() {
        let run = match state.kernel.get_or_recover_run(&run_id).await {
            Ok(run) => run,
            Err(error) => {
                let _ = state
                    .scheduler
                    .complete(
                        &started_job.spec.job_id,
                        false,
                        Some(format!("run recovery failed: {error}")),
                    )
                    .await;
                return;
            }
        };

        match run.state {
            RunState::Cancelling | RunState::Cancelled => {
                let _ = state.scheduler.cancel(&started_job.spec.job_id).await;
                if run.state == RunState::Cancelling {
                    let _ = state
                        .kernel
                        .transition_run(&run_id, RunState::Cancelled, run.version)
                        .await;
                }
                return;
            }
            RunState::Admitted | RunState::Waiting => {
                if let Err(error) = state
                    .kernel
                    .transition_run(&run_id, RunState::Running, run.version)
                    .await
                {
                    let _ = state
                        .scheduler
                        .complete_as(
                            &started_job.spec.job_id,
                            started_job.lease_owner.as_deref(),
                            Some(started_job.lease_token),
                            false,
                            Some(error.to_string()),
                        )
                        .await;
                    return;
                }
            }
            RunState::Created => {
                let _ = state
                    .scheduler
                    .complete(
                        &started_job.spec.job_id,
                        false,
                        Some(format!(
                            "run {} is not executable in state {:?}",
                            run_id.as_str(),
                            run.state
                        )),
                    )
                    .await;
                return;
            }
            RunState::Running => {}
            RunState::Completed | RunState::Failed => {
                let _ = state
                    .scheduler
                    .complete(
                        &started_job.spec.job_id,
                        true,
                        Some("run already reached terminal state".to_string()),
                    )
                    .await;
                return;
            }
        }
    }

    let session_id = format!("run:{}", started_job.spec.run_id);
    let agent = state.session_agent(&session_id, None).await;

    // Keep the worker lease alive while a model/tool turn is running.
    let heartbeat_scheduler = state.scheduler.clone();
    let heartbeat_job_id = started_job.spec.job_id.clone();
    let heartbeat_owner = started_job
        .lease_owner
        .clone()
        .unwrap_or_else(|| worker_id.clone());
    let heartbeat_token = started_job.lease_token;
    let heartbeat = tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            match heartbeat_scheduler
                .renew_as(&heartbeat_job_id, &heartbeat_owner, heartbeat_token, 120)
                .await
            {
                Ok(_) => {}
                Err(error) => {
                    tracing::warn!(
                        job_id = %heartbeat_job_id,
                        %error,
                        "scheduler lease heartbeat failed"
                    );
                    break;
                }
            }
        }
    });

    let execution_result = agent.execute_turn(&started_job.spec.task).await;
    heartbeat.abort();

    match execution_result {
        Ok(response) => {
            if let Some(run_id) = run_id {
                if let Ok(run) = state.kernel.get_or_recover_run(&run_id).await {
                    let transition = match run.state {
                        RunState::Cancelling => {
                            state
                                .kernel
                                .transition_run(&run_id, RunState::Cancelled, run.version)
                                .await
                        }
                        RunState::Running => {
                            state
                                .kernel
                                .transition_run(&run_id, RunState::Completed, run.version)
                                .await
                        }
                        _ => Ok(()),
                    };
                    if let Err(error) = transition {
                        tracing::error!(run_id = %run_id.as_str(), %error, "failed to finalize run after successful execution");
                    }
                }
            }
            if let Err(error) = state
                .memory
                .store_message(
                    &format!("{}-result", started_job.spec.run_id),
                    &started_job.spec.run_id,
                    "assistant",
                    &response,
                )
                .await
            {
                tracing::warn!(job_id = %started_job.spec.job_id, %error, "failed to persist execution result");
            }
            let completion = state
                .scheduler
                .complete_as(
                    &started_job.spec.job_id,
                    started_job.lease_owner.as_deref(),
                    Some(started_job.lease_token),
                    true,
                    None,
                )
                .await;
            state
                .metrics
                .record_scheduler_completion(completion.is_ok());
        }
        Err(error) => {
            let final_attempt = started_job.attempts >= started_job.spec.max_attempts.max(1);
            if let Some(run_id) = run_id {
                if let Ok(run) = state.kernel.get_or_recover_run(&run_id).await {
                    if final_attempt && run.state == RunState::Running {
                        if let Err(transition_error) = state
                            .kernel
                            .transition_run(&run_id, RunState::Failed, run.version)
                            .await
                        {
                            tracing::error!(
                                run_id = %run_id.as_str(),
                                %transition_error,
                                "failed to mark run as failed"
                            );
                        }
                    } else if !final_attempt && run.state == RunState::Running {
                        if let Err(transition_error) = state
                            .kernel
                            .transition_run(&run_id, RunState::Waiting, run.version)
                            .await
                        {
                            tracing::error!(
                                run_id = %run_id.as_str(),
                                %transition_error,
                                "failed to return run to waiting state for retry"
                            );
                        }
                    }
                }
            }
            tracing::error!(job_id = %started_job.spec.job_id, %error, final_attempt, "agent execution failed");
            let completion = state
                .scheduler
                .complete_as(
                    &started_job.spec.job_id,
                    started_job.lease_owner.as_deref(),
                    Some(started_job.lease_token),
                    false,
                    Some(error.to_string()),
                )
                .await;
            state
                .metrics
                .record_scheduler_completion(completion.is_ok() && final_attempt);
        }
    }
}

async fn sandbox_status(state: web::Data<RuntimeState>) -> impl Responder {
    let available = state.sandbox.is_available().await.unwrap_or(false);
    let status: SandboxStatus = state
        .sandbox
        .get_status()
        .await
        .unwrap_or(SandboxStatus::Unavailable);
    HttpResponse::Ok().json(serde_json::json!({
        "available": available,
        "status": format!("{status:?}"),
        "policy": SandboxPolicy::default(),
        "execution": "capability-gated local process boundary"
    }))
}

fn bearer_token(request: &HttpRequest) -> Option<&str> {
    request
        .headers()
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

#[derive(Clone, Debug)]
struct AuthConfig {
    token: Option<String>,
}

async fn request_id_middleware(
    mut req: ServiceRequest,
    next: Next<impl actix_web::body::MessageBody + 'static>,
) -> Result<actix_web::dev::ServiceResponse<impl actix_web::body::MessageBody>, Error> {
    let request_id = req
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| {
            !value.is_empty()
                && value.len() <= 128
                && value
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte))
        })
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    req.extensions_mut().insert(request_id.clone());
    let span = tracing::info_span!("http_request", request_id = %request_id);
    let mut response = next.call(req).instrument(span).await?;

    let header_value = actix_web::http::header::HeaderValue::from_str(&request_id)
        .map_err(|error| actix_web::error::ErrorInternalServerError(error.to_string()))?;
    response.headers_mut().insert(
        actix_web::http::header::HeaderName::from_static("x-request-id"),
        header_value,
    );

    Ok(response)
}

async fn api_auth_middleware(
    config: web::Data<AuthConfig>,
    req: ServiceRequest,
    next: Next<impl actix_web::body::MessageBody + 'static>,
) -> Result<actix_web::dev::ServiceResponse<impl actix_web::body::MessageBody>, Error> {
    let authorized = req.path() == "/health"
        || config
            .token
            .as_deref()
            .is_none_or(|token| bearer_token(req.request()).is_some_and(|value| value == token));

    if !authorized {
        return Ok(req.into_response(
            HttpResponse::Unauthorized()
                .json(serde_json::json!({
                    "error": "authentication required",
                    "code": "AUTHENTICATION_REQUIRED"
                }))
                .map_into_left_body(),
        ));
    }

    Ok(next.call(req).await?.map_into_right_body())
}

pub async fn run_server(state: RuntimeState) -> std::io::Result<()> {
    let host = std::env::var("AGENTICOS_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let is_loopback = matches!(host.as_str(), "127.0.0.1" | "localhost" | "::1" | "[::1]");
    let remote_opt_in = std::env::var("AGENTICOS_ALLOW_REMOTE")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !is_loopback && !remote_opt_in {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "refusing non-loopback bind without AGENTICOS_ALLOW_REMOTE=true",
        ));
    }
    if !is_loopback {
        tracing::warn!(host = %host, "AgentiCOS API server is running on a non-loopback interface");
    }

    let api_token = if is_loopback {
        None
    } else {
        let token = std::env::var("AGENTICOS_API_TOKEN")
            .ok()
            .filter(|value| !value.trim().is_empty());
        if token.is_none() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "remote bind requires AGENTICOS_API_TOKEN",
            ));
        }
        token
    };

    let port = std::env::var("AGENTICOS_BIND_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let worker_state = state.clone();
    tokio::spawn(async move {
        scheduler_worker(worker_state).await;
    });

    let data = web::Data::new(state);
    let cors_origins: Vec<String> = std::env::var("AGENTICOS_CORS_ORIGINS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(ToOwned::to_owned)
        .collect();

    if !is_loopback && cors_origins.is_empty() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "remote bind requires AGENTICOS_CORS_ORIGINS",
        ));
    }

    HttpServer::new(move || {
        let cors = if is_loopback {
            Cors::permissive()
        } else {
            let mut cors = Cors::default();
            for origin in &cors_origins {
                cors = cors.allowed_origin(origin);
            }
            cors
        };

        let auth_config = AuthConfig {
            token: api_token.clone(),
        };

        App::new()
            .wrap(cors)
            .wrap(from_fn(request_id_middleware))
            .app_data(web::JsonConfig::default().limit(8 * 1024 * 1024))
            .app_data(data.clone())
            .app_data(web::Data::new(auth_config))
            .wrap(from_fn(api_auth_middleware))
            .route("/health", web::get().to(health_check))
            .route(
                "/.well-known/agent-card.json",
                web::get().to(a2a_agent_card),
            )
            .route("/a2a", web::post().to(a2a_rpc))
            .route("/ready", web::get().to(readiness_check))
            .route("/api/workers/claim", web::post().to(worker_claim))
            .route(
                "/api/workers/jobs/{job_id}/heartbeat",
                web::post().to(worker_heartbeat),
            )
            .route(
                "/api/workers/jobs/{job_id}/complete",
                web::post().to(worker_complete),
            )
            .route("/api/metrics", web::get().to(runtime_metrics))
            .route("/api/skills", web::get().to(list_skills))
            .route("/api/usage/summary", web::get().to(usage_summary))
            .route("/api/usage/records", web::get().to(usage_records))
            .route("/api/usage/pricing", web::post().to(set_usage_pricing))
            .route(
                "/api/source/github/inspect",
                web::post().to(inspect_github_repository),
            )
            .route(
                "/api/source/github/analyze",
                web::post().to(analyze_github_repository),
            )
            .route(
                "/api/source/github/{owner}/{repo}/file",
                web::get().to(fetch_github_source_file),
            )
            .route(
                "/api/source/github/{owner}/{repo}/file",
                web::post().to(write_github_source_file),
            )
            .route("/api/browser/status", web::get().to(browser_status))
            .route(
                "/api/browser/{session_id}/open",
                web::post().to(browser_open),
            )
            .route(
                "/api/browser/{session_id}/snapshot",
                web::post().to(browser_snapshot),
            )
            .route(
                "/api/browser/{session_id}/click",
                web::post().to(browser_click),
            )
            .route(
                "/api/browser/{session_id}/fill",
                web::post().to(browser_fill),
            )
            .route(
                "/api/browser/{session_id}/wait",
                web::post().to(browser_wait),
            )
            .route(
                "/api/browser/{session_id}/text",
                web::post().to(browser_get_text),
            )
            .route(
                "/api/browser/{session_id}/screenshot",
                web::post().to(browser_screenshot),
            )
            .route(
                "/api/browser/{session_id}/close",
                web::post().to(browser_close),
            )
            .route(
                "/api/evaluation/cases",
                web::get().to(list_evaluation_cases),
            )
            .route(
                "/api/evaluation/cases",
                web::post().to(create_evaluation_case),
            )
            .route(
                "/api/evaluation/cases/{case_id}/run",
                web::post().to(run_evaluation_case),
            )
            .route(
                "/api/evaluation/cases/{case_id}/result",
                web::get().to(get_evaluation_result),
            )
            .route("/api/agent/status", web::get().to(agent_status))
            .route("/api/agent/chat", web::post().to(agent_chat))
            .route("/api/models/execute", web::post().to(direct_model_execute))
            .route("/api/models/stream", web::post().to(stream_model_execute))
            .route(
                "/api/conversations/{session_id}/history",
                web::get().to(conversation_history),
            )
            .route(
                "/api/conversations/search",
                web::get().to(conversation_search),
            )
            .route("/api/audit", web::get().to(list_audit))
            .route("/api/tools", web::get().to(list_tools))
            .route("/api/projects", web::get().to(list_projects))
            .route("/api/projects", web::post().to(register_project))
            .route(
                "/api/projects/{project_id}",
                web::delete().to(delete_project),
            )
            .route("/api/channels", web::get().to(list_channels))
            .route("/api/channels", web::post().to(register_channel))
            .route(
                "/api/channels/{channel_id}",
                web::delete().to(delete_channel),
            )
            .route(
                "/api/channels/{channel_id}/events",
                web::get().to(list_channel_events),
            )
            .route(
                "/api/channels/{channel_id}/events",
                web::post().to(append_channel_event),
            )
            .route("/api/workspace/search", web::get().to(search_workspace))
            .route("/api/workspace/list", web::get().to(list_workspace))
            .route("/api/workspace/file", web::get().to(read_workspace_file))
            .route("/api/workspace/file", web::post().to(write_workspace_file))
            .route("/api/workspace/patch", web::post().to(patch_workspace_file))
            .route("/api/terminals", web::get().to(list_terminals))
            .route("/api/terminals", web::post().to(create_terminal))
            .route("/api/terminals/{terminal_id}", web::get().to(get_terminal))
            .route(
                "/api/terminals/{terminal_id}/input",
                web::post().to(write_terminal),
            )
            .route(
                "/api/terminals/{terminal_id}/output",
                web::get().to(read_terminal),
            )
            .route(
                "/api/terminals/{terminal_id}/close",
                web::post().to(close_terminal),
            )
            .route(
                "/api/terminals/{terminal_id}",
                web::delete().to(delete_terminal),
            )
            .route("/api/artifacts", web::get().to(list_artifacts))
            .route("/api/artifacts", web::post().to(create_artifact))
            .route("/api/artifacts/{artifact_id}", web::get().to(get_artifact))
            .route(
                "/api/artifacts/{artifact_id}/content",
                web::get().to(get_artifact_content),
            )
            .route(
                "/api/artifacts/{artifact_id}",
                web::delete().to(delete_artifact),
            )
            .route(
                "/api/runs/{run_id}/artifacts",
                web::get().to(list_run_artifacts),
            )
            .route("/api/tools/call", web::post().to(execute_registered_tool))
            .route(
                "/api/tools/mcp/{server_id}/sync",
                web::post().to(sync_mcp_tools),
            )
            .route("/api/mcp", web::get().to(list_mcp_servers))
            .route("/api/mcp", web::post().to(register_mcp_server))
            .route("/api/mcp/{server_id}", web::delete().to(delete_mcp_server))
            .route(
                "/api/mcp/{server_id}/{action}",
                web::post().to(set_mcp_enabled),
            )
            .route("/api/mcp/{server_id}/tools", web::get().to(list_mcp_tools))
            .route(
                "/api/mcp/{server_id}/tools/{tool_name}/call",
                web::post().to(call_mcp_tool),
            )
            .route("/api/providers", web::get().to(list_providers))
            .route("/api/providers", web::post().to(register_provider))
            .route(
                "/api/providers/{provider_id}/quota",
                web::get().to(get_provider_quota),
            )
            .route(
                "/api/providers/{provider_id}/quota",
                web::put().to(set_provider_quota),
            )
            .route(
                "/api/providers/{provider_id}/retry",
                web::get().to(get_provider_retry_policy),
            )
            .route(
                "/api/providers/{provider_id}/retry",
                web::put().to(set_provider_retry_policy),
            )
            .route(
                "/api/providers/{provider_id}/fallback",
                web::get().to(get_provider_fallback),
            )
            .route(
                "/api/providers/{provider_id}/fallback",
                web::put().to(set_provider_fallback),
            )
            .route(
                "/api/providers/{provider_id}",
                web::delete().to(delete_provider),
            )
            .route(
                "/api/providers/{provider_id}/models",
                web::get().to(list_provider_models),
            )
            .route(
                "/api/providers/{provider_id}/models/refresh",
                web::post().to(refresh_provider_models),
            )
            .route(
                "/api/providers/{provider_id}/health",
                web::post().to(check_provider_health),
            )
            .route("/api/models", web::get().to(list_models))
            .route("/api/runs", web::get().to(list_runs))
            .route("/api/runs", web::post().to(create_run))
            .route("/api/runs/{run_id}", web::get().to(get_run))
            .route("/api/runs/{run_id}/cancel", web::post().to(cancel_run))
            .route("/api/runs/{run_id}/snapshot", web::post().to(snapshot_run))
            .route("/api/subagents", web::get().to(list_agents))
            .route("/api/subagents", web::post().to(create_agent))
            .route(
                "/api/subagents/{parent_run_id}/children",
                web::post().to(spawn_agent),
            )
            .route(
                "/api/subagents/{parent_run_id}/children",
                web::get().to(list_children),
            )
            .route("/api/jobs", web::get().to(list_jobs))
            .route("/api/jobs/ready", web::get().to(list_ready_jobs))
            .route("/api/jobs", web::post().to(create_job))
            .route("/api/jobs/{job_id}", web::get().to(get_job))
            .route("/api/jobs/{job_id}/cancel", web::post().to(cancel_job))
            .route("/api/workflows", web::get().to(list_workflows))
            .route("/api/workflows", web::post().to(create_workflow))
            .route(
                "/api/workflows/{workflow_id}/start",
                web::post().to(start_workflow),
            )
            .route(
                "/api/workflows/{workflow_id}/ready",
                web::get().to(workflow_ready_nodes),
            )
            .route(
                "/api/workflows/{workflow_id}/nodes/{node_id}/transition",
                web::post().to(transition_workflow_node),
            )
            .route(
                "/api/workflows/{workflow_id}/state",
                web::get().to(workflow_state),
            )
            .route("/api/reasoning/plan", web::post().to(create_plan))
            .route("/api/approvals", web::get().to(list_approvals))
            .route("/api/approvals", web::post().to(create_approval))
            .route(
                "/api/approvals/{approval_id}",
                web::post().to(resolve_approval),
            )
            .route("/api/memory", web::get().to(list_memory))
            .route("/api/memory", web::post().to(upsert_memory))
            .route(
                "/api/memory/{namespace}/{key}",
                web::delete().to(delete_memory),
            )
            .route("/api/memory/purge", web::post().to(purge_memory))
            .route("/api/capabilities", web::get().to(list_capabilities))
            .route("/api/capabilities", web::post().to(issue_capability))
            .route(
                "/api/capabilities/{grant_id}",
                web::delete().to(revoke_capability),
            )
            .route("/api/tools/execute", web::post().to(execute_tool))
            .route("/api/sandbox/status", web::get().to(sandbox_status))
    })
    .bind((host, port))?
    .run()
    .await
}

fn unix_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn runtime_env_usize(name: &str, default: usize, min: usize, max: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(default)
        .clamp(min, max)
}

fn agent_execution_concurrency_limit() -> usize {
    let cores = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(4);
    let default_limit = cores.saturating_mul(2).clamp(4, 32);
    runtime_env_usize("AGENTICOS_MAX_AGENT_CONCURRENCY", default_limit, 2, 64)
}
