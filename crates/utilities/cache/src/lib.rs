//! Cache (based on lru-rs MIT patterns)
//! MIT Licensed - Implementation of a LRU cache
//! Source: https://github.com/jeromefroe/lru-rs (821 stars, MIT)

use std::collections::HashMap;
use std::hash::Hash;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CacheError {
    #[error("Cache capacity must be non-zero")]
    InvalidCapacity,
}

/// LRU Cache implementation (simplified without linked list)
pub struct LruCache<K, V> {
    capacity: usize,
    map: HashMap<K, V>,
    order: Vec<K>,
}

impl<K, V> LruCache<K, V>
where
    K: Hash + Eq + Clone,
{
    /// Create new LRU cache with specified capacity
    pub fn new(capacity: usize) -> Result<Self, CacheError> {
        if capacity == 0 {
            return Err(CacheError::InvalidCapacity);
        }
        Ok(Self {
            capacity,
            map: HashMap::new(),
            order: Vec::new(),
        })
    }

    /// Insert or update a key-value pair
    pub fn put(&mut self, key: K, value: V) {
        if self.map.contains_key(&key) {
            // Update existing
            self.map.insert(key.clone(), value);
            // Move to end (most recently used)
            if let Some(pos) = self.order.iter().position(|k| k == &key) {
                self.order.remove(pos);
            }
            self.order.push(key);
        } else {
            // Insert new
            if self.map.len() >= self.capacity {
                // Remove LRU
                if let Some(lru_key) = self.order.first() {
                    self.map.remove(lru_key);
                    self.order.remove(0);
                }
            }
            self.map.insert(key.clone(), value);
            self.order.push(key);
        }
    }

    /// Get value by key
    pub fn get(&mut self, key: &K) -> Option<&V> {
        if self.map.contains_key(key) {
            // Move to end (most recently used)
            if let Some(pos) = self.order.iter().position(|k| k == key) {
                let key = self.order.remove(pos);
                self.order.push(key);
            }
            self.map.get(key)
        } else {
            None
        }
    }

    /// Get mutable value by key
    pub fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        if self.map.contains_key(key) {
            // Move to end (most recently used)
            if let Some(pos) = self.order.iter().position(|k| k == key) {
                let key = self.order.remove(pos);
                self.order.push(key);
            }
            self.map.get_mut(key)
        } else {
            None
        }
    }

    /// Remove and return value by key
    pub fn pop(&mut self, key: &K) -> Option<V> {
        if let Some(pos) = self.order.iter().position(|k| k == key) {
            self.order.remove(pos);
        }
        self.map.remove(key)
    }

    /// Check if key exists
    pub fn contains_key(&self, key: &K) -> bool {
        self.map.contains_key(key)
    }

    /// Get current size
    pub fn len(&self) -> usize {
        self.map.len()
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    /// Clear all entries
    pub fn clear(&mut self) {
        self.map.clear();
        self.order.clear();
    }
}

/// Thread-safe LRU cache using RwLock
pub struct ConcurrentLruCache<K, V> {
    inner: std::sync::RwLock<LruCache<K, V>>,
}

impl<K, V> ConcurrentLruCache<K, V>
where
    K: Hash + Eq + Clone,
{
    pub fn new(capacity: usize) -> Result<Self, CacheError> {
        Ok(Self {
            inner: std::sync::RwLock::new(LruCache::new(capacity)?),
        })
    }

    pub fn put(&self, key: K, value: V) {
        if let Ok(mut cache) = self.inner.write() {
            cache.put(key, value);
        }
    }

    pub fn get(&self, key: &K) -> Option<V>
    where
        V: Clone,
    {
        if let Ok(mut cache) = self.inner.write() {
            cache.get(key).cloned()
        } else {
            None
        }
    }

    pub fn contains_key(&self, key: &K) -> bool {
        if let Ok(cache) = self.inner.read() {
            cache.contains_key(key)
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        if let Ok(cache) = self.inner.read() {
            cache.len()
        } else {
            0
        }
    }

    pub fn clear(&self) {
        if let Ok(mut cache) = self.inner.write() {
            cache.clear();
        }
    }
}

/// TTL cache with expiration
pub struct TtlCache<K, V> {
    entries: HashMap<K, (V, std::time::Instant)>,
    ttl: std::time::Duration,
}

impl<K, V> TtlCache<K, V>
where
    K: Hash + Eq,
    V: Clone,
{
    pub fn new(ttl: std::time::Duration) -> Self {
        Self {
            entries: HashMap::new(),
            ttl,
        }
    }

    pub fn put(&mut self, key: K, value: V) {
        self.entries.insert(key, (value, std::time::Instant::now()));
    }

    pub fn get(&mut self, key: &K) -> Option<V> {
        let now = std::time::Instant::now();
        if let Some((value, timestamp)) = self.entries.get(key) {
            if now.duration_since(*timestamp) < self.ttl {
                return Some(value.clone());
            }
        }
        self.entries.remove(key);
        None
    }

    pub fn remove_expired(&mut self) {
        let now = std::time::Instant::now();
        self.entries
            .retain(|_, (_, timestamp)| now.duration_since(*timestamp) < self.ttl);
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_cache_creation() {
        let cache: LruCache<i32, i32> = LruCache::new(10).unwrap();
        assert_eq!(cache.len(), 0);
        assert!(cache.is_empty());
    }

    #[test]
    fn test_lru_cache_put_get() {
        let mut cache = LruCache::new(10).unwrap();
        cache.put(1, 10);
        assert!(cache.contains_key(&1));
        assert_eq!(cache.get(&1), Some(&10));
    }

    #[test]
    fn test_concurrent_lru_cache() {
        let cache = ConcurrentLruCache::new(10).unwrap();
        cache.put(1, 10);
        assert!(cache.contains_key(&1));
        assert_eq!(cache.get(&1), Some(10));
    }

    #[test]
    fn test_ttl_cache() {
        let mut cache = TtlCache::new(std::time::Duration::from_millis(100));
        cache.put(1, 10);
        assert_eq!(cache.get(&1), Some(10));
        std::thread::sleep(std::time::Duration::from_millis(150));
        assert_eq!(cache.get(&1), None);
    }

    #[test]
    fn test_ttl_cache_remove_expired() {
        let mut cache = TtlCache::new(std::time::Duration::from_millis(50));
        cache.put(1, 10);
        cache.put(2, 20);
        std::thread::sleep(std::time::Duration::from_millis(100));
        cache.remove_expired();
        assert_eq!(cache.len(), 0);
    }
}
