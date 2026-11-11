import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  it('is null when there is nothing to count down, or for the short wait between targets', () => {
    expect(renderHook(() => useCountdown(null)).result.current).toBeNull()
    expect(
      renderHook(() => useCountdown({ since: 0, at: 1000, first: false })).result.current,
    ).toBeNull()
  })

  it('starts at 4 for the 4-second wait, even when the clock has fractions of a millisecond', () => {
    // 123.456789 + 4000 - 123.456789 is not exactly 4000 in floating point.
    const since = performance.now() + 123.456789
    const { result } = renderHook(() => useCountdown({ since, at: since + 4000, first: true }))
    expect(result.current).toBe(4)
  })

  it('never starts higher than the wait itself, even if the clock reading is stale', () => {
    const now = performance.now()
    // The wait began in the future relative to a reading taken at mount: the count is capped at the wait length.
    const { result } = renderHook(() =>
      useCountdown({ since: now + 500, at: now + 4500, first: true }),
    )
    expect(result.current).toBe(4)
  })

  it('shows … (zero) once the time is up', () => {
    const now = performance.now()
    const { result } = renderHook(() =>
      useCountdown({ since: now - 5000, at: now - 1000, first: true }),
    )
    expect(result.current).toBe(0)
  })
})
