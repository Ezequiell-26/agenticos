//! Metrics (based on metrics-rs MIT patterns)
//! MIT Licensed - A metrics ecosystem for Rust
//! Source: https://github.com/metrics-rs/metrics (1463 stars, MIT)

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::collections::HashMap;
use std::time::Instant;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MetricsError {
    #[error("Metric not found: {0}")]
    MetricNotFound(String),
    #[error("Invalid metric name: {0}")]
    InvalidName(String),
}

/// Counter metric (monotonically increasing)
#[derive(Clone)]
pub struct Counter {
    value: Arc<AtomicU64>,
    labels: Vec<String>,
}

impl Counter {
    pub fn new(labels: Vec<String>) -> Self {
        Self {
            value: Arc::new(AtomicU64::new(0)),
            labels,
        }
    }

    pub fn increment(&self) {
        self.value.fetch_add(1, Ordering::Relaxed);
    }

    pub fn increment_by(&self, value: u64) {
        self.value.fetch_add(value, Ordering::Relaxed);
    }

    pub fn get(&self) -> u64 {
        self.value.load(Ordering::Relaxed)
    }

    pub fn reset(&self) {
        self.value.store(0, Ordering::Relaxed);
    }
}

/// Gauge metric (can go up and down)
#[derive(Clone)]
pub struct Gauge {
    value: Arc<AtomicU64>,
    labels: Vec<String>,
}

impl Gauge {
    pub fn new(labels: Vec<String>) -> Self {
        Self {
            value: Arc::new(AtomicU64::new(0)),
            labels,
        }
    }

    pub fn set(&self, value: u64) {
        self.value.store(value, Ordering::Relaxed);
    }

    pub fn increment(&self) {
        self.value.fetch_add(1, Ordering::Relaxed);
    }

    pub fn decrement(&self) {
        self.value.fetch_sub(1, Ordering::Relaxed);
    }

    pub fn get(&self) -> u64 {
        self.value.load(Ordering::Relaxed)
    }
}

/// Histogram metric (distribution of values)
#[derive(Clone)]
pub struct Histogram {
    counts: Arc<Vec<AtomicU64>>,
    buckets: Vec<f64>,
    sum: Arc<AtomicU64>,
    labels: Vec<String>,
}

impl Histogram {
    pub fn new(buckets: Vec<f64>, labels: Vec<String>) -> Self {
        let counts: Vec<AtomicU64> = buckets.iter().map(|_| AtomicU64::new(0)).collect();
        Self {
            counts: Arc::new(counts),
            buckets,
            sum: Arc::new(AtomicU64::new(0)),
            labels,
        }
    }

    pub fn observe(&self, value: f64) {
        // Find the appropriate bucket
        for (i, &bucket) in self.buckets.iter().enumerate() {
            if value <= bucket {
                self.counts[i].fetch_add(1, Ordering::Relaxed);
            }
        }
        // Also count in the +Inf bucket (last one)
        if !self.buckets.is_empty() {
            self.counts[self.counts.len() - 1].fetch_add(1, Ordering::Relaxed);
        }
        self.sum.fetch_add(value as u64, Ordering::Relaxed);
    }

    pub fn get_counts(&self) -> Vec<u64> {
        self.counts.iter().map(|c| c.load(Ordering::Relaxed)).collect()
    }

    pub fn get_sum(&self) -> u64 {
        self.sum.load(Ordering::Relaxed)
    }
}

/// Summary metric (quantiles)
#[derive(Clone)]
pub struct Summary {
    values: Arc<std::sync::Mutex<Vec<f64>>>,
    max_samples: usize,
    _labels: Vec<String>,
}

impl Summary {
    pub fn new(max_samples: usize, labels: Vec<String>) -> Self {
        Self {
            values: Arc::new(std::sync::Mutex::new(Vec::with_capacity(max_samples))),
            max_samples,
            _labels: labels,
        }
    }

    pub fn observe(&self, value: f64) {
        let mut values = self.values.lock().unwrap();
        values.push(value);
        if values.len() > self.max_samples {
            values.remove(0);
        }
    }

    pub fn quantile(&self, q: f64) -> f64 {
        let values = self.values.lock().unwrap();
        if values.is_empty() {
            return 0.0;
        }
        let mut sorted = values.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let index = ((sorted.len() as f64) * q).floor() as usize;
        sorted[index.min(sorted.len() - 1)]
    }
}

/// Metrics registry
pub struct Registry {
    counters: HashMap<String, Counter>,
    gauges: HashMap<String, Gauge>,
    histograms: HashMap<String, Histogram>,
    summaries: HashMap<String, Summary>,
}

impl Registry {
    pub fn new() -> Self {
        Self {
            counters: HashMap::new(),
            gauges: HashMap::new(),
            histograms: HashMap::new(),
            summaries: HashMap::new(),
        }
    }

    pub fn register_counter(&mut self, name: &str, labels: Vec<String>) -> Result<(), MetricsError> {
        if name.is_empty() {
            return Err(MetricsError::InvalidName("Empty name".to_string()));
        }
        let counter = Counter::new(labels);
        self.counters.insert(name.to_string(), counter);
        Ok(())
    }

    pub fn register_gauge(&mut self, name: &str, labels: Vec<String>) -> Result<(), MetricsError> {
        if name.is_empty() {
            return Err(MetricsError::InvalidName("Empty name".to_string()));
        }
        let gauge = Gauge::new(labels);
        self.gauges.insert(name.to_string(), gauge);
        Ok(())
    }

    pub fn register_histogram(&mut self, name: &str, buckets: Vec<f64>, labels: Vec<String>) -> Result<(), MetricsError> {
        if name.is_empty() {
            return Err(MetricsError::InvalidName("Empty name".to_string()));
        }
        let histogram = Histogram::new(buckets, labels);
        self.histograms.insert(name.to_string(), histogram);
        Ok(())
    }

    pub fn register_summary(&mut self, name: &str, max_samples: usize, labels: Vec<String>) -> Result<(), MetricsError> {
        if name.is_empty() {
            return Err(MetricsError::InvalidName("Empty name".to_string()));
        }
        let summary = Summary::new(max_samples, labels);
        self.summaries.insert(name.to_string(), summary);
        Ok(())
    }

    pub fn counter(&self, name: &str) -> Result<Counter, MetricsError> {
        self.counters.get(name).cloned().ok_or_else(|| MetricsError::MetricNotFound(name.to_string()))
    }

    pub fn gauge(&self, name: &str) -> Result<Gauge, MetricsError> {
        self.gauges.get(name).cloned().ok_or_else(|| MetricsError::MetricNotFound(name.to_string()))
    }

    pub fn histogram(&self, name: &str) -> Result<Histogram, MetricsError> {
        self.histograms.get(name).cloned().ok_or_else(|| MetricsError::MetricNotFound(name.to_string()))
    }

    pub fn summary(&self, name: &str) -> Result<Summary, MetricsError> {
        self.summaries.get(name).cloned().ok_or_else(|| MetricsError::MetricNotFound(name.to_string()))
    }

    /// Export metrics in Prometheus text format
    pub fn export_prometheus(&self) -> String {
        let mut output = String::new();

        // Export counters
        for (name, counter) in &self.counters {
            let label_str = if counter.labels.is_empty() {
                String::new()
            } else {
                format!("{{{}}}", counter.labels.join(","))
            };
            output.push_str(&format!("# TYPE {} counter\n", name));
            output.push_str(&format!("{}{} {}\n", name, label_str, counter.get()));
        }

        // Export gauges
        for (name, gauge) in &self.gauges {
            let label_str = if gauge.labels.is_empty() {
                String::new()
            } else {
                format!("{{{}}}", gauge.labels.join(","))
            };
            output.push_str(&format!("# TYPE {} gauge\n", name));
            output.push_str(&format!("{}{} {}\n", name, label_str, gauge.get()));
        }

        // Export histograms
        for (name, histogram) in &self.histograms {
            let label_str = if histogram.labels.is_empty() {
                String::new()
            } else {
                format!("{{{}}}", histogram.labels.join(","))
            };
            output.push_str(&format!("# TYPE {} histogram\n", name));
            output.push_str(&format!("{}_sum{} {}\n", name, label_str, histogram.get_sum()));
            for (i, count) in histogram.get_counts().iter().enumerate() {
                output.push_str(&format!("{}_bucket{} {:e} {}\n", name, label_str, histogram.buckets[i], count));
            }
        }

        output
    }
}

impl Default for Registry {
    fn default() -> Self {
        Self::new()
    }
}

/// Timer for measuring operation duration
pub struct Timer {
    histogram: Histogram,
    start: Instant,
}

impl Timer {
    pub fn new(histogram: Histogram) -> Self {
        Self {
            histogram,
            start: Instant::now(),
        }
    }

    pub fn observe(self) {
        let duration = self.start.elapsed();
        self.histogram.observe(duration.as_secs_f64());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter() {
        let counter = Counter::new(vec!["test".to_string()]);
        counter.increment();
        counter.increment_by(5);
        assert_eq!(counter.get(), 6);
    }

    #[test]
    fn test_gauge() {
        let gauge = Gauge::new(vec!["test".to_string()]);
        gauge.set(10);
        gauge.increment();
        gauge.decrement();
        assert_eq!(gauge.get(), 10);
    }

    #[test]
    fn test_histogram() {
        let histogram = Histogram::new(vec![1.0, 5.0, 10.0], vec!["test".to_string()]);
        histogram.observe(0.5);
        histogram.observe(3.0);
        histogram.observe(7.0);
        let counts = histogram.get_counts();
        assert!(counts.iter().sum::<u64>() > 0);
    }

    #[test]
    fn test_summary() {
        let summary = Summary::new(100, vec!["test".to_string()]);
        summary.observe(1.0);
        summary.observe(2.0);
        summary.observe(3.0);
        let p50 = summary.quantile(0.5);
        assert!(p50 > 0.0);
    }

    #[test]
    fn test_registry() {
        let mut registry = Registry::new();
        registry.register_counter("test_counter", vec!["label1".to_string()]).unwrap();
        let counter = registry.counter("test_counter").unwrap();
        counter.increment();
        assert_eq!(counter.get(), 1);
    }

    #[test]
    fn test_export_prometheus() {
        let mut registry = Registry::new();
        registry.register_counter("test_counter", vec![]).unwrap();
        registry.counter("test_counter").unwrap().increment();
        let output = registry.export_prometheus();
        assert!(output.contains("test_counter"));
    }
}
