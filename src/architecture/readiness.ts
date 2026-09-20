import { readFile } from "node:fs/promises";
import path from "node:path";
import { AgentiCOSError } from "./errors.js";

interface ImplementationStep {
  readonly id: string;
  readonly number: number;
  readonly status: "pending" | "locked" | "in_progress" | "verifying" | "correcting" | "verified";
}

interface ImplementationState {
  readonly schema_version: number;
  readonly current_step: string;
  readonly steps: readonly ImplementationStep[];
  readonly policy: {
    readonly one_step_at_a_time: boolean;
    readonly next_step_requires_verified_previous: boolean;
    readonly fail_closed: boolean;
    readonly future_scope_preimplementation_forbidden: boolean;
    readonly reference_lookup_required_for_nontrivial_features: boolean;
    readonly mit_only_canonical_third_party_source: boolean;
  };
}

const REQUIRED_PROTOCOLS = [
  "event-envelope.schema.json",
  "provider-call.schema.json",
  "tool-call.schema.json",
  "plugin-manifest.schema.json",
  "run-control.schema.json",
] as const;

const REQUIRED_CRATE_NAMES = [
  "kernel", "contracts", "runtime", "execution", "scheduler", "providers",
  "router", "tools", "sandbox", "context", "memory", "skills", "workflows",
  "agents", "projects", "artifacts", "plugins", "gateway", "security",
  "observability", "evaluation", "source-forge",
] as const;

export async function assertArchitectureReadiness(root = process.cwd()): Promise<void> {
  await readRequired(root, "Cargo.toml");
  await readRequired(root, "rust-toolchain.toml");
  await readRequired(root, "contracts/registry.json");
  await readRequired(root, "reference/manifests/mit-repositories.json");
  await readRequired(root, "reference/manifests/implementation-state.json");

  for (const protocol of REQUIRED_PROTOCOLS) {
    await readRequired(root, `protocols/schemas/${protocol}`);
  }

  for (const crate of REQUIRED_CRATE_NAMES) {
    await readRequired(root, `crates/${crate}/Cargo.toml`);
    await readRequired(root, `crates/${crate}/src/lib.rs`);
  }

  const state = JSON.parse(
    await readRequired(root, "reference/manifests/implementation-state.json"),
  ) as ImplementationState;

  assertImplementationState(state);
}

function assertImplementationState(state: ImplementationState): void {
  if (state.schema_version !== 1) {
    throw new AgentiCOSError("Implementation state schema is unsupported.", {
      code: "IMPLEMENTATION_STATE_SCHEMA_UNSUPPORTED",
      category: "PROTOCOL",
      severity: "critical",
    });
  }

  if (
    !state.policy.one_step_at_a_time ||
    !state.policy.next_step_requires_verified_previous ||
    !state.policy.fail_closed ||
    !state.policy.future_scope_preimplementation_forbidden ||
    !state.policy.reference_lookup_required_for_nontrivial_features ||
    !state.policy.mit_only_canonical_third_party_source
  ) {
    throw new AgentiCOSError("Sequential implementation policy is not fail-closed.", {
      code: "IMPLEMENTATION_POLICY_WEAKENED",
      category: "SECURITY",
      severity: "critical",
    });
  }

  const ordered = [...state.steps].sort((a, b) => a.number - b.number);
  if (ordered.length === 0) {
    throw new AgentiCOSError("Implementation state has no steps.", {
      code: "IMPLEMENTATION_STATE_EMPTY",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const active = ordered.filter((step) =>
    step.status === "in_progress" || step.status === "verifying" || step.status === "correcting",
  );
  if (active.length > 1) {
    throw new AgentiCOSError("More than one implementation step is active.", {
      code: "MULTIPLE_ACTIVE_STEPS",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const current = ordered.find((step) => step.id === state.current_step);
  if (!current) {
    throw new AgentiCOSError("Current implementation step does not exist.", {
      code: "CURRENT_STEP_UNKNOWN",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const activeStep = active.length === 1 ? active[0] : undefined;

  if (
    activeStep &&
    activeStep.id !== current.id
  ) {
    throw new AgentiCOSError("Current step does not match the active step.", {
      code: "CURRENT_STEP_MISMATCH",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const step = ordered[index];
    const previous = index > 0 ? ordered[index - 1] : undefined;
    if (!step) continue;

    if (step.status === "verified" && previous && previous.status !== "verified") {
      throw new AgentiCOSError(
        `Step ${step.id} is verified before its predecessor ${previous.id}.`,
        {
          code: "STEP_ORDER_VIOLATION",
          category: "VALIDATION",
          severity: "critical",
        },
      );
    }

    if (previous && step.status === "in_progress" && previous.status !== "verified") {
      throw new AgentiCOSError(
        `Step ${step.id} started before predecessor ${previous.id} was verified.`,
        {
          code: "STEP_UNLOCK_VIOLATION",
          category: "SECURITY",
          severity: "critical",
        },
      );
    }
  }
}

async function readRequired(root: string, relativePath: string): Promise<string> {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    throw new AgentiCOSError(
      `Architecture readiness artifact is missing: ${relativePath}`,
      {
        code: "ARCHITECTURE_ARTIFACT_MISSING",
        category: "VALIDATION",
        severity: "critical",
        cause: error,
      },
    );
  }
}
