import { readFile } from "node:fs/promises";
import path from "node:path";
import { AgentiCOSError } from "./errors.js";

export interface ContractDescriptor {
  readonly id: string;
  readonly version: number;
  readonly kind: "protocol" | "domain" | "plugin" | "schema";
  readonly compatibility: "backward-compatible" | "breaking";
  readonly requiredCapabilities: readonly string[];
}

export interface ContractImplementation {
  readonly contractId: string;
  readonly implementationId: string;
  readonly version: number;
  readonly capabilities: readonly string[];
}

export interface ContractRegistryDocument {
  readonly schemaVersion: number;
  readonly contracts: readonly ContractDescriptor[];
}

export function assertContractCompatibility(
  contract: ContractDescriptor,
  implementation: ContractImplementation,
): void {
  if (contract.id !== implementation.contractId) {
    throw new AgentiCOSError(
      `Implementation ${implementation.implementationId} targets ${implementation.contractId}, expected ${contract.id}.`,
      { code: "CONTRACT_ID_MISMATCH", category: "PROTOCOL" },
    );
  }
  if (!Number.isInteger(implementation.version) || implementation.version < 1 || implementation.version < contract.version) {
    throw new AgentiCOSError(
      `Implementation ${implementation.implementationId} is incompatible with ${contract.id} v${contract.version}.`,
      { code: "CONTRACT_VERSION_INCOMPATIBLE", category: "PROTOCOL" },
    );
  }

  const capabilities = new Set(implementation.capabilities);

  if (contract.compatibility === "breaking" && implementation.version !== contract.version) {
    throw new AgentiCOSError(
      `Breaking contract ${contract.id} v${contract.version} requires an exact implementation version.`,
      { code: "CONTRACT_VERSION_INCOMPATIBLE", category: "PROTOCOL" },
    );
  }
  for (const capability of contract.requiredCapabilities) {
    if (!capabilities.has(capability)) {
      throw new AgentiCOSError(
        `Implementation ${implementation.implementationId} lacks required capability: ${capability}.`,
        { code: "CONTRACT_CAPABILITY_MISSING", category: "PROTOCOL" },
      );
    }
  }
}

export async function loadContractRegistry(
  filePath = path.join(process.cwd(), "contracts", "registry.json"),
): Promise<ContractRegistryDocument> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    throw new AgentiCOSError("Could not read contract registry.", {
      code: "CONTRACT_REGISTRY_UNREADABLE",
      category: "PERSISTENCE",
      severity: "critical",
      cause: error,
    });
  }

  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    throw new AgentiCOSError("Contract registry is invalid JSON.", {
      code: "CONTRACT_REGISTRY_INVALID_JSON",
      category: "VALIDATION",
      severity: "critical",
      cause: error,
    });
  }

  assertContractRegistry(document);
  return document;
}

export function assertContractRegistry(
  value: unknown,
): asserts value is ContractRegistryDocument {
  if (!isRecord(value)) {
    throw invalidRegistry("Contract registry must be an object.");
  }

  const schemaVersion = value.schemaVersion;
  const contracts = value.contracts;
  if (
    typeof schemaVersion !== "number" ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion !== 1 ||
    !Array.isArray(contracts)
  ) {
    throw invalidRegistry("Contract registry schema is invalid.");
  }

  const ids = new Set<string>();
  for (const item of contracts) {
    if (!isRecord(item)) {
      throw invalidRegistry("Contract registry contains an invalid descriptor.");
    }

    const id = item.id;
    const version = item.version;
    const kind = item.kind;
    const compatibility = item.compatibility;
    const requiredCapabilities = item.requiredCapabilities;

    if (
      typeof id !== "string" ||
      id.trim().length === 0 ||
      typeof version !== "number" ||
      !Number.isInteger(version) ||
      version < 1 ||
      !isContractKind(kind) ||
      !isCompatibility(compatibility) ||
      !Array.isArray(requiredCapabilities) ||
      requiredCapabilities.some(
        (capability) =>
          typeof capability !== "string" || capability.trim().length === 0,
      )
    ) {
      throw invalidRegistry("Contract descriptor is invalid.");
    }

    const capabilities = requiredCapabilities as string[];
    if (new Set(capabilities).size !== capabilities.length) {
      throw invalidRegistry(`Contract ${id} declares duplicate capabilities.`);
    }

    if (ids.has(id)) {
      throw invalidRegistry(`Duplicate contract id: ${id}`);
    }
    ids.add(id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isContractKind(value: unknown): value is ContractDescriptor["kind"] {
  return value === "protocol" || value === "domain" || value === "plugin" || value === "schema";
}

function isCompatibility(
  value: unknown,
): value is ContractDescriptor["compatibility"] {
  return value === "backward-compatible" || value === "breaking";
}

function invalidRegistry(message: string): AgentiCOSError {
  return new AgentiCOSError(message, {
    code: "CONTRACT_REGISTRY_INVALID",
    category: "VALIDATION",
    severity: "critical",
  });
}
