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
  if (implementation.version < contract.version) {
    throw new AgentiCOSError(
      `Implementation ${implementation.implementationId} is too old for ${contract.id} v${contract.version}.`,
      { code: "CONTRACT_VERSION_INCOMPATIBLE", category: "PROTOCOL" },
    );
  }

  if (contract.compatibility === "breaking" && implementation.version !== contract.version) {
    throw new AgentiCOSError(
      `Breaking contract ${contract.id} v${contract.version} requires an exact implementation version.`,
      { code: "CONTRACT_VERSION_INCOMPATIBLE", category: "PROTOCOL" },
    );
  }
  for (const capability of contract.requiredCapabilities) {
    if (!implementation.capabilities.includes(capability)) {
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
  if (!value || typeof value !== "object") {
    throw new AgentiCOSError("Contract registry must be an object.", {
      code: "CONTRACT_REGISTRY_INVALID",
      category: "VALIDATION",
      severity: "critical",
    });
  }

  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || !Array.isArray(record.contracts)) {
    throw new AgentiCOSError("Contract registry schema version is unsupported.", {
      code: "CONTRACT_REGISTRY_SCHEMA_UNSUPPORTED",
      category: "PROTOCOL",
      severity: "critical",
    });
  }

  const ids = new Set<string>();
  for (const item of record.contracts) {
    if (!item || typeof item !== "object") {
      throw new AgentiCOSError("Contract registry contains an invalid descriptor.", {
        code: "CONTRACT_DESCRIPTOR_INVALID",
        category: "VALIDATION",
        severity: "critical",
      });
    }

    const descriptor = item as Record<string, unknown>;
    const id = descriptor.id;
    const version = descriptor.version;
    const kind = descriptor.kind;
    const compatibility = descriptor.compatibility;
    const capabilities = descriptor.requiredCapabilities;

    if (
      typeof id !== "string" ||
      id.length === 0 ||
      !Number.isInteger(version) ||
      Number(version) < 1 ||
      (kind !== "protocol" && kind !== "domain" && kind !== "plugin" && kind !== "schema") ||
      (compatibility !== "backward-compatible" && compatibility !== "breaking") ||
      !Array.isArray(capabilities) ||
      capabilities.some((item) => typeof item !== "string" || item.length === 0)
    ) {
      throw new AgentiCOSError("Contract descriptor id/version is invalid.", {
        code: "CONTRACT_DESCRIPTOR_INVALID",
        category: "VALIDATION",
        severity: "critical",
      });
    }

    if (ids.has(id)) {
      throw new AgentiCOSError(`Duplicate contract id: ${id}`, {
        code: "CONTRACT_DUPLICATE",
        category: "VALIDATION",
        severity: "critical",
      });
    }
    ids.add(id);
  }
}
