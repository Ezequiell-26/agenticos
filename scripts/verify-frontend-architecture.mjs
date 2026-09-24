#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const required = [
  "crates/presentation/desktop/frontend/package.json",
  "crates/presentation/desktop/frontend/src/App.tsx",
  "crates/presentation/desktop/frontend/src/main.tsx",
  "crates/presentation/desktop/frontend/src/navigation.ts",
  "crates/presentation/desktop/frontend/src/components/ChatEnhancementDock.tsx",
  "crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx",
  "docs/architecture/CANONICAL-ARCHITECTURE.md",
  "docs/architecture/FRONTEND-ARCHITECTURE.md",
  "docs/architecture/FRONTEND-CHANGELOG.md",
  "docs/architecture/FRONTEND-PLATFORM-ARCHITECTURE.md",
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


const launcherSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/NavigationLauncher.tsx",
  "utf8",
);
const globalSearchSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/GlobalSearch.tsx",
  "utf8",
);
const chatSurfaceSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/ChatSurface.tsx",
  "utf8",
);
if (
  !launcherSource.includes('role="combobox"') ||
  !launcherSource.includes('role="listbox"') ||
  !launcherSource.includes('role="option"') ||
  !globalSearchSource.includes('role="listbox"') ||
  !globalSearchSource.includes('role="option"') ||
  !chatSurfaceSource.includes('aria-haspopup="menu"') ||
  !chatSurfaceSource.includes('role="menuitem"') ||
  !chatSurfaceSource.includes('aria-busy={running}')
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — interactive search/menu/busy semantics are required.",
  );
  process.exit(1);
}

const navigationSource = readFileSync("crates/presentation/desktop/frontend/src/navigation.ts", "utf8");
if (!navigationSource.includes("export const navigationItems") || !navigationSource.includes("export function isPlatformMode")) {
  console.error("FRONTEND ARCHITECTURE: FAIL — centralized navigation registry/type guard is required");
  process.exit(1);
}


const appSource = readFileSync("crates/presentation/desktop/frontend/src/App.tsx", "utf8");

if (!appSource.includes("<WorkspaceOverview mode={mode} onNavigate={setMode} />")) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — workspace surfaces must receive the centralized navigation callback.",
  );
  process.exit(1);
}

const platformSource = readFileSync(
  "crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx",
  "utf8",
);
const studioSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/StudioSurface.tsx",
  "utf8",
);
const navigationItems = [...navigationSource.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
const genericFeatureModesSource =
  platformSource.match(/const GENERIC_FEATURE_MODES[\s\S]*?\[([\s\S]*?)\]/)?.[1] ?? "";
const genericFeatureModes = new Set(
  [...genericFeatureModesSource.matchAll(/'([^']+)'/g)].map((match) => match[1]),
);
const exemptModes = new Set(["chat", "settings"]);
const unresolvedModes = navigationItems.filter((id) => {
  if (exemptModes.has(id)) return false;
  const explicitRoute = [appSource, platformSource, studioSource].some((source) =>
    source.includes("mode === '" + id + "'"),
  );
  return !explicitRoute && !genericFeatureModes.has(id);
});

if (unresolvedModes.length > 0) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — navigation modes without a visual route: " +
      unresolvedModes.join(", "),
  );
  process.exit(1);
}

const legacyChat = readFileSync(
  "crates/presentation/desktop/frontend/src/components/ChatInterface.tsx",
  "utf8",
);
if (legacyChat.includes("fetch(") || legacyChat.includes("/api/agent/")) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — compatibility chat must use the service boundary, not direct HTTP.",
  );
  process.exit(1);
}

for (const file of [
  "crates/presentation/desktop/frontend/src/components/AppErrorBoundary.tsx",
  "crates/presentation/desktop/frontend/src/components/WorkspaceDock.tsx",
  "crates/presentation/desktop/frontend/src/workspace-enhancements.css",
]) {
  if (!existsSync(file)) {
    console.error("FRONTEND ARCHITECTURE: FAIL — required shell capability missing " + file);
    process.exit(1);
  }
}

console.log("FRONTEND ARCHITECTURE: PASS — frontend contract, route coverage, runtime boundaries and shell safeguards are present.");
