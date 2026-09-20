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

export function assertContractCompatibility(
  contract: ContractDescriptor,
  implementation: ContractImplementation,
): void {
  if (contract.id !== implementation.contractId) {
    throw new Error(
      `Implementation ${implementation.implementationId} targets ${implementation.contractId}, expected ${contract.id}.`,
    );
  }
  if (implementation.version < contract.version && contract.compatibility === "breaking") {
    throw new Error(
      `Implementation ${implementation.implementationId} is too old for ${contract.id} v${contract.version}.`,
    );
  }
  for (const capability of contract.requiredCapabilities) {
    if (!implementation.capabilities.includes(capability)) {
      throw new Error(
        `Implementation ${implementation.implementationId} lacks required capability: ${capability}.`,
      );
    }
  }
}
