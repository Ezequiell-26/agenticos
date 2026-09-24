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

/// GitHub repository metadata fetched from the live GitHub API.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitHubRepositoryInfo {
    /// Normalized owner/repository identifier.
    pub repo_id: String,
    /// Canonical repository URL.
    pub url: String,
    /// Default branch reported by GitHub.
    pub default_branch: String,
    /// SPDX license identifier when GitHub reports one.
    pub license: Option<String>,
    /// Primary language reported by GitHub.
    pub language: Option<String>,
    /// Public star count reported by GitHub.
    pub stars: u64,
}

/// A bounded source-file response.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceFile {
    /// Repository identifier.
    pub repo_id: String,
    /// Requested path.
    pub path: String,
    /// Resolved reference.
    pub reference: String,
    /// UTF-8 file content.
    pub content: String,
    /// Whether the remote response was truncated.
    pub truncated: bool,
}

/// Source inspection failures.
#[derive(Debug, thiserror::Error)]
pub enum SourceForgeError {
    /// The GitHub source string is malformed.
    #[error("invalid GitHub repository source: {0}")]
    InvalidSource(String),
    /// The outbound HTTP request failed.
    #[error("GitHub request failed: {0}")]
    Request(String),
    /// GitHub returned an unsuccessful status.
    #[error("GitHub API returned HTTP {status}: {message}")]
    Api {
        /// HTTP status.
        status: u16,
        /// Short API message.
        message: String,
    },
    /// The response payload could not be decoded.
    #[error("GitHub response decode failed: {0}")]
    Decode(String),
    /// The requested source file exceeded the configured bound.
    #[error("source file exceeds the configured size limit")]
    TooLarge,
}

/// Bounded GitHub source inspector.
#[derive(Clone, Debug)]
pub struct GitHubSourceClient {
    client: reqwest::Client,
    api_base: String,
    token: Option<String>,
    max_file_bytes: usize,
}

impl GitHubSourceClient {
    /// Create a client from environment configuration.
    pub fn from_env() -> Result<Self, SourceForgeError> {
        let user_agent = format!("AgentiCOS/{}", env!("CARGO_PKG_VERSION"));
        let client = reqwest::Client::builder()
            .user_agent(user_agent)
            .build()
            .map_err(|error| SourceForgeError::Request(error.to_string()))?;

        let api_base = std::env::var("AGENTICOS_GITHUB_API_URL")
            .unwrap_or_else(|_| "https://api.github.com".to_string())
            .trim_end_matches('/')
            .to_string();
        let max_file_bytes = std::env::var("AGENTICOS_SOURCE_MAX_FILE_BYTES")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(2 * 1024 * 1024)
            .clamp(1, 16 * 1024 * 1024);

        Ok(Self {
            client,
            api_base,
            token: std::env::var("GITHUB_TOKEN")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            max_file_bytes,
        })
    }

    /// Inspect a public GitHub repository.
    pub async fn inspect_repository(
        &self,
        source: &str,
    ) -> Result<GitHubRepositoryInfo, SourceForgeError> {
        let repo_id = normalize_github_repo(source)?;
        let response = self
            .request(format!("/repos/{repo_id}"))
            .send()
            .await
            .map_err(|error| SourceForgeError::Request(error.to_string()))?;
        let response = self.ensure_success(response).await?;
        #[derive(Deserialize)]
        struct License {
            spdx_id: Option<String>,
        }
        #[derive(Deserialize)]
        struct RepoPayload {
            full_name: String,
            html_url: String,
            default_branch: String,
            language: Option<String>,
            stargazers_count: u64,
            license: Option<License>,
        }
        let payload = response
            .json::<RepoPayload>()
            .await
            .map_err(|error| SourceForgeError::Decode(error.to_string()))?;

        Ok(GitHubRepositoryInfo {
            repo_id: payload.full_name,
            url: payload.html_url,
            default_branch: payload.default_branch,
            license: payload.license.and_then(|license| license.spdx_id),
            language: payload.language,
            stars: payload.stargazers_count,
        })
    }

    /// Fetch a UTF-8 file from a repository at an optional ref.
    pub async fn fetch_file(
        &self,
        repo: &str,
        path: &str,
        reference: Option<&str>,
    ) -> Result<SourceFile, SourceForgeError> {
        let repo_id = normalize_github_repo(repo)?;
        let path = normalize_source_path(path)?;
        let mut request = self
            .request(format!("/repos/{repo_id}/contents/{path}"))
            .header("Accept", "application/vnd.github.raw");
        if let Some(reference) = reference.map(str::trim).filter(|value| !value.is_empty()) {
            if reference.len() > 256 || reference.contains(['\r', '\n']) {
                return Err(SourceForgeError::InvalidSource(
                    "invalid Git reference".to_string(),
                ));
            }
            request = request.query(&[("ref", reference)]);
        }

        let response = request
            .send()
            .await
            .map_err(|error| SourceForgeError::Request(error.to_string()))?;
        let response = self.ensure_success(response).await?;
        let bytes = response
            .bytes()
            .await
            .map_err(|error| SourceForgeError::Request(error.to_string()))?;
        if bytes.len() > self.max_file_bytes {
            return Err(SourceForgeError::TooLarge);
        }
        let content = String::from_utf8(bytes.to_vec())
            .map_err(|error| SourceForgeError::Decode(error.to_string()))?;

        Ok(SourceFile {
            repo_id,
            path,
            reference: reference.unwrap_or("default").to_string(),
            content,
            truncated: false,
        })
    }

    fn request(&self, path: String) -> reqwest::RequestBuilder {
        let mut request = self.client.get(format!("{}{}", self.api_base, path));
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        request
    }

    async fn ensure_success(
        &self,
        response: reqwest::Response,
    ) -> Result<reqwest::Response, SourceForgeError> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        let message = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown GitHub API error".to_string());
        let mut message = message;
        if message.len() > 1024 {
            message.truncate(1024);
        }
        Err(SourceForgeError::Api {
            status: status.as_u16(),
            message,
        })
    }
}

fn normalize_github_repo(source: &str) -> Result<String, SourceForgeError> {
    let value = source
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .trim_start_matches("https://github.com/")
        .trim_start_matches("http://github.com/")
        .trim_start_matches("github.com/")
        .trim();

    let parts = value.split('/').collect::<Vec<_>>();
    if parts.len() != 2
        || parts.iter().any(|part| {
            part.is_empty()
                || part.len() > 128
                || part.contains(['\\', '?', '#', ' ', '\r', '\n'])
        })
    {
        return Err(SourceForgeError::InvalidSource(source.trim().to_string()));
    }
    Ok(format!("{}/{}", parts[0], parts[1]))
}

#[cfg(test)]
mod github_source_tests {
    use super::*;

    #[test]
    fn github_repo_normalization_accepts_supported_forms() {
        assert_eq!(
            normalize_github_repo("https://github.com/openai/openai-python").unwrap(),
            "openai/openai-python"
        );
        assert_eq!(
            normalize_github_repo("github.com/rust-lang/cargo.git").unwrap(),
            "rust-lang/cargo"
        );
    }

    #[test]
    fn github_repo_normalization_rejects_unsafe_or_ambiguous_sources() {
        assert!(normalize_github_repo("https://example.com/a/b").is_err());
        assert!(normalize_github_repo("https://github.com/a/b/c").is_err());
        assert!(normalize_github_repo("github.com/a/../b").is_err());
    }

    #[test]
    fn source_path_rejects_traversal() {
        assert!(normalize_source_path("../README.md").is_err());
        assert!(normalize_source_path("/etc/passwd").is_err());
        assert!(normalize_source_path("src//lib.rs").is_err());
        assert_eq!(normalize_source_path("src/lib.rs").unwrap(), "src/lib.rs");
    }
}

fn normalize_source_path(path: &str) -> Result<String, SourceForgeError> {
    let path = path.trim();
    if path.is_empty()
        || path.len() > 2048
        || std::path::Path::new(path).is_absolute()
        || path
            .split('/')
            .any(|segment| segment == ".." || segment.is_empty())
    {
        return Err(SourceForgeError::InvalidSource(
            "invalid source file path".to_string(),
        ));
    }
    Ok(path.to_string())
}
