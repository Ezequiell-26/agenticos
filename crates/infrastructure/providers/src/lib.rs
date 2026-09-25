#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! model/provider adapters boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContractError, Credential, FallbackConfig, HealthCheck, HealthStatus, ModelEntry, ModelProvider,
    ModelRequest, ModelResponse, ProviderEntry, QuotaInfo, RetryPolicy,
};
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-providers";

pub mod embeddings;
pub use embeddings::OpenAiCompatibleEmbeddingProvider;

/// In-memory provider registry.
#[derive(Debug)]
pub struct ProviderRegistry {
    providers: Arc<RwLock<HashMap<String, ProviderEntry>>>,
}

impl ProviderRegistry {
    /// Create a new provider registry.
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a provider.
    pub async fn register(&self, entry: ProviderEntry) -> Result<(), ContractError> {
        let mut providers = self.providers.write().await;
        providers.insert(entry.provider_id.clone(), entry);
        Ok(())
    }

    /// Get a provider by ID.
    pub async fn get(&self, provider_id: &str) -> Option<ProviderEntry> {
        let providers = self.providers.read().await;
        providers.get(provider_id).cloned()
    }

    /// Remove a provider and return whether it existed.
    pub async fn remove(&self, provider_id: &str) -> bool {
        self.providers.write().await.remove(provider_id).is_some()
    }

    /// List all providers.
    pub async fn list(&self) -> Vec<ProviderEntry> {
        let mut providers: Vec<_> = self.providers.read().await.values().cloned().collect();
        providers.sort_by(|left, right| left.provider_id.cmp(&right.provider_id));
        providers
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// In-memory model catalog.
#[derive(Debug)]
pub struct ModelCatalog {
    models: Arc<RwLock<HashMap<String, ModelEntry>>>,
}

impl ModelCatalog {
    /// Create a new model catalog.
    pub fn new() -> Self {
        Self {
            models: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a model.
    pub async fn register(&self, entry: ModelEntry) -> Result<(), ContractError> {
        let mut models = self.models.write().await;
        models.insert(entry.model_id.clone(), entry);
        Ok(())
    }

    /// Get a model by ID.
    pub async fn get(&self, model_id: &str) -> Option<ModelEntry> {
        let models = self.models.read().await;
        models.get(model_id).cloned()
    }

    /// List all models.
    pub async fn list(&self) -> Vec<ModelEntry> {
        let mut models: Vec<_> = self.models.read().await.values().cloned().collect();
        models.sort_by(|left, right| left.model_id.cmp(&right.model_id));
        models
    }

    /// Remove all models owned by a provider.
    pub async fn remove_by_provider(&self, provider_id: &str) -> usize {
        let mut models = self.models.write().await;
        let before = models.len();
        models.retain(|_, model| model.provider_id != provider_id);
        before - models.len()
    }

    /// List models by provider.
    pub async fn list_by_provider(&self, provider_id: &str) -> Vec<ModelEntry> {
        let models = self.models.read().await;
        let mut models: Vec<_> = models
            .values()
            .filter(|m| m.provider_id == provider_id)
            .cloned()
            .collect();
        models.sort_by(|left, right| left.model_id.cmp(&right.model_id));
        models
    }
}

impl Default for ModelCatalog {
    fn default() -> Self {
        Self::new()
    }
}

/// In-memory credential pool.
#[derive(Debug)]
pub struct CredentialPool {
    credentials: Arc<RwLock<HashMap<String, Credential>>>,
}

impl CredentialPool {
    /// Create a new credential pool.
    pub fn new() -> Self {
        Self {
            credentials: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a credential.
    pub async fn add(&self, credential: Credential) -> Result<(), ContractError> {
        let mut credentials = self.credentials.write().await;
        credentials.insert(credential.credential_id.clone(), credential);
        Ok(())
    }

    /// Get a credential by ID.
    pub async fn get(&self, credential_id: &str) -> Option<Credential> {
        let credentials = self.credentials.read().await;
        credentials.get(credential_id).cloned()
    }

    /// Get credentials for a provider.
    pub async fn get_for_provider(&self, provider_id: &str) -> Vec<Credential> {
        let credentials = self.credentials.read().await;
        let mut credentials: Vec<_> = credentials
            .values()
            .filter(|c| c.provider_id == provider_id)
            .cloned()
            .collect();
        credentials.sort_by(|left, right| left.credential_id.cmp(&right.credential_id));
        credentials
    }

    /// Remove all credentials owned by a provider.
    pub async fn remove_for_provider(&self, provider_id: &str) -> usize {
        let mut credentials = self.credentials.write().await;
        let before = credentials.len();
        credentials.retain(|_, credential| credential.provider_id != provider_id);
        before - credentials.len()
    }

    /// Remove expired credentials.
    pub async fn remove_expired(&self, now: u64) -> Result<usize, ContractError> {
        let mut credentials = self.credentials.write().await;
        let before = credentials.len();
        credentials.retain(|_, c| c.expires_at == 0 || c.expires_at > now);
        Ok(before - credentials.len())
    }
}

impl Default for CredentialPool {
    fn default() -> Self {
        Self::new()
    }
}

/// Runtime quota state tracked in a rolling one-minute request window.
#[derive(Clone, Debug)]
struct QuotaState {
    quota: QuotaInfo,
    window_started_at: u64,
    token_usage: u64,
    /// Token budget reserved by in-flight requests but not yet finalized.
    reserved_token_usage: u64,
}

/// Basic quota tracker.
#[derive(Debug)]
pub struct QuotaTracker {
    quotas: Arc<RwLock<HashMap<String, QuotaState>>>,
}

impl QuotaTracker {
    /// Create a new quota tracker.
    pub fn new() -> Self {
        Self {
            quotas: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn refresh_window(state: &mut QuotaState, now: u64) {
        if state.window_started_at == 0 || now.saturating_sub(state.window_started_at) >= 60 {
            state.window_started_at = now;
            state.quota.current_usage = 0;
            state.token_usage = 0;
        }
    }

    /// Set quota for a provider and start a new rolling request window.
    pub async fn set_quota(&self, quota: QuotaInfo) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        quotas.insert(
            quota.provider_id.clone(),
            QuotaState {
                quota,
                window_started_at: unix_time(),
                token_usage: 0,
                reserved_token_usage: 0,
            },
        );
        Ok(())
    }

    /// Restore quota state from durable storage.
    pub async fn restore_quota(
        &self,
        quota: QuotaInfo,
        window_started_at: u64,
        token_usage: u64,
    ) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        quotas.insert(
            quota.provider_id.clone(),
            QuotaState {
                quota,
                window_started_at,
                token_usage,
                reserved_token_usage: 0,
            },
        );
        Ok(())
    }

    /// Get quota for a provider.
    pub async fn get(&self, provider_id: &str) -> Option<QuotaInfo> {
        let mut quotas = self.quotas.write().await;
        let state = quotas.get_mut(provider_id)?;
        Self::refresh_window(state, unix_time());
        Some(state.quota.clone())
    }

    /// Consume one provider request when a quota is configured.
    ///
    /// This preserves the historical API and performs no token reservation.
    pub async fn consume_request(&self, provider_id: &str) -> Result<(), ContractError> {
        self.reserve_request(provider_id, None).await.map(|_| ())
    }

    /// Reserve a provider request and, when supplied, its expected token budget.
    ///
    /// Reservations are accounted atomically with the request count so concurrent
    /// executions cannot all observe the same remaining token capacity.
    pub async fn reserve_request(
        &self,
        provider_id: &str,
        token_budget: Option<u64>,
    ) -> Result<u64, ContractError> {
        let mut quotas = self.quotas.write().await;
        let Some(state) = quotas.get_mut(provider_id) else {
            return Ok(0);
        };

        Self::refresh_window(state, unix_time());

        if let Some(limit) = state.quota.requests_per_minute {
            if state.quota.current_usage >= u64::from(limit) {
                return Err(ContractError::ParseError(format!(
                    "provider request quota exceeded for {provider_id}: {limit} requests/minute"
                )));
            }
        }

        let accounted_tokens = state.token_usage.saturating_add(state.reserved_token_usage);
        if let Some(limit) = state.quota.tokens_per_minute {
            let limit = u64::from(limit);
            match token_budget {
                Some(budget) if accounted_tokens.saturating_add(budget) > limit => {
                    return Err(ContractError::ParseError(format!(
                        "provider token quota exceeded for {provider_id}: requested {budget}, remaining {}",
                        limit.saturating_sub(accounted_tokens)
                    )));
                }
                None if accounted_tokens >= limit => {
                    return Err(ContractError::ParseError(format!(
                        "provider token quota exceeded for {provider_id}: {limit} tokens/minute"
                    )));
                }
                _ => {}
            }
        }

        state.quota.current_usage = state.quota.current_usage.saturating_add(1);
        let reservation = token_budget.unwrap_or(0);
        state.reserved_token_usage = state.reserved_token_usage.saturating_add(reservation);
        Ok(reservation)
    }

    /// Release an in-flight token reservation after an unsuccessful attempt.
    pub async fn release_token_reservation(
        &self,
        provider_id: &str,
        reservation: u64,
    ) -> Result<(), ContractError> {
        if reservation == 0 {
            return Ok(());
        }
        let mut quotas = self.quotas.write().await;
        let Some(state) = quotas.get_mut(provider_id) else {
            return Ok(());
        };
        Self::refresh_window(state, unix_time());
        state.reserved_token_usage = state.reserved_token_usage.saturating_sub(reservation);
        Ok(())
    }

    /// Return quota state together with the active request-window start.
    pub async fn get_state(&self, provider_id: &str) -> Option<(QuotaInfo, u64, u64)> {
        let mut quotas = self.quotas.write().await;
        let state = quotas.get_mut(provider_id)?;
        Self::refresh_window(state, unix_time());
        Some((
            state.quota.clone(),
            state.window_started_at,
            state.token_usage,
        ))
    }

    /// Return token usage for a provider in its active minute window.
    pub async fn token_usage(&self, provider_id: &str) -> Option<u64> {
        self.get_state(provider_id)
            .await
            .map(|(_, _, token_usage)| token_usage)
    }

    /// Record actual provider token usage.
    ///
    /// This never rejects the already-completed request. Once the configured
    /// token ceiling is reached, subsequent requests are blocked until the
    /// active window resets.
    pub async fn record_tokens(&self, provider_id: &str, tokens: u64) -> Result<(), ContractError> {
        self.record_tokens_with_reservation(provider_id, tokens, 0)
            .await
    }

    /// Reconcile actual token usage with a reservation made before execution.
    pub async fn record_tokens_with_reservation(
        &self,
        provider_id: &str,
        tokens: u64,
        reservation: u64,
    ) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        let state = quotas
            .get_mut(provider_id)
            .ok_or(ContractError::MissingCapability)?;
        Self::refresh_window(state, unix_time());
        state.reserved_token_usage = state.reserved_token_usage.saturating_sub(reservation);
        state.token_usage = state.token_usage.saturating_add(tokens);
        Ok(())
    }

    /// Increment usage for a provider.
    ///
    /// This preserves the historical API while enforcing the configured
    /// requests-per-minute limit when one exists.
    pub async fn increment_usage(&self, provider_id: &str) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        let state = quotas
            .get_mut(provider_id)
            .ok_or(ContractError::MissingCapability)?;
        Self::refresh_window(state, unix_time());
        if let Some(limit) = state.quota.requests_per_minute {
            if state.quota.current_usage >= u64::from(limit) {
                return Err(ContractError::ParseError(format!(
                    "provider request quota exceeded for {provider_id}: {limit} requests/minute"
                )));
            }
        }
        if let Some(limit) = state.quota.tokens_per_minute {
            if state.token_usage >= u64::from(limit) {
                return Err(ContractError::ParseError(format!(
                    "provider token quota exceeded for {provider_id}: {limit} tokens/minute"
                )));
            }
        }
        state.quota.current_usage = state.quota.current_usage.saturating_add(1);
        Ok(())
    }
}

impl Default for QuotaTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Health checker for providers.
#[derive(Debug)]
pub struct HealthChecker {
    health_checks: Arc<RwLock<HashMap<String, HealthCheck>>>,
}

impl HealthChecker {
    /// Create a new health checker.
    pub fn new() -> Self {
        Self {
            health_checks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Update health status for a provider.
    pub async fn update(&self, check: HealthCheck) -> Result<(), ContractError> {
        let mut health_checks = self.health_checks.write().await;
        health_checks.insert(check.provider_id.clone(), check);
        Ok(())
    }

    /// Get health status for a provider.
    pub async fn get(&self, provider_id: &str) -> Option<HealthCheck> {
        let health_checks = self.health_checks.read().await;
        health_checks.get(provider_id).cloned()
    }

    /// Remove health state for a provider.
    pub async fn remove(&self, provider_id: &str) {
        self.health_checks.write().await.remove(provider_id);
    }

    /// Check if a provider is healthy.
    pub async fn is_healthy(&self, provider_id: &str) -> bool {
        let health_checks = self.health_checks.read().await;
        match health_checks.get(provider_id) {
            Some(check) => matches!(check.status, HealthStatus::Healthy),
            None => false,
        }
    }
}

impl Default for HealthChecker {
    fn default() -> Self {
        Self::new()
    }
}

/// Retry manager for provider requests.
#[derive(Debug)]
pub struct RetryManager {
    policies: Arc<RwLock<HashMap<String, RetryPolicy>>>,
}

impl RetryManager {
    /// Create a new retry manager.
    pub fn new() -> Self {
        Self {
            policies: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set retry policy for a provider.
    pub async fn set_policy(
        &self,
        provider_id: String,
        policy: RetryPolicy,
    ) -> Result<(), ContractError> {
        let mut policies = self.policies.write().await;
        policies.insert(provider_id, policy);
        Ok(())
    }

    /// Remove retry policy for a provider.
    pub async fn remove(&self, provider_id: &str) {
        self.policies.write().await.remove(provider_id);
    }

    /// Get retry policy for a provider.
    pub async fn get_policy(&self, provider_id: &str) -> Option<RetryPolicy> {
        let policies = self.policies.read().await;
        policies.get(provider_id).cloned()
    }
}

impl Default for RetryManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Fallback manager for provider failover.
#[derive(Debug)]
pub struct FallbackManager {
    configs: Arc<RwLock<HashMap<String, FallbackConfig>>>,
}

impl FallbackManager {
    /// Create a new fallback manager.
    pub fn new() -> Self {
        Self {
            configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set fallback configuration.
    pub async fn set_config(&self, config: FallbackConfig) -> Result<(), ContractError> {
        let mut configs = self.configs.write().await;
        configs.insert(config.primary_provider.clone(), config);
        Ok(())
    }

    /// Get fallback configuration for a provider.
    pub async fn get_config(&self, primary_provider: &str) -> Option<FallbackConfig> {
        let configs = self.configs.read().await;
        configs.get(primary_provider).cloned()
    }

    /// Return the configured primary provider when exactly one failover policy exists.
    pub async fn configured_primary_provider(&self) -> Option<String> {
        let configs = self.configs.read().await;
        if configs.len() != 1 {
            return None;
        }
        configs.keys().next().cloned()
    }

    /// Remove a provider from every fallback configuration and return the affected configs.
    pub async fn remove_provider_references(&self, provider_id: &str) -> Vec<FallbackConfig> {
        let mut configs = self.configs.write().await;
        let mut affected = Vec::new();
        configs.remove(provider_id);
        for config in configs.values_mut() {
            let before = config.fallback_providers.len();
            config
                .fallback_providers
                .retain(|provider| provider != provider_id);
            if config.fallback_providers.len() != before {
                affected.push(config.clone());
            }
        }
        affected
    }

    /// Get the next provider to try from fallback list.
    pub async fn get_next_provider(
        &self,
        primary_provider: &str,
        current_provider: &str,
    ) -> Option<String> {
        let configs = self.configs.read().await;
        if let Some(config) = configs.get(primary_provider) {
            if !config.auto_failover {
                return None;
            }

            let current_index = config
                .fallback_providers
                .iter()
                .position(|p| p == current_provider);
            if let Some(index) = current_index {
                if index + 1 < config.fallback_providers.len() {
                    return Some(config.fallback_providers[index + 1].clone());
                }
            } else if !config.fallback_providers.is_empty() {
                return Some(config.fallback_providers[0].clone());
            }
        }
        None
    }
}

impl Default for FallbackManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Shared HTTP client used by every provider adapter.
///
/// Reusing one client preserves connection pooling and keep-alive sockets across
/// provider requests instead of rebuilding the transport for every call.
static SHARED_HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub(crate) fn shared_http_client() -> reqwest::Client {
    SHARED_HTTP_CLIENT
        .get_or_init(|| {
            let timeout_ms = std::env::var("AGENTICOS_PROVIDER_TIMEOUT_MS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(120_000)
                .clamp(1_000, 600_000);
            let connect_timeout_ms = std::env::var("AGENTICOS_PROVIDER_CONNECT_TIMEOUT_MS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(10_000)
                .clamp(250, 120_000);
            let max_idle_per_host = std::env::var("AGENTICOS_HTTP_MAX_IDLE_PER_HOST")
                .ok()
                .and_then(|value| value.parse::<usize>().ok())
                .unwrap_or(8)
                .clamp(1, 32);
            let pool_idle_timeout_ms = std::env::var("AGENTICOS_HTTP_POOL_IDLE_TIMEOUT_MS")
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(90_000)
                .clamp(1_000, 600_000);

            reqwest::Client::builder()
                .connect_timeout(Duration::from_millis(connect_timeout_ms))
                .timeout(Duration::from_millis(timeout_ms))
                .pool_idle_timeout(Some(Duration::from_millis(pool_idle_timeout_ms)))
                .pool_max_idle_per_host(max_idle_per_host)
                .tcp_nodelay(true)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        })
        .clone()
}

/// Generic HTTP model provider.
#[derive(Debug)]
pub struct HttpModelProvider {
    provider_id: String,
    #[allow(dead_code)]
    base_url: String,
    #[allow(dead_code)]
    client: reqwest::Client,
}

impl HttpModelProvider {
    /// Create a new HTTP model provider.
    pub fn new(provider_id: String, base_url: String) -> Self {
        Self {
            provider_id,
            base_url,
            client: shared_http_client(),
        }
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

#[async_trait::async_trait]
impl ModelProvider for HttpModelProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        // Make actual HTTP call to the provider
        let url = normalize_chat_url(&self.base_url);
        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "model": request.model,
                "messages": [{"role": "user", "content": request.input}],
                "request_id": request.request_id
            }))
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.map_err(|error| {
                    ContractError::ParseError(format!("Provider response read failed: {}", error))
                })?;

                if !status.is_success() {
                    return Err(ContractError::ParseError(format!(
                        "Provider returned HTTP {}: {}",
                        status, body
                    )));
                }

                let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
                    ContractError::ParseError(format!(
                        "Invalid provider response for {}: {}",
                        self.provider_id, error
                    ))
                })?;

                let output = json["choices"][0]["message"]["content"]
                    .as_str()
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| {
                        ContractError::ParseError(format!(
                            "Provider {} returned no message content",
                            self.provider_id
                        ))
                    })?;

                let tokens_used = json["usage"]["total_tokens"]
                    .as_u64()
                    .unwrap_or(request.input.len() as u64);

                Ok(ModelResponse {
                    request_id: request.request_id,
                    output: output.to_string(),
                    metadata: Some(format!(
                        "provider: {}, model: {}",
                        self.provider_id, request.model
                    )),
                    tokens_used: Some(tokens_used),
                })
            }
            Err(error) => Err(ContractError::ParseError(format!(
                "Provider request failed for {}: {}",
                self.provider_id, error
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_normalize_chat_url() {
        assert_eq!(
            normalize_chat_url("http://localhost:8000"),
            "http://localhost:8000/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url("http://localhost:8000/v1"),
            "http://localhost:8000/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_url("http://localhost:8000/v1/chat/completions"),
            "http://localhost:8000/v1/chat/completions"
        );
    }

    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_provider_registry() {
        let rt = test_runtime();
        rt.block_on(async {
            let registry = ProviderRegistry::new();

            let entry = ProviderEntry {
                provider_id: "test-provider".to_string(),
                name: "Test Provider".to_string(),
                base_url: "https://api.example.com".to_string(),
                models: vec!["model-1".to_string(), "model-2".to_string()],
                capabilities: vec!["chat".to_string(), "completion".to_string()],
            };

            registry.register(entry.clone()).await.unwrap();

            let retrieved = registry.get("test-provider").await.unwrap();
            assert_eq!(retrieved.provider_id, "test-provider");

            let providers = registry.list().await;
            assert_eq!(providers.len(), 1);
        });
    }

    #[test]
    fn test_model_catalog() {
        let rt = test_runtime();
        rt.block_on(async {
            let catalog = ModelCatalog::new();

            let entry = ModelEntry {
                model_id: "test-model".to_string(),
                provider_id: "test-provider".to_string(),
                name: "Test Model".to_string(),
                context_window: Some(4096),
                capabilities: vec!["chat".to_string()],
            };

            catalog.register(entry.clone()).await.unwrap();

            let retrieved = catalog.get("test-model").await.unwrap();
            assert_eq!(retrieved.model_id, "test-model");

            let models = catalog.list_by_provider("test-provider").await;
            assert_eq!(models.len(), 1);
        });
    }

    #[test]
    fn test_credential_pool() {
        let rt = test_runtime();
        rt.block_on(async {
            let pool = CredentialPool::new();

            let credential = Credential {
                credential_id: "test-cred".to_string(),
                provider_id: "test-provider".to_string(),
                credential_type: "api_key".to_string(),
                value: "secret-key".to_string(),
                expires_at: 0,
                scope: Some("read".to_string()),
            };

            pool.add(credential.clone()).await.unwrap();

            let retrieved = pool.get("test-cred").await.unwrap();
            assert_eq!(retrieved.credential_id, "test-cred");

            let credentials = pool.get_for_provider("test-provider").await;
            assert_eq!(credentials.len(), 1);
        });
    }

    #[test]
    fn test_quota_tracker() {
        let rt = test_runtime();
        rt.block_on(async {
            let tracker = QuotaTracker::new();

            let quota = QuotaInfo {
                provider_id: "test-provider".to_string(),
                requests_per_minute: Some(100),
                tokens_per_minute: Some(10000),
                current_usage: 0,
            };

            tracker.set_quota(quota.clone()).await.unwrap();

            let retrieved = tracker.get("test-provider").await.unwrap();
            assert_eq!(retrieved.current_usage, 0);

            tracker.increment_usage("test-provider").await.unwrap();

            let updated = tracker.get("test-provider").await.unwrap();
            assert_eq!(updated.current_usage, 1);
        });
    }

    #[test]
    fn test_http_model_provider() {
        let rt = test_runtime();
        rt.block_on(async {
            use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
            use tokio::net::TcpListener;

            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let server = tokio::spawn(async move {
                let (stream, _) = listener.accept().await.unwrap();
                let (reader, mut writer) = stream.into_split();
                let mut reader = BufReader::new(reader);
                let mut line = String::new();
                while reader.read_line(&mut line).await.unwrap() > 0 {
                    if line == "\r\n" {
                        break;
                    }
                    line.clear();
                }
                let body = r#"{"choices":[{"message":{"content":"local fixture response"}}],"usage":{"total_tokens":7}}"#;
                let response = format!(
                    "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                writer.write_all(response.as_bytes()).await.unwrap();
            });

            let provider =
                HttpModelProvider::new("http-provider".to_string(), format!("http://{}", address));

            let request = ModelRequest {
                request_id: "req-1".to_string(),
                model: "test-model".to_string(),
                input: "Test input".to_string(),
                parameters: None,
            };

            let response = provider.execute(request).await.unwrap();

            assert_eq!(response.request_id, "req-1");
            assert_eq!(response.output, "local fixture response");
            assert_eq!(response.tokens_used, Some(7));
            server.await.unwrap();
        });
    }
    #[tokio::test]
    async fn quota_window_enforces_request_limit() {
        let tracker = Arc::new(QuotaTracker::new());
        tracker
            .set_quota(QuotaInfo {
                provider_id: "limited".to_string(),
                requests_per_minute: Some(2),
                tokens_per_minute: None,
                current_usage: 0,
            })
            .await
            .unwrap();

        tracker.consume_request("limited").await.unwrap();
        tracker.consume_request("limited").await.unwrap();
        let error = tracker
            .consume_request("limited")
            .await
            .expect_err("third request should exceed the configured limit");

        assert!(error.to_string().contains("quota exceeded"));
        assert_eq!(tracker.get("limited").await.unwrap().current_usage, 2);
    }

    #[tokio::test]
    async fn quota_window_resets_after_persisted_window_expires() {
        let tracker = QuotaTracker::new();
        tracker
            .restore_quota(
                QuotaInfo {
                    provider_id: "resettable".to_string(),
                    requests_per_minute: Some(10),
                    tokens_per_minute: None,
                    current_usage: 9,
                },
                unix_time().saturating_sub(61),
                0,
            )
            .await
            .unwrap();

        assert_eq!(tracker.get("resettable").await.unwrap().current_usage, 0);
        tracker.consume_request("resettable").await.unwrap();
        assert_eq!(tracker.get("resettable").await.unwrap().current_usage, 1);
    }

    #[tokio::test]
    async fn token_quota_blocks_requests_after_actual_usage_reaches_limit() {
        let tracker = QuotaTracker::new();
        tracker
            .set_quota(QuotaInfo {
                provider_id: "token-limited".to_string(),
                requests_per_minute: Some(100),
                tokens_per_minute: Some(10),
                current_usage: 0,
            })
            .await
            .unwrap();

        tracker.consume_request("token-limited").await.unwrap();
        tracker.record_tokens("token-limited", 10).await.unwrap();

        let error = tracker
            .consume_request("token-limited")
            .await
            .expect_err("token quota should block the next request");

        assert!(error.to_string().contains("token quota exceeded"));
        assert_eq!(tracker.token_usage("token-limited").await, Some(10));
    }

    #[tokio::test]
    async fn token_budget_reservation_is_atomic_and_releasable() {
        let tracker = QuotaTracker::new();
        tracker
            .set_quota(QuotaInfo {
                provider_id: "reserved".to_string(),
                requests_per_minute: Some(10),
                tokens_per_minute: Some(100),
                current_usage: 0,
            })
            .await
            .unwrap();

        assert_eq!(
            tracker.reserve_request("reserved", Some(80)).await.unwrap(),
            80
        );
        assert!(tracker.reserve_request("reserved", Some(30)).await.is_err());

        tracker
            .record_tokens_with_reservation("reserved", 55, 80)
            .await
            .unwrap();
        assert_eq!(tracker.token_usage("reserved").await, Some(55));

        assert_eq!(
            tracker.reserve_request("reserved", Some(45)).await.unwrap(),
            45
        );
        tracker
            .release_token_reservation("reserved", 45)
            .await
            .unwrap();
        assert_eq!(tracker.token_usage("reserved").await, Some(55));
    }

    #[test]
    fn test_health_checker() {
        let rt = test_runtime();
        rt.block_on(async {
            let checker = HealthChecker::new();

            let check = HealthCheck {
                provider_id: "test-provider".to_string(),
                status: HealthStatus::Healthy,
                last_check: 12345,
                message: Some("All good".to_string()),
            };

            checker.update(check.clone()).await.unwrap();

            let retrieved = checker.get("test-provider").await.unwrap();
            assert_eq!(retrieved.status, HealthStatus::Healthy);

            assert!(checker.is_healthy("test-provider").await);
        });
    }

    #[test]
    fn test_retry_manager() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = RetryManager::new();

            let policy = RetryPolicy {
                max_attempts: 3,
                initial_backoff_ms: 100,
                max_backoff_ms: 1000,
                exponential_backoff: true,
            };

            manager
                .set_policy("test-provider".to_string(), policy.clone())
                .await
                .unwrap();

            let retrieved = manager.get_policy("test-provider").await.unwrap();
            assert_eq!(retrieved.max_attempts, 3);
        });
    }

    #[test]
    fn test_fallback_manager() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = FallbackManager::new();

            let config = FallbackConfig {
                primary_provider: "primary".to_string(),
                fallback_providers: vec!["fallback1".to_string(), "fallback2".to_string()],
                auto_failover: true,
            };

            manager.set_config(config.clone()).await.unwrap();

            let retrieved = manager.get_config("primary").await.unwrap();
            assert_eq!(retrieved.fallback_providers.len(), 2);

            let next = manager
                .get_next_provider("primary", "primary")
                .await
                .unwrap();
            assert_eq!(next, "fallback1");
        });
    }
}

mod platform;
pub use platform::{ProviderPlatform, ProviderStatus};

fn unix_time() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
