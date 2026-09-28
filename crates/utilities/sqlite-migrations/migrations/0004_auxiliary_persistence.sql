-- Canonical auxiliary persistence schemas.
-- These tables were historically initialized inline by individual runtime modules.
-- Keep this migration additive and compatible with existing databases.

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_timestamp
    ON conversations(session_id, timestamp);

CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
    id,
    session_id,
    role,
    content,
    timestamp
);

CREATE TABLE IF NOT EXISTS summaries (
    session_id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
    checkpoint_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    state TEXT NOT NULL,
    metadata TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_timestamp
    ON checkpoints(thread_id, timestamp);

CREATE TABLE IF NOT EXISTS a2a_tasks (
    task_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_repositories (
    repo_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    default_branch TEXT NOT NULL,
    last_indexed TEXT NOT NULL,
    license TEXT,
    language TEXT,
    stars INTEGER NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    event_id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT,
    resource TEXT NOT NULL,
    correlation_id TEXT,
    outcome TEXT NOT NULL,
    metadata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp
    ON audit_events(timestamp DESC);

CREATE TABLE IF NOT EXISTS model_pricing (
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    usd_per_million_tokens REAL NOT NULL,
    PRIMARY KEY(provider_id, model_id)
);

CREATE TABLE IF NOT EXISTS model_usage (
    request_id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    recorded_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_usage_recorded_at
    ON model_usage(recorded_at DESC);
