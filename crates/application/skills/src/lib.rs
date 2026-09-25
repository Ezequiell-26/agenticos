#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Durable application-level skill catalog and activation state.
//!
//! This crate manages metadata and activation independently from the kernel.
//! The kernel remains responsible for turning validated SKILL.md content into
//! executable agent instructions.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::{
    path::PathBuf,
    sync::Arc,
};

const MAX_SKILL_BYTES: usize = 512 * 1024;
const MAX_TOTAL_BYTES: usize = 8 * 1024 * 1024;
const MAX_SKILLS: usize = 128;

/// Persisted skill catalog record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillRecord {
    /// Stable skill identifier.
    pub skill_id: String,
    /// Display name.
    pub name: String,
    /// Version string.
    pub version: String,
    /// Short description.
    pub description: String,
    /// Catalog category.
    pub category: String,
    /// Whether the skill is enabled for new agent sessions.
    pub enabled: bool,
    /// Origin path when discovered from the local skills directory.
    pub source: Option<String>,
    /// Last synchronization time.
    pub updated_at: DateTime<Utc>,
}

/// Parsed skill metadata used during local catalog synchronization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    /// Skill identifier/name.
    pub name: String,
    /// Description used for progressive disclosure.
    pub description: String,
    /// Semantic version or equivalent version label.
    pub version: String,
    /// Optional category.
    pub category: String,
    /// Complete SKILL.md content.
    pub content: String,
}

/// Durable skill registry.
#[derive(Debug, Clone)]
pub struct SkillRegistry {
    db: Arc<SqlitePool>,
    root: PathBuf,
}

impl SkillRegistry {
    /// Open a durable registry and synchronize local SKILL.md files.
    pub async fn open(database_url: &str, root: impl Into<PathBuf>) -> Result<Self, String> {
        let db = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(4)
            .connect(database_url)
            .await
            .map_err(|error| format!("skill database connection failed: {error}"))?;

        agenticos_sqlite_migrations::migrate_pool(&db).await?;

        let registry = Self {
            db: Arc::new(db),
            root: root.into(),
        };
        registry.sync_local().await?;
        Ok(registry)
    }

    /// List all registered skills in stable name order.
    pub async fn list(&self) -> Result<Vec<SkillRecord>, String> {
        let rows = sqlx::query_as::<
            _,
            (String, String, String, String, String, i64, Option<String>, String),
        >(
            "SELECT skill_id, name, version, description, category, enabled, source, updated_at
             FROM skills
             ORDER BY name COLLATE NOCASE ASC, skill_id ASC",
        )
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("skill list failed: {error}"))?;

        rows.into_iter()
            .map(
                |(
                    skill_id,
                    name,
                    version,
                    description,
                    category,
                    enabled,
                    source,
                    updated_at,
                )| {
                    let updated_at = DateTime::parse_from_rfc3339(&updated_at)
                        .map_err(|error| format!("invalid persisted skill timestamp: {error}"))?
                        .with_timezone(&Utc);
                    Ok(SkillRecord {
                        skill_id,
                        name,
                        version,
                        description,
                        category,
                        enabled: enabled != 0,
                        source,
                        updated_at,
                    })
                },
            )
            .collect()
    }

    /// Return enabled skill documents ordered by name.
    pub async fn enabled(&self) -> Result<Vec<SkillMetadata>, String> {
        let rows = sqlx::query_as::<_, (String, String, String, String, String, String)>(
            "SELECT skill_id, name, version, description, content, category
             FROM skills
             WHERE enabled = 1
             ORDER BY name COLLATE NOCASE ASC, skill_id ASC",
        )
        .fetch_all(self.db.as_ref())
        .await
        .map_err(|error| format!("enabled skills query failed: {error}"))?;

        rows.into_iter()
            .map(|(skill_id, name, version, description, content, category)| {
                Ok(SkillMetadata {
                    name: if name.trim().is_empty() { skill_id } else { name },
                    description,
                    version,
                    category,
                    content,
                })
            })
            .collect()
    }

    /// Enable or disable a registered skill for new agent sessions.
    pub async fn set_enabled(&self, skill_id: &str, enabled: bool) -> Result<SkillRecord, String> {
        let skill_id = normalize_id(skill_id)?;
        let updated_at = Utc::now().to_rfc3339();
        let result =
            sqlx::query("UPDATE skills SET enabled = ?, updated_at = ? WHERE skill_id = ?")
                .bind(enabled as i64)
                .bind(&updated_at)
                .bind(&skill_id)
                .execute(self.db.as_ref())
                .await
                .map_err(|error| format!("skill activation update failed: {error}"))?;
        if result.rows_affected() != 1 {
            return Err("skill not found".to_string());
        }
        self.get(&skill_id)
            .await?
            .ok_or_else(|| "skill not found".to_string())
    }

    /// Fetch one registered skill by identifier.
    pub async fn get(&self, skill_id: &str) -> Result<Option<SkillRecord>, String> {
        let skill_id = normalize_id(skill_id)?;
        let row = sqlx::query_as::<
            _,
            (String, String, String, String, String, i64, Option<String>, String),
        >(
            "SELECT skill_id, name, version, description, category, enabled, source, updated_at
             FROM skills WHERE skill_id = ?",
        )
        .bind(&skill_id)
        .fetch_optional(self.db.as_ref())
        .await
        .map_err(|error| format!("skill lookup failed: {error}"))?;

        row.map(
            |(
                skill_id,
                name,
                version,
                description,
                category,
                enabled,
                source,
                updated_at,
            )| {
                let updated_at = DateTime::parse_from_rfc3339(&updated_at)
                    .map_err(|error| format!("invalid persisted skill timestamp: {error}"))?
                    .with_timezone(&Utc);
                Ok(SkillRecord {
                    skill_id,
                    name,
                    version,
                    description,
                    category,
                    enabled: enabled != 0,
                    source,
                    updated_at,
                })
            },
        )
        .transpose()
    }

    /// Synchronize local SKILL.md files into the persistent catalog.
    pub async fn sync_local(&self) -> Result<usize, String> {
        let mut directory = match tokio::fs::read_dir(&self.root).await {
            Ok(directory) => directory,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
            Err(error) => return Err(format!("skill directory unavailable: {error}")),
        };

        let mut total_bytes = 0usize;
        let mut discovered = 0usize;
        while let Some(entry) = directory
            .next_entry()
            .await
            .map_err(|error| format!("skill directory scan failed: {error}"))?
        {
            if discovered >= MAX_SKILLS {
                break;
            }

            let path = entry.path().join("SKILL.md");
            let metadata = match tokio::fs::metadata(&path).await {
                Ok(metadata)
                    if metadata.is_file() && metadata.len() as usize <= MAX_SKILL_BYTES =>
                {
                    metadata
                }
                _ => continue,
            };

            let size = metadata.len() as usize;
            if total_bytes.saturating_add(size) > MAX_TOTAL_BYTES {
                break;
            }

            let content = tokio::fs::read_to_string(&path)
                .await
                .map_err(|error| format!("skill read failed for {}: {error}", path.display()))?;

            let parsed = match parse_metadata(&content) {
                Ok(parsed) => parsed,
                Err(error) => {
                    tracing::warn!(%error, path = %path.display(), "invalid SKILL.md skipped");
                    continue;
                }
            };
            self.upsert_discovered(&parsed, path.to_string_lossy().as_ref())
                .await?;

            total_bytes = total_bytes.saturating_add(size);
            discovered += 1;
        }

        Ok(discovered)
    }

    async fn upsert_discovered(
        &self,
        metadata: &SkillMetadata,
        source: &str,
    ) -> Result<(), String> {
        let skill_id = normalize_id(&metadata.name)?;
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO skills (
                skill_id, name, version, description, content, category, enabled, source, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT(skill_id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                description = excluded.description,
                content = excluded.content,
                category = excluded.category,
                source = excluded.source,
                updated_at = excluded.updated_at",
        )
        .bind(skill_id)
        .bind(&metadata.name)
        .bind(&metadata.version)
        .bind(&metadata.description)
        .bind(&metadata.content)
        .bind(&metadata.category)
        .bind(source)
        .bind(now)
        .execute(self.db.as_ref())
        .await
        .map_err(|error| format!("skill catalog upsert failed: {error}"))?;
        Ok(())
    }
}

/// Parse YAML frontmatter of a SKILL.md without executing any content.
pub fn parse_metadata(content: &str) -> Result<SkillMetadata, String> {
    if content.len() > MAX_SKILL_BYTES {
        return Err("skill content exceeds 512 KiB".to_string());
    }

    let stripped = content
        .strip_prefix("---")
        .ok_or_else(|| "SKILL.md is missing YAML frontmatter".to_string())?;
    let body = stripped
        .strip_prefix("\r\n")
        .or_else(|| stripped.strip_prefix('\n'))
        .ok_or_else(|| "SKILL.md frontmatter must start on the next line".to_string())?;
    let end = body
        .find("\n---")
        .or_else(|| body.find("\r\n---"))
        .ok_or_else(|| "SKILL.md frontmatter terminator is missing".to_string())?;
    let yaml = &body[..end];
    let frontmatter: serde_yaml::Value =
        serde_yaml::from_str(yaml).map_err(|error| format!("invalid skill YAML: {error}"))?;

    let name = frontmatter
        .get("name")
        .and_then(serde_yaml::Value::as_str)
        .ok_or_else(|| "skill name is required".to_string())?
        .trim()
        .to_string();
    let description = frontmatter
        .get("description")
        .and_then(serde_yaml::Value::as_str)
        .ok_or_else(|| "skill description is required".to_string())?
        .trim()
        .to_string();
    let version = frontmatter
        .get("version")
        .and_then(serde_yaml::Value::as_str)
        .unwrap_or("1.0.0")
        .trim()
        .to_string();
    let category = frontmatter
        .get("category")
        .and_then(serde_yaml::Value::as_str)
        .unwrap_or("Runtime")
        .trim()
        .to_string();

    if name.len() > 128 || description.len() > 2048 || version.len() > 64 {
        return Err("skill metadata exceeds supported limits".to_string());
    }
    if name.is_empty() || description.is_empty() || version.is_empty() {
        return Err("skill metadata cannot be empty".to_string());
    }

    Ok(SkillMetadata {
        name,
        description,
        version,
        category,
        content: content.to_string(),
    })
}

fn normalize_id(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 128 {
        return Err("invalid skill identifier".to_string());
    }
    if value.bytes().any(|b| b.is_ascii_control()) {
        return Err("invalid skill identifier".to_string());
    }
    Ok(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn parses_safe_skill_metadata() {
        let content = "---
name: repo-review
description: Review repositories
version: 2.0.0
category: Engineering
---
## Procedure
Review files.";
        let parsed = parse_metadata(content).unwrap();
        assert_eq!(parsed.name, "repo-review");
        assert_eq!(parsed.version, "2.0.0");
        assert_eq!(parsed.category, "Engineering");
        assert_eq!(parsed.content, content);
    }

    #[test]
    fn rejects_missing_frontmatter() {
        assert!(parse_metadata("## Procedure
Do work").is_err());
    }

    #[test]
    fn rejects_oversized_metadata() {
        let content = format!("---
name: x
description: {}\n---
", "a".repeat(MAX_SKILL_BYTES));
        assert!(parse_metadata(&content).is_err());
    }
}
