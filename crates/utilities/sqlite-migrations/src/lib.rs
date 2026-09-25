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

        let migration_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(migration_count, 1);
    }
}
