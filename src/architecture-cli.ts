import { assertArchitecture } from "./architecture/guard.js";

try {
  await assertArchitecture();
  console.log("Architecture guard: PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
