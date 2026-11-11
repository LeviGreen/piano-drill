import { useEffect, useState } from 'react'

/**
 * The whole seconds left until the first target, for the 4, 3, 2, 1 countdown (null when there is none to show).
 * `ready` comes from a session snapshot; only the long first get-ready is counted down.
 */
export function useCountdown(
  ready: { since: number; at: number; first: boolean } | null,
): number | null {
  const [now, setNow] = useState(() => performance.now())
  const counting = ready?.first === true
  useEffect(() => {
    if (!counting) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [counting, ready?.at])
  if (!ready || !ready.first) return null
  // `now` can be a moment stale; the wait itself is a hard ceiling, so the first number is never too big.
  const left = Math.min(ready.at - now, ready.at - ready.since)
  // Whole milliseconds first: the clock has fractions, and 4000.0000001 ms must not count as the fifth second.
  return Math.max(0, Math.ceil(Math.round(left) / 1000))
}
