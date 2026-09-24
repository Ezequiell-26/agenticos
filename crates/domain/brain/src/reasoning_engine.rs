//! Deterministic reasoning and planning primitives.

#![allow(missing_docs)]

use super::{BrainError, CapabilityId};
use std::collections::HashSet;

/// Reasoning & Planning Engine.
#[derive(Debug)]
pub struct ReasoningEngine {
    planner: Planner,
    evaluator: Evaluator,
    selector: CapabilitySelector,
}

/// Planner for bounded multi-step reasoning.
#[derive(Debug)]
pub struct Planner {
    max_steps: usize,
}

/// Evaluator for deterministic plan risk/cost checks.
#[derive(Debug)]
pub struct Evaluator {
    enable_learning: bool,
}

/// Capability selector.
#[derive(Debug)]
pub struct CapabilitySelector {
    strategy: SelectionStrategy,
}

/// Selection strategy.
#[derive(Debug, Clone)]
pub enum SelectionStrategy {
    Greedy,
    Balanced,
    Exploration,
}

/// Reasoning plan.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ReasoningPlan {
    pub steps: Vec<PlanStep>,
    pub estimated_cost: PlanCost,
    pub confidence: f64,
}

/// Plan step.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlanStep {
    pub id: String,
    pub action: String,
    pub required_capabilities: Vec<CapabilityId>,
    pub estimated_tokens: u64,
}

/// Plan cost.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PlanCost {
    pub tokens: u64,
    pub monetary: f64,
    pub time_seconds: u64,
}

impl ReasoningEngine {
    /// Create a reasoning engine.
    pub fn new(config: EngineConfig) -> Self {
        Self {
            planner: Planner {
                max_steps: config.max_steps.max(1),
            },
            evaluator: Evaluator {
                enable_learning: config.enable_learning,
            },
            selector: CapabilitySelector {
                strategy: config.selection_strategy,
            },
        }
    }

    /// Generate a bounded plan from an objective.
    pub async fn generate_plan(&self, objective: &str) -> Result<ReasoningPlan, BrainError> {
        let objective = objective.trim();
        if objective.is_empty() {
            return Err(BrainError::ReasoningEngineError(
                "objective must not be empty".to_string(),
            ));
        }

        let clauses: Vec<&str> = objective
            .split(['.', ';', '\n'])
            .map(str::trim)
            .filter(|clause| !clause.is_empty())
            .take(self.planner.max_steps)
            .collect();

        let mut steps = Vec::new();
        for (index, clause) in clauses.iter().enumerate() {
            let capabilities = infer_capabilities(clause);
            steps.push(PlanStep {
                id: format!("step-{}", index + 1),
                action: clause.to_string(),
                required_capabilities: capabilities,
                estimated_tokens: (clause.split_whitespace().count() as u64 * 8).clamp(32, 2048),
            });
        }

        if steps.is_empty() {
            steps.push(PlanStep {
                id: "step-1".to_string(),
                action: objective.to_string(),
                required_capabilities: infer_capabilities(objective),
                estimated_tokens: (objective.split_whitespace().count() as u64 * 8).clamp(32, 2048),
            });
        }

        let tokens = steps.iter().map(|step| step.estimated_tokens).sum();
        Ok(ReasoningPlan {
            confidence: if steps.len() == 1 { 0.85 } else { 0.75 },
            steps,
            estimated_cost: PlanCost {
                tokens,
                monetary: 0.0,
                time_seconds: tokens.div_ceil(512).max(1),
            },
        })
    }

    /// Re-plan using textual feedback.
    pub async fn re_plan(
        &self,
        plan: ReasoningPlan,
        feedback: &str,
    ) -> Result<ReasoningPlan, BrainError> {
        let feedback = feedback.trim();
        if feedback.is_empty() {
            return Ok(plan);
        }
        let mut revised = plan;
        revised.steps.push(PlanStep {
            id: format!("step-{}", revised.steps.len() + 1),
            action: format!("Incorporate feedback: {feedback}"),
            required_capabilities: infer_capabilities(feedback),
            estimated_tokens: (feedback.split_whitespace().count() as u64 * 8).clamp(32, 1024),
        });
        revised.steps.truncate(self.planner.max_steps);
        revised.estimated_cost.tokens =
            revised.steps.iter().map(|step| step.estimated_tokens).sum();
        revised.estimated_cost.time_seconds = revised.estimated_cost.tokens.div_ceil(512).max(1);
        revised.confidence = (revised.confidence * 0.9).clamp(0.0, 1.0);
        Ok(revised)
    }

    /// Select unique capabilities required by a plan.
    pub async fn select_capabilities(
        &self,
        steps: &[PlanStep],
    ) -> Result<Vec<CapabilityId>, BrainError> {
        let mut selected = Vec::new();
        let mut seen = HashSet::new();
        for step in steps {
            for capability in &step.required_capabilities {
                if seen.insert(capability.clone()) {
                    selected.push(capability.clone());
                }
            }
        }
        if matches!(self.selector.strategy, SelectionStrategy::Exploration) {
            selected.sort();
        }
        Ok(selected)
    }

    /// Evaluate a plan for risk and operational fit.
    pub async fn evaluate(&self, plan: &ReasoningPlan) -> Result<EvaluationResult, BrainError> {
        if plan.steps.is_empty() {
            return Err(BrainError::ReasoningEngineError(
                "plan has no steps".to_string(),
            ));
        }
        let mut details = Vec::new();
        let mut high_risk = false;
        let mut medium_risk = false;
        for step in &plan.steps {
            let lower = step.action.to_ascii_lowercase();
            if [
                "delete",
                "remove",
                "publish",
                "deploy",
                "send money",
                "credential",
            ]
            .iter()
            .any(|keyword| lower.contains(keyword))
            {
                high_risk = true;
                details.push(format!("high-impact action detected in {}", step.id));
            } else if ["write", "execute", "shell", "network", "external"]
                .iter()
                .any(|keyword| lower.contains(keyword))
            {
                medium_risk = true;
                details.push(format!("external side effect detected in {}", step.id));
            }
        }
        if self.evaluator.enable_learning {
            details.push("evaluation uses adaptive-runtime hooks when enabled".to_string());
        }
        let score = if high_risk {
            0.45
        } else if medium_risk {
            0.7
        } else {
            0.9
        };
        Ok(EvaluationResult {
            score,
            risk_assessment: RiskAssessment {
                low_risk: !medium_risk && !high_risk,
                medium_risk,
                high_risk,
                details,
            },
            recommendations: if high_risk {
                vec!["require explicit approval before side effects".to_string()]
            } else if medium_risk {
                vec!["execute through the policy and sandbox boundaries".to_string()]
            } else {
                vec!["continue with normal verification gates".to_string()]
            },
        })
    }
}

/// Engine configuration.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Maximum planning steps.
    pub max_steps: usize,
    /// Whether evaluation learning hooks are enabled.
    pub enable_learning: bool,
    /// Capability selection strategy.
    pub selection_strategy: SelectionStrategy,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            max_steps: 10,
            enable_learning: true,
            selection_strategy: SelectionStrategy::Balanced,
        }
    }
}

/// Plan evaluation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EvaluationResult {
    pub score: f64,
    pub risk_assessment: RiskAssessment,
    pub recommendations: Vec<String>,
}

/// Risk assessment.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RiskAssessment {
    pub low_risk: bool,
    pub medium_risk: bool,
    pub high_risk: bool,
    pub details: Vec<String>,
}

fn infer_capabilities(text: &str) -> Vec<CapabilityId> {
    let lower = text.to_ascii_lowercase();
    let mut capabilities = Vec::new();
    if [
        "code",
        "rust",
        "typescript",
        "python",
        "bug",
        "test",
        "repo",
    ]
    .iter()
    .any(|keyword| lower.contains(keyword))
    {
        capabilities.push("code".to_string());
    }
    if ["search", "research", "docs", "web"]
        .iter()
        .any(|keyword| lower.contains(keyword))
    {
        capabilities.push("research".to_string());
    }
    if ["file", "write", "edit", "create"]
        .iter()
        .any(|keyword| lower.contains(keyword))
    {
        capabilities.push("filesystem".to_string());
    }
    if ["run", "command", "shell", "terminal", "execute"]
        .iter()
        .any(|keyword| lower.contains(keyword))
    {
        capabilities.push("process.execute".to_string());
    }
    if capabilities.is_empty() {
        capabilities.push("reasoning".to_string());
    }
    capabilities
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn generates_and_evaluates_plan() {
        let engine = ReasoningEngine::new(EngineConfig::default());
        let plan = engine
            .generate_plan("inspect the rust repo and run tests")
            .await
            .unwrap();
        assert!(!plan.steps.is_empty());
        assert!(plan.estimated_cost.tokens > 0);
        let evaluation = engine.evaluate(&plan).await.unwrap();
        assert!(evaluation.score > 0.0);
    }
}
