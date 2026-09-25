#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Multi-agent definitions, child-run isolation and bounded delegation.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-agents";

/// Resource budget inherited by child agents.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentBudget {
    /// Maximum model tokens.
    pub max_tokens: u64,
    /// Maximum wall clock seconds.
    pub max_wall_seconds: u64,
    /// Maximum number of tool actions.
    pub max_tool_calls: u32,
    /// Maximum delegation depth.
    pub max_depth: u16,
}

impl Default for AgentBudget {
    fn default() -> Self {
        Self {
            max_tokens: 32_000,
            max_wall_seconds: 1_800,
            max_tool_calls: 128,
            max_depth: 4,
        }
    }
}

/// Reusable agent definition.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AgentDefinition {
    /// Stable agent identifier.
    pub agent_id: String,
    /// Agent role.
    pub role: String,
    /// Allowed capabilities.
    pub capabilities: Vec<String>,
    /// Allowed provider IDs.
    pub providers: Vec<String>,
    /// Skills attached to the agent.
    pub skills: Vec<String>,
    /// Sandbox profile identifier.
    pub sandbox_profile: String,
    /// Resource budget.
    pub budget: AgentBudget,
}

/// Child run metadata.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChildRun {
    /// Stable child run identifier.
    pub child_run_id: String,
    /// Parent run.
    pub parent_run_id: String,
    /// Agent definition used.
    pub agent_id: String,
    /// Delegation depth.
    pub depth: u16,
    /// Effective budget.
    pub budget: AgentBudget,
}

/// Bounded child-run manager.
#[derive(Clone, Debug)]
pub struct SubagentManager {
    definitions: Arc<RwLock<HashMap<String, AgentDefinition>>>,
    children: Arc<RwLock<HashMap<String, ChildRun>>>,
    max_children_per_parent: usize,
    db: Option<Arc<SqlitePool>>,
}

impl SubagentManager {
    /// Create a manager.
    pub fn new(max_children_per_parent: usize) -> Self {
        Self {
            definitions: Arc::new(RwLock::new(HashMap::new())),
            children: Arc::new(RwLock::new(HashMap::new())),
            max_children_per_parent: max_children_per_parent.max(1),
            db: None,
        }
    }

    /// Open a SQLite-backed manager and recover definitions and child runs.
    pub async fn open(database_url: &str, max_children_per_parent: usize) -> Result<Self, String> {
        let db = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("agent database connection failed: {error}"))?;
        agenticos_sqlite_migrations::migrate(database_url).await.map_err(|error| format!("sqlite migrations failed: {error}"))?;

        let defs = sqlx::query_as::<_, (String, String)>(
            "SELECT agent_id, payload FROM agent_definitions",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("agent definition recovery failed: {error}"))?;
        let children = sqlx::query_as::<_, (String, String)>(
            "SELECT child_run_id, payload FROM agent_children",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("agent child recovery failed: {error}"))?;

        let mut definition_map = HashMap::with_capacity(defs.len());
        for (agent_id, payload) in defs {
            let definition: AgentDefinition = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted agent {agent_id}: {error}"))?;
            definition_map.insert(agent_id, definition);
        }

        let mut child_map = HashMap::with_capacity(children.len());
        for (child_run_id, payload) in children {
            let child: ChildRun = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted child {child_run_id}: {error}"))?;
            child_map.insert(child_run_id, child);
        }

        Ok(Self {
            definitions: Arc::new(RwLock::new(definition_map)),
            children: Arc::new(RwLock::new(child_map)),
            max_children_per_parent: max_children_per_parent.max(1),
            db: Some(Arc::new(db)),
        })
    }

    async fn persist_definition(&self, definition: &AgentDefinition) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(definition)
            .map_err(|error| format!("agent definition serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO agent_definitions (agent_id, payload) VALUES (?, ?) ON CONFLICT(agent_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&definition.agent_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("agent definition persistence failed: {error}"))?;
        Ok(())
    }

    async fn persist_child(&self, child: &ChildRun) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(child)
            .map_err(|error| format!("child serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO agent_children (child_run_id, payload) VALUES (?, ?) ON CONFLICT(child_run_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&child.child_run_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("child persistence failed: {error}"))?;
        Ok(())
    }

    /// Register an agent definition.
    pub async fn register(&self, definition: AgentDefinition) -> Result<(), String> {
        if definition.agent_id.trim().is_empty() || definition.role.trim().is_empty() {
            return Err("agent_id and role are required".to_string());
        }
        let agent_id = definition.agent_id.clone();
        let previous = self
            .definitions
            .write()
            .await
            .insert(agent_id.clone(), definition.clone());
        if let Err(error) = self.persist_definition(&definition).await {
            let mut definitions = self.definitions.write().await;
            match previous {
                Some(previous) => {
                    definitions.insert(agent_id, previous);
                }
                None => {
                    definitions.remove(&agent_id);
                }
            }
            return Err(error);
        }
        Ok(())
    }

    /// List definitions.
    pub async fn definitions(&self) -> Vec<AgentDefinition> {
        let mut definitions: Vec<_> = self.definitions.read().await.values().cloned().collect();
        definitions.sort_by(|left, right| left.agent_id.cmp(&right.agent_id));
        definitions
    }

    /// Return one registered agent definition.
    pub async fn definition(&self, agent_id: &str) -> Option<AgentDefinition> {
        self.definitions.read().await.get(agent_id).cloned()
    }

    /// Return one persisted child run.
    pub async fn child(&self, child_run_id: &str) -> Option<ChildRun> {
        self.children.read().await.get(child_run_id).cloned()
    }

    /// Spawn a bounded child run.
    pub async fn spawn_child(
        &self,
        parent_run_id: &str,
        agent_id: &str,
        parent_depth: u16,
    ) -> Result<ChildRun, String> {
        let definition = self
            .definitions
            .read()
            .await
            .get(agent_id)
            .cloned()
            .ok_or_else(|| format!("agent '{}' is not registered", agent_id))?;

        if parent_run_id.trim().is_empty() {
            return Err("parent_run_id is required".to_string());
        }
        if parent_depth >= definition.budget.max_depth {
            return Err("delegation depth budget exceeded".to_string());
        }

        let mut children = self.children.write().await;
        if children
            .values()
            .filter(|child| child.parent_run_id == parent_run_id)
            .count()
            >= self.max_children_per_parent
        {
            return Err("maximum child count reached".to_string());
        }

        let child = ChildRun {
            child_run_id: format!("run-{}", uuid::Uuid::new_v4()),
            parent_run_id: parent_run_id.to_string(),
            agent_id: agent_id.to_string(),
            depth: parent_depth + 1,
            budget: definition.budget.clone(),
        };
        children.insert(child.child_run_id.clone(), child.clone());
        drop(children);
        if let Err(error) = self.persist_child(&child).await {
            self.children.write().await.remove(&child.child_run_id);
            return Err(error);
        }
        Ok(child)
    }

    /// List child runs for a parent.
    pub async fn children_of(&self, parent_run_id: &str) -> Vec<ChildRun> {
        let mut children: Vec<_> = self
            .children
            .read()
            .await
            .values()
            .filter(|child| child.parent_run_id == parent_run_id)
            .cloned()
            .collect();
        children.sort_by(|left, right| left.child_run_id.cmp(&right.child_run_id));
        children
    }
}

impl Default for SubagentManager {
    fn default() -> Self {
        Self::new(16)
    }
}
