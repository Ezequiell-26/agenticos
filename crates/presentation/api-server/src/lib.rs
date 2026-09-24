#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS backend HTTP surface.
//!
//! The API is intentionally thin: durable state and execution live in the
//! Rust runtime, while this crate exposes typed commands, queries and control
//! plane operations to the desktop frontend.

use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use agenticos_agents::{AgentBudget, AgentDefinition, SubagentManager};
use agenticos_brain::{
    reasoning_engine::{EngineConfig, ReasoningEngine, SelectionStrategy},
    CapabilityRegistry,
};
use agenticos_contracts::{
    CapabilityGrant, CapabilityIssuer, CapabilityType, ContractError, ModelProvider, ModelRequest,
    RunId, RunState, Sandbox, SandboxStatus,
};
use agenticos_execution::SecureToolService;
use agenticos_kernel::{
    InMemoryConfig, InMemoryLogger, KernelRuntime, ReactAgent, SqliteEventStore, SqliteMemory,
    SqliteSnapshotStore,
};
use agenticos_memory::PersistentMemoryStore;
use agenticos_providers::{ProviderPlatform, ProviderStatus};
use agenticos_sandbox::{ProcessSandbox, SandboxPolicy};
use agenticos_scheduler::{JobScheduler, JobSpec};
use agenticos_security::{ApprovalRequest, CapabilityManager};
use agenticos_tools::ToolRegistry;
use agenticos_workflows::{WorkflowDefinition, WorkflowEngine, WorkflowState};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Default local SQLite URL.
const DEFAULT_DATABASE_URL: &str = "sqlite://agenticos.db?mode=rwc";
/// Default model used by the runtime when no explicit model is supplied.
const DEFAULT_MODEL: &str = "gpt-4o-mini";

/// Shared runtime state for the HTTP process.
#[derive(Clone)]
pub struct RuntimeState {
    sessions: Arc<RwLock<HashMap<String, Arc<ReactAgent>>>>,
    memory: Arc<SqliteMemory>,
    persistent_memory: Arc<PersistentMemoryStore>,
    provider: Arc<ProviderPlatform>,
    kernel: Arc<KernelRuntime>,
    subagents: Arc<SubagentManager>,
    scheduler: Arc<JobScheduler>,
    workflows: Arc<WorkflowEngine>,
    capabilities: Arc<CapabilityManager>,
    sandbox: Arc<ProcessSandbox>,
    secure_tools: Arc<SecureToolService>,
    tools: Arc<ToolRegistry>,
    reasoning: Arc<ReasoningEngine>,
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

        let event_store = Arc::new(SqliteEventStore::new(&database_url).await.map_err(|e| {
            ContractError::ParseError(format!("failed to initialize event store: {e}"))
        })?);
        let snapshot_store =
            Arc::new(SqliteSnapshotStore::new(&database_url).await.map_err(|e| {
                ContractError::ParseError(format!("failed to initialize snapshot store: {e}"))
            })?);
        let logger = Arc::new(InMemoryLogger::new(agenticos_contracts::LogLevel::Info));
        let config = Arc::new(RwLock::new(InMemoryConfig::default()));
        let capabilities = Arc::new(CapabilityManager::new());
        let kernel = Arc::new(KernelRuntime::new(
            event_store,
            snapshot_store,
            logger,
            config,
            capabilities.clone(),
            Arc::new(CapabilityRegistry::default()),
        ));

        let provider = Arc::new(ProviderPlatform::from_env().await?);
        let sandbox = Arc::new(ProcessSandbox::new(SandboxPolicy::default()));
        let secure_tools = Arc::new(SecureToolService::new(
            capabilities.clone(),
            sandbox.clone(),
        ));
        let tools = Arc::new(ToolRegistry::new());
        seed_tool_catalog(&tools).await?;
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

        let subagents = Arc::new(SubagentManager::default());
        subagents
            .register(default_agent)
            .await
            .map_err(ContractError::ParseError)?;

        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            memory,
            persistent_memory,
            provider,
            kernel,
            subagents,
            scheduler: Arc::new(JobScheduler::default()),
            workflows: Arc::new(WorkflowEngine::default()),
            capabilities,
            sandbox,
            secure_tools,
            tools,
            reasoning: Arc::new(ReasoningEngine::new(EngineConfig {
                max_steps: 12,
                enable_learning: true,
                selection_strategy: SelectionStrategy::Balanced,
            })),
            model,
        })
    }

    async fn session_agent(&self, session_id: &str) -> Arc<ReactAgent> {
        if let Some(agent) = self.sessions.read().await.get(session_id).cloned() {
            return agent;
        }

        let agent = Arc::new(ReactAgent::with_max_turns("AgentiCOS".to_string(), 90));
        agent.set_session_id(session_id.to_string());
        agent.set_memory(self.memory.clone());
        agent.set_model_provider(self.provider.clone());

        let mut sessions = self.sessions.write().await;
        sessions
            .entry(session_id.to_string())
            .or_insert_with(|| agent.clone())
            .clone()
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
}

#[derive(Debug, Serialize)]
struct ChatResponse {
    response: String,
    agent: String,
    session_id: String,
    model: String,
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

#[derive(Debug, Serialize)]
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

async fn agent_chat(
    request: web::Json<ChatRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let message = request.message.trim();
    if message.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "message must not be empty".to_string(),
            code: "INVALID_MESSAGE",
        });
    }
    if !state.configured().await {
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
    let agent = state.session_agent(&session_id).await;

    match agent.execute_turn(message).await {
        Ok(response) => HttpResponse::Ok().json(ChatResponse {
            response,
            agent: agent.name().to_string(),
            session_id,
            model: state.model.clone(),
        }),
        Err(error) => {
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

async fn create_provider(
    request: web::Json<CreateProviderRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let provider_id = request.provider_id.trim();
    let name = request.name.trim();
    let base_url = request.base_url.trim();

    if provider_id.is_empty()
        || name.is_empty()
        || base_url.is_empty()
        || request.models.is_empty()
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "provider_id, name, base_url and at least one model are required".to_string(),
            code: "INVALID_PROVIDER",
        });
    }

    if base_url.contains('@') {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "provider base URLs must not embed HTTP credentials".to_string(),
            code: "PROVIDER_URL_CREDENTIALS",
        });
    }

    let entry = agenticos_contracts::ProviderEntry {
        provider_id: provider_id.to_string(),
        name: name.to_string(),
        base_url: base_url.to_string(),
        models: request
            .models
            .iter()
            .map(|model| model.trim())
            .filter(|model| !model.is_empty())
            .map(str::to_string)
            .collect(),
        capabilities: request
            .capabilities
            .clone()
            .unwrap_or_else(|| vec!["chat".to_string()]),
    };

    if entry.models.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "at least one non-empty model is required".to_string(),
            code: "INVALID_PROVIDER_MODELS",
        });
    }

    match state
        .provider
        .register(entry, request.api_key.clone())
        .await
    {
        Ok(()) => {
            let status = state
                .provider
                .list_status()
                .await
                .into_iter()
                .find(|provider| provider.provider_id == provider_id);
            HttpResponse::Created().json(status)
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
    match state.provider.remove(&provider_id).await {
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

async fn invoke_tool(
    request: web::Json<ToolInvokeRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let tool_id = request.tool_id.trim();
    if request.session_id.trim().is_empty()
        || request.grant_id.trim().is_empty()
        || tool_id.is_empty()
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "session_id, grant_id and tool_id are required".to_string(),
            code: "INVALID_TOOL_INVOKE",
        });
    }

    let Some(tool) = state.tools.get(tool_id).await else {
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "tool is not registered".to_string(),
            code: "TOOL_NOT_FOUND",
        });
    };

    let permission = tool
        .required_permissions
        .first()
        .cloned()
        .unwrap_or_else(|| tool_id.to_string());
    let capability_type = match tool_id {
        "memory.search" => CapabilityType::Read,
        "memory.write" | "memory.delete" => CapabilityType::Write,
        _ => CapabilityType::Execute,
    };
    let resource = match tool_id {
        "process.execute" => "process/command".to_string(),
        "memory.search" | "memory.write" | "memory.delete" => {
            format!("memory/{}", request.parameters.get("namespace").and_then(|v| v.as_str()).unwrap_or("*"))
        }
        "provider.chat" => format!(
            "provider/{}",
            request
                .parameters
                .get("provider_id")
                .and_then(|v| v.as_str())
                .unwrap_or("*")
        ),
        "subagent.spawn" => format!(
            "subagent/{}",
            request
                .parameters
                .get("parent_run_id")
                .and_then(|v| v.as_str())
                .unwrap_or("*")
        ),
        "workflow.execute" => format!(
            "workflow/{}",
            request
                .parameters
                .get("workflow_id")
                .and_then(|v| v.as_str())
                .unwrap_or("*")
        ),
        _ => tool_id.to_string(),
    };

    let authorized = match state
        .capabilities
        .authorize(
            &request.grant_id,
            capability_type,
            &resource,
            &permission,
        )
        .await
    {
        Ok(value) => value,
        Err(error) => {
            return HttpResponse::Forbidden().json(ErrorResponse {
                error: error.to_string(),
                code: "TOOL_AUTHORIZATION_FAILED",
            });
        }
    };

    if !authorized {
        return HttpResponse::Forbidden().json(ErrorResponse {
            error: "capability grant does not authorize this tool".to_string(),
            code: "TOOL_NOT_AUTHORIZED",
        });
    }

    let result = match tool_id {
        "process.execute" => {
            let command = request
                .parameters
                .get("command")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("command is required".to_string()));
            match command {
                Ok(command) => state
                    .secure_tools
                    .execute_command(
                        request.session_id.trim(),
                        request.user_id.as_deref(),
                        request.grant_id.trim(),
                        command,
                        request
                            .parameters
                            .get("timeout_ms")
                            .and_then(|value| value.as_u64()),
                    )
                    .await
                    .map(|execution| serde_json::json!({
                        "success": execution.success,
                        "output": execution.output,
                    })),
                Err(error) => Err(error),
            }
        }
        "memory.search" => {
            let namespace = request
                .parameters
                .get("namespace")
                .and_then(|value| value.as_str())
                .unwrap_or("global");
            let query = request
                .parameters
                .get("q")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            state
                .persistent_memory
                .search(namespace, query, request.parameters.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize)
                .await
                .map(|records| serde_json::json!({ "records": records }))
        }
        "memory.write" => {
            let namespace = request
                .parameters
                .get("namespace")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("namespace is required".to_string()));
            let key = request
                .parameters
                .get("key")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("key is required".to_string()));
            let value = request
                .parameters
                .get("value")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("value is required".to_string()));
            match (namespace, key, value) {
                (Ok(namespace), Ok(key), Ok(value)) => {
                    let tags = request
                        .parameters
                        .get("tags")
                        .and_then(|value| value.as_array())
                        .map(|items| {
                            items.iter()
                                .filter_map(|item| item.as_str().map(str::to_string))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    state
                        .persistent_memory
                        .upsert(
                            namespace,
                            key,
                            value,
                            &tags,
                            request
                                .parameters
                                .get("importance")
                                .and_then(|value| value.as_f64())
                                .unwrap_or(0.5),
                            request
                                .parameters
                                .get("expires_at")
                                .and_then(|value| value.as_i64())
                                .unwrap_or(0),
                        )
                        .await
                        .map(|record| serde_json::to_value(record).unwrap_or_default())
                }
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "memory.delete" => {
            let namespace = request
                .parameters
                .get("namespace")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("namespace is required".to_string()));
            let key = request
                .parameters
                .get("key")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("key is required".to_string()));
            match (namespace, key) {
                (Ok(namespace), Ok(key)) => state
                    .persistent_memory
                    .delete(namespace, key)
                    .await
                    .map(|removed| serde_json::json!({ "removed": removed })),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "provider.chat" => {
            let model = request
                .parameters
                .get("model")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("model is required".to_string()));
            let input = request
                .parameters
                .get("input")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("input is required".to_string()));
            match (model, input) {
                (Ok(model), Ok(input)) => state
                    .provider
                    .execute_routed(ModelRequest {
                        request_id: format!("req-{}", uuid::Uuid::new_v4()),
                        model: model.to_string(),
                        input: input.to_string(),
                        parameters: None,
                    })
                    .await
                    .and_then(|response| {
                        serde_json::to_value(response)
                            .map_err(|error| ContractError::ParseError(error.to_string()))
                    }),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "subagent.spawn" => {
            let parent_run_id = request
                .parameters
                .get("parent_run_id")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("parent_run_id is required".to_string()));
            let agent_id = request
                .parameters
                .get("agent_id")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("agent_id is required".to_string()));
            match (parent_run_id, agent_id) {
                (Ok(parent_run_id), Ok(agent_id)) => state
                    .subagents
                    .spawn_child(
                        parent_run_id,
                        agent_id,
                        request
                            .parameters
                            .get("parent_depth")
                            .and_then(|value| value.as_u64())
                            .unwrap_or(0) as u16,
                    )
                    .await
                    .map(|child| serde_json::to_value(child).unwrap_or_default())
                    .map_err(ContractError::ParseError),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "workflow.execute" => {
            let workflow_id = request
                .parameters
                .get("workflow_id")
                .and_then(|value| value.as_str())
                .ok_or_else(|| ContractError::ParseError("workflow_id is required".to_string()));
            match workflow_id {
                Ok(workflow_id) => state
                    .workflows
                    .initial_state(workflow_id)
                    .await
                    .map(|state| serde_json::to_value(state).unwrap_or_default())
                    .map_err(ContractError::ParseError),
                Err(error) => Err(error),
            }
        }
        _ => Err(ContractError::ParseError(format!(
            "tool '{}' has no runtime implementation",
            tool_id
        ))),
    };

    match result {
        Ok(result) => HttpResponse::Ok().json(serde_json::json!({
            "tool_id": tool_id,
            "session_id": request.session_id,
            "success": true,
            "result": result,
        })),
        Err(error) => HttpResponse::BadRequest().json(ErrorResponse {
            error: error.to_string(),
            code: "TOOL_INVOCATION_FAILED",
        }),
    }
}

async fn test_provider(
    request: web::Json<ProviderTestRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    if request.model.trim().is_empty() || request.input.trim().is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "model and input are required".to_string(),
            code: "INVALID_PROVIDER_TEST",
        });
    }

    let model_request = ModelRequest {
        request_id: request
            .request_id
            .clone()
            .unwrap_or_else(|| format!("req-{}", uuid::Uuid::new_v4())),
        model: request.model.trim().to_string(),
        input: request.input.clone(),
        parameters: None,
    };

    match state.provider.execute_routed(model_request).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(error) => HttpResponse::BadGateway().json(ErrorResponse {
            error: error.to_string(),
            code: "PROVIDER_TEST_FAILED",
        }),
    }
}

async fn list_tools(state: web::Data<RuntimeState>) -> impl Responder {
    let entries = state.tools.list().await;
    let tools: Vec<_> = entries
        .into_iter()
        .map(|entry| {
            serde_json::json!({
                "tool_id": entry.tool_id,
                "name": entry.name,
                "description": entry.description,
                "capabilities": entry.capabilities,
                "required_permissions": entry.required_permissions,
                "context_requirements": entry.context_requirements,
            })
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({
        "tools": tools,
        "count": tools.len(),
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
    let run_id_text = request
        .run_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
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
        Ok(_) => {
            if let Err(error) = state
                .kernel
                .transition_run(&run_id, RunState::Admitted, 1)
                .await
            {
                return HttpResponse::Conflict().json(ErrorResponse {
                    error: error.to_string(),
                    code: "RUN_ADMISSION_FAILED",
                });
            }
            let _ = state
                .memory
                .store_message(
                    &format!("{}-objective", run_id.as_str()),
                    run_id.as_str(),
                    "objective",
                    objective,
                )
                .await;
            let _ = state
                .scheduler
                .enqueue(JobSpec {
                    job_id: format!("job-{}", run_id.as_str()),
                    run_id: run_id.as_str().to_string(),
                    task: objective.to_string(),
                    dependencies: vec![],
                    priority: 100,
                    max_attempts: 3,
                })
                .await;

            HttpResponse::Created().json(RunResponse {
                run_id: run_id_text,
                state: "Admitted".to_string(),
                version: 2,
            })
        }
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error: error.to_string(),
            code: "RUN_CREATE_FAILED",
        }),
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
    let runs = state.kernel.runs.read().await;
    match runs.get(&id) {
        Some(run) => HttpResponse::Ok().json(RunResponse {
            run_id: id.as_str().to_string(),
            state: format!("{:?}", run.state),
            version: run.version,
        }),
        None => HttpResponse::NotFound().json(ErrorResponse {
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
    match state.kernel.cancel_run(&id).await {
        Ok(()) => HttpResponse::Ok()
            .json(serde_json::json!({"run_id": id.as_str(), "state": "Cancelling"})),
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
    match state
        .subagents
        .spawn_child(
            &path.into_inner(),
            &request.agent_id,
            request.parent_depth.unwrap_or(0),
        )
        .await
    {
        Ok(child) => HttpResponse::Created().json(child),
        Err(error) => HttpResponse::Conflict().json(ErrorResponse {
            error,
            code: "SUBAGENT_SPAWN_FAILED",
        }),
    }
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

async fn create_approval(
    request: web::Json<CreateApprovalRequest>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let approval = state
        .capabilities
        .request_approval(
            request.run_id.clone(),
            request.action.clone(),
            request.resource.clone(),
            request.expires_at.unwrap_or(0),
        )
        .await;
    HttpResponse::Created().json(approval)
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
        Ok(approval) => HttpResponse::Ok().json(approval),
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

    let grant = CapabilityGrant {
        capability_type,
        resource: request.resource.trim().to_string(),
        permission: request.permission.trim().to_string(),
        expires_at: request.expires_at.unwrap_or(0),
        grant_id: request.grant_id.trim().to_string(),
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

async fn seed_tool_catalog(registry: &ToolRegistry) -> Result<(), ContractError> {
    let entries = [
        (
            "process.execute",
            "Process execution",
            "Execute allowlisted local commands through the capability-gated sandbox.",
            vec!["process.execute"],
            vec!["process.execute"],
            vec!["sandbox"],
        ),
        (
            "memory.search",
            "Memory search",
            "Search persistent long-term memory.",
            vec!["memory.read"],
            vec!["memory.read"],
            vec!["memory"],
        ),
        (
            "memory.write",
            "Memory write",
            "Create or update persistent long-term memory.",
            vec!["memory.write"],
            vec!["memory.write"],
            vec!["memory"],
        ),
        (
            "memory.delete",
            "Memory delete",
            "Delete one persistent memory record.",
            vec!["memory.write"],
            vec!["memory.write"],
            vec!["memory"],
        ),
        (
            "provider.chat",
            "Provider chat",
            "Route a model-neutral request through the provider platform.",
            vec!["model.request"],
            vec!["model.request"],
            vec!["provider"],
        ),
        (
            "run.execute",
            "Run execution",
            "Execute an admitted durable run through the agent runtime.",
            vec!["run.execute"],
            vec!["run.execute"],
            vec!["runtime"],
        ),
        (
            "subagent.spawn",
            "Subagent delegation",
            "Create a bounded child run with inherited authority and budgets.",
            vec!["subagent.spawn"],
            vec!["subagent.spawn"],
            vec!["agents"],
        ),
        (
            "workflow.execute",
            "Workflow execution",
            "Advance a dependency-aware workflow through its runnable nodes.",
            vec!["workflow.execute"],
            vec!["workflow.execute"],
            vec!["workflows"],
        ),
    ];

    for (tool_id, name, description, capabilities, permissions, contexts) in entries {
        registry
            .register(agenticos_contracts::ToolEntry {
                tool_id: tool_id.to_string(),
                name: name.to_string(),
                description: description.to_string(),
                capabilities: capabilities.into_iter().map(str::to_string).collect(),
                required_permissions: permissions.into_iter().map(str::to_string).collect(),
                context_requirements: contexts.into_iter().map(str::to_string).collect(),
            })
            .await?;
    }
    Ok(())
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

pub async fn run_server(state: RuntimeState) -> std::io::Result<()> {
    let host = std::env::var("AGENTICOS_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("AGENTICOS_BIND_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8080);
    let data = web::Data::new(state);
    let cors = Cors::permissive();

    HttpServer::new(move || {
        App::new()
            .wrap(cors.clone())
            .app_data(data.clone())
            .route("/health", web::get().to(health_check))
            .route("/api/agent/status", web::get().to(agent_status))
            .route("/api/agent/chat", web::post().to(agent_chat))
            .route(
                "/api/conversations/{session_id}/history",
                web::get().to(conversation_history),
            )
            .route(
                "/api/conversations/search",
                web::get().to(conversation_search),
            )
            .route("/api/providers", web::get().to(list_providers))
            .route("/api/providers", web::post().to(create_provider))
            .route(
                "/api/providers/{provider_id}",
                web::delete().to(delete_provider),
            )
            .route("/api/providers/test", web::post().to(test_provider))
            .route("/api/models", web::get().to(list_models))
            .route("/api/tools", web::get().to(list_tools))
            .route("/api/tools/invoke", web::post().to(invoke_tool))
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
            .route("/api/jobs", web::post().to(create_job))
            .route("/api/workflows", web::get().to(list_workflows))
            .route("/api/workflows", web::post().to(create_workflow))
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
            .route("/api/tools", web::get().to(list_tools))
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
