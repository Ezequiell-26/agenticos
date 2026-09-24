#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable project registry scoped to the configured AgentiCOS workspace.

use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-projects";

/// Persisted project identity and workspace-relative root.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectDefinition {
    /// Stable project identifier.
    pub project_id: String,
    /// Human-readable project name.
    pub name: String,
    /// Workspace-relative root path.
    pub path: String,
    /// Default Git branch label.
    pub default_branch: String,
    /// Human-readable description.
    pub description: String,
    /// Lifecycle status.
    pub status: String,
}

/// SQLite-backed project registry.
#[derive(Clone, Debug)]
pub struct ProjectRegistry {
    projects: Arc<RwLock<HashMap<String, ProjectDefinition>>>,
    db: Arc<SqlitePool>,
}

impl ProjectRegistry {
    /// Open the registry and recover persisted projects.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("project database connection failed: {error}"))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS projects (project_id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
        )
        .execute(&db)
        .await
        .map_err(|error| format!("project schema initialization failed: {error}"))?;

        let rows =
            sqlx::query_as::<_, (String, String)>("SELECT project_id, payload FROM projects")
                .fetch_all(&db)
        .await
        .map_err(|error| format!("project recovery failed: {error}"))?;

        let mut projects = HashMap::with_capacity(rows.len());
        for (project_id, payload) in rows {
            let project: ProjectDefinition = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted project {project_id}: {error}"))?;
            projects.insert(project_id, project);
        }

        Ok(Self {
            projects: Arc::new(RwLock::new(projects)),
            db: Arc::new(db),
        })
    }

    fn validate(project: &ProjectDefinition) -> Result<(), String> {
        for (field, value, max) in [
            ("project_id", project.project_id.as_str(), 128),
            ("name", project.name.as_str(), 256),
            ("path", project.path.as_str(), 1024),
            ("default_branch", project.default_branch.as_str(), 256),
            ("description", project.description.as_str(), 2048),
            ("status", project.status.as_str(), 64),
        ] {
            if value.trim().is_empty() {
                return Err(format!("{field} is required"));
            }
            if value.len() > max {
                return Err(format!("{field} exceeds supported limits"));
            }
        }
        if project.path.starts_with('/')
            || project.path.starts_with('\\')
            || project.path.contains("..")
        {
            return Err("project path must stay relative to the configured workspace".to_string());
        }
        Ok(())
    }

    /// Register or replace a project.
    pub async fn register(&self, project: ProjectDefinition) -> Result<ProjectDefinition, String> {
        Self::validate(&project)?;
        let payload = serde_json::to_string(&project)
            .map_err(|error| format!("project serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO projects (project_id, payload) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&project.project_id)
        .bind(payload)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("project persistence failed: {error}"))?;
        self.projects
            .write()
            .await
            .insert(project.project_id.clone(), project.clone());
        Ok(project)
    }

    /// List projects in stable name order.
    pub async fn list(&self) -> Vec<ProjectDefinition> {
        let mut projects: Vec<_> = self.projects.read().await.values().cloned().collect();
        projects.sort_by(|left, right| left.name.cmp(&right.name));
        projects
    }

    /// Remove one project.
    pub async fn remove(&self, project_id: &str) -> Result<(), String> {
        let id = project_id.trim();
        if id.is_empty() {
            return Err("project_id is required".to_string());
        }
        let result = sqlx::query("DELETE FROM projects WHERE project_id = ?")
            .bind(id)
            .execute(self.db.as_ref())
            .await
            .map_err(|error| format!("project deletion failed: {error}"))?;
        if result.rows_affected() == 0 {
            return Err("project not found".to_string());
        }
        self.projects.write().await.remove(id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> ProjectDefinition {
        ProjectDefinition {
            project_id: "agenticos".to_string(),
            name: "AgentiCOS".to_string(),
            path: ".".to_string(),
            default_branch: "main".to_string(),
            description: "Runtime project".to_string(),
            status: "Active".to_string(),
        }
    }

    #[tokio::test]
    async fn registers_and_lists_project() {
        let db = format!(
            "sqlite:file:agenticos_projects_{}?mode=memory&cache=shared",
            uuid::Uuid::new_v4()
        );
        let registry = ProjectRegistry::open(&db).await.unwrap();
        registry.register(project()).await.unwrap();
        assert_eq!(registry.list().await[0].project_id, "agenticos");
    }

    #[tokio::test]
    async fn rejects_workspace_escape() {
        let project = ProjectDefinition {
            path: "../outside".to_string(),
            ..project()
        };
        assert!(ProjectRegistry::validate(&project).is_err());
    }
}
