#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! metrics collection boundary. Functionality is introduced only through verified vertical slices.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

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
}
