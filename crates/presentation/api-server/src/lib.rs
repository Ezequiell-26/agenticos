#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS backend HTTP surface.
//!
//! The API is intentionally thin: durable state and execution live in the
//! Rust runtime, while this crate exposes typed commands, queries and control
//! plane operations to the desktop frontend.

use actix_cors::Cors;
use actix_web::{dev::Service, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
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
struct RegisterProviderRequest {
    provider_id: String,
    name: String,
    base_url: String,
    models: Vec<String>,
    capabilities: Vec<String>,
    api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ToolExecutionRequest {
    session_id: String,
    user_id: Option<String>,
    grant_id: String,
    command: String,
    timeout_ms: Option<u64>,
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
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Waiting, 2)
                    .await;
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Failed, 3)
                    .await;
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
                })
                .await
            {
                tracing::error!(
                    error = ?error,
                    run_id = %run_id.as_str(),
                    "failed to enqueue initial run job"
                );
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Waiting, 2)
                    .await;
                let _ = state
                    .kernel
                    .transition_run(&run_id, RunState::Failed, 3)
                    .await;
                return HttpResponse::InternalServerError().json(ErrorResponse {
                    error,
                    code: "RUN_JOB_ENQUEUE_FAILED",
                });
            }

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

async fn list_runs(state: web::Data<RuntimeState>) -> impl Responder {
    let runs = state.kernel.runs.read().await;
    let mut result: Vec<RunResponse> = runs
        .values()
        .map(|run| RunResponse {
            run_id: run.run_id.as_str().to_string(),
            state: format!("{:?}", run.state),
            version: run.version,
        })
        .collect();
    result.sort_by(|left, right| left.run_id.cmp(&right.run_id));
    HttpResponse::Ok().json(serde_json::json!({
        "runs": result,
        "count": result.len(),
    }))
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
    if request.run_id.trim().is_empty()
        || request.action.trim().is_empty()
        || request.resource.trim().is_empty()
    {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "run_id, action and resource are required".to_string(),
            code: "INVALID_APPROVAL",
        });
    }
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

async fn scheduler_worker(state: RuntimeState) {
    loop {
        let ready_jobs = state.scheduler.next_ready(8).await;
        if ready_jobs.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            continue;
        }

        for queued_job in ready_jobs {
            let started_job = match state.scheduler.start(&queued_job.spec.job_id).await {
                Ok(job) => job,
                Err(error) => {
                    tracing::warn!(job_id = %queued_job.spec.job_id, %error, "scheduler failed to claim job");
                    continue;
                }
            };

            if started_job.state == JobState::Failed {
                tracing::warn!(
                    job_id = %started_job.spec.job_id,
                    "scheduler rejected execution because the job exhausted its attempts"
                );
                continue;
            }

            let run_id = RunId::new(started_job.spec.run_id.clone()).ok();
            if let Some(run_id) = run_id.clone() {
                let run = state.kernel.runs.read().await.get(&run_id).cloned();
                match run {
                    Some(run) if matches!(run.state, RunState::Cancelling | RunState::Cancelled) => {
                        let _ = state
                            .scheduler
                            .complete(
                                &started_job.spec.job_id,
                                false,
                                Some("run cancelled before execution".to_string()),
                            )
                            .await;
                        if run.state == RunState::Cancelling {
                            let _ = state
                                .kernel
                                .transition_run(&run_id, RunState::Cancelled, run.version)
                                .await;
                        }
                        continue;
                    }
                    Some(run) if run.state == RunState::Admitted => {
                        if let Err(error) = state
                            .kernel
                            .transition_run(&run_id, RunState::Running, run.version)
                            .await
                        {
                            let _ = state
                                .scheduler
                                .complete(&started_job.spec.job_id, false, Some(error.to_string()))
                                .await;
                            continue;
                        }
                    }
                    Some(_) => {}
                    None => {
                        let _ = state
                            .scheduler
                            .complete(
                                &started_job.spec.job_id,
                                false,
                                Some("run not found".to_string()),
                            )
                            .await;
                        continue;
                    }
                }
            }

            let session_id = format!("run:{}", started_job.spec.run_id);
            let agent = state.session_agent(&session_id).await;
            match agent.execute_turn(&started_job.spec.task).await {
                Ok(response) => {
                    if let Some(run_id) = run_id {
                        let current_run = state.kernel.runs.read().await.get(&run_id).cloned();
                        if let Some(run) = current_run {
                            let transition = match run.state {
                                RunState::Cancelling => state
                                    .kernel
                                    .transition_run(&run_id, RunState::Cancelled, run.version)
                                    .await,
                                RunState::Running => state
                                    .kernel
                                    .transition_run(&run_id, RunState::Completed, run.version)
                                    .await,
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
                    let _ = state
                        .scheduler
                        .complete(&started_job.spec.job_id, true, None)
                        .await;
                }
                Err(error) => {
                    let final_attempt = started_job.attempts >= started_job.spec.max_attempts.max(1);
                    if final_attempt {
                        if let Some(run_id) = run_id {
                            let current_run = state.kernel.runs.read().await.get(&run_id).cloned();
                            if let Some(run) = current_run {
                                if run.state == RunState::Running {
                                    if let Err(transition_error) = state
                                        .kernel
                                        .transition_run(&run_id, RunState::Failed, run.version)
                                        .await
                                    {
                                        tracing::error!(run_id = %run_id.as_str(), %transition_error, "failed to mark run as failed");
                                    }
                                }
                            }
                        }
                    }
                    tracing::error!(job_id = %started_job.spec.job_id, %error, final_attempt, "agent execution failed");
                    let _ = state
                        .scheduler
                        .complete(&started_job.spec.job_id, false, Some(error.to_string()))
                        .await;
                }
            }
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

        let expected_token = api_token.clone();
        App::new()
            .wrap(cors)
            .wrap_fn(move |req, srv| {
                let path = req.path().to_string();
                let authorized = path == "/health"
                    || expected_token.as_deref().is_none_or(|token| {
                        bearer_token(req.request()).is_some_and(|value| value == token)
                    });

                if !authorized {
                    let response = req.into_response(
                        HttpResponse::Unauthorized()
                            .json(serde_json::json!({
                                "error": "authentication required",
                                "code": "AUTHENTICATION_REQUIRED"
                            }))
                            .map_into_boxed_body(),
                    );
                    return Box::pin(async move { Ok(response) });
                }

                let future = srv.call(req);
                Box::pin(async move { future.await.map(|response| response.map_into_boxed_body()) })
            })
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
            .route("/api/providers", web::post().to(register_provider))
            .route(
                "/api/providers/{provider_id}",
                web::delete().to(delete_provider),
            )
            .route(
                "/api/providers/{provider_id}/models",
                web::get().to(list_provider_models),
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
