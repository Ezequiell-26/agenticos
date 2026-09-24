import { useEffect } from 'react'

interface UseMenuKeyboardOptions {
  open: boolean
  menuRef: React.RefObject<HTMLElement | null>
  triggerRef?: React.RefObject<HTMLElement | null>
  onClose: () => void
  initialFocus?: boolean
}

export function useMenuKeyboard({
  open,
  menuRef,
  triggerRef,
  onClose,
  initialFocus = true,
}: UseMenuKeyboardOptions) {
  useEffect(() => {
    if (!open) return

    const getItems = () => Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    )

    const focusIndex = (index: number) => {
      const items = getItems()
      if (!items.length) return
      const bounded = (index + items.length) % items.length
      items[bounded]?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = getItems()
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        triggerRef?.current?.focus()
        return
      }
      if (!items.length) return
      const currentIndex = items.indexOf(document.activeElement as HTMLElement)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusIndex(currentIndex < 0 ? 0 : currentIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusIndex(currentIndex < 0 ? items.length - 1 : currentIndex - 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        focusIndex(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusIndex(items.length - 1)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && menuRef.current && !menuRef.current.contains(target) && !triggerRef?.current?.contains(target)) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)

    if (initialFocus) {
      window.requestAnimationFrame(() => focusIndex(0))
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open, menuRef, triggerRef, onClose, initialFocus])
}
