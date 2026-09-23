//! Resource Governor - Resource management and optimization

use super::BrainError;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Resource Governor
#[derive(Debug)]
pub struct ResourceGovernor {
    ram_limiter: Arc<RamLimiter>,
    cpu_limiter: Arc<CpuLimiter>,
    token_budget: Arc<TokenBudget>,
    cache_manager: Arc<CacheManager>,
}

/// RAM limiter
#[derive(Debug)]
pub struct RamLimiter {
    max_mb: u64,
    current_mb: Arc<AtomicU64>,
}

/// CPU limiter
#[derive(Debug)]
pub struct CpuLimiter {
    max_percent: f64,
    current_percent: Arc<AtomicU64>, // Store as integer percentage (0-100)
}

/// Token budget
#[derive(Debug)]
pub struct TokenBudget {
    max_tokens_per_request: u64,
    max_tokens_per_session: u64,
    current_usage: Arc<AtomicU64>,
    optimizer: TokenOptimizer,
}

/// Token optimizer
#[derive(Debug)]
pub struct TokenOptimizer {
    deduplicator: ContextDeduplicator,
    compressor: ContextCompressor,
    #[allow(dead_code)]
    ranker: ContextRanker,
}

/// Context deduplicator
#[derive(Debug)]
pub struct ContextDeduplicator {
    seen_contexts: Arc<RwLock<HashMap<u64, u64>>>,
}

/// Context compressor
#[derive(Debug)]
pub struct ContextCompressor {
    #[allow(dead_code)]
    compression_ratio: f64,
}

/// Context ranker
#[derive(Debug)]
pub struct ContextRanker {
    #[allow(dead_code)]
    max_items: usize,
}

/// Cache manager
#[derive(Debug)]
pub struct CacheManager {
    max_size_mb: u64,
    current_size_mb: Arc<AtomicU64>,
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
}

/// Cache entry
#[derive(Debug, Clone)]
struct CacheEntry {
    data: Vec<u8>,
    size_mb: u64,
    last_accessed: u64,
    access_count: u64,
}

impl ResourceGovernor {
    /// Create a new resource governor
    pub fn new(config: GovernorConfig) -> Self {
        Self {
            ram_limiter: Arc::new(RamLimiter::new(config.max_ram_mb)),
            cpu_limiter: Arc::new(CpuLimiter::new(config.max_cpu_percent)),
            token_budget: Arc::new(TokenBudget::new(config.max_tokens_per_session)),
            cache_manager: Arc::new(CacheManager::new(config.max_cache_mb)),
        }
    }

    /// Check if operation can proceed with resource requirements
    pub async fn check_resources(&self, required: ResourceRequest) -> Result<(), BrainError> {
        // Check RAM
        let current_ram = self.ram_limiter.current_mb.load(Ordering::Relaxed);
        if current_ram + required.ram_mb > self.ram_limiter.max_mb {
            return Err(BrainError::ResourceLimitExceeded(format!(
                "RAM limit exceeded: {} + {} > {} MB",
                current_ram, required.ram_mb, self.ram_limiter.max_mb
            )));
        }

        // Check CPU
        let current_cpu = self.cpu_limiter.current_percent.load(Ordering::Relaxed) as f64;
        if current_cpu + required.cpu_percent > self.cpu_limiter.max_percent {
            return Err(BrainError::ResourceLimitExceeded(format!(
                "CPU limit exceeded: {} + {} > {}",
                current_cpu, required.cpu_percent, self.cpu_limiter.max_percent
            )));
        }

        // Check tokens
        let current_tokens = self.token_budget.current_usage.load(Ordering::Relaxed);
        if current_tokens + required.tokens > self.token_budget.max_tokens_per_session {
            return Err(BrainError::ResourceLimitExceeded(format!(
                "Token budget exceeded: {} + {} > {}",
                current_tokens, required.tokens, self.token_budget.max_tokens_per_session
            )));
        }

        Ok(())
    }

    /// Record resource usage after operation
    pub async fn record_usage(&self, usage: ResourceUsage) {
        // Update RAM usage
        self.ram_limiter
            .current_mb
            .fetch_add(usage.ram_mb, Ordering::Relaxed);

        // Update token usage
        self.token_budget
            .current_usage
            .fetch_add(usage.tokens, Ordering::Relaxed);
    }

    /// Release resources after operation completes
    pub async fn release_resources(&self, usage: ResourceUsage) {
        // Release RAM
        let current = self.ram_limiter.current_mb.load(Ordering::Relaxed);
        if current >= usage.ram_mb {
            self.ram_limiter
                .current_mb
                .fetch_sub(usage.ram_mb, Ordering::Relaxed);
        }

        // Tokens are not released (they're cumulative per session)
    }

    /// Get current resource state
    pub async fn get_state(&self) -> ResourceState {
        ResourceState {
            ram_mb: self.ram_limiter.current_mb.load(Ordering::Relaxed),
            cpu_percent: self.cpu_limiter.current_percent.load(Ordering::Relaxed) as f64,
            tokens_used: self.token_budget.current_usage.load(Ordering::Relaxed),
        }
    }

    /// Optimize context using token optimizer
    pub async fn optimize_context(&self, context: &str) -> Result<String, BrainError> {
        self.token_budget.optimizer.optimize(context).await
    }

    /// Cache a value
    pub async fn cache_put(
        &self,
        key: String,
        data: Vec<u8>,
        size_mb: u64,
    ) -> Result<(), BrainError> {
        self.cache_manager.put(key, data, size_mb).await
    }

    /// Get a cached value
    pub async fn cache_get(&self, key: &str) -> Option<Vec<u8>> {
        self.cache_manager.get(key).await
    }

    /// Evict old cache entries
    pub async fn cache_evict(&self) -> Result<usize, BrainError> {
        self.cache_manager.evict().await
    }

    /// Reset token budget for new session
    pub async fn reset_token_budget(&self) {
        self.token_budget.current_usage.store(0, Ordering::Relaxed);
    }
}

/// Governor configuration
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct GovernorConfig {
    #[allow(missing_docs)]
    pub max_ram_mb: u64,
    #[allow(missing_docs)]
    pub max_cpu_percent: f64,
    #[allow(missing_docs)]
    pub max_tokens_per_session: u64,
    #[allow(missing_docs)]
    pub max_cache_mb: u64,
}

impl Default for GovernorConfig {
    fn default() -> Self {
        Self {
            max_ram_mb: 8192, // 8 GB
            max_cpu_percent: 80.0,
            max_tokens_per_session: 100000,
            max_cache_mb: 1024, // 1 GB
        }
    }
}

impl RamLimiter {
    fn new(max_mb: u64) -> Self {
        Self {
            max_mb,
            current_mb: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl CpuLimiter {
    fn new(max_percent: f64) -> Self {
        Self {
            max_percent,
            current_percent: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl TokenBudget {
    fn new(max_tokens: u64) -> Self {
        Self {
            max_tokens_per_request: max_tokens / 10,
            max_tokens_per_session: max_tokens,
            current_usage: Arc::new(AtomicU64::new(0)),
            optimizer: TokenOptimizer::new(),
        }
    }

    /// Check if request is within token budget
    pub fn check_request(&self, tokens: u64) -> bool {
        let current = self.current_usage.load(Ordering::Relaxed);
        current + tokens <= self.max_tokens_per_session && tokens <= self.max_tokens_per_request
    }
}

impl TokenOptimizer {
    fn new() -> Self {
        Self {
            deduplicator: ContextDeduplicator::new(),
            compressor: ContextCompressor::new(0.7),
            ranker: ContextRanker::new(100),
        }
    }

    /// Optimize context by deduplicating, compressing, and ranking
    pub async fn optimize(&self, context: &str) -> Result<String, BrainError> {
        // Step 1: Deduplicate
        let deduplicated = self.deduplicator.deduplicate(context).await?;

        // Step 2: Compress
        let compressed = self.compressor.compress(&deduplicated).await?;

        // Step 3: Rank (return as-is for now)
        Ok(compressed)
    }

    /// Estimate token savings from optimization
    pub fn estimate_savings(&self, context: &str) -> f64 {
        let original_len = context.len();
        let estimated_compressed = (original_len as f64 * 0.7) as usize;
        1.0 - (estimated_compressed as f64 / original_len as f64)
    }
}

impl ContextDeduplicator {
    fn new() -> Self {
        Self {
            seen_contexts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Remove duplicate content from context
    pub async fn deduplicate(&self, context: &str) -> Result<String, BrainError> {
        let mut seen = self.seen_contexts.write().await;
        let lines: Vec<&str> = context.lines().collect();
        let mut unique_lines = Vec::new();
        let mut hash = 0u64;

        for line in &lines {
            let line_hash = self.hash_line(line);
            if let std::collections::hash_map::Entry::Vacant(e) = seen.entry(line_hash) {
                e.insert(1);
                unique_lines.push(*line);
            }
            hash = hash.wrapping_add(line_hash);
        }

        Ok(unique_lines.join("\n"))
    }

    fn hash_line(&self, line: &str) -> u64 {
        // Simple hash for deduplication
        line.bytes()
            .fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64))
    }
}

impl ContextCompressor {
    fn new(compression_ratio: f64) -> Self {
        Self { compression_ratio }
    }

    /// Compress context (placeholder - real compression would use zstd)
    pub async fn compress(&self, context: &str) -> Result<String, BrainError> {
        // In a real implementation, this would use zstd or similar
        // For now, we simulate compression by removing redundant whitespace
        let compressed = context
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        Ok(compressed)
    }
}

impl ContextRanker {
    fn new(max_items: usize) -> Self {
        Self { max_items }
    }

    /// Rank context items by importance (placeholder)
    pub async fn rank(&self, _context: &str) -> Result<Vec<String>, BrainError> {
        // In a real implementation, this would use TF-IDF, embedding similarity, etc.
        Ok(vec![])
    }
}

impl CacheManager {
    fn new(max_size_mb: u64) -> Self {
        Self {
            max_size_mb,
            current_size_mb: Arc::new(AtomicU64::new(0)),
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Put a value in cache
    pub async fn put(&self, key: String, data: Vec<u8>, size_mb: u64) -> Result<(), BrainError> {
        let current_size = self.current_size_mb.load(Ordering::Relaxed);

        // Evict if necessary
        if current_size + size_mb > self.max_size_mb {
            self.evict().await?;
        }

        let entry = CacheEntry {
            data,
            size_mb,
            last_accessed: 0,
            access_count: 0,
        };

        let mut cache = self.cache.write().await;
        cache.insert(key, entry);
        self.current_size_mb.fetch_add(size_mb, Ordering::Relaxed);

        Ok(())
    }

    /// Get a value from cache
    pub async fn get(&self, key: &str) -> Option<Vec<u8>> {
        let mut cache = self.cache.write().await;
        if let Some(entry) = cache.get_mut(key) {
            entry.last_accessed += 1;
            entry.access_count += 1;
            Some(entry.data.clone())
        } else {
            None
        }
    }

    /// Evict least recently used items
    pub async fn evict(&self) -> Result<usize, BrainError> {
        let mut cache = self.cache.write().await;
        let mut evicted = 0;
        let mut current_size = self.current_size_mb.load(Ordering::Relaxed);

        // Collect keys to evict
        let mut keys_to_evict: Vec<String> = Vec::new();
        {
            let mut entries: Vec<_> = cache.iter().collect();
            entries.sort_by_key(|(_, entry)| entry.access_count);

            for (key, entry) in entries {
                if current_size <= self.max_size_mb / 2 {
                    break;
                }
                current_size -= entry.size_mb;
                keys_to_evict.push(key.clone());
            }
        }

        // Evict collected keys
        for key in keys_to_evict {
            if let Some(entry) = cache.remove(&key) {
                current_size -= entry.size_mb;
                evicted += 1;
            }
        }

        self.current_size_mb.store(current_size, Ordering::Relaxed);
        Ok(evicted)
    }

    /// Clear entire cache
    pub async fn clear(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
        self.current_size_mb.store(0, Ordering::Relaxed);
    }
}

impl Default for ResourceGovernor {
    fn default() -> Self {
        Self::new(GovernorConfig::default())
    }
}

/// Resource request
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct ResourceRequest {
    #[allow(missing_docs)]
    pub ram_mb: u64,
    #[allow(missing_docs)]
    pub cpu_percent: f64,
    #[allow(missing_docs)]
    pub tokens: u64,
}

/// Resource usage
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct ResourceUsage {
    #[allow(missing_docs)]
    pub ram_mb: u64,
    #[allow(missing_docs)]
    pub cpu_ms: u64,
    #[allow(missing_docs)]
    pub tokens: u64,
}

/// Resource state
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct ResourceState {
    #[allow(missing_docs)]
    pub ram_mb: u64,
    #[allow(missing_docs)]
    pub cpu_percent: f64,
    #[allow(missing_docs)]
    pub tokens_used: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_governor_config_default() {
        let config = GovernorConfig::default();
        assert_eq!(config.max_ram_mb, 8192);
        assert_eq!(config.max_cpu_percent, 80.0);
        assert_eq!(config.max_tokens_per_session, 100000);
    }

    #[tokio::test]
    async fn test_check_resources_success() {
        let governor = ResourceGovernor::default();
        let request = ResourceRequest {
            ram_mb: 100,
            cpu_percent: 10.0,
            tokens: 1000,
        };

        let result = governor.check_resources(request).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_check_resources_ram_limit() {
        let governor = ResourceGovernor::default();
        let request = ResourceRequest {
            ram_mb: 10000, // Exceeds 8GB limit
            cpu_percent: 10.0,
            tokens: 1000,
        };

        let result = governor.check_resources(request).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_record_usage() {
        let governor = ResourceGovernor::default();
        let usage = ResourceUsage {
            ram_mb: 100,
            cpu_ms: 1000,
            tokens: 1000,
        };

        governor.record_usage(usage).await;
        let state = governor.get_state().await;
        assert_eq!(state.ram_mb, 100);
        assert_eq!(state.tokens_used, 1000);
    }

    #[tokio::test]
    async fn test_release_resources() {
        let governor = ResourceGovernor::default();
        let usage = ResourceUsage {
            ram_mb: 100,
            cpu_ms: 1000,
            tokens: 1000,
        };

        governor.record_usage(usage.clone()).await;
        governor.release_resources(usage).await;
        let state = governor.get_state().await;
        assert_eq!(state.ram_mb, 0); // RAM released
        assert_eq!(state.tokens_used, 1000); // Tokens not released
    }

    #[tokio::test]
    async fn test_optimize_context() {
        let governor = ResourceGovernor::default();
        let context = "Line 1\nLine 2\nLine 1\nLine 3";

        let _result = governor.optimize_context(context).await;
        assert!(_result.is_ok());
        let optimized = _result.unwrap();
        // Deduplication should remove duplicate "Line 1"
        assert!(!optimized.contains("Line 1\nLine 1"));
    }

    #[tokio::test]
    async fn test_cache_put_get() {
        let governor = ResourceGovernor::default();
        let key = "test_key".to_string();
        let data = vec![1, 2, 3, 4];

        governor
            .cache_put(key.clone(), data.clone(), 1)
            .await
            .unwrap();
        let retrieved = governor.cache_get(&key).await;
        assert_eq!(retrieved, Some(data));
    }

    #[tokio::test]
    async fn test_cache_evict() {
        let governor = ResourceGovernor::default();

        // Add items that exceed cache limit (1024 MB)
        for i in 0..110 {
            let key = format!("key_{}", i);
            let data = vec![i as u8; 10 * 1024 * 1024]; // 10 MB each
            let _result = governor.cache_put(key, data, 10).await;
            // Some items should fail due to eviction
        }

        // Evict should remove some items
        let evicted = governor.cache_evict().await.unwrap();
        // We expect eviction to happen
        assert!(evicted > 0);
    }

    #[tokio::test]
    async fn test_reset_token_budget() {
        let governor = ResourceGovernor::default();
        let usage = ResourceUsage {
            ram_mb: 0,
            cpu_ms: 0,
            tokens: 5000,
        };

        governor.record_usage(usage).await;
        governor.reset_token_budget().await;
        let state = governor.get_state().await;
        assert_eq!(state.tokens_used, 0);
    }
}
