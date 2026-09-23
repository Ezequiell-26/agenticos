#![forbid(unsafe_code)]

//! LLM router with multi-provider fallback and rate limiting.
//! Inspired by FreeLLMAPI's router architecture.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

// BanditScore types will be integrated from bandit_scoring module
// Temporary placeholder types to avoid circular dependencies

// Placeholder BanditScore for compilation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BanditScore {
    pub overall: f64,
    pub headroom: f64,
    pub intelligence: f64,
}

impl BanditScore {
    pub fn new() -> Self {
        Self {
            overall: 0.5,
            headroom: 0.5,
            intelligence: 0.5,
        }
    }

    pub fn calculate_overall(&mut self) {
        self.overall = (self.headroom * 0.5) + (self.intelligence * 0.5);
    }
}

/// Provider type identifier.
#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum ProviderType {
    Google,
    Groq,
    Cerebras,
    Mistral,
    OpenRouter,
    Cloudflare,
    Cohere,
    HuggingFace,
    Custom(String),
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::Google => write!(f, "google"),
            ProviderType::Groq => write!(f, "groq"),
            ProviderType::Cerebras => write!(f, "cerebras"),
            ProviderType::Mistral => write!(f, "mistral"),
            ProviderType::OpenRouter => write!(f, "openrouter"),
            ProviderType::Cloudflare => write!(f, "cloudflare"),
            ProviderType::Cohere => write!(f, "cohere"),
            ProviderType::HuggingFace => write!(f, "huggingface"),
            ProviderType::Custom(name) => write!(f, "{}", name),
        }
    }
}

/// Model capability rating.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Capability {
    Frontier, // SOTA models (limited daily caps)
    Advanced, // High capability
    Standard, // Mid-tier
    Basic,    // Smaller/faster models
}

/// Rate limit configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimit {
    /// Requests per minute
    pub rpm: Option<u32>,
    /// Requests per day
    pub rpd: Option<u32>,
    /// Tokens per minute
    pub tpm: Option<u32>,
    /// Tokens per day
    pub tpd: Option<u32>,
}

impl RateLimit {
    /// Create a new rate limit configuration.
    pub fn new() -> Self {
        Self {
            rpm: None,
            rpd: None,
            tpm: None,
            tpd: None,
        }
    }

    /// Set RPM limit.
    pub fn with_rpm(mut self, rpm: u32) -> Self {
        self.rpm = Some(rpm);
        self
    }

    /// Set RPD limit.
    pub fn with_rpd(mut self, rpd: u32) -> Self {
        self.rpd = Some(rpd);
        self
    }

    /// Set TPM limit.
    pub fn with_tpm(mut self, tpm: u32) -> Self {
        self.tpm = Some(tpm);
        self
    }

    /// Set TPD limit.
    pub fn with_tpd(mut self, tpd: u32) -> Self {
        self.tpd = Some(tpd);
        self
    }
}

impl Default for RateLimit {
    fn default() -> Self {
        Self::new()
    }
}

/// Model catalog entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    /// Model ID (e.g., "gpt-4", "claude-3-opus")
    pub model_id: String,
    /// Provider type
    pub provider: ProviderType,
    /// Capability rating
    pub capability: Capability,
    /// Rate limits
    pub rate_limit: RateLimit,
    /// Context window size
    pub context_window: Option<usize>,
    /// Priority in fallback chain (lower = higher priority)
    pub priority: u32,
    /// Whether this model supports tool calls
    pub supports_tools: bool,
}

/// Provider key status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum KeyStatus {
    Healthy,
    RateLimited,
    Error,
    Cooldown,
}

/// Usage ledger entry for rate limiting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLedger {
    /// Model ID
    pub model_id: String,
    /// Request count in current minute
    pub rpm_count: u32,
    /// Request count in current day
    pub rpd_count: u32,
    /// Token count in current minute
    pub tpm_count: u32,
    /// Token count in current day
    pub tpd_count: u32,
    /// Last reset timestamp (minute)
    pub last_minute_reset: u64,
    /// Last reset timestamp (day)
    pub last_day_reset: u64,
    /// Cooldown end timestamp (if any)
    pub cooldown_until: Option<u64>,
    /// Current status
    pub status: KeyStatus,
}

impl UsageLedger {
    /// Create a new usage ledger.
    pub fn new(model_id: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        Self {
            model_id,
            rpm_count: 0,
            rpd_count: 0,
            tpm_count: 0,
            tpd_count: 0,
            last_minute_reset: now,
            last_day_reset: now,
            cooldown_until: None,
            status: KeyStatus::Healthy,
        }
    }

    /// Check if the model is under rate limits.
    pub fn is_under_limits(&self, rate_limit: &RateLimit) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Check cooldown
        if let Some(cooldown) = self.cooldown_until {
            if now < cooldown {
                return false;
            }
        }

        // Check RPM
        if let Some(rpm) = rate_limit.rpm {
            if self.rpm_count >= rpm {
                return false;
            }
        }

        // Check RPD
        if let Some(rpd) = rate_limit.rpd {
            if self.rpd_count >= rpd {
                return false;
            }
        }

        // Check TPM
        if let Some(tpm) = rate_limit.tpm {
            if self.tpm_count >= tpm {
                return false;
            }
        }

        // Check TPD
        if let Some(tpd) = rate_limit.tpd {
            if self.tpd_count >= tpd {
                return false;
            }
        }

        true
    }

    /// Record a request with token count.
    pub fn record_request(&mut self, tokens: u32) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Reset minute counter if needed
        if now - self.last_minute_reset >= 60 {
            self.rpm_count = 0;
            self.tpm_count = 0;
            self.last_minute_reset = now;
        }

        // Reset day counter if needed (86400 seconds = 24 hours)
        if now - self.last_day_reset >= 86400 {
            self.rpd_count = 0;
            self.tpd_count = 0;
            self.last_day_reset = now;
        }

        self.rpm_count += 1;
        self.rpd_count += 1;
        self.tpm_count += tokens;
        self.tpd_count += tokens;
    }

    /// Set cooldown status.
    pub fn set_cooldown(&mut self, duration_secs: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.cooldown_until = Some(now + duration_secs);
        self.status = KeyStatus::Cooldown;
    }

    /// Clear cooldown if expired.
    pub fn clear_cooldown_if_expired(&mut self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if let Some(cooldown) = self.cooldown_until {
            if now >= cooldown {
                self.cooldown_until = None;
                self.status = KeyStatus::Healthy;
            }
        }
    }
}

/// LLM router for multi-provider fallback.
#[allow(missing_debug_implementations)]
pub struct LLMRouter {
    /// Model catalog
    catalog: Vec<ModelEntry>,
    /// Usage ledger per model
    ledger: Arc<Mutex<HashMap<String, UsageLedger>>>,
    /// API keys per provider
    api_keys: Arc<Mutex<HashMap<ProviderType, String>>>,
    // Note: Bandit and quota integration will be added via methods to avoid circular deps
}

impl LLMRouter {
    /// Create a new LLM router.
    pub fn new() -> Self {
        Self {
            catalog: Vec::new(),
            ledger: Arc::new(Mutex::new(HashMap::new())),
            api_keys: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Add a model to the catalog.
    pub fn add_model(&mut self, model: ModelEntry) {
        self.catalog.push(model);
    }

    /// Set API key for a provider.
    pub fn set_api_key(&self, provider: ProviderType, key: String) {
        let mut keys = self.api_keys.lock().unwrap();
        keys.insert(provider, key);
    }

    /// Get API key for a provider.
    pub fn get_api_key(&self, provider: &ProviderType) -> Option<String> {
        let keys = self.api_keys.lock().unwrap();
        keys.get(provider).cloned()
    }

    /// Select the best available model for a request.
    pub fn select_model(&self, supports_tools: bool) -> Option<ModelEntry> {
        self.select_model_with_scoring(supports_tools)
            .map(|(model, _score)| model)
    }

    /// Select the best available model for a request with bandit scoring.
    pub fn select_model_with_scoring(
        &self,
        supports_tools: bool,
    ) -> Option<(ModelEntry, BanditScore)> {
        let mut ledger = self.ledger.lock().unwrap();

        // Clear expired cooldowns
        for entry in ledger.values_mut() {
            entry.clear_cooldown_if_expired();
        }

        // Filter models by capability and tool support
        let candidates: Vec<&ModelEntry> = self
            .catalog
            .iter()
            .filter(|m| {
                if supports_tools && !m.supports_tools {
                    return false;
                }
                true
            })
            .collect();

        // Sort by priority (lower = higher priority)
        let mut sorted: Vec<&ModelEntry> = candidates;
        sorted.sort_by_key(|m| m.priority);

        // Find first model under rate limits and calculate score
        for model in sorted {
            let ledger_entry = ledger
                .entry(model.model_id.clone())
                .or_insert_with(|| UsageLedger::new(model.model_id.clone()));

            if ledger_entry.is_under_limits(&model.rate_limit) {
                // Calculate headroom score
                let headroom = self.calculate_headroom(&model.rate_limit, ledger_entry);

                // Create bandit score (simplified without full bandit integration)
                let mut score = BanditScore::new();
                score.headroom = headroom;
                score.intelligence = match model.capability {
                    Capability::Frontier => 1.0,
                    Capability::Advanced => 0.8,
                    Capability::Standard => 0.6,
                    Capability::Basic => 0.4,
                };
                score.calculate_overall();

                return Some((model.clone(), score));
            }
        }

        None
    }

    /// Calculate headroom score for a model.
    fn calculate_headroom(&self, rate_limit: &RateLimit, ledger: &UsageLedger) -> f64 {
        let rpm_headroom = rate_limit.rpm.map_or(1.0, |limit| {
            if limit == 0 {
                1.0
            } else {
                (limit - ledger.rpm_count) as f64 / limit as f64
            }
        });

        let rpd_headroom = rate_limit.rpd.map_or(1.0, |limit| {
            if limit == 0 {
                1.0
            } else {
                (limit - ledger.rpd_count) as f64 / limit as f64
            }
        });

        rpm_headroom.min(rpd_headroom)
    }

    /// Record usage for a model.
    pub fn record_usage(&self, model_id: &str, tokens: u32) {
        let mut ledger = self.ledger.lock().unwrap();
        if let Some(entry) = ledger.get_mut(model_id) {
            entry.record_request(tokens);
        }
    }

    /// Mark a model as rate-limited with cooldown.
    pub fn mark_rate_limited(&self, model_id: &str, cooldown_secs: u64) {
        let mut ledger = self.ledger.lock().unwrap();
        if let Some(entry) = ledger.get_mut(model_id) {
            entry.set_cooldown(cooldown_secs);
        }
    }

    /// Get usage stats for a model.
    pub fn get_usage_stats(&self, model_id: &str) -> Option<UsageLedger> {
        let ledger = self.ledger.lock().unwrap();
        ledger.get(model_id).cloned()
    }
}

impl Default for LLMRouter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_creation() {
        let limit = RateLimit::new()
            .with_rpm(100)
            .with_rpd(1000)
            .with_tpm(10000)
            .with_tpd(100000);

        assert_eq!(limit.rpm, Some(100));
        assert_eq!(limit.rpd, Some(1000));
        assert_eq!(limit.tpm, Some(10000));
        assert_eq!(limit.tpd, Some(100000));
    }

    #[test]
    fn test_usage_ledger_under_limits() {
        let mut ledger = UsageLedger::new("test-model".to_string());
        let limit = RateLimit::new().with_rpm(10);

        assert!(ledger.is_under_limits(&limit));

        ledger.record_request(100);
        assert!(ledger.is_under_limits(&limit));

        // Exceed RPM
        for _ in 0..10 {
            ledger.record_request(100);
        }
        assert!(!ledger.is_under_limits(&limit));
    }

    #[test]
    fn test_usage_ledger_cooldown() {
        let mut ledger = UsageLedger::new("test-model".to_string());
        ledger.set_cooldown(60);

        assert!(!ledger.is_under_limits(&RateLimit::new()));
    }

    #[test]
    fn test_router_model_selection() {
        let mut router = LLMRouter::new();

        router.add_model(ModelEntry {
            model_id: "model-1".to_string(),
            provider: ProviderType::Google,
            capability: Capability::Frontier,
            rate_limit: RateLimit::new().with_rpm(10),
            context_window: Some(128000),
            priority: 1,
            supports_tools: true,
        });

        router.add_model(ModelEntry {
            model_id: "model-2".to_string(),
            provider: ProviderType::Groq,
            capability: Capability::Standard,
            rate_limit: RateLimit::new().with_rpm(100),
            context_window: Some(8192),
            priority: 2,
            supports_tools: true,
        });

        let selected = router.select_model(true);
        assert!(selected.is_some());
        assert_eq!(selected.unwrap().model_id, "model-1");
    }
}
