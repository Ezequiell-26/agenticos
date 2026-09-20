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
    readonly verification_evidence_required_for_verified_status: boolean;
  };
}

const REQUIRED_PROTOCOLS = [
  "event-envelope.schema.json",
  "provider-call.schema.json",
  "tool-call.schema.json",
  "plugin-manifest.schema.json",
  "run-control.schema.json",
  "skill-manifest.schema.json",
  "memory-operation.schema.json",
  "plugin-activation.schema.json",
  "channel-event.schema.json",
  "webhook-trigger.schema.json",
  "provider-descriptor.schema.json",
  "terminal.schema.json",
  "job.schema.json",
  "filesystem-change.schema.json",
  "attachment.schema.json",
  "agent-team.schema.json",
  "mcp-resource.schema.json",
  "a2a-task.schema.json",
  "credential.schema.json",
  "planning.schema.json",
  "change-request.schema.json",
  "package-release.schema.json",
  "trajectory.schema.json",
  "supervisor.schema.json",
  "scope.schema.json",
  "feature-flag.schema.json",
  "management-operation.schema.json",
  "auxiliary-model.schema.json",
  "spill-store.schema.json",
  "code-intelligence.schema.json",
  "migration.schema.json",
] as const;

const REQUIRED_CRATE_NAMES = [
  "kernel", "contracts", "runtime", "execution", "scheduler", "providers",
  "router", "tools", "sandbox", "context", "memory", "skills", "workflows",
  "agents", "projects", "artifacts", "plugins", "gateway", "security",
  "observability", "evaluation", "source-forge",
] as const;

export async function assertArchitectureReadiness(root = process.cwd()): Promise<void> {
  await readRequired(root, "Cargo.toml");
  await readRequired(root, "Cargo.lock");
  await readRequired(root, "LICENSE");
  await readRequired(root, "rust-toolchain.toml");
  await readRequired(root, "contracts/registry.json");
  await readRequired(root, "reference/manifests/mit-repositories.json");
  await readRequired(root, "reference/manifests/capability-parity.json");
  await readRequired(root, "reference/manifests/reference-discovery.json");
  const completenessRaw = await readRequired(root, "reference/manifests/architecture-completeness.json");
  const completeness = JSON.parse(completenessRaw) as {
    schema_version: number;
    capabilities: readonly (readonly [string, string, string])[];
    policy: {
      architecture_only: boolean;
      implementation_requires_step_unlock: boolean;
      canonical_agent_loop_modification_requires_adr: boolean;
      future_scope_preimplementation_forbidden: boolean;
      reference_first: boolean;
      mit_only_canonical_source_integration: boolean;
    };
  };
  assertArchitectureCompletenessManifest(completeness);
  const referenceCorpusRaw = await readRequired(root, "reference/manifests/mit-repositories.json");
  const referenceCorpus = JSON.parse(referenceCorpusRaw) as {
    repositories: readonly {
      repository: string;
      license: string;
      license_verification: { status: string; artifact_sha?: string | null };
    }[];
    policy?: { mandatory_core_references?: readonly string[] };
  };
  assertReferenceCorpusIntegrity(referenceCorpus);
  const contractRegistry = JSON.parse(
    await readRequired(root, "contracts/registry.json"),
  ) as { contracts: readonly { id: string }[] };
  assertCompletenessContractsRegistered(completeness, contractRegistry);
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

  const projectState = await readRequired(root, "reference/PROJECT-STATE.md");
  assertImplementationState(state);
  assertProjectStateConsistency(state, projectState);
}


function assertReferenceCorpusIntegrity(value: {
  repositories?: readonly {
    repository?: string;
    license?: string;
    license_verification?: { status?: string; artifact_sha?: string | null };
  }[];
  policy?: { mandatory_core_references?: readonly string[] };
}): void {
  const repositories = value.repositories ?? [];
  if (repositories.length < 1) {
    throw new AgentiCOSError("MIT reference corpus is empty.", {
      code: "MIT_REFERENCE_CORPUS_EMPTY",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const ids = repositories.map((item) => item.repository).filter(Boolean) as string[];
  if (new Set(ids).size !== ids.length) {
    throw new AgentiCOSError("MIT reference corpus contains duplicate repositories.", {
      code: "MIT_REFERENCE_CORPUS_DUPLICATE",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  for (const item of repositories) {
    if (!item.repository || !item.license || !item.license_verification?.status) {
      throw new AgentiCOSError(
        `MIT reference corpus entry is incomplete: ${item.repository ?? "unknown"}.`,
        {
          code: "MIT_REFERENCE_CORPUS_ENTRY_INCOMPLETE",
          category: "VALIDATION",
          severity: "critical",
        },
      );
    }
    if (!item.license.toUpperCase().includes("MIT")) {
      throw new AgentiCOSError(
        `Non-MIT license present in MIT reference corpus: ${item.repository} (${item.license}).`,
        {
          code: "NON_MIT_REFERENCE_IN_MIT_CORPUS",
          category: "SECURITY",
          severity: "critical",
        },
      );
    }

    if (item.license_verification.artifact_sha === "0000000000000000000000000000000000000000") {
      throw new AgentiCOSError(
        `Synthetic license hash detected for ${item.repository}.`,
        {
          code: "MIT_REFERENCE_SYNTHETIC_HASH",
          category: "SECURITY",
          severity: "critical",
        },
      );
    }
  }

  const mandatory = value.policy?.mandatory_core_references ?? [];
  const corpusSet = new Set(ids);
  for (const repository of mandatory) {
    if (!corpusSet.has(repository)) {
      throw new AgentiCOSError(
        `Mandatory core reference is absent from the MIT corpus: ${repository}.`,
        {
          code: "MANDATORY_REFERENCE_MISSING",
          category: "VALIDATION",
          severity: "critical",
        },
      );
    }
  }
}

function assertArchitectureCompletenessManifest(value: {
  schema_version: number;
  capabilities: readonly (readonly [string, string, string])[];
  policy: {
    architecture_only: boolean;
    implementation_requires_step_unlock: boolean;
    canonical_agent_loop_modification_requires_adr: boolean;
    future_scope_preimplementation_forbidden: boolean;
    reference_first: boolean;
    mit_only_canonical_source_integration: boolean;
  };
}): void {
  if (
    value.schema_version !== 1 ||
    !Array.isArray(value.capabilities) ||
    !value.capabilities.length ||
    !value.policy.architecture_only ||
    !value.policy.implementation_requires_step_unlock ||
    !value.policy.canonical_agent_loop_modification_requires_adr ||
    !value.policy.future_scope_preimplementation_forbidden ||
    !value.policy.reference_first ||
    !value.policy.mit_only_canonical_source_integration
  ) {
    throw new AgentiCOSError("Architecture completeness manifest is invalid or weakened.", {
      code: "ARCHITECTURE_COMPLETENESS_INVALID",
      category: "SECURITY",
      severity: "critical",
    });
  }
}

function assertCompletenessContractsRegistered(
  completeness: { capabilities: readonly (readonly [string, string, string])[] },
  registry: { contracts: readonly { id: string }[] },
): void {
  const ids = new Set(registry.contracts.map((contract) => contract.id));
  for (const capability of completeness.capabilities) {
    const contractId = capability[1];
    if (!ids.has(contractId)) {
      throw new AgentiCOSError(
        `Architecture completeness capability ${capability[0]} references missing contract ${contractId}.`,
        {
          code: "ARCHITECTURE_COMPLETENESS_CONTRACT_MISSING",
          category: "PROTOCOL",
          severity: "critical",
        },
      );
    }
  }
}

function assertProjectStateConsistency(state: ImplementationState, projectState: string): void {
  const stepLine = projectState.match(/Current implementation step:\s*`([^\`]+)`/);
  const statusLine = projectState.match(/Current step status:\s*`([^\`]+)`/);
  if (!stepLine || !statusLine) {
    throw new AgentiCOSError("PROJECT-STATE.md is missing canonical step state.", {
      code: "PROJECT_STATE_MISSING_CANONICAL_STEP",
      category: "VALIDATION",
      severity: "critical",
    });
  }
  if (stepLine[1] !== state.current_step || statusLine[1] !== state.steps.find((step) => step.id === state.current_step)?.status) {
    throw new AgentiCOSError("PROJECT-STATE.md and implementation-state.json disagree.", {
      code: "PROJECT_STATE_MISMATCH",
      category: "VALIDATION",
      severity: "critical",
    });
  }
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
    !state.policy.mit_only_canonical_third_party_source ||
    !state.policy.verification_evidence_required_for_verified_status
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
