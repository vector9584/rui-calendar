import { MOBILE_BREAKPOINT, COMPACT_MOBILE_BREAKPOINT } from '@/config'
import { useMatchMedia } from './useMatchMedia'

export function useIsMobile(): boolean {
  return useMatchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
}

export function useIsCompactMobile(): boolean {
  return useMatchMedia(`(max-width: ${COMPACT_MOBILE_BREAKPOINT}px)`)
}
