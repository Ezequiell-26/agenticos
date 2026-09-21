#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! metrics collection boundary. Functionality is introduced only through verified vertical slices.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
