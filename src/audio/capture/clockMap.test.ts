import { describe, expect, it } from 'vitest'
import { ClockMap } from './clockMap'

describe('ClockMap', () => {
  it('is empty before any sample', () => {
    const c = new ClockMap()
    expect(c.offsetMs).toBeNull()
    expect(c.toPerformanceMs(1)).toBeNull()
    expect(c.stats().count).toBe(0)
  })

  it('maps both ways with a constant offset', () => {
    const c = new ClockMap()
    for (let t = 1; t <= 10; t++) c.addSample(t, 5000 + t * 1000)
    expect(c.offsetMs).toBe(5000)
    expect(c.toPerformanceMs(12.5)).toBe(17500)
    expect(c.toContextTimeSec(17500)).toBe(12.5)
    expect(c.stats().stdDevMs).toBe(0)
  })

  it('ignores outliers via the median and reports the spread', () => {
    const c = new ClockMap()
    for (let t = 1; t <= 9; t++) c.addSample(t, 100 + t * 1000)
    c.addSample(10, 100 + 10 * 1000 + 40) // one 40 ms hiccup
    expect(c.offsetMs).toBe(100)
    const s = c.stats()
    expect(s.maxDeviationMs).toBe(40)
    expect(s.stdDevMs).toBeGreaterThan(0)
  })

  it('keeps only the most recent samples', () => {
    const c = new ClockMap(3)
    c.addSample(0, 100)
    c.addSample(1, 1100)
    c.addSample(2, 2100)
    c.addSample(3, 3200)
    expect(c.count).toBe(3)
    expect(c.offsetMs).toBe(100)
  })
})
