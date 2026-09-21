#![forbid(unsafe_code)]

use actix_web::middleware::Logger;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use agenticos_kernel::ReactAgent;
use std::sync::Arc;

/// API server state containing the agent.
pub struct ApiServerState {
    agent: Arc<ReactAgent>,
}

impl ApiServerState {
    pub fn new(agent: Arc<ReactAgent>) -> Self {
        Self { agent }
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
