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
    /// Current lease owner.
    pub lease_owner: Option<String>,
    /// Monotonic fencing token for the current claim.
    pub lease_token: u64,
    /// Lease expiration as Unix seconds.
    pub lease_expires_at: u64,
}

/// Dependency-aware scheduler for bounded run jobs.
#[derive(Debug, Clone)]
pub struct JobScheduler {
    jobs: Arc<RwLock<HashMap<String, JobRecord>>>,
    db: Option<Arc<SqlitePool>>,
}

impl JobScheduler {
    /// Create an in-memory scheduler without durable storage.
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
                last_error TEXT,
                lease_owner TEXT,
                lease_token INTEGER NOT NULL DEFAULT 0,
                lease_expires_at INTEGER NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&db)
        .await
        .map_err(|error| format!("scheduler schema initialization failed: {error}"))?;

        let columns =
            sqlx::query_as::<_, (String,)>("SELECT name FROM pragma_table_info('scheduler_jobs')")
                .fetch_all(&db)
                .await
                .map_err(|error| format!("scheduler schema inspection failed: {error}"))?;
        let has_column = |name: &str| columns.iter().any(|(column,)| column == name);
        if !has_column("lease_owner") {
            sqlx::query("ALTER TABLE scheduler_jobs ADD COLUMN lease_owner TEXT")
                .execute(&db)
                .await
                .map_err(|error| format!("scheduler lease owner migration failed: {error}"))?;
        }
        if !has_column("lease_token") {
            sqlx::query(
                "ALTER TABLE scheduler_jobs ADD COLUMN lease_token INTEGER NOT NULL DEFAULT 0",
            )
            .execute(&db)
            .await
            .map_err(|error| format!("scheduler lease token migration failed: {error}"))?;
        }
        if !has_column("lease_expires_at") {
            sqlx::query(
                "ALTER TABLE scheduler_jobs ADD COLUMN lease_expires_at INTEGER NOT NULL DEFAULT 0",
            )
            .execute(&db)
            .await
            .map_err(|error| format!("scheduler lease expiry migration failed: {error}"))?;
        }

        let rows = sqlx::query_as::<_, (String, String, String, String, i32, i64, String, i64, Option<String>, Option<String>, i64, i64)>(
            "SELECT job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error, lease_owner, lease_token, lease_expires_at FROM scheduler_jobs",
        )
        .fetch_all(&db)
        .await
        .map_err(|error| format!("scheduler recovery query failed: {error}"))?;

        let mut jobs = HashMap::with_capacity(rows.len());
        for (
            job_id,
            run_id,
            task,
            dependencies,
            priority,
            max_attempts,
            state,
            attempts,
            last_error,
            lease_owner,
            lease_token,
            lease_expires_at,
        ) in rows
        {
            let dependencies: Vec<String> =
                serde_json::from_str(&dependencies).map_err(|error| {
                    format!("scheduler dependencies are invalid for {job_id}: {error}")
                })?;
            let state = match state.as_str() {
                "Pending" => JobState::Pending,
                "Ready" => JobState::Ready,
                "Running" if lease_expires_at.max(0) as u64 <= unix_time() => JobState::Ready,
                "Running" => JobState::Running,
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
                    lease_owner,
                    lease_token: lease_token.max(0) as u64,
                    lease_expires_at: lease_expires_at.max(0) as u64,
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
                (job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error, lease_owner, lease_token, lease_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                run_id = excluded.run_id,
                task = excluded.task,
                dependencies = excluded.dependencies,
                priority = excluded.priority,
                max_attempts = excluded.max_attempts,
                state = excluded.state,
                attempts = excluded.attempts,
                last_error = excluded.last_error,
                lease_owner = excluded.lease_owner,
                lease_token = excluded.lease_token,
                lease_expires_at = excluded.lease_expires_at
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
        .bind(record.lease_owner.as_deref())
        .bind(record.lease_token as i64)
        .bind(record.lease_expires_at as i64)
        .execute(db.as_ref())
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
            lease_owner: None,
            lease_token: 0,
            lease_expires_at: 0,
        };
        let job_id = record.spec.job_id.clone();
        jobs.insert(job_id.clone(), record.clone());
        drop(jobs);
        if let Err(error) = self.persist(&record).await {
            self.jobs.write().await.remove(&job_id);
            return Err(error);
        }
        Ok(())
    }

    /// Return ready jobs whose dependencies have all succeeded.
    pub async fn next_ready(&self, limit: usize) -> Vec<JobRecord> {
        let jobs = self.jobs.read().await;
        let now = unix_time();
        let mut ready: Vec<JobRecord> = jobs
            .values()
            .filter(|record| {
                let claimable = matches!(record.state, JobState::Ready | JobState::Pending)
                    || (record.state == JobState::Running && record.lease_expires_at <= now);
                if !claimable {
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

    /// Claim a job for execution using a stable local owner.
    pub async fn start(&self, job_id: &str) -> Result<JobRecord, String> {
        self.start_as(job_id, "local-scheduler".to_string(), 30)
            .await
    }

    /// Claim a job with an owner lease and fencing token.
    pub async fn start_as(
        &self,
        job_id: &str,
        owner_id: String,
        lease_seconds: u64,
    ) -> Result<JobRecord, String> {
        if owner_id.trim().is_empty() {
            return Err("lease owner is required".to_string());
        }

        let mut jobs = self.jobs.write().await;
        if let Some(db) = &self.db {
            let row = sqlx::query_as::<_, (String, i64, Option<String>, i64, i64)>(
                "SELECT state, attempts, lease_owner, lease_token, lease_expires_at FROM scheduler_jobs WHERE job_id = ?",
            )
            .bind(job_id)
            .fetch_optional(db.as_ref())
            .await
            .map_err(|error| format!("scheduler claim preflight failed: {error}"))?;

            if let Some((state, attempts, lease_owner, lease_token, lease_expires_at)) = row {
                let now = unix_time();
                let db_claimable = matches!(state.as_str(), "Ready" | "Pending")
                    || (state == "Running" && lease_expires_at.max(0) as u64 <= now);
                if !db_claimable {
                    return Err("job is already owned by another worker".to_string());
                }
                if let Some(local) = jobs.get_mut(job_id) {
                    local.state = match state.as_str() {
                        "Pending" => JobState::Pending,
                        "Ready" => JobState::Ready,
                        "Running" => JobState::Running,
                        "Succeeded" => JobState::Succeeded,
                        "Failed" => JobState::Failed,
                        "Cancelled" => JobState::Cancelled,
                        other => return Err(format!("unknown scheduler state {other}")),
                    };
                    local.attempts = attempts.max(0) as u32;
                    local.lease_owner = lease_owner;
                    local.lease_token = lease_token.max(0) as u64;
                    local.lease_expires_at = lease_expires_at.max(0) as u64;
                }
            }
        }

        let dependencies_satisfied = {
            let record = jobs
                .get(job_id)
                .ok_or_else(|| "job not found".to_string())?;
            record.spec.dependencies.iter().all(|dependency| {
                jobs.get(dependency)
                    .is_some_and(|job| job.state == JobState::Succeeded)
            })
        };
        let previous = jobs
            .get(job_id)
            .cloned()
            .ok_or_else(|| "job not found".to_string())?;
        let now = unix_time();
        let expired_lease = previous.state == JobState::Running && previous.lease_expires_at <= now;
        if !matches!(previous.state, JobState::Pending | JobState::Ready) && !expired_lease {
            return Err(format!("job cannot start from state {:?}", previous.state));
        }
        if !dependencies_satisfied {
            return Err("job dependencies are not satisfied".to_string());
        }
        if previous.attempts >= previous.spec.max_attempts.max(1) {
            let mut result = previous.clone();
            result.state = JobState::Failed;
            result.last_error = Some("maximum attempts reached".to_string());
            result.lease_owner = None;
            result.lease_expires_at = 0;
            drop(jobs);
            self.persist(&result).await?;
            self.jobs
                .write()
                .await
                .insert(result.spec.job_id.clone(), result.clone());
            return Ok(result);
        }

        let next_attempt = previous.attempts.saturating_add(1);
        let lease_token = next_attempt as u64;
        let lease_expires_at = now.saturating_add(lease_seconds.max(1));

        if let Some(db) = &self.db {
            let result = sqlx::query(
                "UPDATE scheduler_jobs SET state = 'Running', attempts = ?, lease_owner = ?, lease_token = ?, lease_expires_at = ?, last_error = NULL WHERE job_id = ? AND (state IN ('Ready', 'Pending') OR (state = 'Running' AND lease_expires_at <= ?)) AND attempts < ?",
            )
            .bind(next_attempt as i64)
            .bind(&owner_id)
            .bind(lease_token as i64)
            .bind(lease_expires_at as i64)
            .bind(job_id)
            .bind(now as i64)
            .bind(previous.spec.max_attempts.max(1) as i64)
            .execute(db.as_ref())
            .await
            .map_err(|error| format!("scheduler claim persistence failed: {error}"))?;

            if result.rows_affected() != 1 {
                return Err("job was claimed by another worker".to_string());
            }
        }

        let mut result = previous;
        result.attempts = next_attempt;
        result.state = JobState::Running;
        result.lease_owner = Some(owner_id);
        result.lease_token = lease_token;
        result.lease_expires_at = lease_expires_at;
        jobs.insert(job_id.to_string(), result.clone());
        Ok(result)
    }

    /// Renew an active lease while preserving ownership through its fencing token.
    pub async fn renew_as(
        &self,
        job_id: &str,
        owner_id: &str,
        lease_token: u64,
        lease_seconds: u64,
    ) -> Result<JobRecord, String> {
        if owner_id.trim().is_empty() {
            return Err("lease owner is required".to_string());
        }

        let mut jobs = self.jobs.write().await;
        let previous = jobs
            .get(job_id)
            .cloned()
            .ok_or_else(|| "job not found".to_string())?;

        if previous.state != JobState::Running {
            return Err(format!(
                "job cannot renew from state {:?}",
                previous.state
            ));
        }
        if previous.lease_owner.as_deref() != Some(owner_id)
            || previous.lease_token != lease_token
        {
            return Err("job lease ownership lost".to_string());
        }

        let now = unix_time();
        if previous.lease_expires_at <= now {
            return Err("job lease already expired".to_string());
        }

        let next_expiration = now.saturating_add(lease_seconds.max(1));

        if let Some(db) = &self.db {
            let updated = sqlx::query(
                "UPDATE scheduler_jobs SET lease_expires_at = ? WHERE job_id = ? AND state = 'Running' AND lease_owner = ? AND lease_token = ? AND lease_expires_at > ?",
            )
            .bind(next_expiration as i64)
            .bind(job_id)
            .bind(owner_id)
            .bind(lease_token as i64)
            .bind(now as i64)
            .execute(db.as_ref())
            .await
            .map_err(|error| format!("scheduler lease renewal persistence failed: {error}"))?;

            if updated.rows_affected() != 1 {
                return Err("job lease ownership lost before renewal".to_string());
            }
        }

        let mut result = previous;
        result.lease_expires_at = next_expiration;
        jobs.insert(job_id.to_string(), result.clone());
        Ok(result)
    }

    /// Finish a job without lease validation (primarily for single-process callers).
    pub async fn complete(
        &self,
        job_id: &str,
        success: bool,
        error: Option<String>,
    ) -> Result<(), String> {
        let lease = self
            .get(job_id)
            .await
            .and_then(|record| record.lease_owner.zip(Some(record.lease_token)));
        self.complete_as(
            job_id,
            lease.as_ref().map(|(owner, _)| owner.as_str()),
            lease.as_ref().map(|(_, token)| *token),
            success,
            error,
        )
        .await
    }

    /// Finish a job only when the caller owns the current lease.
    pub async fn complete_as(
        &self,
        job_id: &str,
        owner_id: Option<&str>,
        lease_token: Option<u64>,
        success: bool,
        error: Option<String>,
    ) -> Result<(), String> {
        let mut jobs = self.jobs.write().await;
        let previous = jobs
            .get(job_id)
            .cloned()
            .ok_or_else(|| "job not found".to_string())?;
        if previous.state != JobState::Running {
            return Err(format!(
                "job cannot complete from state {:?}",
                previous.state
            ));
        }

        if let (Some(expected_owner), Some(expected_token), Some(current_owner)) =
            (owner_id, lease_token, previous.lease_owner.as_deref())
        {
            if current_owner != expected_owner || previous.lease_token != expected_token {
                return Err("job lease ownership lost".to_string());
            }
        }

        let next_state = if success {
            JobState::Succeeded
        } else if previous.attempts < previous.spec.max_attempts.max(1) {
            JobState::Ready
        } else {
            JobState::Failed
        };

        let mut result = previous.clone();
        result.state = next_state;
        result.last_error = error;
        result.lease_owner = None;
        result.lease_expires_at = 0;

        if let Some(db) = &self.db {
            let current_owner = previous.lease_owner.as_deref().unwrap_or("");
            let expected_token = lease_token.unwrap_or(previous.lease_token);
            let sql = "UPDATE scheduler_jobs SET state = ?, last_error = ?, lease_owner = NULL, lease_expires_at = 0 WHERE job_id = ? AND state = 'Running' AND lease_owner = ? AND lease_token = ?";
            let updated = sqlx::query(sql)
                .bind(format!("{:?}", result.state))
                .bind(result.last_error.as_deref())
                .bind(job_id)
                .bind(current_owner)
                .bind(expected_token as i64)
                .execute(db.as_ref())
                .await
                .map_err(|error| format!("scheduler completion persistence failed: {error}"))?;
            if updated.rows_affected() != 1 {
                return Err("job lease ownership lost before completion".to_string());
            }
        }

        jobs.insert(job_id.to_string(), result);
        Ok(())
    }

    /// Cancel a job.
    pub async fn cancel(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self.jobs.write().await;
        let previous = jobs
            .get(job_id)
            .cloned()
            .ok_or_else(|| "job not found".to_string())?;
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
        record.lease_owner = None;
        record.lease_expires_at = 0;
        let result = record.clone();
        drop(jobs);
        if let Some(db) = &self.db {
            let updated = sqlx::query(
                "UPDATE scheduler_jobs SET state = 'Cancelled', lease_owner = NULL, lease_expires_at = 0 WHERE job_id = ? AND state NOT IN ('Succeeded', 'Failed', 'Cancelled')",
            )
            .bind(job_id)
            .execute(db.as_ref())
            .await
            .map_err(|error| format!("scheduler cancellation persistence failed: {error}"))?;
            if updated.rows_affected() != 1 {
                self.jobs
                    .write()
                    .await
                    .insert(result.spec.job_id.clone(), previous);
                return Err("job cancellation lost a concurrent state transition".to_string());
            }
        }
        if let Err(error) = self.persist(&result).await {
            self.jobs
                .write()
                .await
                .insert(result.spec.job_id.clone(), previous);
            return Err(error);
        }
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
        let path =
            std::env::temp_dir().join(format!("agenticos-scheduler-{}.db", uuid::Uuid::new_v4()));
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
    async fn expired_lease_can_be_reclaimed_without_stale_completion() {
        let scheduler = JobScheduler::new();
        scheduler
            .enqueue(JobSpec {
                job_id: "lease-job".into(),
                run_id: "run".into(),
                task: "work".into(),
                dependencies: vec![],
                priority: 1,
                max_attempts: 3,
            })
            .await
            .unwrap();

        let first = scheduler
            .start_as("lease-job", "worker-a".into(), 1)
            .await
            .unwrap();

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;

        let second = scheduler
            .start_as("lease-job", "worker-b".into(), 30)
            .await
            .unwrap();
        assert_eq!(second.lease_token, first.lease_token + 1);

        assert!(scheduler
            .complete_as(
                "lease-job",
                first.lease_owner.as_deref(),
                Some(first.lease_token),
                true,
                None
            )
            .await
            .is_err());

        scheduler
            .complete_as(
                "lease-job",
                second.lease_owner.as_deref(),
                Some(second.lease_token),
                true,
                None,
            )
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn lease_renewal_prevents_reclaim() {
        let scheduler = JobScheduler::new();
        scheduler
            .enqueue(JobSpec {
                job_id: "renew-job".into(),
                run_id: "run".into(),
                task: "work".into(),
                dependencies: vec![],
                priority: 1,
                max_attempts: 3,
            })
            .await
            .unwrap();

        let first = scheduler
            .start_as("renew-job", "worker-a".into(), 2)
            .await
            .unwrap();

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        let renewed = scheduler
            .renew_as(
                "renew-job",
                "worker-a",
                first.lease_token,
                3,
            )
            .await
            .unwrap();
        assert!(renewed.lease_expires_at > first.lease_expires_at);

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        assert!(
            scheduler
                .start_as("renew-job", "worker-b".into(), 2)
                .await
                .is_err(),
            "a live renewed lease must block takeover"
        );

        assert!(
            scheduler
                .renew_as(
                    "renew-job",
                    "worker-b",
                    first.lease_token,
                    2,
                )
                .await
                .is_err(),
            "renewal with a stale owner must be rejected"
        );
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

fn unix_time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}
