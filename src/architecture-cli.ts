import {
  assertContractRegistry,
  loadContractRegistry,
} from "./architecture/contracts.js";
import { assertArchitecture } from "./architecture/guard.js";
import { assertArchitectureReadiness } from "./architecture/readiness.js";

try {
  await assertArchitecture();
  await assertArchitectureReadiness();
  const registry = await loadContractRegistry();
  assertContractRegistry(registry);
  console.log(
    "Architecture foundation: PASS | contracts: " + registry.contracts.length + " | sequential gate: PASS",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
