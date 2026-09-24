import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusInitial = () => {
      const target = initialFocusRef?.current ?? container.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.requestAnimationFrame(focusInitial)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [active, containerRef, initialFocusRef])
}
