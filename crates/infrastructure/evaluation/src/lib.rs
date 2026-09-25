#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Deterministic replay/evaluation primitives for backend regression checks.
//!
//! This module implements RDD (Receipt-Driven Development) concepts adapted from gentle-ai:
//! - **Candidate Freezing**: Exact version is frozen before review
//! - **Depth-based Review**: Passive, medium, and high depth checks
//! - **Evidence Binding**: Review evidence is bound to the exact candidate version
//! - **Risk Assessment**: Read-only risk assessment determines review depth

use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Get current Unix timestamp in seconds.
fn unix_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

/// Architectural owner of this crate.
pub const OWNER: &str = "agenticos-evaluation";

/// Review depth levels adapted from gentle-ai RDD.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum ReviewDepth {
    /// Passive: structural readback with zero reviewer lenses.
    Passive,
    /// Medium: one focused lens on specific area.
    Medium,
    /// High: canonical 4R — Risk, Resilience, Readability and Reliability.
    High,
}

/// Frozen candidate for review (adapted from gentle-ai RDD).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReviewCandidate {
    /// Unique candidate identifier.
    pub candidate_id: String,
    /// Git commit SHA that this candidate represents.
    pub commit_sha: String,
    /// Files modified in this candidate.
    pub modified_files: Vec<String>,
    /// Timestamp when candidate was frozen.
    pub frozen_at: i64,
    /// Review depth assigned to this candidate.
    pub review_depth: ReviewDepth,
    /// Risk assessment score (0.0 = low risk, 1.0 = high risk).
    pub risk_score: f64,
}

/// Review receipt with evidence bound to exact candidate version.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReviewReceipt {
    /// Candidate identifier.
    pub candidate_id: String,
    /// Reviewer identifier (agent or human).
    pub reviewer_id: String,
    /// Timestamp of review.
    pub reviewed_at: i64,
    /// Whether review passed.
    pub passed: bool,
    /// Review depth used.
    pub review_depth: ReviewDepth,
    /// Review comments or findings.
    pub comments: Vec<String>,
    /// Corrections suggested (at most one bounded correction allowed).
    pub corrections: Vec<String>,
}

/// Risk assessment factors for determining review depth.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RiskAssessment {
    /// Number of files modified.
    pub file_count: usize,
    /// Lines changed.
    pub lines_changed: usize,
    /// Whether sensitive files are modified (config, secrets, etc).
    pub sensitive_files: bool,
    /// Whether core infrastructure is modified.
    pub core_infrastructure: bool,
    /// Estimated risk score (0.0-1.0).
    pub risk_score: f64,
}

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
    db: Option<Arc<SqlitePool>>,
}

impl EvaluationRegistry {
    /// Create an empty evaluation registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Assess risk for a change and determine appropriate review depth.
    pub fn assess_risk(
        file_count: usize,
        lines_changed: usize,
        sensitive_files: bool,
        core_infrastructure: bool,
    ) -> RiskAssessment {
        let mut risk_score = 0.0;

        // File count factor (0-0.3)
        risk_score += (file_count as f64 / 50.0).min(0.3);

        // Lines changed factor (0-0.3)
        risk_score += (lines_changed as f64 / 1000.0).min(0.3);

        // Sensitive files factor (0-0.2)
        if sensitive_files {
            risk_score += 0.2;
        }

        // Core infrastructure factor (0-0.2)
        if core_infrastructure {
            risk_score += 0.2;
        }

        RiskAssessment {
            file_count,
            lines_changed,
            sensitive_files,
            core_infrastructure,
            risk_score: risk_score.clamp(0.0, 1.0),
        }
    }

    /// Determine review depth based on risk assessment.
    pub fn determine_review_depth(risk_score: f64) -> ReviewDepth {
        if risk_score < 0.3 {
            ReviewDepth::Passive
        } else if risk_score < 0.7 {
            ReviewDepth::Medium
        } else {
            ReviewDepth::High
        }
    }

    /// Freeze a candidate for review (adapted from gentle-ai RDD).
    pub async fn freeze_candidate(
        &self,
        commit_sha: &str,
        modified_files: Vec<String>,
    ) -> Result<ReviewCandidate, String> {
        let assessment = Self::assess_risk(
            modified_files.len(),
            modified_files.len() * 10, // Estimate lines changed
            modified_files
                .iter()
                .any(|f| f.contains("config") || f.contains("secret") || f.contains("key")),
            modified_files
                .iter()
                .any(|f| f.contains("kernel") || f.contains("runtime") || f.contains("brain")),
        );

        let review_depth = Self::determine_review_depth(assessment.risk_score);

        let candidate = ReviewCandidate {
            candidate_id: format!("cand-{}", uuid::Uuid::new_v4()),
            commit_sha: commit_sha.to_string(),
            modified_files,
            frozen_at: unix_time() as i64,
            review_depth,
            risk_score: assessment.risk_score,
        };

        Ok(candidate)
    }

    /// Create a review receipt for a frozen candidate.
    pub async fn create_receipt(
        &self,
        candidate_id: &str,
        reviewer_id: &str,
        passed: bool,
        comments: Vec<String>,
        corrections: Vec<String>,
    ) -> ReviewReceipt {
        // In a full implementation, this would retrieve the candidate to get review_depth
        ReviewReceipt {
            candidate_id: candidate_id.to_string(),
            reviewer_id: reviewer_id.to_string(),
            reviewed_at: unix_time() as i64,
            passed,
            review_depth: ReviewDepth::Medium, // Default, would be retrieved from candidate
            comments,
            corrections,
        }
    }

    /// Open a SQLite-backed registry and recover cases/results.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("evaluation database connection failed: {error}"))?;
        agenticos_sqlite_migrations::migrate_pool(&db)
            .await
            .map_err(|error| format!("sqlite migrations failed: {error}"))?;

        let case_rows = sqlx::query_as::<_, (String, String)>(
            "SELECT case_id, payload FROM evaluation_cases ORDER BY case_id",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("evaluation case recovery failed: {error}"))?;
        let result_rows = sqlx::query_as::<_, (String, String)>(
            "SELECT case_id, payload FROM evaluation_results ORDER BY case_id",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("evaluation result recovery failed: {error}"))?;

        let mut cases = HashMap::with_capacity(case_rows.len());
        for (case_id, payload) in case_rows {
            let case = serde_json::from_str(&payload)
                .map_err(|error| format!("invalid persisted evaluation case {case_id}: {error}"))?;
            cases.insert(case_id, case);
        }
        let mut results = HashMap::with_capacity(result_rows.len());
        for (case_id, payload) in result_rows {
            let result = serde_json::from_str(&payload).map_err(|error| {
                format!("invalid persisted evaluation result {case_id}: {error}")
            })?;
            results.insert(case_id, result);
        }

        Ok(Self {
            cases: Arc::new(RwLock::new(cases)),
            results: Arc::new(RwLock::new(results)),
            db: Some(Arc::new(db)),
        })
    }

    async fn persist_case(&self, case: &EvaluationCase) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(case)
            .map_err(|error| format!("evaluation case serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO evaluation_cases (case_id, payload) VALUES (?, ?) ON CONFLICT(case_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&case.case_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("evaluation case persistence failed: {error}"))?;
        Ok(())
    }

    async fn persist_result(&self, result: &EvaluationResult) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let payload = serde_json::to_string(result)
            .map_err(|error| format!("evaluation result serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO evaluation_results (case_id, payload) VALUES (?, ?) ON CONFLICT(case_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&result.case_id)
        .bind(payload)
        .execute(db.as_ref())
        .await
        .map_err(|error| format!("evaluation result persistence failed: {error}"))?;
        Ok(())
    }

    /// Register or replace a case.
    pub async fn register(&self, case: EvaluationCase) -> Result<(), String> {
        if case.case_id.trim().is_empty() || case.case_id.len() > 128 {
            return Err("case_id must be 1..=128 characters".to_string());
        }
        if case.objective.trim().is_empty() {
            return Err("objective is required".to_string());
        }
        let previous = self
            .cases
            .write()
            .await
            .insert(case.case_id.clone(), case.clone());
        if let Err(error) = self.persist_case(&case).await {
            let mut cases = self.cases.write().await;
            match previous {
                Some(previous) => {
                    cases.insert(case.case_id.clone(), previous);
                }
                None => {
                    cases.remove(&case.case_id);
                }
            }
            return Err(error);
        }
        Ok(())
    }

    /// List registered cases in stable order.
    pub async fn list_cases(&self) -> Vec<EvaluationCase> {
        let mut cases: Vec<_> = self.cases.read().await.values().cloned().collect();
        cases.sort_by(|left, right| left.case_id.cmp(&right.case_id));
        cases
    }

    /// Evaluate a registered case and persist its latest result.
    pub async fn evaluate(&self, case_id: &str, output: &str) -> Result<EvaluationResult, String> {
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
        let previous = self
            .results
            .write()
            .await
            .insert(case_id.to_string(), result.clone());

        if let Err(error) = self.persist_result(&result).await {
            let mut results = self.results.write().await;
            match previous {
                Some(previous) => {
                    results.insert(case_id.to_string(), previous);
                }
                None => {
                    results.remove(case_id);
                }
            }
            return Err(error);
        }

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
            .evaluate(&case(), &format!("hello {}", "x".repeat(120)))
            .unwrap();

        assert!(!result.passed);
        assert_eq!(result.matched_fragments, 1);
        assert!(result.exceeded_output_limit);
        assert!(result.score < 1.0);
    }

    #[tokio::test]
    async fn persisted_result_survives_reopen() {
        let path =
            std::env::temp_dir().join(format!("agenticos-eval-result-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let first = EvaluationRegistry::open(&url).await.unwrap();
        first.register(case()).await.unwrap();
        first.evaluate("basic", "hello agent").await.unwrap();
        drop(first);

        let second = EvaluationRegistry::open(&url).await.unwrap();
        assert_eq!(second.result("basic").await.unwrap().case_id, "basic");
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn registry_recovers_cases_and_results() {
        let path =
            std::env::temp_dir().join(format!("agenticos-evaluation-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let first = EvaluationRegistry::open(&url).await.unwrap();
        first.register(case()).await.unwrap();
        first.evaluate("basic", "hello agent").await.unwrap();
        drop(first);
        let second = EvaluationRegistry::open(&url).await.unwrap();
        assert_eq!(second.list_cases().await.len(), 1);
        assert_eq!(second.result("basic").await.unwrap().score, 1.0);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn replay_evaluation_is_repeatable_for_identical_input() {
        let evaluator = ReplayEvaluator::new();
        let case = case();
        let first = evaluator.evaluate(&case, "HELLO agent").unwrap();
        let second = evaluator.evaluate(&case, "HELLO agent").unwrap();

        assert_eq!(first, second);
        assert_eq!(first.score, 1.0);
    }

    #[tokio::test]
    async fn registry_replacement_changes_future_evaluations_without_losing_identity() {
        let registry = EvaluationRegistry::new();
        registry.register(case()).await.unwrap();
        registry.evaluate("basic", "hello agent").await.unwrap();

        let replacement = EvaluationCase {
            case_id: "basic".to_string(),
            objective: "new objective".to_string(),
            required_fragments: vec!["replacement".to_string()],
            max_output_chars: Some(100),
        };
        registry.register(replacement).await.unwrap();

        let result = registry.evaluate("basic", "replacement").await.unwrap();
        assert!(result.passed);
        assert_eq!(result.case_id, "basic");
        assert_eq!(result.total_fragments, 1);
    }

    #[test]
    fn replay_evaluator_treats_empty_requirements_as_a_valid_full_pass() {
        let case = EvaluationCase {
            case_id: "empty".to_string(),
            objective: "noop".to_string(),
            required_fragments: Vec::new(),
            max_output_chars: None,
        };

        let result = ReplayEvaluator::new().evaluate(&case, "").unwrap();
        assert!(result.passed);
        assert_eq!(result.score, 1.0);
        assert_eq!(result.matched_fragments, 0);
        assert_eq!(result.total_fragments, 0);
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
