import { useEffect, useState } from 'react'

/** The clock stays hidden until this many seconds are left. */
export const SHOW_CLOCK_AT_SECONDS = 3

/**
 * Whole seconds left for the question or target on screen, shown only for the last few seconds (null when nothing is
 * running, more than that is left, there is no time limit, or the clock has not started). `t0` is when it appeared, on the performance clock.
 */
export function useRemainingSeconds(
  running: boolean,
  t0: number | null,
  limitSeconds: number | null,
): number | null {
  const [now, setNow] = useState(() => performance.now())
  const active = running && t0 !== null && limitSeconds !== null
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(performance.now())
    const first = setTimeout(tick, 0) // so a new question never shows the last one's time
    const id = setInterval(tick, 100)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [active, t0])
  if (!active) return null
  const elapsed = Math.max(0, now - t0)
  const left = Math.max(0, Math.ceil(Math.round(limitSeconds * 1000 - elapsed) / 1000))
  return left <= SHOW_CLOCK_AT_SECONDS ? left : null
}
