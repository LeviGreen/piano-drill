import { describe, expect, it } from 'vitest'
import { shouldAccept } from './corpus'
import { flatten, regressions, summarize, type ClipResult } from './metrics'

const r = (o: Partial<ClipResult>): ClipResult => ({
  id: 'x',
  category: 'single',
  source: 'synthetic',
  played: [60],
  expected: [60],
  detected: [60],
  accepted: true,
  shouldAccept: true,
  onsetsFound: 1,
  ...o,
})

describe('shouldAccept', () => {
  it('is true only when played equals expected', () => {
    expect(shouldAccept({ played: [60, 64], expected: [64, 60] })).toBe(true)
    expect(shouldAccept({ played: [61], expected: [60] })).toBe(false)
    expect(shouldAccept({ played: [60, 67], expected: [60] })).toBe(false)
    expect(shouldAccept({ played: [], expected: [60] })).toBe(false)
  })
})

describe('summarize', () => {
  it('computes accept rates over positives and negatives separately', () => {
    const s = summarize([
      r({}),
      r({ accepted: false }),
      r({ shouldAccept: false, played: [61], accepted: true }),
      r({ shouldAccept: false, played: [], detected: [], accepted: false, onsetsFound: 0 }),
    ])
    expect(s.verification.correctAcceptRate).toBe(0.5)
    expect(s.verification.falseAcceptRate).toBe(0.5)
    expect(s.verification).toMatchObject({ positives: 2, negatives: 2 })
  })

  it('computes note precision and recall', () => {
    const s = summarize([r({ played: [60, 64, 67], detected: [60, 64, 70, 72] })])
    expect(s.notes.precision).toBeCloseTo(2 / 4)
    expect(s.notes.recall).toBeCloseTo(2 / 3)
  })

  it('counts a missed note heard in another octave as an octave error', () => {
    const s = summarize([r({ played: [60, 64], detected: [72, 64] })])
    expect(s.notes.octaveErrorRate).toBeCloseTo(1 / 2)
    const wrongPitchClass = summarize([r({ played: [60], detected: [61] })])
    expect(wrongPitchClass.notes.octaveErrorRate).toBe(0)
  })

  it('summarises onset error, misses, false onsets and latency', () => {
    const s = summarize([
      r({ onsetErrorMs: -4, detectionLatencyMs: 40 }),
      r({ onsetErrorMs: 10, detectionLatencyMs: 60 }),
      r({ onsetsFound: 0 }),
      r({ played: [], detected: [], onsetsFound: 2, shouldAccept: false }),
    ])
    expect(s.onsets.meanAbsErrorMs).toBe(7)
    expect(s.onsets.missRate).toBeCloseTo(1 / 3)
    expect(s.onsets.falseOnsetsPerNoiseClip).toBe(2)
    expect(s.latency.meanMs).toBe(50)
  })

  it('handles an empty corpus without NaN', () => {
    expect(flatten(summarize([]))['notes.precision']).toBe(0)
  })
})

describe('regressions', () => {
  const base = { 'notes.recall': 0.9, 'verification.falseAcceptRate': 0.05, 'latency.meanMs': 40 }

  it('passes when equal, better, or within tolerance', () => {
    expect(regressions(base, base)).toEqual([])
    expect(
      regressions(
        { 'notes.recall': 0.95, 'verification.falseAcceptRate': 0.01, 'latency.meanMs': 30 },
        base,
      ),
    ).toEqual([])
    expect(
      regressions(
        { 'notes.recall': 0.89, 'verification.falseAcceptRate': 0.06, 'latency.meanMs': 44 },
        base,
      ),
    ).toEqual([])
  })

  it('flags worse recall, higher false-accepts and slower latency beyond tolerance', () => {
    const bad = regressions(
      { 'notes.recall': 0.8, 'verification.falseAcceptRate': 0.2, 'latency.meanMs': 60 },
      base,
    )
    expect(bad).toHaveLength(3)
  })
})
