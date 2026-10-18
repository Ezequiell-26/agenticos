use agenticos_api_server::{run_server, RuntimeState};
use agenticos_desktop::{
    get_agent_status, get_backend_health, get_conversation_history_from_api, send_message,
    UserMessage,
};
use sqlx::sqlite::SqlitePoolOptions;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

async fn free_port() -> u16 {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .expect("reserve local port");
    let port = listener.local_addr().expect("read local port").port();
    drop(listener);
    port
}

fn header_body_boundary(data: &[u8]) -> Option<usize> {
    data.windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4)
}

fn content_length(headers: &[u8]) -> usize {
    let text = String::from_utf8_lossy(headers);
    text.lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            if name.eq_ignore_ascii_case("content-length") {
                value.trim().parse().ok()
            } else {
                None
            }
        })
        .unwrap_or(0)
}

async fn write_json_response(socket: &mut TcpStream, body: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    socket
        .write_all(response.as_bytes())
        .await
        .expect("write provider response");
}

async fn serve_fake_provider(listener: TcpListener) {
    // The runtime health-checks providers at startup, so the first connection on
    // this socket is model discovery - a bodyless GET /v1/models - and not the
    // chat completion. Serving exactly one request made this task parse an empty
    // body and panic before the real completion ever arrived.
    let mut served_completion = false;
    while !served_completion {
        let (mut socket, _) = listener.accept().await.expect("accept provider request");
        let mut request = Vec::with_capacity(8192);
        let mut buffer = [0_u8; 4096];

        let body_start = loop {
            let read = socket
                .read(&mut buffer)
                .await
                .expect("read provider request");
            assert!(read > 0, "provider connection closed before headers");
            request.extend_from_slice(&buffer[..read]);
            if let Some(boundary) = header_body_boundary(&request) {
                break boundary;
            }
            assert!(
                request.len() < 128 * 1024,
                "provider request headers too large"
            );
        };

        let expected_body_len = content_length(&request[..body_start - 4]);
        while request.len() < body_start + expected_body_len {
            let read = socket.read(&mut buffer).await.expect("read provider body");
            assert!(read > 0, "provider connection closed before body");
            request.extend_from_slice(&buffer[..read]);
        }

        let head = String::from_utf8_lossy(&request[..body_start - 4]).to_string();
        let method = head
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().next())
            .unwrap_or_default()
            .to_string();
        let body = &request[body_start..body_start + expected_body_len];

        if method != "POST" {
            let catalog = serde_json::json!({ "data": [{ "id": "e2e-model" }] }).to_string();
            write_json_response(&mut socket, &catalog).await;
            continue;
        }

        let payload: serde_json::Value =
            serde_json::from_slice(body).expect("provider body must be valid JSON");

        assert_eq!(payload["model"], "e2e-model");
        let is_expected_turn = payload["messages"].as_array().is_some_and(|messages| {
            messages.iter().any(|message| {
                message["role"] == "user" && message["content"] == "desktop API provider E2E"
            })
        });

        if !is_expected_turn {
            // Before it runs the turn the runtime asks the provider to decide
            // whether to delegate to a subagent, so the first completion it wants
            // back is a routing answer rather than the reply. Say "no delegation"
            // and keep listening for the real turn.
            let routing = serde_json::json!({
                "id": "chatcmpl-agenticos-e2e-routing",
                "object": "chat.completion",
                "choices": [{
                    "index": 0,
                    "message": { "role": "assistant", "content": "null" },
                    "finish_reason": "stop"
                }],
                "usage": { "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2 }
            })
            .to_string();
            write_json_response(&mut socket, &routing).await;
            continue;
        }

        let response_body = serde_json::json!({
            "id": "chatcmpl-agenticos-e2e",
            "object": "chat.completion",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "E2E provider response"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 4,
                "completion_tokens": 3,
                "total_tokens": 7
            }
        })
        .to_string();

        write_json_response(&mut socket, &response_body).await;
        served_completion = true;
    }
}

async fn wait_for_health(api_url: &str) {
    let client = reqwest::Client::new();
    for _ in 0..120 {
        if let Ok(response) = client.get(format!("{api_url}/health")).send().await {
            if response.status().is_success() {
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    panic!("AgentiCOS API did not become healthy in time");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn desktop_to_api_to_provider_to_persistence_e2e() {
    let provider_listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .expect("bind fake provider");
    let provider_port = provider_listener
        .local_addr()
        .expect("provider address")
        .port();

    let api_port = free_port().await;
    let temp_root = std::env::temp_dir().join(format!(
        "agenticos-desktop-api-e2e-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    std::fs::create_dir_all(&temp_root).expect("create e2e directory");

    let database_url = format!(
        "sqlite://{}/agenticos.db?mode=rwc",
        temp_root.display().to_string().replace('\\', "/")
    );
    let artifact_root = temp_root.join("artifacts");

    std::env::remove_var("AGENTICOS_API_URL");
    std::env::remove_var("AGENTICOS_PROVIDERS_JSON");
    std::env::remove_var("AGENTICOS_API_TOKEN");
    std::env::remove_var("AGENTICOS_API_KEY");
    std::env::remove_var("AGENTICOS_SECRET_KEY");
    std::env::set_var("AGENTICOS_BIND_HOST", "127.0.0.1");
    std::env::set_var("AGENTICOS_BIND_PORT", api_port.to_string());
    std::env::set_var(
        "AGENTICOS_PROVIDER_URL",
        format!("http://127.0.0.1:{provider_port}/v1/chat/completions"),
    );
    std::env::set_var("AGENTICOS_PROVIDER_NAME", "e2e-provider");
    std::env::set_var("AGENTICOS_MODEL", "e2e-model");
    std::env::set_var("AGENTICOS_ALLOW_ANONYMOUS_PROVIDER", "true");
    std::env::set_var("AGENTICOS_DATABASE_URL", &database_url);
    std::env::set_var("AGENTICOS_ARTIFACT_ROOT", &artifact_root);
    std::env::set_var("AGENTICOS_PROJECT_PATH", ".");
    std::env::set_var("AGENTICOS_SKILLS_ROOT", "skills");

    let provider_task = tokio::spawn(serve_fake_provider(provider_listener));
    let runtime = RuntimeState::from_env()
        .await
        .expect("initialize full API runtime");

    tokio::task::LocalSet::new()
        .run_until(async move {
            let server_task = tokio::task::spawn_local(async move {
                run_server(runtime)
                    .await
                    .expect("API server should exit cleanly");
            });

            let api_url = format!("http://127.0.0.1:{api_port}");
            wait_for_health(&api_url).await;

            let health = get_backend_health()
                .await
                .expect("desktop health bridge should reach API");
            assert_eq!(health.status, "healthy");

            let agent_name = get_agent_status(&api_url)
                .await
                .expect("desktop status bridge should reach API");
            assert_eq!(agent_name, "AgentiCOS");

            let session_id = "desktop-e2e-session";
            let response = send_message(
                UserMessage {
                    content: "desktop API provider E2E".to_string(),
                    session_id: Some(session_id.to_string()),
                },
                &api_url,
            )
            .await
            .expect("desktop bridge should receive provider response");

            assert_eq!(response.content, "E2E provider response");
            assert_eq!(response.session_id, session_id);
            assert!(response.is_complete);

            let lease_pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect(&database_url)
                .await
                .expect("open E2E database");
            let active_leases: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM run_leases")
                .fetch_one(&lease_pool)
                .await
                .expect("query persisted run leases");
            assert_eq!(
                active_leases, 0,
                "successful chat must release its durable run lease"
            );
            drop(lease_pool);

            let history = get_conversation_history_from_api(session_id, &api_url)
                .await
                .expect("desktop bridge should read persisted history");
            assert!(
                history.iter().any(
                    |entry| entry.role == "user" && entry.content == "desktop API provider E2E"
                ),
                "user turn should be persisted"
            );

            provider_task
                .await
                .expect("fake provider task should succeed");
            server_task.abort();
        })
        .await;

    let _ = std::fs::remove_dir_all(temp_root);
}
