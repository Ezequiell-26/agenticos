#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! durable memory and retrieval boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContextManager, ContextWindow, ContractError, MemoryEntry, MemoryStore, Message, RunId,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-memory";

/// In-memory context manager.
#[derive(Debug)]
pub struct InMemoryContextManager {
    messages: Arc<RwLock<HashMap<String, Vec<Message>>>>,
    context_windows: Arc<RwLock<HashMap<String, ContextWindow>>>,
}

impl InMemoryContextManager {
    /// Create a new in-memory context manager.
    pub fn new() -> Self {
        Self {
            messages: Arc::new(RwLock::new(HashMap::new())),
            context_windows: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set context window for a run.
    pub async fn set_context_window(
        &self,
        run_id: RunId,
        window: ContextWindow,
    ) -> Result<(), ContractError> {
        let mut context_windows = self.context_windows.write().await;
        context_windows.insert(run_id.as_str().to_string(), window);
        Ok(())
    }
}

impl Default for InMemoryContextManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl ContextManager for InMemoryContextManager {
    async fn add_message(&self, message: Message) -> Result<(), ContractError> {
        let mut messages = self.messages.write().await;
        let run_id = message.run_id.as_str().to_string();
        messages
            .entry(run_id.clone())
            .or_insert_with(Vec::new)
            .push(message);

        // Update token count
        let mut context_windows = self.context_windows.write().await;
        if let Some(window) = context_windows.get_mut(&run_id) {
            if let Some(msgs) = messages.get(&run_id) {
                window.current_tokens = msgs.iter().map(|m| m.token_count).sum();
            }
        }

        Ok(())
    }

    async fn get_context(&self, run_id: RunId) -> Result<Vec<Message>, ContractError> {
        let messages = self.messages.read().await;
        Ok(messages.get(run_id.as_str()).cloned().unwrap_or_default())
    }

    async fn trim_context(&self, run_id: RunId, max_tokens: u32) -> Result<(), ContractError> {
        let mut messages = self.messages.write().await;
        let run_id_str = run_id.as_str().to_string();

        if let Some(msgs) = messages.get_mut(&run_id_str) {
            let mut current_tokens: u32 = msgs.iter().map(|m| m.token_count).sum();

            while current_tokens > max_tokens && !msgs.is_empty() {
                let removed = msgs.remove(0);
                current_tokens -= removed.token_count;
            }

            // Update context window
            let mut context_windows = self.context_windows.write().await;
            if let Some(window) = context_windows.get_mut(&run_id_str) {
                window.current_tokens = current_tokens;
            }
        }

        Ok(())
    }

    async fn get_token_count(&self, run_id: RunId) -> Result<u32, ContractError> {
        let messages = self.messages.read().await;
        if let Some(msgs) = messages.get(run_id.as_str()) {
            Ok(msgs.iter().map(|m| m.token_count).sum())
        } else {
            Ok(0)
        }
    }
}

/// In-memory memory store.
#[derive(Debug)]
pub struct InMemoryMemoryStore {
    memories: Arc<RwLock<HashMap<String, MemoryEntry>>>,
}

impl InMemoryMemoryStore {
    /// Create a new in-memory memory store.
    pub fn new() -> Self {
        Self {
            memories: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryMemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl MemoryStore for InMemoryMemoryStore {
    async fn store(&self, entry: MemoryEntry) -> Result<(), ContractError> {
        let mut memories = self.memories.write().await;
        memories.insert(entry.memory_id.clone(), entry);
        Ok(())
    }

    async fn retrieve(&self, memory_id: &str) -> Result<Option<MemoryEntry>, ContractError> {
        let memories = self.memories.read().await;
        Ok(memories.get(memory_id).cloned())
    }

    async fn retrieve_by_run(&self, run_id: RunId) -> Result<Vec<MemoryEntry>, ContractError> {
        let memories = self.memories.read().await;
        Ok(memories
            .values()
            .filter(|m| m.run_id.as_str() == run_id.as_str())
            .cloned()
            .collect())
    }

    async fn delete(&self, memory_id: &str) -> Result<(), ContractError> {
        let mut memories = self.memories.write().await;
        memories.remove(memory_id);
        Ok(())
    }

    async fn delete_expired(&self, now: u64) -> Result<usize, ContractError> {
        let mut memories = self.memories.write().await;
        let before = memories.len();
        memories.retain(|_, m| m.expires_at == 0 || m.expires_at > now);
        Ok(before - memories.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_context_manager() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = InMemoryContextManager::new();

            let run_id = RunId::new("test-run").unwrap();

            let message = Message {
                message_id: "msg-1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: 12345,
                token_count: 5,
                run_id: run_id.clone(),
            };

            manager.add_message(message.clone()).await.unwrap();

            let context = manager.get_context(run_id.clone()).await.unwrap();
            assert_eq!(context.len(), 1);

            let token_count = manager.get_token_count(run_id.clone()).await.unwrap();
            assert_eq!(token_count, 5);
        });
    }

    #[test]
    fn test_context_trim() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = InMemoryContextManager::new();

            let run_id = RunId::new("test-run").unwrap();

            let message1 = Message {
                message_id: "msg-1".to_string(),
                role: "user".to_string(),
                content: "Hello".to_string(),
                timestamp: 12345,
                token_count: 5,
                run_id: run_id.clone(),
            };

            let message2 = Message {
                message_id: "msg-2".to_string(),
                role: "assistant".to_string(),
                content: "World".to_string(),
                timestamp: 12346,
                token_count: 5,
                run_id: run_id.clone(),
            };

            manager.add_message(message1).await.unwrap();
            manager.add_message(message2).await.unwrap();

            manager.trim_context(run_id.clone(), 5).await.unwrap();

            let context = manager.get_context(run_id.clone()).await.unwrap();
            assert_eq!(context.len(), 1);
        });
    }

    #[test]
    fn test_memory_store() {
        let rt = test_runtime();
        rt.block_on(async {
            let store = InMemoryMemoryStore::new();

            let run_id = RunId::new("test-run").unwrap();

            let entry = MemoryEntry {
                memory_id: "mem-1".to_string(),
                run_id: run_id.clone(),
                key: "test_key".to_string(),
                value: "test_value".to_string(),
                timestamp: 12345,
                expires_at: 0,
            };

            store.store(entry.clone()).await.unwrap();

            let retrieved = store.retrieve("mem-1").await.unwrap();
            assert!(retrieved.is_some());

            let by_run = store.retrieve_by_run(run_id.clone()).await.unwrap();
            assert_eq!(by_run.len(), 1);
        });
    }

    #[test]
    fn test_memory_expiration() {
        let rt = test_runtime();
        rt.block_on(async {
            let store = InMemoryMemoryStore::new();

            let run_id = RunId::new("test-run").unwrap();

            let entry = MemoryEntry {
                memory_id: "mem-1".to_string(),
                run_id: run_id.clone(),
                key: "test_key".to_string(),
                value: "test_value".to_string(),
                timestamp: 12345,
                expires_at: 100,
            };

            store.store(entry).await.unwrap();

            let deleted = store.delete_expired(200).await.unwrap();
            assert_eq!(deleted, 1);

            let retrieved = store.retrieve("mem-1").await.unwrap();
            assert!(retrieved.is_none());
        });
    }
}
