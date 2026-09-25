#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical SQLite migration runner for AgentiCOS.

use sqlx::{migrate::Migrator, sqlite::SqlitePoolOptions};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Apply all embedded AgentiCOS SQLite schema migrations.
///
/// Legacy databases that predate this migration authority are upgraded by the
/// compatibility phase before the function returns.
pub async fn migrate(database_url: &str) -> Result<(), String> {
    let pool = SqlitePoolOptions::new()
        .min_connections(1)
        .max_connections(4)
        .connect(database_url)
        .await
        .map_err(|error| format!("sqlite migration database connection failed: {error}"))?;

    MIGRATOR
        .run(&pool)
        .await
        .map_err(|error| format!("sqlite migration failed: {error}"))?;

    ensure_legacy_columns(&pool).await
}

async fn ensure_legacy_columns(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| format!("sqlite compatibility transaction failed: {error}"))?;

    for (table, column, definition) in [
        ("outbox_entries", "claimed_by", "TEXT"),
        ("outbox_entries", "claimed_until", "INTEGER"),
        ("scheduler_jobs", "job_type", "TEXT NOT NULL DEFAULT 'agent'"),
        ("scheduler_jobs", "metadata", "TEXT NOT NULL DEFAULT '{}'"),
        ("scheduler_jobs", "lease_owner", "TEXT"),
        ("scheduler_jobs", "lease_token", "INTEGER NOT NULL DEFAULT 0"),
        ("scheduler_jobs", "lease_expires_at", "INTEGER NOT NULL DEFAULT 0"),
        ("scheduler_jobs", "next_attempt_at", "INTEGER NOT NULL DEFAULT 0"),
        ("workflow_states", "version", "INTEGER NOT NULL DEFAULT 0"),
    ] {
        let table_exists: Option<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .bind(table)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| format!("sqlite compatibility table inspection failed: {error}"))?;

        if table_exists.is_none() {
            continue;
        }

        let column_exists: Option<String> = sqlx::query_scalar(&format!(
            "SELECT name FROM pragma_table_info('{table}') WHERE name = ?"
        ))
        .bind(column)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| {
            format!("sqlite compatibility column inspection failed for {table}.{column}: {error}")
        })?;

        if column_exists.is_none() {
            let statement = format!("ALTER TABLE {table} ADD COLUMN {column} {definition}");
            sqlx::query(&statement)
                .execute(&mut *transaction)
                .await
                .map_err(|error| {
                    format!("sqlite compatibility migration failed for {table}.{column}: {error}")
                })?;
        }
    }

    transaction
        .commit()
        .await
        .map_err(|error| format!("sqlite compatibility transaction commit failed: {error}"))
}
