#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Runtime policy and capability enforcement.
//!
//! Capabilities are short-lived, scope-bound grants. Secrets are intentionally
//! not represented by this crate.

use agenticos_contracts::{CapabilityGrant, CapabilityIssuer, CapabilityType, ContractError};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-security";

/// Approval state for a capability-sensitive operation.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ApprovalState {
    /// Approval is waiting for a decision.
    Pending,
    /// Approval was granted.
    Approved,
    /// Approval was denied.
    Denied,
    /// Approval expired.
    Expired,
}

/// A user or policy approval request.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ApprovalRequest {
    /// Stable approval identifier.
    pub approval_id: String,
    /// Requesting run.
    pub run_id: String,
    /// Requested action.
    pub action: String,
    /// Resource affected by the action.
    pub resource: String,
    /// Current decision state.
    pub state: ApprovalState,
    /// Creation timestamp in seconds.
    pub created_at: u64,
    /// Expiration timestamp in seconds, zero for none.
    pub expires_at: u64,
}

/// Central capability and approval manager.
#[derive(Debug, Clone)]
pub struct CapabilityManager {
    grants: Arc<RwLock<HashMap<String, CapabilityGrant>>>,
    approvals: Arc<RwLock<HashMap<String, ApprovalRequest>>>,
}

impl CapabilityManager {
    /// Create an empty manager.
    pub fn new() -> Self {
        Self {
            grants: Arc::new(RwLock::new(HashMap::new())),
            approvals: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Validate an issued grant for a concrete capability and resource.
    pub async fn authorize(
        &self,
        grant_id: &str,
        required_type: CapabilityType,
        resource: &str,
        permission: &str,
    ) -> Result<bool, ContractError> {
        let grants = self.grants.read().await;
        let Some(grant) = grants.get(grant_id) else {
            return Ok(false);
        };

        let now = unix_time();
        if grant.expires_at != 0 && grant.expires_at <= now {
            return Ok(false);
        }

        if !capability_type_allows(grant.capability_type, required_type) {
            return Ok(false);
        }

        if !scope_matches(&grant.resource, resource) {
            return Ok(false);
        }

        Ok(grant.permission == permission || grant.permission == "*" || permission == "*")
    }

    /// Create a new approval request.
    pub async fn request_approval(
        &self,
        run_id: impl Into<String>,
        action: impl Into<String>,
        resource: impl Into<String>,
        expires_at: u64,
    ) -> ApprovalRequest {
        let request = ApprovalRequest {
            approval_id: format!("approval-{}", uuid::Uuid::new_v4()),
            run_id: run_id.into(),
            action: action.into(),
            resource: resource.into(),
            state: ApprovalState::Pending,
            created_at: unix_time(),
            expires_at,
        };
        self.approvals
            .write()
            .await
            .insert(request.approval_id.clone(), request.clone());
        request
    }

    /// Resolve an approval request.
    pub async fn resolve_approval(
        &self,
        approval_id: &str,
        approved: bool,
    ) -> Result<ApprovalRequest, ContractError> {
        let mut approvals = self.approvals.write().await;
        let request = approvals
            .get_mut(approval_id)
            .ok_or(ContractError::MissingCapability)?;
        request.state = if approved {
            ApprovalState::Approved
        } else {
            ApprovalState::Denied
        };
        Ok(request.clone())
    }

    /// List pending approvals, expiring stale entries first.
    pub async fn pending_approvals(&self) -> Vec<ApprovalRequest> {
        let now = unix_time();
        let mut approvals = self.approvals.write().await;
        for request in approvals.values_mut() {
            if request.state == ApprovalState::Pending
                && request.expires_at != 0
                && request.expires_at <= now
            {
                request.state = ApprovalState::Expired;
            }
        }
        approvals
            .values()
            .filter(|request| request.state == ApprovalState::Pending)
            .cloned()
            .collect()
    }

    /// Check whether an approval is currently granted.
    pub async fn is_approved(&self, approval_id: &str) -> bool {
        self.approvals
            .read()
            .await
            .get(approval_id)
            .map(|request| request.state == ApprovalState::Approved)
            .unwrap_or(false)
    }

    /// Return a redacted inventory of issued grants.
    pub async fn list_grants(&self) -> Vec<CapabilityGrant> {
        self.grants.read().await.values().cloned().collect()
    }
}

impl Default for CapabilityManager {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl CapabilityIssuer for CapabilityManager {
    async fn issue(&self, request: CapabilityGrant) -> Result<String, ContractError> {
        if request.grant_id.trim().is_empty()
            || request.resource.trim().is_empty()
            || request.permission.trim().is_empty()
        {
            return Err(ContractError::InvalidId);
        }
        self.grants
            .write()
            .await
            .insert(request.grant_id.clone(), request.clone());
        Ok(request.grant_id)
    }

    async fn revoke(&self, grant_id: &str) -> Result<(), ContractError> {
        self.grants
            .write()
            .await
            .remove(grant_id)
            .map(|_| ())
            .ok_or(ContractError::MissingCapability)
    }

    async fn validate_with_expiry(&self, grant_id: &str) -> Result<bool, ContractError> {
        let grants = self.grants.read().await;
        let Some(grant) = grants.get(grant_id) else {
            return Ok(false);
        };
        Ok(grant.expires_at == 0 || grant.expires_at > unix_time())
    }
}

fn capability_type_allows(granted: CapabilityType, required: CapabilityType) -> bool {
    granted == required
        || matches!(granted, CapabilityType::Admin)
        || (matches!(granted, CapabilityType::Write) && matches!(required, CapabilityType::Read))
        || (matches!(granted, CapabilityType::Execute) && matches!(required, CapabilityType::Read))
}

fn scope_matches(scope: &str, resource: &str) -> bool {
    scope == "*"
        || scope == resource
        || (scope.ends_with("/*") && resource.starts_with(scope.trim_end_matches('*')))
        || resource.starts_with(&format!("{scope}:"))
}

fn unix_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use agenticos_contracts::CapabilityIssuer;

    #[tokio::test]
    async fn scoped_grants_are_enforced() {
        let manager = CapabilityManager::new();
        manager
            .issue(CapabilityGrant {
                capability_type: CapabilityType::Write,
                resource: "workspace/*".to_string(),
                permission: "write".to_string(),
                expires_at: 0,
                grant_id: "grant-1".to_string(),
            })
            .await
            .unwrap();

        assert!(manager
            .authorize("grant-1", CapabilityType::Read, "workspace/src", "read")
            .await
            .unwrap());
        assert!(!manager
            .authorize("grant-1", CapabilityType::Write, "secrets", "write")
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn approval_lifecycle_is_durable_in_memory() {
        let manager = CapabilityManager::new();
        let request = manager
            .request_approval("run-1", "delete", "workspace/tmp", 0)
            .await;
        assert_eq!(manager.pending_approvals().await.len(), 1);
        manager.resolve_approval(&request.approval_id, true).await.unwrap();
        assert!(manager.is_approved(&request.approval_id).await);
    }
}
