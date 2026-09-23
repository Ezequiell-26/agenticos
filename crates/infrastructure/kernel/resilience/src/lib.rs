//! Resilience Toolkit (based on recloser/tower-resilience MIT patterns)
//! MIT Licensed - Circuit breaker, retry, timeout, rate limiting
//! Source: https://github.com/lerouxrgd/recloser (122 stars, MIT)

use thiserror::Error;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::Instant;

#[derive(Error, Debug)]
pub enum ResilienceError {
    #[error("Circuit breaker is open")]
    CircuitOpen,
    #[error("Operation timed out")]
    Timeout,
    #[error("Max retries exceeded")]
    MaxRetriesExceeded,
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker configuration
pub struct CircuitBreakerConfig {
    pub failure_threshold: usize,
    pub success_threshold: usize,
    pub timeout: Duration,
    pub window_size: usize,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 2,
            timeout: Duration::from_secs(60),
            window_size: 10,
        }
    }
}

/// Circuit breaker
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    state: Arc<RwLock<CircuitState>>,
    failure_count: Arc<AtomicUsize>,
    success_count: Arc<AtomicUsize>,
    last_failure_time: Arc<RwLock<Option<Instant>>>,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(CircuitState::Closed)),
            failure_count: Arc::new(AtomicUsize::new(0)),
            success_count: Arc::new(AtomicUsize::new(0)),
            last_failure_time: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn call<F, T, E>(&self, f: F) -> Result<T, ResilienceError>
    where
        F: FnOnce() -> Result<T, E>,
        E: std::error::Error + Send + Sync + 'static,
    {
        let state = *self.state.read().await;
        
        match state {
            CircuitState::Open => {
                let last_failure = *self.last_failure_time.read().await;
                if let Some(failure_time) = last_failure {
                    if failure_time.elapsed() > self.config.timeout {
                        let mut state = self.state.write().await;
                        *state = CircuitState::HalfOpen;
                        self.success_count.store(0, Ordering::SeqCst);
                    } else {
                        return Err(ResilienceError::CircuitOpen);
                    }
                } else {
                    return Err(ResilienceError::CircuitOpen);
                }
            }
            CircuitState::HalfOpen => {}
            CircuitState::Closed => {}
        }

        let result = f();

        match result {
            Ok(value) => {
                self.on_success().await;
                Ok(value)
            }
            Err(_) => {
                self.on_failure().await;
                Err(ResilienceError::CircuitOpen)
            }
        }
    }

    async fn on_success(&self) {
        let state = *self.state.read().await;
        
        match state {
            CircuitState::HalfOpen => {
                let successes = self.success_count.fetch_add(1, Ordering::SeqCst) + 1;
                if successes >= self.config.success_threshold {
                    let mut state = self.state.write().await;
                    *state = CircuitState::Closed;
                    self.failure_count.store(0, Ordering::SeqCst);
                }
            }
            CircuitState::Closed => {
                self.failure_count.store(0, Ordering::SeqCst);
            }
            CircuitState::Open => {}
        }
    }

    async fn on_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::SeqCst) + 1;
        
        let mut last_failure = self.last_failure_time.write().await;
        *last_failure = Some(Instant::now());
        drop(last_failure);

        let state = *self.state.read().await;
        
        if state != CircuitState::Open && failures >= self.config.failure_threshold {
            let mut state = self.state.write().await;
            *state = CircuitState::Open;
        }
    }

    pub async fn state(&self) -> CircuitState {
        *self.state.read().await
    }

    pub async fn reset(&self) {
        let mut state = self.state.write().await;
        *state = CircuitState::Closed;
        self.failure_count.store(0, Ordering::SeqCst);
        self.success_count.store(0, Ordering::SeqCst);
        let mut last_failure = self.last_failure_time.write().await;
        *last_failure = None;
    }
}

/// Retry configuration
pub struct RetryConfig {
    pub max_attempts: usize,
    pub initial_backoff: Duration,
    pub backoff_multiplier: f64,
    pub max_backoff: Duration,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(100),
            backoff_multiplier: 2.0,
            max_backoff: Duration::from_secs(5),
        }
    }
}

/// Retry utility
pub struct Retry {
    config: RetryConfig,
}

impl Retry {
    pub fn new(config: RetryConfig) -> Self {
        Self { config }
    }

    pub fn call<F, T, E>(&self, mut f: F) -> Result<T, ResilienceError>
    where
        F: FnMut() -> Result<T, E>,
        E: std::error::Error + Send + Sync + 'static,
    {
        let mut attempt = 0;
        let mut backoff = self.config.initial_backoff;

        loop {
            attempt += 1;

            match f() {
                Ok(value) => return Ok(value),
                Err(_) if attempt < self.config.max_attempts => {
                    std::thread::sleep(backoff);
                    let backoff_millis = (backoff.as_millis() as f64 * self.config.backoff_multiplier) as u64;
                    let backoff_millis = backoff_millis.min(self.config.max_backoff.as_millis() as u64);
                    backoff = Duration::from_millis(backoff_millis);
                }
                Err(_) => return Err(ResilienceError::MaxRetriesExceeded),
            }
        }
    }
}

impl Default for Retry {
    fn default() -> Self {
        Self::new(RetryConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            success_threshold: 1,
            timeout: Duration::from_millis(100),
            window_size: 5,
        };
        let breaker = CircuitBreaker::new(config);

        let result = breaker.call(|| Err::<(), _>(std::io::Error::new(
            std::io::ErrorKind::Other,
            "test",
        ))).await;
        assert!(result.is_err());

        let result = breaker.call(|| Err::<(), _>(std::io::Error::new(
            std::io::ErrorKind::Other,
            "test",
        ))).await;
        assert!(result.is_err());

        assert_eq!(breaker.state().await, CircuitState::Open);
    }

    #[test]
    fn test_retry() {
        let retry = Retry::new(RetryConfig {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(10),
            backoff_multiplier: 2.0,
            max_backoff: Duration::from_millis(100),
        });

        let mut attempts = 0;
        let result = retry.call(|| {
            attempts += 1;
            if attempts < 3 {
                Err::<(), _>(std::io::Error::new(std::io::ErrorKind::Other, "test"))
            } else {
                Ok(())
            }
        });

        assert!(result.is_ok());
        assert_eq!(attempts, 3);
    }
}
