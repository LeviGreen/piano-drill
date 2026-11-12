import { useSyncExternalStore } from 'react'

/** Does the screen match this CSS media query right now (and keep matching as it is resized or rotated)? */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  )
}

/** The phone layout: the same width the app shell switches to its bottom tab bar at. */
export const PHONE_QUERY = '(max-width: 640px)'
