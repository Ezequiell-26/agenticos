#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error("CARGO DEPENDENCIES: FAIL — " + message);
  process.exit(1);
}

const tree = execFileSync("cargo", ["tree", "--workspace", "--duplicates"], { encoding: "utf8" });
for (const marker of ["reqwest v0.11", "sqlx v0.7"]) {
  if (tree.includes(marker)) fail("forbidden duplicate dependency remains: " + marker);
}

console.log("CARGO DEPENDENCIES: PASS — duplicate audit completed; forbidden reqwest/sqlx drift is absent.");
