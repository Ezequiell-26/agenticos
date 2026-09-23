import { navigationItems, platformModes, primaryRailIds, type NavigationGroup, type RailMode } from './navigation'

export type SurfaceOwner = 'app-shell' | 'studio-surface' | 'platform-surface'

export const appOwnedSurfaceIds: ReadonlySet<RailMode> = new Set(['chat'])
export const studioOwnedSurfaceIds: ReadonlySet<RailMode> = new Set(['files', 'terminal', 'runs', 'agents', 'artifacts', 'settings'])

export function getSurfaceOwner(mode: RailMode): SurfaceOwner | null {
  if (appOwnedSurfaceIds.has(mode)) return 'app-shell'
  if (studioOwnedSurfaceIds.has(mode)) return 'studio-surface'
  if (platformModes.has(mode)) return 'platform-surface'
  return null
}

export type NavigationAuditIssueCode =
  | 'duplicate-navigation-id'
  | 'platform-mode-without-navigation-item'
  | 'duplicate-navigation-label'
  | 'navigation-item-without-detail'
  | 'navigation-item-without-owner'

export interface NavigationAuditIssue {
  code: NavigationAuditIssueCode
  mode: RailMode
  detail: string
}

export interface NavigationAuditReport {
  ok: boolean
  navigationCount: number
  platformCount: number
  primaryRailCount: number
  groupCounts: Record<NavigationGroup, number>
  issues: NavigationAuditIssue[]
}

/**
 * Pure structural audit for the navigation registry.
 *
 * This intentionally does not import React or inspect runtime services.
 * It catches registry drift early and can be reused by QA tooling/tests.
 */
export function auditNavigationRegistry(): NavigationAuditReport {
  const issues: NavigationAuditIssue[] = []
  const ids = new Set<string>()
  const labels = new Set<string>()
  const groupCounts: Record<NavigationGroup, number> = { build: 0, operate: 0, configure: 0, integrate: 0 }

  for (const item of navigationItems) {
    if (ids.has(item.id)) {
      issues.push({
        code: 'duplicate-navigation-id',
        mode: item.id,
        detail: 'The navigation registry contains the same mode more than once.',
      })
    }
    ids.add(item.id)
    groupCounts[item.group] += 1
    if (labels.has(item.label)) {
      issues.push({ code: 'duplicate-navigation-label', mode: item.id, detail: `Navigation label "${item.label}" is reused.` })
    }
    labels.add(item.label)
    if (!item.detail.trim()) {
      issues.push({ code: 'navigation-item-without-detail', mode: item.id, detail: 'Navigation item must provide a non-empty description.' })
    }
    if (getSurfaceOwner(item.id) === null) {
      issues.push({ code: 'navigation-item-without-owner', mode: item.id, detail: 'Navigation item has no declared UI surface owner.' })
    }
  }

  const navigationIdSet = new Set<RailMode>(navigationItems.map((item) => item.id))

  for (const mode of platformModes) {
    if (!navigationIdSet.has(mode)) {
      issues.push({
        code: 'platform-mode-without-navigation-item',
        mode,
        detail: 'A platform mode is registered without navigation metadata.',
      })
    }
  }

  return {
    ok: issues.length === 0,
    navigationCount: navigationItems.length,
    platformCount: platformModes.size,
    primaryRailCount: [...primaryRailIds].filter((id) => navigationIdSet.has(id)).length,
    groupCounts,
    issues,
  }
}

export interface NavigationSurfaceOwnershipReport {
  total: number
  app: number
  studio: number
  platform: number
  unowned: number
}

export function navigationSurfaceOwnership(): NavigationSurfaceOwnershipReport {
  let app = 0
  let studio = 0
  let platform = 0
  let unowned = 0
  for (const item of navigationItems) {
    const owner = getSurfaceOwner(item.id)
    if (owner === 'app-shell') app += 1
    else if (owner === 'studio-surface') studio += 1
    else if (owner === 'platform-surface') platform += 1
    else unowned += 1
  }
  return { total: navigationItems.length, app, studio, platform, unowned }
}
