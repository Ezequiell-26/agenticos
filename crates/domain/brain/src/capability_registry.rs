//! Capability Registry - Dynamic capability discovery and management

use super::{BrainError, Capability, CapabilityId, CapabilityOrigin, CapabilityStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Capability Registry - Central registry for all capabilities
pub struct CapabilityRegistry {
    capabilities: Arc<RwLock<HashMap<CapabilityId, Capability>>>,
    config: RegistryConfig,
}

/// Registry configuration
#[derive(Debug, Clone)]
pub struct RegistryConfig {
    pub max_capabilities: usize,
    pub enable_auto_discovery: bool,
}

impl Default for RegistryConfig {
    fn default() -> Self {
        Self {
            max_capabilities: 10000,
            enable_auto_discovery: true,
        }
    }
}

impl CapabilityRegistry {
    /// Create a new capability registry
    pub fn new(config: RegistryConfig) -> Self {
        Self {
            capabilities: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Register a new capability
    pub async fn register(&self, capability: Capability) -> Result<(), BrainError> {
        let mut registry = self.capabilities.write().await;

        if registry.len() >= self.config.max_capabilities {
            return Err(BrainError::ResourceLimitExceeded(
                "Maximum capabilities reached".to_string(),
            ));
        }

        if registry.contains_key(&capability.id) {
            return Err(BrainError::DependencyConflict(format!(
                "Capability {} already exists",
                capability.id
            )));
        }

        registry.insert(capability.id.clone(), capability);
        Ok(())
    }

    /// Get a capability by ID
    pub async fn get(&self, id: &CapabilityId) -> Result<Capability, BrainError> {
        let registry = self.capabilities.read().await;
        registry
            .get(id)
            .cloned()
            .ok_or_else(|| BrainError::CapabilityNotFound(id.clone()))
    }

    /// List all capabilities
    pub async fn list(&self) -> Vec<Capability> {
        let registry = self.capabilities.read().await;
        registry.values().cloned().collect()
    }

    /// Update capability status
    pub async fn update_status(
        &self,
        id: &CapabilityId,
        status: CapabilityStatus,
    ) -> Result<(), BrainError> {
        let mut registry = self.capabilities.write().await;
        let capability = registry
            .get_mut(id)
            .ok_or_else(|| BrainError::CapabilityNotFound(id.clone()))?;

        capability.status = status;
        Ok(())
    }

    /// Discover capabilities by origin type
    pub async fn discover_by_origin(&self, origin: &CapabilityOrigin) -> Vec<Capability> {
        let registry = self.capabilities.read().await;
        registry
            .values()
            .filter(|c| &c.origin == origin)
            .cloned()
            .collect()
    }

    /// Check compatibility between capabilities
    pub async fn check_compatibility(&self, id: &CapabilityId) -> Result<bool, BrainError> {
        let capability = self.get(id).await?;
        let registry = self.capabilities.read().await;

        for dep_id in &capability.dependencies {
            if let Some(dep) = registry.get(dep_id) {
                // Check if dependency conflicts
                if capability.compatibility.conflicts.contains(&dep.id) {
                    return Ok(false);
                }
            } else {
                return Ok(false); // Missing dependency
            }
        }

        Ok(true)
    }
}

impl Default for CapabilityRegistry {
    fn default() -> Self {
        Self::new(RegistryConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[tokio::test]
    async fn test_register_capability() {
        let registry = CapabilityRegistry::default();

        let capability = Capability {
            id: "test-capability".to_string(),
            name: "Test Capability".to_string(),
            version: "1.0.0".to_string(),
            origin: CapabilityOrigin::IntegratedCode {
                repo: "test-repo".to_string(),
                commit: "abc123".to_string(),
            },
            license: "MIT".to_string(),
            description: "Test".to_string(),
            compatibility: super::super::CompatibilityMatrix {
                rust_version: None,
                required_features: vec![],
                conflicts: vec![],
            },
            dependencies: vec![],
            permissions: super::super::PermissionSet {
                network_access: false,
                filesystem_access: false,
                process_execution: false,
                custom_permissions: HashMap::new(),
            },
            cost: super::super::CostModel {
                monetary_cost: None,
                token_cost: None,
                resource_cost: super::super::ResourceCost {
                    ram_mb: 0,
                    cpu_seconds: 0,
                    disk_mb: 0,
                },
            },
            consumption: super::super::ResourceProfile {
                typical_ram_mb: 0,
                typical_cpu_percent: 0.0,
                typical_disk_mb: 0,
                typical_network_kbps: 0,
            },
            evidence: super::super::ProvenanceEvidence {
                repository: "test".to_string(),
                commit: "abc123".to_string(),
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
            status: CapabilityStatus::Discovered,
        };

        registry.register(capability).await.unwrap();

        let retrieved = registry.get(&"test-capability".to_string()).await.unwrap();
        assert_eq!(retrieved.id, "test-capability");
    }

    #[tokio::test]
    async fn test_duplicate_capability() {
        let registry = CapabilityRegistry::default();

        let capability = Capability {
            id: "test-capability".to_string(),
            name: "Test".to_string(),
            version: "1.0.0".to_string(),
            origin: CapabilityOrigin::IntegratedCode {
                repo: "test".to_string(),
                commit: "abc".to_string(),
            },
            license: "MIT".to_string(),
            description: "Test".to_string(),
            compatibility: super::super::CompatibilityMatrix {
                rust_version: None,
                required_features: vec![],
                conflicts: vec![],
            },
            dependencies: vec![],
            permissions: super::super::PermissionSet {
                network_access: false,
                filesystem_access: false,
                process_execution: false,
                custom_permissions: HashMap::new(),
            },
            cost: super::super::CostModel {
                monetary_cost: None,
                token_cost: None,
                resource_cost: super::super::ResourceCost {
                    ram_mb: 0,
                    cpu_seconds: 0,
                    disk_mb: 0,
                },
            },
            consumption: super::super::ResourceProfile {
                typical_ram_mb: 0,
                typical_cpu_percent: 0.0,
                typical_disk_mb: 0,
                typical_network_kbps: 0,
            },
            evidence: super::super::ProvenanceEvidence {
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
            status: CapabilityStatus::Discovered,
        };

        registry.register(capability.clone()).await.unwrap();

        let result = registry.register(capability).await;
        assert!(result.is_err());
    }
}
