import { useCalendarStore } from '../store/calendarStore'

/**
 * True when the keyboard event originates from an editable element (text input,
 * textarea, select, or contentEditable). Global single-key shortcuts should be
 * ignored in these cases so the user can type freely.
 */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target?.isContentEditable ?? false)
  )
}

/**
 * True when global keyboard shortcuts should be suppressed because the user is
 * typing or a modal/overlay owns the interaction. Reads the calendar store
 * imperatively so it can be called from `window` keydown listeners.
 *
 * Note: this intentionally does NOT check for Ctrl/Cmd — some handlers need to
 * process modifier combos (Cmd+K, Cmd+Z) before applying their own guard.
 */
export function shortcutsSuppressed(e: KeyboardEvent): boolean {
  if (isTypingTarget(e)) return true
  const { isModalOpen, isOverlayOpen } = useCalendarStore.getState()
  return isModalOpen || isOverlayOpen
}
