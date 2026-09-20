import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { AgentiCOSError } from "../architecture/errors.js";
import { applyKernelMigrations } from "./migrations.js";

const BASE_SCHEMA_VERSION = 1;
const LATEST_SCHEMA_VERSION = 3;

export interface DatabaseIntegrityReport {
  readonly ok: boolean;
  readonly integrityCheck: string;
  readonly foreignKeyViolations: number;
  readonly schemaVersion: number;
}

export class SqliteDatabase {
  readonly db: Database.Database;

  constructor(filename: string) {
    const resolved = path.resolve(filename);
    mkdirSync(path.dirname(resolved), { recursive: true });

    this.db = new Database(resolved);
    try {
      this.configure();
      this.migrate();
      this.assertIntegrity();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  transactionImmediate<T>(fn: () => T): T {
    return this.db.transaction(fn).immediate();
  }

  close(): void {
    if (this.db.open) this.db.close();
  }

  integrity(): DatabaseIntegrityReport {
    const integrityRow = this.db
      .prepare("PRAGMA integrity_check")
      .get() as { integrity_check: string };
    const foreignKeys = this.db
      .prepare("PRAGMA foreign_key_check")
      .all() as unknown[];
    const schema = this.db
      .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    const schemaVersion = schema ? Number(schema.value) : 0;
    const integrityCheck = integrityRow?.integrity_check ?? "unknown";

    return {
      ok:
        integrityCheck === "ok" &&
        foreignKeys.length === 0 &&
        schemaVersion === LATEST_SCHEMA_VERSION,
      integrityCheck,
      foreignKeyViolations: foreignKeys.length,
      schemaVersion,
    };
  }

  assertIntegrity(): void {
    const report = this.integrity();
    if (report.ok) return;

    throw new AgentiCOSError(
      "SQLite integrity check failed: " +
        report.integrityCheck +
        "; foreignKeyViolations=" +
        report.foreignKeyViolations +
        "; schemaVersion=" +
        report.schemaVersion,
      {
        code: "DATABASE_INTEGRITY_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      },
    );
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
        CREATE INDEX IF NOT EXISTS idx_runs_scheduler ON runs(state, created_at);

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
        CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, created_at);

        CREATE TABLE IF NOT EXISTS outbox (
          event_id TEXT PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          published_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(published_at, created_at);

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
        CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id, created_at);

        INSERT OR IGNORE INTO schema_meta(key, value)
        VALUES('schema_version', 1);

        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          id TEXT NOT NULL UNIQUE,
          checksum TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      applyKernelMigrations(this.db);
      this.assertSchemaVersion();
    });
  }

  private assertSchemaVersion(): void {
    const row = this.db
      .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    if (!row || !/^\d+$/.test(row.value)) {
      throw new AgentiCOSError("Database schema version is missing or invalid.", {
        code: "DATABASE_SCHEMA_VERSION_INVALID",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }

    const version = Number(row.value);
    if (version !== LATEST_SCHEMA_VERSION) {
      throw new AgentiCOSError("Unsupported database schema version: " + version, {
        code: "DATABASE_SCHEMA_VERSION_UNSUPPORTED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }
}
