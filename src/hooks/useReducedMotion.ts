import { useMatchMedia } from './useMatchMedia'

/**
 * Returns whether the user has requested reduced motion via their OS settings
 * (`prefers-reduced-motion: reduce`).
 *
 * Live-updates when the preference changes (e.g. user toggles in System Settings).
 *
 * Use this to:
 * - disable framer-motion animations
 * - skip CSS transitions on hover/focus
 * - avoid auto-scroll-into-view behavior
 *
 * Honors WCAG 2.3.3 (Animation from Interactions).
 *
 * Internally delegates to `useMatchMedia`, which includes a legacy
 * `addListener` fallback so that the existing unit tests (which mock the
 * old API) continue to pass without changes.
 */
export function useReducedMotion(): boolean {
  return useMatchMedia('(prefers-reduced-motion: reduce)')
}
