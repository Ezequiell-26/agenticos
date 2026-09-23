import { lazy, Suspense } from 'react'
import type { RailMode } from '../navigation'
import { isPlatformMode } from '../navigation'

const PlatformSurface = lazy(() => import('../features/platform/PlatformSurface'))
const StudioSurface = lazy(() => import('./StudioSurface'))

function SurfaceFallback() {
  return (
    <section className="surface-loading" aria-live="polite">
      <span className="surface-loading__spinner" />
      <div>
        <strong>Loading workspace surface</strong>
        <small>Only the selected feature is being loaded.</small>
      </div>
    </section>
  )
}

export default function WorkspaceOverview({ mode, onNavigate }: { mode: Exclude<RailMode, 'chat'>; onNavigate?: (mode: RailMode) => void }) {
  return (
    <Suspense fallback={<SurfaceFallback />}>
      {isPlatformMode(mode) ? <PlatformSurface mode={mode} onNavigate={onNavigate} /> : <StudioSurface mode={mode as Exclude<RailMode, 'chat'>} />}
    </Suspense>
  )
}
