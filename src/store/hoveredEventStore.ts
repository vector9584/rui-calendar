import { create } from 'zustand'

/**
 * Tracks which event is currently hovered so that all fragments of a multi-day
 * event (rendered as separate cards across different grid cells) can share a
 * single hover highlight instead of only lighting up the fragment under the
 * cursor. Cards subscribe with a boolean selector, so only the previously- and
 * newly-hovered cards re-render.
 */
interface HoveredEventState {
  hoveredEventId: string | null
  setHoveredEventId: (id: string | null) => void
}

export const useHoveredEventStore = create<HoveredEventState>((set) => ({
  hoveredEventId: null,
  setHoveredEventId: (id: string | null) => set({ hoveredEventId: id }),
}))
