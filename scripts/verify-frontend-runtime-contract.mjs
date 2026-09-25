#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const apiFile = await readFile(
  resolve(root, 'crates/presentation/api-server/src/lib.rs'),
  'utf8',
)
const frontendFile = await readFile(
  resolve(root, 'crates/presentation/desktop/frontend/src/services/runtime.ts'),
  'utf8',
)

const apiRoutes = new Set(
  [...apiFile.matchAll(/\.route\(\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith('/api/'))
    .map(normalizeRoute),
)

const frontendPaths = new Set([
  ...frontendFile.matchAll(/["'](\/api\/[^"']*)["']/g),
  ...frontendFile.matchAll(/`(\/api\/[^`]+)`/g),
].map((match) => match[1]).map(normalizeRoute))

const missing = [...frontendPaths]
  .filter((path) => ![...apiRoutes].some((route) => routeMatches(route, path)))
  .sort()

if (missing.length > 0) {
  console.error('Frontend runtime endpoints missing from api-server routes:')
  for (const path of missing) console.error(` - ${path}`)
  process.exit(1)
}

console.log(
  `Frontend/backend runtime contract OK: ${frontendPaths.size} frontend API paths, ${apiRoutes.size} backend routes.`,
)

function normalizeRoute(path) {
  return path
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/\$\{[^}]*$/g, '*')
    .replace(/\{[^}]+\}/g, '*')
    .replace(/\/$/, '')
    .replace(/\/{2,}/g, '/')
}

function routeMatches(route, candidate) {
  const routeSegments = route.split('/')
  const candidateSegments = candidate.split('/')
  if (routeSegments.length !== candidateSegments.length) return false
  return routeSegments.every((segment, index) => {
    if (segment === '*') return candidateSegments[index].length > 0
    return segment === candidateSegments[index]
  })
}
