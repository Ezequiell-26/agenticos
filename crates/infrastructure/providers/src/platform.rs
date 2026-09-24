use crate::{
    CredentialPool, HealthChecker, ModelCatalog, ProviderRegistry, QuotaTracker, RetryManager,
};
use agenticos_contracts::{
    ContractError, Credential, HealthCheck, HealthStatus, ModelProvider, ModelRequest,
    ModelResponse, ProviderEntry,
};
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Deserialize)]
struct EnvProvider {
    provider_id: String,
    name: String,
    base_url: String,
    models: Vec<String>,
    capabilities: Vec<String>,
    api_key: Option<String>,
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
        let provider_id = entry.provider_id.trim().to_string();
        let name = entry.name.trim().to_string();
        let base_url = entry.base_url.trim().to_string();
        if provider_id.is_empty() || name.is_empty() || base_url.is_empty() {
            return Err(ContractError::ParseError(
                "provider_id, name and base_url are required".to_string(),
            ));
        }
        if provider_id.len() > 128 || name.len() > 256 || base_url.len() > 2048 {
            return Err(ContractError::ParseError(
                "provider metadata exceeds supported limits".to_string(),
            ));
        }
        let url = reqwest::Url::parse(&base_url)
            .map_err(|error| ContractError::ParseError(format!("invalid provider URL: {error}")))?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(ContractError::ParseError(
                "provider URL must use http or https".to_string(),
            ));
        }
        if entry.models.len() > 256 || entry.capabilities.len() > 128 {
            return Err(ContractError::ParseError(
                "provider catalog exceeds supported limits".to_string(),
            ));
        }
        if entry
            .models
            .iter()
            .any(|model| model.trim().is_empty() || model.len() > 256)
        {
            return Err(ContractError::ParseError(
                "provider contains an invalid model identifier".to_string(),
            ));
        }
        if entry
            .capabilities
            .iter()
            .any(|capability| capability.trim().is_empty() || capability.len() > 128)
        {
            return Err(ContractError::ParseError(
                "provider contains an invalid capability".to_string(),
            ));
        }
        let normalized_entry = ProviderEntry {
            provider_id: provider_id.clone(),
            name,
            base_url,
            models: entry
                .models
                .iter()
                .map(|model| model.trim().to_string())
                .collect(),
            capabilities: entry
                .capabilities
                .iter()
                .map(|capability| capability.trim().to_string())
                .collect(),
        };

        // Registration is replace semantics: stale models/credentials must not survive updates.
        self.catalog.remove_by_provider(&provider_id).await;
        self.credentials.remove_for_provider(&provider_id).await;
        self.registry.register(normalized_entry.clone()).await?;
        for model in &normalized_entry.models {
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
        let mut healthy = Vec::new();
        let mut other = Vec::new();
        for provider in providers {
            if self.health.is_healthy(&provider.provider_id).await {
                healthy.push(provider);
            } else {
                other.push(provider);
            }
        }
        healthy.extend(other);

        let mut last_error = None;
        for provider in healthy {
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
                )?;
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

        if let Ok(raw) = std::env::var("AGENTICOS_PROVIDERS_JSON") {
            let configured = serde_json::from_str::<Vec<EnvProvider>>(&raw).map_err(|error| {
                ContractError::ParseError(format!(
                    "AGENTICOS_PROVIDERS_JSON must be a JSON array: {error}"
                ))
            })?;
            if configured.is_empty() {
                return Err(ContractError::ParseError(
                    "AGENTICOS_PROVIDERS_JSON must contain at least one provider".to_string(),
                ));
            }
            for provider in configured {
                platform
                    .register(
                        ProviderEntry {
                            provider_id: provider.provider_id,
                            name: provider.name,
                            base_url: provider.base_url,
                            models: provider.models,
                            capabilities: provider.capabilities,
                        },
                        provider.api_key,
                    )
                    .await?;
            }
            return Ok(platform);
        }

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

    /// List models registered for a provider.
    pub async fn list_models_for_provider(
        &self,
        provider_id: &str,
    ) -> Vec<agenticos_contracts::ModelEntry> {
        self.catalog.list_by_provider(provider_id).await
    }

    /// Remove a provider and all runtime state associated with it.
    pub async fn unregister(&self, provider_id: &str) -> Result<bool, ContractError> {
        let removed = self.registry.remove(provider_id).await;
        if removed {
            self.catalog.remove_by_provider(provider_id).await;
            self.credentials.remove_for_provider(provider_id).await;
            self.health.remove(provider_id).await;
            self.retries.remove(provider_id).await;
        }
        Ok(removed)
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
    fn new(
        provider_id: String,
        base_url: String,
        api_key: Option<String>,
    ) -> Result<Self, ContractError> {
        let timeout_ms = std::env::var("AGENTICOS_PROVIDER_TIMEOUT_MS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(120_000)
            .clamp(1_000, 600_000);
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(timeout_ms))
            .build()
            .map_err(|error| {
                ContractError::ParseError(format!("provider client initialization failed: {error}"))
            })?;
        Ok(Self {
            provider_id,
            base_url: normalize_chat_url(&base_url),
            api_key,
            client,
        })
    }
}

#[async_trait::async_trait]
impl ModelProvider for AuthenticatedOpenAiProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        let request_id = request.request_id.clone();
        let mut payload = serde_json::json!({
            "model": request.model,
            "messages": [{"role": "user", "content": request.input}],
            "stream": false
        });

        if let Some(parameters) = &request.parameters {
            let extra = serde_json::from_str::<serde_json::Value>(parameters).map_err(|error| {
                ContractError::ParseError(format!(
                    "provider parameters must be valid JSON: {error}"
                ))
            })?;
            let extra_object = extra.as_object().ok_or_else(|| {
                ContractError::ParseError("provider parameters must be a JSON object".to_string())
            })?;
            let payload_object = payload.as_object_mut().ok_or_else(|| {
                ContractError::ParseError("provider request payload is not an object".to_string())
            })?;
            for (key, value) in extra_object {
                if !matches!(key.as_str(), "model" | "messages" | "stream" | "request_id") {
                    payload_object.insert(key.clone(), value.clone());
                }
            }
        }

        let mut request_builder = self
            .client
            .post(&self.base_url)
            .header("x-request-id", &request_id)
            .json(&payload);
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
            let mut detail = body;
            if detail.len() > 4_096 {
                detail.truncate(4_096);
                detail.push_str("...");
            }
            return Err(ContractError::ParseError(format!(
                "provider returned HTTP {status}: {detail}"
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


#[cfg(test)]
mod tests {
    #[test]
    fn anonymous_provider_detection_is_local_only_by_default() {
        assert!(super::allows_anonymous_provider("http://127.0.0.1:11434"));
        assert!(!super::allows_anonymous_provider("https://api.example.com"));
    }
}
