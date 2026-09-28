use agenticos_sqlite_migrations::migrate_pool;
use sqlx::sqlite::SqlitePoolOptions;

#[tokio::test]
async fn canonical_migrations_create_all_persisted_runtime_tables() {
    let pool = SqlitePoolOptions::new()
        .min_connections(1)
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("sqlite pool");

    migrate_pool(&pool).await.expect("canonical migrations");

    let expected = [
        "a2a_tasks",
        "audit_events",
        "checkpoints",
        "conversations",
        "conversations_fts",
        "model_pricing",
        "model_usage",
        "source_repositories",
        "summaries",
    ];

    for table in expected {
        let exists: Option<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE name = ?")
                .bind(table)
                .fetch_optional(&pool)
                .await
                .expect("schema lookup");

        assert_eq!(
            exists.as_deref(),
            Some(table),
            "missing migrated table: {table}"
        );
    }
}
