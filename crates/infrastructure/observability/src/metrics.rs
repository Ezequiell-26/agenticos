#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! metrics collection boundary. Functionality is introduced only through verified vertical slices.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Token type for LLM metrics.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenType {
    /// Prompt tokens
    Prompt,
    /// Completion tokens
    Completion,
    /// Cached prompt tokens
    Cached,
    /// Reasoning tokens
    Reasoning,
}

/// Model pricing configuration.
#[derive(Debug, Clone)]
pub struct ModelPricing {
    /// Model name
    pub model: String,
    /// Cost per 1M input tokens in USD
    pub input_cost_per_1m: f64,
    /// Cost per 1M output tokens in USD
    pub output_cost_per_1m: f64,
}

impl ModelPricing {
    /// Create new model pricing.
    pub fn new(model: &str, input_cost_per_1m: f64, output_cost_per_1m: f64) -> Self {
        Self {
            model: model.to_string(),
            input_cost_per_1m,
            output_cost_per_1m,
        }
    }

    /// Get default pricing for OpenAI GPT-4.
    pub fn gpt4() -> Self {
        Self::new("gpt-4", 30.0, 60.0)
    }

    /// Get default pricing for OpenAI GPT-3.5-turbo.
    pub fn gpt35_turbo() -> Self {
        Self::new("gpt-3.5-turbo", 0.5, 1.5)
    }

    /// Calculate cost for given input and output tokens.
    pub fn calculate_cost(&self, input_tokens: u64, output_tokens: u64) -> f64 {
        let input_cost = (input_tokens as f64 / 1_000_000.0) * self.input_cost_per_1m;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * self.output_cost_per_1m;
        input_cost + output_cost
    }
}

/// LLM-specific metrics with cost estimation.
#[derive(Debug)]
pub struct LLMMetrics {
    /// Model name
    pub model: String,
    /// Total cost in USD
    pub total_cost: Arc<AtomicU64>, // Stored in cents (u64) for atomic operations
    /// Prompt tokens
    pub prompt_tokens: Arc<AtomicU64>,
    /// Completion tokens
    pub completion_tokens: Arc<AtomicU64>,
    /// Cached tokens
    pub cached_tokens: Arc<AtomicU64>,
    /// Reasoning tokens
    pub reasoning_tokens: Arc<AtomicU64>,
    /// Model pricing
    pub pricing: ModelPricing,
}

impl LLMMetrics {
    /// Create new LLM metrics.
    pub fn new(model: &str, pricing: ModelPricing) -> Self {
        Self {
            model: model.to_string(),
            total_cost: Arc::new(AtomicU64::new(0)),
            prompt_tokens: Arc::new(AtomicU64::new(0)),
            completion_tokens: Arc::new(AtomicU64::new(0)),
            cached_tokens: Arc::new(AtomicU64::new(0)),
            reasoning_tokens: Arc::new(AtomicU64::new(0)),
            pricing,
        }
    }

    /// Record token usage.
    pub fn record_tokens(&self, token_type: TokenType, count: u64) {
        match token_type {
            TokenType::Prompt => self.prompt_tokens.fetch_add(count, Ordering::Relaxed),
            TokenType::Completion => self.completion_tokens.fetch_add(count, Ordering::Relaxed),
            TokenType::Cached => self.cached_tokens.fetch_add(count, Ordering::Relaxed),
            TokenType::Reasoning => self.reasoning_tokens.fetch_add(count, Ordering::Relaxed),
        };
    }

    /// Update cost based on current token usage.
    pub fn update_cost(&self) {
        let prompt = self.prompt_tokens.load(Ordering::Relaxed);
        let completion = self.completion_tokens.load(Ordering::Relaxed);
        let cost_cents = (self.pricing.calculate_cost(prompt, completion) * 100.0) as u64;
        self.total_cost.store(cost_cents, Ordering::Relaxed);
    }

    /// Get total cost in USD.
    pub fn get_total_cost(&self) -> f64 {
        self.total_cost.load(Ordering::Relaxed) as f64 / 100.0
    }

    /// Get prompt tokens.
    pub fn get_prompt_tokens(&self) -> u64 {
        self.prompt_tokens.load(Ordering::Relaxed)
    }

    /// Get completion tokens.
    pub fn get_completion_tokens(&self) -> u64 {
        self.completion_tokens.load(Ordering::Relaxed)
    }

    /// Get cached tokens.
    pub fn get_cached_tokens(&self) -> u64 {
        self.cached_tokens.load(Ordering::Relaxed)
    }

    /// Get reasoning tokens.
    pub fn get_reasoning_tokens(&self) -> u64 {
        self.reasoning_tokens.load(Ordering::Relaxed)
    }
}

/// Simple counter metric.
#[derive(Debug)]
pub struct Counter {
    inner: Arc<AtomicU64>,
}

impl Counter {
    /// Create a new counter.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Increment the counter by 1.
    pub fn increment(&self) {
        self.inner.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment the counter by a specific amount.
    pub fn increment_by(&self, amount: u64) {
        self.inner.fetch_add(amount, Ordering::Relaxed);
    }

    /// Get the current counter value.
    pub fn get(&self) -> u64 {
        self.inner.load(Ordering::Relaxed)
    }

    /// Reset the counter to 0.
    pub fn reset(&self) {
        self.inner.store(0, Ordering::Relaxed);
    }
}

impl Default for Counter {
    fn default() -> Self {
        Self::new()
    }
}

/// Histogram for tracking latency distributions.
#[derive(Debug)]
pub struct Histogram {
    buckets: Arc<Vec<AtomicU64>>,
    bucket_boundaries: Vec<u64>,
}

impl Histogram {
    /// Create a new histogram with exponential bucket boundaries.
    pub fn new() -> Self {
        let bucket_boundaries = vec![
            1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000,
        ];
        let buckets = bucket_boundaries
            .iter()
            .map(|_| AtomicU64::new(0))
            .collect();

        Self {
            buckets: Arc::new(buckets),
            bucket_boundaries,
        }
    }

    /// Record a value in the histogram.
    pub fn record(&self, value: u64) {
        for (i, boundary) in self.bucket_boundaries.iter().enumerate() {
            if value <= *boundary {
                self.buckets[i].fetch_add(1, Ordering::Relaxed);
                return;
            }
        }
        // Value exceeds all buckets, count in overflow
        if let Some(last) = self.buckets.last() {
            last.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Get the bucket counts.
    pub fn get_counts(&self) -> Vec<u64> {
        self.buckets
            .iter()
            .map(|b| b.load(Ordering::Relaxed))
            .collect()
    }

    /// Get the bucket boundaries.
    pub fn get_boundaries(&self) -> Vec<u64> {
        self.bucket_boundaries.clone()
    }
}

impl Default for Histogram {
    fn default() -> Self {
        Self::new()
    }
}

/// Token usage metrics.
#[derive(Debug)]
pub struct TokenMetrics {
    /// Input tokens
    pub input_tokens: Arc<AtomicU64>,
    /// Output tokens
    pub output_tokens: Arc<AtomicU64>,
    /// Total tokens
    pub total_tokens: Arc<AtomicU64>,
}

impl TokenMetrics {
    /// Create new token metrics.
    pub fn new() -> Self {
        Self {
            input_tokens: Arc::new(AtomicU64::new(0)),
            output_tokens: Arc::new(AtomicU64::new(0)),
            total_tokens: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Record input tokens.
    pub fn record_input(&self, tokens: u64) {
        self.input_tokens.fetch_add(tokens, Ordering::Relaxed);
        self.total_tokens.fetch_add(tokens, Ordering::Relaxed);
    }

    /// Record output tokens.
    pub fn record_output(&self, tokens: u64) {
        self.output_tokens.fetch_add(tokens, Ordering::Relaxed);
        self.total_tokens.fetch_add(tokens, Ordering::Relaxed);
    }

    /// Get input tokens.
    pub fn get_input(&self) -> u64 {
        self.input_tokens.load(Ordering::Relaxed)
    }

    /// Get output tokens.
    pub fn get_output(&self) -> u64 {
        self.output_tokens.load(Ordering::Relaxed)
    }

    /// Get total tokens.
    pub fn get_total(&self) -> u64 {
        self.total_tokens.load(Ordering::Relaxed)
    }
}

impl Default for TokenMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Latency tracker.
#[derive(Debug)]
pub struct LatencyTracker {
    histogram: Histogram,
}

impl LatencyTracker {
    /// Create new latency tracker.
    pub fn new() -> Self {
        Self {
            histogram: Histogram::new(),
        }
    }

    /// Record a latency in milliseconds.
    pub fn record_latency(&self, latency_ms: u64) {
        self.histogram.record(latency_ms);
    }

    /// Measure a block of code and record its latency.
    pub fn measure<F, R>(&self, f: F) -> R
    where
        F: FnOnce() -> R,
    {
        let start = Instant::now();
        let result = f();
        let elapsed = start.elapsed().as_millis() as u64;
        self.record_latency(elapsed);
        result
    }

    /// Get the histogram.
    pub fn get_histogram(&self) -> &Histogram {
        &self.histogram
    }
}

impl Default for LatencyTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Error tracking metrics.
#[derive(Debug)]
pub struct ErrorMetrics {
    /// Total errors
    total_errors: Arc<AtomicU64>,
}

impl ErrorMetrics {
    /// Create new error metrics.
    pub fn new() -> Self {
        Self {
            total_errors: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Record an error.
    pub fn record_error(&self, _error_type: &str) {
        self.total_errors.fetch_add(1, Ordering::Relaxed);
    }

    /// Get total errors.
    pub fn get_total(&self) -> u64 {
        self.total_errors.load(Ordering::Relaxed)
    }
}

impl Default for ErrorMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Process-level operational metrics for the AgentiCOS backend runtime.
#[derive(Debug)]
pub struct RuntimeMetrics {
    http_requests: Arc<AtomicU64>,
    http_errors: Arc<AtomicU64>,
    provider_requests: Arc<AtomicU64>,
    provider_errors: Arc<AtomicU64>,
    tool_executions: Arc<AtomicU64>,
    tool_errors: Arc<AtomicU64>,
    scheduler_claims: Arc<AtomicU64>,
    scheduler_successes: Arc<AtomicU64>,
    scheduler_failures: Arc<AtomicU64>,
    llm_latency_ms: Arc<AtomicU64>,
}

#[derive(Debug, Clone, serde::Serialize)]
/// Snapshot of backend operational counters.
pub struct RuntimeMetricsSnapshot {
    /// Number of HTTP operations observed.
    pub http_requests: u64,
    /// Number of HTTP/handler failures observed.
    pub http_errors: u64,
    /// Number of provider request attempts.
    pub provider_requests: u64,
    /// Number of provider failures.
    pub provider_errors: u64,
    /// Number of tool executions.
    pub tool_executions: u64,
    /// Number of tool failures.
    pub tool_errors: u64,
    /// Number of scheduler job claims.
    pub scheduler_claims: u64,
    /// Number of successful scheduled jobs.
    pub scheduler_successes: u64,
    /// Number of failed scheduled jobs.
    pub scheduler_failures: u64,
    /// Accumulated LLM latency in milliseconds.
    pub llm_latency_ms: u64,
}

impl RuntimeMetrics {
    /// Create empty runtime metrics.
    pub fn new() -> Self {
        Self {
            http_requests: Arc::new(AtomicU64::new(0)),
            http_errors: Arc::new(AtomicU64::new(0)),
            provider_requests: Arc::new(AtomicU64::new(0)),
            provider_errors: Arc::new(AtomicU64::new(0)),
            tool_executions: Arc::new(AtomicU64::new(0)),
            tool_errors: Arc::new(AtomicU64::new(0)),
            scheduler_claims: Arc::new(AtomicU64::new(0)),
            scheduler_successes: Arc::new(AtomicU64::new(0)),
            scheduler_failures: Arc::new(AtomicU64::new(0)),
            llm_latency_ms: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Record one HTTP operation.
    pub fn record_http(&self, failed: bool) {
        self.http_requests.fetch_add(1, Ordering::Relaxed);
        if failed {
            self.http_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record one provider operation.
    pub fn record_provider(&self, failed: bool) {
        self.provider_requests.fetch_add(1, Ordering::Relaxed);
        if failed {
            self.provider_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record one tool operation.
    pub fn record_tool(&self, failed: bool) {
        self.tool_executions.fetch_add(1, Ordering::Relaxed);
        if failed {
            self.tool_errors.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record one scheduler claim.
    pub fn record_scheduler_claim(&self) {
        self.scheduler_claims.fetch_add(1, Ordering::Relaxed);
    }

    /// Record one scheduler completion outcome.
    pub fn record_scheduler_completion(&self, success: bool) {
        if success {
            self.scheduler_successes.fetch_add(1, Ordering::Relaxed);
        } else {
            self.scheduler_failures.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Accumulate model latency.
    pub fn record_llm_latency(&self, latency_ms: u64) {
        self.llm_latency_ms
            .fetch_add(latency_ms, Ordering::Relaxed);
    }

    /// Return an immutable metrics snapshot.
    pub fn snapshot(&self) -> RuntimeMetricsSnapshot {
        RuntimeMetricsSnapshot {
            http_requests: self.http_requests.load(Ordering::Relaxed),
            http_errors: self.http_errors.load(Ordering::Relaxed),
            provider_requests: self.provider_requests.load(Ordering::Relaxed),
            provider_errors: self.provider_errors.load(Ordering::Relaxed),
            tool_executions: self.tool_executions.load(Ordering::Relaxed),
            tool_errors: self.tool_errors.load(Ordering::Relaxed),
            scheduler_claims: self.scheduler_claims.load(Ordering::Relaxed),
            scheduler_successes: self.scheduler_successes.load(Ordering::Relaxed),
            scheduler_failures: self.scheduler_failures.load(Ordering::Relaxed),
            llm_latency_ms: self.llm_latency_ms.load(Ordering::Relaxed),
        }
    }
}

impl Default for RuntimeMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_metrics_snapshot() {
        let metrics = RuntimeMetrics::new();
        metrics.record_http(false);
        metrics.record_http(true);
        metrics.record_provider(false);
        metrics.record_provider(true);
        metrics.record_tool(true);
        metrics.record_scheduler_claim();
        metrics.record_scheduler_completion(true);
        metrics.record_scheduler_completion(false);
        metrics.record_llm_latency(42);

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.http_requests, 2);
        assert_eq!(snapshot.http_errors, 1);
        assert_eq!(snapshot.provider_requests, 2);
        assert_eq!(snapshot.provider_errors, 1);
        assert_eq!(snapshot.tool_executions, 1);
        assert_eq!(snapshot.tool_errors, 1);
        assert_eq!(snapshot.scheduler_claims, 1);
        assert_eq!(snapshot.scheduler_successes, 1);
        assert_eq!(snapshot.scheduler_failures, 1);
        assert_eq!(snapshot.llm_latency_ms, 42);
    }

    #[test]
    fn test_counter() {
        let counter = Counter::new();
        assert_eq!(counter.get(), 0);

        counter.increment();
        assert_eq!(counter.get(), 1);

        counter.increment_by(5);
        assert_eq!(counter.get(), 6);

        counter.reset();
        assert_eq!(counter.get(), 0);
    }

    #[test]
    fn test_histogram() {
        let histogram = Histogram::new();
        histogram.record(5);
        histogram.record(10);
        histogram.record(100);

        let counts = histogram.get_counts();
        assert!(counts.iter().sum::<u64>() > 0);
    }

    #[test]
    fn test_token_metrics() {
        let metrics = TokenMetrics::new();
        metrics.record_input(100);
        metrics.record_output(50);

        assert_eq!(metrics.get_input(), 100);
        assert_eq!(metrics.get_output(), 50);
        assert_eq!(metrics.get_total(), 150);
    }

    #[test]
    fn test_latency_tracker() {
        use std::time::Duration;

        let tracker = LatencyTracker::new();

        let result = tracker.measure(|| {
            std::thread::sleep(Duration::from_millis(10));
            42
        });

        assert_eq!(result, 42);
        let counts = tracker.get_histogram().get_counts();
        assert!(counts.iter().sum::<u64>() > 0);
    }

    #[test]
    fn test_error_metrics() {
        let metrics = ErrorMetrics::new();
        metrics.record_error("test_error");
        metrics.record_error("test_error");
        metrics.record_error("other_error");

        assert_eq!(metrics.get_total(), 3);
    }

    #[test]
    fn test_model_pricing() {
        let pricing = ModelPricing::gpt4();

        let cost = pricing.calculate_cost(1000, 500);
        assert!(cost > 0.0);
    }

    #[test]
    fn test_llm_metrics() {
        let pricing = ModelPricing::gpt35_turbo();
        let metrics = LLMMetrics::new("gpt-3.5-turbo", pricing);

        metrics.record_tokens(TokenType::Prompt, 1000);
        metrics.record_tokens(TokenType::Completion, 500);
        metrics.update_cost();

        assert_eq!(metrics.get_prompt_tokens(), 1000);
        assert_eq!(metrics.get_completion_tokens(), 500);
        assert!(metrics.get_total_cost() >= 0.0);
    }

    #[test]
    fn test_token_type() {
        assert_eq!(TokenType::Prompt, TokenType::Prompt);
        assert_ne!(TokenType::Prompt, TokenType::Completion);
    }
}
