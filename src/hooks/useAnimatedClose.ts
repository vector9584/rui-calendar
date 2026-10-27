import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Adds a closing animation to any mount/unmount overlay (modal, dropdown, menu).
 *
 * Generalizes the hand-rolled `isClosing` + delayed-unmount idiom used by
 * EventModal / CommandPalette so every overlay gets a symmetric exit animation
 * from a single source of truth.
 *
 * `rendered` is derived (`isOpen || closing`) so opening is instant with no
 * extra render; only the closing animation is stateful.
 *
 * Usage:
 *   const { rendered, closing, requestClose } = useAnimatedClose(isOpen, onClose)
 *   if (!rendered) return null
 *   <div className={clsx(styles.overlay, closing && styles.closing)}>
 *     ...dismiss handlers call requestClose()...
 *
 * The CSS module should define a `.closing` rule that runs the reverse keyframe.
 */
export function useAnimatedClose(
  isOpen: boolean,
  onClose: () => void,
  duration = 160
): { rendered: boolean; closing: boolean; requestClose: () => void } {
  const [closing, setClosing] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirror of `closing` readable synchronously from effects/callbacks so the
  // parent-close effect doesn't double-trigger an already-running animation.
  const closingRef = useRef(false)
  const prevOpenRef = useRef(isOpen)

  const prefersReducedMotion = useReducedMotion()
  const durationRef = useRef(duration)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
    durationRef.current = prefersReducedMotion ? 0 : duration
  })

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const endClose = useCallback(() => {
    closingRef.current = false
    setClosing(false)
  }, [])

  // Dismiss requested by the consumer: animate out, then tell the parent to close.
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null
      endClose()
      // Mark the upcoming isOpen -> false transition as already handled so the
      // parent-close effect doesn't start a second animation.
      prevOpenRef.current = false
      onCloseRef.current()
    }, durationRef.current)
  }, [clearTimer, endClose])

  // Parent closed us directly (Escape handled upstream, route change, etc.):
  // run the exit animation before `rendered` drops to false.
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = isOpen
    if (isOpen) {
      // Reopened mid-close — cancel any pending exit.
      if (closingRef.current) {
        clearTimer()
        endClose()
      }
    } else if (wasOpen && !closingRef.current) {
      closingRef.current = true
      setClosing(true)
      clearTimer()
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        endClose()
      }, durationRef.current)
    }
  }, [isOpen, clearTimer, endClose])

  useEffect(() => clearTimer, [clearTimer])

  return { rendered: isOpen || closing, closing, requestClose }
}
