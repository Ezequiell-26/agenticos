#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Workflow DAG validation and execution-state tracking.

use serde::{Deserialize, Serialize};
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
    /// Per-node state.
    pub nodes: HashMap<String, WorkflowNodeState>,
}

/// In-memory workflow engine with deterministic DAG validation.
#[derive(Clone, Debug, Default)]
pub struct WorkflowEngine {
    workflows: Arc<RwLock<HashMap<String, WorkflowDefinition>>>,
}

impl WorkflowEngine {
    /// Create an empty workflow engine.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register and validate a workflow.
    pub async fn register(&self, workflow: WorkflowDefinition) -> Result<(), String> {
        validate_workflow(&workflow)?;
        self.workflows
            .write()
            .await
            .insert(workflow.workflow_id.clone(), workflow);
        Ok(())
    }

    /// Get a workflow.
    pub async fn get(&self, workflow_id: &str) -> Option<WorkflowDefinition> {
        self.workflows.read().await.get(workflow_id).cloned()
    }

    /// List workflows.
    pub async fn list(&self) -> Vec<WorkflowDefinition> {
        self.workflows.read().await.values().cloned().collect()
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
        Ok(WorkflowState {
            workflow_id: workflow.workflow_id,
            nodes: workflow
                .nodes
                .into_iter()
                .map(|node| (node.id, WorkflowNodeState::Pending))
                .collect(),
        })
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
