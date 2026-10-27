import { create } from 'zustand'

/**
 * Tracks whether Ctrl/Cmd is currently held during an active event drag, so
 * Ctrl+drag can duplicate the event instead of moving it. A global store
 * (rather than component state) lets every EventCard in the grid react to it
 * without prop-drilling through WeekDayColumn / month-cell wrappers.
 */
interface DragModifierState {
  isDuplicateModifierHeld: boolean
  setDuplicateModifierHeld: (held: boolean) => void
}

export const useDragModifierStore = create<DragModifierState>((set) => ({
  isDuplicateModifierHeld: false,
  setDuplicateModifierHeld: (held: boolean) => set({ isDuplicateModifierHeld: held }),
}))
