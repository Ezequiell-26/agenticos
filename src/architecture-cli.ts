import {
  assertContractRegistry,
  loadContractRegistry,
} from "./architecture/contracts.js";
import { assertArchitecture } from "./architecture/guard.js";

try {
  await assertArchitecture();
  const registry = await loadContractRegistry();
  assertContractRegistry(registry);
  console.log(
    "Architecture guard: PASS | contracts: " + registry.contracts.length,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
