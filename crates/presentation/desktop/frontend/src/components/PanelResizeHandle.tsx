import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  readUiPreferences,
  subscribeUiPreferences,
  updateUiPreferences,
  type UiPreferences,
} from '../services/ui-preferences'

type ResizeAxis = 'sidebar' | 'inspector'

interface PanelResizeHandleProps {
  axis: ResizeAxis
}

const constraints: Record<ResizeAxis, { key: keyof UiPreferences; min: number; max: number; defaultValue: number }> = {
  sidebar: { key: 'sidebarWidth', min: 210, max: 420, defaultValue: 270 },
  inspector: { key: 'inspectorWidth', min: 280, max: 440, defaultValue: 320 },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function PanelResizeHandle({ axis }: PanelResizeHandleProps) {
  const config = constraints[axis]
  const [size, setSize] = useState(() => {
    const value = readUiPreferences()[config.key]
    return typeof value === 'number' ? value : config.defaultValue
  })
  const dragStart = useRef<{ x: number; size: number; pointerId: number } | null>(null)

  useEffect(() => {
    return subscribeUiPreferences(() => {
      const value = readUiPreferences()[config.key]
      if (typeof value === 'number') setSize(value)
    })
  }, [config.key])

  function applySize(next: number) {
    const value = clamp(Math.round(next), config.min, config.max)
    updateUiPreferences({ [config.key]: value } as Partial<UiPreferences>)
    setSize(value)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    document.documentElement.classList.add('agenticos-resizing-columns')
    dragStart.current = { x: event.clientX, size, pointerId: event.pointerId }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return

    const delta = event.clientX - start.x
    const next = axis === 'sidebar' ? start.size + delta : start.size - delta
    applySize(next)
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start || start.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    document.documentElement.classList.remove('agenticos-resizing-columns')
    dragStart.current = null
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 32 : 16
    const growsWithArrowRight = axis === 'sidebar'
    let delta = 0

    if (event.key === 'ArrowRight') delta = growsWithArrowRight ? step : -step
    if (event.key === 'ArrowLeft') delta = growsWithArrowRight ? -step : step
    if (event.key === 'Home') {
      event.preventDefault()
      applySize(config.min)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      applySize(config.max)
      return
    }

    if (delta !== 0) {
      event.preventDefault()
      applySize(size + delta)
    }
  }

  return (
    <div
      className={'panel-resize-handle panel-resize-handle--' + axis}
      role="separator"
      aria-orientation="vertical"
      aria-label={axis === 'sidebar' ? 'Resize workspace sidebar' : 'Resize agent inspector'}
      aria-valuemin={config.min}
      aria-valuemax={config.max}
      aria-valuenow={size}
      tabIndex={0}
      title="Drag to resize · Arrow keys adjust · Home/End set limits"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true" />
    </div>
  )
}
