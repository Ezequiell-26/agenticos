#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! reference corpus and source admission boundary. Functionality is introduced only through verified vertical slices.

use agenticos_contracts::{
    ContractError, ResourceUsage, Sandbox, SandboxRequest, SandboxResponse, SandboxStatus,
};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-source-forge";

/// In-memory sandbox implementation for testing.
#[derive(Debug)]
pub struct InMemorySandbox {
    status: Arc<RwLock<SandboxStatus>>,
    execution_count: Arc<RwLock<u64>>,
}

impl InMemorySandbox {
    /// Create a new in-memory sandbox.
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(SandboxStatus::Ready)),
            execution_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Set sandbox status.
    pub async fn set_status(&self, status: SandboxStatus) -> Result<(), ContractError> {
        let mut current_status = self.status.write().await;
        *current_status = status;
        Ok(())
    }

    /// Get execution count.
    pub async fn get_execution_count(&self) -> u64 {
        *self.execution_count.read().await
    }
}

impl Default for InMemorySandbox {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl Sandbox for InMemorySandbox {
    async fn execute(&self, request: SandboxRequest) -> Result<SandboxResponse, ContractError> {
        // Check if sandbox is available
        let status = self.status.read().await;
        if !matches!(*status, SandboxStatus::Ready) {
            return Ok(SandboxResponse {
                request_id: request.request_id,
                success: false,
                output: String::new(),
                error: Some(format!("Sandbox not ready: {:?}", *status)),
                resource_usage: ResourceUsage {
                    cpu_time_ms: 0,
                    memory_used_bytes: 0,
                    execution_time_ms: 0,
                },
            });
        }

        // Simulate execution
        let start = std::time::Instant::now();
        let execution_time = start.elapsed().as_millis() as u64;

        // Increment execution count
        let mut count = self.execution_count.write().await;
        *count += 1;

        // Simulate output
        let output = format!(
            "Executed code: {} (truncated for display)",
            request.code.chars().take(50).collect::<String>()
        );

        Ok(SandboxResponse {
            request_id: request.request_id,
            success: true,
            output,
            error: None,
            resource_usage: ResourceUsage {
                cpu_time_ms: execution_time,
                memory_used_bytes: request.code.len() as u64,
                execution_time_ms: execution_time,
            },
        })
    }

    async fn is_available(&self) -> Result<bool, ContractError> {
        let status = self.status.read().await;
        Ok(matches!(*status, SandboxStatus::Ready))
    }

    async fn get_status(&self) -> Result<SandboxStatus, ContractError> {
        let status = self.status.read().await;
        Ok(status.clone())
    }
}

/// Resource quota manager for sandbox.
#[derive(Debug)]
pub struct ResourceQuotaManager {
    max_memory_bytes: u64,
    #[allow(dead_code)]
    max_execution_time_ms: u64,
    current_memory: Arc<RwLock<u64>>,
}

impl ResourceQuotaManager {
    /// Create a new resource quota manager.
    pub fn new(max_memory_bytes: u64, max_execution_time_ms: u64) -> Self {
        Self {
            max_memory_bytes,
            max_execution_time_ms,
            current_memory: Arc::new(RwLock::new(0)),
        }
    }

    /// Check if execution request fits within quotas.
    pub async fn check_quota(&self, memory_required: u64) -> Result<bool, ContractError> {
        let current = self.current_memory.read().await;
        Ok(*current + memory_required <= self.max_memory_bytes)
    }

    /// Allocate memory for execution.
    pub async fn allocate_memory(&self, bytes: u64) -> Result<(), ContractError> {
        let mut current = self.current_memory.write().await;
        if *current + bytes <= self.max_memory_bytes {
            *current += bytes;
            Ok(())
        } else {
            Err(ContractError::MissingCapability)
        }
    }

    /// Release memory after execution.
    pub async fn release_memory(&self, bytes: u64) -> Result<(), ContractError> {
        let mut current = self.current_memory.write().await;
        *current = current.saturating_sub(bytes);
        Ok(())
    }
}

impl Default for ResourceQuotaManager {
    fn default() -> Self {
        Self::new(1024 * 1024 * 100, 30000) // 100MB, 30s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Runtime::new().unwrap()
    }

    #[test]
    fn test_in_memory_sandbox() {
        let rt = test_runtime();
        rt.block_on(async {
            let sandbox = InMemorySandbox::new();

            let request = SandboxRequest {
                request_id: "req-1".to_string(),
                code: "print('Hello, world!')".to_string(),
                timeout_ms: 5000,
                memory_limit_bytes: 1024 * 1024,
                allowed_capabilities: vec!["execute".to_string()],
            };

            let response = sandbox.execute(request).await.unwrap();

            assert!(response.success);
            assert!(!response.output.is_empty());
            assert_eq!(response.request_id, "req-1");
        });
    }

    #[test]
    fn test_sandbox_status() {
        let rt = test_runtime();
        rt.block_on(async {
            let sandbox = InMemorySandbox::new();

            let is_available = sandbox.is_available().await.unwrap();
            assert!(is_available);

            let status = sandbox.get_status().await.unwrap();
            assert!(matches!(status, SandboxStatus::Ready));

            sandbox.set_status(SandboxStatus::Busy).await.unwrap();

            let is_available = sandbox.is_available().await.unwrap();
            assert!(!is_available);
        });
    }

    #[test]
    fn test_resource_quota_manager() {
        let rt = test_runtime();
        rt.block_on(async {
            let manager = ResourceQuotaManager::new(1024, 100);

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);

            manager.allocate_memory(512).await.unwrap();

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);

            manager.release_memory(512).await.unwrap();

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);
        });
    }
}
