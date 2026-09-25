import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { AgentiCOSError } from "../architecture/errors.js";
import { applyKernelMigrations } from "./migrations.js";

const LATEST_SCHEMA_VERSION = 4;

export class SqliteDatabase {
  readonly db: Database.Database;

  constructor(filename: string) {
    const resolved = path.resolve(filename);
    mkdirSync(path.dirname(resolved), { recursive: true });

    this.db = new Database(resolved);
    try {
      this.configure();
      this.migrate();
      this.assertHealthy();
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

  integrity(): {
    ok: boolean;
    integrityCheck: string;
    foreignKeyViolations: number;
    schemaVersion: number;
  } {
    const integrityRow = this.db
      .prepare("PRAGMA integrity_check")
      .get() as { integrity_check: string };
    const foreignKeys = this.db.prepare("PRAGMA foreign_key_check").all();
    const schema = this.db
      .prepare("SELECT value FROM schema_meta WHERE key='schema_version'")
      .get() as { value: string } | undefined;
    const schemaVersion = schema ? Number(schema.value) : 0;

    return {
      ok:
        integrityRow.integrity_check === "ok" &&
        foreignKeys.length === 0 &&
        schemaVersion === LATEST_SCHEMA_VERSION,
      integrityCheck: integrityRow.integrity_check,
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

  assertHealthy(): void {
    const integrity = this.db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    if (integrity.integrity_check !== "ok") {
      throw new AgentiCOSError("SQLite integrity check failed.", {
        code: "SQLITE_INTEGRITY_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }

    const foreignKeys = this.db.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeys.length > 0) {
      throw new AgentiCOSError("SQLite foreign key check failed.", {
        code: "SQLITE_FOREIGN_KEY_FAILED",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }
  }

  private configure(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
  }

  private migrate(): void {
    this.transaction(() => {
      this.createBaseSchema();

      const row = this.db
        .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
        .get() as { value: string } | undefined;

      let version = row ? Number(row.value) : 0;

      if (!Number.isInteger(version) || version < 0 || version > LATEST_SCHEMA_VERSION) {
        throw new AgentiCOSError("Unsupported database schema version.", {
          code: "DATABASE_SCHEMA_UNSUPPORTED",
          category: "PERSISTENCE",
          severity: "critical",
        });
      }

      if (version === 0) {
        this.setSchemaVersion(1);
        version = 1;
      }

      if (version < 2) {
        this.applyMigration(2);
        this.setSchemaVersion(2);
        version = 2;
      }

      const migrationVersion = applyKernelMigrations(this.db);
      if (migrationVersion !== LATEST_SCHEMA_VERSION) {
        throw new AgentiCOSError(
          "Kernel migration set did not reach the latest schema version.",
          {
            code: "DATABASE_MIGRATION_INCOMPLETE",
            category: "PERSISTENCE",
            severity: "critical",
          },
        );
      }
    });
  }

  private createBaseSchema(): void {
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
      CREATE INDEX IF NOT EXISTS idx_steps_scheduler ON steps(run_id, state, sequence);

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
      CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, created_at);

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
      CREATE INDEX IF NOT EXISTS idx_leases_expiry ON leases(expires_at);

      CREATE TABLE IF NOT EXISTS checkpoints (
        checkpoint_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON checkpoints(run_id, created_at);
    `);
  }

  private applyMigration(version: number): void {
    if (version !== 2) {
      throw new AgentiCOSError("Unknown database migration: v" + version, {
        code: "DATABASE_MIGRATION_UNKNOWN",
        category: "PERSISTENCE",
        severity: "critical",
      });
    }

    this.addColumnIfMissing("events", "workspace_id", "TEXT");
    this.addColumnIfMissing("events", "project_id", "TEXT");
    this.addColumnIfMissing("events", "thread_id", "TEXT");
    this.addColumnIfMissing("events", "actor_id", "TEXT");
    this.addColumnIfMissing("events", "parent_event_id", "TEXT");
    this.addColumnIfMissing("events", "correlation_id", "TEXT");
    this.addColumnIfMissing("events", "causation_id", "TEXT");
    this.addColumnIfMissing("events", "durable", "INTEGER NOT NULL DEFAULT 1");

    this.addColumnIfMissing("outbox", "attempts", "INTEGER NOT NULL DEFAULT 0");
    this.addColumnIfMissing("outbox", "last_error_json", "TEXT");
    this.addColumnIfMissing("outbox", "next_attempt_at", "TEXT");

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_retry ON outbox(published_at, next_attempt_at, created_at);
    `);

    this.db
      .prepare("UPDATE outbox SET next_attempt_at = created_at WHERE next_attempt_at IS NULL")
      .run();
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.db
      .prepare("PRAGMA table_info(" + quoteIdentifier(table) + ")")
      .all() as Array<{ name: string }>;

    if (columns.some((item) => item.name === column)) return;

    this.db.exec(
      "ALTER TABLE " + quoteIdentifier(table) + " ADD COLUMN " +
      quoteIdentifier(column) + " " + definition,
    );
  }

  private setSchemaVersion(version: number): void {
    this.db
      .prepare(`
        INSERT INTO schema_meta(key, value)
        VALUES('schema_version', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(String(version));
  }
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new AgentiCOSError("Invalid SQLite identifier.", {
      code: "SQLITE_IDENTIFIER_INVALID",
      category: "BUG",
      severity: "critical",
    });
  }
  return '"' + value + '"';
}
