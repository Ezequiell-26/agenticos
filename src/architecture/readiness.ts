import { readFile } from "node:fs/promises";
import path from "node:path";
import { AgentiCOSError } from "./errors.js";

type WorkstreamStatus = "planned" | "in_progress" | "verifying" | "completed";

type CapabilityStatus = "planned" | "in_progress" | "implemented-unverified" | "verified" | "blocked";

interface ImplementationState {
  readonly schema_version: number;
  readonly project: string;
  readonly mode: "capability-driven-continuous";
  readonly baseline_commit: string;
  readonly policy: {
    readonly sequential_implementation: false;
    readonly parallel_workstreams_allowed: true;
    readonly capability_level_verification: true;
    readonly evidence_required_for_verified_status: true;
    readonly production_completeness_requires_integration: true;
    readonly regression_is_blocking: true;
    readonly destructive_operations_require_explicit_authorization: true;
    readonly preserve_git_history: true;
  };
  readonly current_operation: {
    readonly id: string;
    readonly status: WorkstreamStatus;
    readonly focus: string;
    readonly objective: string;
    readonly next_actions: readonly string[];
  };
  readonly workstreams: readonly {
    readonly id: string;
    readonly priority: "P0" | "P1" | "P2";
    readonly status: WorkstreamStatus;
    readonly owner: string;
    readonly objective: string;
  }[];
  readonly capabilities: readonly {
    readonly id: string;
    readonly owner: string;
    readonly status: CapabilityStatus;
  }[];
  readonly verification: {
    readonly required_checks: readonly string[];
    readonly last_known_green: string;
    readonly ci_pending: boolean;
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

const REQUIRED_CRATE_PATHS = [
  "crates/domain/contracts",
  "crates/domain/brain",
  "crates/application/execution",
  "crates/application/workflows",
  "crates/application/scheduler",
  "crates/application/agents",
  "crates/infrastructure/kernel",
  "crates/infrastructure/runtime",
  "crates/infrastructure/providers",
  "crates/infrastructure/tools",
  "crates/infrastructure/memory",
  "crates/infrastructure/context",
  "crates/infrastructure/protocols",
  "crates/infrastructure/sandbox",
  "crates/infrastructure/source-forge",
  "crates/infrastructure/observability",
  "crates/infrastructure/evaluation",
  "crates/infrastructure/security",
  "crates/infrastructure/adapters",
  "crates/presentation/cli",
  "crates/presentation/gateway",
  "crates/presentation/desktop",
  "crates/presentation/api-server",
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
      capability_level_verification: boolean;
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

  for (const cratePath of REQUIRED_CRATE_PATHS) {
    await readRequired(root, `${cratePath}/Cargo.toml`);
    await assertCrateEntryPoint(root, cratePath);
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
    capability_level_verification: boolean;
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
    value.policy.implementation_requires_step_unlock ||
    !value.policy.capability_level_verification ||
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
  const modeLine = projectState.match(/Architecture mode:\s*\*\*([^*]+)\*\*/);
  const focusLine = projectState.match(/Current focus:\s*([^\n]+)/);
  const statusLine = projectState.match(/Current operation status:\s*([^\n]+)/);

  if (!modeLine || !focusLine || !statusLine) {
    throw new AgentiCOSError("PROJECT-STATE.md is missing canonical capability state.", {
      code: "PROJECT_STATE_MISSING_CANONICAL_CAPABILITY_STATE",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const mode = modeLine[1]?.trim();
  const focus = focusLine[1]?.replaceAll("`", "").trim();
  const status = statusLine[1]?.replaceAll("`", "").trim();
  if (mode !== state.mode || focus !== state.current_operation.focus || status !== state.current_operation.status) {
    throw new AgentiCOSError("PROJECT-STATE.md and implementation-state.json disagree.", {
      code: "PROJECT_STATE_MISMATCH",
      category: "VALIDATION",
      severity: "critical",
    });
  }
}

function assertImplementationState(state: ImplementationState): void {
  if (state.schema_version !== 2 || state.mode !== "capability-driven-continuous") {
    throw new AgentiCOSError("Implementation state schema is unsupported.", {
      code: "IMPLEMENTATION_STATE_SCHEMA_UNSUPPORTED",
      category: "PROTOCOL",
      severity: "critical",
    });
  }

  if (
    state.policy.sequential_implementation ||
    !state.policy.parallel_workstreams_allowed ||
    !state.policy.capability_level_verification ||
    !state.policy.evidence_required_for_verified_status ||
    !state.policy.production_completeness_requires_integration ||
    !state.policy.regression_is_blocking ||
    !state.policy.destructive_operations_require_explicit_authorization ||
    !state.policy.preserve_git_history
  ) {
    throw new AgentiCOSError("Capability-driven implementation policy is not fail-closed.", {
      code: "IMPLEMENTATION_POLICY_WEAKENED",
      category: "SECURITY",
      severity: "critical",
    });
  }

  if (!state.current_operation.id || !state.current_operation.focus || !state.current_operation.objective) {
    throw new AgentiCOSError("Current capability operation is incomplete.", {
      code: "CURRENT_OPERATION_INVALID",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  if (state.workstreams.length === 0) {
    throw new AgentiCOSError("Implementation state has no workstreams.", {
      code: "WORKSTREAM_STATE_EMPTY",
      category: "VALIDATION",
      severity: "critical",
    });
  }
  const workstreamIds = new Set<string>();
  for (const workstream of state.workstreams) {
    if (workstreamIds.has(workstream.id)) {
      throw new AgentiCOSError("Implementation state contains duplicate workstream ids.", {
        code: "WORKSTREAM_ID_DUPLICATE",
        category: "VALIDATION",
        severity: "critical",
      });
    }
    workstreamIds.add(workstream.id);
  }
  if (!workstreamIds.has(state.current_operation.focus)) {
    throw new AgentiCOSError("Current operation focus is not a registered workstream.", {
      code: "CURRENT_WORKSTREAM_UNKNOWN",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  if (state.capabilities.length === 0) {
    throw new AgentiCOSError("Implementation state has no capabilities.", {
      code: "CAPABILITY_STATE_EMPTY",
      category: "VALIDATION",
      severity: "critical",
    });
  }
  const capabilityIds = new Set<string>();
  for (const capability of state.capabilities) {
    if (capabilityIds.has(capability.id)) {
      throw new AgentiCOSError("Implementation state contains duplicate capability ids.", {
        code: "CAPABILITY_ID_DUPLICATE",
        category: "VALIDATION",
        severity: "critical",
      });
    }
    capabilityIds.add(capability.id);
  }

  if (state.verification.required_checks.length === 0) {
    throw new AgentiCOSError("Implementation state declares no verification checks.", {
      code: "VERIFICATION_CHECKS_EMPTY",
      category: "VALIDATION",
      severity: "critical",
    });
  }
}


async function assertCrateEntryPoint(root: string, cratePath: string): Promise<void> {
  try {
    await readFile(path.join(root, cratePath, "src/lib.rs"), "utf8");
    return;
  } catch {
    // Binary-only crates use main.rs instead of lib.rs.
  }

  try {
    await readFile(path.join(root, cratePath, "src/main.rs"), "utf8");
    return;
  } catch (error) {
    throw new AgentiCOSError(
      `Architecture readiness artifact is missing an entry point: ${cratePath}/src/lib.rs or ${cratePath}/src/main.rs`,
      {
        code: "CRATE_ENTRYPOINT_MISSING",
        category: "VALIDATION",
        severity: "critical",
        cause: error,
      },
    );
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
