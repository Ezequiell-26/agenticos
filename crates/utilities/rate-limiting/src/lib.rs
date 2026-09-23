//! Rate Limiting (based on throttlecrab MIT patterns)
//! MIT Licensed - High-performance GCRA rate limiter
//! Source: https://github.com/lazureykis/throttlecrab (11 stars, MIT)

use std::sync::Arc;
use std::time::{Duration, Instant};
use dashmap::DashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RateLimitError {
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Invalid rate limit configuration")]
    InvalidConfig,
}

/// Generic Cell Rate Algorithm (GCRA) rate limiter
#[derive(Clone)]
pub struct GcraRateLimiter {
    _capacity: u64,
    emission_interval: Duration,
    state: Arc<DashMap<String, GcraState>>,
}

#[derive(Clone)]
struct GcraState {
    arrival: Instant,
    next_arrival: Instant,
}

impl GcraRateLimiter {
    /// Create new GCRA rate limiter
    pub fn new(capacity: u64, per_duration: Duration) -> Result<Self, RateLimitError> {
        if capacity == 0 {
            return Err(RateLimitError::InvalidConfig);
        }
        let emission_interval = per_duration / capacity as u32;
        Ok(Self {
            _capacity: capacity,
            emission_interval,
            state: Arc::new(DashMap::new()),
        })
    }

    /// Check if request is allowed
    pub fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let mut state = self.state.entry(key.to_string()).or_insert_with(|| {
            GcraState {
                arrival: now,
                next_arrival: now,
            }
        });

        let arrival = state.arrival;
        let next_arrival = state.next_arrival;

        if now < next_arrival {
            return Err(RateLimitError::RateLimitExceeded);
        }

        let elapsed = now.duration_since(arrival);
        let new_next_arrival = next_arrival + self.emission_interval.max(elapsed);

        state.arrival = now;
        state.next_arrival = new_next_arrival;

        Ok(())
    }

    /// Get time until next allowed request
    pub fn wait_time(&self, key: &str) -> Duration {
        if let Some(state) = self.state.get(key) {
            let now = Instant::now();
            if now < state.next_arrival {
                state.next_arrival - now
            } else {
                Duration::ZERO
            }
        } else {
            Duration::ZERO
        }
    }

    /// Reset rate limit for key
    pub fn reset(&self, key: &str) {
        self.state.remove(key);
    }

    /// Clear all rate limits
    pub fn clear(&self) {
        self.state.clear();
    }
}

/// Token Bucket rate limiter
#[derive(Clone)]
pub struct TokenBucketRateLimiter {
    capacity: u64,
    refill_rate: u64, // tokens per second
    state: Arc<DashMap<String, TokenBucketState>>,
}

#[derive(Clone)]
struct TokenBucketState {
    tokens: u64,
    last_refill: Instant,
}

impl TokenBucketRateLimiter {
    /// Create new token bucket rate limiter
    pub fn new(capacity: u64, refill_rate: u64) -> Result<Self, RateLimitError> {
        if capacity == 0 || refill_rate == 0 {
            return Err(RateLimitError::InvalidConfig);
        }
        Ok(Self {
            capacity,
            refill_rate,
            state: Arc::new(DashMap::new()),
        })
    }

    /// Check if request is allowed
    pub fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let now = Instant::now();
        let mut state = self.state.entry(key.to_string()).or_insert_with(|| {
            TokenBucketState {
                tokens: self.capacity,
                last_refill: now,
            }
        });

        // Refill tokens
        let elapsed = now.duration_since(state.last_refill).as_secs_f64();
        let tokens_to_add = (elapsed * self.refill_rate as f64) as u64;
        state.tokens = (state.tokens + tokens_to_add).min(self.capacity);
        state.last_refill = now;

        if state.tokens > 0 {
            state.tokens -= 1;
            Ok(())
        } else {
            Err(RateLimitError::RateLimitExceeded)
        }
    }

    /// Get time until next token
    pub fn wait_time(&self, key: &str) -> Duration {
        if let Some(state) = self.state.get(key) {
            if state.tokens > 0 {
                Duration::ZERO
            } else {
                Duration::from_secs_f64(1.0 / self.refill_rate as f64)
            }
        } else {
            Duration::ZERO
        }
    }

    /// Get current token count
    pub fn token_count(&self, key: &str) -> u64 {
        if let Some(state) = self.state.get(key) {
            state.tokens
        } else {
            self.capacity
        }
    }

    /// Reset rate limit for key
    pub fn reset(&self, key: &str) {
        self.state.remove(key);
    }

    /// Clear all rate limits
    pub fn clear(&self) {
        self.state.clear();
    }
}

/// Rate limit registry for multiple limiters
pub struct RateLimitRegistry {
    limiters: DashMap<String, Box<dyn RateLimiter>>,
}

trait RateLimiter: Send + Sync {
    fn check(&self, key: &str) -> Result<(), RateLimitError>;
    fn wait_time(&self, key: &str) -> Duration;
}

impl RateLimiter for GcraRateLimiter {
    fn check(&self, key: &str) -> Result<(), RateLimitError> {
        self.check(key)
    }

    fn wait_time(&self, key: &str) -> Duration {
        self.wait_time(key)
    }
}

impl RateLimiter for TokenBucketRateLimiter {
    fn check(&self, key: &str) -> Result<(), RateLimitError> {
        self.check(key)
    }

    fn wait_time(&self, key: &str) -> Duration {
        self.wait_time(key)
    }
}

impl RateLimitRegistry {
    pub fn new() -> Self {
        Self {
            limiters: DashMap::new(),
        }
    }

    /// Register GCRA rate limiter
    pub fn register_gcra(&self, name: &str, capacity: u64, per_duration: Duration) -> Result<(), RateLimitError> {
        let limiter = GcraRateLimiter::new(capacity, per_duration)?;
        self.limiters.insert(name.to_string(), Box::new(limiter));
        Ok(())
    }

    /// Register token bucket rate limiter
    pub fn register_token_bucket(&self, name: &str, capacity: u64, refill_rate: u64) -> Result<(), RateLimitError> {
        let limiter = TokenBucketRateLimiter::new(capacity, refill_rate)?;
        self.limiters.insert(name.to_string(), Box::new(limiter));
        Ok(())
    }

    /// Check rate limit
    pub fn check(&self, limiter_name: &str, key: &str) -> Result<(), RateLimitError> {
        if let Some(limiter) = self.limiters.get(limiter_name) {
            limiter.check(key)
        } else {
            Err(RateLimitError::InvalidConfig)
        }
    }

    /// Get wait time
    pub fn wait_time(&self, limiter_name: &str, key: &str) -> Duration {
        if let Some(limiter) = self.limiters.get(limiter_name) {
            limiter.wait_time(key)
        } else {
            Duration::ZERO
        }
    }
}

impl Default for RateLimitRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gcra_rate_limiter() {
        let limiter = GcraRateLimiter::new(10, Duration::from_secs(1)).unwrap();
        for _ in 0..10 {
            assert!(limiter.check("test").is_ok());
        }
        assert!(limiter.check("test").is_err());
    }

    #[test]
    fn test_gcra_invalid_config() {
        let limiter = GcraRateLimiter::new(0, Duration::from_secs(1));
        assert!(limiter.is_err());
    }

    #[test]
    fn test_token_bucket_rate_limiter() {
        let limiter = TokenBucketRateLimiter::new(10, 10).unwrap();
        for _ in 0..10 {
            assert!(limiter.check("test").is_ok());
        }
        assert!(limiter.check("test").is_err());
    }

    #[test]
    fn test_token_bucket_refill() {
        let limiter = TokenBucketRateLimiter::new(10, 10).unwrap();
        for _ in 0..10 {
            limiter.check("test").unwrap();
        }
        std::thread::sleep(Duration::from_millis(150));
        assert!(limiter.check("test").is_ok());
    }

    #[test]
    fn test_wait_time() {
        let limiter = GcraRateLimiter::new(1, Duration::from_secs(1)).unwrap();
        limiter.check("test").unwrap();
        let wait_time = limiter.wait_time("test");
        assert!(wait_time > Duration::ZERO);
    }

    #[test]
    fn test_reset() {
        let limiter = GcraRateLimiter::new(1, Duration::from_secs(1)).unwrap();
        limiter.check("test").unwrap();
        limiter.reset("test");
        assert!(limiter.check("test").is_ok());
    }

    #[test]
    fn test_registry() {
        let registry = RateLimitRegistry::new();
        registry.register_gcra("test_limiter", 10, Duration::from_secs(1)).unwrap();
        assert!(registry.check("test_limiter", "test").is_ok());
    }
}
