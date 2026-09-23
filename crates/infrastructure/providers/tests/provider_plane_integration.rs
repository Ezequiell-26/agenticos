use agenticos_contracts::{
    Credential, FallbackConfig, HealthCheck, HealthStatus, ModelEntry, ModelRequest, ProviderEntry,
    QuotaInfo, RetryPolicy,
};
use agenticos_providers::{
    CredentialPool, FallbackManager, HealthChecker, HttpModelProvider, ModelCatalog,
    ProviderRegistry, QuotaTracker, RetryManager,
};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;

fn provider(id: &str, models: &[&str]) -> ProviderEntry {
    ProviderEntry {
        provider_id: id.to_string(),
        name: format!("Provider {id}"),
        base_url: format!("https://{id}.example.test"),
        models: models.iter().map(|model| (*model).to_string()).collect(),
        capabilities: vec!["chat".to_string()],
    }
}

fn model(provider_id: &str, model_id: &str) -> ModelEntry {
    ModelEntry {
        model_id: model_id.to_string(),
        provider_id: provider_id.to_string(),
        name: model_id.to_string(),
        context_window: Some(32_768),
        capabilities: vec!["chat".to_string()],
    }
}

fn credential(provider_id: &str, id: &str) -> Credential {
    Credential {
        credential_id: id.to_string(),
        provider_id: provider_id.to_string(),
        credential_type: "api_key".to_string(),
        value: format!("test-secret-{id}"),
        expires_at: 0,
        scope: Some("chat".to_string()),
    }
}

fn spawn_http_response_server(response_body: &'static str) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind test HTTP server");
    let address = listener.local_addr().expect("read local address");

    let handle = thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut request = [0_u8; 4096];
            let _ = stream.read(&mut request);

            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write test HTTP response");
            stream.flush().expect("flush test HTTP response");
        }
    });

    (format!("http://{}", address), handle)
}

async fn select_healthy_provider(
    primary: &str,
    fallback_manager: &FallbackManager,
    health_checker: &HealthChecker,
) -> Option<String> {
    let mut current = primary.to_string();

    loop {
        if health_checker.is_healthy(&current).await {
            return Some(current);
        }

        let next = fallback_manager
            .get_next_provider(primary, &current)
            .await?;
        current = next;
    }
}

#[tokio::test]
async fn provider_registry_and_model_catalog_compose_across_multiple_providers() {
    let registry = ProviderRegistry::new();
    let catalog = ModelCatalog::new();

    registry
        .register(provider("primary", &["model-primary"]))
        .await
        .expect("register primary");
    registry
        .register(provider("fallback", &["model-fallback"]))
        .await
        .expect("register fallback");

    catalog
        .register(model("primary", "model-primary"))
        .await
        .expect("register primary model");
    catalog
        .register(model("fallback", "model-fallback"))
        .await
        .expect("register fallback model");

    let providers = registry.list().await;
    assert_eq!(providers.len(), 2);

    let primary_models = catalog.list_by_provider("primary").await;
    let fallback_models = catalog.list_by_provider("fallback").await;

    assert_eq!(primary_models.len(), 1);
    assert_eq!(fallback_models.len(), 1);
    assert_eq!(
        primary_models[0].provider_id,
        providers
            .iter()
            .find(|p| p.provider_id == "primary")
            .unwrap()
            .provider_id
    );
    assert_eq!(fallback_models[0].provider_id, "fallback");
}

#[tokio::test]
async fn provider_failover_follows_declared_order() {
    let fallback_manager = FallbackManager::new();

    fallback_manager
        .set_config(FallbackConfig {
            primary_provider: "primary".to_string(),
            fallback_providers: vec!["fallback-a".to_string(), "fallback-b".to_string()],
            auto_failover: true,
        })
        .await
        .expect("configure failover");

    assert_eq!(
        fallback_manager
            .get_next_provider("primary", "primary")
            .await
            .as_deref(),
        Some("fallback-a")
    );
    assert_eq!(
        fallback_manager
            .get_next_provider("primary", "fallback-a")
            .await
            .as_deref(),
        Some("fallback-b")
    );
    assert_eq!(
        fallback_manager
            .get_next_provider("primary", "fallback-b")
            .await,
        None
    );
}

#[tokio::test]
async fn health_check_drives_failover_selection() {
    let fallback_manager = FallbackManager::new();
    let health_checker = HealthChecker::new();

    fallback_manager
        .set_config(FallbackConfig {
            primary_provider: "primary".to_string(),
            fallback_providers: vec!["fallback-a".to_string(), "fallback-b".to_string()],
            auto_failover: true,
        })
        .await
        .expect("configure failover");

    health_checker
        .update(HealthCheck {
            provider_id: "primary".to_string(),
            status: HealthStatus::Unhealthy,
            last_check: 1,
            message: Some("test outage".to_string()),
        })
        .await
        .expect("record primary health");

    health_checker
        .update(HealthCheck {
            provider_id: "fallback-a".to_string(),
            status: HealthStatus::Degraded,
            last_check: 1,
            message: Some("degraded".to_string()),
        })
        .await
        .expect("record first fallback health");

    health_checker
        .update(HealthCheck {
            provider_id: "fallback-b".to_string(),
            status: HealthStatus::Healthy,
            last_check: 1,
            message: Some("ready".to_string()),
        })
        .await
        .expect("record second fallback health");

    assert!(!health_checker.is_healthy("primary").await);
    assert!(!health_checker.is_healthy("fallback-a").await);
    assert!(health_checker.is_healthy("fallback-b").await);

    let selected = select_healthy_provider("primary", &fallback_manager, &health_checker).await;

    assert_eq!(selected.as_deref(), Some("fallback-b"));
}

#[tokio::test]
async fn retry_policy_and_quota_state_can_be_combined_for_resilient_provider_work() {
    let retry_manager = RetryManager::new();
    let quota_tracker = QuotaTracker::new();

    retry_manager
        .set_policy(
            "primary".to_string(),
            RetryPolicy {
                max_attempts: 3,
                initial_backoff_ms: 25,
                max_backoff_ms: 100,
                exponential_backoff: true,
            },
        )
        .await
        .expect("set retry policy");

    quota_tracker
        .set_quota(QuotaInfo {
            provider_id: "primary".to_string(),
            requests_per_minute: Some(60),
            tokens_per_minute: Some(100_000),
            current_usage: 0,
        })
        .await
        .expect("set quota");

    let policy = retry_manager
        .get_policy("primary")
        .await
        .expect("read retry policy");

    assert_eq!(policy.max_attempts, 3);
    assert!(policy.exponential_backoff);
    assert_eq!(policy.initial_backoff_ms, 25);
    assert_eq!(policy.max_backoff_ms, 100);

    quota_tracker
        .increment_usage("primary")
        .await
        .expect("increment quota");

    assert_eq!(
        quota_tracker
            .get("primary")
            .await
            .expect("read quota")
            .current_usage,
        1
    );
}

#[tokio::test]
async fn credential_pool_keeps_credentials_scoped_to_their_provider() {
    let pool = CredentialPool::new();

    pool.add(credential("primary", "primary-key"))
        .await
        .expect("add primary credential");
    pool.add(credential("fallback", "fallback-key"))
        .await
        .expect("add fallback credential");

    let primary = pool.get_for_provider("primary").await;
    let fallback = pool.get_for_provider("fallback").await;

    assert_eq!(primary.len(), 1);
    assert_eq!(primary[0].provider_id, "primary");
    assert_eq!(fallback.len(), 1);
    assert_eq!(fallback[0].provider_id, "fallback");
}

#[tokio::test]
async fn http_model_provider_executes_against_a_deterministic_local_provider() {
    let body =
        r#"{"choices":[{"message":{"content":"integration-ok"}}],"usage":{"total_tokens":7}}"#;
    let (base_url, server) = spawn_http_response_server(body);

    let provider = HttpModelProvider::new("local-test".to_string(), base_url);
    let response = provider
        .execute(ModelRequest {
            request_id: "integration-request-1".to_string(),
            model: "test-model".to_string(),
            input: "hello".to_string(),
            parameters: None,
        })
        .await
        .expect("provider execution");

    server.join().expect("join test HTTP server");

    assert_eq!(response.request_id, "integration-request-1");
    assert_eq!(response.output, "integration-ok");
    assert_eq!(response.tokens_used, Some(7));
    assert!(response
        .metadata
        .as_deref()
        .is_some_and(|value| value.contains("local-test")));
}
