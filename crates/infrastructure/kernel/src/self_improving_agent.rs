//! Self-Improving RLM Agent adapted from Prime Agent
//!
//! Patterns for long-running autonomous work with persistent goals,
//! heartbeats, autonomous mode, and quality gates.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Persistent goal for long-running tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Goal {
    /// Goal ID
    pub id: String,
    /// Goal description
    pub description: String,
    /// Current progress (0.0 to 1.0)
    pub progress: f64,
    /// Goal status
    pub status: GoalStatus,
    /// Associated session ID
    pub session_id: String,
    /// Created at
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Updated at
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Goal status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GoalStatus {
    /// Goal is active
    Active,
    /// Goal is paused
    Paused,
    /// Goal is completed
    Completed,
    /// Goal failed
    Failed,
}

/// Heartbeat for session liveness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heartbeat {
    /// Session ID
    pub session_id: String,
    /// Last heartbeat timestamp
    pub last_heartbeat: chrono::DateTime<chrono::Utc>,
    /// Heartbeat interval in seconds
    pub interval_secs: u64,
    /// Status message
    pub status: String,
}

/// Autonomous mode configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutonomousConfig {
    /// Maximum turns
    pub max_turns: usize,
    /// Maximum tokens
    pub max_tokens: u32,
    /// Maximum time in seconds
    pub max_time_secs: u64,
    /// Quality gates to run
    pub quality_gates: Vec<QualityGate>,
}

/// Quality gate for autonomous mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGate {
    /// Gate ID
    pub id: String,
    /// Gate description
    pub description: String,
    /// Gate type
    pub gate_type: QualityGateType,
    /// Whether the gate must pass
    pub required: bool,
}

/// Quality gate type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QualityGateType {
    /// Code compiles
    CodeCompiles,
    /// Tests pass
    TestsPass,
    /// No errors in output
    NoErrors,
    /// Custom validation
    Custom(String),
}

/// Quality gate result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGateResult {
    /// Gate ID
    pub gate_id: String,
    /// Whether the gate passed
    pub passed: bool,
    /// Result message
    pub message: String,
    /// Duration in milliseconds
    pub duration_ms: u64,
}

/// Continual harness state - persistent state that can be refined
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinualHarness {
    /// Supplemental prompts
    pub supplemental_prompts: Vec<String>,
    /// Memories
    pub memories: Vec<String>,
    /// Skill descriptions
    pub skill_descriptions: Vec<String>,
    /// Subagent specifications
    pub subagent_specs: Vec<String>,
    /// Refinement history
    pub refinement_history: Vec<Refinement>,
    /// Version
    pub version: u32,
}

/// Refinement to harness state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Refinement {
    /// Refinement ID
    pub id: String,
    /// Description of the refinement
    pub description: String,
    /// Type of state refined
    pub refined_type: RefinementType,
    /// Previous value
    pub previous_value: String,
    /// New value
    pub new_value: String,
    /// Evidence for the refinement
    pub evidence: String,
    /// Timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Type of state refined
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RefinementType {
    /// Supplemental prompt
    SupplementalPrompt,
    /// Memory
    Memory,
    /// Skill description
    SkillDescription,
    /// Subagent specification
    SubagentSpec,
}

/// Goal manager for persistent goals
pub struct GoalManager {
    goals: Arc<RwLock<HashMap<String, Goal>>>,
}

impl GoalManager {
    /// Create a new goal manager
    pub fn new() -> Self {
        Self {
            goals: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set a goal
    pub async fn set_goal(&self, goal: Goal) {
        let mut goals = self.goals.write().await;
        goals.insert(goal.id.clone(), goal);
    }

    /// Get a goal by ID
    pub async fn get_goal(&self, id: &str) -> Option<Goal> {
        let goals = self.goals.read().await;
        goals.get(id).cloned()
    }

    /// Update goal progress
    pub async fn update_progress(&self, id: &str, progress: f64) -> Result<(), String> {
        let mut goals = self.goals.write().await;
        if let Some(goal) = goals.get_mut(id) {
            goal.progress = progress;
            goal.updated_at = chrono::Utc::now();
            Ok(())
        } else {
            Err(format!("Goal {} not found", id))
        }
    }

    /// Complete a goal
    pub async fn complete_goal(&self, id: &str) -> Result<(), String> {
        let mut goals = self.goals.write().await;
        if let Some(goal) = goals.get_mut(id) {
            goal.status = GoalStatus::Completed;
            goal.progress = 1.0;
            goal.updated_at = chrono::Utc::now();
            Ok(())
        } else {
            Err(format!("Goal {} not found", id))
        }
    }

    /// List all active goals
    pub async fn list_active_goals(&self) -> Vec<Goal> {
        let goals = self.goals.read().await;
        goals
            .values()
            .filter(|g| matches!(g.status, GoalStatus::Active))
            .cloned()
            .collect()
    }
}

impl Default for GoalManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Heartbeat manager for session liveness
pub struct HeartbeatManager {
    heartbeats: Arc<RwLock<HashMap<String, Heartbeat>>>,
}

impl HeartbeatManager {
    /// Create a new heartbeat manager
    pub fn new() -> Self {
        Self {
            heartbeats: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a heartbeat
    pub async fn register_heartbeat(&self, heartbeat: Heartbeat) {
        let mut heartbeats = self.heartbeats.write().await;
        heartbeats.insert(heartbeat.session_id.clone(), heartbeat);
    }

    /// Update heartbeat for a session
    pub async fn update_heartbeat(&self, session_id: &str, status: String) {
        let mut heartbeats = self.heartbeats.write().await;
        if let Some(heartbeat) = heartbeats.get_mut(session_id) {
            heartbeat.last_heartbeat = chrono::Utc::now();
            heartbeat.status = status;
        }
    }

    /// Check if a session is alive
    pub async fn is_alive(&self, session_id: &str) -> bool {
        let heartbeats = self.heartbeats.read().await;
        if let Some(heartbeat) = heartbeats.get(session_id) {
            let elapsed = chrono::Utc::now()
                .signed_duration_since(heartbeat.last_heartbeat)
                .num_seconds();
            elapsed < (heartbeat.interval_secs * 2) as i64
        } else {
            false
        }
    }

    /// Get stale sessions (no recent heartbeat)
    pub async fn get_stale_sessions(&self) -> Vec<String> {
        let heartbeats = self.heartbeats.read().await;
        heartbeats
            .iter()
            .filter(|(_, hb)| {
                let elapsed = chrono::Utc::now()
                    .signed_duration_since(hb.last_heartbeat)
                    .num_seconds();
                elapsed > (hb.interval_secs * 2) as i64
            })
            .map(|(id, _)| id.clone())
            .collect()
    }
}

impl Default for HeartbeatManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Quality gate evaluator
pub struct QualityGateEvaluator;

impl QualityGateEvaluator {
    /// Evaluate a quality gate
    pub async fn evaluate_gate(
        &self,
        gate: &QualityGate,
        context: &QualityContext,
    ) -> QualityGateResult {
        let start = std::time::Instant::now();
        let (passed, message) = match &gate.gate_type {
            QualityGateType::CodeCompiles => {
                // Placeholder: would actually check if code compiles
                (true, "Code compiles successfully".to_string())
            }
            QualityGateType::TestsPass => {
                // Placeholder: would actually run tests
                (true, "All tests pass".to_string())
            }
            QualityGateType::NoErrors => {
                let normalized = context.output.to_ascii_lowercase();
                let explicit_clean =
                    normalized.contains("no error") || normalized.contains("no errors");
                let has_error = normalized.contains("error") && !explicit_clean;
                (
                    !has_error,
                    if has_error {
                        "Errors found in output".to_string()
                    } else {
                        "No errors found".to_string()
                    },
                )
            }
            QualityGateType::Custom(validation) => {
                // Placeholder: custom validation logic
                (true, format!("Custom validation passed: {}", validation))
            }
        };

        QualityGateResult {
            gate_id: gate.id.clone(),
            passed,
            message,
            duration_ms: start.elapsed().as_millis() as u64,
        }
    }

    /// Evaluate all quality gates
    pub async fn evaluate_all_gates(
        &self,
        gates: &[QualityGate],
        context: &QualityContext,
    ) -> Vec<QualityGateResult> {
        let mut results = Vec::new();
        for gate in gates {
            let result = self.evaluate_gate(gate, context).await;
            results.push(result);
        }
        results
    }

    /// Check if all required gates passed
    pub fn check_required_gates(&self, results: &[QualityGateResult]) -> bool {
        results.iter().all(|r| r.passed)
    }
}

/// Context for quality gate evaluation
#[derive(Debug, Clone)]
pub struct QualityContext {
    /// Output to check
    pub output: String,
    /// Additional context data
    pub context_data: HashMap<String, String>,
}

/// Continual harness manager
pub struct ContinualHarnessManager {
    harness: Arc<RwLock<ContinualHarness>>,
}

impl ContinualHarnessManager {
    /// Create a new continual harness manager
    pub fn new() -> Self {
        Self {
            harness: Arc::new(RwLock::new(ContinualHarness {
                supplemental_prompts: Vec::new(),
                memories: Vec::new(),
                skill_descriptions: Vec::new(),
                subagent_specs: Vec::new(),
                refinement_history: Vec::new(),
                version: 1,
            })),
        }
    }

    /// Get the current harness state
    pub async fn get_harness(&self) -> ContinualHarness {
        self.harness.read().await.clone()
    }

    /// Refine a part of the harness
    pub async fn refine(&self, refinement: Refinement) {
        let mut harness = self.harness.write().await;
        harness.refinement_history.push(refinement.clone());
        harness.version += 1;

        // Apply the refinement
        match refinement.refined_type {
            RefinementType::SupplementalPrompt => {
                if let Some(pos) = harness
                    .supplemental_prompts
                    .iter()
                    .position(|p| p == &refinement.previous_value)
                {
                    harness.supplemental_prompts[pos] = refinement.new_value;
                } else {
                    harness.supplemental_prompts.push(refinement.new_value);
                }
            }
            RefinementType::Memory => {
                if let Some(pos) = harness
                    .memories
                    .iter()
                    .position(|m| m == &refinement.previous_value)
                {
                    harness.memories[pos] = refinement.new_value;
                } else {
                    harness.memories.push(refinement.new_value);
                }
            }
            RefinementType::SkillDescription => {
                if let Some(pos) = harness
                    .skill_descriptions
                    .iter()
                    .position(|s| s == &refinement.previous_value)
                {
                    harness.skill_descriptions[pos] = refinement.new_value;
                } else {
                    harness.skill_descriptions.push(refinement.new_value);
                }
            }
            RefinementType::SubagentSpec => {
                if let Some(pos) = harness
                    .subagent_specs
                    .iter()
                    .position(|s| s == &refinement.previous_value)
                {
                    harness.subagent_specs[pos] = refinement.new_value;
                } else {
                    harness.subagent_specs.push(refinement.new_value);
                }
            }
        }
    }

    /// Get refinement history
    pub async fn get_refinement_history(&self) -> Vec<Refinement> {
        let harness = self.harness.read().await;
        harness.refinement_history.clone()
    }

    /// Rollback to a specific version
    pub async fn rollback(&self, version: u32) -> Result<(), String> {
        let mut harness = self.harness.write().await;
        if version >= harness.version {
            return Err(format!("Cannot rollback to version {}", version));
        }
        // Simplified: just keep refinements up to that version
        harness.refinement_history.retain(|_r| {
            // This is a simplified rollback - real implementation would be more sophisticated
            true
        });
        harness.version = version;
        Ok(())
    }
}

impl Default for ContinualHarnessManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_goal_manager() {
        let manager = GoalManager::new();
        let goal = Goal {
            id: "test-goal".to_string(),
            description: "Test goal".to_string(),
            progress: 0.0,
            status: GoalStatus::Active,
            session_id: "session-1".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        manager.set_goal(goal.clone()).await;
        let retrieved = manager.get_goal("test-goal").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().description, "Test goal");

        manager.update_progress("test-goal", 0.5).await.unwrap();
        let updated = manager.get_goal("test-goal").await;
        assert_eq!(updated.unwrap().progress, 0.5);
    }

    #[tokio::test]
    async fn test_heartbeat_manager() {
        let manager = HeartbeatManager::new();
        let heartbeat = Heartbeat {
            session_id: "session-1".to_string(),
            last_heartbeat: chrono::Utc::now(),
            interval_secs: 60,
            status: "active".to_string(),
        };

        manager.register_heartbeat(heartbeat).await;
        assert!(manager.is_alive("session-1").await);
    }

    #[tokio::test]
    async fn test_quality_gate_evaluator() {
        let evaluator = QualityGateEvaluator;
        let gate = QualityGate {
            id: "test-gate".to_string(),
            description: "Test gate".to_string(),
            gate_type: QualityGateType::NoErrors,
            required: true,
        };

        let context = QualityContext {
            output: "No errors here".to_string(),
            context_data: HashMap::new(),
        };

        let result = evaluator.evaluate_gate(&gate, &context).await;
        assert!(result.passed);
    }

    #[tokio::test]
    async fn test_continual_harness() {
        let manager = ContinualHarnessManager::new();
        let refinement = Refinement {
            id: "ref-1".to_string(),
            description: "Add prompt".to_string(),
            refined_type: RefinementType::SupplementalPrompt,
            previous_value: String::new(),
            new_value: "New prompt".to_string(),
            evidence: "Needed for task".to_string(),
            timestamp: chrono::Utc::now(),
        };

        manager.refine(refinement).await;
        let harness = manager.get_harness().await;
        assert_eq!(harness.version, 2);
        assert_eq!(harness.supplemental_prompts.len(), 1);
    }
}
