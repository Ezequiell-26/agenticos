#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Confined filesystem operations for the AgentiCOS coding workspace.

use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use tokio::fs;

/// Default maximum number of bytes returned by a workspace read.
pub const DEFAULT_MAX_READ_BYTES: usize = 8 * 1024 * 1024;
/// Default maximum number of bytes accepted by a workspace write.
pub const DEFAULT_MAX_WRITE_BYTES: usize = 8 * 1024 * 1024;
/// Default maximum number of entries returned by a directory listing.
pub const DEFAULT_MAX_LIST_ENTRIES: usize = 2_000;

#[derive(Clone, Debug)]
/// Confined filesystem facade rooted at a configured workspace directory.
pub struct WorkspaceFs {
    root: PathBuf,
    max_read_bytes: usize,
    max_write_bytes: usize,
    max_list_entries: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
/// One text-search match within the workspace.
pub struct WorkspaceSearchMatch {
    /// Workspace-relative file path.
    pub path: String,
    /// One-based source line number.
    pub line: usize,
    /// One-based column number within the matching line.
    pub column: usize,
    /// Short source preview around the match.
    pub preview: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
/// Metadata describing one workspace directory entry.
pub struct WorkspaceEntry {
    /// Workspace-relative entry path.
    pub path: String,
    /// Whether the entry is a directory.
    pub directory: bool,
    /// Whether the entry is a regular file.
    pub file: bool,
    /// File size in bytes when the entry is a regular file.
    pub size_bytes: Option<u64>,
}

impl WorkspaceFs {
    /// Open a workspace rooted at `root` with explicit safety limits.
    pub async fn open(
        root: impl Into<PathBuf>,
        max_read_bytes: usize,
        max_write_bytes: usize,
        max_list_entries: usize,
    ) -> Result<Self, String> {
        let root = root.into();
        fs::create_dir_all(&root)
            .await
            .map_err(|e| format!("workspace root init failed: {e}"))?;
        let root = fs::canonicalize(&root)
            .await
            .map_err(|e| format!("workspace root canonicalization failed: {e}"))?;
        Ok(Self {
            root,
            max_read_bytes: max_read_bytes.max(1),
            max_write_bytes: max_write_bytes.max(1),
            max_list_entries: max_list_entries.max(1),
        })
    }

    /// Open a workspace using `AGENTICOS_WORKSPACE_*` environment settings.
    pub async fn from_env() -> Result<Self, String> {
        let root = std::env::var("AGENTICOS_WORKSPACE_ROOT").unwrap_or_else(|_| ".".to_string());
        let max_read_bytes = std::env::var("AGENTICOS_WORKSPACE_MAX_READ_BYTES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_MAX_READ_BYTES)
            .clamp(1, 64 * 1024 * 1024);
        let max_write_bytes = std::env::var("AGENTICOS_WORKSPACE_MAX_WRITE_BYTES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_MAX_WRITE_BYTES)
            .clamp(1, 64 * 1024 * 1024);
        let max_list_entries = std::env::var("AGENTICOS_WORKSPACE_MAX_LIST_ENTRIES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_MAX_LIST_ENTRIES)
            .clamp(1, 10_000);
        Self::open(root, max_read_bytes, max_write_bytes, max_list_entries).await
    }

    fn relative_path(&self, value: &str) -> Result<PathBuf, String> {
        let value = value.trim();
        if value.is_empty() {
            return Err("workspace path is required".to_string());
        }
        let path = Path::new(value);
        if path.is_absolute() {
            return Err("workspace path must be relative".to_string());
        }
        if path
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::RootDir))
        {
            return Err("workspace path traversal is forbidden".to_string());
        }
        Ok(path.to_path_buf())
    }

    async fn existing_path(&self, value: &str) -> Result<PathBuf, String> {
        let relative = self.relative_path(value)?;
        let path = self.root.join(relative);
        let canonical = fs::canonicalize(path)
            .await
            .map_err(|e| format!("workspace path not found: {e}"))?;
        if !canonical.starts_with(&self.root) {
            return Err("workspace path escapes configured root".to_string());
        }
        Ok(canonical)
    }

    async fn writable_path(&self, value: &str) -> Result<PathBuf, String> {
        let relative = self.relative_path(value)?;
        let target = self.root.join(relative);
        let parent = target
            .parent()
            .ok_or_else(|| "workspace target has no parent".to_string())?;
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("workspace parent creation failed: {e}"))?;
        let canonical_parent = fs::canonicalize(parent)
            .await
            .map_err(|e| format!("workspace parent canonicalization failed: {e}"))?;
        if !canonical_parent.starts_with(&self.root) {
            return Err("workspace parent escapes configured root".to_string());
        }
        Ok(canonical_parent.join(
            target
                .file_name()
                .ok_or_else(|| "workspace target has no filename".to_string())?,
        ))
    }

    /// Read a UTF-8 text file from the configured workspace.
    pub async fn read_text(&self, relative: &str) -> Result<String, String> {
        let path = self.existing_path(relative).await?;
        let metadata = fs::metadata(&path)
            .await
            .map_err(|e| format!("workspace metadata failed: {e}"))?;
        if !metadata.is_file() {
            return Err("workspace path is not a regular file".to_string());
        }
        if metadata.len() as usize > self.max_read_bytes {
            return Err("workspace read exceeds configured size limit".to_string());
        }
        String::from_utf8(
            fs::read(path)
                .await
                .map_err(|e| format!("workspace read failed: {e}"))?,
        )
        .map_err(|e| format!("workspace file is not UTF-8: {e}"))
    }

    /// Replace one exact source fragment and persist the result atomically.
    ///
    /// The expected fragment must occur exactly once. This prevents accidental
    /// broad replacements and makes an agent edit auditable.
    pub async fn apply_patch(
        &self,
        relative: &str,
        expected: &str,
        replacement: &str,
    ) -> Result<(), String> {
        if expected.is_empty() {
            return Err("expected patch fragment must not be empty".to_string());
        }
        let content = self.read_text(relative).await?;
        let matches = content.matches(expected).count();
        if matches != 1 {
            return Err(format!(
                "expected patch fragment must occur exactly once, found {matches}"
            ));
        }
        let updated = content.replacen(expected, replacement, 1);
        self.write_text(relative, &updated).await
    }

    /// Atomically replace a UTF-8 text file in the configured workspace.
    pub async fn write_text(&self, relative: &str, content: &str) -> Result<(), String> {
        if content.len() > self.max_write_bytes {
            return Err("workspace write exceeds configured size limit".to_string());
        }
        let path = self.writable_path(relative).await?;
        let tmp = path.with_extension(format!(
            "{}tmp",
            path.extension().and_then(|v| v.to_str()).unwrap_or("")
        ));
        fs::write(&tmp, content.as_bytes())
            .await
            .map_err(|e| format!("workspace temporary write failed: {e}"))?;
        if let Err(e) = fs::rename(&tmp, &path).await {
            let _ = fs::remove_file(&tmp).await;
            return Err(format!("workspace atomic rename failed: {e}"));
        }
        Ok(())
    }

    /// List entries in a workspace directory, subject to the configured limit.
    pub async fn list(&self, relative: &str) -> Result<Vec<WorkspaceEntry>, String> {
        let path = self.existing_path(relative).await?;
        let metadata = fs::metadata(&path)
            .await
            .map_err(|e| format!("workspace metadata failed: {e}"))?;
        if !metadata.is_dir() {
            return Err("workspace path is not a directory".to_string());
        }
        let mut dir = fs::read_dir(&path)
            .await
            .map_err(|e| format!("workspace directory read failed: {e}"))?;
        let mut out = Vec::new();
        while let Some(entry) = dir
            .next_entry()
            .await
            .map_err(|e| format!("workspace directory iteration failed: {e}"))?
        {
            if out.len() >= self.max_list_entries {
                break;
            }
            let child = entry.path();
            let relative_path = child
                .strip_prefix(&self.root)
                .map_err(|_| "workspace child escaped root".to_string())?
                .to_string_lossy()
                .replace(std::path::MAIN_SEPARATOR, "/");
            let meta = fs::metadata(&child)
                .await
                .map_err(|e| format!("workspace child metadata failed: {e}"))?;
            out.push(WorkspaceEntry {
                path: relative_path,
                directory: meta.is_dir(),
                file: meta.is_file(),
                size_bytes: meta.is_file().then_some(meta.len()),
            });
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    /// Search UTF-8 text files recursively inside the configured workspace.
    ///
    /// Hidden/generated dependency directories are skipped and traversal remains
    /// confined to the canonical workspace root.
    pub async fn search_text(
        &self,
        relative: &str,
        query: &str,
        limit: usize,
    ) -> Result<Vec<WorkspaceSearchMatch>, String> {
        let root = self.existing_path(relative).await?;
        if !fs::metadata(&root)
            .await
            .map_err(|e| format!("workspace search metadata failed: {e}"))?
            .is_dir()
        {
            return Err("workspace search root is not a directory".to_string());
        }

        let needle = query.trim();
        if needle.is_empty() {
            return Err("workspace search query is required".to_string());
        }
        if needle.len() > 256 {
            return Err("workspace search query exceeds supported limits".to_string());
        }

        let max_matches = limit.clamp(1, 500);
        let mut stack = vec![root];
        let mut matches = Vec::new();

        while let Some(directory) = stack.pop() {
            let mut entries = fs::read_dir(&directory)
                .await
                .map_err(|e| format!("workspace search directory read failed: {e}"))?;

            while let Some(entry) = entries
                .next_entry()
                .await
                .map_err(|e| format!("workspace search directory iteration failed: {e}"))?
            {
                if matches.len() >= max_matches {
                    return Ok(matches);
                }

                let child = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if entry
                    .file_type()
                    .await
                    .map(|value| value.is_dir())
                    .unwrap_or(false)
                    && matches!(
                        name.as_str(),
                        ".git" | ".svn" | ".hg" | "node_modules" | "target" | ".agenticos"
                    )
                {
                    continue;
                }

                let canonical = match fs::canonicalize(&child).await {
                    Ok(path) if path.starts_with(&self.root) => path,
                    _ => continue,
                };
                let meta = fs::metadata(&canonical)
                    .await
                    .map_err(|e| format!("workspace search metadata failed: {e}"))?;

                if meta.is_dir() {
                    stack.push(canonical);
                    continue;
                }
                if !meta.is_file() || meta.len() as usize > self.max_read_bytes {
                    continue;
                }

                let content = match fs::read_to_string(&canonical).await {
                    Ok(content) => content,
                    Err(_) => continue,
                };
                let needle_lower = needle.to_lowercase();

                for (line_index, line) in content.lines().enumerate() {
                    let lower_line = line.to_lowercase();
                    let mut offset = 0usize;
                    while let Some(found) = lower_line[offset..].find(&needle_lower) {
                        if matches.len() >= max_matches {
                            return Ok(matches);
                        }
                        let column = offset + found + 1;
                        matches.push(WorkspaceSearchMatch {
                            path: canonical
                                .strip_prefix(&self.root)
                                .map_err(|_| "workspace search child escaped root".to_string())?
                                .to_string_lossy()
                                .replace(std::path::MAIN_SEPARATOR, "/"),
                            line: line_index + 1,
                            column,
                            preview: line.trim().chars().take(240).collect(),
                        });
                        offset = offset + found + needle_lower.len();
                        if offset >= lower_line.len() {
                            break;
                        }
                    }
                }
            }
        }

        matches.sort_by(|left, right| {
            left.path
                .cmp(&right.path)
                .then(left.line.cmp(&right.line))
                .then(left.column.cmp(&right.column))
        });
        Ok(matches)
    }

    /// Return the canonical root directory for this workspace.
    pub fn root(&self) -> &Path {
        &self.root
    }
}

#[tokio::test]
async fn apply_patch_rejects_ambiguous_replacements() {
    let root = std::env::temp_dir().join(format!(
        "agenticos-workspace-patch-{}",
        uuid::Uuid::new_v4()
    ));
    let fs = WorkspaceFs::open(&root, 1024, 1024, 100).await.unwrap();
    fs.write_text("file.txt", "same\nsame").await.unwrap();
    assert!(fs.apply_patch("file.txt", "same", "changed").await.is_err());
    fs.apply_patch("file.txt", "same\nsame", "changed")
        .await
        .unwrap();
    assert_eq!(fs.read_text("file.txt").await.unwrap(), "changed");
    let _ = std::fs::remove_dir_all(root);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn rejects_traversal_and_round_trips() {
        let root =
            std::env::temp_dir().join(format!("agenticos-workspace-{}", uuid::Uuid::new_v4()));
        let fs = WorkspaceFs::open(&root, 1024, 1024, 100).await.unwrap();
        assert!(fs.write_text("../secret", "nope").await.is_err());
        fs.write_text("src/lib.rs", "fn main() {}").await.unwrap();
        assert_eq!(fs.read_text("src/lib.rs").await.unwrap(), "fn main() {}");
        assert_eq!(fs.list("src").await.unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(root);
    }
}
