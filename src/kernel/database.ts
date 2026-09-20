import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = 1;

export class SqliteDatabase {
  readonly db: Database.Database;

  constructor(filename: string) {
    const directory = path.dirname(path.resolve(filename));
    void mkdir(directory, { recursive: true });

    this.db = new Database(filename);
    this.configure();
    this.migrate();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }

  private configure(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
  }

  private migrate(): void {
    this.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          project_id TEXT,
          thread_id TEXT,
          actor_id TEXT,
          state TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          budget_json TEXT NOT NULL,
          usage_json TEXT NOT NULL,
          error_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_runs_scheduler
          ON runs(state, created_at);

        CREATE TABLE IF NOT EXISTS steps (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          state TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          input_json TEXT,
          output_json TEXT,
          error_json TEXT,
          UNIQUE(run_id, sequence)
        );

        CREATE TABLE IF NOT EXISTS events (
          event_id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          version INTEGER NOT NULL,
          aggregate_id TEXT NOT NULL,
          run_id TEXT,
          created_at TEXT NOT NULL,
          payload_json TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_aggregate
          ON events(aggregate_id, created_at);

        CREATE TABLE IF NOT EXISTS outbox (
          event_id TEXT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          published_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_pending
          ON outbox(published_at, created_at);

        CREATE TABLE IF NOT EXISTS inbox (
          consumer_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          status TEXT NOT NULL,
          claimed_at TEXT NOT NULL,
          completed_at TEXT,
          PRIMARY KEY(consumer_id, event_id)
        );

        CREATE TABLE IF NOT EXISTS idempotency (
          key TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          status TEXT NOT NULL,
          result_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS leases (
          resource_id TEXT PRIMARY KEY,
          lease_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          fencing_token INTEGER NOT NULL,
          acquired_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS checkpoints (
          checkpoint_id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          content_json TEXT NOT NULL,
          content_hash TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_checkpoints_run
          ON checkpoints(run_id, created_at);
      `);

      this.db
        .prepare("INSERT OR IGNORE INTO schema_meta(key, value) VALUES('schema_version', ?)")
        .run(String(SCHEMA_VERSION));

      const versionRow = this.db
        .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;

      if (!versionRow || Number(versionRow.value) !== SCHEMA_VERSION) {
        throw new Error("Unsupported database schema version.");
      }
    });
  }
}
