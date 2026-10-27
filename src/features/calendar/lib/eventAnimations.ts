import type { Variants } from 'framer-motion'

/**
 * Shared enter/exit variants for EventCard on the main calendar views.
 *
 * Applied via `motion.div` wrapping the EventCard in each view, paired
 * with `AnimatePresence` so events animate in on add (create / undo /
 * recurring-instance edit) and animate out on remove (delete / move
 * out of the visible range).
 *
 * "Subtle" is the constraint: a quick fade + tiny scale, no y-offset
 * (events are absolutely positioned in the time grid — a y-offset
 * would jump them off their slot during the animation). 180ms is fast
 * enough not to feel laggy when deleting a dozen events in a row,
 * slow enough to actually register.
 *
 * The duration is set per-component via
 * `transition={{ duration: reducedMotion ? 0 : 0.18 }}` to respect the
 * user's OS reduce-motion preference — matches the pattern in
 * src/App.tsx for view transitions.
 */
export const eventCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}
