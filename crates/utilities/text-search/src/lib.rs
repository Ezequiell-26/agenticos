//! Text Search (based on Tantivy/Meilisearch MIT patterns)
//! MIT Licensed - Full-text search and indexing
//! Source: Meilisearch (59169 stars, MIT), Tantivy patterns

use std::collections::{HashMap, HashSet};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SearchError {
    #[error("Document not found: {0}")]
    DocumentNotFound(String),
    #[error("Index error: {0}")]
    IndexError(String),
    #[error("Query error: {0}")]
    QueryError(String),
}

/// Document for indexing
#[derive(Clone, Debug)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub fields: HashMap<String, String>,
}

impl Document {
    pub fn new(id: String, title: String, content: String) -> Self {
        Self {
            id,
            title,
            content,
            fields: HashMap::new(),
        }
    }

    pub fn with_field(mut self, key: String, value: String) -> Self {
        self.fields.insert(key, value);
        self
    }

    pub fn get_field(&self, key: &str) -> Option<&String> {
        self.fields.get(key)
    }

    pub fn all_text(&self) -> String {
        let mut text = self.title.clone();
        text.push_str(" ");
        text.push_str(&self.content);
        for (_, value) in &self.fields {
            text.push_str(" ");
            text.push_str(value);
        }
        text
    }
}

/// Search result
#[derive(Clone, Debug)]
pub struct SearchResult {
    pub document: Document,
    pub score: f32,
}

/// Inverted index term
#[derive(Clone, Debug)]
struct IndexTerm {
    pub doc_ids: HashSet<String>,
    pub positions: Vec<(String, usize)>, // (doc_id, position)
}

/// Inverted index
pub struct InvertedIndex {
    terms: HashMap<String, IndexTerm>,
    documents: HashMap<String, Document>,
}

impl InvertedIndex {
    pub fn new() -> Self {
        Self {
            terms: HashMap::new(),
            documents: HashMap::new(),
        }
    }

    /// Add document to index
    pub fn add_document(&mut self, document: Document) -> Result<(), SearchError> {
        let id = document.id.clone();
        let text = document.all_text();

        // Tokenize and index
        let tokens = self.tokenize(&text);
        for (position, token) in tokens.into_iter().enumerate() {
            let term = self
                .terms
                .entry(token.clone())
                .or_insert_with(|| IndexTerm {
                    doc_ids: HashSet::new(),
                    positions: Vec::new(),
                });
            term.doc_ids.insert(id.clone());
            term.positions.push((id.clone(), position));
        }

        self.documents.insert(id, document);
        Ok(())
    }

    /// Remove document from index
    pub fn remove_document(&mut self, id: &str) -> Result<(), SearchError> {
        if let Some(doc) = self.documents.remove(id) {
            let text = doc.all_text();
            let tokens = self.tokenize(&text);
            for token in tokens {
                if let Some(term) = self.terms.get_mut(&token) {
                    term.doc_ids.remove(id);
                    term.positions.retain(|(doc_id, _)| doc_id != id);
                }
            }
        }
        Ok(())
    }

    /// Search documents
    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        let query_tokens = self.tokenize(query);
        if query_tokens.is_empty() {
            return Vec::new();
        }

        let mut doc_scores: HashMap<String, f32> = HashMap::new();

        for token in &query_tokens {
            if let Some(term) = self.terms.get(token) {
                for doc_id in &term.doc_ids {
                    *doc_scores.entry(doc_id.clone()).or_insert(0.0) += 1.0;
                }
            }
        }

        // Sort by score
        let mut results: Vec<(String, f32)> = doc_scores.into_iter().collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Build search results
        results
            .into_iter()
            .take(limit)
            .filter_map(|(id, score)| {
                self.documents.get(&id).map(|doc| SearchResult {
                    document: doc.clone(),
                    score,
                })
            })
            .collect()
    }

    /// Get document by ID
    pub fn get_document(&self, id: &str) -> Option<&Document> {
        self.documents.get(id)
    }

    /// Get all documents
    pub fn get_all_documents(&self) -> Vec<&Document> {
        self.documents.values().collect()
    }

    /// Get document count
    pub fn len(&self) -> usize {
        self.documents.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.documents.is_empty()
    }

    /// Clear index
    pub fn clear(&mut self) {
        self.terms.clear();
        self.documents.clear();
    }

    /// Tokenize text into terms
    fn tokenize(&self, text: &str) -> Vec<String> {
        text.to_lowercase()
            .split(|c: char| !c.is_alphanumeric() && !c.is_whitespace())
            .filter(|s| !s.is_empty() && s.len() > 2)
            .map(|s| s.to_string())
            .collect()
    }
}

impl Default for InvertedIndex {
    fn default() -> Self {
        Self::new()
    }
}

/// Search query
#[derive(Clone, Debug)]
pub struct SearchQuery {
    pub query: String,
    pub limit: usize,
    pub offset: usize,
    pub filters: Vec<String>,
}

impl SearchQuery {
    pub fn new(query: String) -> Self {
        Self {
            query,
            limit: 10,
            offset: 0,
            filters: Vec::new(),
        }
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = limit;
        self
    }

    pub fn with_offset(mut self, offset: usize) -> Self {
        self.offset = offset;
        self
    }

    pub fn with_filter(mut self, filter: String) -> Self {
        self.filters.push(filter);
        self
    }
}

/// Search engine
pub struct SearchEngine {
    index: InvertedIndex,
}

impl SearchEngine {
    pub fn new() -> Self {
        Self {
            index: InvertedIndex::new(),
        }
    }

    /// Index document
    pub fn index(&mut self, document: Document) -> Result<(), SearchError> {
        self.index.add_document(document)
    }

    /// Search with query
    pub fn search(&self, query: &SearchQuery) -> Vec<SearchResult> {
        let mut results = self.index.search(&query.query, query.limit + query.offset);

        // Apply offset
        if query.offset > 0 && query.offset < results.len() {
            results = results.into_iter().skip(query.offset).collect();
        }

        // Apply filters (simplified)
        if !query.filters.is_empty() {
            results = results
                .into_iter()
                .filter(|result| {
                    query.filters.iter().all(|filter| {
                        let text = result.document.all_text().to_lowercase();
                        text.contains(&filter.to_lowercase())
                    })
                })
                .collect();
        }

        results
    }

    /// Get document
    pub fn get(&self, id: &str) -> Option<&Document> {
        self.index.get_document(id)
    }

    /// Remove document
    pub fn remove(&mut self, id: &str) -> Result<(), SearchError> {
        self.index.remove_document(id)
    }

    /// Get document count
    pub fn len(&self) -> usize {
        self.index.len()
    }

    /// Clear index
    pub fn clear(&mut self) {
        self.index.clear();
    }
}

impl Default for SearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Simple text matcher for fuzzy search
pub struct TextMatcher;

impl TextMatcher {
    /// Calculate Levenshtein distance
    pub fn levenshtein_distance(a: &str, b: &str) -> usize {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let m = a_chars.len();
        let n = b_chars.len();

        if m == 0 {
            return n;
        }
        if n == 0 {
            return m;
        }

        let mut dp = vec![vec![0; n + 1]; m + 1];

        for i in 0..=m {
            dp[i][0] = i;
        }
        for j in 0..=n {
            dp[0][j] = j;
        }

        for i in 1..=m {
            for j in 1..=n {
                let cost = if a_chars[i - 1] == b_chars[j - 1] {
                    0
                } else {
                    1
                };
                dp[i][j] = [
                    dp[i - 1][j] + 1,        // deletion
                    dp[i][j - 1] + 1,        // insertion
                    dp[i - 1][j - 1] + cost, // substitution
                ]
                .iter()
                .min()
                .copied()
                .unwrap();
            }
        }

        dp[m][n]
    }

    /// Fuzzy match with threshold
    pub fn fuzzy_match(pattern: &str, text: &str, threshold: f32) -> bool {
        let distance = Self::levenshtein_distance(pattern, text);
        let max_len = pattern.len().max(text.len());
        if max_len == 0 {
            return true;
        }
        let similarity = 1.0 - (distance as f32 / max_len as f32);
        similarity >= threshold
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_creation() {
        let doc = Document::new("1".to_string(), "Title".to_string(), "Content".to_string());
        assert_eq!(doc.id, "1");
        assert_eq!(doc.title, "Title");
    }

    #[test]
    fn test_document_with_field() {
        let doc = Document::new("1".to_string(), "Title".to_string(), "Content".to_string())
            .with_field("author".to_string(), "John".to_string());
        assert_eq!(doc.get_field("author"), Some(&"John".to_string()));
    }

    #[test]
    fn test_inverted_index() {
        let mut index = InvertedIndex::new();
        let doc = Document::new(
            "1".to_string(),
            "Rust".to_string(),
            "Programming language".to_string(),
        );
        index.add_document(doc).unwrap();
        assert_eq!(index.len(), 1);
    }

    #[test]
    fn test_inverted_index_search() {
        let mut index = InvertedIndex::new();
        let doc = Document::new(
            "1".to_string(),
            "Rust".to_string(),
            "Programming language".to_string(),
        );
        index.add_document(doc).unwrap();

        let results = index.search("rust", 10);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].document.id, "1");
    }

    #[test]
    fn test_search_engine() {
        let mut engine = SearchEngine::new();
        let doc = Document::new(
            "1".to_string(),
            "Rust".to_string(),
            "Programming language".to_string(),
        );
        engine.index(doc).unwrap();

        let query = SearchQuery::new("rust".to_string());
        let results = engine.search(&query);
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_query() {
        let query = SearchQuery::new("rust".to_string())
            .with_limit(5)
            .with_offset(0);
        assert_eq!(query.limit, 5);
        assert_eq!(query.offset, 0);
    }

    #[test]
    fn test_levenshtein_distance() {
        let distance = TextMatcher::levenshtein_distance("rust", "rust");
        assert_eq!(distance, 0);

        let distance = TextMatcher::levenshtein_distance("rust", "rusty");
        assert_eq!(distance, 1);
    }

    #[test]
    fn test_fuzzy_match() {
        assert!(TextMatcher::fuzzy_match("rust", "rust", 0.9));
        assert!(TextMatcher::fuzzy_match("rust", "rusty", 0.8));
        assert!(!TextMatcher::fuzzy_match("rust", "python", 0.5));
    }
}
