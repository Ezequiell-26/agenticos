#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Optional adapter for the external `agent-browser` CLI.
//!
//! The adapter deliberately does not own orchestration. It validates a small,
//! typed command surface and executes the external browser daemon through
//! `agent-browser --session <id> ...`.

use agenticos_contracts::ContractError;
use serde::Serialize;
use std::path::Path;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Architectural owner of the browser adapter.
pub const OWNER: &str = "agenticos-browser";

/// Result of one browser CLI action.
#[derive(Clone, Debug, Serialize)]
pub struct BrowserActionResult {
    /// Browser session identifier.
    pub session_id: String,
    /// Command executed after the global session arguments.
    pub action: String,
    /// Whether the external command exited successfully.
    pub success: bool,
    /// Combined standard output and standard error.
    pub output: String,
}

/// Optional external browser runtime.
#[derive(Clone, Debug)]
pub struct BrowserRuntime {
    command: String,
    timeout: Duration,
    max_output_bytes: usize,
    concurrency: std::sync::Arc<Semaphore>,
}

impl Default for BrowserRuntime {
    fn default() -> Self {
        Self::from_env()
    }
}

impl BrowserRuntime {
    /// Build the browser runtime from environment configuration.
    pub fn from_env() -> Self {
        let timeout_ms = std::env::var("AGENTICOS_BROWSER_TIMEOUT_MS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(60_000)
            .clamp(1_000, 300_000);
        let max_output_bytes = std::env::var("AGENTICOS_BROWSER_MAX_OUTPUT_BYTES")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(2 * 1024 * 1024)
            .clamp(4_096, 16 * 1024 * 1024);
        let max_concurrency = std::env::var("AGENTICOS_BROWSER_MAX_CONCURRENCY")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(4)
            .clamp(1, 32);

        Self {
            command: std::env::var("AGENTICOS_BROWSER_COMMAND")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "agent-browser".to_string()),
            timeout: Duration::from_millis(timeout_ms),
            max_output_bytes,
            concurrency: std::sync::Arc::new(Semaphore::new(max_concurrency)),
        }
    }

    /// Check whether the external browser CLI is installed and executable.
    pub async fn is_available(&self) -> bool {
        timeout(
            Duration::from_secs(5),
            Command::new(&self.command).arg("--version").output(),
        )
        .await
        .ok()
        .and_then(Result::ok)
        .is_some_and(|output| output.status.success())
    }

    /// Run a validated browser CLI action within a persistent session.
    pub async fn run(
        &self,
        session_id: &str,
        args: &[String],
    ) -> Result<BrowserActionResult, ContractError> {
        validate_session_id(session_id)?;
        validate_args(args)?;

        if !self.is_available().await {
            return Err(ContractError::ParseError(
                "agent-browser CLI is not available".to_string(),
            ));
        }

        let _permit = self.concurrency.acquire().await.map_err(|_| {
            ContractError::ParseError("browser concurrency limiter is closed".to_string())
        })?;

        let action = args.join(" ");
        let mut command = Command::new(&self.command);
        command
            .arg("--session")
            .arg(session_id)
            .args(args)
            .env("NO_COLOR", "1");

        let output = timeout(self.timeout, command.output())
            .await
            .map_err(|_| {
                ContractError::ParseError(format!(
                    "browser action timed out after {}ms",
                    self.timeout.as_millis()
                ))
            })?
            .map_err(|error| {
                ContractError::ParseError(format!("browser action failed to start: {error}"))
            })?;

        let mut text = String::from_utf8_lossy(&output.stdout).to_string();
        if !output.stderr.is_empty() {
            if !text.is_empty() {
                text.push('\n');
            }
            text.push_str(&String::from_utf8_lossy(&output.stderr));
        }
        if text.len() > self.max_output_bytes {
            text.truncate(self.max_output_bytes);
            text.push_str("\n[output truncated]");
        }

        Ok(BrowserActionResult {
            session_id: session_id.to_string(),
            action,
            success: output.status.success(),
            output: text,
        })
    }

    /// Navigate a browser session.
    pub async fn open(
        &self,
        session_id: &str,
        url: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_url(url)?;
        self.run(session_id, &[String::from("open"), url.to_string()])
            .await
    }

    /// Capture an interactive browser snapshot.
    pub async fn snapshot(&self, session_id: &str) -> Result<BrowserActionResult, ContractError> {
        self.run(
            session_id,
            &[String::from("snapshot"), String::from("-i")],
        )
        .await
    }

    /// Click an element reference.
    pub async fn click(
        &self,
        session_id: &str,
        target: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_target(target)?;
        self.run(session_id, &[String::from("click"), target.to_string()])
            .await
    }

    /// Fill an element reference or locator.
    pub async fn fill(
        &self,
        session_id: &str,
        target: &str,
        text: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_target(target)?;
        if text.len() > 64 * 1024 {
            return Err(ContractError::ParseError(
                "browser fill text exceeds supported limits".to_string(),
            ));
        }
        self.run(
            session_id,
            &[
                String::from("fill"),
                target.to_string(),
                text.to_string(),
            ],
        )
        .await
    }

    /// Wait for an element, URL state, or browser condition supported by the CLI.
    pub async fn wait(
        &self,
        session_id: &str,
        target: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_target(target)?;
        self.run(session_id, &[String::from("wait"), target.to_string()])
            .await
    }

    /// Read text from a target element or locator.
    pub async fn get_text(
        &self,
        session_id: &str,
        target: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_target(target)?;
        self.run(
            session_id,
            &[String::from("get"), String::from("text"), target.to_string()],
        )
        .await
    }

    /// Capture a screenshot.
    pub async fn screenshot(
        &self,
        session_id: &str,
    ) -> Result<BrowserActionResult, ContractError> {
        self.run(session_id, &[String::from("screenshot")]).await
    }

    /// Capture a screenshot at a caller-controlled absolute path.
    pub async fn screenshot_to(
        &self,
        session_id: &str,
        output_path: &Path,
    ) -> Result<BrowserActionResult, ContractError> {
        validate_output_path(output_path)?;
        self.run(
            session_id,
            &[
                String::from("screenshot"),
                String::from("--screenshot-format"),
                String::from("png"),
                output_path.to_string_lossy().into_owned(),
            ],
        )
        .await
    }

    /// Close a persistent browser session.
    pub async fn close(&self, session_id: &str) -> Result<BrowserActionResult, ContractError> {
        self.run(session_id, &[String::from("close")]).await
    }
}

fn validate_session_id(value: &str) -> Result<(), ContractError> {
    let valid = !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte));
    if valid {
        Ok(())
    } else {
        Err(ContractError::InvalidId)
    }
}

fn validate_args(args: &[String]) -> Result<(), ContractError> {
    if args.is_empty() || args.len() > 8 {
        return Err(ContractError::ParseError(
            "browser action must contain 1..=8 arguments".to_string(),
        ));
    }
    if args.iter().any(|arg| arg.len() > 64 * 1024 || arg.contains(['\r', '\n'])) {
        return Err(ContractError::ParseError(
            "browser action contains an invalid argument".to_string(),
        ));
    }
    Ok(())
}

fn validate_url(url: &str) -> Result<(), ContractError> {
    let url = url.trim();
    if url.len() > 2048
        || !url
            .split_once(':')
            .is_some_and(|(scheme, _)| matches!(scheme.to_ascii_lowercase().as_str(), "http" | "https"))
    {
        return Err(ContractError::ParseError(
            "browser navigation requires an http or https URL".to_string(),
        ));
    }
    Ok(())
}

fn validate_target(target: &str) -> Result<(), ContractError> {
    if target.trim().is_empty() || target.len() > 1024 || target.contains(['\r', '\n']) {
        return Err(ContractError::ParseError(
            "browser target is invalid".to_string(),
        ));
    }
    Ok(())
}

fn validate_output_path(path: &Path) -> Result<(), ContractError> {
    let value = path.to_string_lossy();
    if value.is_empty() || value.len() > 4096 || value.contains(['\r', '\n']) || !path.is_absolute() {
        return Err(ContractError::ParseError(
            "browser screenshot output path must be absolute and valid".to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_browser_session_ids() {
        assert!(validate_session_id("site-1").is_ok());
        assert!(validate_session_id("site 1").is_err());
        assert!(validate_session_id("../site").is_err());
    }

    #[test]
    fn validates_http_navigation() {
        assert!(validate_url("http://127.0.0.1:8080").is_ok());
        assert!(validate_url("https://example.com").is_ok());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn validates_wait_and_text_targets() {
        assert!(validate_target("@e1").is_ok());
        assert!(validate_target("").is_err());
    }

    #[test]
    fn validates_action_arguments() {
        assert!(validate_args(&[String::from("snapshot"), String::from("-i")]).is_ok());
        assert!(validate_args(&[]).is_err());
    }

    #[test]
    fn validates_screenshot_output_paths() {
        assert!(validate_output_path(Path::new("/tmp/agenticos.png")).is_ok());
        assert!(validate_output_path(Path::new("relative.png")).is_err());
        assert!(validate_output_path(Path::new("/tmp/bad\npath.png")).is_err());
    }
}
