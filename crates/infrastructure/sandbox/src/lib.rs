#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Bounded local process execution.
//!
//! This crate is an execution boundary, not a claim of kernel-level isolation.
//! Callers must provide the explicit `process.execute` capability.

use agenticos_contracts::{
    ContractError, ResourceUsage, Sandbox, SandboxRequest, SandboxResponse, SandboxStatus,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::{timeout, Duration};

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-sandbox";

/// Process execution policy.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxPolicy {
    /// Maximum execution time in milliseconds.
    pub max_timeout_ms: u64,
    /// Maximum stdout/stderr payload retained in memory.
    pub max_output_bytes: usize,
    /// Allowed executable names. Empty means policy-managed allow.
    pub allowed_commands: Vec<String>,
}

impl Default for SandboxPolicy {
    fn default() -> Self {
        Self {
            max_timeout_ms: 120_000,
            max_output_bytes: 1_048_576,
            allowed_commands: vec![
                "git".to_string(),
                "cargo".to_string(),
                "npm".to_string(),
                "node".to_string(),
                "python".to_string(),
                "python3".to_string(),
                "rg".to_string(),
                "find".to_string(),
            ],
        }
    }
}

/// Bounded local process executor.
#[derive(Clone, Debug)]
pub struct ProcessSandbox {
    policy: SandboxPolicy,
    running: Arc<RwLock<bool>>,
}

impl ProcessSandbox {
    /// Construct a sandbox with a policy.
    pub fn new(policy: SandboxPolicy) -> Self {
        Self {
            policy,
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Execute a shell command with a hard wall-clock timeout.
    pub async fn execute_command(
        &self,
        command: &str,
        timeout_ms: Option<u64>,
        workdir: Option<&std::path::Path>,
        capabilities: &[String],
    ) -> Result<SandboxResponse, ContractError> {
        if !capabilities
            .iter()
            .any(|capability| capability == "process.execute")
        {
            return Err(ContractError::MissingCapability);
        }

        let executable = command.split_whitespace().next().unwrap_or_default();
        if !self.policy.allowed_commands.is_empty()
            && !self
                .policy
                .allowed_commands
                .iter()
                .any(|allowed| allowed == executable)
        {
            return Err(ContractError::ParseError(format!(
                "command '{}' is not allowed by sandbox policy",
                executable
            )));
        }

        let timeout_ms = timeout_ms
            .unwrap_or(self.policy.max_timeout_ms)
            .min(self.policy.max_timeout_ms);
        let mut child = if cfg!(target_os = "windows") {
            let mut command_builder = Command::new("cmd");
            command_builder.args(["/C", command]);
            command_builder
        } else {
            let mut command_builder = Command::new("sh");
            command_builder.args(["-lc", command]);
            command_builder
        };
        child.kill_on_drop(true);
        if let Some(dir) = workdir {
            child.current_dir(dir);
        }

        {
            let mut running = self.running.write().await;
            *running = true;
        }

        let started = Instant::now();
        let result = timeout(Duration::from_millis(timeout_ms), child.output()).await;
        let elapsed = started.elapsed().as_millis() as u64;

        {
            let mut running = self.running.write().await;
            *running = false;
        }

        match result {
            Ok(Ok(output)) => {
                let mut combined = String::from_utf8_lossy(&output.stdout).to_string();
                if !output.stderr.is_empty() {
                    combined.push_str("\n");
                    combined.push_str(&String::from_utf8_lossy(&output.stderr));
                }
                combined.truncate(self.policy.max_output_bytes);

                Ok(SandboxResponse {
                    request_id: uuid::Uuid::new_v4().to_string(),
                    success: output.status.success(),
                    output: combined,
                    error: if output.status.success() {
                        None
                    } else {
                        Some(format!("process exited with status {}", output.status))
                    },
                    resource_usage: ResourceUsage {
                        cpu_time_ms: 0,
                        memory_used_bytes: 0,
                        execution_time_ms: elapsed,
                    },
                })
            }
            Ok(Err(error)) => Ok(SandboxResponse {
                request_id: uuid::Uuid::new_v4().to_string(),
                success: false,
                output: String::new(),
                error: Some(error.to_string()),
                resource_usage: ResourceUsage {
                    cpu_time_ms: 0,
                    memory_used_bytes: 0,
                    execution_time_ms: elapsed,
                },
            }),
            Err(_) => Ok(SandboxResponse {
                request_id: uuid::Uuid::new_v4().to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("sandbox timeout after {timeout_ms}ms")),
                resource_usage: ResourceUsage {
                    cpu_time_ms: 0,
                    memory_used_bytes: 0,
                    execution_time_ms: elapsed,
                },
            }),
        }
    }
}

impl Default for ProcessSandbox {
    fn default() -> Self {
        Self::new(SandboxPolicy::default())
    }
}

#[async_trait::async_trait]
impl Sandbox for ProcessSandbox {
    async fn execute(&self, request: SandboxRequest) -> Result<SandboxResponse, ContractError> {
        self.execute_command(
            &request.code,
            Some(request.timeout_ms),
            None,
            &request.allowed_capabilities,
        )
        .await
        .map(|mut response| {
            response.request_id = request.request_id;
            response
        })
    }

    async fn is_available(&self) -> Result<bool, ContractError> {
        Ok(true)
    }

    async fn get_status(&self) -> Result<SandboxStatus, ContractError> {
        if *self.running.read().await {
            Ok(SandboxStatus::Busy)
        } else {
            Ok(SandboxStatus::Ready)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn rejects_missing_process_capability() {
        let sandbox = ProcessSandbox::default();
        let result = sandbox
            .execute_command("git --version", None, None, &[])
            .await;
        assert!(matches!(result, Err(ContractError::MissingCapability)));
    }

    #[tokio::test]
    async fn rejects_shell_control_operators() {
        let sandbox = ProcessSandbox::default();
        let result = sandbox
            .execute_command(
                "git --version && echo unsafe",
                None,
                None,
                &["process.execute".to_string()],
            )
            .await;
        assert!(matches!(result, Err(ContractError::ParseError(_))));
    }

    #[tokio::test]
    async fn executes_allowlisted_command() {
        let sandbox = ProcessSandbox::default();
        let result = sandbox
            .execute_command(
                "git --version",
                None,
                None,
                &["process.execute".to_string()],
            )
            .await
            .unwrap();
        assert!(result.success);
    }
}
