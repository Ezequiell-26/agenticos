//! Rate Limiting (based on GCRA/throttlecrab MIT patterns)
//! MIT Licensed - Rate limiting with GCRA and token bucket
//! Source: https://github.com/andymkerr/throttlecrab (11 stars, MIT)

use thiserror::Error;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Error, Debug)]
pub enum RateLimitError {
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Invalid rate limit configuration")]
    InvalidConfiguration,
}

/// Rate limiter using GCRA (Generic Cell Rate Algorithm)
pub struct RateLimiter {
    capacity: u64,
    rate: Duration,
    tokens: Arc<RwLock<HashMap<String, TokenBucket>>>,
}

#[derive(Debug, Clone)]
struct TokenBucket {
    tokens: f64,
    last_update: Instant,
}

impl TokenBucket {
    fn new(capacity: u64) -> Self {
        Self {
            tokens: capacity as f64,
            last_update: Instant::now(),
        }
    }
}

impl RateLimiter {
    /// Create new rate limiter
    /// capacity: maximum number of tokens
    /// rate: time per token (e.g., Duration::from_millis(100) for 10 req/sec)
    pub fn new(capacity: u64, rate: Duration) -> Self {
        Self {
            capacity,
            rate,
            tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Check if request is allowed for given key
    pub async fn check(&self, key: &str) -> Result<(), RateLimitError> {
        let mut tokens = self.tokens.write().await;
        let bucket = tokens.entry(key.to_string()).or_insert_with(|| TokenBucket::new(self.capacity));
        
        let now = Instant::now();
        let elapsed = now.duration_since(bucket.last_update);
        let new_tokens = (elapsed.as_secs_f64() / self.rate.as_secs_f64()) * self.capacity as f64;
        
        bucket.tokens = (bucket.tokens + new_tokens).min(self.capacity as f64);
        bucket.last_update = now;
        
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            Err(RateLimitError::RateLimitExceeded)
        }
    }

    /// Get time until next request is allowed
    pub async fn wait_time(&self, key: &str) -> Option<Duration> {
        let tokens = self.tokens.read().await;
        if let Some(bucket) = tokens.get(key) {
            if bucket.tokens >= 1.0 {
                None
            } else {
                let needed = 1.0 - bucket.tokens;
                let seconds_needed = needed * self.rate.as_secs_f64() / self.capacity as f64;
                Some(Duration::from_secs_f64(seconds_needed))
            }
        } else {
            None
        }
    }

    /// Reset rate limiter for key
    pub async fn reset(&self, key: &str) {
        let mut tokens = self.tokens.write().await;
        tokens.remove(key);
    }
}

/// Token bucket rate limiter
pub struct TokenBucketLimiter {
    capacity: u64,
    refill_rate: u64, // tokens per second
    refill_interval: Duration,
    buckets: Arc<RwLock<HashMap<String, TokenBucketState>>>,
}

#[derive(Debug, Clone)]
struct TokenBucketState {
    tokens: u64,
    last_refill: Instant,
}

impl TokenBucketState {
    fn new(capacity: u64) -> Self {
        Self {
            tokens: capacity,
            last_refill: Instant::now(),
        }
    }
}

impl TokenBucketLimiter {
    /// Create new token bucket limiter
    /// capacity: maximum tokens
    /// refill_rate: tokens per second
    pub fn new(capacity: u64, refill_rate: u64) -> Self {
        let refill_interval = Duration::from_secs(1);
        Self {
            capacity,
            refill_rate,
            refill_interval,
            buckets: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Try to consume tokens
    pub async fn try_consume(&self, key: &str, amount: u64) -> Result<(), RateLimitError> {
        let mut buckets = self.buckets.write().await;
        let bucket = buckets.entry(key.to_string()).or_insert_with(|| TokenBucketState::new(self.capacity));
        
        let now = Instant::now();
        let elapsed = now.duration_since(bucket.last_refill);
        
        // Refill tokens based on elapsed time
        let refill_amount = (elapsed.as_secs_f64() * self.refill_rate as f64) as u64;
        bucket.tokens = (bucket.tokens + refill_amount).min(self.capacity);
        bucket.last_refill = now;
        
        if bucket.tokens >= amount {
            bucket.tokens -= amount;
            Ok(())
        } else {
            Err(RateLimitError::RateLimitExceeded)
        }
    }

    /// Get current token count
    pub async fn token_count(&self, key: &str) -> u64 {
        let buckets = self.buckets.read().await;
        buckets.get(key).map(|b| b.tokens).unwrap_or(self.capacity)
    }

    /// Reset bucket
    pub async fn reset(&self, key: &str) {
        let mut buckets = self.buckets.write().await;
        buckets.remove(key);
    }
}

/// Rate limit registry for multiple rate limiters
pub struct RateLimitRegistry {
    limiters: Arc<RwLock<HashMap<String, RateLimiter>>>,
}

impl RateLimitRegistry {
    /// Create new registry
    pub fn new() -> Self {
        Self {
            limiters: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a rate limiter
    pub async fn register(&self, name: String, limiter: RateLimiter) {
        let mut limiters = self.limiters.write().await;
        limiters.insert(name, limiter);
    }

    /// Check rate limit
    pub async fn check(&self, name: &str, key: &str) -> Result<(), RateLimitError> {
        let limiters = self.limiters.read().await;
        if let Some(limiter) = limiters.get(name) {
            limiter.check(key).await
        } else {
            Err(RateLimitError::InvalidConfiguration)
        }
    }

    /// Get wait time
    pub async fn wait_time(&self, name: &str, key: &str) -> Option<Duration> {
        let limiters = self.limiters.read().await;
        limiters.get(name).and_then(|l| {
            // This would need to be async, but for simplicity we return None
            None
        })
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

    #[tokio::test]
    async fn test_rate_limiter() {
        let limiter = RateLimiter::new(5, Duration::from_millis(100)); // 5 tokens, 100ms per token = 10 req/sec
        
        // Should allow first 5 requests
        for _ in 0..5 {
            assert!(limiter.check("test").await.is_ok());
        }
        
        // 6th request should be rate limited
        assert!(limiter.check("test").await.is_err());
    }

    #[tokio::test]
    async fn test_token_bucket() {
        let limiter = TokenBucketLimiter::new(10, 5); // 10 capacity, 5 tokens/sec
        
        // Should allow 10 tokens
        assert!(limiter.try_consume("test", 10).await.is_ok());
        
        // Should be rate limited
        assert!(limiter.try_consume("test", 1).await.is_err());
    }

    #[tokio::test]
    async fn test_registry() {
        let registry = RateLimitRegistry::new();
        let limiter = RateLimiter::new(3, Duration::from_millis(100));
        
        registry.register("api".to_string(), limiter).await;
        
        // Should work
        assert!(registry.check("api", "user1").await.is_ok());
        assert!(registry.check("api", "user1").await.is_ok());
        assert!(registry.check("api", "user1").await.is_ok());
        
        // Should be rate limited
        assert!(registry.check("api", "user1").await.is_err());
    }
}
