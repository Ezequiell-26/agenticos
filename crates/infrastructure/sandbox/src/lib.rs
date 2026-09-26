#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Bounded local process execution.
//!
//! This crate is an execution boundary, not a claim of kernel-level isolation.
//! Callers must provide the explicit \`process.execute\` capability.

use agenticos_contracts::{
    ContractError, ResourceUsage, Sandbox, SandboxRequest, SandboxResponse, SandboxStatus,
};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::time::{timeout, Duration};

/// Returns the architectural owner of this crate.
pub const OWNER: &str = "agenticos-sandbox";

/// Process execution policy.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SandboxPolicy {
    /// Maximum execution time in milliseconds.
    pub max_timeout_ms: u64,
    /// Maximum combined stdout/stderr payload retained in memory.
    pub max_output_bytes: usize,
    /// Allowed executable names. Empty means policy-managed allow.
    pub allowed_commands: Vec<String>,
    /// Maximum number of concurrent sandbox processes.
    pub max_concurrent_processes: usize,
    /// Whether to clear inherited environment variables before launching.
    pub clear_environment: bool,
    /// Environment variables allowed to pass through when clearing the environment.
    pub preserved_environment: Vec<String>,
    /// Optional external isolation runner. Supported values: "process" and "bwrap".
    pub isolation_runner: String,
    /// Isolation profile. "default" preserves compatibility; "strict" requires bwrap.
    pub isolation_profile: String,
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
            max_concurrent_processes: 4,
            clear_environment: true,
            preserved_environment: vec![
                "PATH".to_string(),
                "HOME".to_string(),
                "USERPROFILE".to_string(),
                "TMPDIR".to_string(),
                "TEMP".to_string(),
                "TMP".to_string(),
            ],
            isolation_runner: std::env::var("AGENTICOS_SANDBOX_RUNNER")
                .ok()
                .map(|value| value.trim().to_ascii_lowercase())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "process".to_string()),
            isolation_profile: std::env::var("AGENTICOS_SANDBOX_PROFILE")
                .ok()
                .map(|value| value.trim().to_ascii_lowercase())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "default".to_string()),
        }
    }
}

/// Bounded local process executor.
#[derive(Clone, Debug)]
pub struct ProcessSandbox {
    policy: SandboxPolicy,
    active_processes: Arc<AtomicUsize>,
}

impl ProcessSandbox {
    /// Construct a sandbox with a policy.
    pub fn new(policy: SandboxPolicy) -> Self {
        Self {
            policy,
            active_processes: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Validate policy compatibility before executing commands.
    pub fn validate_policy(&self) -> Result<(), ContractError> {
        match self.policy.isolation_profile.as_str() {
            "default" => Ok(()),
            "strict" if self.policy.isolation_runner == "bwrap" => Ok(()),
            "strict" => Err(ContractError::ParseError(
                "strict sandbox isolation requires bwrap".to_string(),
            )),
            other => Err(ContractError::ParseError(format!(
                "unsupported sandbox isolation profile '{}'",
                other
            ))),
        }
    }

    /// Execute a command without shell expansion and with a hard wall-clock timeout.
    pub async fn execute_command(
        &self,
        command: &str,
        timeout_ms: Option<u64>,
        workdir: Option<&std::path::Path>,
        capabilities: &[String],
    ) -> Result<SandboxResponse, ContractError> {
        self.validate_policy()?;
        if !capabilities
            .iter()
            .any(|capability| capability == "process.execute")
        {
            return Err(ContractError::MissingCapability);
        }

        let args = tokenize_command(command)?;
        let executable = args
            .first()
            .map(String::as_str)
            .ok_or_else(|| ContractError::ParseError("command must not be empty".to_string()))?;

        let contains_shell_metachar = command.chars().any(|character| {
            matches!(character, ';' | '|' | '&' | '>' | '<' | '$')
                || matches!(character as u32, 10 | 13 | 96)
        });
        if contains_shell_metachar {
            return Err(ContractError::ParseError(
                "shell metacharacters are not allowed in sandbox commands".to_string(),
            ));
        }

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

        let max_concurrent = self.policy.max_concurrent_processes.max(1);
        loop {
            let active = self.active_processes.load(Ordering::Acquire);
            if active >= max_concurrent {
                return Err(ContractError::ParseError(format!(
                    "sandbox concurrency limit reached: maximum {max_concurrent} active processes"
                )));
            }
            if self
                .active_processes
                .compare_exchange(active, active + 1, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
            {
                break;
            }
        }
        let _active = ActiveProcessGuard::adopted(self.active_processes.clone());

        let mut command_builder = if self.policy.isolation_runner == "bwrap" {
            let runner = if cfg!(target_os = "windows") {
                return Err(ContractError::ParseError(
                    "bwrap isolation is not supported on Windows".to_string(),
                ));
            } else {
                "bwrap"
            };
            let mut wrapped = Command::new(runner);
            wrapped.args([
                "--die-with-parent",
                "--unshare-all",
                "--ro-bind",
                "/",
                "/",
                "--proc",
                "/proc",
                "--dev",
                "/dev",
                "--tmpfs",
                "/tmp",
            ]);
            if self.policy.isolation_profile == "strict" {
                wrapped.args(["--new-session", "--cap-drop", "ALL"]);
            }
            if let Some(dir) = workdir {
                let dir = dir.to_str().ok_or_else(|| {
                    ContractError::ParseError("sandbox workdir is not UTF-8".to_string())
                })?;
                wrapped.args(["--bind", dir, dir, "--chdir", dir]);
            }
            wrapped.arg("--").arg(executable);
            wrapped
        } else if self.policy.isolation_runner == "process" {
            Command::new(executable)
        } else {
            return Err(ContractError::ParseError(format!(
                "unsupported sandbox isolation runner '{}'",
                self.policy.isolation_runner
            )));
        };
        if args.len() > 1 {
            command_builder.args(&args[1..]);
        }
        command_builder
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if self.policy.clear_environment {
            command_builder.env_clear();
            for key in &self.policy.preserved_environment {
                if let Ok(value) = std::env::var(key) {
                    command_builder.env(key, value);
                }
            }
        }
        if let Some(dir) = workdir {
            command_builder.current_dir(dir);
        }

        let mut child_guard = ChildGuard::new(command_builder.spawn().map_err(|error| {
            ContractError::ParseError(format!("sandbox process spawn failed: {error}"))
        })?);
        let child = child_guard
            .child_mut()
            .ok_or_else(|| ContractError::ParseError("sandbox child unavailable".to_string()))?;

        let stdout = child.stdout.take().ok_or_else(|| {
            ContractError::ParseError("sandbox stdout pipe unavailable".to_string())
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            ContractError::ParseError("sandbox stderr pipe unavailable".to_string())
        })?;

        let remaining = Arc::new(AtomicUsize::new(self.policy.max_output_bytes));
        let stdout_task = tokio::spawn(read_stream_limited(stdout, remaining.clone()));
        let stderr_task = tokio::spawn(read_stream_limited(stderr, remaining));

        let started = Instant::now();
        let result = timeout(Duration::from_millis(timeout_ms), child.wait()).await;
        let elapsed = started.elapsed().as_millis() as u64;

        if result.is_err() {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }

        let stdout = stdout_task
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("sandbox stdout task failed: {error}"))
            })?
            .map_err(|error| {
                ContractError::ParseError(format!("sandbox stdout read failed: {error}"))
            })?;
        let stderr = stderr_task
            .await
            .map_err(|error| {
                ContractError::ParseError(format!("sandbox stderr task failed: {error}"))
            })?
            .map_err(|error| {
                ContractError::ParseError(format!("sandbox stderr read failed: {error}"))
            })?;

        match result {
            Ok(Ok(status)) => {
                let mut combined = String::from_utf8_lossy(&stdout).to_string();
                if !stderr.is_empty() {
                    if !combined.is_empty() {
                        combined.push('\n');
                    }
                    combined.push_str(&String::from_utf8_lossy(&stderr));
                }

                Ok(SandboxResponse {
                    request_id: uuid::Uuid::new_v4().to_string(),
                    success: status.success(),
                    output: combined,
                    error: if status.success() {
                        None
                    } else {
                        Some(format!("process exited with status {status}"))
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

#[derive(Debug)]
struct ChildGuard(Option<tokio::process::Child>);

impl ChildGuard {
    fn new(child: tokio::process::Child) -> Self {
        Self(Some(child))
    }

    fn child_mut(&mut self) -> Option<&mut tokio::process::Child> {
        self.0.as_mut()
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        if let Some(child) = self.0.as_mut() {
            let _ = child.start_kill();
        }
    }
}

async fn read_stream_limited<R>(
    mut reader: R,
    remaining: Arc<AtomicUsize>,
) -> std::io::Result<Vec<u8>>
where
    R: AsyncRead + Unpin,
{
    let mut retained = Vec::new();
    let mut buffer = [0u8; 8192];

    loop {
        let read = reader.read(&mut buffer).await?;
        if read == 0 {
            break;
        }

        let keep = reserve_output_bytes(&remaining, read);
        if keep > 0 {
            retained.extend_from_slice(&buffer[..keep]);
        }
    }

    Ok(retained)
}

fn tokenize_command(command: &str) -> Result<Vec<String>, ContractError> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut quote = None;
    let mut escaped = false;
    let mut arg_started = false;

    for character in command.chars() {
        if escaped {
            if matches!(character, '\\' | '\'' | '"' | ' ' | '\t') {
                current.push(character);
            } else {
                current.push('\\');
                current.push(character);
            }
            arg_started = true;
            escaped = false;
            continue;
        }

        match quote {
            Some(active) if character == active => {
                quote = None;
            }
            Some(_) if character == '\\' => {
                escaped = true;
            }
            Some(_) => {
                current.push(character);
                arg_started = true;
            }
            None if character == '\\' => {
                escaped = true;
                arg_started = true;
            }
            None if character == '\'' || character == '"' => {
                quote = Some(character);
                arg_started = true;
            }
            None if character.is_whitespace() => {
                if arg_started {
                    args.push(std::mem::take(&mut current));
                    arg_started = false;
                }
            }
            None => {
                current.push(character);
                arg_started = true;
            }
        }
    }

    if escaped {
        return Err(ContractError::ParseError(
            "command must not end with an escape".to_string(),
        ));
    }
    if quote.is_some() {
        return Err(ContractError::ParseError(
            "command contains an unterminated quote".to_string(),
        ));
    }
    if arg_started {
        args.push(current);
    }

    Ok(args)
}

fn reserve_output_bytes(remaining: &AtomicUsize, requested: usize) -> usize {
    loop {
        let available = remaining.load(Ordering::Acquire);
        if available == 0 {
            return 0;
        }

        let keep = available.min(requested);
        if remaining
            .compare_exchange(
                available,
                available - keep,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .is_ok()
        {
            return keep;
        }
    }
}

#[derive(Debug)]
struct ActiveProcessGuard(Arc<AtomicUsize>);

impl ActiveProcessGuard {
    fn adopted(active_processes: Arc<AtomicUsize>) -> Self {
        Self(active_processes)
    }
}

impl Drop for ActiveProcessGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
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
        if self.active_processes.load(Ordering::Acquire) > 0 {
            Ok(SandboxStatus::Busy)
        } else {
            Ok(SandboxStatus::Ready)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_quoted_and_escaped_arguments_without_shell_expansion() {
        let args =
            tokenize_command(r#"printf "hello world" 'second value' escaped\ value"#).unwrap();
        assert_eq!(
            args,
            vec![
                "printf".to_string(),
                "hello world".to_string(),
                "second value".to_string(),
                r"escaped\ value".to_string(),
            ]
        );
    }

    #[test]
    fn preserves_empty_quoted_arguments() {
        let args = tokenize_command(r#"printf "" ''"#).unwrap();
        assert_eq!(
            args,
            vec!["printf".to_string(), "".to_string(), "".to_string()]
        );
    }

    #[test]
    fn rejects_unterminated_quotes_and_trailing_escape() {
        assert!(matches!(
            tokenize_command(r#"printf "unterminated"#),
            Err(ContractError::ParseError(_))
        ));
        assert!(matches!(
            tokenize_command(r#"printf trailing\ "#),
            Err(ContractError::ParseError(_))
        ));
    }

    #[tokio::test]
    async fn executes_allowlisted_command_with_quoted_argument() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 5_000,
            max_output_bytes: 64,
            allowed_commands: vec!["printf".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "default".to_string(),
        });
        let result = sandbox
            .execute_command(
                r#"printf "hello world""#,
                None,
                None,
                &["process.execute".to_string()],
            )
            .await
            .unwrap();
        assert!(result.success);
        assert_eq!(result.output, "hello world");
    }

    #[tokio::test]
    async fn rejects_missing_process_capability() {
        let sandbox = ProcessSandbox::default();
        let result = sandbox
            .execute_command("git --version", None, None, &[])
            .await;
        assert!(matches!(result, Err(ContractError::MissingCapability)));
    }

    #[tokio::test]
    async fn rejects_strict_profile_without_bwrap() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            isolation_runner: "process".to_string(),
            isolation_profile: "strict".to_string(),
            ..SandboxPolicy::default()
        });
        let result = sandbox.validate_policy();
        assert!(matches!(result, Err(ContractError::ParseError(_))));
    }

    #[tokio::test]
    async fn rejects_unknown_isolation_runner() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 1_000,
            max_output_bytes: 1024,
            allowed_commands: vec!["git".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "unknown".to_string(),
            isolation_profile: "default".to_string(),
        });
        let result = sandbox
            .execute_command(
                "git --version",
                None,
                None,
                &["process.execute".to_string()],
            )
            .await;
        assert!(matches!(result, Err(ContractError::ParseError(_))));
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

    #[tokio::test]
    async fn enforces_process_concurrency_limit() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 5_000,
            max_output_bytes: 1024,
            allowed_commands: vec!["sleep".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "default".to_string(),
        });

        let first = sandbox.clone();
        let first_task = tokio::spawn(async move {
            first
                .execute_command("sleep 1", None, None, &["process.execute".to_string()])
                .await
        });

        tokio::time::sleep(Duration::from_millis(50)).await;
        let second = sandbox
            .execute_command("sleep 0", None, None, &["process.execute".to_string()])
            .await;
        assert!(matches!(second, Err(ContractError::ParseError(_))));
        let _ = first_task.await;
    }

    #[tokio::test]
    async fn bounds_retained_output() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 5_000,
            max_output_bytes: 32,
            allowed_commands: vec!["printf".to_string()],
            max_concurrent_processes: 4,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "default".to_string(),
        });
        let result = sandbox
            .execute_command(
                "printf 0123456789012345678901234567890123456789",
                None,
                None,
                &["process.execute".to_string()],
            )
            .await
            .unwrap();
        assert!(result.success);
        assert!(result.output.len() <= 32);
    }

    #[test]
    fn strict_profile_requires_bwrap_and_default_profile_accepts_process() {
        let strict = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 1_000,
            max_output_bytes: 1_024,
            allowed_commands: vec!["git".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "strict".to_string(),
        });
        assert!(strict.validate_policy().is_err());

        let default = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 1_000,
            max_output_bytes: 1_024,
            allowed_commands: vec!["git".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "default".to_string(),
        });
        assert!(default.validate_policy().is_ok());
    }

    #[test]
    fn unknown_isolation_profile_fails_closed() {
        let sandbox = ProcessSandbox::new(SandboxPolicy {
            max_timeout_ms: 1_000,
            max_output_bytes: 1_024,
            allowed_commands: vec!["git".to_string()],
            max_concurrent_processes: 1,
            clear_environment: true,
            preserved_environment: vec!["PATH".to_string()],
            isolation_runner: "process".to_string(),
            isolation_profile: "unknown".to_string(),
        });
        assert!(sandbox.validate_policy().is_err());
    }
}
