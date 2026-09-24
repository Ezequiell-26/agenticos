#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Confined filesystem operations for the AgentiCOS coding workspace.

use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use tokio::fs;

pub const DEFAULT_MAX_READ_BYTES: usize = 8 * 1024 * 1024;
pub const DEFAULT_MAX_WRITE_BYTES: usize = 8 * 1024 * 1024;
pub const DEFAULT_MAX_LIST_ENTRIES: usize = 2_000;

#[derive(Clone, Debug)]
pub struct WorkspaceFs {
    root: PathBuf,
    max_read_bytes: usize,
    max_write_bytes: usize,
    max_list_entries: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub path: String,
    pub directory: bool,
    pub file: bool,
    pub size_bytes: Option<u64>,
}

impl WorkspaceFs {
    pub async fn open(
        root: impl Into<PathBuf>,
        max_read_bytes: usize,
        max_write_bytes: usize,
        max_list_entries: usize,
    ) -> Result<Self, String> {
        let root = root.into();
        fs::create_dir_all(&root).await.map_err(|e| format!("workspace root init failed: {e}"))?;
        let root = fs::canonicalize(&root).await.map_err(|e| format!("workspace root canonicalization failed: {e}"))?;
        Ok(Self {
            root,
            max_read_bytes: max_read_bytes.max(1),
            max_write_bytes: max_write_bytes.max(1),
            max_list_entries: max_list_entries.max(1),
        })
    }

    pub async fn from_env() -> Result<Self, String> {
        let root = std::env::var("AGENTICOS_WORKSPACE_ROOT").unwrap_or_else(|_| ".".to_string());
        let max_read_bytes = std::env::var("AGENTICOS_WORKSPACE_MAX_READ_BYTES")
            .ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_READ_BYTES).clamp(1, 64 * 1024 * 1024);
        let max_write_bytes = std::env::var("AGENTICOS_WORKSPACE_MAX_WRITE_BYTES")
            .ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_WRITE_BYTES).clamp(1, 64 * 1024 * 1024);
        let max_list_entries = std::env::var("AGENTICOS_WORKSPACE_MAX_LIST_ENTRIES")
            .ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_LIST_ENTRIES).clamp(1, 10_000);
        Self::open(root, max_read_bytes, max_write_bytes, max_list_entries).await
    }

    fn relative_path(&self, value: &str) -> Result<PathBuf, String> {
        let value = value.trim();
        if value.is_empty() { return Err("workspace path is required".to_string()); }
        let path = Path::new(value);
        if path.is_absolute() { return Err("workspace path must be relative".to_string()); }
        if path.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir)) {
            return Err("workspace path traversal is forbidden".to_string());
        }
        Ok(path.to_path_buf())
    }

    async fn existing_path(&self, value: &str) -> Result<PathBuf, String> {
        let relative = self.relative_path(value)?;
        let path = self.root.join(relative);
        let canonical = fs::canonicalize(path).await.map_err(|e| format!("workspace path not found: {e}"))?;
        if !canonical.starts_with(&self.root) { return Err("workspace path escapes configured root".to_string()); }
        Ok(canonical)
    }

    async fn writable_path(&self, value: &str) -> Result<PathBuf, String> {
        let relative = self.relative_path(value)?;
        let target = self.root.join(relative);
        let parent = target.parent().ok_or_else(|| "workspace target has no parent".to_string())?;
        fs::create_dir_all(parent).await.map_err(|e| format!("workspace parent creation failed: {e}"))?;
        let canonical_parent = fs::canonicalize(parent).await.map_err(|e| format!("workspace parent canonicalization failed: {e}"))?;
        if !canonical_parent.starts_with(&self.root) { return Err("workspace parent escapes configured root".to_string()); }
        Ok(canonical_parent.join(target.file_name().ok_or_else(|| "workspace target has no filename".to_string())?))
    }

    pub async fn read_text(&self, relative: &str) -> Result<String, String> {
        let path = self.existing_path(relative).await?;
        let metadata = fs::metadata(&path).await.map_err(|e| format!("workspace metadata failed: {e}"))?;
        if !metadata.is_file() { return Err("workspace path is not a regular file".to_string()); }
        if metadata.len() as usize > self.max_read_bytes { return Err("workspace read exceeds configured size limit".to_string()); }
        String::from_utf8(fs::read(path).await.map_err(|e| format!("workspace read failed: {e}"))?)
            .map_err(|e| format!("workspace file is not UTF-8: {e}"))
    }

    pub async fn write_text(&self, relative: &str, content: &str) -> Result<(), String> {
        if content.len() > self.max_write_bytes { return Err("workspace write exceeds configured size limit".to_string()); }
        let path = self.writable_path(relative).await?;
        let tmp = path.with_extension(format!("{}tmp", path.extension().and_then(|v| v.to_str()).unwrap_or("")));
        fs::write(&tmp, content.as_bytes()).await.map_err(|e| format!("workspace temporary write failed: {e}"))?;
        if let Err(e) = fs::rename(&tmp, &path).await { let _ = fs::remove_file(&tmp).await; return Err(format!("workspace atomic rename failed: {e}")); }
        Ok(())
    }

    pub async fn list(&self, relative: &str) -> Result<Vec<WorkspaceEntry>, String> {
        let path = self.existing_path(relative).await?;
        let metadata = fs::metadata(&path).await.map_err(|e| format!("workspace metadata failed: {e}"))?;
        if !metadata.is_dir() { return Err("workspace path is not a directory".to_string()); }
        let mut dir = fs::read_dir(&path).await.map_err(|e| format!("workspace directory read failed: {e}"))?;
        let mut out = Vec::new();
        while let Some(entry) = dir.next_entry().await.map_err(|e| format!("workspace directory iteration failed: {e}"))? {
            if out.len() >= self.max_list_entries { break; }
            let child = entry.path();
            let relative_path = child.strip_prefix(&self.root).map_err(|_| "workspace child escaped root".to_string())?.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/");
            let meta = fs::metadata(&child).await.map_err(|e| format!("workspace child metadata failed: {e}"))?;
            out.push(WorkspaceEntry { path: relative_path, directory: meta.is_dir(), file: meta.is_file(), size_bytes: meta.is_file().then_some(meta.len()) });
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    pub fn root(&self) -> &Path { &self.root }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn rejects_traversal_and_round_trips() {
        let root = std::env::temp_dir().join(format!("agenticos-workspace-{}", uuid::Uuid::new_v4()));
        let fs = WorkspaceFs::open(&root, 1024, 1024, 100).await.unwrap();
        assert!(fs.write_text("../secret", "nope").await.is_err());
        fs.write_text("src/lib.rs", "fn main() {}").await.unwrap();
        assert_eq!(fs.read_text("src/lib.rs").await.unwrap(), "fn main() {}");
        assert_eq!(fs.list("src").await.unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(root);
    }
}