#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Runtime policy and capability enforcement.
//!
//! Capabilities are short-lived, scope-bound grants. Secrets are intentionally
//! not represented by this crate.

use agenticos_contracts::{CapabilityGrant, CapabilityIssuer, CapabilityType, ContractError};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
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
    db: Option<Arc<sqlx::SqlitePool>>,
}

impl CapabilityManager {
    /// Create an empty manager.
    pub fn new() -> Self {
        Self {
            grants: Arc::new(RwLock::new(HashMap::new())),
            approvals: Arc::new(RwLock::new(HashMap::new())),
            db: None,
        }
    }

    /// Open a SQLite-backed capability manager and recover grants/approvals.
    pub async fn open(database_url: &str) -> Result<Self, ContractError> {
        let db = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("security database connection failed: {error}"))
            })?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS capability_grants (grant_id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
        )
        .execute(&db)
        .await
        .map_err(|error| ContractError::ParseError(format!("capability schema initialization failed: {error}")))?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS approval_requests (approval_id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
        )
        .execute(&db)
        .await
        .map_err(|error| ContractError::ParseError(format!("approval schema initialization failed: {error}")))?;

        let grant_rows = sqlx::query_as::<_, (String, String)>(
            "SELECT grant_id, payload FROM capability_grants",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| ContractError::ParseError(format!("grant recovery failed: {error}")))?;
        let approval_rows = sqlx::query_as::<_, (String, String)>(
            "SELECT approval_id, payload FROM approval_requests",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| ContractError::ParseError(format!("approval recovery failed: {error}")))?;

        let mut grants = HashMap::with_capacity(grant_rows.len());
        for (grant_id, payload) in grant_rows {
            let grant: CapabilityGrant = serde_json::from_str(&payload).map_err(|error| {
                ContractError::ParseError(format!("invalid persisted grant {grant_id}: {error}"))
            })?;
            grants.insert(grant_id, grant);
        }

        let mut approvals = HashMap::with_capacity(approval_rows.len());
        for (approval_id, payload) in approval_rows {
            let request: ApprovalRequest = serde_json::from_str(&payload).map_err(|error| {
                ContractError::ParseError(format!(
                    "invalid persisted approval {approval_id}: {error}"
                ))
            })?;
            approvals.insert(approval_id, request);
        }

        Ok(Self {
            grants: Arc::new(RwLock::new(grants)),
            approvals: Arc::new(RwLock::new(approvals)),
            db: Some(Arc::new(db)),
        })
    }

    async fn persist_grant(&self, grant: &CapabilityGrant) -> Result<(), ContractError> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(grant).map_err(|error| {
            ContractError::ParseError(format!("grant serialization failed: {error}"))
        })?;
        sqlx::query(
            "INSERT INTO capability_grants (grant_id, payload) VALUES (?, ?) ON CONFLICT(grant_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&grant.grant_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| ContractError::ParseError(format!("grant persistence failed: {error}")))?;
        Ok(())
    }

    async fn delete_grant(&self, grant_id: &str) -> Result<(), ContractError> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        sqlx::query("DELETE FROM capability_grants WHERE grant_id = ?")
            .bind(grant_id)
            .execute(db.as_ref())
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("grant deletion failed: {error}"))
            })?;
        Ok(())
    }

    async fn persist_approval(&self, request: &ApprovalRequest) -> Result<(), ContractError> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(request).map_err(|error| {
            ContractError::ParseError(format!("approval serialization failed: {error}"))
        })?;
        sqlx::query(
            "INSERT INTO approval_requests (approval_id, payload) VALUES (?, ?) ON CONFLICT(approval_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&request.approval_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| ContractError::ParseError(format!("approval persistence failed: {error}")))?;
        Ok(())
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
    ) -> Result<ApprovalRequest, ContractError> {
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
        if let Err(error) = self.persist_approval(&request).await {
            let _ = self.approvals.write().await.remove(&request.approval_id);
            return Err(error);
        }
        Ok(request)
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
        if request.state != ApprovalState::Pending {
            return Err(ContractError::ParseError(
                "approval is no longer pending".to_string(),
            ));
        }
        if request.expires_at != 0 && request.expires_at <= unix_time() {
            request.state = ApprovalState::Expired;
            return Err(ContractError::ParseError(
                "approval request has expired".to_string(),
            ));
        }
        request.state = if approved {
            ApprovalState::Approved
        } else {
            ApprovalState::Denied
        };
        let snapshot = request.clone();
        drop(approvals);
        self.persist_approval(&snapshot).await?;
        Ok(snapshot)
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
        let mut approvals = self.approvals.write().await;
        let Some(request) = approvals.get_mut(approval_id) else {
            return false;
        };
        if request.state == ApprovalState::Approved
            && request.expires_at != 0
            && request.expires_at <= unix_time()
        {
            request.state = ApprovalState::Expired;
            return false;
        }
        request.state == ApprovalState::Approved
    }

    /// Return a redacted inventory of issued grants.
    pub async fn list_grants(&self) -> Vec<CapabilityGrant> {
        let mut grants: Vec<_> = self.grants.read().await.values().cloned().collect();
        grants.sort_by(|left, right| left.grant_id.cmp(&right.grant_id));
        grants
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
        if let Err(error) = self.persist_grant(&request).await {
            let _ = self.grants.write().await.remove(&request.grant_id);
            return Err(error);
        }
        Ok(request.grant_id)
    }

    async fn revoke(&self, grant_id: &str) -> Result<(), ContractError> {
        let removed = self.grants.write().await.remove(grant_id).is_some();
        if !removed {
            return Err(ContractError::MissingCapability);
        }
        self.delete_grant(grant_id).await?;
        Ok(())
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
    async fn sqlite_security_state_recovers_grants_and_approvals() {
        let path =
            std::env::temp_dir().join(format!("agenticos-security-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let manager = CapabilityManager::open(&url).await.unwrap();
        manager
            .issue(CapabilityGrant {
                capability_type: CapabilityType::Execute,
                resource: "workspace/*".to_string(),
                permission: "execute".to_string(),
                expires_at: 0,
                grant_id: "durable-grant".to_string(),
            })
            .await
            .unwrap();

        let approval = manager
            .request_approval("run-durable", "execute", "workspace/bin", 0)
            .await
            .unwrap();
        drop(manager);

        let recovered = CapabilityManager::open(&url).await.unwrap();
        assert!(recovered
            .authorize(
                "durable-grant",
                CapabilityType::Execute,
                "workspace/bin",
                "execute",
            )
            .await
            .unwrap());
        assert_eq!(recovered.pending_approvals().await.len(), 1);
        recovered
            .resolve_approval(&approval.approval_id, true)
            .await
            .unwrap();
        assert!(recovered.is_approved(&approval.approval_id).await);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn approval_lifecycle_is_durable_in_memory() {
        let manager = CapabilityManager::new();
        let request = manager
            .request_approval("run-1", "delete", "workspace/tmp", 0)
            .await
            .unwrap();
        assert_eq!(manager.pending_approvals().await.len(), 1);
        manager
            .resolve_approval(&request.approval_id, true)
            .await
            .unwrap();
        assert!(manager.is_approved(&request.approval_id).await);
    }
}
