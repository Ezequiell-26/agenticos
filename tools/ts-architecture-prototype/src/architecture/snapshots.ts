import { createHash, randomUUID } from "node:crypto";
import { AgentiCOSError } from "./errors.js";

export interface WorkspaceFile {
  readonly path: string;
  readonly content: string;
}

export interface WorkspaceSnapshot {
  readonly snapshotId: string;
  readonly workspaceId: string;
  readonly createdAt: string;
  readonly files: readonly WorkspaceFile[];
  readonly contentHash: string;
}

export function createWorkspaceSnapshot(
  workspaceId: string,
  files: readonly WorkspaceFile[],
): WorkspaceSnapshot {
  assertWorkspaceId(workspaceId);
  const normalized = normalizeWorkspaceFiles(files);
  const contentHash = hashFiles(normalized);

  return {
    snapshotId: randomUUID(),
    workspaceId,
    createdAt: new Date().toISOString(),
    files: normalized,
    contentHash,
  };
}

export function assertSnapshotIntegrity(snapshot: WorkspaceSnapshot): void {
  if (!snapshot || typeof snapshot !== "object") {
    throw snapshotError("Snapshot must be an object.");
  }
  assertWorkspaceId(snapshot.workspaceId);
  if (!isNonEmptyString(snapshot.snapshotId)) {
    throw snapshotError("Snapshot id is required.");
  }
  if (!isNonEmptyString(snapshot.createdAt) || Number.isNaN(Date.parse(snapshot.createdAt))) {
    throw snapshotError("Snapshot createdAt is invalid.");
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.contentHash)) {
    throw snapshotError("Snapshot content hash is invalid.");
  }

  const normalized = normalizeWorkspaceFiles(snapshot.files);
  if (normalized.length !== snapshot.files.length) {
    throw snapshotError("Snapshot file list is invalid.");
  }

  const expected = hashFiles(normalized);
  if (expected !== snapshot.contentHash) {
    throw new AgentiCOSError("Workspace snapshot integrity check failed.", {
      code: "SNAPSHOT_INTEGRITY_FAILED",
      category: "PERSISTENCE",
      severity: "critical",
      recoverable: false,
    });
  }
}

export function diffSnapshots(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): readonly string[] {
  assertSnapshotIntegrity(before);
  assertSnapshotIntegrity(after);
  const left = new Map(before.files.map((file) => [file.path, file.content]));
  const right = new Map(after.files.map((file) => [file.path, file.content]));
  const paths = new Set([...left.keys(), ...right.keys()]);
  return [...paths].sort().filter((file) => left.get(file) !== right.get(file));
}

export class InMemoryWorkspace {
  private files: WorkspaceFile[];

  constructor(
    readonly workspaceId: string,
    initialFiles: readonly WorkspaceFile[] = [],
  ) {
    assertWorkspaceId(workspaceId);
    this.files = normalizeWorkspaceFiles(initialFiles);
  }

  snapshot(): WorkspaceSnapshot {
    return createWorkspaceSnapshot(this.workspaceId, this.files);
  }

  replace(snapshot: WorkspaceSnapshot): void {
    assertSnapshotIntegrity(snapshot);
    if (snapshot.workspaceId !== this.workspaceId) {
      throw new AgentiCOSError("Snapshot belongs to another workspace.", {
        code: "SNAPSHOT_WORKSPACE_MISMATCH",
        category: "VALIDATION",
      });
    }
    this.files = normalizeWorkspaceFiles(snapshot.files);
  }

  async transaction<T>(
    mutate: (files: WorkspaceFile[]) => Promise<T> | T,
  ): Promise<T> {
    const before = this.snapshot();
    const working = [...before.files];

    try {
      const result = await mutate(working);
      this.files = normalizeWorkspaceFiles(working);
      return result;
    } catch (error) {
      this.replace(before);
      throw error;
    }
  }
}

function normalizeWorkspaceFiles(
  files: readonly WorkspaceFile[],
): WorkspaceFile[] {
  if (!Array.isArray(files)) {
    throw snapshotError("Workspace files must be an array.");
  }

  const seen = new Set<string>();
  const normalized: WorkspaceFile[] = [];

  for (const file of files) {
    if (!file || typeof file !== "object") {
      throw snapshotError("Workspace file entry is invalid.");
    }
    if (typeof file.path !== "string" || typeof file.content !== "string") {
      throw snapshotError("Workspace file path/content types are invalid.");
    }

    const canonicalPath = canonicalWorkspacePath(file.path);
    if (seen.has(canonicalPath)) {
      throw new AgentiCOSError(
        "Workspace snapshot contains duplicate path: " + canonicalPath,
        {
          code: "SNAPSHOT_DUPLICATE_PATH",
          category: "VALIDATION",
        },
      );
    }

    seen.add(canonicalPath);
    normalized.push({ path: canonicalPath, content: file.content });
  }

  normalized.sort((a, b) => a.path.localeCompare(b.path));
  return normalized;
}

function canonicalWorkspacePath(value: string): string {
  const path = value.replaceAll("\\", "/");

  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new AgentiCOSError("Workspace file path is invalid: " + value, {
      code: "SNAPSHOT_PATH_INVALID",
      category: "SECURITY",
    });
  }

  return path;
}

function assertWorkspaceId(workspaceId: string): void {
  if (!isNonEmptyString(workspaceId)) {
    throw new AgentiCOSError("Workspace id is required.", {
      code: "WORKSPACE_ID_REQUIRED",
      category: "VALIDATION",
    });
  }
}

function hashFiles(files: readonly WorkspaceFile[]): string {
  return createHash("sha256")
    .update(JSON.stringify(files))
    .digest("hex");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function snapshotError(message: string): AgentiCOSError {
  return new AgentiCOSError(message, {
    code: "SNAPSHOT_INVALID",
    category: "VALIDATION",
  });
}
