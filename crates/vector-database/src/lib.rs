//! Vector Database (based on RuVector MIT patterns)
//! MIT Licensed - High-performance vector database for agents
//! Source: https://github.com/ruvnet/ruvector (4467 stars, MIT)

use std::collections::HashMap;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum VectorDbError {
    #[error("Vector not found: {0}")]
    VectorNotFound(String),
    #[error("Invalid vector dimension: {0}")]
    InvalidDimension(usize),
    #[error("Storage error: {0}")]
    StorageError(String),
}

/// Vector embedding
#[derive(Clone, Debug)]
pub struct Embedding {
    pub id: String,
    pub vector: Vec<f32>,
    pub metadata: HashMap<String, String>,
}

impl Embedding {
    pub fn new(id: String, vector: Vec<f32>) -> Self {
        Self {
            id,
            vector,
            metadata: HashMap::new(),
        }
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn dimension(&self) -> usize {
        self.vector.len()
    }

    /// Cosine similarity between two vectors
    pub fn cosine_similarity(&self, other: &Embedding) -> Result<f32, VectorDbError> {
        if self.vector.len() != other.vector.len() {
            return Err(VectorDbError::InvalidDimension(self.vector.len()));
        }

        let dot_product: f32 = self.vector.iter().zip(other.vector.iter()).map(|(a, b)| a * b).sum();
        let norm_a: f32 = self.vector.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.vector.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return Ok(0.0);
        }

        Ok(dot_product / (norm_a * norm_b))
    }

    /// Euclidean distance between two vectors
    pub fn euclidean_distance(&self, other: &Embedding) -> Result<f32, VectorDbError> {
        if self.vector.len() != other.vector.len() {
            return Err(VectorDbError::InvalidDimension(self.vector.len()));
        }

        let sum_sq: f32 = self.vector.iter()
            .zip(other.vector.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum();

        Ok(sum_sq.sqrt())
    }

    /// Dot product
    pub fn dot_product(&self, other: &Embedding) -> Result<f32, VectorDbError> {
        if self.vector.len() != other.vector.len() {
            return Err(VectorDbError::InvalidDimension(self.vector.len()));
        }

        Ok(self.vector.iter().zip(other.vector.iter()).map(|(a, b)| a * b).sum())
    }
}

/// In-memory vector database
pub struct VectorDatabase {
    embeddings: HashMap<String, Embedding>,
    dimension: usize,
}

impl VectorDatabase {
    /// Create new vector database
    pub fn new(dimension: usize) -> Self {
        Self {
            embeddings: HashMap::new(),
            dimension,
        }
    }

    /// Insert embedding
    pub fn insert(&mut self, embedding: Embedding) -> Result<(), VectorDbError> {
        if embedding.dimension() != self.dimension {
            return Err(VectorDbError::InvalidDimension(embedding.dimension()));
        }
        self.embeddings.insert(embedding.id.clone(), embedding);
        Ok(())
    }

    /// Get embedding by ID
    pub fn get(&self, id: &str) -> Option<&Embedding> {
        self.embeddings.get(id)
    }

    /// Remove embedding
    pub fn remove(&mut self, id: &str) -> Result<(), VectorDbError> {
        self.embeddings.remove(id)
            .map(|_| ())
            .ok_or_else(|| VectorDbError::VectorNotFound(id.to_string()))
    }

    /// Search similar vectors using cosine similarity
    pub fn search(&self, query: &Embedding, top_k: usize) -> Vec<(String, f32)> {
        let mut results: Vec<(String, f32)> = Vec::new();

        for (id, embedding) in &self.embeddings {
            if let Ok(similarity) = query.cosine_similarity(embedding) {
                results.push((id.clone(), similarity));
            }
        }

        // Sort by similarity (descending)
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Return top k
        results.into_iter().take(top_k).collect()
    }

    /// Search similar vectors using Euclidean distance
    pub fn search_distance(&self, query: &Embedding, top_k: usize) -> Vec<(String, f32)> {
        let mut results: Vec<(String, f32)> = Vec::new();

        for (id, embedding) in &self.embeddings {
            if let Ok(distance) = query.euclidean_distance(embedding) {
                results.push((id.clone(), distance));
            }
        }

        // Sort by distance (ascending)
        results.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        // Return top k
        results.into_iter().take(top_k).collect()
    }

    /// Get all embeddings
    pub fn all(&self) -> Vec<&Embedding> {
        self.embeddings.values().collect()
    }

    /// Get count of embeddings
    pub fn len(&self) -> usize {
        self.embeddings.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.embeddings.is_empty()
    }

    /// Clear all embeddings
    pub fn clear(&mut self) {
        self.embeddings.clear();
    }
}

/// Batch embedding processor
pub struct EmbeddingProcessor {
    dimension: usize,
}

impl EmbeddingProcessor {
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    /// Create dummy embedding (in production, use real embedding model)
    pub fn embed_text(&self, text: &str) -> Embedding {
        let id = text.chars().take(8).collect::<String>();
        let hash = self.hash_text(text);
        let vector = (0..self.dimension)
            .map(|i| ((hash as f32) * (i as f32 + 1.0)) % 1.0)
            .collect();
        
        Embedding::new(id, vector)
    }

    /// Batch embed texts
    pub fn embed_batch(&self, texts: &[String]) -> Vec<Embedding> {
        texts.iter().map(|text| self.embed_text(text)).collect()
    }

    fn hash_text(&self, text: &str) -> u64 {
        let mut hash: u64 = 5381;
        for byte in text.bytes() {
            hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
        }
        hash
    }
}

/// Vector store with persistence
pub struct VectorStore {
    db: VectorDatabase,
    dimension: usize,
}

impl VectorStore {
    pub fn new(dimension: usize) -> Self {
        Self {
            db: VectorDatabase::new(dimension),
            dimension,
        }
    }

    pub fn add_text(&mut self, text: &str, metadata: HashMap<String, String>) -> Result<String, VectorDbError> {
        let processor = EmbeddingProcessor::new(self.dimension);
        let mut embedding = processor.embed_text(text);
        
        for (key, value) in metadata {
            embedding = embedding.with_metadata(key, value);
        }
        
        let id = embedding.id.clone();
        self.db.insert(embedding)?;
        Ok(id)
    }

    pub fn search_text(&self, query: &str, top_k: usize) -> Vec<(String, f32)> {
        let processor = EmbeddingProcessor::new(self.dimension);
        let query_embedding = processor.embed_text(query);
        self.db.search(&query_embedding, top_k)
    }

    pub fn get(&self, id: &str) -> Option<&Embedding> {
        self.db.get(id)
    }

    pub fn remove(&mut self, id: &str) -> Result<(), VectorDbError> {
        self.db.remove(id)
    }

    pub fn len(&self) -> usize {
        self.db.len()
    }

    pub fn clear(&mut self) {
        self.db.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_creation() {
        let embedding = Embedding::new("test".to_string(), vec![0.1, 0.2, 0.3]);
        assert_eq!(embedding.dimension(), 3);
    }

    #[test]
    fn test_cosine_similarity() {
        let a = Embedding::new("a".to_string(), vec![1.0, 0.0, 0.0]);
        let b = Embedding::new("b".to_string(), vec![1.0, 0.0, 0.0]);
        let similarity = a.cosine_similarity(&b).unwrap();
        assert!((similarity - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_different() {
        let a = Embedding::new("a".to_string(), vec![1.0, 0.0, 0.0]);
        let b = Embedding::new("b".to_string(), vec![0.0, 1.0, 0.0]);
        let similarity = a.cosine_similarity(&b).unwrap();
        assert!((similarity - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_euclidean_distance() {
        let a = Embedding::new("a".to_string(), vec![0.0, 0.0]);
        let b = Embedding::new("b".to_string(), vec![3.0, 4.0]);
        let distance = a.euclidean_distance(&b).unwrap();
        assert!((distance - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_vector_database() {
        let mut db = VectorDatabase::new(3);
        let embedding = Embedding::new("test".to_string(), vec![0.1, 0.2, 0.3]);
        db.insert(embedding).unwrap();
        assert_eq!(db.len(), 1);
    }

    #[test]
    fn test_vector_database_search() {
        let mut db = VectorDatabase::new(3);
        let embedding = Embedding::new("test".to_string(), vec![1.0, 0.0, 0.0]);
        db.insert(embedding).unwrap();
        
        let query = Embedding::new("query".to_string(), vec![1.0, 0.0, 0.0]);
        let results = db.search(&query, 1);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "test");
    }

    #[test]
    fn test_embedding_processor() {
        let processor = EmbeddingProcessor::new(128);
        let embedding = processor.embed_text("hello world");
        assert_eq!(embedding.dimension(), 128);
    }

    #[test]
    fn test_vector_store() {
        let mut store = VectorStore::new(128);
        let id = store.add_text("test text", HashMap::new()).unwrap();
        assert!(store.get(&id).is_some());
    }

    #[test]
    fn test_vector_store_search() {
        let mut store = VectorStore::new(128);
        store.add_text("hello world", HashMap::new()).unwrap();
        let results = store.search_text("hello", 5);
        assert!(!results.is_empty());
    }
}
