export type LicenseStatus =
  | "verified-mit"
  | "non-mit"
  | "unknown"
  | "mixed"
  | "review-required";

export type ComponentDecision =
  | "integrate"
  | "adapt"
  | "reference"
  | "exclude";

export interface SourceRepository {
  readonly id: string;
  readonly url: string;
  readonly ref?: string;
  readonly localPath: string;
  readonly licenseStatus: LicenseStatus;
  readonly licenseFiles: readonly string[];
  readonly importedAt: string;
  readonly sourceCommit?: string;
}

export interface ComponentCandidate {
  readonly sourceId: string;
  readonly path: string;
  readonly category:
    | "agent"
    | "model-provider"
    | "tool"
    | "memory"
    | "workflow"
    | "orchestration"
    | "sandbox"
    | "browser"
    | "ui"
    | "api"
    | "testing"
    | "other";
  readonly decision: ComponentDecision;
  readonly reasons: readonly string[];
  readonly score: number;
}

export interface SourceManifest {
  readonly schemaVersion: 1;
  readonly repositories: readonly SourceRepository[];
  readonly candidates: readonly ComponentCandidate[];
}

export interface ForgeOptions {
  readonly destination: string;
  readonly ref?: string;
  readonly shallow?: boolean;
  readonly recurseSubmodules?: boolean;
}

export interface ScanResult {
  readonly repository: SourceRepository;
  readonly candidates: readonly ComponentCandidate[];
  readonly warnings: readonly string[];
}
