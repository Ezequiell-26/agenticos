use crate::{
    CredentialPool, FallbackManager, HealthChecker, ModelCatalog, ProviderRegistry, QuotaTracker,
    RetryManager,
};
use agenticos_contracts::{
    ContractError, Credential, HealthCheck, HealthStatus, ModelEntry, ModelProvider, ModelRequest,
    ModelResponse, ProviderEntry,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
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
    /// Requests consumed during the active quota window.
    pub requests_used: u64,
    /// Configured requests-per-minute limit.
    pub requests_per_minute: Option<u32>,
    /// Tokens consumed during the active quota window.
    pub tokens_used: u64,
    /// Configured tokens-per-minute limit.
    pub tokens_per_minute: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedProviderState {
    quota: Option<PersistedQuota>,
    retry: Option<PersistedRetry>,
    health: Option<PersistedHealth>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedQuota {
    requests_per_minute: Option<u32>,
    tokens_per_minute: Option<u32>,
    current_usage: u64,
    #[serde(default)]
    window_started_at: u64,
    #[serde(default)]
    token_usage: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedRetry {
    max_attempts: u32,
    initial_backoff_ms: u64,
    max_backoff_ms: u64,
    exponential_backoff: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedHealth {
    status: String,
    last_check: u64,
    message: Option<String>,
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

#[derive(Clone)]
struct ProviderSecretKey([u8; 32]);

impl std::fmt::Debug for ProviderSecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("ProviderSecretKey")
            .field(&"<redacted>")
            .finish()
    }
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
    fallbacks: Arc<FallbackManager>,
    db: Option<Arc<SqlitePool>>,
    cost_ledger: Option<Arc<agenticos_observability::cost::CostLedger>>,
    secret_key: Option<ProviderSecretKey>,
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
            fallbacks: Arc::new(FallbackManager::new()),
            db: None,
            cost_ledger: None,
            secret_key: provider_secret_key(),
        }
    }

    /// Open a SQLite-backed provider platform and recover provider configuration.
    pub async fn open(database_url: &str) -> Result<Self, ContractError> {
        let db = SqlitePool::connect(database_url).await.map_err(|error| {
            ContractError::ParseError(format!("provider database connection failed: {error}"))
        })?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS providers (
                provider_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                models TEXT NOT NULL,
                capabilities TEXT NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("provider schema initialization failed: {error}"))
        })?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS provider_credentials (
                provider_id TEXT PRIMARY KEY,
                credential_type TEXT NOT NULL,
                encrypted_value TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                scope TEXT
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!(
                "provider credential schema initialization failed: {error}"
            ))
        })?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS provider_fallback_configs (
                primary_provider TEXT PRIMARY KEY,
                fallback_providers TEXT NOT NULL,
                auto_failover INTEGER NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!(
                "provider fallback schema initialization failed: {error}"
            ))
        })?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS provider_runtime_state (
                provider_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| {
            ContractError::ParseError(format!(
                "provider runtime state schema initialization failed: {error}"
            ))
        })?;

        let provider_rows = sqlx::query_as::<_, (String, String, String, String, String)>(
            "SELECT provider_id, name, base_url, models, capabilities FROM providers ORDER BY provider_id",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| ContractError::ParseError(format!("provider recovery failed: {error}")))?;

        let cost_ledger = Some(Arc::new(
            agenticos_observability::cost::CostLedger::open(database_url)
                .await
                .map_err(ContractError::ParseError)?,
        ));

        let platform = Self {
            registry: Arc::new(ProviderRegistry::new()),
            catalog: Arc::new(ModelCatalog::new()),
            credentials: Arc::new(CredentialPool::new()),
            quotas: Arc::new(QuotaTracker::new()),
            health: Arc::new(HealthChecker::new()),
            retries: Arc::new(RetryManager::new()),
            fallbacks: Arc::new(FallbackManager::new()),
            db: Some(Arc::new(db)),
            cost_ledger,
            secret_key: provider_secret_key(),
        };

        for (provider_id, name, base_url, models_json, capabilities_json) in provider_rows {
            let models = serde_json::from_str::<Vec<String>>(&models_json).map_err(|error| {
                ContractError::ParseError(format!(
                    "invalid persisted models for {provider_id}: {error}"
                ))
            })?;
            let capabilities =
                serde_json::from_str::<Vec<String>>(&capabilities_json).map_err(|error| {
                    ContractError::ParseError(format!(
                        "invalid persisted capabilities for {provider_id}: {error}"
                    ))
                })?;
            platform
                .registry
                .register(ProviderEntry {
                    provider_id: provider_id.clone(),
                    name,
                    base_url,
                    models: models.clone(),
                    capabilities: capabilities.clone(),
                })
                .await?;
            for model in models {
                platform
                    .catalog
                    .register(ModelEntry {
                        model_id: model.clone(),
                        provider_id: provider_id.clone(),
                        name: model,
                        context_window: None,
                        capabilities: capabilities.clone(),
                    })
                    .await?;
            }
            platform
                .health
                .update(HealthCheck {
                    provider_id: provider_id.clone(),
                    status: HealthStatus::Unknown,
                    last_check: unix_time(),
                    message: None,
                })
                .await?;
        }

        if let Some(secret_key) = platform.secret_key.as_ref() {
            let db = platform.db.as_ref().expect("provider db");
            let rows = sqlx::query_as::<_, (String, String, String, i64, Option<String>)>(
                "SELECT provider_id, credential_type, encrypted_value, expires_at, scope FROM provider_credentials",
            )
            .fetch_all(db.as_ref())
            .await
            .map_err(|error| ContractError::ParseError(format!("credential recovery failed: {error}")))?;

            for (provider_id, credential_type, encrypted_value, expires_at, scope) in rows {
                let value =
                    decrypt_provider_secret(secret_key, &encrypted_value).map_err(|error| {
                        ContractError::ParseError(format!(
                            "credential recovery failed for {provider_id}: {error}"
                        ))
                    })?;
                platform
                    .credentials
                    .add(Credential {
                        credential_id: format!("cred-{provider_id}"),
                        provider_id,
                        credential_type,
                        value,
                        expires_at: expires_at.max(0) as u64,
                        scope,
                    })
                    .await?;
            }
        }

        if platform.secret_key.is_none() {
            let db = platform.db.as_ref().expect("provider db");
            let credential_count: i64 =
                sqlx::query_scalar("SELECT COUNT(*) FROM provider_credentials")
                    .fetch_one(db.as_ref())
                    .await
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "provider credential inspection failed: {error}"
                        ))
                    })?;
            if credential_count > 0 {
                return Err(ContractError::ParseError(
                    "AGENTICOS_SECRET_KEY is required to recover persisted provider credentials"
                        .to_string(),
                ));
            }
        }

        if let Some(db) = platform.db.as_ref() {
            let rows = sqlx::query_as::<_, (String, String, i64)>(
                "SELECT primary_provider, fallback_providers, auto_failover FROM provider_fallback_configs",
            )
            .fetch_all(db.as_ref())
            .await
            .map_err(|error| ContractError::ParseError(format!("fallback recovery failed: {error}")))?;

            for (primary_provider, fallback_json, auto_failover) in rows {
                let fallback_providers = serde_json::from_str::<Vec<String>>(&fallback_json)
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid persisted fallback config: {error}"
                        ))
                    })?;
                platform
                    .fallbacks
                    .set_config(agenticos_contracts::FallbackConfig {
                        primary_provider,
                        fallback_providers,
                        auto_failover: auto_failover != 0,
                    })
                    .await?;
            }
        }

        if let Some(db) = platform.db.as_ref() {
            let rows = sqlx::query_as::<_, (String, String)>(
                "SELECT provider_id, payload FROM provider_runtime_state",
            )
            .fetch_all(db.as_ref())
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("provider runtime recovery failed: {error}"))
            })?;

            for (provider_id, payload) in rows {
                let state: PersistedProviderState =
                    serde_json::from_str(&payload).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid persisted runtime state for {provider_id}: {error}"
                        ))
                    })?;

                if let Some(quota) = state.quota {
                    platform
                        .quotas
                        .restore_quota(
                            agenticos_contracts::QuotaInfo {
                                provider_id: provider_id.clone(),
                                requests_per_minute: quota.requests_per_minute,
                                tokens_per_minute: quota.tokens_per_minute,
                                current_usage: quota.current_usage,
                            },
                            quota.window_started_at,
                            quota.token_usage,
                        )
                        .await?;
                }
                if let Some(retry) = state.retry {
                    platform
                        .retries
                        .set_policy(
                            provider_id.clone(),
                            agenticos_contracts::RetryPolicy {
                                max_attempts: retry.max_attempts.max(1),
                                initial_backoff_ms: retry.initial_backoff_ms,
                                max_backoff_ms: retry.max_backoff_ms,
                                exponential_backoff: retry.exponential_backoff,
                            },
                        )
                        .await?;
                }
                if let Some(health) = state.health {
                    platform
                        .health
                        .update(HealthCheck {
                            provider_id,
                            status: parse_health_status(&health.status),
                            last_check: health.last_check,
                            message: health.message,
                        })
                        .await?;
                }
            }
        }

        Ok(platform)
    }

    /// Open a persisted platform and apply environment provider configuration.
    pub async fn open_from_env(database_url: &str) -> Result<Self, ContractError> {
        let platform = Self::open(database_url).await?;
        platform.apply_env().await?;
        Ok(platform)
    }

    async fn persist_runtime_state(&self, provider_id: &str) -> Result<(), ContractError> {
        let Some(db) = self.db.as_ref() else {
            return Ok(());
        };

        let quota = self.quotas.get_state(provider_id).await.map(
            |(value, window_started_at, token_usage)| PersistedQuota {
                requests_per_minute: value.requests_per_minute,
                tokens_per_minute: value.tokens_per_minute,
                current_usage: value.current_usage,
                window_started_at,
                token_usage,
            },
        );
        let retry = self
            .retries
            .get_policy(provider_id)
            .await
            .map(|value| PersistedRetry {
                max_attempts: value.max_attempts,
                initial_backoff_ms: value.initial_backoff_ms,
                max_backoff_ms: value.max_backoff_ms,
                exponential_backoff: value.exponential_backoff,
            });
        let health = self
            .health
            .get(provider_id)
            .await
            .map(|value| PersistedHealth {
                status: health_status_name(&value.status).to_string(),
                last_check: value.last_check,
                message: value.message,
            });

        let payload = serde_json::to_string(&PersistedProviderState {
            quota,
            retry,
            health,
        })
        .map_err(|error| {
            ContractError::ParseError(format!("runtime state serialization failed: {error}"))
        })?;

        sqlx::query(
            "INSERT INTO provider_runtime_state (provider_id, payload) VALUES (?, ?) ON CONFLICT(provider_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(provider_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| {
            ContractError::ParseError(format!("runtime state persistence failed: {error}"))
        })?;

        Ok(())
    }

    async fn update_health(
        &self,
        provider_id: &str,
        status: HealthStatus,
        message: Option<String>,
    ) -> Result<(), ContractError> {
        let check = HealthCheck {
            provider_id: provider_id.to_string(),
            status,
            last_check: unix_time(),
            message,
        };
        self.health.update(check).await?;
        self.persist_runtime_state(provider_id).await
    }

    async fn apply_env(&self) -> Result<(), ContractError> {
        let primary_provider = if let Ok(raw) = std::env::var("AGENTICOS_PROVIDERS_JSON") {
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

            let first_provider_id = configured[0].provider_id.trim().to_string();
            for provider in configured {
                self.register(
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

            std::env::var("AGENTICOS_PRIMARY_PROVIDER")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or(first_provider_id)
        } else {
            let provider_id = std::env::var("AGENTICOS_PROVIDER_NAME")
                .unwrap_or_else(|_| "openai-compatible".to_string());
            let base_url = std::env::var("AGENTICOS_PROVIDER_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1/chat/completions".to_string());
            let model =
                std::env::var("AGENTICOS_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());
            let key = std::env::var("AGENTICOS_API_KEY").ok();

            self.register(
                ProviderEntry {
                    provider_id: provider_id.clone(),
                    name: "Environment provider".to_string(),
                    base_url,
                    models: vec![model],
                    capabilities: vec!["chat".to_string()],
                },
                key,
            )
            .await?;

            provider_id
        };

        if let Ok(raw) = std::env::var("AGENTICOS_FALLBACK_PROVIDERS") {
            let fallback_providers: Vec<String> = raw
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect();

            if !fallback_providers.is_empty() {
                let auto_failover = std::env::var("AGENTICOS_AUTO_FAILOVER")
                    .map(|value| value.eq_ignore_ascii_case("true"))
                    .unwrap_or(true);

                self.set_fallback_config(agenticos_contracts::FallbackConfig {
                    primary_provider,
                    fallback_providers,
                    auto_failover,
                })
                .await?;
            }
        }

        Ok(())
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

        if let Some(db) = self.db.as_ref() {
            let mut tx = db.begin().await.map_err(|error| {
                ContractError::ParseError(format!("provider transaction failed: {error}"))
            })?;
            let models_json = serde_json::to_string(&normalized_entry.models).map_err(|error| {
                ContractError::ParseError(format!("provider model serialization failed: {error}"))
            })?;
            let capabilities_json =
                serde_json::to_string(&normalized_entry.capabilities).map_err(|error| {
                    ContractError::ParseError(format!(
                        "provider capability serialization failed: {error}"
                    ))
                })?;

            sqlx::query(
                "INSERT INTO providers (provider_id, name, base_url, models, capabilities) VALUES (?, ?, ?, ?, ?) ON CONFLICT(provider_id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url, models = excluded.models, capabilities = excluded.capabilities",
            )
            .bind(&normalized_entry.provider_id)
            .bind(&normalized_entry.name)
            .bind(&normalized_entry.base_url)
            .bind(models_json)
            .bind(capabilities_json)
            .execute(&mut *tx)
            .await
            .map_err(|error| ContractError::ParseError(format!("provider persistence failed: {error}")))?;

            let provided_key = api_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty());

            if let Some(provided_key) = provided_key {
                let secret_key = self.secret_key.as_ref().ok_or_else(|| {
                    ContractError::ParseError(
                        "AGENTICOS_SECRET_KEY is required to persist provider credentials"
                            .to_string(),
                    )
                })?;

                sqlx::query("DELETE FROM provider_credentials WHERE provider_id = ?")
                    .bind(&provider_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|error| {
                        ContractError::ParseError(format!(
                            "provider credential cleanup failed: {error}"
                        ))
                    })?;

                let encrypted = encrypt_provider_secret(secret_key, provided_key)?;
                sqlx::query(
                    "INSERT INTO provider_credentials (provider_id, credential_type, encrypted_value, expires_at, scope) VALUES (?, 'api_key', ?, 0, NULL)",
                )
                .bind(&provider_id)
                .bind(encrypted)
                .execute(&mut *tx)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("provider credential persistence failed: {error}"))
                })?;
            }
            tx.commit().await.map_err(|error| {
                ContractError::ParseError(format!("provider transaction commit failed: {error}"))
            })?;
        }

        self.catalog.remove_by_provider(&provider_id).await;
        self.credentials.remove_for_provider(&provider_id).await;
        self.registry.register(normalized_entry.clone()).await?;
        for model in &normalized_entry.models {
            self.catalog
                .register(ModelEntry {
                    model_id: model.clone(),
                    provider_id: provider_id.clone(),
                    name: model.clone(),
                    context_window: None,
                    capabilities: normalized_entry.capabilities.clone(),
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
        self.update_health(&provider_id, HealthStatus::Unknown, None)
            .await?;
        Ok(())
    }
    /// Set and persist provider quota state.
    pub async fn set_quota(
        &self,
        quota: agenticos_contracts::QuotaInfo,
    ) -> Result<(), ContractError> {
        let provider_id = quota.provider_id.clone();
        self.quotas.set_quota(quota).await?;
        self.persist_runtime_state(&provider_id).await
    }

    /// Get provider quota state.
    pub async fn get_quota(&self, provider_id: &str) -> Option<agenticos_contracts::QuotaInfo> {
        self.quotas.get(provider_id).await
    }

    /// Set and persist provider retry policy.
    pub async fn set_retry_policy(
        &self,
        provider_id: String,
        policy: agenticos_contracts::RetryPolicy,
    ) -> Result<(), ContractError> {
        self.retries.set_policy(provider_id.clone(), policy).await?;
        self.persist_runtime_state(&provider_id).await
    }

    /// Get provider retry policy.
    pub async fn get_retry_policy(
        &self,
        provider_id: &str,
    ) -> Option<agenticos_contracts::RetryPolicy> {
        self.retries.get_policy(provider_id).await
    }

    /// Configure explicit provider failover order.
    pub async fn set_fallback_config(
        &self,
        config: agenticos_contracts::FallbackConfig,
    ) -> Result<(), ContractError> {
        let primary_provider = config.primary_provider.trim();
        if primary_provider.is_empty() || primary_provider.len() > 128 {
            return Err(ContractError::ParseError(
                "primary provider identifier is invalid".to_string(),
            ));
        }
        if self.registry.get(primary_provider).await.is_none() {
            return Err(ContractError::MissingCapability);
        }

        let mut seen = std::collections::HashSet::new();
        for fallback in &config.fallback_providers {
            let fallback = fallback.trim();
            if fallback.is_empty() || fallback.len() > 128 || fallback == primary_provider {
                return Err(ContractError::ParseError(
                    "fallback provider identifier is invalid".to_string(),
                ));
            }
            if !seen.insert(fallback.to_string()) {
                return Err(ContractError::ParseError(
                    "fallback providers must be unique".to_string(),
                ));
            }
            if self.registry.get(fallback).await.is_none() {
                return Err(ContractError::MissingCapability);
            }
        }

        if let Some(db) = self.db.as_ref() {
            let fallback_json =
                serde_json::to_string(&config.fallback_providers).map_err(|error| {
                    ContractError::ParseError(format!("fallback serialization failed: {error}"))
                })?;
            sqlx::query(
                "INSERT INTO provider_fallback_configs (primary_provider, fallback_providers, auto_failover) VALUES (?, ?, ?) ON CONFLICT(primary_provider) DO UPDATE SET fallback_providers = excluded.fallback_providers, auto_failover = excluded.auto_failover",
            )
            .bind(&config.primary_provider)
            .bind(fallback_json)
            .bind(if config.auto_failover { 1_i64 } else { 0_i64 })
            .execute(db.as_ref())
            .await
            .map_err(|error| ContractError::ParseError(format!("fallback persistence failed: {error}")))?;
        }
        self.fallbacks.set_config(config).await
    }

    /// Get explicit failover configuration for a primary provider.
    pub async fn get_fallback_config(
        &self,
        primary_provider: &str,
    ) -> Option<agenticos_contracts::FallbackConfig> {
        self.fallbacks.get_config(primary_provider).await
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
            let (quota, tokens_used) = self
                .quotas
                .get_state(&provider.provider_id)
                .await
                .map(|(quota, _, tokens)| (Some(quota), tokens))
                .unwrap_or((None, 0));
            result.push(ProviderStatus {
                provider_id: provider.provider_id,
                name: provider.name,
                configured,
                models: provider.models,
                health,
                requests_used: quota.as_ref().map(|value| value.current_usage).unwrap_or(0),
                requests_per_minute: quota.as_ref().and_then(|value| value.requests_per_minute),
                tokens_used,
                tokens_per_minute: quota.as_ref().and_then(|value| value.tokens_per_minute),
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
        let primary_provider = std::env::var("AGENTICOS_PRIMARY_PROVIDER")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                providers
                    .first()
                    .map(|provider| provider.provider_id.clone())
            });

        let mut ordered_ids = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut push_provider = |provider_id: String| {
            if !provider_id.trim().is_empty() && seen.insert(provider_id.clone()) {
                ordered_ids.push(provider_id);
            }
        };
        let mut allow_discovered_fallbacks = true;
        if let Some(primary) = primary_provider.as_deref() {
            push_provider(primary.to_string());
            if let Some(config) = self.fallbacks.get_config(primary).await {
                allow_discovered_fallbacks = config.auto_failover;
                if config.auto_failover {
                    for fallback in config.fallback_providers {
                        if fallback != primary {
                            push_provider(fallback);
                        }
                    }
                }
            }
        }
        if allow_discovered_fallbacks {
            for provider in &providers {
                push_provider(provider.provider_id.clone());
            }
        }

        let provider_by_id: std::collections::HashMap<_, _> = providers
            .into_iter()
            .map(|provider| (provider.provider_id.clone(), provider))
            .collect();

        let mut healthy = Vec::new();
        let mut other = Vec::new();
        for provider_id in ordered_ids {
            let Some(provider) = provider_by_id.get(&provider_id).cloned() else {
                continue;
            };
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

            let mut provider_last_error = None;
            for attempt in 0..policy.max_attempts.max(1) {
                if let Err(error) = self.quotas.consume_request(&provider.provider_id).await {
                    last_error = Some(error.clone());
                    provider_last_error = Some(error);
                    break;
                }

                let client = AuthenticatedOpenAiProvider::new(
                    provider.provider_id.clone(),
                    provider.base_url.clone(),
                    credential.as_ref().map(|value| value.value.clone()),
                )?;

                match execute_protocol(
                    detect_protocol(&provider),
                    &provider,
                    credential.as_ref(),
                    routed_request.clone(),
                )
                .await
                {
                    Ok(response) => {
                        if let Some(tokens) = response.tokens_used {
                            if let Err(error) = self
                                .quotas
                                .record_tokens(&provider.provider_id, tokens)
                                .await
                            {
                                tracing::warn!(
                                    provider = %provider.provider_id,
                                    %error,
                                    "failed to record provider token usage"
                                );
                            }
                            if let Some(ledger) = &self.cost_ledger {
                                if let Err(error) = ledger
                                    .record(
                                        &response.request_id,
                                        &provider.provider_id,
                                        &routed_request.model,
                                        tokens,
                                        unix_time(),
                                    )
                                    .await
                                {
                                    tracing::warn!(
                                        provider = %provider.provider_id,
                                        %error,
                                        "failed to record model usage"
                                    );
                                }
                            }
                        }
                        let _ = self.persist_runtime_state(&provider.provider_id).await;
                        let _ = self
                            .update_health(&provider.provider_id, HealthStatus::Healthy, None)
                            .await;
                        return Ok(response);
                    }
                    Err(error) => {
                        provider_last_error = Some(error.clone());
                        last_error = Some(error.clone());

                        if !is_retryable_provider_error(&error)
                            || attempt + 1 >= policy.max_attempts.max(1)
                        {
                            break;
                        }

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

            if let Some(error) = provider_last_error {
                let _ = self
                    .update_health(
                        &provider.provider_id,
                        HealthStatus::Degraded,
                        Some(error.to_string()),
                    )
                    .await;
            }
        }
        Err(last_error.unwrap_or(ContractError::MissingCapability))
    }

    /// Seed a default provider from environment variables.
    pub async fn from_env() -> Result<Self, ContractError> {
        let platform = Self::new();
        platform.apply_env().await?;
        Ok(platform)
    }

    /// List known models.
    pub async fn list_models(&self) -> Vec<agenticos_contracts::ModelEntry> {
        self.catalog.list().await
    }

    /// Refresh the model catalog from an OpenAI-compatible provider.
    pub async fn refresh_models(&self, provider_id: &str) -> Result<Vec<String>, ContractError> {
        let provider = self
            .registry
            .get(provider_id)
            .await
            .ok_or(ContractError::MissingCapability)?;
        let credential = self
            .credentials
            .get_for_provider(provider_id)
            .await
            .into_iter()
            .find(|credential| credential.expires_at == 0 || credential.expires_at > unix_time());
        if credential.is_none() && !allows_anonymous_provider(&provider.base_url) {
            return Err(ContractError::MissingCapability);
        }

        let models = list_provider_models(&provider, credential.as_ref()).await?;

        let normalized_models = models
            .into_iter()
            .map(|model| model.trim().to_string())
            .filter(|model| !model.is_empty() && model.len() <= 256)
            .collect::<Vec<_>>();
        if normalized_models.is_empty() {
            return Err(ContractError::ParseError(
                "provider returned no usable models".to_string(),
            ));
        }

        let mut unique_models = Vec::with_capacity(normalized_models.len());
        let mut seen = std::collections::HashSet::new();
        for model in normalized_models {
            if seen.insert(model.clone()) {
                unique_models.push(model);
            }
        }

        let updated_entry = ProviderEntry {
            models: unique_models.clone(),
            ..provider.clone()
        };

        if let Some(db) = self.db.as_ref() {
            let models_json = serde_json::to_string(&updated_entry.models).map_err(|error| {
                ContractError::ParseError(format!("provider model serialization failed: {error}"))
            })?;
            sqlx::query("UPDATE providers SET models = ? WHERE provider_id = ?")
                .bind(models_json)
                .bind(provider_id)
                .execute(db.as_ref())
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "provider model catalog persistence failed: {error}"
                    ))
                })?;
        }

        self.catalog.remove_by_provider(provider_id).await;
        self.registry.register(updated_entry.clone()).await?;
        for model in &updated_entry.models {
            self.catalog
                .register(ModelEntry {
                    model_id: model.clone(),
                    provider_id: provider_id.to_string(),
                    name: model.clone(),
                    context_window: None,
                    capabilities: updated_entry.capabilities.clone(),
                })
                .await?;
        }

        self.update_health(
            provider_id,
            HealthStatus::Healthy,
            Some("model catalog refreshed".to_string()),
        )
        .await?;

        Ok(unique_models)
    }

    /// Probe an OpenAI-compatible provider and update its health state.
    pub async fn check_health(&self, provider_id: &str) -> Result<HealthCheck, ContractError> {
        match self.refresh_models(provider_id).await {
            Ok(models) => {
                let check = HealthCheck {
                    provider_id: provider_id.to_string(),
                    status: HealthStatus::Healthy,
                    last_check: unix_time(),
                    message: Some(format!(
                        "provider reachable; {} models discovered",
                        models.len()
                    )),
                };
                self.health.update(check.clone()).await?;
                self.persist_runtime_state(provider_id).await?;
                Ok(check)
            }
            Err(error) => {
                let check = HealthCheck {
                    provider_id: provider_id.to_string(),
                    status: HealthStatus::Unhealthy,
                    last_check: unix_time(),
                    message: Some(error.to_string()),
                };
                self.health.update(check.clone()).await?;
                self.persist_runtime_state(provider_id).await?;
                Err(error)
            }
        }
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
        if let Some(db) = self.db.as_ref() {
            let mut tx = db.begin().await.map_err(|error| {
                ContractError::ParseError(format!("provider delete transaction failed: {error}"))
            })?;
            let result = sqlx::query("DELETE FROM providers WHERE provider_id = ?")
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("provider deletion failed: {error}"))
                })?;
            sqlx::query("DELETE FROM provider_credentials WHERE provider_id = ?")
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!(
                        "provider credential deletion failed: {error}"
                    ))
                })?;
            sqlx::query("DELETE FROM provider_fallback_configs WHERE primary_provider = ?")
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("fallback deletion failed: {error}"))
                })?;
            sqlx::query("DELETE FROM provider_runtime_state WHERE provider_id = ?")
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("runtime state deletion failed: {error}"))
                })?;
            tx.commit().await.map_err(|error| {
                ContractError::ParseError(format!("provider delete commit failed: {error}"))
            })?;
            if result.rows_affected() == 0 {
                return Ok(false);
            }
        }
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

    async fn list_models(&self) -> Result<Vec<String>, ContractError> {
        let mut request = self.client.get(&self.models_url());
        if let Some(api_key) = &self.api_key {
            request = request.bearer_auth(api_key);
        }
        let response = request.send().await.map_err(|error| {
            ContractError::ParseError(format!("provider model discovery failed: {error}"))
        })?;
        let status = response.status();
        let body = response.text().await.map_err(|error| {
            ContractError::ParseError(format!("provider model discovery response failed: {error}"))
        })?;
        if !status.is_success() {
            return Err(ContractError::ParseError(format!(
                "provider_http_status={}; model discovery returned HTTP {status}: {body}",
                status.as_u16()
            )));
        }

        let json: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
            ContractError::ParseError(format!("invalid provider model catalog: {error}"))
        })?;
        let values = json
            .get("data")
            .and_then(|value| value.as_array())
            .cloned()
            .or_else(|| json.as_array().cloned())
            .ok_or_else(|| {
                ContractError::ParseError(
                    "provider model catalog response has no data array".to_string(),
                )
            })?;

        Ok(values
            .iter()
            .filter_map(|item| item.get("id").and_then(|value| value.as_str()))
            .map(ToOwned::to_owned)
            .collect())
    }

    fn models_url(&self) -> String {
        if self.base_url.ends_with("/chat/completions") {
            return self
                .base_url
                .trim_end_matches("/chat/completions")
                .to_string()
                + "/models";
        }
        if self.base_url.ends_with("/v1") {
            return self.base_url.clone() + "/models";
        }
        self.base_url
            .clone()
            .replace("/chat/completions", "/models")
    }

    /// Stream an OpenAI-compatible chat completion as normalized text deltas.
    pub async fn stream(
        &self,
        request: ModelRequest,
    ) -> Result<
        std::pin::Pin<Box<dyn futures::Stream<Item = Result<String, ContractError>> + Send>>,
        ContractError,
    > {
        let request_id = request.request_id.clone();
        let mut payload = serde_json::json!({
            "model": request.model,
            "messages": [{
                "role": "user",
                "content": openai_chat_message_content(&request.input, request.parameters.as_deref())?,
            }],
            "stream": true,
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
            ContractError::ParseError(format!("provider stream request failed: {error}"))
        })?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "failed to read provider streaming error response".to_string());
            let mut detail = body;
            if detail.len() > 4_096 {
                detail.truncate(4_096);
                detail.push_str("...");
            }
            return Err(ContractError::ParseError(format!(
                "provider_http_status={}; provider stream returned HTTP {status}: {detail}",
                status.as_u16()
            )));
        }

        let provider_id = self.provider_id.clone();
        let mut bytes_stream = response.bytes_stream();
        let stream = async_stream::try_stream! {
            use futures::StreamExt;

            let mut buffer = String::new();
            while let Some(next) = bytes_stream.next().await {
                let chunk = next.map_err(|error| {
                    ContractError::ParseError(format!(
                        "provider stream transport failed for {provider_id}: {error}"
                    ))
                })?;
                buffer.push_str(&String::from_utf8_lossy(&chunk));

                while let Some(newline) = buffer.find('\n') {
                    let line = buffer[..newline].trim_end_matches('\r').to_string();
                    buffer.drain(..=newline);

                    let Some(data) = line.strip_prefix("data:") else {
                        continue;
                    };
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }
                    if data == "[DONE]" {
                        yield "[DONE]".to_string();
                        continue;
                    }

                    let json = serde_json::from_str::<serde_json::Value>(data).map_err(|error| {
                        ContractError::ParseError(format!(
                            "invalid provider stream chunk for {provider_id}: {error}"
                        ))
                    })?;
                    if let Some(delta) = json
                        .get("choices")
                        .and_then(|value| value.as_array())
                        .and_then(|choices| choices.first())
                        .and_then(|choice| choice.get("delta"))
                        .and_then(|delta| delta.get("content"))
                        .and_then(|content| content.as_str())
                    {
                        if !delta.is_empty() {
                            yield delta.to_string();
                        }
                    }
                    if json
                        .get("choices")
                        .and_then(|value| value.as_array())
                        .and_then(|choices| choices.first())
                        .and_then(|choice| choice.get("finish_reason"))
                        .and_then(|value| value.as_str())
                        .is_some()
                    {
                        yield "[DONE]".to_string();
                    }
                }
            }

            if !buffer.trim().is_empty() {
                for line in buffer.lines() {
                    let data = line.trim().strip_prefix("data:").map(str::trim);
                    if let Some(data) = data.filter(|value| !value.is_empty() && *value != "[DONE]") {
                        let json = serde_json::from_str::<serde_json::Value>(data).map_err(|error| {
                            ContractError::ParseError(format!(
                                "invalid trailing provider stream chunk for {provider_id}: {error}"
                            ))
                        })?;
                        if let Some(delta) = json
                            .get("choices")
                            .and_then(|value| value.as_array())
                            .and_then(|choices| choices.first())
                            .and_then(|choice| choice.get("delta"))
                            .and_then(|delta| delta.get("content"))
                            .and_then(|content| content.as_str())
                        {
                            if !delta.is_empty() {
                                yield delta.to_string();
                            }
                        }
                    }
                }
            }

            yield "[DONE]".to_string();
        };

        Ok(Box::pin(stream))
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
                "provider_http_status={}; provider returned HTTP {status}: {detail}",
                status.as_u16()
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

fn is_retryable_provider_error(error: &ContractError) -> bool {
    let message = error.to_string();
    if message.contains("provider_http_status=") {
        let status = message
            .split("provider_http_status=")
            .nth(1)
            .and_then(|value| value.split(|ch: char| !ch.is_ascii_digit()).next())
            .and_then(|value| value.parse::<u16>().ok());
        return status == Some(429) || status.is_some_and(|value| value >= 500);
    }
    message.contains("provider request failed:") || message.contains("provider response failed:")
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

fn provider_secret_key() -> Option<ProviderSecretKey> {
    let raw = std::env::var("AGENTICOS_SECRET_KEY").ok()?;
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let digest = ring::digest::digest(&ring::digest::SHA256, raw.as_bytes());
    let mut key = [0_u8; 32];
    key.copy_from_slice(digest.as_ref());
    Some(ProviderSecretKey(key))
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut result = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        result.push(HEX[(byte >> 4) as usize] as char);
        result.push(HEX[(byte & 0x0f) as usize] as char);
    }
    result
}

fn hex_decode(value: &str) -> Result<Vec<u8>, ContractError> {
    fn nibble(byte: u8) -> Option<u8> {
        match byte {
            b'0'..=b'9' => Some(byte - b'0'),
            b'a'..=b'f' => Some(byte - b'a' + 10),
            b'A'..=b'F' => Some(byte - b'A' + 10),
            _ => None,
        }
    }
    let bytes = value.as_bytes();
    if bytes.len() % 2 != 0 {
        return Err(ContractError::ParseError(
            "encrypted provider secret is malformed".to_string(),
        ));
    }
    let mut decoded = Vec::with_capacity(bytes.len() / 2);
    for pair in bytes.chunks_exact(2) {
        let hi = nibble(pair[0]).ok_or_else(|| {
            ContractError::ParseError("encrypted provider secret is malformed".to_string())
        })?;
        let lo = nibble(pair[1]).ok_or_else(|| {
            ContractError::ParseError("encrypted provider secret is malformed".to_string())
        })?;
        decoded.push((hi << 4) | lo);
    }
    Ok(decoded)
}

fn encrypt_provider_secret(
    secret_key: &ProviderSecretKey,
    plaintext: &str,
) -> Result<String, ContractError> {
    use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
    use ring::rand::{SecureRandom, SystemRandom};

    let unbound = UnboundKey::new(&AES_256_GCM, &secret_key.0)
        .map_err(|_| ContractError::ParseError("invalid provider secret key".to_string()))?;
    let key = LessSafeKey::new(unbound);
    let mut nonce_bytes = [0_u8; 12];
    SystemRandom::new().fill(&mut nonce_bytes).map_err(|_| {
        ContractError::ParseError("provider secret nonce generation failed".to_string())
    })?;

    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut ciphertext = plaintext.as_bytes().to_vec();
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| ContractError::ParseError("provider secret encryption failed".to_string()))?;

    let mut encoded = nonce_bytes.to_vec();
    encoded.extend(ciphertext);
    Ok(hex_encode(&encoded))
}

fn decrypt_provider_secret(
    secret_key: &ProviderSecretKey,
    encoded: &str,
) -> Result<String, ContractError> {
    use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};

    let bytes = hex_decode(encoded)?;
    if bytes.len() < 12 + 16 {
        return Err(ContractError::ParseError(
            "encrypted provider secret is too short".to_string(),
        ));
    }
    let unbound = UnboundKey::new(&AES_256_GCM, &secret_key.0)
        .map_err(|_| ContractError::ParseError("invalid provider secret key".to_string()))?;
    let key = LessSafeKey::new(unbound);
    let mut nonce_bytes = [0_u8; 12];
    nonce_bytes.copy_from_slice(&bytes[..12]);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut ciphertext = bytes[12..].to_vec();
    let plaintext = key
        .open_in_place(nonce, Aad::empty(), &mut ciphertext)
        .map_err(|_| ContractError::ParseError("provider secret decryption failed".to_string()))?;
    String::from_utf8(plaintext.to_vec())
        .map_err(|_| ContractError::ParseError("provider secret is not valid UTF-8".to_string()))
}

fn health_status_name(status: &HealthStatus) -> &'static str {
    match status {
        HealthStatus::Healthy => "healthy",
        HealthStatus::Degraded => "degraded",
        HealthStatus::Unhealthy => "unhealthy",
        HealthStatus::Unknown => "unknown",
    }
}

fn parse_health_status(status: &str) -> HealthStatus {
    match status {
        "healthy" => HealthStatus::Healthy,
        "degraded" => HealthStatus::Degraded,
        "unhealthy" => HealthStatus::Unhealthy,
        _ => HealthStatus::Unknown,
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ProviderProtocol {
    OpenAiChat,
    OpenAiResponses,
    AnthropicMessages,
    Gemini,
}

fn detect_protocol(provider: &ProviderEntry) -> ProviderProtocol {
    let base = provider.base_url.to_ascii_lowercase();
    let caps = provider
        .capabilities
        .iter()
        .map(|value| value.to_ascii_lowercase())
        .collect::<Vec<_>>();

    if caps.iter().any(|value| value == "anthropic") || base.contains("api.anthropic.com") {
        ProviderProtocol::AnthropicMessages
    } else if caps.iter().any(|value| value == "gemini")
        || base.contains("generativelanguage.googleapis.com")
    {
        ProviderProtocol::Gemini
    } else if caps.iter().any(|value| value == "responses") || base.ends_with("/responses") {
        ProviderProtocol::OpenAiResponses
    } else {
        ProviderProtocol::OpenAiChat
    }
}

async fn execute_protocol(
    protocol: ProviderProtocol,
    provider: &ProviderEntry,
    credential: Option<&Credential>,
    request: ModelRequest,
) -> Result<ModelResponse, ContractError> {
    match protocol {
        ProviderProtocol::OpenAiChat => {
            AuthenticatedOpenAiProvider::new(
                provider.provider_id.clone(),
                provider.base_url.clone(),
                credential.map(|value| value.value.clone()),
            )?
            .execute(request)
            .await
        }
        ProviderProtocol::OpenAiResponses => {
            let client = reqwest::Client::new();
            let url = normalize_endpoint(&provider.base_url, "/v1/responses", "/responses");
            let mut payload = serde_json::json!({
                "model": request.model,
                "input": [{
                    "role": "user",
                    "content": openai_responses_input_content(
                        &request.input,
                        request.parameters.as_deref(),
                    )?,
                }],
            });
            merge_parameters(&mut payload, request.parameters.as_deref())?;
            let mut builder = client.post(url).header("x-request-id", &request.request_id);
            if let Some(key) = credential.map(|value| value.value.as_str()) {
                builder = builder.bearer_auth(key);
            }
            let response = builder.json(&payload).send().await.map_err(|error| {
                ContractError::ParseError(format!("OpenAI Responses request failed: {error}"))
            })?;
            parse_generic_model_response(
                provider,
                request.request_id,
                response,
                |json| {
                    json.get("output_text")
                        .and_then(|value| value.as_str())
                        .map(ToOwned::to_owned)
                        .or_else(|| {
                            json.get("output")
                                .and_then(|value| value.as_array())
                                .and_then(|items| {
                                    items.iter().find_map(|item| {
                                        item.get("content")
                                            .and_then(|value| value.as_array())
                                            .and_then(|parts| {
                                                parts.iter().find_map(|part| {
                                                    part.get("text")
                                                        .and_then(|value| value.as_str())
                                                        .map(ToOwned::to_owned)
                                                })
                                            })
                                    })
                                })
                        })
                },
                |json| {
                    json.get("usage")
                        .and_then(|usage| usage.get("total_tokens"))
                        .and_then(|value| value.as_u64())
                },
                "openai-responses",
            )
            .await
        }
        ProviderProtocol::AnthropicMessages => {
            let client = reqwest::Client::new();
            let url = normalize_endpoint(&provider.base_url, "/v1/messages", "/messages");
            let mut payload = serde_json::json!({
                "model": request.model,
                "max_tokens": 4096,
                "messages": [{
                    "role": "user",
                    "content": anthropic_message_content(
                        &request.input,
                        request.parameters.as_deref(),
                    )?,
                }],
            });
            merge_parameters(&mut payload, request.parameters.as_deref())?;
            let mut builder = client
                .post(url)
                .header("anthropic-version", "2023-06-01")
                .header("x-request-id", &request.request_id);
            if let Some(key) = credential.map(|value| value.value.as_str()) {
                builder = builder.header("x-api-key", key);
            }
            let response = builder.json(&payload).send().await.map_err(|error| {
                ContractError::ParseError(format!("Anthropic Messages request failed: {error}"))
            })?;
            parse_generic_model_response(
                provider,
                request.request_id,
                response,
                |json| {
                    json.get("content")
                        .and_then(|value| value.as_array())
                        .and_then(|items| {
                            items.iter().find_map(|item| {
                                item.get("text")
                                    .and_then(|value| value.as_str())
                                    .map(ToOwned::to_owned)
                            })
                        })
                },
                |json| {
                    let input = json
                        .get("usage")
                        .and_then(|value| value.get("input_tokens"))
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0);
                    let output = json
                        .get("usage")
                        .and_then(|value| value.get("output_tokens"))
                        .and_then(|value| value.as_u64())
                        .unwrap_or(0);
                    Some(input.saturating_add(output))
                },
                "anthropic-messages",
            )
            .await
        }
        ProviderProtocol::Gemini => {
            let client = reqwest::Client::new();
            let url = normalize_gemini_endpoint(&provider.base_url, &request.model, credential)?;
            let mut payload = serde_json::json!({
                "contents": [{
                    "role": "user",
                    "parts": gemini_message_parts(
                        &request.input,
                        request.parameters.as_deref(),
                    )?,
                }],
            });
            merge_parameters(&mut payload, request.parameters.as_deref())?;
            let response = client
                .post(url)
                .header("x-request-id", &request.request_id)
                .json(&payload)
                .send()
                .await
                .map_err(|error| {
                    ContractError::ParseError(format!("Gemini request failed: {error}"))
                })?;
            parse_generic_model_response(
                provider,
                request.request_id,
                response,
                |json| {
                    json.get("candidates")
                        .and_then(|value| value.as_array())
                        .and_then(|items| items.first())
                        .and_then(|candidate| candidate.get("content"))
                        .and_then(|content| content.get("parts"))
                        .and_then(|parts| parts.as_array())
                        .and_then(|parts| {
                            parts.iter().find_map(|part| {
                                part.get("text")
                                    .and_then(|value| value.as_str())
                                    .map(ToOwned::to_owned)
                            })
                        })
                },
                |json| {
                    json.get("usageMetadata")
                        .and_then(|usage| usage.get("totalTokenCount"))
                        .and_then(|value| value.as_u64())
                },
                "gemini",
            )
            .await
        }
    }
}

async fn list_provider_models(
    provider: &ProviderEntry,
    credential: Option<&Credential>,
) -> Result<Vec<String>, ContractError> {
    match detect_protocol(provider) {
        ProviderProtocol::AnthropicMessages => {
            if provider.models.is_empty() {
                return Err(ContractError::ParseError(
                    "Anthropic model discovery requires configured models".to_string(),
                ));
            }
            Ok(provider.models.clone())
        }
        ProviderProtocol::Gemini => {
            let client = reqwest::Client::new();
            let base = provider.base_url.trim_end_matches('/');
            let raw = if base.ends_with("/models") {
                base.to_string()
            } else if base.ends_with("/v1beta") || base.ends_with("/v1") {
                format!("{base}/models")
            } else {
                format!("{base}/v1beta/models")
            };
            let mut url = reqwest::Url::parse(&raw).map_err(|error| {
                ContractError::ParseError(format!("invalid Gemini models endpoint: {error}"))
            })?;
            if let Some(key) = credential.map(|value| value.value.as_str()) {
                url.query_pairs_mut().append_pair("key", key);
            }

            let response = client.get(url).send().await.map_err(|error| {
                ContractError::ParseError(format!("Gemini model discovery failed: {error}"))
            })?;
            let status = response.status();
            let body = response.text().await.map_err(|error| {
                ContractError::ParseError(format!(
                    "Gemini model discovery response failed: {error}"
                ))
            })?;
            if !status.is_success() {
                return Err(ContractError::ParseError(format!(
                    "provider_http_status={}; Gemini model discovery returned HTTP {status}: {body}",
                    status.as_u16()
                )));
            }

            parse_gemini_models(&body)
        }
        ProviderProtocol::OpenAiChat | ProviderProtocol::OpenAiResponses => {
            let client = AuthenticatedOpenAiProvider::new(
                provider.provider_id.clone(),
                provider.base_url.clone(),
                credential.map(|value| value.value.clone()),
            )?;
            client.list_models().await
        }
    }
}

fn parse_gemini_models(body: &str) -> Result<Vec<String>, ContractError> {
    let json = serde_json::from_str::<serde_json::Value>(body).map_err(|error| {
        ContractError::ParseError(format!("invalid Gemini model catalog: {error}"))
    })?;
    let values = json
        .get("models")
        .and_then(|value| value.as_array())
        .ok_or_else(|| {
            ContractError::ParseError(
                "Gemini model catalog response has no models array".to_string(),
            )
        })?;

    Ok(values
        .iter()
        .filter_map(|item| {
            item.get("baseModelId")
                .and_then(|value| value.as_str())
                .or_else(|| item.get("name").and_then(|value| value.as_str()))
        })
        .filter_map(|value| value.strip_prefix("models/").unwrap_or(value).split(':').next())
        .map(ToOwned::to_owned)
        .filter(|value| !value.is_empty())
        .collect())
}

fn normalize_endpoint(base_url: &str, v1_path: &str, terminal_path: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with(terminal_path) {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}{terminal_path}")
    } else {
        format!("{trimmed}{v1_path}")
    }
}

fn normalize_gemini_endpoint(
    base_url: &str,
    model: &str,
    credential: Option<&Credential>,
) -> Result<reqwest::Url, ContractError> {
    let trimmed = base_url.trim_end_matches('/');
    let raw = if trimmed.contains(":generateContent") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1beta") || trimmed.ends_with("/v1") {
        format!("{trimmed}/models/{model}:generateContent")
    } else {
        format!("{trimmed}/v1beta/models/{model}:generateContent")
    };
    let mut url = reqwest::Url::parse(&raw)
        .map_err(|error| ContractError::ParseError(format!("invalid Gemini endpoint: {error}")))?;
    if let Some(key) = credential.map(|value| value.value.as_str()) {
        url.query_pairs_mut().append_pair("key", key);
    }
    Ok(url)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
enum NormalizedInputPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        mime_type: String,
        data: String,
        detail: Option<String>,
    },
    #[serde(rename = "image_url")]
    ImageUrl {
        url: String,
        detail: Option<String>,
    },
}

fn normalized_input_parts(
    input: &str,
    parameters: Option<&str>,
) -> Result<Option<Vec<NormalizedInputPart>>, ContractError> {
    let Some(parameters) = parameters.filter(|value| !value.trim().is_empty()) else {
        return Ok(None);
    };
    let value = serde_json::from_str::<serde_json::Value>(parameters).map_err(|error| {
        ContractError::ParseError(format!("invalid provider parameters: {error}"))
    })?;
    let Some(parts) = value.get("input_parts") else {
        return Ok(None);
    };
    let parts = serde_json::from_value::<Vec<NormalizedInputPart>>(parts.clone()).map_err(|error| {
        ContractError::ParseError(format!("invalid input_parts: {error}"))
    })?;
    if parts.is_empty() || parts.len() > 64 {
        return Err(ContractError::ParseError(
            "input_parts must contain between 1 and 64 parts".to_string(),
        ));
    }

    let mut normalized = Vec::with_capacity(parts.len() + 1);
    let mut has_text = false;
    for part in parts {
        match part {
            NormalizedInputPart::Text { text } => {
                if text.len() > 1_000_000 {
                    return Err(ContractError::ParseError(
                        "text input part exceeds supported limits".to_string(),
                    ));
                }
                has_text = has_text || !text.trim().is_empty();
                normalized.push(NormalizedInputPart::Text { text });
            }
            NormalizedInputPart::Image {
                mime_type,
                data,
                detail,
            } => {
                if !mime_type.starts_with("image/") || data.is_empty() || data.len() > 20_000_000 {
                    return Err(ContractError::ParseError(
                        "image input part is invalid or too large".to_string(),
                    ));
                }
                normalized.push(NormalizedInputPart::Image {
                    mime_type,
                    data,
                    detail,
                });
            }
            NormalizedInputPart::ImageUrl { url, detail } => {
                if !(url.starts_with("https://") || url.starts_with("http://")) || url.len() > 4096
                {
                    return Err(ContractError::ParseError(
                        "image URL input part must use an HTTP(S) URL".to_string(),
                    ));
                }
                normalized.push(NormalizedInputPart::ImageUrl { url, detail });
            }
        }
    }

    if !input.trim().is_empty() && !has_text {
        normalized.insert(
            0,
            NormalizedInputPart::Text {
                text: input.to_string(),
            },
        );
    }

    Ok(Some(normalized))
}

fn openai_chat_message_content(
    input: &str,
    parameters: Option<&str>,
) -> Result<serde_json::Value, ContractError> {
    let Some(parts) = normalized_input_parts(input, parameters)? else {
        return Ok(serde_json::Value::String(input.to_string()));
    };
    let values = parts
        .into_iter()
        .map(|part| match part {
            NormalizedInputPart::Text { text } => serde_json::json!({
                "type": "text",
                "text": text,
            }),
            NormalizedInputPart::Image { mime_type, data, detail } => serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": format!("data:{mime_type};base64,{data}"),
                    "detail": detail.unwrap_or_else(|| "auto".to_string()),
                },
            }),
            NormalizedInputPart::ImageUrl { url, detail } => serde_json::json!({
                "type": "image_url",
                "image_url": {
                    "url": url,
                    "detail": detail.unwrap_or_else(|| "auto".to_string()),
                },
            }),
        })
        .collect::<Vec<_>>();
    Ok(serde_json::Value::Array(values))
}

fn openai_responses_input_content(
    input: &str,
    parameters: Option<&str>,
) -> Result<serde_json::Value, ContractError> {
    let Some(parts) = normalized_input_parts(input, parameters)? else {
        return Ok(serde_json::json!([{
            "type": "input_text",
            "text": input,
        }]));
    };
    let values = parts
        .into_iter()
        .map(|part| match part {
            NormalizedInputPart::Text { text } => serde_json::json!({
                "type": "input_text",
                "text": text,
            }),
            NormalizedInputPart::Image { mime_type, data, detail } => serde_json::json!({
                "type": "input_image",
                "image_url": format!("data:{mime_type};base64,{data}"),
                "detail": detail.unwrap_or_else(|| "auto".to_string()),
            }),
            NormalizedInputPart::ImageUrl { url, detail } => serde_json::json!({
                "type": "input_image",
                "image_url": url,
                "detail": detail.unwrap_or_else(|| "auto".to_string()),
            }),
        })
        .collect::<Vec<_>>();
    Ok(serde_json::Value::Array(values))
}

fn anthropic_message_content(
    input: &str,
    parameters: Option<&str>,
) -> Result<serde_json::Value, ContractError> {
    let Some(parts) = normalized_input_parts(input, parameters)? else {
        return Ok(serde_json::Value::String(input.to_string()));
    };
    let mut values = Vec::with_capacity(parts.len());
    for part in parts {
        values.push(match part {
            NormalizedInputPart::Text { text } => serde_json::json!({
                "type": "text",
                "text": text,
            }),
            NormalizedInputPart::Image { mime_type, data, .. } => serde_json::json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": data,
                },
            }),
            NormalizedInputPart::ImageUrl { url, .. } => serde_json::json!({
                "type": "image",
                "source": {
                    "type": "url",
                    "url": url,
                },
            }),
        });
    }
    Ok(serde_json::Value::Array(values))
}

fn gemini_message_parts(
    input: &str,
    parameters: Option<&str>,
) -> Result<serde_json::Value, ContractError> {
    let Some(parts) = normalized_input_parts(input, parameters)? else {
        return Ok(serde_json::json!([{"text": input}]));
    };
    let mut values = Vec::with_capacity(parts.len());
    for part in parts {
        values.push(match part {
            NormalizedInputPart::Text { text } => serde_json::json!({
                "text": text,
            }),
            NormalizedInputPart::Image { mime_type, data, .. } => serde_json::json!({
                "inline_data": {
                    "mime_type": mime_type,
                    "data": data,
                },
            }),
            NormalizedInputPart::ImageUrl { .. } => {
                return Err(ContractError::ParseError(
                    "Gemini image_url parts require an uploaded file or inline image data".to_string(),
                ))
            }
        });
    }
    Ok(serde_json::Value::Array(values))
}

fn merge_parameters(
    payload: &mut serde_json::Value,
    parameters: Option<&str>,
) -> Result<(), ContractError> {
    let Some(parameters) = parameters.filter(|value| !value.trim().is_empty()) else {
        return Ok(());
    };
    let extra = serde_json::from_str::<serde_json::Value>(parameters).map_err(|error| {
        ContractError::ParseError(format!("invalid provider parameters: {error}"))
    })?;
    let object = extra.as_object().ok_or_else(|| {
        ContractError::ParseError("provider parameters must be a JSON object".to_string())
    })?;
    let target = payload.as_object_mut().ok_or_else(|| {
        ContractError::ParseError("provider payload must be an object".to_string())
    })?;
    for (key, value) in object {
        if key != "input_parts" {
            target.insert(key.clone(), value.clone());
        }
    }
    Ok(())
}

async fn parse_generic_model_response<F, T>(
    provider: &ProviderEntry,
    request_id: String,
    response: reqwest::Response,
    output: F,
    tokens: T,
    protocol: &str,
) -> Result<ModelResponse, ContractError>
where
    F: Fn(&serde_json::Value) -> Option<String>,
    T: Fn(&serde_json::Value) -> Option<u64>,
{
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        ContractError::ParseError(format!(
            "provider response body read failed for {}: {error}",
            provider.provider_id
        ))
    })?;
    if !status.is_success() {
        return Err(ContractError::ParseError(format!(
            "provider_http_status={}; provider returned HTTP {}: {}",
            status.as_u16(),
            status,
            body.chars().take(4096).collect::<String>()
        )));
    }
    let json = serde_json::from_str::<serde_json::Value>(&body).map_err(|error| {
        ContractError::ParseError(format!(
            "invalid {protocol} response for {}: {error}",
            provider.provider_id
        ))
    })?;
    let text = output(&json).ok_or_else(|| {
        ContractError::ParseError(format!(
            "{protocol} provider {} returned no output text",
            provider.provider_id
        ))
    })?;
    Ok(ModelResponse {
        request_id,
        output: text,
        metadata: Some(format!(
            "provider: {}; protocol: {protocol}",
            provider.provider_id
        )),
        tokens_used: tokens(&json),
    })
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

    #[test]
    fn gemini_model_catalog_normalizes_resource_names() {
        let body = r#"{
            "models": [
                {"name":"models/gemini-3.8-flash","baseModelId":"gemini-3.8-flash"},
                {"name":"models/gemini-special:001"}
            ]
        }"#;
        let models = parse_gemini_models(body).unwrap();
        assert_eq!(
            models,
            vec!["gemini-3.8-flash".to_string(), "gemini-special".to_string()]
        );
    }

    #[tokio::test]
    async fn anthropic_discovery_uses_configured_models() {
        let provider = ProviderEntry {
            provider_id: "anthropic".to_string(),
            name: "Anthropic".to_string(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            models: vec!["claude-sonnet-5".to_string()],
            capabilities: vec!["anthropic".to_string()],
        };
        assert_eq!(
            list_provider_models(&provider, None).await.unwrap(),
            vec!["claude-sonnet-5".to_string()]
        );
    }

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn provider_update_without_new_api_key_keeps_existing_credential() {
        let platform = ProviderPlatform::new();
        let entry = ProviderEntry {
            provider_id: "stable-provider".to_string(),
            name: "Stable Provider".to_string(),
            base_url: "https://api.example.com/v1".to_string(),
            models: vec!["model-a".to_string()],
            capabilities: vec!["chat".to_string()],
        };

        platform
            .register(entry.clone(), Some("original-key".to_string()))
            .await
            .unwrap();

        platform
            .register(
                ProviderEntry {
                    name: "Updated Provider".to_string(),
                    models: vec!["model-b".to_string()],
                    ..entry
                },
                None,
            )
            .await
            .unwrap();

        let statuses = platform.list_status().await;
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].name, "Updated Provider");
        assert!(statuses[0].configured);
    }

    #[test]
    fn provider_protocol_detects_anthropic_and_gemini() {
        let anthropic = ProviderEntry {
            provider_id: "anthropic".into(),
            name: "Anthropic".into(),
            base_url: "https://api.anthropic.com".into(),
            models: vec!["claude".into()],
            capabilities: vec![],
        };
        let gemini = ProviderEntry {
            provider_id: "gemini".into(),
            name: "Gemini".into(),
            base_url: "https://generativelanguage.googleapis.com".into(),
            models: vec!["gemini".into()],
            capabilities: vec![],
        };
        assert_eq!(
            detect_protocol(&anthropic),
            ProviderProtocol::AnthropicMessages
        );
        assert_eq!(detect_protocol(&gemini), ProviderProtocol::Gemini);
    }

    #[test]
    fn provider_endpoint_normalization_is_stable() {
        assert_eq!(
            normalize_endpoint("https://api.example.com/v1", "/v1/responses", "/responses"),
            "https://api.example.com/v1/responses"
        );
        assert_eq!(
            normalize_endpoint("https://api.anthropic.com/v1", "/v1/messages", "/messages"),
            "https://api.anthropic.com/v1/messages"
        );
    }

    #[test]
    fn provider_http_retry_classification_is_transient_only() {
        assert!(super::is_retryable_provider_error(
            &ContractError::ParseError(
                "provider_http_status=429; provider returned HTTP 429".to_string()
            )
        ));
        assert!(super::is_retryable_provider_error(
            &ContractError::ParseError(
                "provider_http_status=503; provider returned HTTP 503".to_string()
            )
        ));
        assert!(!super::is_retryable_provider_error(
            &ContractError::ParseError(
                "provider_http_status=400; provider returned HTTP 400".to_string()
            )
        ));
    }

    #[test]
    fn multimodal_parts_map_to_openai_chat_content() {
        let parameters = r#"{
            "input_parts": [
                {"type":"text","text":"Describe it"},
                {"type":"image","mime_type":"image/png","data":"QUJD","detail":"low"}
            ]
        }"#;
        let value = openai_chat_message_content("ignored", Some(parameters)).unwrap();
        assert_eq!(value[0]["type"], "text");
        assert_eq!(value[1]["type"], "image_url");
        assert_eq!(
            value[1]["image_url"]["url"],
            "data:image/png;base64,QUJD"
        );
        assert_eq!(value[1]["image_url"]["detail"], "low");
    }

    #[test]
    fn multimodal_parts_map_to_anthropic_blocks() {
        let parameters = r#"{
            "input_parts": [
                {"type":"text","text":"Describe it"},
                {"type":"image","mime_type":"image/jpeg","data":"QUJD"}
            ]
        }"#;
        let value = anthropic_message_content("ignored", Some(parameters)).unwrap();
        assert_eq!(value[0]["type"], "text");
        assert_eq!(value[1]["type"], "image");
        assert_eq!(value[1]["source"]["media_type"], "image/jpeg");
        assert_eq!(value[1]["source"]["data"], "QUJD");
    }

    #[test]
    fn multimodal_parts_map_to_gemini_inline_data() {
        let parameters = r#"{
            "input_parts": [
                {"type":"text","text":"Describe it"},
                {"type":"image","mime_type":"image/webp","data":"QUJD"}
            ]
        }"#;
        let value = gemini_message_parts("ignored", Some(parameters)).unwrap();
        assert_eq!(value[0]["text"], "Describe it");
        assert_eq!(value[1]["inline_data"]["mime_type"], "image/webp");
        assert_eq!(value[1]["inline_data"]["data"], "QUJD");
    }

    #[test]
    fn multimodal_parts_reject_unsafe_or_oversized_images() {
        let parameters = r#"{
            "input_parts": [
                {"type":"image","mime_type":"application/octet-stream","data":"QUJD"}
            ]
        }"#;
        assert!(normalized_input_parts("ignored", Some(parameters)).is_err());
    }


    #[test]
    fn anonymous_provider_detection_is_local_only_by_default() {
        assert!(super::allows_anonymous_provider("http://127.0.0.1:11434"));
        assert!(!super::allows_anonymous_provider("https://api.example.com"));
    }
}
