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
pub const OWNER: &str = "agenticos-providers";

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
        let models = self.models.read().await;
        models.values().cloned().collect()
    }

    /// List models by provider.
    pub async fn list_by_provider(&self, provider_id: &str) -> Vec<ModelEntry> {
        let models = self.models.read().await;
        models
            .values()
            .filter(|m| m.provider_id == provider_id)
            .cloned()
            .collect()
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
        credentials
            .values()
            .filter(|c| c.provider_id == provider_id)
            .cloned()
            .collect()
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

/// Basic quota tracker.
#[derive(Debug)]
pub struct QuotaTracker {
    quotas: Arc<RwLock<HashMap<String, QuotaInfo>>>,
}

impl QuotaTracker {
    /// Create a new quota tracker.
    pub fn new() -> Self {
        Self {
            quotas: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set quota for a provider.
    pub async fn set_quota(&self, quota: QuotaInfo) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        quotas.insert(quota.provider_id.clone(), quota);
        Ok(())
    }

    /// Get quota for a provider.
    pub async fn get(&self, provider_id: &str) -> Option<QuotaInfo> {
        let quotas = self.quotas.read().await;
        quotas.get(provider_id).cloned()
    }

    /// Increment usage for a provider.
    pub async fn increment_usage(&self, provider_id: &str) -> Result<(), ContractError> {
        let mut quotas = self.quotas.write().await;
        if let Some(quota) = quotas.get_mut(provider_id) {
            quota.current_usage += 1;
            Ok(())
        } else {
            Err(ContractError::MissingCapability)
        }
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

    /// Get the next provider to try from fallback list.
    pub async fn get_next_provider(
        &self,
        primary_provider: &str,
        current_provider: &str,
    ) -> Option<String> {
        let configs = self.configs.read().await;
        if let Some(config) = configs.get(primary_provider) {
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
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait::async_trait]
impl ModelProvider for HttpModelProvider {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    async fn execute(&self, request: ModelRequest) -> Result<ModelResponse, ContractError> {
        // Simple HTTP implementation - in production this would make actual HTTP calls
        Ok(ModelResponse {
            request_id: request.request_id,
            output: format!("HTTP response to: {}", request.input),
            metadata: Some(format!(
                "provider: {}, model: {}",
                self.provider_id, request.model
            )),
            tokens_used: Some(request.input.len() as u64),
        })
    }
}

#[cfg(test)]
mod tests {
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
            let provider = HttpModelProvider::new(
                "http-provider".to_string(),
                "https://api.example.com".to_string(),
            );

            let request = ModelRequest {
                request_id: "req-1".to_string(),
                model: "test-model".to_string(),
                input: "Test input".to_string(),
                parameters: None,
            };

            let response = provider.execute(request).await.unwrap();

            assert_eq!(response.request_id, "req-1");
            assert!(response.output.contains("Test input"));
        });
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
