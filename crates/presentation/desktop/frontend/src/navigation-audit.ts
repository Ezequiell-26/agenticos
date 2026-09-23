import { navigationItems, platformModes, type RailMode } from './navigation'

export type NavigationAuditIssueCode =
  | 'duplicate-navigation-id'
  | 'platform-mode-without-navigation-item'

export interface NavigationAuditReport {
  ok: boolean
  navigationCount: number
  platformCount: number
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

  for (const item of navigationItems) {
    if (ids.has(item.id)) {
      issues.push({
        code: 'duplicate-navigation-id',
        mode: item.id,
        detail: 'The navigation registry contains the same mode more than once.',
      })
    }
    ids.add(item.id)
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
    issues,
  }
}
