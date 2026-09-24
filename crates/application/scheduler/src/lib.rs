#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Run/job scheduler with dependency-aware readiness.

use serde::{Deserialize, Serialize};
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
}

impl JobScheduler {
    /// Create an empty scheduler.
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
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
        jobs.insert(
            spec.job_id.clone(),
            JobRecord {
                spec,
                state,
                attempts: 0,
                last_error: None,
            },
        );
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
            return Ok(record.clone());
        }
        record.attempts += 1;
        record.state = JobState::Running;
        Ok(record.clone())
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
        Ok(())
    }

    /// Get one job by identifier.
    pub async fn get(&self, job_id: &str) -> Option<JobRecord> {
        self.jobs.read().await.get(job_id).cloned()
    }

    /// List scheduler state.
    pub async fn list(&self) -> Vec<JobRecord> {
        let jobs = self.jobs.read().await;
        jobs.values().cloned().collect()
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
