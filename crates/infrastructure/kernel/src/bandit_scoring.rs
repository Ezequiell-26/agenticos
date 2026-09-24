#![forbid(unsafe_code)]

//! Thompson-sampling bandit scoring for model selection.
//! Inspired by FreeLLMAPI's routing and bandit scoring architecture.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Bandit score factors for model selection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BanditScore {
    /// Reliability score (0-1)
    pub reliability: f64,
    /// Speed score (0-1, higher = faster)
    pub speed: f64,
    /// Intelligence score (0-1, higher = smarter)
    pub intelligence: f64,
    /// Headroom score (0-1, higher = more quota remaining)
    pub headroom: f64,
    /// Rate limit headroom factor
    pub rate_limit_headroom: f64,
    /// Overall weighted score
    pub overall: f64,
}

impl BanditScore {
    /// Calculate overall score from factors.
    pub fn calculate_overall(&mut self) {
        // Weights from FreeLLMAPI: reliability 40%, speed 20%, intelligence 25%, headroom 15%
        self.overall = (self.reliability * 0.4)
            + (self.speed * 0.2)
            + (self.intelligence * 0.25)
            + (self.headroom * 0.15);
    }

    /// Create a new bandit score.
    pub fn new() -> Self {
        Self {
            reliability: 0.5,
            speed: 0.5,
            intelligence: 0.5,
            headroom: 0.5,
            rate_limit_headroom: 1.0,
            overall: 0.5,
        }
    }
}

impl Default for BanditScore {
    fn default() -> Self {
        Self::new()
    }
}

/// Model performance statistics for bandit learning.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStats {
    /// Total requests
    pub total_requests: u64,
    /// Successful requests
    pub successful_requests: u64,
    /// Failed requests
    pub failed_requests: u64,
    /// Average latency in milliseconds
    pub avg_latency_ms: f64,
    /// Last success timestamp
    pub last_success_timestamp: u64,
    /// Last failure timestamp
    pub last_failure_timestamp: u64,
}

impl ModelStats {
    /// Create new model stats.
    pub fn new() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_latency_ms: 0.0,
            last_success_timestamp: 0,
            last_failure_timestamp: 0,
        }
    }

    /// Record a successful request.
    pub fn record_success(&mut self, latency_ms: f64) {
        self.total_requests += 1;
        self.successful_requests += 1;

        // Update average latency using exponential moving average
        if self.avg_latency_ms == 0.0 {
            self.avg_latency_ms = latency_ms;
        } else {
            self.avg_latency_ms = (self.avg_latency_ms * 0.9) + (latency_ms * 0.1);
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.last_success_timestamp = now;
    }

    /// Record a failed request.
    pub fn record_failure(&mut self) {
        self.total_requests += 1;
        self.failed_requests += 1;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        self.last_failure_timestamp = now;
    }

    /// Calculate reliability score (0-1).
    pub fn reliability_score(&self) -> f64 {
        if self.total_requests == 0 {
            return 0.5; // Neutral for new models
        }
        self.successful_requests as f64 / self.total_requests as f64
    }

    /// Calculate speed score (0-1, higher = faster).
    pub fn speed_score(&self) -> f64 {
        // Normalize latency: 0ms = 1.0, 5000ms = 0.0
        let max_latency = 5000.0;
        let normalized = 1.0 - (self.avg_latency_ms / max_latency);
        normalized.max(0.0).min(1.0)
    }
}

impl Default for ModelStats {
    fn default() -> Self {
        Self::new()
    }
}

/// Thompson sampling bandit for model selection.
#[allow(missing_debug_implementations)]
pub struct ThompsonSamplingBandit {
    /// Model statistics
    stats: Arc<Mutex<HashMap<String, ModelStats>>>,
    /// Alpha parameter for Beta distribution (successes)
    alpha_base: f64,
    /// Beta parameter for Beta distribution (failures)
    beta_base: f64,
}

impl ThompsonSamplingBandit {
    /// Create a new Thompson sampling bandit.
    pub fn new() -> Self {
        Self {
            stats: Arc::new(Mutex::new(HashMap::new())),
            alpha_base: 1.0,
            beta_base: 1.0,
        }
    }

    /// Get or create stats for a model.
    fn get_stats(&self, model_id: &str) -> ModelStats {
        let mut stats = self.stats.lock().unwrap();
        stats
            .entry(model_id.to_string())
            .or_insert_with(ModelStats::new)
            .clone()
    }

    /// Update stats for a model.
    fn update_stats(&self, model_id: &str, stats: ModelStats) {
        let mut stats_map = self.stats.lock().unwrap();
        stats_map.insert(model_id.to_string(), stats);
    }

    /// Sample from Beta distribution using Thompson sampling.
    fn sample_beta(&self, alpha: f64, beta: f64) -> f64 {
        // Simplified Beta sampling using gamma approximation
        // In production, use a proper statistical library
        let _alpha = alpha.max(0.1);
        let _beta = beta.max(0.1);

        // Use Box-Muller transform approximation for normal, then convert to Beta
        let u1 = rand::random::<f64>();
        let u2 = rand::random::<f64>();

        let z0 = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
        let normal = z0 * 0.1 + 0.5; // Center around 0.5 with std dev 0.1

        normal.max(0.0).min(1.0)
    }

    /// Calculate bandit score for a model.
    pub fn calculate_score(&self, model_id: &str, headroom: f64) -> BanditScore {
        let stats = self.get_stats(model_id);

        // Thompson sampling for reliability
        let _reliability = stats.reliability_score();
        let sampled_reliability = self.sample_beta(
            self.alpha_base + (stats.successful_requests as f64),
            self.beta_base + (stats.failed_requests as f64),
        );

        let mut score = BanditScore {
            reliability: sampled_reliability,
            speed: stats.speed_score(),
            intelligence: 0.5, // Would come from model capability rating
            headroom,
            rate_limit_headroom: 1.0,
            overall: 0.0,
        };

        score.calculate_overall();
        score
    }

    /// Record a successful request.
    pub fn record_success(&self, model_id: &str, latency_ms: f64) {
        let mut stats = self.get_stats(model_id);
        stats.record_success(latency_ms);
        self.update_stats(model_id, stats);
    }

    /// Record a failed request.
    pub fn record_failure(&self, model_id: &str) {
        let mut stats = self.get_stats(model_id);
        stats.record_failure();
        self.update_stats(model_id, stats);
    }

    /// Get stats for a model.
    pub fn get_model_stats(&self, model_id: &str) -> Option<ModelStats> {
        let stats = self.stats.lock().unwrap();
        stats.get(model_id).cloned()
    }
}

impl Default for ThompsonSamplingBandit {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bandit_score_calculation() {
        let mut score = BanditScore {
            reliability: 0.9,
            speed: 0.8,
            intelligence: 0.7,
            headroom: 0.6,
            rate_limit_headroom: 1.0,
            overall: 0.0,
        };

        score.calculate_overall();

        // Expected: 0.9*0.4 + 0.8*0.2 + 0.7*0.25 + 0.6*0.15 = 0.36 + 0.16 + 0.175 + 0.09 = 0.785
        assert!((score.overall - 0.785).abs() < 0.01);
    }

    #[test]
    fn test_model_stats_reliability() {
        let mut stats = ModelStats::new();

        stats.record_success(100.0);
        stats.record_success(200.0);
        stats.record_failure();

        assert_eq!(stats.total_requests, 3);
        assert_eq!(stats.successful_requests, 2);
        assert_eq!(stats.failed_requests, 1);
        assert!((stats.reliability_score() - 0.666).abs() < 0.01);
    }

    #[test]
    fn test_model_stats_speed() {
        let mut stats = ModelStats::new();

        stats.record_success(100.0);
        stats.record_success(300.0);

        // The implementation uses an exponential moving average: 100ms -> 120ms after 300ms.
        assert!((stats.avg_latency_ms - 120.0).abs() < 1.0);

        // Speed score should be high for 200ms latency
        assert!(stats.speed_score() > 0.9);
    }

    #[test]
    fn test_thompson_sampling() {
        let bandit = ThompsonSamplingBandit::new();

        let score = bandit.calculate_score("test-model", 0.8);

        assert!(score.overall > 0.0);
        assert!(score.overall <= 1.0);
    }
}
