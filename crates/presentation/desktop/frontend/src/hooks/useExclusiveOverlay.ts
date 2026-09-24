import { useEffect, useRef } from 'react'

type CloseOverlay = () => void

/* Module-level registry: opening one transient overlay closes every other one,
   so two floating surfaces can never stack on top of each other. */
const openOverlays = new Map<string, CloseOverlay>()

export function closeAllOverlays(exceptId?: string) {
  for (const [id, close] of [...openOverlays]) {
    if (id !== exceptId) close()
  }
}

/**
 * Registers a transient overlay (menu, popover, dialog or floating drawer)
 * in the shared exclusivity registry. While `open` is true, any other
 * registered overlay is closed and new ones will close this one.
 */
export function useExclusiveOverlay(id: string, open: boolean, close: CloseOverlay) {
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return
    closeAllOverlays(id)
    const entry: CloseOverlay = () => closeRef.current()
    openOverlays.set(id, entry)
    return () => {
      if (openOverlays.get(id) === entry) openOverlays.delete(id)
    }
  }, [id, open])
}
