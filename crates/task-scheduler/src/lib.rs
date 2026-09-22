//! Task Scheduler (based on apalis MIT patterns)
//! MIT Licensed - Background task and job processing
//! Source: https://github.com/apalis-dev/apalis (1363 stars, MIT)

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use chrono::{DateTime, Utc};
use thiserror::Error;
use tokio::sync::{RwLock, Semaphore};
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum SchedulerError {
    #[error("Task not found: {0}")]
    TaskNotFound(String),
    #[error("Task already exists: {0}")]
    TaskAlreadyExists(String),
    #[error("Scheduler error: {0}")]
    SchedulerError(String),
    #[error("Execution error: {0}")]
    ExecutionError(String),
}

/// Task priority
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum TaskPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Task status
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Task result
#[derive(Clone, Debug)]
pub enum TaskResult {
    Success,
    Failure(String),
    Cancelled,
}

/// Task definition
#[derive(Clone, Debug)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub payload: serde_json::Value,
    pub priority: TaskPriority,
    pub status: TaskStatus,
    pub result: Option<TaskResult>,
    pub retry_count: u32,
    pub max_retries: u32,
    pub created_at: DateTime<Utc>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub metadata: HashMap<String, String>,
}

impl Task {
    pub fn new(name: String, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            payload,
            priority: TaskPriority::default(),
            status: TaskStatus::Pending,
            result: None,
            retry_count: 0,
            max_retries: 3,
            created_at: Utc::now(),
            scheduled_at: None,
            started_at: None,
            completed_at: None,
            metadata: HashMap::new(),
        }
    }

    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }

    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    pub fn with_scheduled_at(mut self, scheduled_at: DateTime<Utc>) -> Self {
        self.scheduled_at = Some(scheduled_at);
        self
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn can_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }

    pub fn is_ready(&self) -> bool {
        match self.scheduled_at {
            Some(scheduled) => Utc::now() >= scheduled,
            None => true,
        }
    }
}

/// Task executor trait
#[async_trait::async_trait]
pub trait TaskExecutor: Send + Sync {
    async fn execute(&self, task: &Task) -> Result<TaskResult, SchedulerError>;
}

/// In-memory task queue
#[derive(Clone)]
pub struct TaskQueue {
    tasks: Arc<RwLock<Vec<Task>>>,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn push(&self, task: Task) -> Result<(), SchedulerError> {
        let mut tasks = self.tasks.write().await;
        if tasks.iter().any(|t| t.id == task.id) {
            return Err(SchedulerError::TaskAlreadyExists(task.id));
        }
        tasks.push(task);
        Ok(())
    }

    pub async fn pop(&self) -> Option<Task> {
        let mut tasks = self.tasks.write().await;
        // Find first ready task, sorted by priority
        tasks.sort_by(|a, b| {
            let ready_a = a.is_ready();
            let ready_b = b.is_ready();
            match (ready_a, ready_b) {
                (true, true) => b.priority.cmp(&a.priority),
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                (false, false) => std::cmp::Ordering::Equal,
            }
        });
        
        tasks.iter()
            .position(|t| t.status == TaskStatus::Pending && t.is_ready())
            .map(|i| {
                let mut task = tasks.remove(i);
                task.status = TaskStatus::Running;
                task.started_at = Some(Utc::now());
                task
            })
    }

    pub async fn get(&self, id: &str) -> Option<Task> {
        self.tasks.read().await.iter().find(|t| t.id == id).cloned()
    }

    pub async fn update(&self, task: Task) -> Result<(), SchedulerError> {
        let mut tasks = self.tasks.write().await;
        if let Some(pos) = tasks.iter().position(|t| t.id == task.id) {
            tasks[pos] = task;
            Ok(())
        } else {
            Err(SchedulerError::TaskNotFound(task.id))
        }
    }

    pub async fn len(&self) -> usize {
        self.tasks.read().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.tasks.read().await.is_empty()
    }

    pub async fn clear(&self) {
        self.tasks.write().await.clear();
    }
}

impl Default for TaskQueue {
    fn default() -> Self {
        Self::new()
    }
}

/// Task scheduler configuration
#[derive(Clone)]
pub struct SchedulerConfig {
    pub max_concurrent_tasks: usize,
    pub poll_interval: Duration,
    pub enable_retry: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: 10,
            poll_interval: Duration::from_millis(100),
            enable_retry: true,
        }
    }
}

/// Task scheduler
pub struct TaskScheduler {
    queue: TaskQueue,
    executor: Arc<dyn TaskExecutor>,
    config: SchedulerConfig,
    running: Arc<RwLock<bool>>,
}

impl TaskScheduler {
    pub fn new(queue: TaskQueue, executor: Arc<dyn TaskExecutor>) -> Self {
        Self {
            queue,
            executor,
            config: SchedulerConfig::default(),
            running: Arc::new(RwLock::new(false)),
        }
    }

    pub fn with_config(mut self, config: SchedulerConfig) -> Self {
        self.config = config;
        self
    }

    pub async fn submit(&self, task: Task) -> Result<(), SchedulerError> {
        self.queue.push(task).await
    }

    pub async fn start(&self) -> Result<(), SchedulerError> {
        let mut running = self.running.write().await;
        if *running {
            return Err(SchedulerError::SchedulerError("Already running".to_string()));
        }
        *running = true;
        drop(running);

        let queue = self.queue.clone();
        let executor = self.executor.clone();
        let config = self.config.clone();
        let running_flag = self.running.clone();

        tokio::spawn(async move {
            let semaphore = Arc::new(Semaphore::new(config.max_concurrent_tasks));
            
            loop {
                {
                    let running = running_flag.read().await;
                    if !*running {
                        break;
                    }
                }

                if let Some(mut task) = queue.pop().await {
                    let permit = semaphore.clone().acquire_owned().await.unwrap();
                    let queue_clone = queue.clone();
                    let executor_clone = executor.clone();
                    let enable_retry = config.enable_retry;

                    tokio::spawn(async move {
                        let _permit = permit;
                        let result = executor_clone.execute(&task).await;
                        
                        match result {
                            Ok(task_result) => {
                                task.result = Some(task_result.clone());
                                task.completed_at = Some(Utc::now());
                                
                                match task_result {
                                    TaskResult::Success => {
                                        task.status = TaskStatus::Completed;
                                    }
                                    TaskResult::Failure(_) => {
                                        if enable_retry && task.can_retry() {
                                            task.retry_count += 1;
                                            task.status = TaskStatus::Pending;
                                            task.started_at = None;
                                        } else {
                                            task.status = TaskStatus::Failed;
                                        }
                                    }
                                    TaskResult::Cancelled => {
                                        task.status = TaskStatus::Cancelled;
                                    }
                                }
                                
                                let _ = queue_clone.update(task).await;
                            }
                            Err(e) => {
                                task.result = Some(TaskResult::Failure(e.to_string()));
                                task.completed_at = Some(Utc::now());
                                
                                if enable_retry && task.can_retry() {
                                    task.retry_count += 1;
                                    task.status = TaskStatus::Pending;
                                    task.started_at = None;
                                } else {
                                    task.status = TaskStatus::Failed;
                                }
                                
                                let _ = queue_clone.update(task).await;
                            }
                        }
                    });
                }

                tokio::time::sleep(config.poll_interval).await;
            }
        });

        Ok(())
    }

    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }

    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    pub async fn get_task(&self, id: &str) -> Option<Task> {
        self.queue.get(id).await
    }

    pub async fn queue_size(&self) -> usize {
        self.queue.len().await
    }
}

/// Cron-like scheduler for periodic tasks
pub struct CronScheduler {
    tasks: Arc<RwLock<HashMap<String, Task>>>,
}

impl CronScheduler {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_task(&self, task: Task) -> Result<(), SchedulerError> {
        let mut tasks = self.tasks.write().await;
        tasks.insert(task.id.clone(), task);
        Ok(())
    }

    pub async fn remove_task(&self, id: &str) -> Result<(), SchedulerError> {
        let mut tasks = self.tasks.write().await;
        tasks.remove(id)
            .map(|_| ())
            .ok_or_else(|| SchedulerError::TaskNotFound(id.to_string()))
    }

    pub async fn get_task(&self, id: &str) -> Option<Task> {
        self.tasks.read().await.get(id).cloned()
    }

    pub async fn tick(&self) -> Vec<Task> {
        let mut tasks = self.tasks.write().await;
        let now = Utc::now();
        let mut ready_tasks = Vec::new();

        for (_id, task) in tasks.iter_mut() {
            if task.status == TaskStatus::Pending && task.is_ready() {
                let mut task_clone = task.clone();
                task_clone.status = TaskStatus::Running;
                task_clone.started_at = Some(now);
                ready_tasks.push(task_clone);
                
                // Reschedule for next run (if this is a periodic task)
                if let Some(scheduled) = task.scheduled_at {
                    // Simple daily rescheduling - in production, use cron expressions
                    task.scheduled_at = Some(scheduled + chrono::Duration::days(1));
                    task.status = TaskStatus::Pending;
                    task.started_at = None;
                }
            }
        }

        ready_tasks
    }
}

impl Default for CronScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct DummyExecutor;

    #[async_trait::async_trait]
    impl TaskExecutor for DummyExecutor {
        async fn execute(&self, _task: &Task) -> Result<TaskResult, SchedulerError> {
            Ok(TaskResult::Success)
        }
    }

    #[test]
    fn test_task_creation() {
        let task = Task::new("test".to_string(), serde_json::json!({}));
        assert_eq!(task.status, TaskStatus::Pending);
        assert_eq!(task.priority, TaskPriority::Normal);
    }

    #[test]
    fn test_task_with_priority() {
        let task = Task::new("test".to_string(), serde_json::json!({}))
            .with_priority(TaskPriority::High);
        assert_eq!(task.priority, TaskPriority::High);
    }

    #[test]
    fn test_task_priority_ordering() {
        assert!(TaskPriority::Critical > TaskPriority::High);
        assert!(TaskPriority::High > TaskPriority::Normal);
        assert!(TaskPriority::Normal > TaskPriority::Low);
    }

    #[tokio::test]
    async fn test_task_queue() {
        let queue = TaskQueue::new();
        let task = Task::new("test".to_string(), serde_json::json!({}));
        queue.push(task).await.unwrap();
        assert_eq!(queue.len().await, 1);
    }

    #[tokio::test]
    async fn test_task_queue_pop() {
        let queue = TaskQueue::new();
        let task = Task::new("test".to_string(), serde_json::json!({}));
        queue.push(task).await.unwrap();
        let popped = queue.pop().await;
        assert!(popped.is_some());
        assert_eq!(queue.len().await, 0);
    }

    #[tokio::test]
    async fn test_task_scheduler_submit() {
        let queue = TaskQueue::new();
        let executor = Arc::new(DummyExecutor);
        let scheduler = TaskScheduler::new(queue, executor);
        
        let task = Task::new("test".to_string(), serde_json::json!({}));
        scheduler.submit(task).await.unwrap();
        assert_eq!(scheduler.queue_size().await, 1);
    }

    #[tokio::test]
    async fn test_cron_scheduler() {
        let cron = CronScheduler::new();
        let task = Task::new("test".to_string(), serde_json::json!({}));
        cron.add_task(task).await.unwrap();
        assert!(cron.get_task("test").await.is_some());
    }

    #[test]
    fn test_task_can_retry() {
        let task = Task::new("test".to_string(), serde_json::json!({}))
            .with_max_retries(3);
        assert!(task.can_retry());
    }

    #[test]
    fn test_task_retry_exhausted() {
        let mut task = Task::new("test".to_string(), serde_json::json!({}))
            .with_max_retries(3);
        task.retry_count = 3;
        assert!(!task.can_retry());
    }
}
