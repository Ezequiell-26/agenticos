#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! model/provider adapters boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContractError, Credential, FallbackConfig, HealthCheck, HealthStatus, ModelEntry,
    ModelProvider, ModelRequest, ModelResponse, ProviderEntry, QuotaInfo, RetryPolicy,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-adapters";

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
    /// List all providers.
    pub async fn list(&self) -> Vec<ProviderEntry> {
        let providers = self.providers.read().await;
        providers.values().cloned().collect()
    }
}
impl Default for ProviderRegistry { fn default() -> Self { Self::new() } }

/// In-memory model catalog.
#[derive(Debug)]
pub struct ModelCatalog { models: Arc<RwLock<HashMap<String, ModelEntry>>> }
impl ModelCatalog {
    /// Create a new model catalog.
    pub fn new() -> Self { Self { models: Arc::new(RwLock::new(HashMap::new())) } }
    /// Register a model.
    pub async fn register(&self, entry: ModelEntry) -> Result<(), ContractError> {
        let mut models = self.models.write().await; models.insert(entry.model_id.clone(), entry); Ok(())
    }
    /// Get a model by ID.
    pub async fn get(&self, model_id: &str) -> Option<ModelEntry> {
        let models = self.models.read().await; models.get(model_id).cloned()
    }
    /// List all models.
    pub async fn list(&self) -> Vec<ModelEntry> {
        let models = self.models.read().await; models.values().cloned().collect()
    }
    /// List models by provider.
    pub async fn list_by_provider(&self, provider_id: &str) -> Vec<ModelEntry> {
        let models = self.models.read().await;
        models.values().filter(|m| m.provider_id == provider_id).cloned().collect()
    }
}
impl Default for ModelCatalog { fn default() -> Self { Self::new() } }

/// In-memory credential pool.
#[derive(Debug)]
pub struct CredentialPool { credentials: Arc<RwLock<HashMap<String, Credential>>> }
impl CredentialPool {
    /// Create a new credential pool.
    pub fn new() -> Self { Self { credentials: Arc::new(RwLock::new(HashMap::new())) } }
    /// Add a credential.
    pub async fn add(&self, credential: Credential) -> Result<(), ContractError> {
        let mut credentials = self.credentials.write().await; credentials.insert(credential.credential_id.clone(), credential); Ok(())
    }
    /// Get a credential by ID.
    pub async fn get(&self, credential_id: &str) -> Option<Credential> {
        let credentials = self.credentials.read().await; credentials.get(credential_id).cloned()
    }
    /// Get credentials for a provider.
    pub async fn get_for_provider(&self, provider_id: &str) -> Vec<Credential> {
        let credentials = self.credentials.read().await;
        credentials.values().filter(|c| c.provider_id == provider_id).cloned().collect()
    }
    /// Remove expired credentials.
    pub async fn remove_expired(&self, now: u64) -> Result<usize, ContractError> {
        let mut credentials = self.credentials.write().await;
        let before = credentials.len();
        credentials.retain(|_, c| c.expires_at == 0 || c.expires_at > now);
        Ok(before - credentials.len())
    }
}
impl Default for CredentialPool { fn default() -> Self { Self::new() } }

/// Basic quota tracker.
#[derive(Debug)]
pub struct QuotaTracker { quotas: Arc<RwLock<HashMap<String, QuotaInfo>>> }
impl QuotaTracker {
    /// Create a new quota tracker.
    pub fn new() -> Self { Self { quotas: Arc::new(RwLock::new(HashMap::new())) } }
    /// Set quota for a provider.
    pub async fn set_quota(&self, quota: QuotaInfo) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await; quotas.insert(quota.provider_id.clone(), quota); Ok(())
    }
    /// Get quota for a provider.
    pub async fn get(&self, provider_id: &str) -> Option<QuotaInfo> {
        let quotas = self.quotas.read().await; quotas.get(provider_id).cloned()
    }
    /// Increment usage for a provider.
    pub async fn increment_usage(&self, provider_id: &str) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        if let Some(quota) = quotas.get_mut(provider_id) { quota.current_usage += 1; Ok(()) } else { Err(ContractError::MissingCapability) }
    }
}
impl Default for QuotaTracker { fn default() -> Self { Self::new() } }

/// Health checker for providers.
#[derive(Debug)]
pub struct HealthChecker { health_checks: Arc<RwLock<HashMap<String, HealthCheck>>> }
impl HealthChecker {
    /// Create a new health checker.
    pub fn new() -> Self { Self { health_checks: Arc::new(RwLock::new(HashMap::new())) } }
    /// Update health status for a provider.
    pub async fn update(&self, check: HealthCheck) -> Result<(), ContractError> {
        let mut health_checks = self.health_checks.write().await; health_checks.insert(check.provider_id.clone(), check); Ok(())
    }
    /// Get health status for a provider.
    pub async fn get(&self, provider_id: &str) -> Option<HealthCheck> {
        let health_checks = self.health_checks.read().await; health_checks.get(provider_id).cloned()
    }
    /// Check if a provider is healthy.
    pub async fn is_healthy(&self, provider_id: &str) -> bool {
        let health_checks = self.health_checks.read().await;
        match health_checks.get(provider_id) { Some(check) => matches!(check.status, HealthStatus::Healthy), None => false }
    }
}
impl Default for HealthChecker { fn default() -> Self { Self::new() } }

/// Retry manager for provider requests.
#[derive(Debug)]
pub struct RetryManager { policies: Arc<RwLock<HashMap<String, RetryPolicy>>> }
impl RetryManager {
    /// Create a new retry manager.
    pub fn new() -> Self { Self { policies: Arc::new(RwLock::new(HashMap::new())) } }
    /// Set retry policy for a provider.
    pub async fn set_policy(&self, provider_id: String, policy: RetryPolicy) -> Result<(), ContractError> {
        let mut policies = self.policies.write().await; policies.insert(provider_id, policy); Ok(())
    }
    /// Get retry policy for a provider.
    pub async fn get_policy(&self, provider_id: &str) -> Option<RetryPolicy> {
        let policies = self.policies.read().await; policies.get(provider_id).cloned()
    }
}
impl Default for RetryManager { fn default() -> Self { Self::new() } }

/// Fallback manager for provider failover.
#[derive(Debug)]
pub struct FallbackManager { configs: Arc<RwLock<HashMap<String, FallbackConfig>>> }
impl FallbackManager {
    /// Create a new fallback manager.
    pub fn new() -> Self { Self { configs: Arc::new(RwLock::new(HashMap::new())) } }
    /// Set fallback configuration.
    pub async fn set_config(&self, config: FallbackConfig) -> Result<(), ContractError> {
        let mut configs = self.configs.write().await; configs.insert(config.primary_provider.clone(), config); Ok(())
    }
    /// Get fallback configuration for a provider.
    pub async fn get_config(&self, primary_provider: &str) -> Option<FallbackConfig> {
        let configs = self.configs.read().await; configs.get(primary_provider).cloned()
    }
    /// Get the next provider to try from fallback list.
    pub async fn get_next_provider(&self, primary_provider: &str, current_provider: &str) -> Option<String> {
        let configs = self.configs.read().await;
        if let Some(config) = configs.get(primary_provider) {
            let current_index = config.fallback_providers.iter().position(|p| p == current_provider);
            if let Some(index) = current_index {
                if index + 1 < config.fallback_providers.len() { return Some(config.fallback_providers[index + 1].clone()); }
            } else if !config.fallback_providers.is_empty() { return Some(config.fallback_providers[0].clone()); }
        }
        None
    }
}
impl Default for FallbackManager { fn default() -> Self { Self::new() } }

/// Generic HTTP model provider adapter.
#[derive(Debug)]
pub struct HttpModelProvider {
    provider_id: String,
    base_url: String,
    client: reqwest::Client,
}
impl HttpModelProvider {
    /// Create a new HTTP model provider adapter.
    pub fn new(provider_id: String, base_url: String) -> Self {
        Self { provider_id, base_url, client: reqwest::Client::new() }
    }
}
#[async_trait::async_trait]
impl ModelProvider for HttpModelProvider {
    fn provider_id(&self) -> &str { &self.provider_id }
    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        let url = format!("{}/v1/chat/completions", self.base_url.trim_end_matches('/'));
        let response = self.client.post(&url)
            .json(&serde_json::json!({
                "model": request.model,
                "messages": [{"role": "user", "content": request.input}],
                "request_id": request.request_id
            }))
            .send().await;
        match response {
            Ok(resp) if resp.status().is_success() => {
                let json: serde_json::Value = resp.json().await.map_err(|e| ContractError::ParseError(e.to_string()))?;
                let output = json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
                let tokens_used = json["usage"]["total_tokens"].as_u64();
                Ok(ModelResponse {
                    request_id: request.request_id,
                    output,
                    metadata: Some(format!("provider: {}, model: {}", self.provider_id, request.model)),
                    tokens_used,
                })
            }
            Ok(resp) => Err(ContractError::Persistence),
            Err(_) => Err(ContractError::Persistence),
        }
    }
}
