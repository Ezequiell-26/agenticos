#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable offline evaluation and replay scoring boundary.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use uuid::Uuid;

/// A reusable deterministic evaluation case.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct EvaluationCase {
    /// Stable case identifier.
    pub case_id: String,
    /// Human-readable case name.
    pub name: String,
    /// Input prompt or scenario.
    pub prompt: String,
    /// Strings expected in a passing output.
    pub expected_contains: Vec<String>,
    /// Optional labels used for filtering.
    pub tags: Vec<String>,
}

/// Stored result of an evaluation.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EvaluationResult {
    /// Unique evaluation result identifier.
    pub evaluation_id: String,
    /// Evaluation case identifier.
    pub case_id: String,
    /// Associated run identifier.
    pub run_id: String,
    /// Output evaluated.
    pub output: String,
    /// Whether every expectation matched.
    pub passed: bool,
    /// Number of matched expectations.
    pub matched: usize,
    /// Total expectations.
    pub total: usize,
    /// Deterministic score in [0,1].
    pub score: f64,
    /// Unix timestamp.
    pub created_at: u64,
}

/// Durable SQLite evaluation store.
#[derive(Clone, Debug)]
pub struct EvaluationStore {
    db: Arc<SqlitePool>,
}

impl EvaluationStore {
    /// Open the evaluation store and initialize its schema.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("evaluation database connection failed: {error}"))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS evaluation_cases (
                case_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| format!("evaluation case schema failed: {error}"))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS evaluation_results (
                evaluation_id TEXT PRIMARY KEY,
                case_id TEXT NOT NULL,
                run_id TEXT NOT NULL,
                output TEXT NOT NULL,
                passed INTEGER NOT NULL,
                matched INTEGER NOT NULL,
                total INTEGER NOT NULL,
                score REAL NOT NULL,
                created_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| format!("evaluation result schema failed: {error}"))?;

        Ok(Self { db: Arc::new(db) })
    }

    /// Insert or replace an evaluation case.
    pub async fn upsert_case(&self, case: EvaluationCase) -> Result<(), String> {
        validate_case(&case)?;
        let payload = serde_json::to_string(&case)
            .map_err(|error| format!("evaluation case serialization failed: {error}"))?;
        sqlx::query(
            "INSERT INTO evaluation_cases (case_id, payload) VALUES (?, ?) ON CONFLICT(case_id) DO UPDATE SET payload = excluded.payload",
        )
        .bind(&case.case_id)
        .bind(payload)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("evaluation case persistence failed: {error}"))?;
        Ok(())
    }

    /// List registered cases in stable order.
    pub async fn list_cases(&self) -> Result<Vec<EvaluationCase>, String> {
        let rows = sqlx::query_as::<_, (String, String)>(
            "SELECT case_id, payload FROM evaluation_cases ORDER BY case_id ASC",
        )
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("evaluation case query failed: {error}"))?;

        rows.into_iter()
            .map(|(_, payload)| {
                serde_json::from_str(&payload)
                    .map_err(|error| format!("invalid evaluation case: {error}"))
            })
            .collect()
    }

    /// Evaluate and persist one output against a registered case.
    pub async fn evaluate_and_record(
        &self,
        case_id: &str,
        run_id: &str,
        output: &str,
    ) -> Result<EvaluationResult, String> {
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT payload FROM evaluation_cases WHERE case_id = ?",
        )
        .bind(case_id)
        .fetch_optional(self.db.as_ref())
        .await
        .map_err(|error| format!("evaluation case lookup failed: {error}"))?
        .ok_or_else(|| format!("evaluation case not found: {case_id}"))?;

        let case: EvaluationCase = serde_json::from_str(&row.0)
            .map_err(|error| format!("invalid evaluation case: {error}"))?;
        let total = case.expected_contains.len();
        let matched = case
            .expected_contains
            .iter()
            .filter(|expected| output.contains(expected.as_str()))
            .count();
        let score = if total == 0 {
            1.0
        } else {
            matched as f64 / total as f64
        };
        let result = EvaluationResult {
            evaluation_id: format!("evaluation-{}", Uuid::new_v4()),
            case_id: case_id.to_string(),
            run_id: run_id.to_string(),
            output: output.to_string(),
            passed: matched == total,
            matched,
            total,
            score,
            created_at: unix_time(),
        };

        sqlx::query(
            "INSERT INTO evaluation_results (evaluation_id, case_id, run_id, output, passed, matched, total, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&result.evaluation_id)
        .bind(&result.case_id)
        .bind(&result.run_id)
        .bind(&result.output)
        .bind(if result.passed { 1_i64 } else { 0_i64 })
        .bind(result.matched as i64)
        .bind(result.total as i64)
        .bind(result.score)
        .bind(result.created_at as i64)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("evaluation result persistence failed: {error}"))?;

        Ok(result)
    }

    /// List recent evaluation results, newest first.
    pub async fn list_results(&self, limit: usize) -> Result<Vec<EvaluationResult>, String> {
        let limit = limit.clamp(1, 1_000) as i64;
        let rows = sqlx::query_as::<_, (String, String, String, String, i64, i64, i64, f64, i64)>(
            "SELECT evaluation_id, case_id, run_id, output, passed, matched, total, score, created_at FROM evaluation_results ORDER BY created_at DESC, evaluation_id DESC LIMIT ?",
        )
        .bind(limit)
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("evaluation result query failed: {error}"))?;

        rows.into_iter()
            .map(
                |(
                    evaluation_id,
                    case_id,
                    run_id,
                    output,
                    passed,
                    matched,
                    total,
                    score,
                    created_at,
                )| {
                    Ok(EvaluationResult {
                        evaluation_id,
                        case_id,
                        run_id,
                        output,
                        passed: passed != 0,
                        matched: matched.max(0) as usize,
                        total: total.max(0) as usize,
                        score,
                        created_at: created_at.max(0) as u64,
                    })
                },
            )
            .collect()
    }
}

fn validate_case(case: &EvaluationCase) -> Result<(), String> {
    if case.case_id.trim().is_empty() || case.case_id.len() > 128 {
        return Err("case_id must be 1..=128 characters".to_string());
    }
    if case.name.trim().is_empty() || case.name.len() > 256 {
        return Err("name must be 1..=256 characters".to_string());
    }
    if case.prompt.len() > 1_000_000 {
        return Err("prompt exceeds supported size".to_string());
    }
    if case.expected_contains.len() > 128 {
        return Err("too many evaluation expectations".to_string());
    }
    if case.expected_contains.iter().any(|value| value.is_empty()) {
        return Err("evaluation expectations must not be empty".to_string());
    }
    Ok(())
}

fn unix_time() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn case() -> EvaluationCase {
        EvaluationCase {
            case_id: "hello".to_string(),
            name: "Hello case".to_string(),
            prompt: "Say hello".to_string(),
            expected_contains: vec!["hello".to_string(), "world".to_string()],
            tags: vec!["basic".to_string()],
        }
    }

    #[tokio::test]
    async fn evaluation_case_and_result_survive_reopen() {
        let path = std::env::temp_dir().join(format!("agenticos-evaluation-{}.db", Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let store = EvaluationStore::open(&url).await.unwrap();
        store.upsert_case(case()).await.unwrap();
        let result = store
            .evaluate_and_record("hello", "run-1", "hello world")
            .await
            .unwrap();
        assert!(result.passed);
        assert_eq!(result.matched, 2);

        drop(store);
        let reopened = EvaluationStore::open(&url).await.unwrap();
        assert_eq!(reopened.list_cases().await.unwrap().len(), 1);
        assert_eq!(reopened.list_results(10).await.unwrap().len(), 1);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn partial_output_gets_fractional_score() {
        let path = std::env::temp_dir().join(format!("agenticos-evaluation-{}.db", Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let store = EvaluationStore::open(&url).await.unwrap();
        store.upsert_case(case()).await.unwrap();
        let result = store
            .evaluate_and_record("hello", "run-2", "hello only")
            .await
            .unwrap();
        assert!(!result.passed);
        assert_eq!(result.matched, 1);
        assert_eq!(result.total, 2);
        assert!((result.score - 0.5).abs() < f64::EPSILON);

        let _ = std::fs::remove_file(path);
    }
}
