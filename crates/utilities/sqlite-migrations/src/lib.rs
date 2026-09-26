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

    migrate_pool(&pool).await
}

/// Apply migrations to an already-open SQLite pool.
///
/// Using the caller's pool keeps SQLite in-memory databases on the same
/// connection and avoids opening a redundant migration connection.
pub async fn migrate_pool(pool: &sqlx::SqlitePool) -> Result<(), String> {
    MIGRATOR
        .run(pool)
        .await
        .map_err(|error| format!("sqlite migration failed: {error}"))?;

    ensure_legacy_columns(pool).await
}

/// Add columns introduced after the original scheduler schema to legacy databases.
async fn ensure_legacy_columns(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let additions = [
        (
            "job_type",
            "ALTER TABLE scheduler_jobs ADD COLUMN job_type TEXT NOT NULL DEFAULT 'agent'",
        ),
        (
            "metadata",
            "ALTER TABLE scheduler_jobs ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'",
        ),
        (
            "lease_owner",
            "ALTER TABLE scheduler_jobs ADD COLUMN lease_owner TEXT",
        ),
        (
            "lease_token",
            "ALTER TABLE scheduler_jobs ADD COLUMN lease_token INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "lease_expires_at",
            "ALTER TABLE scheduler_jobs ADD COLUMN lease_expires_at INTEGER NOT NULL DEFAULT 0",
        ),
        (
            "next_attempt_at",
            "ALTER TABLE scheduler_jobs ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0",
        ),
    ];

    for (column, statement) in additions {
        let exists: Option<String> = sqlx::query_scalar(
            "SELECT name FROM pragma_table_info('scheduler_jobs') WHERE name = ?",
        )
        .bind(column)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("legacy column inspection failed: {error}"))?;

        if exists.is_none() {
            sqlx::query(statement)
                .execute(pool)
                .await
                .map_err(|error| {
                    format!("legacy scheduler column migration failed for {column}: {error}")
                })?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn migration_is_idempotent_and_repairs_legacy_columns() {
        let pool = SqlitePoolOptions::new()
            .min_connections(1)
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::query(
            "CREATE TABLE scheduler_jobs (
                job_id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                task TEXT NOT NULL,
                dependencies TEXT NOT NULL,
                priority INTEGER NOT NULL,
                max_attempts INTEGER NOT NULL,
                state TEXT NOT NULL,
                attempts INTEGER NOT NULL,
                last_error TEXT
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO scheduler_jobs (
                job_id, run_id, task, dependencies, priority, max_attempts, state, attempts, last_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("legacy-job")
        .bind("legacy-run")
        .bind("legacy task")
        .bind("[]")
        .bind(1_i64)
        .bind(3_i64)
        .bind("Ready")
        .bind(0_i64)
        .bind(Option::<String>::None)
        .execute(&pool)
        .await
        .unwrap();

        MIGRATOR.run(&pool).await.unwrap();
        ensure_legacy_columns(&pool).await.unwrap();
        MIGRATOR.run(&pool).await.unwrap();

        for column in [
            "job_type",
            "metadata",
            "lease_owner",
            "lease_token",
            "lease_expires_at",
            "next_attempt_at",
        ] {
            let exists: Option<String> = sqlx::query_scalar(
                "SELECT name FROM pragma_table_info('scheduler_jobs') WHERE name = ?",
            )
            .bind(column)
            .fetch_optional(&pool)
            .await
            .unwrap();
            assert_eq!(exists.as_deref(), Some(column));
        }

        let defaults: (String, String, i64, i64, i64) = sqlx::query_as(
            "SELECT job_type, metadata, lease_token, lease_expires_at, next_attempt_at
             FROM scheduler_jobs WHERE job_id = ?",
        )
        .bind("legacy-job")
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(defaults.0, "agent");
        assert_eq!(defaults.1, "{}");
        assert_eq!(defaults.2, 0);
        assert_eq!(defaults.3, 0);
        assert_eq!(defaults.4, 0);

        let migration_versions: Vec<i64> =
            sqlx::query_scalar("SELECT version FROM _sqlx_migrations ORDER BY version")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(migration_versions, vec![1, 2, 3]);
    }
}
