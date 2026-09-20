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
  {
    version: 3,
    id: "outbox-claim-leases",
    checksum: "sha256:agenticos-outbox-claim-leases-v3",
    up(database) {
      addColumnIfMissing(database, "outbox", "claimed_by", "TEXT");
      addColumnIfMissing(database, "outbox", "claim_id", "TEXT");
      addColumnIfMissing(database, "outbox", "claimed_until", "TEXT");
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_outbox_claimable
        ON outbox(published_at, claimed_until, created_at);
      `);
    },
  },
  {
    version: 4,
    id: "kernel-domain-integrity-preflight",
    checksum: "sha256:agenticos-kernel-domain-integrity-v4",
    up(database) {
      const invalidRuns = database.prepare(`
        SELECT COUNT(*) AS count
        FROM runs
        WHERE state NOT IN (
          'created', 'admitted', 'running', 'waiting', 'paused',
          'cancelling', 'completed', 'failed', 'cancelled'
        )
        OR version < 1
      `).get() as { count: number };

      const invalidSteps = database.prepare(`
        SELECT COUNT(*) AS count
        FROM steps
        WHERE state NOT IN (
          'pending', 'running', 'waiting', 'completed', 'failed', 'cancelled'
        )
        OR version < 1
        OR sequence < 1
      `).get() as { count: number };

      const invalidEvents = database.prepare(`
        SELECT COUNT(*) AS count
        FROM events
        WHERE version < 1 OR length(trim(type)) = 0
      `).get() as { count: number };

      const invalidIdempotency = database.prepare(`
        SELECT COUNT(*) AS count
        FROM idempotency
        WHERE status NOT IN ('in-progress', 'completed', 'failed')
      `).get() as { count: number };

      const invalidInbox = database.prepare(`
        SELECT COUNT(*) AS count
        FROM inbox
        WHERE status NOT IN ('processing', 'completed')
          OR (status = 'completed' AND completed_at IS NULL)
          OR (status = 'processing' AND completed_at IS NOT NULL)
      `).get() as { count: number };

      const invalidCheckpoints = database.prepare(`
        SELECT COUNT(*) AS count
        FROM checkpoints
        WHERE length(content_hash) <> 64
      `).get() as { count: number };

      const invalidOutbox = database.prepare(`
        SELECT COUNT(*) AS count
        FROM outbox
        WHERE (published_at IS NOT NULL AND (
          claimed_by IS NOT NULL OR claim_id IS NOT NULL OR claimed_until IS NOT NULL
        ))
        OR (published_at IS NULL AND (
          (claimed_by IS NULL AND (
            claim_id IS NOT NULL OR claimed_until IS NOT NULL
          ))
          OR
          (claimed_by IS NOT NULL AND (
            claim_id IS NULL OR claimed_until IS NULL
          ))
        ))
      `).get() as { count: number };

      if (
        invalidRuns.count > 0 ||
        invalidSteps.count > 0 ||
        invalidEvents.count > 0 ||
        invalidIdempotency.count > 0 ||
        invalidInbox.count > 0 ||
        invalidCheckpoints.count > 0 ||
        invalidOutbox.count > 0
      ) {
        throw new AgentiCOSError(
          "Existing database contains domain records that fail kernel integrity preflight.",
          {
            code: "DATABASE_DOMAIN_INTEGRITY_FAILED",
            category: "PERSISTENCE",
            severity: "critical",
          },
        );
      }

      database.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_inbox_claim_consistency_insert
        BEFORE INSERT ON inbox
        WHEN (NEW.status = 'completed' AND NEW.completed_at IS NULL)
          OR (NEW.status = 'processing' AND NEW.completed_at IS NOT NULL)
        BEGIN
          SELECT RAISE(ABORT, 'invalid inbox completion state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_inbox_claim_consistency_update
        BEFORE UPDATE OF status, completed_at ON inbox
        WHEN (NEW.status = 'completed' AND NEW.completed_at IS NULL)
          OR (NEW.status = 'processing' AND NEW.completed_at IS NOT NULL)
        BEGIN
          SELECT RAISE(ABORT, 'invalid inbox completion state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_outbox_claim_consistency_insert
        BEFORE INSERT ON outbox
        WHEN (NEW.published_at IS NOT NULL AND (
          NEW.claimed_by IS NOT NULL OR NEW.claim_id IS NOT NULL OR NEW.claimed_until IS NOT NULL
        ))
        OR (NEW.published_at IS NULL AND (
          (NEW.claimed_by IS NULL AND (
            NEW.claim_id IS NOT NULL OR NEW.claimed_until IS NOT NULL
          ))
          OR
          (NEW.claimed_by IS NOT NULL AND (
            NEW.claim_id IS NULL OR NEW.claimed_until IS NULL
          ))
        ))
        BEGIN
          SELECT RAISE(ABORT, 'invalid outbox claim state');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_outbox_claim_consistency_update
        BEFORE UPDATE OF published_at, claimed_by, claim_id, claimed_until ON outbox
        WHEN (NEW.published_at IS NOT NULL AND (
          NEW.claimed_by IS NOT NULL OR NEW.claim_id IS NOT NULL OR NEW.claimed_until IS NOT NULL
        ))
        OR (NEW.published_at IS NULL AND (
          (NEW.claimed_by IS NULL AND (
            NEW.claim_id IS NOT NULL OR NEW.claimed_until IS NOT NULL
          ))
          OR
          (NEW.claimed_by IS NOT NULL AND (
            NEW.claim_id IS NULL OR NEW.claimed_until IS NULL
          ))
        ))
        BEGIN
          SELECT RAISE(ABORT, 'invalid outbox claim state');
        END;
      `);
    },
  },
];

export function applyKernelMigrations(database: Database.Database): number {
  validateMigrationDefinitions(KERNEL_MIGRATIONS);

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const meta = database
    .prepare("SELECT value FROM schema_meta WHERE key='schema_version'")
    .get() as { value: string } | undefined;
  const current = meta ? Number(meta.value) : 0;

  if (!Number.isInteger(current) || current < 0 || current > 4) {
    throw new AgentiCOSError("Database schema version is invalid for kernel migrations.", {
      code: "DATABASE_SCHEMA_VERSION_INVALID",
      category: "PERSISTENCE",
      severity: "critical",
    });
  }

  const rows = database
    .prepare("SELECT version, id, checksum FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: number; id: string; checksum: string }>;

  if (rows.length === 0) {
    database.prepare(`
      INSERT INTO schema_migrations(version, id, checksum, applied_at)
      VALUES(1, 'kernel-baseline-v1', 'sha256:agenticos-kernel-baseline-v1', ?)
    `).run(new Date().toISOString());
  }

  const history = database
    .prepare("SELECT version, id, checksum FROM schema_migrations ORDER BY version")
    .all() as Array<{ version: number; id: string; checksum: string }>;

  let expected = 1;
  const applied = new Map<number, { version: number; id: string; checksum: string }>();

  for (const row of history) {
    if (row.version !== expected) {
      throw new AgentiCOSError(
        "Database migration history has a version gap before " + row.version + ".",
        {
          code: "DATABASE_MIGRATION_HISTORY_GAP",
          category: "PERSISTENCE",
          severity: "critical",
        },
      );
    }
    applied.set(row.version, row);
    expected += 1;
  }

  if (history.length > current) {
    throw new AgentiCOSError(
      "Database migration history is ahead of schema metadata.",
      {
        code: "DATABASE_MIGRATION_HISTORY_AHEAD",
        category: "PERSISTENCE",
        severity: "critical",
      },
    );
  }

  let latest = current;

  for (const migration of KERNEL_MIGRATIONS) {
    const recorded = applied.get(migration.version);

    if (recorded) {
      if (
        recorded.id !== migration.id ||
        recorded.checksum !== migration.checksum
      ) {
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

    if (migration.version <= current) {
      migration.up(database);
      database.prepare(`
        INSERT INTO schema_migrations(version, id, checksum, applied_at)
        VALUES(?, ?, ?, ?)
      `).run(
        migration.version,
        migration.id,
        migration.checksum,
        new Date().toISOString(),
      );
      applied.set(migration.version, migration);
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
    database.prepare(`
      INSERT INTO schema_migrations(version, id, checksum, applied_at)
      VALUES(?, ?, ?, ?)
    `).run(
      migration.version,
      migration.id,
      migration.checksum,
      new Date().toISOString(),
    );
    applied.set(migration.version, migration);
    database
      .prepare(`
        INSERT INTO schema_meta(key, value)
        VALUES('schema_version', ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `)
      .run(String(migration.version));
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
      throw new AgentiCOSError(
        "Kernel migration definitions are invalid.",
        {
          code: "DATABASE_MIGRATION_DEFINITION_INVALID",
          category: "VALIDATION",
          severity: "critical",
        },
      );
    }
    versions.add(migration.version);
    expected += 1;
  }
}

function addColumnIfMissing(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const safeTable = quoteIdentifier(table);
  const columns = database
    .prepare("PRAGMA table_info(" + safeTable + ")")
    .all() as Array<{ name: string }>;

  if (columns.some((item) => item.name === column)) return;

  database.exec(
    "ALTER TABLE " +
      safeTable +
      " ADD COLUMN " +
      quoteIdentifier(column) +
      " " +
      definition,
  );
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
