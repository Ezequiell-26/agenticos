#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! model/provider adapters boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContractError, Credential, ModelEntry, ModelProvider, ModelRequest, ModelResponse,
    ProviderEntry, QuotaInfo,
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
}
