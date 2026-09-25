#![forbid(unsafe_code)]
#![warn(missing_docs)]

//! Canonical SQLite migration runner for AgentiCOS.

use sqlx::{migrate::Migrator, sqlite::SqlitePoolOptions};

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

/// Apply all embedded AgentiCOS SQLite schema migrations.
pub async fn migrate(database_url: &str) -> Result<(), String> {
    let pool = SqlitePoolOptions::new()
        .min_connections(1)
        .max_connections(2)
        .connect(database_url)
        .await
        .map_err(|error| format!("sqlite migration database connection failed: {error}"))?;

    MIGRATOR
        .run(&pool)
        .await
        .map_err(|error| format!("sqlite migration failed: {error}"))
}
