import { useEffect, useState } from 'react'

/**
 * Core hook for matching a CSS media query.
 *
 * - SSR-safe: returns `false` on the server.
 * - Honors the legacy `addListener` fallback for older browsers / jsdom
 *   test environments that don't implement the modern `addEventListener`.
 */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (): void => setMatches(mql.matches)

    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
    } else {
      // Legacy fallback for older Safari / jsdom
      mql.addListener(handler)
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler)
      } else {
        mql.removeListener(handler)
      }
    }
  }, [query])

  return matches
}
