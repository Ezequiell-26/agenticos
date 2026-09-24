#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Deterministic replay/evaluation primitives for backend regression checks.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Architectural owner of this crate.
pub const OWNER: &str = "agenticos-evaluation";

/// A deterministic evaluation case for an agent objective/output pair.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct EvaluationCase {
    /// Stable evaluation identifier.
    pub case_id: String,
    /// Objective presented to the agent.
    pub objective: String,
    /// Output fragments that must all be present for a full pass.
    #[serde(default)]
    pub required_fragments: Vec<String>,
    /// Maximum output length accepted by the case.
    pub max_output_chars: Option<usize>,
}

/// Evaluation result produced without invoking an LLM.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct EvaluationResult {
    /// Evaluation case identifier.
    pub case_id: String,
    /// Whether every configured requirement passed.
    pub passed: bool,
    /// Deterministic score in the range 0..=1.
    pub score: f64,
    /// Number of required fragments satisfied.
    pub matched_fragments: usize,
    /// Number of required fragments configured.
    pub total_fragments: usize,
    /// Requirements not satisfied.
    pub missing_fragments: Vec<String>,
    /// Whether the output length exceeded the configured limit.
    pub exceeded_output_limit: bool,
}

/// Pure evaluator for deterministic replay checks.
#[derive(Clone, Copy, Debug, Default)]
pub struct ReplayEvaluator;

impl ReplayEvaluator {
    /// Create a replay evaluator.
    pub const fn new() -> Self {
        Self
    }

    /// Evaluate an output against a case.
    pub fn evaluate(
        &self,
        case: &EvaluationCase,
        output: &str,
    ) -> Result<EvaluationResult, String> {
        if case.case_id.trim().is_empty() {
            return Err("case_id is required".to_string());
        }
        if case.objective.trim().is_empty() {
            return Err("objective is required".to_string());
        }

        let normalized_output = output.to_ascii_lowercase();
        let mut missing_fragments = Vec::new();
        let mut matched_fragments = 0usize;

        for fragment in &case.required_fragments {
            let fragment = fragment.trim();
            if fragment.is_empty() {
                continue;
            }
            if normalized_output.contains(&fragment.to_ascii_lowercase()) {
                matched_fragments += 1;
            } else {
                missing_fragments.push(fragment.to_string());
            }
        }

        let total_fragments = case
            .required_fragments
            .iter()
            .filter(|value| !value.trim().is_empty())
            .count();
        let exceeded_output_limit = case
            .max_output_chars
            .is_some_and(|limit| output.chars().count() > limit);

        let fragment_score = if total_fragments == 0 {
            1.0
        } else {
            matched_fragments as f64 / total_fragments as f64
        };
        let score = if exceeded_output_limit {
            (fragment_score * 0.5).clamp(0.0, 1.0)
        } else {
            fragment_score
        };

        Ok(EvaluationResult {
            case_id: case.case_id.clone(),
            passed: missing_fragments.is_empty() && !exceeded_output_limit,
            score,
            matched_fragments,
            total_fragments,
            missing_fragments,
            exceeded_output_limit,
        })
    }
}

/// In-memory case registry for interactive regression/replay sessions.
#[derive(Clone, Debug, Default)]
pub struct EvaluationRegistry {
    cases: Arc<RwLock<HashMap<String, EvaluationCase>>>,
    results: Arc<RwLock<HashMap<String, EvaluationResult>>>,
}

impl EvaluationRegistry {
    /// Create an empty evaluation registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register or replace a case.
    pub async fn register(&self, case: EvaluationCase) -> Result<(), String> {
        if case.case_id.trim().is_empty() || case.case_id.len() > 128 {
            return Err("case_id must be 1..=128 characters".to_string());
        }
        if case.objective.trim().is_empty() {
            return Err("objective is required".to_string());
        }
        self.cases
            .write()
            .await
            .insert(case.case_id.clone(), case);
        Ok(())
    }

    /// List registered cases in stable order.
    pub async fn list_cases(&self) -> Vec<EvaluationCase> {
        let mut cases: Vec<_> = self.cases.read().await.values().cloned().collect();
        cases.sort_by(|left, right| left.case_id.cmp(&right.case_id));
        cases
    }

    /// Evaluate a registered case and persist its latest result.
    pub async fn evaluate(
        &self,
        case_id: &str,
        output: &str,
    ) -> Result<EvaluationResult, String> {
        let case = self
            .cases
            .read()
            .await
            .get(case_id)
            .cloned()
            .ok_or_else(|| format!("evaluation case '{case_id}' not found"))?;

        let result = ReplayEvaluator::new()
            .evaluate(&case, output)
            .map_err(|error| error.to_string())?;
        self.results
            .write()
            .await
            .insert(case_id.to_string(), result.clone());
        Ok(result)
    }

    /// Return the latest result for a case.
    pub async fn result(&self, case_id: &str) -> Option<EvaluationResult> {
        self.results.read().await.get(case_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn case() -> EvaluationCase {
        EvaluationCase {
            case_id: "basic".to_string(),
            objective: "answer the objective".to_string(),
            required_fragments: vec!["hello".to_string(), "agent".to_string()],
            max_output_chars: Some(100),
        }
    }

    #[test]
    fn replay_evaluator_scores_required_fragments_deterministically() {
        let result = ReplayEvaluator::new()
            .evaluate(&case(), "Hello agent")
            .unwrap();

        assert!(result.passed);
        assert_eq!(result.matched_fragments, 2);
        assert_eq!(result.total_fragments, 2);
        assert_eq!(result.score, 1.0);
    }

    #[test]
    fn replay_evaluator_rejects_missing_fragment_and_oversized_output() {
        let result = ReplayEvaluator::new()
            .evaluate(
                &case(),
                &format!("hello {}", "x".repeat(120)),
            )
            .unwrap();

        assert!(!result.passed);
        assert_eq!(result.matched_fragments, 1);
        assert!(result.exceeded_output_limit);
        assert!(result.score < 1.0);
    }

    #[tokio::test]
    async fn registry_evaluates_and_keeps_latest_result() {
        let registry = EvaluationRegistry::new();
        registry.register(case()).await.unwrap();

        let result = registry.evaluate("basic", "hello agent").await.unwrap();
        assert!(result.passed);

        let latest = registry.result("basic").await.unwrap();
        assert_eq!(latest.case_id, "basic");
        assert_eq!(latest.score, 1.0);
    }
}
