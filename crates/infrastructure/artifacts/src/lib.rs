#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable artifact and SpillStore implementation.
//!
//! Large outputs are stored outside model context and addressed by opaque artifact IDs.
//! Metadata is persisted in SQLite; bytes are stored under an application-controlled root.

use ring::digest::{digest, SHA256};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Maximum artifact size accepted by the store.
pub const DEFAULT_MAX_ARTIFACT_BYTES: u64 = 64 * 1024 * 1024;

/// Default inline threshold for callers deciding whether to spill output.
pub const DEFAULT_INLINE_THRESHOLD_BYTES: usize = 64 * 1024;

/// Durable artifact metadata.
#[derive(Clone, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRecord {
    /// Stable artifact identifier.
    pub artifact_id: String,
    /// Owning run identifier, when known.
    pub run_id: Option<String>,
    /// Artifact kind.
    pub kind: String,
    /// MIME type.
    pub mime_type: String,
    /// Content length in bytes.
    pub size_bytes: u64,
    /// SHA-256 checksum in lowercase hexadecimal.
    pub checksum: String,
    /// Relative storage locator.
    pub locator: String,
    /// Creation timestamp.
    pub created_at: u64,
    /// Optional retention deadline.
    pub expires_at: Option<u64>,
    /// Whether the artifact is trusted.
    pub trusted: bool,
    /// Optional structured metadata.
    pub metadata: serde_json::Value,
}

/// Range of artifact bytes.
#[derive(Clone, Debug, Serialize, Deserialize, Eq, PartialEq)]
pub struct ArtifactRange {
    /// Inclusive start offset.
    pub start: u64,
    /// Exclusive end offset.
    pub end: u64,
}

/// Durable file-backed artifact store.
#[derive(Clone, Debug)]
pub struct ArtifactStore {
    pool: Arc<SqlitePool>,
    root: Arc<PathBuf>,
    max_artifact_bytes: u64,
    locks: Arc<RwLock<()>>,
}

impl ArtifactStore {
    /// Open the artifact store and initialize its schema.
    pub async fn open(
        database_url: &str,
        root: impl Into<PathBuf>,
        max_artifact_bytes: u64,
    ) -> Result<Self, String> {
        let root = root.into();
        tokio::fs::create_dir_all(&root)
            .await
            .map_err(|error| format!("artifact root initialization failed: {error}"))?;
        let pool = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("artifact database connection failed: {error}"))?;
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS artifacts (
                artifact_id TEXT PRIMARY KEY,
                run_id TEXT,
                kind TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                locator TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER,
                trusted INTEGER NOT NULL,
                metadata TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .map_err(|error| format!("artifact schema initialization failed: {error}"))?;

        Ok(Self {
            pool: Arc::new(pool),
            root: Arc::new(root),
            max_artifact_bytes: max_artifact_bytes.max(1),
            locks: Arc::new(RwLock::new(())),
        })
    }

    fn checksum(bytes: &[u8]) -> String {
        digest(&SHA256, bytes)
            .as_ref()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    fn locator_for(&self, artifact_id: &str) -> PathBuf {
        self.root.join(format!("{artifact_id}.bin"))
    }

    /// Store bytes atomically and return durable metadata.
    pub async fn put_bytes(
        &self,
        run_id: Option<String>,
        kind: impl Into<String>,
        mime_type: impl Into<String>,
        bytes: &[u8],
        expires_at: Option<u64>,
        trusted: bool,
        metadata: serde_json::Value,
    ) -> Result<ArtifactRecord, String> {
        let _guard = self.locks.write().await;
        if bytes.len() as u64 > self.max_artifact_bytes {
            return Err("artifact exceeds configured size limit".to_string());
        }

        let kind = kind.into().trim().to_string();
        let mime_type = mime_type.into().trim().to_string();
        if kind.is_empty() || mime_type.is_empty() || kind.len() > 128 || mime_type.len() > 256 {
            return Err("artifact kind or MIME type is invalid".to_string());
        }

        if let Some(run_id) = run_id.as_ref() {
            if run_id.is_empty() || run_id.len() > 256 {
                return Err("artifact run_id is invalid".to_string());
            }
        }

        let artifact_id = format!("artifact-{}", uuid::Uuid::new_v4());
        let locator_path = self.locator_for(&artifact_id);
        let tmp_path = self.root.join(format!("{artifact_id}.tmp"));
        tokio::fs::write(&tmp_path, bytes)
            .await
            .map_err(|error| format!("artifact write failed: {error}"))?;
        if let Err(error) = tokio::fs::rename(&tmp_path, &locator_path).await {
            let _ = tokio::fs::remove_file(&tmp_path).await;
            return Err(format!("artifact atomic move failed: {error}"));
        }

        let now = chrono::Utc::now().timestamp().max(0) as u64;
        let checksum = Self::checksum(bytes);
        let locator = locator_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "artifact locator generation failed".to_string())?
            .to_string();
        let record = ArtifactRecord {
            artifact_id: artifact_id.clone(),
            run_id,
            kind,
            mime_type,
            size_bytes: bytes.len() as u64,
            checksum,
            locator,
            created_at: now,
            expires_at,
            trusted,
            metadata,
        };

        let payload = serde_json::to_string(&record)
            .map_err(|error| format!("artifact metadata serialization failed: {error}"))?;
        if let Err(error) = sqlx::query(
            "INSERT INTO artifacts
             (artifact_id, run_id, kind, mime_type, size_bytes, checksum, locator,
              created_at, expires_at, trusted, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&record.artifact_id)
        .bind(&record.run_id)
        .bind(&record.kind)
        .bind(&record.mime_type)
        .bind(record.size_bytes as i64)
        .bind(&record.checksum)
        .bind(&record.locator)
        .bind(record.created_at as i64)
        .bind(record.expires_at.map(|value| value as i64))
        .bind(if record.trusted { 1_i64 } else { 0_i64 })
        .bind(record.metadata.to_string())
        .execute(self.pool.as_ref())
        .await
        {
            let _ = tokio::fs::remove_file(&locator_path).await;
            return Err(format!("artifact metadata persistence failed: {error}"));
        }

        let _ = payload;
        Ok(record)
    }

    /// Get metadata by artifact id.
    pub async fn get(&self, artifact_id: &str) -> Result<Option<ArtifactRecord>, String> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                Option<String>,
                String,
                String,
                i64,
                String,
                String,
                i64,
                Option<i64>,
                i64,
                String,
            ),
        >(
            "SELECT artifact_id, run_id, kind, mime_type, size_bytes, checksum, locator,
                    created_at, expires_at, trusted, metadata
             FROM artifacts WHERE artifact_id = ?",
        )
        .bind(artifact_id)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|error| format!("artifact metadata query failed: {error}"))?;

        row.map(|value| {
            let metadata = serde_json::from_str(&value.10)
                .map_err(|error| format!("artifact metadata decode failed: {error}"))?;
            Ok(ArtifactRecord {
                artifact_id: value.0,
                run_id: value.1,
                kind: value.2,
                mime_type: value.3,
                size_bytes: value.4.max(0) as u64,
                checksum: value.5,
                locator: value.6,
                created_at: value.7.max(0) as u64,
                expires_at: value.8.map(|item| item.max(0) as u64),
                trusted: value.9 != 0,
                metadata,
            })
        })
        .transpose()
    }

    /// Read a bounded byte range after verifying artifact existence.
    pub async fn read_range(
        &self,
        artifact_id: &str,
        range: Option<ArtifactRange>,
    ) -> Result<Vec<u8>, String> {
        let record = self
            .get(artifact_id)
            .await?
            .ok_or_else(|| "artifact not found".to_string())?;
        let path = self.root.join(&record.locator);
        let bytes = tokio::fs::read(&path)
            .await
            .map_err(|error| format!("artifact read failed: {error}"))?;

        let requested = range.unwrap_or(ArtifactRange {
            start: 0,
            end: bytes.len() as u64,
        });
        if requested.start > requested.end || requested.end > bytes.len() as u64 {
            return Err("artifact range is invalid".to_string());
        }
        Ok(bytes[requested.start as usize..requested.end as usize].to_vec())
    }

    /// List recent artifacts, optionally scoped to a run.
    ///
    /// The limit is bounded by the caller so a large artifact store cannot
    /// materialize an unbounded metadata response in memory.
    pub async fn list(
        &self,
        run_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<ArtifactRecord>, String> {
        let limit = limit.clamp(1, 500) as i64;
        let rows = if let Some(run_id) = run_id.filter(|value| !value.trim().is_empty()) {
            sqlx::query_as::<_, (String,)>(
                "SELECT artifact_id FROM artifacts WHERE run_id = ? ORDER BY created_at DESC LIMIT ?",
            )
            .bind(run_id)
            .bind(limit)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|error| format!("artifact listing failed: {error}"))?
        } else {
            sqlx::query_as::<_, (String,)>(
                "SELECT artifact_id FROM artifacts ORDER BY created_at DESC LIMIT ?",
            )
            .bind(limit)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|error| format!("artifact listing failed: {error}"))?
        };

        let mut records = Vec::with_capacity(rows.len());
        for (id,) in rows {
            if let Some(record) = self.get(&id).await? {
                records.push(record);
            }
        }
        Ok(records)
    }

    /// Delete an artifact and its metadata.
    pub async fn delete(&self, artifact_id: &str) -> Result<bool, String> {
        let _guard = self.locks.write().await;
        let Some(record) = self.get(artifact_id).await? else {
            return Ok(false);
        };
        let _ = tokio::fs::remove_file(self.root.join(&record.locator)).await;
        sqlx::query("DELETE FROM artifacts WHERE artifact_id = ?")
            .bind(artifact_id)
            .execute(self.pool.as_ref())
            .await
            .map_err(|error| format!("artifact deletion failed: {error}"))?;
        Ok(true)
    }

    /// Remove expired artifacts and return the number removed.
    pub async fn purge_expired(&self, now: u64) -> Result<u64, String> {
        let rows = sqlx::query_as::<_, (String,)>(
            "SELECT artifact_id FROM artifacts WHERE expires_at IS NOT NULL AND expires_at < ?",
        )
        .bind(now as i64)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|error| format!("artifact expiration query failed: {error}"))?;

        let mut removed = 0_u64;
        for (artifact_id,) in rows {
            if self.delete(&artifact_id).await? {
                removed += 1;
            }
        }
        Ok(removed)
    }

    /// List artifacts owned by a run.
    pub async fn list_for_run(&self, run_id: &str) -> Result<Vec<ArtifactRecord>, String> {
        let ids = sqlx::query_scalar::<_, String>(
            "SELECT artifact_id FROM artifacts WHERE run_id = ? ORDER BY created_at ASC",
        )
        .bind(run_id)
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|error| format!("artifact run listing failed: {error}"))?;

        let mut records = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(record) = self.get(&id).await? {
                records.push(record);
            }
        }
        Ok(records)
    }

    /// Return whether bytes should spill instead of entering model context.
    pub fn should_spill(&self, bytes: usize) -> bool {
        bytes > DEFAULT_INLINE_THRESHOLD_BYTES
    }

    /// Verify the stored checksum for an artifact.
    pub async fn verify(&self, artifact_id: &str) -> Result<bool, String> {
        let Some(record) = self.get(artifact_id).await? else {
            return Ok(false);
        };
        let bytes = self.read_range(artifact_id, None).await?;
        Ok(Self::checksum(&bytes) == record.checksum)
    }

    /// Return the filesystem root for operational diagnostics.
    pub fn root(&self) -> &Path {
        self.root.as_path()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn artifact_round_trip_and_checksum_survive_reopen() {
        let path =
            std::env::temp_dir().join(format!("agenticos-artifacts-{}", uuid::Uuid::new_v4()));
        let root =
            std::env::temp_dir().join(format!("agenticos-artifact-root-{}", uuid::Uuid::new_v4()));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let first = ArtifactStore::open(&url, &root, 1024).await.unwrap();
        let record = first
            .put_bytes(
                Some("run-1".to_string()),
                "tool-output",
                "text/plain",
                b"hello artifact",
                None,
                false,
                serde_json::json!({"source":"test"}),
            )
            .await
            .unwrap();
        assert_eq!(
            first.read_range(&record.artifact_id, None).await.unwrap(),
            b"hello artifact"
        );
        assert!(first.verify(&record.artifact_id).await.unwrap());
        drop(first);

        let second = ArtifactStore::open(&url, &root, 1024).await.unwrap();
        assert_eq!(
            second.get(&record.artifact_id).await.unwrap(),
            Some(record.clone())
        );
        assert_eq!(
            second
                .read_range(
                    &record.artifact_id,
                    Some(ArtifactRange { start: 0, end: 5 }),
                )
                .await
                .unwrap(),
            b"hello"
        );

        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn artifact_size_limit_is_enforced() {
        let path = std::env::temp_dir().join(format!(
            "agenticos-artifacts-limit-{}",
            uuid::Uuid::new_v4()
        ));
        let root = std::env::temp_dir().join(format!(
            "agenticos-artifact-root-limit-{}",
            uuid::Uuid::new_v4()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());

        let store = ArtifactStore::open(&url, &root, 3).await.unwrap();
        assert!(store
            .put_bytes(
                None,
                "blob",
                "application/octet-stream",
                b"1234",
                None,
                false,
                serde_json::json!({})
            )
            .await
            .is_err());

        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_dir_all(root);
    }
}
