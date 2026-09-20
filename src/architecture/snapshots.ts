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
  const normalized = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const contentHash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

  return {
    snapshotId: randomUUID(),
    workspaceId,
    createdAt: new Date().toISOString(),
    files: normalized,
    contentHash,
  };
}

export function assertSnapshotIntegrity(snapshot: WorkspaceSnapshot): void {
  const normalized = [...snapshot.files].sort((a, b) => a.path.localeCompare(b.path));
  const expected = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

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
  return [...paths]
    .sort()
    .filter((file) => left.get(file) !== right.get(file));
}
