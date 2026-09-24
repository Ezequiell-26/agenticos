#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";

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

const uiPreferencesSource = readFileSync(
  "crates/presentation/desktop/frontend/src/services/ui-preferences.ts",
  "utf8",
);
const resizeHandleSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/PanelResizeHandle.tsx",
  "utf8",
);
if (
  !uiPreferencesSource.includes("export function updateUiPreferences") ||
  !resizeHandleSource.includes('role="separator"') ||
  !resizeHandleSource.includes('aria-valuenow={size}') ||
  !resizeHandleSource.includes("onPointerDown={handlePointerDown}") ||
  !resizeHandleSource.includes("ArrowRight") ||
  !resizeHandleSource.includes("ArrowLeft")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — adjustable panel widths must remain persisted and keyboard/pointer accessible.",
  );
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
const focusTrapSource = readFileSync(
  "crates/presentation/desktop/frontend/src/hooks/useFocusTrap.ts",
  "utf8",
);
const sidebarSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/WorkspaceSidebar.tsx",
  "utf8",
);
const dockSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/WorkspaceDock.tsx",
  "utf8",
);
if (
  !focusTrapSource.includes("FOCUSABLE") ||
  !focusTrapSource.includes("previous?.focus()") ||
  !focusTrapSource.includes("event.key !== 'Tab'") ||
  !sidebarSource.includes('aria-haspopup="menu"') ||
  !sidebarSource.includes("ArrowDown") ||
  !sidebarSource.includes("ArrowUp") ||
  !dockSource.includes('role="tabpanel"') ||
  !dockSource.includes("aria-controls={'workspace-dock-panel-' + item.toLowerCase()}")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — overlay focus, keyboard menus and dock tab semantics are required.",
  );
  process.exit(1);
}

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
const platformBoundarySource = readFileSync(
  "crates/presentation/desktop/frontend/src/features/platform/PlatformSurface.tsx",
  "utf8",
);
if (!platformBoundarySource.includes("<SurfaceErrorBoundary key={mode}>")) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — platform surface recovery must reset when navigation mode changes.",
  );
  process.exit(1);
}

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
  "crates/presentation/desktop/frontend/src/hooks/useMenuKeyboard.ts",
  "crates/presentation/desktop/frontend/src/components/WorkspaceDock.tsx",
  "crates/presentation/desktop/frontend/src/workspace-enhancements.css",
]) {
  if (!existsSync(file)) {
    console.error("FRONTEND ARCHITECTURE: FAIL — required shell capability missing " + file);
    process.exit(1);
  }
}


const menuHookSource = readFileSync(
  "crates/presentation/desktop/frontend/src/hooks/useMenuKeyboard.ts",
  "utf8",
);
const quickActionsSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/QuickActionsMenu.tsx",
  "utf8",
);
const agentPanelSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/AgentPanel.tsx",
  "utf8",
);
if (
  !menuHookSource.includes("ArrowDown") ||
  !menuHookSource.includes("ArrowUp") ||
  !menuHookSource.includes("event.key === 'Home'") ||
  !menuHookSource.includes("event.key === 'End'") ||
  !menuHookSource.includes("pointerdown") ||
  !quickActionsSource.includes('aria-controls="quick-actions-menu"') ||
  !quickActionsSource.includes("useMenuKeyboard") ||
  !agentPanelSource.includes('role="tablist"') ||
  !agentPanelSource.includes('role="tabpanel"') ||
  !agentPanelSource.includes("aria-controls={'agent-panel-' + item.toLowerCase()}") ||
  !agentPanelSource.includes("event.key === 'ArrowRight'")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — shared menu keyboard behavior and inspector tab relationships are required.",
  );
  process.exit(1);
}

if (!appSource.includes('role="status"') || !appSource.includes('aria-live="polite"')) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — runtime state must be exposed through an accessible live region.",
  );
  process.exit(1);
}

const featureWorkbenchSource = readFileSync(
  "crates/presentation/desktop/frontend/src/features/platform/FeatureWorkbench.tsx",
  "utf8",
);
const notificationDrawerSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/NotificationDrawer.tsx",
  "utf8",
);
if (
  !featureWorkbenchSource.includes('role="tablist"') ||
  !featureWorkbenchSource.includes('role="tabpanel"') ||
  !featureWorkbenchSource.includes("aria-controls={'feature-panel-' + tab.toLowerCase()}") ||
  !featureWorkbenchSource.includes("event.key === 'Home'") ||
  !notificationDrawerSource.includes('role="dialog"') ||
  !notificationDrawerSource.includes("onUnreadChange") ||
  !notificationDrawerSource.includes("persistIds")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — reusable feature workbench tabs and global notification state must remain contract-complete.",
  );
  process.exit(1);
}

const navigationLauncherSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/NavigationLauncher.tsx",
  "utf8",
);
if (
  !navigationLauncherSource.includes('launcherRecentKey') ||
  !navigationLauncherSource.includes('launcherFavoritesKey') ||
  !navigationLauncherSource.includes("useState<'All' | 'Recent' | 'Pinned'>") ||
  !navigationLauncherSource.includes("writeIdList(launcherRecentKey") ||
  !navigationLauncherSource.includes("writeIdList(launcherFavoritesKey") ||
  !navigationLauncherSource.includes("event.key.toLowerCase() === 'p'")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — launcher recent/pinned discovery state must remain persistent and keyboard accessible.",
  );
  process.exit(1);
}

const workspaceOverviewSource = readFileSync(
  "crates/presentation/desktop/frontend/src/components/WorkspaceOverview.tsx",
  "utf8",
);
if (
  !workspaceOverviewSource.includes('aria-busy="true"') ||
  !workspaceOverviewSource.includes("surface-loading__skeleton")
) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — workspace surface loading must provide a real skeleton state.",
  );
  process.exit(1);
}


function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = directory + "/" + entry.name;
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    else if (entry.isFile() && fullPath.endsWith(".tsx")) files.push(fullPath);
  }
  return files;
}

const frontendTsxFiles = collectFiles("crates/presentation/desktop/frontend/src");
const semanticViolations = [];
const directNetworkViolations = [];

for (const file of frontendTsxFiles) {
  const raw = readFileSync(file, "utf8");
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  if (source.includes('role="tablist"') && !source.includes('role="tab"')) {
    semanticViolations.push(file + " declares a tablist without a tab");
  }
  if (source.includes('role="tab"') && !source.includes("aria-selected")) {
    semanticViolations.push(file + " declares a tab without aria-selected");
  }
  if (source.includes('role="menu"') && !source.includes('role="menuitem"')) {
    semanticViolations.push(file + " declares a menu without menuitems");
  }
  if (/\bfetch\s*\(/.test(source) && !file.includes("/services/")) {
    directNetworkViolations.push(file);
  }
}

if (semanticViolations.length > 0) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — cross-surface ARIA semantics are incomplete:\n" +
      semanticViolations.join("\n"),
  );
  process.exit(1);
}

if (directNetworkViolations.length > 0) {
  console.error(
    "FRONTEND ARCHITECTURE: FAIL — TSX surfaces must not perform direct network calls:\n" +
      directNetworkViolations.join("\n"),
  );
  process.exit(1);
}

console.log("FRONTEND ARCHITECTURE: PASS — frontend contract, route coverage, runtime boundaries and shell safeguards are present.");
