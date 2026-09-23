//! Concurrency Stress Tests
//! MIT Licensed - Stress testing for concurrent agent operations

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::{Mutex, Semaphore};

#[cfg(test)]
use tracing::info;

#[derive(Error, Debug)]
pub enum StressTestError {
    #[error("Test timeout")]
    Timeout,
    #[error("Test failed: {0}")]
    TestFailed(String),
}

/// Event bus simulator for stress testing
pub struct EventBus {
    event_count: Arc<AtomicU64>,
    error_count: Arc<AtomicU64>,
    semaphore: Arc<Semaphore>,
}

impl EventBus {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            event_count: Arc::new(AtomicU64::new(0)),
            error_count: Arc::new(AtomicU64::new(0)),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    pub async fn publish(&self) -> Result<(), StressTestError> {
        let _permit = self.semaphore.acquire().await.unwrap();

        // Simulate event processing
        tokio::time::sleep(Duration::from_millis(1)).await;

        self.event_count.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    pub fn event_count(&self) -> u64 {
        self.event_count.load(Ordering::SeqCst)
    }

    pub fn error_count(&self) -> u64 {
        self.error_count.load(Ordering::SeqCst)
    }
}

/// Memory usage tracker
pub struct MemoryTracker {
    peak_memory: Arc<Mutex<usize>>,
    current_memory: Arc<Mutex<usize>>,
}

impl MemoryTracker {
    pub fn new() -> Self {
        Self {
            peak_memory: Arc::new(Mutex::new(0)),
            current_memory: Arc::new(Mutex::new(0)),
        }
    }

    pub async fn allocate(&self, size: usize) {
        let mut current = self.current_memory.lock().await;
        *current += size;

        let mut peak = self.peak_memory.lock().await;
        if *current > *peak {
            *peak = *current;
        }
    }

    pub async fn deallocate(&self, size: usize) {
        let mut current = self.current_memory.lock().await;
        *current = current.saturating_sub(size);
    }

    pub async fn peak_memory(&self) -> usize {
        *self.peak_memory.lock().await
    }

    pub async fn current_memory(&self) -> usize {
        *self.current_memory.lock().await
    }
}

impl Default for MemoryTracker {
    fn default() -> Self {
        Self::new()
    }
}

/// Stress test configuration
pub struct StressTestConfig {
    pub num_agents: usize,
    pub events_per_agent: usize,
    pub max_concurrent: usize,
    pub timeout: Duration,
}

impl Default for StressTestConfig {
    fn default() -> Self {
        Self {
            num_agents: 10,
            events_per_agent: 100,
            max_concurrent: 20,
            timeout: Duration::from_secs(30),
        }
    }
}

/// Stress test result
pub struct StressTestResult {
    pub total_events: u64,
    pub duration: Duration,
    pub events_per_second: f64,
    pub peak_memory: usize,
    pub errors: u64,
    pub success: bool,
}

/// Run stress test with multiple agents
pub async fn run_stress_test(
    config: StressTestConfig,
) -> Result<StressTestResult, StressTestError> {
    let event_bus = Arc::new(EventBus::new(config.max_concurrent));
    let memory_tracker = Arc::new(MemoryTracker::new());

    let start = Instant::now();

    let mut handles = Vec::new();

    for _agent_id in 0..config.num_agents {
        let bus = Arc::clone(&event_bus);
        let mem = Arc::clone(&memory_tracker);
        let events = config.events_per_agent;

        let handle = tokio::spawn(async move {
            for _ in 0..events {
                mem.allocate(1024).await;

                if bus.publish().await.is_err() {
                    // Simulate error
                }

                mem.deallocate(1024).await;
            }
        });

        handles.push(handle);
    }

    let timeout_result = tokio::time::timeout(config.timeout, async {
        for handle in handles {
            handle.await.unwrap();
        }
    })
    .await;

    let duration = start.elapsed();

    if timeout_result.is_err() {
        return Err(StressTestError::Timeout);
    }

    let total_events = event_bus.event_count();
    let peak_memory = memory_tracker.peak_memory().await;
    let errors = event_bus.error_count();

    let events_per_second = if duration.as_secs_f64() > 0.0 {
        total_events as f64 / duration.as_secs_f64()
    } else {
        0.0
    };

    Ok(StressTestResult {
        total_events,
        duration,
        events_per_second,
        peak_memory,
        errors,
        success: true,
    })
}

/// Run latency test
pub async fn run_latency_test(
    num_agents: usize,
    operations: usize,
) -> Result<Vec<Duration>, StressTestError> {
    let mut latencies = Vec::new();

    for _ in 0..operations {
        let start = Instant::now();

        let mut handles = Vec::new();
        for _ in 0..num_agents {
            let handle = tokio::spawn(async move {
                tokio::time::sleep(Duration::from_micros(100)).await;
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.await.unwrap();
        }

        latencies.push(start.elapsed());
    }

    Ok(latencies)
}

/// Calculate p50, p95, p99 latencies
pub fn calculate_percentiles(latencies: &[Duration]) -> (Duration, Duration, Duration) {
    let mut sorted = latencies.to_vec();
    sorted.sort();

    let len = sorted.len();
    if len == 0 {
        return (Duration::ZERO, Duration::ZERO, Duration::ZERO);
    }

    let p50 = sorted[len * 50 / 100];
    let p95 = sorted[len * 95 / 100];
    let p99 = sorted[len * 99 / 100];

    (p50, p95, p99)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_stress_test_10_agents() {
        let config = StressTestConfig {
            num_agents: 10,
            events_per_agent: 50,
            max_concurrent: 20,
            timeout: Duration::from_secs(30),
        };

        let result = run_stress_test(config).await.unwrap();

        assert!(result.success);
        assert_eq!(result.total_events, 500); // 10 agents * 50 events
        assert!(result.events_per_second > 0.0);
        info!(
            "Stress test: {} events/sec, peak memory: {} bytes",
            result.events_per_second, result.peak_memory
        );
    }

    #[tokio::test]
    async fn test_stress_test_20_agents() {
        let config = StressTestConfig {
            num_agents: 20,
            events_per_agent: 50,
            max_concurrent: 20,
            timeout: Duration::from_secs(60),
        };

        let result = run_stress_test(config).await.unwrap();

        assert!(result.success);
        assert_eq!(result.total_events, 1000); // 20 agents * 50 events
        info!(
            "Stress test 20 agents: {} events/sec, peak memory: {} bytes",
            result.events_per_second, result.peak_memory
        );
    }

    #[tokio::test]
    async fn test_latency_test() {
        let latencies = run_latency_test(10, 100).await.unwrap();

        assert_eq!(latencies.len(), 100);

        let (p50, p95, p99) = calculate_percentiles(&latencies);

        info!(
            "Latency percentiles - p50: {:?}, p95: {:?}, p99: {:?}",
            p50, p95, p99
        );

        assert!(p50 > Duration::ZERO);
        assert!(p95 >= p50);
        assert!(p99 >= p95);
    }

    #[tokio::test]
    async fn test_memory_tracker() {
        let tracker = MemoryTracker::new();

        tracker.allocate(1024).await;
        tracker.allocate(2048).await;

        assert_eq!(tracker.current_memory().await, 3072);
        assert_eq!(tracker.peak_memory().await, 3072);

        tracker.deallocate(1024).await;

        assert_eq!(tracker.current_memory().await, 2048);
        assert_eq!(tracker.peak_memory().await, 3072);
    }
}
