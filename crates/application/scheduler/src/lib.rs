#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Run/job scheduler with dependency-aware readiness.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-scheduler";

/// Job lifecycle.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum JobState {
    /// Waiting for dependencies.
    Pending,
    /// Ready to execute.
    Ready,
    /// Currently executing.
    Running,
    /// Finished successfully.
    Succeeded,
    /// Finished unsuccessfully.
    Failed,
    /// Cancelled before completion.
    Cancelled,
}

/// Durable job definition.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JobSpec {
    /// Stable job identifier.
    pub job_id: String,
    /// Parent run identifier.
    pub run_id: String,
    /// Human-readable task.
    pub task: String,
    /// Required predecessor job IDs.
    pub dependencies: Vec<String>,
    /// Priority, larger values run first.
    pub priority: i32,
    /// Maximum attempts.
    pub max_attempts: u32,
}

/// Job record maintained by the scheduler.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JobRecord {
    /// Job definition.
    pub spec: JobSpec,
    /// Current state.
    pub state: JobState,
    /// Number of starts.
    pub attempts: u32,
    /// Last error.
    pub last_error: Option<String>,
}

/// Dependency-aware scheduler for bounded run jobs.
#[derive(Debug, Clone)]
pub struct JobScheduler {
    jobs: Arc<RwLock<HashMap<String, JobRecord>>>,
    db: Option<Arc<SqlitePool>>,
}

impl JobScheduler {
    /// Create an empty scheduler.
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            db: None,
        }
    }

    /// Open a SQLite-backed scheduler and recover persisted jobs.
    pub async fn open(database_url: &str) -> Result<Self, String> {
        let db = SqlitePool::connect(database_url)
            .await
            .map_err(|error| format!("scheduler database connection failed: {error}"))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS scheduler_jobs (
                job_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                task TEXT NOT NULL,
                dependencies TEXT NOT NULL,
                priority INTEGER NOT NULL,
                max_attempts INTEGER NOT NULL,
                state TEXT NOT NULL,
                attempts INTEGER NOT NULL,
                last_error TEXT
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| format!("scheduler schema initialization failed: {error}"))?;

        let rows = sqlx::query_as::<_, (String, String, String, String, i32, i64, String, i64, Option<String>)>(
            "SELECT job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error FROM scheduler_jobs",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("scheduler recovery query failed: {error}"))?;

        let mut jobs = HashMap::with_capacity(rows.len());
        for (job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error) in rows {
            let dependencies: Vec<String> = serde_json::from_str(&dependencies)
                .map_err(|error| format!("scheduler dependencies are invalid for {job_id}: {error}"))?;
            let state = match state.as_str() {
                "Pending" => JobState::Pending,
                "Ready" => JobState::Ready,
                "Running" => JobState::Ready,
                "Succeeded" => JobState::Succeeded,
                "Failed" => JobState::Failed,
                "Cancelled" => JobState::Cancelled,
                other => return Err(format!("scheduler job {job_id} has unknown state {other}")),
            };
            jobs.insert(
                job_id.clone(),
                JobRecord {
                    spec: JobSpec {
                        job_id,
                        run_id,
                        task,
                        dependencies,
                        priority,
                        max_attempts: max_attempts as u32,
                    },
                    state,
                    attempts: attempts.max(0) as u32,
                    last_error,
                },
            );
        }

        Ok(Self {
            jobs: Arc::new(RwLock::new(jobs)),
            db: Some(Arc::new(db)),
        })
    }

    async fn persist(&self, record: &JobRecord) -> Result<(), String> {
        let Some(db) = &self.db else {
            return Ok(());
        };
        let dependencies = serde_json::to_string(&record.spec.dependencies)
            .map_err(|error| format!("scheduler dependencies serialization failed: {error}"))?;
        sqlx::query(
            r#"
            INSERT INTO scheduler_jobs
                (job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                run_id = excluded.run_id,
                task = excluded.task,
                dependencies = excluded.dependencies,
                priority = excluded.priority,
                max_attempts = excluded.max_attempts,
                state = excluded.state,
                attempts = excluded.attempts,
                last_error = excluded.last_error
            "#,
        )
        .bind(&record.spec.job_id)
        .bind(&record.spec.run_id)
        .bind(&record.spec.task)
        .bind(dependencies)
        .bind(record.spec.priority)
        .bind(record.spec.max_attempts.max(1) as i64)
        .bind(format!("{:?}", record.state))
        .bind(record.attempts as i64)
        .bind(record.last_error.as_deref())
        .execute(db)
        .await
        .map_err(|error| format!("scheduler persistence failed: {error}"))?;
        Ok(())
    }

    /// Add a job if the identifier is unique.
    pub async fn enqueue(&self, spec: JobSpec) -> Result<(), String> {
        if spec.job_id.trim().is_empty() || spec.run_id.trim().is_empty() {
            return Err("job_id and run_id are required".to_string());
        }
        if spec
            .dependencies
            .iter()
            .any(|dependency| dependency == &spec.job_id)
        {
            return Err("job cannot depend on itself".to_string());
        }
        if spec
            .dependencies
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            != spec.dependencies.len()
        {
            return Err("job dependencies must be unique".to_string());
        }
        let mut jobs = self.jobs.write().await;
        if jobs.contains_key(&spec.job_id) {
            return Err(format!("job '{}' already exists", spec.job_id));
        }
        let state = if spec.dependencies.is_empty() {
            JobState::Ready
        } else {
            JobState::Pending
        };
        let record = JobRecord {
            spec,
            state,
            attempts: 0,
            last_error: None,
        };
        jobs.insert(record.spec.job_id.clone(), record.clone());
        drop(jobs);
        self.persist(&record).await?;
        Ok(())
    }

    /// Return ready jobs whose dependencies have all succeeded.
    pub async fn next_ready(&self, limit: usize) -> Vec<JobRecord> {
        let jobs = self.jobs.read().await;
        let mut ready: Vec<JobRecord> = jobs
            .values()
            .filter(|record| {
                if !matches!(record.state, JobState::Ready | JobState::Pending) {
                    return false;
                }
                record.spec.dependencies.iter().all(|dependency| {
                    jobs.get(dependency)
                        .map(|record| record.state == JobState::Succeeded)
                        .unwrap_or(false)
                })
            })
            .cloned()
            .collect();
        ready.sort_by(|left, right| right.spec.priority.cmp(&left.spec.priority));
        ready.truncate(limit);
        ready
    }

    /// Claim a job for execution.
    pub async fn start(&self, job_id: &str) -> Result<JobRecord, String> {
        let mut jobs = self.jobs.write().await;
        let dependencies_satisfied = {
            let record = jobs
                .get(job_id)
                .ok_or_else(|| "job not found".to_string())?;
            record.spec.dependencies.iter().all(|dependency| {
                jobs.get(dependency)
                    .is_some_and(|job| job.state == JobState::Succeeded)
            })
        };
        let record = jobs
            .get_mut(job_id)
            .ok_or_else(|| "job not found".to_string())?;
        if !matches!(record.state, JobState::Pending | JobState::Ready) {
            return Err(format!("job cannot start from state {:?}", record.state));
        }
        if !dependencies_satisfied {
            return Err("job dependencies are not satisfied".to_string());
        }
        if record.attempts >= record.spec.max_attempts.max(1) {
            record.state = JobState::Failed;
            record.last_error = Some("maximum attempts reached".to_string());
            let result = record.clone();
            drop(jobs);
            self.persist(&result).await?;
            return Ok(result);
        }
        record.attempts += 1;
        record.state = JobState::Running;
        let result = record.clone();
        drop(jobs);
        self.persist(&result).await?;
        Ok(result)
    }

    /// Finish a job.
    pub async fn complete(
        &self,
        job_id: &str,
        success: bool,
        error: Option<String>,
    ) -> Result<(), String> {
        let mut jobs = self.jobs.write().await;
        let record = jobs
            .get_mut(job_id)
            .ok_or_else(|| "job not found".to_string())?;
        if record.state != JobState::Running {
            return Err(format!("job cannot complete from state {:?}", record.state));
        }
        record.state = if success {
            JobState::Succeeded
        } else if record.attempts < record.spec.max_attempts.max(1) {
            JobState::Ready
        } else {
            JobState::Failed
        };
        record.last_error = error;
        let result = record.clone();
        drop(jobs);
        self.persist(&result).await?;
        Ok(())
    }

    /// Cancel a job.
    pub async fn cancel(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self.jobs.write().await;
        let record = jobs
            .get_mut(job_id)
            .ok_or_else(|| "job not found".to_string())?;
        if matches!(
            record.state,
            JobState::Succeeded | JobState::Failed | JobState::Cancelled
        ) {
            return Err(format!(
                "job cannot be cancelled from state {:?}",
                record.state
            ));
        }
        record.state = JobState::Cancelled;
        let result = record.clone();
        drop(jobs);
        self.persist(&result).await?;
        Ok(())
    }

    /// Get one job by identifier.
    pub async fn get(&self, job_id: &str) -> Option<JobRecord> {
        self.jobs.read().await.get(job_id).cloned()
    }

    /// List scheduler state.
    pub async fn list(&self) -> Vec<JobRecord> {
        let mut jobs: Vec<_> = self.jobs.read().await.values().cloned().collect();
        jobs.sort_by(|left, right| left.spec.job_id.cmp(&right.spec.job_id));
        jobs
    }
}

impl Default for JobScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sqlite_scheduler_recovers_jobs_after_restart() {
        let path = std::env::temp_dir().join(format!("agenticos-scheduler-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let first = JobScheduler::open(&url).await.expect("open scheduler");
        first
            .enqueue(JobSpec {
                job_id: "durable-job".into(),
                run_id: "durable-run".into(),
                task: "persist me".into(),
                dependencies: vec![],
                priority: 10,
                max_attempts: 3,
            })
            .await
            .expect("enqueue durable job");
        first.start("durable-job").await.expect("start durable job");
        first
            .complete("durable-job", true, None)
            .await
            .expect("complete durable job");
        drop(first);

        let recovered = JobScheduler::open(&url).await.expect("reopen scheduler");
        let record = recovered.get("durable-job").await.expect("recover job");
        assert_eq!(record.state, JobState::Succeeded);
        assert_eq!(record.spec.task, "persist me");
        assert_eq!(record.attempts, 1);

        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn cancelling_running_job_is_terminal() {
        let scheduler = JobScheduler::new();
        scheduler
            .enqueue(JobSpec {
                job_id: "cancel-me".into(),
                run_id: "run".into(),
                task: "work".into(),
                dependencies: vec![],
                priority: 1,
                max_attempts: 3,
            })
            .await
            .unwrap();

        scheduler.start("cancel-me").await.unwrap();
        scheduler.cancel("cancel-me").await.unwrap();

        let record = scheduler.get("cancel-me").await.unwrap();
        assert_eq!(record.state, JobState::Cancelled);
        assert!(scheduler.start("cancel-me").await.is_err());
    }

    #[tokio::test]
    async fn dependency_aware_scheduler() {
        let scheduler = JobScheduler::new();
        scheduler
            .enqueue(JobSpec {
                job_id: "a".into(),
                run_id: "r".into(),
                task: "first".into(),
                dependencies: vec![],
                priority: 1,
                max_attempts: 2,
            })
            .await
            .unwrap();
        scheduler
            .enqueue(JobSpec {
                job_id: "b".into(),
                run_id: "r".into(),
                task: "second".into(),
                dependencies: vec!["a".into()],
                priority: 1,
                max_attempts: 2,
            })
            .await
            .unwrap();
        assert_eq!(scheduler.next_ready(10).await.len(), 1);
        scheduler.start("a").await.unwrap();
        scheduler.complete("a", true, None).await.unwrap();
        assert_eq!(scheduler.next_ready(10).await[0].spec.job_id, "b");
    }
}
