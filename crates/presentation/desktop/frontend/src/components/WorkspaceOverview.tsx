import type { RailMode } from '../navigation'
import { isPlatformMode } from '../navigation'
import PlatformSurface from '../features/platform/PlatformSurface'
import StudioSurface from './StudioSurface'

export default function WorkspaceOverview({ mode }: { mode: Exclude<RailMode, 'chat'> }) {
  return isPlatformMode(mode) ? <PlatformSurface mode={mode} /> : <StudioSurface mode={mode as Exclude<RailMode, 'chat'>} />
}
