import { AgentiCOSError } from "./errors.js";

export interface ChangeGateInput {
  readonly changedFiles: readonly string[];
  readonly changedContracts: readonly string[];
  readonly hasTests: boolean;
  readonly hasArchitectureImpact: boolean;
  readonly hasMigration: boolean;
  readonly migrationTested: boolean;
  readonly securityReviewed: boolean;
}

export interface ChangeGateResult {
  readonly allowed: boolean;
  readonly failures: readonly string[];
}

export function evaluateChangeGates(input: ChangeGateInput): ChangeGateResult {
  const failures: string[] = [];

  if (input.changedFiles.length === 0) failures.push("No changed files supplied.");
  if (input.changedContracts.length > 0 && !input.hasTests) {
    failures.push("Contract changes require tests.");
  }
  if (input.hasMigration && !input.migrationTested) {
    failures.push("Migration changes require migration tests.");
  }
  if (input.hasArchitectureImpact && !input.securityReviewed) {
    failures.push("Architecture-impacting changes require security review.");
  }

  return { allowed: failures.length === 0, failures };
}

export function assertChangeGates(input: ChangeGateInput): void {
  const result = evaluateChangeGates(input);
  if (!result.allowed) {
    throw new AgentiCOSError(
      "Architecture change gates failed: " + result.failures.join(" "),
      {
        code: "CHANGE_GATES_FAILED",
        category: "VALIDATION",
        recoverable: false,
      },
    );
  }
}
