import { useEffect, type RefObject } from 'react'
import { useFocusTrap } from './useFocusTrap'

/**
 * Standard dialog behavior: traps focus inside `containerRef`, closes on Escape,
 * and restores focus to the trigger on unmount (via {@link useFocusTrap}).
 *
 * Use for any modal/dialog so Escape-to-close and focus trapping stay consistent
 * across the app. The container should be the dialog element (with
 * `role="dialog"` `aria-modal="true"`).
 */
export function useModalDismiss(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void
): void {
  useFocusTrap(containerRef, active)

  useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDismiss()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, onDismiss])
}
