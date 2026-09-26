-- Provider plane schema.
-- Provider configuration, credentials, fallback routing and runtime health state
-- are owned by the canonical SQLite migration authority.

CREATE TABLE IF NOT EXISTS providers (
    provider_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    models TEXT NOT NULL,
    capabilities TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_credentials (
    provider_id TEXT NOT NULL,
    credential_type TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    expires_at INTEGER NOT NULL DEFAULT 0,
    scope TEXT,
    PRIMARY KEY (provider_id, credential_type)
);

CREATE TABLE IF NOT EXISTS provider_fallback_configs (
    primary_provider TEXT PRIMARY KEY,
    fallback_providers TEXT NOT NULL,
    auto_failover INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_runtime_state (
    provider_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
