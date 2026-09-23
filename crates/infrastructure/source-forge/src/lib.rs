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

/// Security capability for sandbox operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecurityCapability {
    /// Allow code execution
    Execute,
    /// Allow file read
    FileRead,
    /// Allow file write
    FileWrite,
    /// Allow network access
    NetworkAccess,
    /// Allow environment variable access
    EnvAccess,
}

/// Security policy for sandbox configuration.
#[derive(Debug, Clone)]
pub struct SecurityPolicy {
    /// Allowed capabilities
    pub allowed_capabilities: Vec<SecurityCapability>,
    /// Network isolation mode
    pub network_isolated: bool,
    /// Max memory limit in bytes
    pub max_memory_bytes: u64,
    /// Max execution time in milliseconds
    pub max_execution_time_ms: u64,
    /// Max CPU time in milliseconds
    pub max_cpu_time_ms: u64,
}

impl SecurityPolicy {
    /// Create a new security policy with default restrictions.
    pub fn new() -> Self {
        Self {
            allowed_capabilities: vec![SecurityCapability::Execute],
            network_isolated: true,
            max_memory_bytes: 1024 * 1024 * 100, // 100MB
            max_execution_time_ms: 30000,        // 30s
            max_cpu_time_ms: 30000,              // 30s
        }
    }

    /// Check if a capability is allowed.
    pub fn has_capability(&self, capability: &SecurityCapability) -> bool {
        self.allowed_capabilities.contains(capability)
    }

    /// Add a capability to the policy.
    pub fn add_capability(&mut self, capability: SecurityCapability) {
        if !self.allowed_capabilities.contains(&capability) {
            self.allowed_capabilities.push(capability);
        }
    }
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        Self::new()
    }
}

/// In-memory sandbox implementation for testing.
#[derive(Debug)]
pub struct InMemorySandbox {
    status: Arc<RwLock<SandboxStatus>>,
    execution_count: Arc<RwLock<u64>>,
    security_policy: Arc<RwLock<SecurityPolicy>>,
}

impl InMemorySandbox {
    /// Create a new in-memory sandbox.
    pub fn new() -> Self {
        Self {
            status: Arc::new(RwLock::new(SandboxStatus::Ready)),
            execution_count: Arc::new(RwLock::new(0)),
            security_policy: Arc::new(RwLock::new(SecurityPolicy::new())),
        }
    }

    /// Create a new in-memory sandbox with custom security policy.
    pub fn with_security_policy(policy: SecurityPolicy) -> Self {
        Self {
            status: Arc::new(RwLock::new(SandboxStatus::Ready)),
            execution_count: Arc::new(RwLock::new(0)),
            security_policy: Arc::new(RwLock::new(policy)),
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

    /// Get security policy.
    pub async fn get_security_policy(&self) -> SecurityPolicy {
        self.security_policy.read().await.clone()
    }

    /// Update security policy.
    pub async fn update_security_policy(
        &self,
        policy: SecurityPolicy,
    ) -> Result<(), ContractError> {
        let mut current_policy = self.security_policy.write().await;
        *current_policy = policy;
        Ok(())
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
    max_execution_time_ms: u64,
    max_cpu_time_ms: u64,
    current_memory: Arc<RwLock<u64>>,
    total_cpu_time_ms: Arc<RwLock<u64>>,
}

impl ResourceQuotaManager {
    /// Create a new resource quota manager.
    pub fn new(max_memory_bytes: u64, max_execution_time_ms: u64, max_cpu_time_ms: u64) -> Self {
        Self {
            max_memory_bytes,
            max_execution_time_ms,
            max_cpu_time_ms,
            current_memory: Arc::new(RwLock::new(0)),
            total_cpu_time_ms: Arc::new(RwLock::new(0)),
        }
    }

    /// Check if execution request fits within quotas.
    pub async fn check_quota(&self, memory_required: u64) -> Result<bool, ContractError> {
        let current = self.current_memory.read().await;
        Ok(*current + memory_required <= self.max_memory_bytes)
    }

    /// Check if execution time quota is exceeded.
    pub async fn check_execution_time_quota(
        &self,
        execution_time_ms: u64,
    ) -> Result<bool, ContractError> {
        Ok(execution_time_ms <= self.max_execution_time_ms)
    }

    /// Check if CPU time quota is exceeded.
    pub async fn check_cpu_quota(&self, cpu_time_ms: u64) -> Result<bool, ContractError> {
        let current = self.total_cpu_time_ms.read().await;
        Ok(*current + cpu_time_ms <= self.max_cpu_time_ms)
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

    /// Record CPU time usage.
    pub async fn record_cpu_time(&self, cpu_time_ms: u64) -> Result<(), ContractError> {
        let mut total = self.total_cpu_time_ms.write().await;
        *total += cpu_time_ms;
        Ok(())
    }

    /// Get current memory usage.
    pub async fn get_memory_usage(&self) -> u64 {
        *self.current_memory.read().await
    }

    /// Get total CPU time used.
    pub async fn get_total_cpu_time(&self) -> u64 {
        *self.total_cpu_time_ms.read().await
    }
}

impl Default for ResourceQuotaManager {
    fn default() -> Self {
        Self::new(1024 * 1024 * 100, 30000, 30000) // 100MB, 30s
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
            let manager = ResourceQuotaManager::new(1024, 100, 100);

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);

            manager.allocate_memory(512).await.unwrap();

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);

            manager.release_memory(512).await.unwrap();

            let fits = manager.check_quota(512).await.unwrap();
            assert!(fits);

            let fits = manager.check_execution_time_quota(50).await.unwrap();
            assert!(fits);

            let fits = manager.check_cpu_quota(50).await.unwrap();
            assert!(fits);
        });
    }

    #[test]
    fn test_security_policy() {
        let policy = SecurityPolicy::new();

        assert!(policy.has_capability(&SecurityCapability::Execute));
        assert!(!policy.has_capability(&SecurityCapability::NetworkAccess));
        assert!(policy.network_isolated);
    }

    #[test]
    fn test_security_policy_add_capability() {
        let mut policy = SecurityPolicy::new();

        policy.add_capability(SecurityCapability::NetworkAccess);

        assert!(policy.has_capability(&SecurityCapability::NetworkAccess));
    }

    #[test]
    fn test_sandbox_with_security_policy() {
        let rt = test_runtime();
        rt.block_on(async {
            let policy = SecurityPolicy::new();
            let sandbox = InMemorySandbox::with_security_policy(policy);

            let current_policy = sandbox.get_security_policy().await;
            assert!(current_policy.network_isolated);
        });
    }
}
