use crate::{
    CredentialPool, HealthChecker, ModelCatalog, ProviderRegistry, QuotaTracker, RetryManager,
};
use agenticos_contracts::{
    ContractError, Credential, HealthCheck, HealthStatus, ModelProvider, ModelRequest,
    ModelResponse, ProviderEntry,
};
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize)]
/// Public provider status without secrets.
pub struct ProviderStatus {
    /// Provider identifier.
    pub provider_id: String,
    /// Provider display name.
    pub name: String,
    /// Whether a credential is configured.
    pub configured: bool,
    /// Models declared by the provider.
    pub models: Vec<String>,
    /// Health status.
    pub health: String,
}

/// Multi-provider runtime platform.
#[derive(Debug, Clone)]
pub struct ProviderPlatform {
    registry: Arc<ProviderRegistry>,
    catalog: Arc<ModelCatalog>,
    credentials: Arc<CredentialPool>,
    quotas: Arc<QuotaTracker>,
    health: Arc<HealthChecker>,
    retries: Arc<RetryManager>,
}

impl ProviderPlatform {
    /// Create an empty provider platform.
    pub fn new() -> Self {
        Self {
            registry: Arc::new(ProviderRegistry::new()),
            catalog: Arc::new(ModelCatalog::new()),
            credentials: Arc::new(CredentialPool::new()),
            quotas: Arc::new(QuotaTracker::new()),
            health: Arc::new(HealthChecker::new()),
            retries: Arc::new(RetryManager::new()),
        }
    }

    /// Register a provider and its optional secret.
    pub async fn register(
        &self,
        entry: ProviderEntry,
        api_key: Option<String>,
    ) -> Result<(), ContractError> {
        let provider_id = entry.provider_id.clone();
        self.registry.register(entry.clone()).await?;
        for model in &entry.models {
            self.catalog
                .register(agenticos_contracts::ModelEntry {
                    model_id: model.clone(),
                    provider_id: provider_id.clone(),
                    name: model.clone(),
                    context_window: None,
                    capabilities: entry.capabilities.clone(),
                })
                .await?;
        }
        if let Some(key) = api_key.filter(|key| !key.trim().is_empty()) {
            self.credentials
                .add(Credential {
                    credential_id: format!("cred-{}", provider_id),
                    provider_id: provider_id.clone(),
                    credential_type: "api_key".to_string(),
                    value: key,
                    expires_at: 0,
                    scope: None,
                })
                .await?;
        }
        self.health
            .update(HealthCheck {
                provider_id,
                status: HealthStatus::Unknown,
                last_check: unix_time(),
                message: None,
            })
            .await?;
        Ok(())
    }

    /// List provider status without exposing API keys.
    pub async fn list_status(&self) -> Vec<ProviderStatus> {
        let providers = self.registry.list().await;
        let mut result = Vec::with_capacity(providers.len());
        for provider in providers {
            let configured = !self
                .credentials
                .get_for_provider(&provider.provider_id)
                .await
                .is_empty()
                || allows_anonymous_provider(&provider.base_url);
            let health = self
                .health
                .get(&provider.provider_id)
                .await
                .map(|check| format!("{:?}", check.status))
                .unwrap_or_else(|| "Unknown".to_string());
            result.push(ProviderStatus {
                provider_id: provider.provider_id,
                name: provider.name,
                configured,
                models: provider.models,
                health,
            });
        }
        result
    }

    /// Route a model request to the first compatible healthy provider.
    pub async fn execute_routed(
        &self,
        request: ModelRequest,
    ) -> Result<ModelResponse, ContractError> {
        let providers = self.registry.list().await;
        let mut last_error = None;
        for provider in providers {
            let effective_model = if request.model == "default" || request.model == "default-model"
            {
                provider
                    .models
                    .first()
                    .cloned()
                    .unwrap_or_else(|| request.model.clone())
            } else {
                request.model.clone()
            };
            if !provider.models.is_empty()
                && !provider
                    .models
                    .iter()
                    .any(|model| model == &effective_model)
            {
                continue;
            }
            let routed_request = ModelRequest {
                model: effective_model,
                ..request.clone()
            };
            let credential = self
                .credentials
                .get_for_provider(&provider.provider_id)
                .await
                .into_iter()
                .find(|credential| {
                    credential.expires_at == 0 || credential.expires_at > unix_time()
                });

            if credential.is_none() && !allows_anonymous_provider(&provider.base_url) {
                continue;
            }

            let policy = self
                .retries
                .get_policy(&provider.provider_id)
                .await
                .unwrap_or(agenticos_contracts::RetryPolicy {
                    max_attempts: 3,
                    initial_backoff_ms: 250,
                    max_backoff_ms: 4_000,
                    exponential_backoff: true,
                });
            for attempt in 0..policy.max_attempts.max(1) {
                let client = AuthenticatedOpenAiProvider::new(
                    provider.provider_id.clone(),
                    provider.base_url.clone(),
                    credential.as_ref().map(|value| value.value.clone()),
                );
                match client.execute(routed_request.clone()).await {
                    Ok(response) => {
                        if let Some(tokens) = response.tokens_used {
                            let _ = self.quotas.increment_usage(&provider.provider_id).await;
                            let _ = tokens;
                        } else {
                            let _ = self.quotas.increment_usage(&provider.provider_id).await;
                        }
                        let _ = self
                            .health
                            .update(HealthCheck {
                                provider_id: provider.provider_id.clone(),
                                status: HealthStatus::Healthy,
                                last_check: unix_time(),
                                message: None,
                            })
                            .await;
                        return Ok(response);
                    }
                    Err(error) => {
                        last_error = Some(error);
                        if attempt + 1 < policy.max_attempts.max(1) {
                            let backoff = if policy.exponential_backoff {
                                policy
                                    .initial_backoff_ms
                                    .saturating_mul(2u64.saturating_pow(attempt))
                            } else {
                                policy.initial_backoff_ms
                            }
                            .min(policy.max_backoff_ms);
                            sleep(Duration::from_millis(backoff)).await;
                        }
                    }
                }
            }
            let _ = self
                .health
                .update(HealthCheck {
                    provider_id: provider.provider_id,
                    status: HealthStatus::Degraded,
                    last_check: unix_time(),
                    message: last_error.as_ref().map(ToString::to_string),
                })
                .await;
        }
        Err(last_error.unwrap_or(ContractError::MissingCapability))
    }

    /// Seed a default provider from environment variables.
    pub async fn from_env() -> Result<Self, ContractError> {
        let platform = Self::new();
        let provider_id = std::env::var("AGENTICOS_PROVIDER_NAME")
            .unwrap_or_else(|_| "openai-compatible".to_string());
        let base_url = std::env::var("AGENTICOS_PROVIDER_URL")
            .unwrap_or_else(|_| "https://api.openai.com/v1/chat/completions".to_string());
        let model = std::env::var("AGENTICOS_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());
        let key = std::env::var("AGENTICOS_API_KEY").ok();
        platform
            .register(
                ProviderEntry {
                    provider_id,
                    name: "Environment provider".to_string(),
                    base_url,
                    models: vec![model],
                    capabilities: vec!["chat".to_string()],
                },
                key,
            )
            .await?;
        Ok(platform)
    }

    /// List known models.
    pub async fn list_models(&self) -> Vec<agenticos_contracts::ModelEntry> {
        self.catalog.list().await
    }
}

impl Default for ProviderPlatform {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
struct AuthenticatedOpenAiProvider {
    provider_id: String,
    base_url: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

impl AuthenticatedOpenAiProvider {
    fn new(provider_id: String, base_url: String, api_key: Option<String>) -> Self {
        Self {
            provider_id,
            base_url: normalize_chat_url(&base_url),
            api_key,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait::async_trait]
impl ModelProvider for AuthenticatedOpenAiProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        let request_id = request.request_id.clone();
        let mut request_builder = self.client.post(&self.base_url).json(&serde_json::json!({
            "model": request.model,
            "messages": [{"role": "user", "content": request.input}],
            "stream": false,
            "request_id": request_id
        }));
        if let Some(api_key) = &self.api_key {
            request_builder = request_builder.bearer_auth(api_key);
        }
        let response = request_builder.send().await.map_err(|error| {
            ContractError::ParseError(format!("provider request failed: {error}"))
        })?;

        let status = response.status();
        let body = response.text().await.map_err(|error| {
            ContractError::ParseError(format!("provider response failed: {error}"))
        })?;
        if !status.is_success() {
            return Err(ContractError::ParseError(format!(
                "provider returned HTTP {status}: {body}"
            )));
        }
        let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
            ContractError::ParseError(format!("invalid provider response: {error}"))
        })?;
        let output = json
            .get("choices")
            .and_then(|value| value.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .filter(|content| !content.trim().is_empty())
            .or_else(|| json.get("output").and_then(|value| value.as_str()))
            .ok_or_else(|| {
                ContractError::ParseError("provider response has no text output".to_string())
            })?;
        Ok(ModelResponse {
            request_id,
            output: output.to_string(),
            metadata: Some(format!("provider={}", self.provider_id)),
            tokens_used: json
                .get("usage")
                .and_then(|usage| usage.get("total_tokens"))
                .and_then(|v| v.as_u64()),
        })
    }
}

fn normalize_chat_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

fn unix_time() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[async_trait::async_trait]
impl ModelProvider for ProviderPlatform {
    fn provider_id(&self) -> &str {
        "agenticos-provider-platform"
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        self.execute_routed(request).await
    }
}

fn allows_anonymous_provider(base_url: &str) -> bool {
    let explicit = std::env::var("AGENTICOS_ALLOW_ANONYMOUS_PROVIDER")
        .map(|value| value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if explicit {
        return true;
    }

    let normalized = base_url.trim().trim_end_matches('/');
    normalized.starts_with("http://127.0.0.1:")
        || normalized.starts_with("http://localhost")
        || normalized.starts_with("https://127.0.0.1:")
        || normalized.starts_with("https://localhost")
        || normalized.starts_with("http://[::1]:")
        || normalized.starts_with("https://[::1]:")
}
