#![forbid(unsafe_code)]

use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use agenticos_contracts::{ContractError, ModelProvider, ModelRequest, ModelResponse};
use agenticos_kernel::{ReactAgent, SqliteMemory, ToolRegistry};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

const DEFAULT_DATABASE_URL: &str = "sqlite://agenticos.db?mode=rwc";
const DEFAULT_PROVIDER_URL: &str = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL: &str = "gpt-4o-mini";

#[derive(Clone)]
pub struct RuntimeState {
    sessions: Arc<RwLock<HashMap<String, Arc<ReactAgent>>>>,
    memory: Arc<SqliteMemory>,
    provider: Option<Arc<dyn ModelProvider>>,
    provider_name: String,
    model: String,
    tools: Arc<RwLock<ToolRegistry>>,
}

impl RuntimeState {
    pub async fn from_env() -> Result<Self, ContractError> {
        let database_url = std::env::var("AGENTICOS_DATABASE_URL")
            .unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
        let memory = Arc::new(SqliteMemory::new(&database_url).await?);

        let provider_url = std::env::var("AGENTICOS_PROVIDER_URL")
            .unwrap_or_else(|_| DEFAULT_PROVIDER_URL.to_string());
        let provider_name = std::env::var("AGENTICOS_PROVIDER_NAME")
            .unwrap_or_else(|_| "openai-compatible".to_string());
        let model = std::env::var("AGENTICOS_MODEL")
            .unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        let api_key = std::env::var("AGENTICOS_API_KEY")
            .ok()
            .filter(|value| !value.trim().is_empty());

        let provider = api_key.map(|key| {
            Arc::new(OpenAiCompatibleProvider::new(provider_url, provider_name.clone(), key))
                as Arc<dyn ModelProvider>
        });

        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            memory,
            provider,
            provider_name,
            model,
            tools: Arc::new(RwLock::new(ToolRegistry::new())),
        })
    }

    async fn session_agent(&self, session_id: &str) -> Arc<ReactAgent> {
        if let Some(agent) = self.sessions.read().await.get(session_id).cloned() {
            return agent;
        }

        let agent = Arc::new(ReactAgent::with_max_turns("AgentiCOS".to_string(), 90));
        agent.set_session_id(session_id.to_string());
        agent.set_memory(self.memory.clone());
        if let Some(provider) = &self.provider {
            agent.set_model_provider(provider.clone());
        }

        let mut sessions = self.sessions.write().await;
        sessions.entry(session_id.to_string()).or_insert_with(|| agent.clone()).clone()
    }

    fn configured(&self) -> bool {
        self.provider.is_some()
    }
}

#[derive(Debug, Deserialize)]
struct ChatRequest { message: String, session_id: Option<String> }

#[derive(Debug, Serialize)]
struct ChatResponse {
    response: String,
    agent: String,
    session_id: String,
    model: String,
    provider: String,
}

#[derive(Debug, Serialize)]
struct StatusResponse {
    agent_name: String,
    state: &'static str,
    provider: String,
    model: String,
    configured: bool,
}

#[derive(Debug, Serialize)]
struct ErrorResponse { error: String, code: &'static str }

async fn health_check(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "AgentiCOS API Server",
        "backend": "rust",
        "database": "sqlite",
        "provider_configured": state.configured(),
    }))
}

async fn agent_status(state: web::Data<RuntimeState>) -> impl Responder {
    HttpResponse::Ok().json(StatusResponse {
        agent_name: "AgentiCOS".to_string(),
        state: if state.configured() { "ready" } else { "configuration_required" },
        provider: state.provider_name.clone(),
        model: state.model.clone(),
        configured: state.configured(),
    })
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
    if !state.configured() {
        return HttpResponse::ServiceUnavailable().json(ErrorResponse {
            error: "No model provider is configured. Set AGENTICOS_API_KEY and optionally AGENTICOS_PROVIDER_URL/AGENTICOS_MODEL.".to_string(),
            code: "PROVIDER_NOT_CONFIGURED",
        });
    }

    let session_id = request.session_id.clone()
        .filter(|id| !id.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let agent = state.session_agent(&session_id).await;

    match agent.execute_turn(message).await {
        Ok(response) => HttpResponse::Ok().json(ChatResponse {
            response,
            agent: agent.name().to_string(),
            session_id,
            model: state.model.clone(),
            provider: state.provider_name.clone(),
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
    let agent = state.session_agent(&id).await;
    HttpResponse::Ok().json(serde_json::json!({
        "session_id": id,
        "history": agent.get_session_history(&id).await,
        "agent": agent.name(),
    }))
}

#[derive(Debug, Deserialize)]
struct SearchQuery { q: String, limit: Option<usize> }

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

async fn list_tools(state: web::Data<RuntimeState>) -> impl Responder {
    let tools = state.tools.read().await.get_all_tools();
    HttpResponse::Ok().json(serde_json::json!({ "tools": tools, "count": tools.len() }))
}

async fn get_tool(
    tool_name: web::Path<String>,
    state: web::Data<RuntimeState>,
) -> impl Responder {
    let name = tool_name.into_inner();
    let tools = state.tools.read().await;
    match tools.get_tool(&name) {
        Some(tool) => HttpResponse::Ok().json(tool),
        None => HttpResponse::NotFound().json(ErrorResponse {
            error: "Tool not found".to_string(),
            code: "TOOL_NOT_FOUND",
        }),
    }
}

pub async fn run_server(state: RuntimeState) -> std::io::Result<()> {
    let host = std::env::var("AGENTICOS_BIND_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("AGENTICOS_BIND_PORT").ok()
        .and_then(|value| value.parse::<u16>().ok()).unwrap_or(8080);
    let data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .wrap(Cors::permissive())
            .app_data(data.clone())
            .route("/health", web::get().to(health_check))
            .route("/api/agent/status", web::get().to(agent_status))
            .route("/api/agent/chat", web::post().to(agent_chat))
            .route("/api/conversations/{session_id}/history", web::get().to(conversation_history))
            .route("/api/conversations/search", web::get().to(conversation_search))
            .route("/api/tools", web::get().to(list_tools))
            .route("/api/tools/{tool_name}", web::get().to(get_tool))
    })
    .bind((host, port))?
    .run()
    .await
}

struct OpenAiCompatibleProvider {
    base_url: String,
    provider_id: String,
    api_key: String,
}

impl OpenAiCompatibleProvider {
    fn new(base_url: String, provider_id: String, api_key: String) -> Self {
        Self { base_url, provider_id, api_key }
    }
}

#[derive(Debug, Serialize)]
struct OpenAiMessage<'a> { role: &'a str, content: &'a str }

#[derive(Debug, Deserialize)]
struct OpenAiResponse { choices: Vec<OpenAiChoice>, usage: Option<OpenAiUsage> }

#[derive(Debug, Deserialize)]
struct OpenAiChoice { message: OpenAiMessageOwned }

#[derive(Debug, Deserialize)]
struct OpenAiMessageOwned { content: Option<String> }

#[derive(Debug, Deserialize)]
struct OpenAiUsage { total_tokens: Option<u64> }

#[async_trait]
impl ModelProvider for OpenAiCompatibleProvider {
    fn provider_id(&self) -> &str { &self.provider_id }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        let model = if request.model == "default" {
            std::env::var("AGENTICOS_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string())
        } else {
            request.model
        };
        let body = serde_json::json!({
            "model": model,
            "messages": [OpenAiMessage { role: "user", content: &request.input }],
            "stream": false
        });

        let response = reqwest::Client::new()
            .post(&self.base_url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|error| ContractError::ParseError(format!("Provider request failed: {error}")))?;

        let status = response.status();
        let text = response.text().await
            .map_err(|error| ContractError::ParseError(format!("Provider response read failed: {error}")))?;
        if !status.is_success() {
            return Err(ContractError::ParseError(format!("Provider returned HTTP {status}: {text}")));
        }

        let parsed: OpenAiResponse = serde_json::from_str(&text)
            .map_err(|error| ContractError::ParseError(format!("Invalid OpenAI-compatible response: {error}")))?;
        let output = parsed.choices.first()
            .and_then(|choice| choice.message.content.clone())
            .filter(|content| !content.trim().is_empty())
            .ok_or_else(|| ContractError::ParseError("Provider returned no message content".to_string()))?;

        Ok(ModelResponse {
            request_id: request.request_id,
            output,
            metadata: Some(self.provider_id.clone()),
            tokens_used: parsed.usage.and_then(|usage| usage.total_tokens),
        })
    }
}
