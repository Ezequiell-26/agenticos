#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Multi-agent definitions, child-run isolation and bounded delegation.

use serde::{Deserialize, Serialize};
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
}

impl SubagentManager {
    /// Create a manager.
    pub fn new(max_children_per_parent: usize) -> Self {
        Self {
            definitions: Arc::new(RwLock::new(HashMap::new())),
            children: Arc::new(RwLock::new(HashMap::new())),
            max_children_per_parent: max_children_per_parent.max(1),
        }
    }

    /// Register an agent definition.
    pub async fn register(&self, definition: AgentDefinition) -> Result<(), String> {
        if definition.agent_id.trim().is_empty() || definition.role.trim().is_empty() {
            return Err("agent_id and role are required".to_string());
        }
        self.definitions
            .write()
            .await
            .insert(definition.agent_id.clone(), definition);
        Ok(())
    }

    /// List definitions.
    pub async fn definitions(&self) -> Vec<AgentDefinition> {
        let mut definitions: Vec<_> = self.definitions.read().await.values().cloned().collect();
        definitions.sort_by(|left, right| left.agent_id.cmp(&right.agent_id));
        definitions
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
