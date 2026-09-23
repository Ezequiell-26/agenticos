//! Knowledge Base - Persistent, indexed knowledge storage

use super::{BrainError, ProvenanceEvidence};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Knowledge Base
pub struct KnowledgeBase {
    storage: Arc<dyn KnowledgeStorage>,
    index: Arc<RwLock<KnowledgeIndex>>,
    config: KnowledgeConfig,
}

/// Knowledge storage trait
#[async_trait::async_trait]
pub trait KnowledgeStorage: Send + Sync {
    async fn store(&self, key: String, knowledge: KnowledgeEntry) -> Result<(), BrainError>;
    async fn retrieve(&self, key: &str) -> Result<Option<KnowledgeEntry>, BrainError>;
    async fn search(&self, query: &str) -> Result<Vec<KnowledgeEntry>, BrainError>;
}

/// Knowledge index
pub struct KnowledgeIndex {
    entries: HashMap<String, Vec<KnowledgeEntry>>,
}

/// Knowledge configuration
#[derive(Debug, Clone)]
pub struct KnowledgeConfig {
    pub max_entries: usize,
    pub enable_compression: bool,
}

impl Default for KnowledgeConfig {
    fn default() -> Self {
        Self {
            max_entries: 100000,
            enable_compression: true,
        }
    }
}

/// Knowledge entry
#[derive(Debug, Clone)]
pub struct KnowledgeEntry {
    pub key: String,
    pub content: String,
    pub metadata: KnowledgeMetadata,
    pub provenance: ProvenanceEvidence,
}

/// Knowledge metadata
#[derive(Debug, Clone)]
pub struct KnowledgeMetadata {
    pub language: String,
    pub size_bytes: usize,
    pub compressed: bool,
    pub indexed: bool,
}

impl KnowledgeBase {
    /// Create a new knowledge base
    pub fn new(storage: Arc<dyn KnowledgeStorage>, config: KnowledgeConfig) -> Self {
        Self {
            storage,
            index: Arc::new(RwLock::new(KnowledgeIndex::new())),
            config,
        }
    }

    /// Store knowledge
    pub async fn store(&self, entry: KnowledgeEntry) -> Result<(), BrainError> {
        self.storage.store(entry.key.clone(), entry.clone()).await?;

        let mut index = self.index.write().await;
        index.index_entry(entry);

        Ok(())
    }

    /// Retrieve knowledge by key
    pub async fn retrieve(&self, key: &str) -> Result<Option<KnowledgeEntry>, BrainError> {
        self.storage.retrieve(key).await
    }

    /// Search knowledge
    pub async fn search(&self, query: &str) -> Result<Vec<KnowledgeEntry>, BrainError> {
        self.storage.search(query).await
    }

    /// Update knowledge
    pub async fn update(&self, key: String, entry: KnowledgeEntry) -> Result<(), BrainError> {
        self.storage.store(key, entry).await
    }
}

impl KnowledgeIndex {
    fn new() -> Self {
        Self {
            entries: HashMap::new(),
        }
    }

    fn index_entry(&mut self, entry: KnowledgeEntry) {
        // Placeholder: simple indexing by language
        let language = entry.metadata.language.clone();
        self.entries
            .entry(language)
            .or_insert_with(Vec::new)
            .push(entry);
    }
}

/// In-memory knowledge storage for testing
pub struct InMemoryKnowledgeStorage {
    entries: Arc<RwLock<HashMap<String, KnowledgeEntry>>>,
}

impl InMemoryKnowledgeStorage {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl KnowledgeStorage for InMemoryKnowledgeStorage {
    async fn store(&self, key: String, entry: KnowledgeEntry) -> Result<(), BrainError> {
        let mut entries = self.entries.write().await;
        entries.insert(key, entry);
        Ok(())
    }

    async fn retrieve(&self, key: &str) -> Result<Option<KnowledgeEntry>, BrainError> {
        let entries = self.entries.read().await;
        Ok(entries.get(key).cloned())
    }

    async fn search(&self, query: &str) -> Result<Vec<KnowledgeEntry>, BrainError> {
        let entries = self.entries.read().await;
        let results: Vec<KnowledgeEntry> = entries
            .values()
            .filter(|e| e.content.contains(query) || e.key.contains(query))
            .cloned()
            .collect();
        Ok(results)
    }
}

impl Default for InMemoryKnowledgeStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[tokio::test]
    async fn test_knowledge_base() {
        let storage = Arc::new(InMemoryKnowledgeStorage::new());
        let kb = KnowledgeBase::new(storage, KnowledgeConfig::default());

        let entry = KnowledgeEntry {
            key: "test-key".to_string(),
            content: "Test content".to_string(),
            metadata: KnowledgeMetadata {
                language: "rust".to_string(),
                size_bytes: 12,
                compressed: false,
                indexed: false,
            },
            provenance: ProvenanceEvidence {
                repository: "test".to_string(),
                commit: "abc".to_string(),
                version: "1.0.0".to_string(),
                changes: vec![],
                timestamp: Utc::now(),
                license: "MIT".to_string(),
                source: super::super::SourceLocation {
                    url: "https://example.com".to_string(),
                    path: "/".to_string(),
                    line: None,
                },
            },
        };

        kb.store(entry.clone()).await.unwrap();

        let retrieved = kb.retrieve("test-key").await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().key, "test-key");
    }
}
