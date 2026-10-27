import { useRef } from 'react'
import { useDragModifierStore } from '@/store/dragModifierStore'

interface DragDuplicateModifier {
  /** Call from a dnd-kit `onDragStart` handler with `event.activatorEvent`. */
  markDragStart: (activatorEvent: Event | null | undefined) => void
  /** Call from a dnd-kit `onDragEnd` handler once done reading the held state. */
  markDragEnd: () => void
}

/**
 * Tracks Ctrl/Cmd held-during-drag state for Ctrl+drag-to-duplicate.
 *
 * dnd-kit's DragEndEvent doesn't expose live modifier-key state, so this is
 * seeded from the native event dnd-kit captured at drag start (catching a
 * modifier already held before the drag begins), then kept live via window
 * keydown/keyup listeners so toggling the modifier mid-drag updates the
 * duplicate-preview affordance — mirroring Finder/Explorer's copy-drag.
 */
export function useDragDuplicateModifier(): DragDuplicateModifier {
  const listenersRef = useRef<{
    keydown: (e: KeyboardEvent) => void
    keyup: (e: KeyboardEvent) => void
  } | null>(null)

  const markDragStart = (activatorEvent: Event | null | undefined): void => {
    const nativeEvent = activatorEvent as MouseEvent | PointerEvent | null | undefined
    useDragModifierStore
      .getState()
      .setDuplicateModifierHeld(!!(nativeEvent?.ctrlKey || nativeEvent?.metaKey))

    const updateHeld = (e: KeyboardEvent): void => {
      useDragModifierStore.getState().setDuplicateModifierHeld(e.ctrlKey || e.metaKey)
    }

    if (listenersRef.current) {
      window.removeEventListener('keydown', listenersRef.current.keydown)
      window.removeEventListener('keyup', listenersRef.current.keyup)
    }
    listenersRef.current = { keydown: updateHeld, keyup: updateHeld }
    window.addEventListener('keydown', updateHeld)
    window.addEventListener('keyup', updateHeld)
  }

  const markDragEnd = (): void => {
    if (listenersRef.current) {
      window.removeEventListener('keydown', listenersRef.current.keydown)
      window.removeEventListener('keyup', listenersRef.current.keyup)
      listenersRef.current = null
    }
    useDragModifierStore.getState().setDuplicateModifierHeld(false)
  }

  return { markDragStart, markDragEnd }
}
