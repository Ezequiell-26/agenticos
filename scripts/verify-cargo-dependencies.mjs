#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const tree = execFileSync("cargo", ["tree", "--workspace", "--duplicates"], { encoding: "utf8" });
const forbidden = ["reqwest v0.11", "sqlx v0.7"];
const found = forbidden.filter((marker) => tree.includes(marker));
if (found.length) {
  console.error("CARGO DEPENDENCIES: FAIL");
  for (const marker of found) console.error(" - " + marker);
  process.exit(1);
}
console.log("CARGO DEPENDENCIES: PASS — critical dependency-version drift is absent.");
