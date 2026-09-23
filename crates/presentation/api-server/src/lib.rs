#![forbid(unsafe_code)]

use actix_web::middleware::Logger;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use agenticos_kernel::{ReactAgent, ToolRegistry};
use std::sync::Arc;

/// API server state containing the agent and tool registry.
pub struct ApiServerState {
    agent: Arc<ReactAgent>,
    _tool_registry: Arc<ToolRegistry>,
}

impl ApiServerState {
    pub fn new(agent: Arc<ReactAgent>) -> Self {
        Self {
            agent,
            _tool_registry: Arc::new(ToolRegistry::new()),
        }
    }
}

/// Health check endpoint.
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "AgentiCOS API Server"
    }))
}

/// Agent status endpoint.
async fn agent_status(state: web::Data<ApiServerState>) -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "agent_name": state.agent.name(),
        "status": "ready"
    }))
}

/// Agent chat endpoint.
async fn agent_chat(
    message: web::Json<serde_json::Value>,
    state: web::Data<ApiServerState>,
) -> impl Responder {
    // For now, return a simple response
    // TODO: Integrate with ReactAgent execute_turn
    let user_message = message
        .get("message")
        .and_then(|v| v.as_str())
        .unwrap_or("Hello");

    HttpResponse::Ok().json(serde_json::json!({
        "response": format!("Received: {}", user_message),
        "agent": state.agent.name()
    }))
}

/// Conversation history endpoint.
async fn conversation_history(
    session_id: web::Path<String>,
    state: web::Data<ApiServerState>,
) -> impl Responder {
    // For now, return empty history
    // TODO: Integrate with SqliteMemory get_session_history
    HttpResponse::Ok().json(serde_json::json!({
        "session_id": session_id.into_inner(),
        "history": [],
        "agent": state.agent.name()
    }))
}

/// List all tools endpoint.
async fn list_tools(state: web::Data<ApiServerState>) -> impl Responder {
    let tools = state._tool_registry.list_tools();
    HttpResponse::Ok().json(serde_json::json!({
        "tools": tools,
        "count": tools.len()
    }))
}

/// Get tool by name endpoint.
async fn get_tool(
    tool_name: web::Path<String>,
    state: web::Data<ApiServerState>,
) -> impl Responder {
    let tool = state._tool_registry.get_tool(&tool_name);

    match tool {
        Some(tool) => HttpResponse::Ok().json(tool),
        None => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Tool not found"
        })),
    }
}

/// Configure and run the API server.
pub async fn run_server(agent: Arc<ReactAgent>) -> std::io::Result<()> {
    let state = web::Data::new(ApiServerState::new(agent));

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .app_data(state.clone())
            .route("/health", web::get().to(health_check))
            .route("/api/agent/status", web::get().to(agent_status))
            .route("/api/agent/chat", web::post().to(agent_chat))
            .route(
                "/api/conversations/{session_id}/history",
                web::get().to(conversation_history),
            )
            .route("/api/tools", web::get().to(list_tools))
            .route("/api/tools/{tool_name}", web::get().to(get_tool))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_server_state_creation() {
        let agent = Arc::new(ReactAgent::new("Test agent".to_string()));
        let state = ApiServerState::new(agent);
        assert_eq!(state.agent.name(), "Test agent");
    }
}
