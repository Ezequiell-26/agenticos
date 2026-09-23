#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const required = [
  "crates/presentation/desktop/frontend/package.json",
  "crates/presentation/desktop/frontend/src/App.tsx",
  "crates/presentation/desktop/frontend/src/main.tsx",
  "docs/architecture/CANONICAL-ARCHITECTURE.md",
  "docs/architecture/FRONTEND-ARCHITECTURE.md",
  "docs/architecture/FRONTEND-CHANGELOG.md",
  "docs/ai/SKILLS-CATALOG.md",
  "skills/agenticos-architecture/SKILL.md",
  "skills/agenticos-browser-verification/SKILL.md",
  "skills/agenticos-react-quality/SKILL.md",
  "skills/agenticos-ai-ui/SKILL.md",
  "skills/agenticos-design-system/SKILL.md",
];

for (const file of required) {
  if (!existsSync(file)) {
    console.error("FRONTEND ARCHITECTURE: FAIL — missing " + file);
    process.exit(1);
  }
}

const packageJson = JSON.parse(
  readFileSync("crates/presentation/desktop/frontend/package.json", "utf8"),
);

if (!packageJson.scripts?.dev || !packageJson.scripts?.build) {
  console.error("FRONTEND ARCHITECTURE: FAIL — frontend dev/build scripts are required");
  process.exit(1);
}

console.log("FRONTEND ARCHITECTURE: PASS — frontend contract and persistent playbooks are present.");
