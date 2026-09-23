#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! AgentiCOS Brain - Central intelligence platform
//!
//! The Brain is the center of the AgentiCOS system:
//! - Reasoning, planning, orchestration
//! - Memory, knowledge, execution
//! - Evaluation, learning, capability discovery
//! - Resource management
//!
//! The Brain never depends structurally on a concrete repository, provider, model, MCP or tool.

pub mod capability_registry;
pub mod knowledge_base;
pub mod reasoning_engine;
pub mod resource_governor;
pub mod source_intelligence;

pub use capability_registry::{CapabilityRegistry, RegistryConfig, RegistryStats};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Brain architecture owner
pub const OWNER: &str = "agenticos-brain";

/// Capability identifier
pub type CapabilityId = String;

/// Provider identifier
pub type ProviderId = String;

/// Tool identifier
pub type ToolId = String;

/// Skill identifier
pub type SkillId = String;

/// Repository identifier
pub type RepoId = String;

/// Commit hash
pub type CommitHash = String;

/// Semantic version
pub type SemVer = String;

/// License identifier
pub type License = String;

/// Capability origin type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CapabilityOrigin {
    /// Code integrated directly into core
    IntegratedCode { repo: RepoId, commit: CommitHash },
    /// Adapted through plugin adapter
    AdaptedPlugin { repo: RepoId, adapter: CapabilityId },
    /// Runs in isolated process
    IsolatedProcess { repo: RepoId, sandbox: CapabilityId },
    /// Knowledge source (indexed, not executed)
    KnowledgeSource { repo: RepoId, indexed: bool },
}

/// Capability metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability {
    pub id: CapabilityId,
    pub name: String,
    pub version: SemVer,
    pub origin: CapabilityOrigin,
    pub license: License,
    pub description: String,
    pub compatibility: CompatibilityMatrix,
    pub dependencies: Vec<CapabilityId>,
    pub permissions: PermissionSet,
    pub cost: CostModel,
    pub consumption: ResourceProfile,
    pub evidence: ProvenanceEvidence,
    pub status: CapabilityStatus,
}

/// Capability status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum CapabilityStatus {
    Discovered,
    Validating,
    Accepted,
    Rejected,
    Deprecated,
}

/// Compatibility matrix
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityMatrix {
    pub rust_version: Option<String>,
    pub required_features: Vec<String>,
    pub conflicts: Vec<CapabilityId>,
}

/// Permission set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionSet {
    pub network_access: bool,
    pub filesystem_access: bool,
    pub process_execution: bool,
    pub custom_permissions: HashMap<String, String>,
}

/// Cost model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostModel {
    pub monetary_cost: Option<f64>,
    pub token_cost: Option<u64>,
    pub resource_cost: ResourceCost,
}

/// Resource cost
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceCost {
    pub ram_mb: u64,
    pub cpu_seconds: u64,
    pub disk_mb: u64,
}

/// Resource profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceProfile {
    pub typical_ram_mb: u64,
    pub typical_cpu_percent: f64,
    pub typical_disk_mb: u64,
    pub typical_network_kbps: u64,
}

/// Provenance evidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceEvidence {
    pub repository: String,
    pub commit: CommitHash,
    pub version: SemVer,
    pub changes: Vec<ChangeRecord>,
    pub timestamp: DateTime<Utc>,
    pub license: License,
    pub source: SourceLocation,
}

/// Change record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub author: String,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

/// Source location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceLocation {
    pub url: String,
    pub path: String,
    pub line: Option<u32>,
}

/// Brain initialization error
#[derive(Debug, thiserror::Error)]
pub enum BrainError {
    #[error("Capability not found: {0}")]
    CapabilityNotFound(CapabilityId),

    #[error("Invalid capability version: {0}")]
    InvalidVersion(String),

    #[error("Dependency conflict: {0}")]
    DependencyConflict(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Resource limit exceeded: {0}")]
    ResourceLimitExceeded(String),

    #[error("Knowledge base error: {0}")]
    KnowledgeBaseError(String),

    #[error("Source intelligence error: {0}")]
    SourceIntelligenceError(String),

    #[error("Reasoning engine error: {0}")]
    ReasoningEngineError(String),
}

/// Brain configuration
#[derive(Debug, Clone)]
pub struct BrainConfig {
    pub max_capabilities: usize,
    pub enable_source_intelligence: bool,
    pub enable_resource_governor: bool,
    pub knowledge_base_path: String,
}

impl Default for BrainConfig {
    fn default() -> Self {
        Self {
            max_capabilities: 10000,
            enable_source_intelligence: true,
            enable_resource_governor: true,
            knowledge_base_path: "./knowledge".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capability_origin_serialization() {
        let origin = CapabilityOrigin::IntegratedCode {
            repo: "test-repo".to_string(),
            commit: "abc123".to_string(),
        };

        let serialized = serde_json::to_string(&origin).unwrap();
        let deserialized: CapabilityOrigin = serde_json::from_str(&serialized).unwrap();

        assert_eq!(origin, deserialized);
    }

    #[test]
    fn test_brain_config_default() {
        let config = BrainConfig::default();
        assert_eq!(config.max_capabilities, 10000);
        assert!(config.enable_source_intelligence);
    }
}
