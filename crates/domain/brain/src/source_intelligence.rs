//! Source Intelligence Engine - Discovery, import, analysis of external repositories

use super::{
    BrainError, Capability, CapabilityOrigin, CapabilityStatus, CommitHash, License,
    ProvenanceEvidence, RepoId,
};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Source Intelligence Engine
#[derive(Debug)]
pub struct SourceIntelligenceEngine {
    discovery: Arc<RwLock<DiscoveryPipeline>>,
    config: EngineConfig,
    /// Registry for discovered capabilities
    registry: Arc<RwLock<HashMap<RepoId, RepositoryMetadata>>>,
}

/// Engine configuration
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct EngineConfig {
    #[allow(missing_docs)]
    pub enable_git_discovery: bool,
    #[allow(missing_docs)]
    pub enable_api_discovery: bool,
    #[allow(missing_docs)]
    pub max_repositories: usize,
    #[allow(missing_docs)]
    pub allowed_licenses: Vec<License>,
    #[allow(missing_docs)]
    pub denied_licenses: Vec<License>,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            enable_git_discovery: true,
            enable_api_discovery: true,
            max_repositories: 1000,
            allowed_licenses: vec![
                "MIT".to_string(),
                "Apache-2.0".to_string(),
                "BSD-3-Clause".to_string(),
                "BSD-2-Clause".to_string(),
                "ISC".to_string(),
                "0BSD".to_string(),
                "Unlicense".to_string(),
            ],
            denied_licenses: vec!["GPL-3.0".to_string(), "AGPL-3.0".to_string()],
        }
    }
}

/// Discovery pipeline
#[derive(Debug)]
pub struct DiscoveryPipeline {
    git_discoverer: Option<GitDiscoverer>,
    api_discoverer: Option<ApiDiscoverer>,
}

/// Git repository discoverer
#[derive(Debug)]
pub struct GitDiscoverer {
    #[allow(dead_code)]
    max_repos: usize,
}

/// API discoverer (GitHub, GitLab, etc.)
#[derive(Debug)]
pub struct ApiDiscoverer {
    #[allow(dead_code)]
    max_repos: usize,
}

/// Repository metadata
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct RepositoryMetadata {
    #[allow(missing_docs)]
    pub repo_id: RepoId,
    #[allow(missing_docs)]
    pub url: String,
    #[allow(missing_docs)]
    pub default_branch: String,
    #[allow(missing_docs)]
    pub last_indexed: DateTime<Utc>,
    #[allow(missing_docs)]
    pub license: Option<License>,
    #[allow(missing_docs)]
    pub language: Option<String>,
    #[allow(missing_docs)]
    pub stars: u64,
    #[allow(missing_docs)]
    pub status: RepositoryStatus,
}

/// Repository status
#[derive(Debug, Clone, PartialEq, Eq)]
#[allow(missing_docs)]
pub enum RepositoryStatus {
    #[allow(missing_docs)]
    Discovered,
    #[allow(missing_docs)]
    Indexing,
    #[allow(missing_docs)]
    Indexed,
    #[allow(missing_docs)]
    Failed,
}

impl SourceIntelligenceEngine {
    /// Create a new source intelligence engine
    pub fn new(config: EngineConfig) -> Self {
        let discovery = DiscoveryPipeline {
            git_discoverer: if config.enable_git_discovery {
                Some(GitDiscoverer {
                    max_repos: config.max_repositories,
                })
            } else {
                None
            },
            api_discoverer: if config.enable_api_discovery {
                Some(ApiDiscoverer {
                    max_repos: config.max_repositories,
                })
            } else {
                None
            },
        };

        Self {
            discovery: Arc::new(RwLock::new(discovery)),
            config,
            registry: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Discover repositories from a source (GitHub, GitLab, local git, etc.)
    pub async fn discover(&self, source: &str) -> Result<Vec<RepoId>, BrainError> {
        let discovery = self.discovery.read().await;

        if source.starts_with("github.com") || source.starts_with("https://github.com") {
            if let Some(api_discoverer) = &discovery.api_discoverer {
                return self.discover_github(source, api_discoverer).await;
            }
        }

        if source.starts_with("git@") || source.ends_with(".git") {
            if let Some(git_discoverer) = &discovery.git_discoverer {
                return self.discover_git(source, git_discoverer).await;
            }
        }

        Err(BrainError::SourceIntelligenceError(format!(
            "Unsupported source: {}",
            source
        )))
    }

    /// Import a repository with provenance tracking
    pub async fn import(
        &self,
        repo_id: RepoId,
        commit: CommitHash,
    ) -> Result<ProvenanceEvidence, BrainError> {
        let metadata = {
            let registry = self.registry.read().await;
            registry
                .get(&repo_id)
                .ok_or_else(|| {
                    BrainError::SourceIntelligenceError(format!(
                        "Repository {} not discovered",
                        repo_id
                    ))
                })?
                .clone()
        };

        // Validate license
        if let Some(license) = &metadata.license {
            if self.config.denied_licenses.contains(license) {
                return Err(BrainError::PermissionDenied(format!(
                    "License {} is denied",
                    license
                )));
            }
            if !self.config.allowed_licenses.is_empty()
                && !self.config.allowed_licenses.contains(license)
            {
                return Err(BrainError::PermissionDenied(format!(
                    "License {} is not in allowed list",
                    license
                )));
            }
        }

        let evidence = ProvenanceEvidence {
            repository: repo_id.clone(),
            commit: commit.clone(),
            version: "1.0.0".to_string(),
            changes: vec![],
            timestamp: Utc::now(),
            license: metadata.license.unwrap_or("UNKNOWN".to_string()),
            source: super::SourceLocation {
                url: metadata.url,
                path: "/".to_string(),
                line: None,
            },
        };

        Ok(evidence)
    }

    /// Analyze a repository for capabilities, license, language, security
    pub async fn analyze(&self, repo_id: &str) -> Result<RepositoryAnalysis, BrainError> {
        let metadata = {
            let registry = self.registry.read().await;
            registry
                .get(repo_id)
                .ok_or_else(|| {
                    BrainError::SourceIntelligenceError(format!(
                        "Repository {} not discovered",
                        repo_id
                    ))
                })?
                .clone()
        };

        // In a real implementation, this would:
        // 1. Clone the repository
        // 2. Scan for Cargo.toml, package.json, requirements.txt, etc.
        // 3. Analyze dependencies
        // 4. Check for security vulnerabilities
        // 5. Extract capabilities from code

        let analysis = RepositoryAnalysis {
            license: metadata.license.unwrap_or("UNKNOWN".to_string()),
            language: metadata.language.unwrap_or("UNKNOWN".to_string()),
            capabilities: self.extract_capabilities(repo_id).await?,
            security_issues: self.scan_security(repo_id).await?,
        };

        Ok(analysis)
    }

    /// Convert repository analysis to capabilities for the registry
    pub async fn register_capabilities(
        &self,
        repo_id: &str,
        commit: CommitHash,
        analysis: &RepositoryAnalysis,
    ) -> Result<Vec<Capability>, BrainError> {
        let metadata = {
            let registry = self.registry.read().await;
            registry
                .get(repo_id)
                .ok_or_else(|| {
                    BrainError::SourceIntelligenceError(format!(
                        "Repository {} not discovered",
                        repo_id
                    ))
                })?
                .clone()
        };

        let mut capabilities = Vec::new();

        // Create a capability for each discovered capability
        for (idx, cap_name) in analysis.capabilities.iter().enumerate() {
            let capability = Capability {
                id: format!("{}-{}-{}", repo_id, cap_name, idx),
                name: cap_name.clone(),
                version: "1.0.0".to_string(),
                origin: CapabilityOrigin::KnowledgeSource {
                    repo: repo_id.to_string(),
                    indexed: true,
                },
                license: analysis.license.clone(),
                description: format!("Capability from {}", repo_id),
                compatibility: super::CompatibilityMatrix {
                    rust_version: None,
                    required_features: vec![],
                    conflicts: vec![],
                },
                dependencies: vec![],
                permissions: super::PermissionSet {
                    network_access: false,
                    filesystem_access: false,
                    process_execution: false,
                    custom_permissions: HashMap::new(),
                },
                cost: super::CostModel {
                    monetary_cost: None,
                    token_cost: None,
                    resource_cost: super::ResourceCost {
                        ram_mb: 0,
                        cpu_seconds: 0,
                        disk_mb: 0,
                    },
                },
                consumption: super::ResourceProfile {
                    typical_ram_mb: 0,
                    typical_cpu_percent: 0.0,
                    typical_disk_mb: 0,
                    typical_network_kbps: 0,
                },
                evidence: ProvenanceEvidence {
                    repository: repo_id.to_string(),
                    commit: commit.clone(),
                    version: "1.0.0".to_string(),
                    changes: vec![],
                    timestamp: Utc::now(),
                    license: analysis.license.clone(),
                    source: super::SourceLocation {
                        url: metadata.url.clone(),
                        path: "/".to_string(),
                        line: None,
                    },
                },
                status: CapabilityStatus::Discovered,
            };

            capabilities.push(capability);
        }

        Ok(capabilities)
    }

    /// Get repository metadata
    pub async fn get_metadata(&self, repo_id: &str) -> Result<RepositoryMetadata, BrainError> {
        let registry = self.registry.read().await;
        registry.get(repo_id).cloned().ok_or_else(|| {
            BrainError::SourceIntelligenceError(format!("Repository {} not found", repo_id))
        })
    }

    /// List all discovered repositories
    pub async fn list_repositories(&self) -> Vec<RepositoryMetadata> {
        let registry = self.registry.read().await;
        registry.values().cloned().collect()
    }

    /// Discover repositories from GitHub
    async fn discover_github(
        &self,
        source: &str,
        _discoverer: &ApiDiscoverer,
    ) -> Result<Vec<RepoId>, BrainError> {
        // Parse GitHub URL and extract owner/repo
        let repo_id = source
            .replace("https://github.com/", "")
            .replace("github.com/", "")
            .replace(".git", "")
            .to_string();

        // In a real implementation, this would:
        // 1. Call GitHub API to get repository metadata
        // 2. Check license, stars, language
        // 3. Validate against allowed/denied licenses

        let metadata = RepositoryMetadata {
            repo_id: repo_id.clone(),
            url: format!("https://github.com/{}", repo_id),
            default_branch: "main".to_string(),
            last_indexed: Utc::now(),
            license: Some("MIT".to_string()),   // Placeholder
            language: Some("Rust".to_string()), // Placeholder
            stars: 1000,                        // Placeholder
            status: RepositoryStatus::Discovered,
        };

        let mut registry = self.registry.write().await;
        registry.insert(repo_id.clone(), metadata);

        Ok(vec![repo_id])
    }

    /// Discover repositories from git
    async fn discover_git(
        &self,
        source: &str,
        _discoverer: &GitDiscoverer,
    ) -> Result<Vec<RepoId>, BrainError> {
        // Parse git URL
        let repo_id = source
            .replace("git@github.com:", "")
            .replace("https://", "")
            .replace(".git", "")
            .to_string();

        let metadata = RepositoryMetadata {
            repo_id: repo_id.clone(),
            url: source.to_string(),
            default_branch: "main".to_string(),
            last_indexed: Utc::now(),
            license: Some("MIT".to_string()),   // Placeholder
            language: Some("Rust".to_string()), // Placeholder
            stars: 0,
            status: RepositoryStatus::Discovered,
        };

        let mut registry = self.registry.write().await;
        registry.insert(repo_id.clone(), metadata);

        Ok(vec![repo_id])
    }

    /// Extract capabilities from repository (placeholder)
    async fn extract_capabilities(&self, _repo_id: &str) -> Result<Vec<String>, BrainError> {
        // In a real implementation, this would:
        // 1. Scan Cargo.toml for libraries
        // 2. Scan package.json for npm packages
        // 3. Analyze function signatures
        // 4. Extract tool definitions

        Ok(vec![
            "http-client".to_string(),
            "async-utils".to_string(),
            "logging".to_string(),
        ])
    }

    /// Scan for security issues (placeholder)
    async fn scan_security(&self, _repo_id: &str) -> Result<Vec<String>, BrainError> {
        // In a real implementation, this would:
        // 1. Check for known vulnerable dependencies
        // 2. Scan for unsafe code
        // 3. Check for hardcoded secrets
        // 4. Analyze API security

        Ok(vec![])
    }
}

impl Default for SourceIntelligenceEngine {
    fn default() -> Self {
        Self::new(EngineConfig::default())
    }
}

/// Repository analysis result
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct RepositoryAnalysis {
    #[allow(missing_docs)]
    pub license: String,
    #[allow(missing_docs)]
    pub language: String,
    #[allow(missing_docs)]
    pub capabilities: Vec<String>,
    #[allow(missing_docs)]
    pub security_issues: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_config_default() {
        let config = EngineConfig::default();
        assert!(config.enable_git_discovery);
        assert!(config.enable_api_discovery);
        assert_eq!(config.max_repositories, 1000);
    }

    #[tokio::test]
    async fn test_discover_github() {
        let engine = SourceIntelligenceEngine::default();
        let result = engine.discover("https://github.com/user/repo").await;
        assert!(result.is_ok());
        let repos = result.unwrap();
        assert_eq!(repos.len(), 1);
    }

    #[tokio::test]
    async fn test_get_metadata() {
        let engine = SourceIntelligenceEngine::default();
        engine
            .discover("https://github.com/user/repo")
            .await
            .unwrap();

        let metadata = engine.get_metadata("user/repo").await;
        assert!(metadata.is_ok());
        let meta = metadata.unwrap();
        assert_eq!(meta.repo_id, "user/repo");
    }

    #[tokio::test]
    async fn test_import() {
        let engine = SourceIntelligenceEngine::default();
        engine
            .discover("https://github.com/user/repo")
            .await
            .unwrap();

        let result = engine
            .import("user/repo".to_string(), "abc123".to_string())
            .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_analyze() {
        let engine = SourceIntelligenceEngine::default();
        engine
            .discover("https://github.com/user/repo")
            .await
            .unwrap();

        let result = engine.analyze("user/repo").await;
        assert!(result.is_ok());
        let analysis = result.unwrap();
        assert_eq!(analysis.license, "MIT");
        assert!(!analysis.capabilities.is_empty());
    }

    #[tokio::test]
    async fn test_register_capabilities() {
        let engine = SourceIntelligenceEngine::default();
        engine
            .discover("https://github.com/user/repo")
            .await
            .unwrap();

        let analysis = engine.analyze("user/repo").await.unwrap();
        let capabilities = engine
            .register_capabilities("user/repo", "abc123".to_string(), &analysis)
            .await;
        assert!(capabilities.is_ok());
        let caps = capabilities.unwrap();
        assert!(!caps.is_empty());
    }

    #[tokio::test]
    async fn test_denied_license() {
        let config = EngineConfig {
            denied_licenses: vec!["MIT".to_string()],
            ..Default::default()
        };
        let engine = SourceIntelligenceEngine::new(config);
        engine
            .discover("https://github.com/user/repo")
            .await
            .unwrap();

        let result = engine
            .import("user/repo".to_string(), "abc123".to_string())
            .await;
        assert!(result.is_err());
    }
}
