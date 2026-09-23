import type { RailMode } from './ActivityRail'
import StudioSurface from './StudioSurface'

export default function WorkspaceOverview({ mode }: { mode: Exclude<RailMode, 'chat'> }) {
  return <StudioSurface mode={mode} />
}
