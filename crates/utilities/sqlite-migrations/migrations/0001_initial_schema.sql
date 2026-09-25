-- Canonical AgentiCOS SQLite baseline.
-- This is additive and preserves existing durable data.

CREATE TABLE IF NOT EXISTS memory_records (
    memory_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    importance REAL NOT NULL DEFAULT 0.5,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE(namespace, key)
);
CREATE INDEX IF NOT EXISTS idx_memory_namespace_created ON memory_records(namespace, created_at DESC);
CREATE TABLE IF NOT EXISTS memory_embeddings (
    memory_id TEXT PRIMARY KEY,
    embedding TEXT NOT NULL,
    dimension INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mcp_servers (
    server_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    transport TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    timeout_ms INTEGER
);
CREATE TABLE IF NOT EXISTS channel_definitions (
    channel_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_events (
    event_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    received_at TEXT NOT NULL,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evaluation_cases (
    case_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evaluation_results (
    case_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS capability_grants (
    grant_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_requests (
    approval_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
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
);
CREATE TABLE IF NOT EXISTS terminal_sessions (
    terminal_id TEXT PRIMARY KEY,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    exit_code INTEGER
);
CREATE TABLE IF NOT EXISTS terminal_output (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id TEXT NOT NULL,
    stream TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_definitions (
    agent_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_children (
    child_run_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_definitions (
    workflow_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_states (
    workflow_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scheduler_jobs (
    job_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    task TEXT NOT NULL,
    dependencies TEXT NOT NULL,
    priority INTEGER NOT NULL,
    max_attempts INTEGER NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    last_error TEXT,
    job_type TEXT NOT NULL DEFAULT 'agent',
    metadata TEXT NOT NULL DEFAULT '{}',
    lease_owner TEXT,
    lease_token INTEGER NOT NULL DEFAULT 0,
    lease_expires_at INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS run_lease_counters (
    resource_id TEXT PRIMARY KEY,
    next_fencing_token INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS run_leases (
    resource_id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    fencing_token INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    UNIQUE(stream_id, version)
);
CREATE INDEX IF NOT EXISTS idx_events_stream ON events(stream_id, version);
CREATE TABLE IF NOT EXISTS outbox_entries (
    entry_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    event_schema_version INTEGER NOT NULL,
    destination TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    processed_at INTEGER,
    claimed_by TEXT,
    claimed_until INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_claims ON outbox_entries(status, claimed_until, created_at, entry_id);
CREATE TRIGGER IF NOT EXISTS trg_events_to_runtime_outbox
AFTER INSERT ON events
WHEN NEW.stream_id LIKE 'run:%'
BEGIN
    INSERT INTO outbox_entries (
        entry_id, event_type, event_data, event_schema_version, destination,
        attempts, status, created_at, processed_at
    )
    VALUES (
        'runtime:' || NEW.stream_id || ':' || NEW.version || ':' || NEW.event_type || ':v' || NEW.schema_version,
        NEW.event_type, NEW.data, NEW.schema_version, 'runtime',
        0, 'pending', CAST(strftime('%s', 'now') AS INTEGER), NULL
    )
    ON CONFLICT(entry_id) DO NOTHING;
END;
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_id TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_stream ON snapshots(stream_id);
