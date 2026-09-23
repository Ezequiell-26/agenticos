#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = "crates/infrastructure/providers/tests/provider_plane_integration.rs";
const source = readFileSync(path, "utf8");

const requiredTests = [
  "provider_registry_and_model_catalog_compose_across_multiple_providers",
  "provider_failover_follows_declared_order",
  "health_check_drives_failover_selection",
  "retry_policy_and_quota_state_can_be_combined_for_resilient_provider_work",
  "credential_pool_keeps_credentials_scoped_to_their_provider",
  "http_model_provider_executes_against_a_deterministic_local_provider",
];

for (const name of requiredTests) {
  if (!source.includes("async fn " + name)) {
    console.error("PROVIDER INTEGRATION COVERAGE: FAIL — missing " + name);
    process.exit(1);
  }
}

console.log(
  "PROVIDER INTEGRATION COVERAGE: PASS — required provider/failover/health/resilience/multi-provider test cases are present.",
);
