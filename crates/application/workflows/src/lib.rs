#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Workflow DAG validation and execution-state tracking.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-workflows";

/// Workflow node.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowNode {
    /// Node identifier.
    pub id: String,
    /// Human-readable task.
    pub task: String,
    /// Dependencies.
    pub depends_on: Vec<String>,
}

/// Workflow definition.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    /// Stable workflow identifier.
    pub workflow_id: String,
    /// Display name.
    pub name: String,
    /// Nodes.
    pub nodes: Vec<WorkflowNode>,
}

/// Workflow node status.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkflowNodeState {
    /// Waiting for prerequisites.
    Pending,
    /// Ready to execute.
    Ready,
    /// Running.
    Running,
    /// Succeeded.
    Succeeded,
    /// Failed.
    Failed,
}

/// Runtime workflow state.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowState {
    /// Workflow identifier.
    pub workflow_id: String,
    /// Optimistic state version.
    #[serde(default)]
    pub version: u64,
    /// Per-node state.
    pub nodes: HashMap<String, WorkflowNodeState>,
}

/// In-memory workflow engine with deterministic DAG validation.
#[derive(Clone, Debug, Default)]
pub struct WorkflowEngine {
    workflows: Arc<RwLock<HashMap<String, WorkflowDefinition>>>,
    states: Arc<RwLock<HashMap<String, WorkflowState>>>,
    db: Option<Arc<SqlitePool>>,
}

impl WorkflowEngine {
    /// Create an empty workflow engine.
    pub fn new() -> Self {
        Self::default()
    }

    /// Open a SQLite-backed workflow engine and recover definitions/state.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("workflow database connection failed: {error}"))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS workflow_definitions (workflow_id TEXT PRIMARY KEY, payload TEXT NOT NULL)",
        )
        .execute(&db)
        .await
        .map_err(|error| format!("workflow definition schema failed: {error}"))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS workflow_states (workflow_id TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0)",
        )
        .execute(&db)
        .await
        .map_err(|error| format!("workflow state schema failed: {error}"))?;

        let state_columns =
            sqlx::query_as::<_, (String,)>("SELECT name FROM pragma_table_info('workflow_states')")
                .fetch_all(&db)
                .await
                .map_err(|error| format!("workflow state schema inspection failed: {error}"))?;
        if !state_columns.iter().any(|(name,)| name == "version") {
            sqlx::query("ALTER TABLE workflow_states ADD COLUMN version INTEGER NOT NULL DEFAULT 0")
                .execute(&db)
                .await
                .map_err(|error| format!("workflow state version migration failed: {error}"))?;
        }

        let definitions = sqlx::query_as::<_, (String, String)>(
            "SELECT workflow_id, payload FROM workflow_definitions",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("workflow recovery query failed: {error}"))?;
        let states = sqlx::query_as::<_, (String, String, i64)>(
            "SELECT workflow_id, payload, version FROM workflow_states",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("workflow state recovery query failed: {error}"))?;

        let mut workflow_map = HashMap::with_capacity(definitions.len());
        for (workflow_id, payload) in definitions {
            let workflow: WorkflowDefinition = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted workflow {workflow_id}: {error}"))?;
            validate_workflow(&workflow)?;
            workflow_map.insert(workflow_id, workflow);
        }

        let mut state_map = HashMap::with_capacity(states.len());
        for (workflow_id, payload, version) in states {
            let mut state: WorkflowState = serde_json::from_str(&payload).map_err(|error| {
                format!("invalid persisted workflow state {workflow_id}: {error}")
            })?;
            state.version = version.max(0) as u64;
            state_map.insert(workflow_id, state);
        }

        Ok(Self {
            workflows: Arc::new(RwLock::new(workflow_map)),
            states: Arc::new(RwLock::new(state_map)),
            db: Some(Arc::new(db)),
        })
    }

    async fn persist_definition(&self, workflow: &WorkflowDefinition) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(workflow)
            .map_err(|error| format!("workflow serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO workflow_definitions (workflow_id, payload) VALUES (?, ?) ON CONFLICT(workflow_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&workflow.workflow_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("workflow definition persistence failed: {error}"))?;
        Ok(())
    }

    async fn persist_state(&self, state: &WorkflowState) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(state)
            .map_err(|error| format!("workflow state serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO workflow_states (workflow_id, payload, version) VALUES (?, ?, ?) ON CONFLICT(workflow_id) DO UPDATE SET payload = excluded.payload, version = excluded.version",
        )
        .bind(&state.workflow_id)
        .bind(payload)
        .bind(state.version as i64)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("workflow state persistence failed: {error}"))?;
        Ok(())
    }

    /// Register and validate a workflow.
    pub async fn register(&self, workflow: WorkflowDefinition) -> Result<(), String> {
        validate_workflow(&workflow)?;
        let workflow_id = workflow.workflow_id.clone();
        let previous = self
            .workflows
            .write()
            .await
            .insert(workflow_id.clone(), workflow.clone());
        if let Err(error) = self.persist_definition(&workflow).await {
            let mut workflows = self.workflows.write().await;
            match previous {
                Some(previous) => {
                    workflows.insert(workflow_id, previous);
                }
                None => {
                    workflows.remove(&workflow_id);
                }
            }
            return Err(error);
        }
        Ok(())
    }

    /// Get a workflow.
    pub async fn get(&self, workflow_id: &str) -> Option<WorkflowDefinition> {
        self.workflows.read().await.get(workflow_id).cloned()
    }

    /// List workflows.
    pub async fn list(&self) -> Vec<WorkflowDefinition> {
        let mut workflows: Vec<_> = self.workflows.read().await.values().cloned().collect();
        workflows.sort_by(|left, right| left.workflow_id.cmp(&right.workflow_id));
        workflows
    }

    /// Return the durable current state for a workflow, if one exists.
    pub async fn state(&self, workflow_id: &str) -> Option<WorkflowState> {
        self.states.read().await.get(workflow_id).cloned()
    }

    /// Transition one workflow node after validating its state and dependencies.
    pub async fn transition_node(
        &self,
        workflow_id: &str,
        state: &mut WorkflowState,
        node_id: &str,
        next: WorkflowNodeState,
    ) -> Result<(), String> {
        if state.workflow_id != workflow_id {
            return Err("workflow state belongs to a different workflow".to_string());
        }
        let workflow = self
            .get(workflow_id)
            .await
            .ok_or_else(|| "workflow not found".to_string())?;
        let node = workflow
            .nodes
            .iter()
            .find(|candidate| candidate.id == node_id)
            .ok_or_else(|| "workflow node not found".to_string())?;

        let current = state
            .nodes
            .get(node_id)
            .ok_or_else(|| "workflow state is missing node".to_string())?
            .clone();

        let valid = match (&current, &next) {
            (WorkflowNodeState::Pending, WorkflowNodeState::Ready) => {
                node.depends_on.iter().all(|dependency| {
                    state.nodes.get(dependency) == Some(&WorkflowNodeState::Succeeded)
                })
            }
            (WorkflowNodeState::Ready, WorkflowNodeState::Running) => true,
            (WorkflowNodeState::Running, WorkflowNodeState::Succeeded)
            | (WorkflowNodeState::Running, WorkflowNodeState::Failed) => true,
            _ => false,
        };

        if !valid {
            return Err(format!(
                "invalid workflow node transition {:?} -> {:?}",
                current, next
            ));
        }

        let previous_state = state.clone();
        state.nodes.insert(node_id.to_string(), next);
        state.version = state.version.saturating_add(1);

        if let Some(db) = &self.db {
            let previous_version = previous_state.version;
            let payload = serde_json::to_string(state)
                .map_err(|error| format!("workflow state serialization failed: {error}"))?;
            let updated = sqlx::query(
                "UPDATE workflow_states SET payload = ?, version = ? WHERE workflow_id = ? AND version = ?",
            )
            .bind(&payload)
            .bind(state.version as i64)
            .bind(workflow_id)
            .bind(previous_version as i64)
            .execute(db.as_ref())
            .await
            .map_err(|error| format!("workflow state persistence failed: {error}"))?;

            if updated.rows_affected() != 1 {
                *state = previous_state;
                return Err(format!(
                    "workflow state concurrency check failed at version {}",
                    previous_version
                ));
            }
        } else if let Err(error) = self.persist_state(state).await {
            *state = previous_state;
            return Err(error);
        }

        self.states
            .write()
            .await
            .insert(workflow_id.to_string(), state.clone());
        Ok(())
    }

    /// Calculate the next runnable nodes.
    pub async fn ready_nodes(
        &self,
        workflow_id: &str,
        state: &WorkflowState,
    ) -> Result<Vec<WorkflowNode>, String> {
        let workflow = self
            .get(workflow_id)
            .await
            .ok_or_else(|| "workflow not found".to_string())?;
        let mut ready = Vec::new();
        for node in workflow.nodes {
            if state.nodes.get(&node.id) != Some(&WorkflowNodeState::Pending)
                && state.nodes.get(&node.id) != Some(&WorkflowNodeState::Ready)
            {
                continue;
            }
            if node.depends_on.iter().all(|dependency| {
                state
                    .nodes
                    .get(dependency)
                    .is_some_and(|status| *status == WorkflowNodeState::Succeeded)
            }) {
                ready.push(node);
            }
        }
        Ok(ready)
    }

    /// Create initial state for a registered workflow.
    pub async fn initial_state(&self, workflow_id: &str) -> Result<WorkflowState, String> {
        let workflow = self
            .get(workflow_id)
            .await
            .ok_or_else(|| "workflow not found".to_string())?;
        if let Some(existing) = self.state(workflow_id).await {
            return Ok(existing);
        }
        let state = WorkflowState {
            workflow_id: workflow.workflow_id,
            version: 0,
            nodes: workflow
                .nodes
                .into_iter()
                .map(|node| (node.id, WorkflowNodeState::Pending))
                .collect(),
        };
        self.persist_state(&state).await?;
        self.states
            .write()
            .await
            .insert(state.workflow_id.clone(), state.clone());
        Ok(state)
    }
}

fn validate_workflow(workflow: &WorkflowDefinition) -> Result<(), String> {
    if workflow.workflow_id.trim().is_empty() || workflow.nodes.is_empty() {
        return Err("workflow_id and at least one node are required".to_string());
    }
    let ids: HashSet<String> = workflow.nodes.iter().map(|node| node.id.clone()).collect();
    if ids.len() != workflow.nodes.len() {
        return Err("workflow contains duplicate node IDs".to_string());
    }
    for node in &workflow.nodes {
        for dependency in &node.depends_on {
            if dependency == &node.id {
                return Err(format!("node '{}' depends on itself", node.id));
            }
            if !ids.contains(dependency) {
                return Err(format!("missing dependency '{}'", dependency));
            }
        }
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    for node in &workflow.nodes {
        if has_cycle(&node.id, workflow, &mut visiting, &mut visited) {
            return Err("workflow contains a dependency cycle".to_string());
        }
    }
    Ok(())
}

fn has_cycle(
    node_id: &str,
    workflow: &WorkflowDefinition,
    visiting: &mut HashSet<String>,
    visited: &mut HashSet<String>,
) -> bool {
    if visited.contains(node_id) {
        return false;
    }
    if !visiting.insert(node_id.to_string()) {
        return true;
    }
    let result = workflow
        .nodes
        .iter()
        .find(|node| node.id == node_id)
        .map(|node| {
            node.depends_on
                .iter()
                .any(|dependency| has_cycle(dependency, workflow, visiting, visited))
        })
        .unwrap_or(false);
    visiting.remove(node_id);
    visited.insert(node_id.to_string());
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn workflow_dag_is_validated() {
        let engine = WorkflowEngine::new();
        engine
            .register(WorkflowDefinition {
                workflow_id: "wf".into(),
                name: "demo".into(),
                nodes: vec![
                    WorkflowNode {
                        id: "a".into(),
                        task: "A".into(),
                        depends_on: vec![],
                    },
                    WorkflowNode {
                        id: "b".into(),
                        task: "B".into(),
                        depends_on: vec!["a".into()],
                    },
                ],
            })
            .await
            .unwrap();
        let state = engine.initial_state("wf").await.unwrap();
        assert_eq!(engine.ready_nodes("wf", &state).await.unwrap()[0].id, "a");
    }

    #[tokio::test]
    async fn workflow_node_transitions_are_guarded() {
        let engine = WorkflowEngine::new();
        engine
            .register(WorkflowDefinition {
                workflow_id: "wf".into(),
                name: "transition test".into(),
                nodes: vec![
                    WorkflowNode {
                        id: "a".into(),
                        task: "A".into(),
                        depends_on: vec![],
                    },
                    WorkflowNode {
                        id: "b".into(),
                        task: "B".into(),
                        depends_on: vec!["a".into()],
                    },
                ],
            })
            .await
            .unwrap();

        let mut state = engine.initial_state("wf").await.unwrap();
        assert!(engine
            .transition_node("wf", &mut state, "b", WorkflowNodeState::Ready)
            .await
            .is_err());
        engine
            .transition_node("wf", &mut state, "a", WorkflowNodeState::Ready)
            .await
            .unwrap();
        engine
            .transition_node("wf", &mut state, "a", WorkflowNodeState::Running)
            .await
            .unwrap();
        engine
            .transition_node("wf", &mut state, "a", WorkflowNodeState::Succeeded)
            .await
            .unwrap();
        engine
            .transition_node("wf", &mut state, "b", WorkflowNodeState::Ready)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn workflow_cycles_are_rejected() {
        let engine = WorkflowEngine::new();
        let result = engine
            .register(WorkflowDefinition {
                workflow_id: "bad".into(),
                name: "bad".into(),
                nodes: vec![
                    WorkflowNode {
                        id: "a".into(),
                        task: "A".into(),
                        depends_on: vec!["b".into()],
                    },
                    WorkflowNode {
                        id: "b".into(),
                        task: "B".into(),
                        depends_on: vec!["a".into()],
                    },
                ],
            })
            .await;
        assert!(result.is_err());
    }
}
