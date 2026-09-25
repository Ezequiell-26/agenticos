#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable, bounded interactive terminal sessions.

use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{Mutex, RwLock};

/// Maximum command length accepted by the terminal control plane.
pub const DEFAULT_MAX_COMMAND_BYTES: usize = 32 * 1024;
/// Maximum input payload accepted in one terminal write.
pub const DEFAULT_MAX_INPUT_BYTES: usize = 64 * 1024;
/// Maximum output events retained per terminal session.
pub const DEFAULT_MAX_OUTPUT_EVENTS: u64 = 512;
/// Maximum concurrent terminal sessions.
pub const DEFAULT_MAX_SESSIONS: usize = 16;

/// Terminal lifecycle state.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TerminalStatus {
    /// Process is currently running.
    Running,
    /// Process exited normally or abnormally.
    Exited,
    /// Process was explicitly closed.
    Closed,
    /// Process was running when AgentiCOS restarted.
    Orphaned,
}

/// Durable terminal session metadata.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRecord {
    /// Stable session identifier.
    pub terminal_id: String,
    /// Shell command used to start the session.
    pub command: String,
    /// Absolute working directory.
    pub cwd: String,
    /// Current lifecycle state.
    pub status: TerminalStatus,
    /// Creation timestamp in unix seconds.
    pub created_at: u64,
    /// Last state update timestamp in unix seconds.
    pub updated_at: u64,
    /// Process exit code when known.
    pub exit_code: Option<i32>,
}

/// One bounded terminal output event.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEvent {
    /// Monotonic database event identifier.
    pub event_id: i64,
    /// Terminal session identifier.
    pub terminal_id: String,
    /// Output source.
    pub stream: String,
    /// UTF-8 output data.
    pub data: String,
    /// Unix timestamp in seconds.
    pub created_at: u64,
}

/// Durable interactive terminal manager.
#[derive(Clone, Debug)]
pub struct TerminalManager {
    pool: Arc<SqlitePool>,
    root: Arc<PathBuf>,
    sessions: Arc<RwLock<HashMap<String, Arc<TerminalHandle>>>>,
    max_sessions: usize,
    max_output_events: u64,
}

#[derive(Debug)]
struct TerminalHandle {
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
}

impl TerminalManager {
    /// Open the terminal control plane and recover durable session metadata.
    pub async fn open(
        database_url: &str,
        root: impl Into<PathBuf>,
        max_sessions: usize,
        max_output_events: u64,
    ) -> Result<Self, String> {
        let root = root.into();
        tokio::fs::create_dir_all(&root)
            .await
            .map_err(|error| format!("terminal root initialization failed: {error}"))?;
        let root = tokio::fs::canonicalize(&root)
            .await
            .map_err(|error| format!("terminal root canonicalization failed: {error}"))?;

        let pool = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("terminal database connection failed: {error}"))?;

        agenticos_sqlite_migrations::migrate(database_url)
            .await
            .map_err(|error| format!("sqlite migrations failed: {error}"))?;

        sqlx::query(
            "UPDATE terminal_sessions
             SET status = 'orphaned', updated_at = ?
             WHERE status = 'running'",
        )
        .bind(now() as i64)
        .execute(&pool)
        .await
        .map_err(|error| format!("terminal recovery initialization failed: {error}"))?;

        Ok(Self {
            pool: Arc::new(pool),
            root: Arc::new(root),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            max_sessions: max_sessions.max(1),
            max_output_events: max_output_events.max(1),
        })
    }

    /// Open using environment configuration.
    pub async fn from_env(database_url: &str, root: impl Into<PathBuf>) -> Result<Self, String> {
        let max_sessions = std::env::var("AGENTICOS_MAX_TERMINALS")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(DEFAULT_MAX_SESSIONS)
            .clamp(1, 128);
        let max_output_events = std::env::var("AGENTICOS_TERMINAL_MAX_OUTPUT_EVENTS")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(DEFAULT_MAX_OUTPUT_EVENTS)
            .clamp(1, 10_000);
        Self::open(database_url, root, max_sessions, max_output_events).await
    }

    fn resolve_cwd(&self, cwd: Option<&str>) -> Result<PathBuf, String> {
        let relative = cwd.unwrap_or(".").trim();
        if relative.is_empty() || Path::new(relative).is_absolute() {
            return Err("terminal cwd must be a relative workspace path".to_string());
        }
        if Path::new(relative)
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
        {
            return Err("terminal cwd traversal is forbidden".to_string());
        }

        let root = self.root.clone();
        let path = root.join(relative);
        Ok(path)
    }

    async fn ensure_cwd(&self, cwd: Option<&str>) -> Result<PathBuf, String> {
        let path = self.resolve_cwd(cwd)?;
        let canonical = tokio::fs::canonicalize(&path)
            .await
            .map_err(|error| format!("terminal cwd not found: {error}"))?;
        if !canonical.starts_with(self.root.as_path()) {
            return Err("terminal cwd escapes workspace root".to_string());
        }
        let metadata = tokio::fs::metadata(&canonical)
            .await
            .map_err(|error| format!("terminal cwd metadata failed: {error}"))?;
        if !metadata.is_dir() {
            return Err("terminal cwd is not a directory".to_string());
        }
        Ok(canonical)
    }

    /// Create an interactive shell session inside the workspace.
    pub async fn create(&self, command: &str, cwd: Option<&str>) -> Result<TerminalRecord, String> {
        let command = command.trim();
        if command.is_empty() {
            return Err("terminal command is required".to_string());
        }
        if command.len() > DEFAULT_MAX_COMMAND_BYTES {
            return Err("terminal command exceeds configured limits".to_string());
        }
        if self.sessions.read().await.len() >= self.max_sessions {
            return Err("maximum terminal session count reached".to_string());
        }

        let cwd = self.ensure_cwd(cwd).await?;

        let mut builder = if cfg!(windows) {
            let mut builder = Command::new("cmd.exe");
            builder.args(["/C", command]);
            builder
        } else {
            let mut builder = Command::new("/bin/sh");
            builder.args(["-lc", command]);
            builder
        };
        builder
            .current_dir(&cwd)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        let mut child = builder
            .spawn()
            .map_err(|error| format!("terminal process spawn failed: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "terminal stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "terminal stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "terminal stderr unavailable".to_string())?;

        let id = format!("terminal-{}", uuid::Uuid::new_v4());
        let timestamp = now();
        let record = TerminalRecord {
            terminal_id: id.clone(),
            command: command.to_string(),
            cwd: cwd.display().to_string(),
            status: TerminalStatus::Running,
            created_at: timestamp,
            updated_at: timestamp,
            exit_code: None,
        };

        sqlx::query(
            "INSERT INTO terminal_sessions
             (terminal_id, command, cwd, status, created_at, updated_at, exit_code)
             VALUES (?, ?, ?, 'running', ?, ?, NULL)",
        )
        .bind(&record.terminal_id)
        .bind(&record.command)
        .bind(&record.cwd)
        .bind(record.created_at as i64)
        .bind(record.updated_at as i64)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| format!("terminal session persistence failed: {error}"))?;

        let handle = Arc::new(TerminalHandle {
            stdin: Mutex::new(stdin),
            child: Mutex::new(child),
        });
        self.sessions
            .write()
            .await
            .insert(id.clone(), handle.clone());

        self.spawn_reader(id.clone(), "stdout", stdout);
        self.spawn_reader(id.clone(), "stderr", stderr);
        self.spawn_waiter(id.clone(), handle);

        Ok(record)
    }

    fn spawn_reader<R>(&self, terminal_id: String, stream: &'static str, mut reader: R)
    where
        R: AsyncRead + Unpin + Send + 'static,
    {
        let pool = self.pool.clone();
        let max_output_events = self.max_output_events;
        tokio::spawn(async move {
            let mut buffer = vec![0_u8; 4096];
            loop {
                match reader.read(&mut buffer).await {
                    Ok(0) => break,
                    Ok(bytes_read) => {
                        let data = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                        let created_at = now();
                        if let Ok(result) = sqlx::query(
                            "INSERT INTO terminal_output
                             (terminal_id, stream, data, created_at)
                             VALUES (?, ?, ?, ?)",
                        )
                        .bind(&terminal_id)
                        .bind(stream)
                        .bind(data)
                        .bind(created_at as i64)
                        .execute(pool.as_ref())
                        .await
                        {
                            let event_id = result.last_insert_rowid();
                            let cutoff = event_id.saturating_sub(max_output_events as i64);
                            let _ = sqlx::query(
                                "DELETE FROM terminal_output
                                 WHERE terminal_id = ? AND event_id <= ?",
                            )
                            .bind(&terminal_id)
                            .bind(cutoff)
                            .execute(pool.as_ref())
                            .await;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    fn spawn_waiter(&self, terminal_id: String, handle: Arc<TerminalHandle>) {
        let pool = self.pool.clone();
        let sessions = self.sessions.clone();
        tokio::spawn(async move {
            let exit_code = {
                let mut child = handle.child.lock().await;
                match child.wait().await {
                    Ok(status) => status.code(),
                    Err(_) => None,
                }
            };
            let timestamp = now();
            let status = if exit_code.is_some() {
                "exited"
            } else {
                "closed"
            };
            let _ = sqlx::query(
                "UPDATE terminal_sessions
                 SET status = ?, exit_code = ?, updated_at = ?
                 WHERE terminal_id = ?",
            )
            .bind(status)
            .bind(exit_code)
            .bind(timestamp as i64)
            .bind(&terminal_id)
            .execute(pool.as_ref())
            .await;
            sessions.write().await.remove(&terminal_id);
        });
    }

    /// Write input into a running terminal session.
    pub async fn write_input(&self, terminal_id: &str, input: &str) -> Result<(), String> {
        if terminal_id.trim().is_empty() {
            return Err("terminal_id is required".to_string());
        }
        if input.len() > DEFAULT_MAX_INPUT_BYTES {
            return Err("terminal input exceeds configured limits".to_string());
        }
        let handle = self
            .sessions
            .read()
            .await
            .get(terminal_id)
            .cloned()
            .ok_or_else(|| "terminal session is not running".to_string())?;
        let mut stdin = handle.stdin.lock().await;
        stdin
            .write_all(input.as_bytes())
            .await
            .map_err(|error| format!("terminal input write failed: {error}"))?;
        stdin
            .flush()
            .await
            .map_err(|error| format!("terminal input flush failed: {error}"))
    }

    /// Read persisted output events after an event id.
    pub async fn read_output(
        &self,
        terminal_id: &str,
        after_event_id: i64,
        limit: u32,
    ) -> Result<Vec<TerminalOutputEvent>, String> {
        if terminal_id.trim().is_empty() {
            return Err("terminal_id is required".to_string());
        }
        let limit = i64::from(limit.clamp(1, 256));
        let rows = sqlx::query_as::<_, (i64, String, String, i64)>(
            "SELECT event_id, stream, data, created_at
             FROM terminal_output
             WHERE terminal_id = ? AND event_id > ?
             ORDER BY event_id ASC
             LIMIT ?",
        )
        .bind(terminal_id)
        .bind(after_event_id.max(0))
        .bind(limit)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|error| format!("terminal output query failed: {error}"))?;

        Ok(rows
            .into_iter()
            .map(|row| TerminalOutputEvent {
                event_id: row.0,
                terminal_id: terminal_id.to_string(),
                stream: row.1,
                data: row.2,
                created_at: row.3.max(0) as u64,
            })
            .collect())
    }

    /// Return current persisted session metadata.
    pub async fn get(&self, terminal_id: &str) -> Result<Option<TerminalRecord>, String> {
        let row = sqlx::query_as::<_, (String, String, String, String, i64, i64, Option<i64>)>(
            "SELECT terminal_id, command, cwd, status, created_at, updated_at, exit_code
             FROM terminal_sessions WHERE terminal_id = ?",
        )
        .bind(terminal_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|error| format!("terminal session query failed: {error}"))?;

        row.map(|value| {
            Ok(TerminalRecord {
                terminal_id: value.0,
                command: value.1,
                cwd: value.2,
                status: parse_status(&value.3)?,
                created_at: value.4.max(0) as u64,
                updated_at: value.5.max(0) as u64,
                exit_code: value.6.map(|code| code as i32),
            })
        })
        .transpose()
    }

    /// List terminal session metadata in stable order.
    pub async fn list(&self) -> Result<Vec<TerminalRecord>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, String, i64, i64, Option<i64>)>(
            "SELECT terminal_id, command, cwd, status, created_at, updated_at, exit_code
             FROM terminal_sessions ORDER BY created_at DESC, terminal_id ASC",
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|error| format!("terminal session listing failed: {error}"))?;

        rows.into_iter()
            .map(|value| {
                Ok(TerminalRecord {
                    terminal_id: value.0,
                    command: value.1,
                    cwd: value.2,
                    status: parse_status(&value.3)?,
                    created_at: value.4.max(0) as u64,
                    updated_at: value.5.max(0) as u64,
                    exit_code: value.6.map(|code| code as i32),
                })
            })
            .collect()
    }

    /// Close a live terminal session.
    pub async fn close(&self, terminal_id: &str) -> Result<bool, String> {
        let handle = self.sessions.write().await.remove(terminal_id);
        let Some(handle) = handle else {
            return Ok(false);
        };

        let mut child = handle.child.lock().await;
        if let Err(error) = child.kill().await {
            return Err(format!("terminal process termination failed: {error}"));
        }
        let exit_code = child.wait().await.ok().and_then(|status| status.code());
        drop(child);

        let timestamp = now();
        sqlx::query(
            "UPDATE terminal_sessions
             SET status = 'closed', exit_code = ?, updated_at = ?
             WHERE terminal_id = ?",
        )
        .bind(exit_code)
        .bind(timestamp as i64)
        .bind(terminal_id)
        .execute(self.pool.as_ref())
        .await
        .map_err(|error| format!("terminal close persistence failed: {error}"))?;

        Ok(true)
    }

    /// Delete a terminal session and its persisted output.
    pub async fn delete(&self, terminal_id: &str) -> Result<bool, String> {
        let _ = self.close(terminal_id).await?;
        let existed = sqlx::query("DELETE FROM terminal_sessions WHERE terminal_id = ?")
            .bind(terminal_id)
            .execute(self.pool.as_ref())
            .await
            .map_err(|error| format!("terminal session deletion failed: {error}"))?
            .rows_affected()
            > 0;

        sqlx::query("DELETE FROM terminal_output WHERE terminal_id = ?")
            .bind(terminal_id)
            .execute(self.pool.as_ref())
            .await
            .map_err(|error| format!("terminal output deletion failed: {error}"))?;

        Ok(existed)
    }

    /// Return the configured terminal workspace root.
    pub fn root(&self) -> &Path {
        self.root.as_path()
    }
}

fn parse_status(value: &str) -> Result<TerminalStatus, String> {
    match value {
        "running" => Ok(TerminalStatus::Running),
        "exited" => Ok(TerminalStatus::Exited),
        "closed" => Ok(TerminalStatus::Closed),
        "orphaned" => Ok(TerminalStatus::Orphaned),
        other => Err(format!("unknown terminal status: {other}")),
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn recovery_marks_running_sessions_orphaned() {
        let db_path =
            std::env::temp_dir().join(format!("agenticos-terminal-{}.db", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", db_path.display());

        let first = TerminalManager::open(&url, ".", 4, 8).await.unwrap();
        sqlx::query(
            "INSERT INTO terminal_sessions
             (terminal_id, command, cwd, status, created_at, updated_at, exit_code)
             VALUES ('terminal-test', 'echo hello', '.', 'running', 1, 1, NULL)",
        )
        .execute(first.pool.as_ref())
        .await
        .unwrap();
        drop(first);

        let second = TerminalManager::open(&url, ".", 4, 8).await.unwrap();
        assert_eq!(
            second.get("terminal-test").await.unwrap().unwrap().status,
            TerminalStatus::Orphaned
        );

        let _ = std::fs::remove_file(db_path);
    }
}
