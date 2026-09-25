use agenticos_api_server::{run_server, RuntimeState};
use agenticos_desktop::{
    get_agent_status, get_conversation_history_from_api, get_backend_health, send_message, UserMessage,
};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

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

async fn serve_fake_provider(listener: TcpListener) {
    let (mut socket, _) = listener.accept().await.expect("accept provider request");
    let mut request = Vec::with_capacity(8192);
    let mut buffer = [0_u8; 4096];

    let body_start = loop {
        let read = socket.read(&mut buffer).await.expect("read provider request");
        assert!(read > 0, "provider connection closed before headers");
        request.extend_from_slice(&buffer[..read]);
        if let Some(boundary) = header_body_boundary(&request) {
            break boundary;
        }
        assert!(request.len() < 128 * 1024, "provider request headers too large");
    };

    let expected_body_len = content_length(&request[..body_start - 4]);
    while request.len() < body_start + expected_body_len {
        let read = socket.read(&mut buffer).await.expect("read provider body");
        assert!(read > 0, "provider connection closed before body");
        request.extend_from_slice(&buffer[..read]);
    }

    let body = &request[body_start..body_start + expected_body_len];
    let payload: serde_json::Value =
        serde_json::from_slice(body).expect("provider body must be valid JSON");

    assert_eq!(payload["model"], "e2e-model");
    let user_input = payload["messages"][0]["content"]
        .as_str()
        .expect("provider request should contain user content");
    assert_eq!(user_input, "desktop API provider E2E");

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

    let response = format!(
        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
        response_body.len(),
        response_body
    );
    socket
        .write_all(response.as_bytes())
        .await
        .expect("write provider response");
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
        temp_root.display().replace('\\', "/")
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
    std::env::set_var(
        "AGENTICOS_PROJECT_PATH",
        std::env::current_dir().expect("workspace directory"),
    );
    std::env::set_var(
        "AGENTICOS_SKILLS_ROOT",
        std::env::current_dir()
            .expect("workspace directory")
            .join("skills"),
    );

    let provider_task = tokio::spawn(serve_fake_provider(provider_listener));
    let runtime = RuntimeState::from_env()
        .await
        .expect("initialize full API runtime");
    let server_task = tokio::spawn(async move {
        run_server(runtime).await.expect("API server should exit cleanly");
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

    let history = get_conversation_history_from_api(session_id, &api_url)
        .await
        .expect("desktop bridge should read persisted history");
    assert!(
        history
            .iter()
            .any(|entry| entry.role == "user" && entry.content == "desktop API provider E2E"),
        "user turn should be persisted"
    );

    provider_task
        .await
        .expect("fake provider task should succeed");
    server_task.abort();

    let _ = std::fs::remove_dir_all(temp_root);
}
