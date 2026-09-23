//! Capability Registry - Dynamic capability discovery and management

#![allow(missing_docs)]

use super::{BrainError, Capability, CapabilityId, CapabilityOrigin, CapabilityStatus, License};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Capability Registry - Central registry for all capabilities
#[derive(Debug)]
pub struct CapabilityRegistry {
    capabilities: Arc<RwLock<HashMap<CapabilityId, Capability>>>,
    /// Index by type (derived from origin)
    index_by_type: Arc<RwLock<HashMap<String, Vec<CapabilityId>>>>,
    /// Index by license
    index_by_license: Arc<RwLock<HashMap<License, Vec<CapabilityId>>>>,
    /// Index by status
    index_by_status: Arc<RwLock<HashMap<CapabilityStatus, Vec<CapabilityId>>>>,
    /// Dependency graph
    dependency_graph: Arc<RwLock<HashMap<CapabilityId, Vec<CapabilityId>>>>,
    /// Reverse dependency graph (who depends on what)
    reverse_dependency_graph: Arc<RwLock<HashMap<CapabilityId, Vec<CapabilityId>>>>,
    config: RegistryConfig,
}

/// Registry configuration
#[derive(Debug, Clone)]
pub struct RegistryConfig {
    pub max_capabilities: usize,
    pub enable_auto_discovery: bool,
    pub allowed_licenses: Vec<License>,
    pub denied_licenses: Vec<License>,
    pub enable_permission_validation: bool,
}

impl Default for RegistryConfig {
    fn default() -> Self {
        Self {
            max_capabilities: 10000,
            enable_auto_discovery: true,
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
            enable_permission_validation: true,
        }
    }
}

impl CapabilityRegistry {
    /// Create a new capability registry
    pub fn new(config: RegistryConfig) -> Self {
        Self {
            capabilities: Arc::new(RwLock::new(HashMap::new())),
            index_by_type: Arc::new(RwLock::new(HashMap::new())),
            index_by_license: Arc::new(RwLock::new(HashMap::new())),
            index_by_status: Arc::new(RwLock::new(HashMap::new())),
            dependency_graph: Arc::new(RwLock::new(HashMap::new())),
            reverse_dependency_graph: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    /// Register a new capability with full validation
    pub async fn register(&self, capability: Capability) -> Result<(), BrainError> {
        // Check resource limits
        let registry = self.capabilities.read().await;
        if registry.len() >= self.config.max_capabilities {
            return Err(BrainError::ResourceLimitExceeded(
                "Maximum capabilities reached".to_string(),
            ));
        }

        // Check for duplicates
        if registry.contains_key(&capability.id) {
            return Err(BrainError::DependencyConflict(format!(
                "Capability {} already exists",
                capability.id
            )));
        }
        drop(registry);

        // Validate license
        self.validate_license(&capability.license)?;

        // Validate permissions if enabled
        if self.config.enable_permission_validation {
            self.validate_permissions(&capability)?;
        }

        // Validate dependencies
        self.validate_dependencies(&capability).await?;

        // Add to registry
        let mut registry = self.capabilities.write().await;
        let type_key = self.get_type_key(&capability.origin);

        // Update indexes
        {
            let mut index_by_type = self.index_by_type.write().await;
            index_by_type
                .entry(type_key)
                .or_insert_with(Vec::new)
                .push(capability.id.clone());
        }

        {
            let mut index_by_license = self.index_by_license.write().await;
            index_by_license
                .entry(capability.license.clone())
                .or_insert_with(Vec::new)
                .push(capability.id.clone());
        }

        {
            let mut index_by_status = self.index_by_status.write().await;
            index_by_status
                .entry(capability.status.clone())
                .or_insert_with(Vec::new)
                .push(capability.id.clone());
        }

        // Update dependency graph
        {
            let mut dep_graph = self.dependency_graph.write().await;
            dep_graph.insert(capability.id.clone(), capability.dependencies.clone());

            let mut reverse_graph = self.reverse_dependency_graph.write().await;
            for dep_id in &capability.dependencies {
                reverse_graph
                    .entry(dep_id.clone())
                    .or_insert_with(Vec::new)
                    .push(capability.id.clone());
            }
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

    /// List capabilities by status
    pub async fn list_by_status(&self, status: CapabilityStatus) -> Vec<Capability> {
        let index = self.index_by_status.read().await;
        let registry = self.capabilities.read().await;

        if let Some(ids) = index.get(&status) {
            ids.iter()
                .filter_map(|id| registry.get(id).cloned())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// List capabilities by license
    pub async fn list_by_license(&self, license: &License) -> Vec<Capability> {
        let index = self.index_by_license.read().await;
        let registry = self.capabilities.read().await;

        if let Some(ids) = index.get(license) {
            ids.iter()
                .filter_map(|id| registry.get(id).cloned())
                .collect()
        } else {
            Vec::new()
        }
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

        let old_status = capability.status.clone();
        capability.status = status.clone();

        // Update status index
        let mut index = self.index_by_status.write().await;
        if let Some(ids) = index.get_mut(&old_status) {
            ids.retain(|x| x != id);
        }
        index
            .entry(status)
            .or_insert_with(Vec::new)
            .push(id.clone());

        Ok(())
    }

    /// Discover capabilities by origin type
    pub async fn discover_by_origin(&self, origin: &CapabilityOrigin) -> Vec<Capability> {
        let type_key = self.get_type_key(origin);
        let index = self.index_by_type.read().await;
        let registry = self.capabilities.read().await;

        if let Some(ids) = index.get(&type_key) {
            ids.iter()
                .filter_map(|id| registry.get(id).cloned())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Search capabilities by name or description
    pub async fn search(&self, query: &str) -> Vec<Capability> {
        let registry = self.capabilities.read().await;
        let query_lower = query.to_lowercase();

        registry
            .values()
            .filter(|c| {
                c.name.to_lowercase().contains(&query_lower)
                    || c.description.to_lowercase().contains(&query_lower)
            })
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

    /// Get all dependents of a capability (reverse dependency lookup)
    pub async fn get_dependents(&self, id: &CapabilityId) -> Vec<Capability> {
        let reverse_graph = self.reverse_dependency_graph.read().await;
        let registry = self.capabilities.read().await;

        if let Some(dependent_ids) = reverse_graph.get(id) {
            dependent_ids
                .iter()
                .filter_map(|dep_id| registry.get(dep_id).cloned())
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Remove a capability from the registry
    pub async fn remove(&self, id: &CapabilityId) -> Result<(), BrainError> {
        // Check if anything depends on this capability
        let dependents = self.get_dependents(id).await;
        if !dependents.is_empty() {
            return Err(BrainError::DependencyConflict(format!(
                "Cannot remove capability {} - {} capabilities depend on it",
                id,
                dependents.len()
            )));
        }

        let mut registry = self.capabilities.write().await;
        let capability = registry
            .remove(id)
            .ok_or_else(|| BrainError::CapabilityNotFound(id.clone()))?;

        // Remove from indexes
        let type_key = self.get_type_key(&capability.origin);
        {
            let mut index = self.index_by_type.write().await;
            if let Some(ids) = index.get_mut(&type_key) {
                ids.retain(|x| x != id);
            }
        }

        {
            let mut index = self.index_by_license.write().await;
            if let Some(ids) = index.get_mut(&capability.license) {
                ids.retain(|x| x != id);
            }
        }

        {
            let mut index = self.index_by_status.write().await;
            if let Some(ids) = index.get_mut(&capability.status) {
                ids.retain(|x| x != id);
            }
        }

        // Remove from dependency graphs
        {
            let mut dep_graph = self.dependency_graph.write().await;
            dep_graph.remove(id);
        }

        {
            let mut reverse_graph = self.reverse_dependency_graph.write().await;
            reverse_graph.remove(id);
            // Also remove this ID from other dependency lists
            for dep_list in reverse_graph.values_mut() {
                dep_list.retain(|x| x != id);
            }
        }

        Ok(())
    }

    /// Validate license against allowed/denied lists
    fn validate_license(&self, license: &License) -> Result<(), BrainError> {
        // Check denied licenses first
        if self.config.denied_licenses.contains(license) {
            return Err(BrainError::PermissionDenied(format!(
                "License {} is denied",
                license
            )));
        }

        // If allowed list is not empty, check it
        if !self.config.allowed_licenses.is_empty()
            && !self.config.allowed_licenses.contains(license)
        {
            return Err(BrainError::PermissionDenied(format!(
                "License {} is not in allowed list",
                license
            )));
        }

        Ok(())
    }

    /// Validate permissions are reasonable
    fn validate_permissions(&self, capability: &Capability) -> Result<(), BrainError> {
        // Check for overly permissive capabilities
        if capability.permissions.process_execution && capability.license == "GPL-3.0" {
            return Err(BrainError::PermissionDenied(
                "Process execution not allowed with GPL-3.0 license".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate all dependencies exist and are compatible
    async fn validate_dependencies(&self, capability: &Capability) -> Result<(), BrainError> {
        let registry = self.capabilities.read().await;

        for dep_id in &capability.dependencies {
            if !registry.contains_key(dep_id) {
                return Err(BrainError::DependencyConflict(format!(
                    "Dependency {} not found",
                    dep_id
                )));
            }
        }

        Ok(())
    }

    /// Get type key from origin for indexing
    fn get_type_key(&self, origin: &CapabilityOrigin) -> String {
        match origin {
            CapabilityOrigin::IntegratedCode { .. } => "integrated".to_string(),
            CapabilityOrigin::AdaptedPlugin { .. } => "plugin".to_string(),
            CapabilityOrigin::IsolatedProcess { .. } => "isolated".to_string(),
            CapabilityOrigin::KnowledgeSource { .. } => "knowledge".to_string(),
        }
    }

    /// Get registry statistics
    pub async fn stats(&self) -> RegistryStats {
        let registry = self.capabilities.read().await;
        let total = registry.len();

        let by_status = {
            let index = self.index_by_status.read().await;
            index.iter().map(|(k, v)| (k.clone(), v.len())).collect()
        };

        let by_license = {
            let index = self.index_by_license.read().await;
            index.iter().map(|(k, v)| (k.clone(), v.len())).collect()
        };

        RegistryStats {
            total_capabilities: total,
            by_status,
            by_license,
            max_capabilities: self.config.max_capabilities,
        }
    }
}

/// Registry statistics
#[derive(Debug, Clone)]
pub struct RegistryStats {
    pub total_capabilities: usize,
    pub by_status: HashMap<CapabilityStatus, usize>,
    pub by_license: HashMap<License, usize>,
    pub max_capabilities: usize,
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

    fn create_test_capability(id: &str) -> Capability {
        Capability {
            id: id.to_string(),
            name: format!("Test {}", id),
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
        }
    }

    #[tokio::test]
    async fn test_register_capability() {
        let registry = CapabilityRegistry::default();
        let capability = create_test_capability("test-capability");

        registry.register(capability).await.unwrap();

        let retrieved = registry.get(&"test-capability".to_string()).await.unwrap();
        assert_eq!(retrieved.id, "test-capability");
    }

    #[tokio::test]
    async fn test_duplicate_capability() {
        let registry = CapabilityRegistry::default();
        let capability = create_test_capability("test-capability");

        registry.register(capability.clone()).await.unwrap();

        let result = registry.register(capability).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_license_validation() {
        let config = RegistryConfig {
            denied_licenses: vec!["GPL-3.0".to_string()],
            ..Default::default()
        };
        let registry = CapabilityRegistry::new(config);

        let mut capability = create_test_capability("test-capability");
        capability.license = "GPL-3.0".to_string();

        let result = registry.register(capability).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_dependency_validation() {
        let registry = CapabilityRegistry::default();

        let mut capability = create_test_capability("test-capability");
        capability.dependencies = vec!["non-existent".to_string()];

        let result = registry.register(capability).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_search() {
        let registry = CapabilityRegistry::default();

        let mut cap1 = create_test_capability("cap1");
        cap1.name = "Searchable Name".to_string();
        cap1.description = "This is searchable".to_string();

        let mut cap2 = create_test_capability("cap2");
        cap2.name = "Other Name".to_string();
        cap2.description = "Not matching".to_string();

        registry.register(cap1).await.unwrap();
        registry.register(cap2).await.unwrap();

        let results = registry.search("searchable").await;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "cap1");
    }

    #[tokio::test]
    async fn test_update_status() {
        let registry = CapabilityRegistry::default();
        let capability = create_test_capability("test-capability");

        registry.register(capability).await.unwrap();

        registry
            .update_status(&"test-capability".to_string(), CapabilityStatus::Accepted)
            .await
            .unwrap();

        let retrieved = registry.get(&"test-capability".to_string()).await.unwrap();
        assert_eq!(retrieved.status, CapabilityStatus::Accepted);
    }

    #[tokio::test]
    async fn test_stats() {
        let registry = CapabilityRegistry::default();

        registry
            .register(create_test_capability("cap1"))
            .await
            .unwrap();
        registry
            .register(create_test_capability("cap2"))
            .await
            .unwrap();

        let stats = registry.stats().await;
        assert_eq!(stats.total_capabilities, 2);
    }

    #[tokio::test]
    async fn test_remove_capability() {
        let registry = CapabilityRegistry::default();
        let capability = create_test_capability("test-capability");

        registry.register(capability).await.unwrap();
        registry
            .remove(&"test-capability".to_string())
            .await
            .unwrap();

        let result = registry.get(&"test-capability".to_string()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_remove_with_dependents() {
        let registry = CapabilityRegistry::default();

        let cap1 = create_test_capability("cap1");
        let mut cap2 = create_test_capability("cap2");
        cap2.dependencies = vec!["cap1".to_string()];

        registry.register(cap1).await.unwrap();
        registry.register(cap2).await.unwrap();

        let result = registry.remove(&"cap1".to_string()).await;
        assert!(result.is_err());
    }
}
