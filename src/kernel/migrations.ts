import type Database from "better-sqlite3";
import { AgentiCOSError } from "../architecture/errors.js";

export interface KernelMigration {
  readonly version: number;
  readonly id: string;
  readonly checksum: string;
  readonly up: (database: Database.Database) => void;
}

export const KERNEL_MIGRATIONS: readonly KernelMigration[] = [
  {
    version: 2,
    id: "kernel-integrity-guards",
    checksum: "sha256:agenticos-kernel-integrity-v2",
    up(database) {
      database.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_runs_state_insert
        BEFORE INSERT ON runs
        WHEN NEW.state NOT IN (
          'created', 'admitted', 'running', 'waiting', 'paused',
          'cancelling', 'completed', 'failed', 'cancelled'
        )
        BEGIN
          SELECT RAISE(ABORT, 'invalid run state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_runs_state_update
        BEFORE UPDATE OF state ON runs
        WHEN NEW.state NOT IN (
          'created', 'admitted', 'running', 'waiting', 'paused',
          'cancelling', 'completed', 'failed', 'cancelled'
        )
        BEGIN
          SELECT RAISE(ABORT, 'invalid run state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_runs_version_insert
        BEFORE INSERT ON runs
        WHEN NEW.version < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid run version');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_runs_version_update
        BEFORE UPDATE OF version ON runs
        WHEN NEW.version < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid run version');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_state_insert
        BEFORE INSERT ON steps
        WHEN NEW.state NOT IN ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled')
        BEGIN
          SELECT RAISE(ABORT, 'invalid step state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_state_update
        BEFORE UPDATE OF state ON steps
        WHEN NEW.state NOT IN ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled')
        BEGIN
          SELECT RAISE(ABORT, 'invalid step state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_version_insert
        BEFORE INSERT ON steps
        WHEN NEW.version < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid step version');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_version_update
        BEFORE UPDATE OF version ON steps
        WHEN NEW.version < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid step version');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_sequence_insert
        BEFORE INSERT ON steps
        WHEN NEW.sequence < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid step sequence');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_steps_sequence_update
        BEFORE UPDATE OF sequence ON steps
        WHEN NEW.sequence < 1
        BEGIN
          SELECT RAISE(ABORT, 'invalid step sequence');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_events_version_insert
        BEFORE INSERT ON events
        WHEN NEW.version < 1 OR length(trim(NEW.type)) = 0
        BEGIN
          SELECT RAISE(ABORT, 'invalid event');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_idempotency_status_insert
        BEFORE INSERT ON idempotency
        WHEN NEW.status NOT IN ('in-progress', 'completed', 'failed')
        BEGIN
          SELECT RAISE(ABORT, 'invalid idempotency status');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_idempotency_status_update
        BEFORE UPDATE OF status ON idempotency
        WHEN NEW.status NOT IN ('in-progress', 'completed', 'failed')
        BEGIN
          SELECT RAISE(ABORT, 'invalid idempotency status');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_inbox_status_insert
        BEFORE INSERT ON inbox
        WHEN NEW.status NOT IN ('processing', 'completed')
        BEGIN
          SELECT RAISE(ABORT, 'invalid inbox status');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_inbox_status_update
        BEFORE UPDATE OF status ON inbox
        WHEN NEW.status NOT IN ('processing', 'completed')
        BEGIN
          SELECT RAISE(ABORT, 'invalid inbox status');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_checkpoints_hash_insert
        BEFORE INSERT ON checkpoints
        WHEN length(NEW.content_hash) <> 64
        BEGIN
          SELECT RAISE(ABORT, 'invalid checkpoint hash');
        END;
      `);
    },
  },
];

export function applyKernelMigrations(
  database: Database.Database,
): number {
  validateMigrationDefinitions(KERNEL_MIGRATIONS);

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const schemaMeta = database
    .prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'")
    .get() as { value: string } | undefined;

  const currentSchemaVersion = schemaMeta ? Number(schemaMeta.value) : 0;
  if (!Number.isInteger(currentSchemaVersion) || currentSchemaVersion < 0) {
    throw new AgentiCOSError("Database schema version is invalid.", {
      code: "DATABASE_SCHEMA_VERSION_INVALID",
      category: "PERSISTENCE",
      severity: "critical",
    });
  }

  const appliedRows = database
    .prepare("SELECT version, id, checksum FROM schema_migrations ORDER BY version ASC")
    .all() as Array<{ version: number; id: string; checksum: string }>;

  if (appliedRows.length === 0 && currentSchemaVersion >= 1) {
    database.prepare(`
      INSERT INTO schema_migrations(version, id, checksum, applied_at)
      VALUES(1, 'kernel-baseline-v1', 'sha256:agenticos-kernel-baseline-v1', ?)
    `).run(new Date().toISOString());
  }

  const applied = new Map(
    database
      .prepare("SELECT version, id, checksum FROM schema_migrations")
      .all() as Array<{ version: number; id: string; checksum: string }>
  );

  let latest = currentSchemaVersion;
  for (const migration of KERNEL_MIGRATIONS) {
    const recorded = applied.get(migration.version);

    if (migration.version <= latest && !recorded) {
      throw new AgentiCOSError(
        "Database migration history is incomplete at version " + migration.version + ".",
        {
          code: "DATABASE_MIGRATION_HISTORY_INCOMPLETE",
          category: "PERSISTENCE",
          severity: "critical",
        },
      );
    }

    if (recorded) {
      if (recorded.id !== migration.id || recorded.checksum !== migration.checksum) {
        throw new AgentiCOSError(
          "Migration " + migration.version + " was modified after being applied.",
          {
            code: "DATABASE_MIGRATION_CHECKSUM_MISMATCH",
            category: "PERSISTENCE",
            severity: "critical",
          },
        );
      }
      continue;
    }

    if (migration.version !== latest + 1) {
      throw new AgentiCOSError(
        "Database migration gap detected before version " + migration.version + ".",
        {
          code: "DATABASE_MIGRATION_GAP",
          category: "PERSISTENCE",
          severity: "critical",
        },
      );
    }

    migration.up(database);
    const appliedAt = new Date().toISOString();
    database.prepare(`
      INSERT INTO schema_migrations(version, id, checksum, applied_at)
      VALUES(?, ?, ?, ?)
    `).run(migration.version, migration.id, migration.checksum, appliedAt);
    database.prepare(`
      INSERT INTO schema_meta(key, value) VALUES('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(migration.version));

    latest = migration.version;
  }

  return latest;
}

function validateMigrationDefinitions(
  migrations: readonly KernelMigration[],
): void {
  let expected = 2;
  const versions = new Set<number>();

  for (const migration of migrations) {
    if (
      !Number.isInteger(migration.version) ||
      migration.version < 2 ||
      migration.version !== expected ||
      versions.has(migration.version) ||
      !migration.id.trim() ||
      !migration.checksum.trim()
    ) {
      throw new AgentiCOSError("Kernel migration definitions are invalid.", {
        code: "DATABASE_MIGRATION_DEFINITION_INVALID",
        category: "VALIDATION",
        severity: "critical",
      });
    }

    versions.add(migration.version);
    expected += 1;
  }
}
