import type { Category, Source } from './corpus'

export type ClipResult = {
  id: string
  category: Category
  source: Source
  played: number[]
  expected: number[]
  detected: number[]
  accepted: boolean
  shouldAccept: boolean
  /** Number of confirmed onsets the analyzer reported for the clip. */
  onsetsFound: number
  /** Signed error of the first onset vs ground truth, ms (only when ground truth is known). */
  onsetErrorMs?: number
  /** How long after the onset it was reported (analysis-time latency), ms. */
  detectionLatencyMs?: number
}

export type Summary = {
  clips: number
  verification: {
    correctAcceptRate: number
    falseAcceptRate: number
    positives: number
    negatives: number
  }
  notes: { precision: number; recall: number; octaveErrorRate: number }
  onsets: {
    meanAbsErrorMs: number
    p95AbsErrorMs: number
    missRate: number
    falseOnsetsPerNoiseClip: number
  }
  latency: { meanMs: number; p95Ms: number }
}

const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

/** Note-level scores use only clips where notes were really played. */
export function summarize(results: ClipResult[]): Summary {
  const positives = results.filter((r) => r.shouldAccept)
  const negatives = results.filter((r) => !r.shouldAccept)

  let tp = 0
  let detectedTotal = 0
  let playedTotal = 0
  let octaveMisses = 0
  for (const r of results.filter((x) => x.played.length > 0)) {
    const hit = r.detected.filter((n) => r.played.includes(n)).length
    tp += hit
    detectedTotal += r.detected.length
    playedTotal += r.played.length
    // A played note counts as an octave error if it was missed but its pitch class was heard in another octave.
    for (const p of r.played) {
      if (r.detected.includes(p)) continue
      if (r.detected.some((d) => d !== p && d % 12 === p % 12)) octaveMisses++
    }
  }

  const withTruth = results.filter((r) => r.onsetErrorMs !== undefined)
  const errors = withTruth.map((r) => Math.abs(r.onsetErrorMs!))
  const shouldHaveOnset = results.filter((r) => r.played.length > 0)
  const missed = shouldHaveOnset.filter((r) => r.onsetsFound === 0).length
  const noiseClips = results.filter((r) => r.played.length === 0)
  const latencies = results
    .map((r) => r.detectionLatencyMs)
    .filter((x): x is number => x !== undefined)

  return {
    clips: results.length,
    verification: {
      correctAcceptRate: ratio(positives.filter((r) => r.accepted).length, positives.length),
      falseAcceptRate: ratio(negatives.filter((r) => r.accepted).length, negatives.length),
      positives: positives.length,
      negatives: negatives.length,
    },
    notes: {
      precision: ratio(tp, detectedTotal),
      recall: ratio(tp, playedTotal),
      octaveErrorRate: ratio(octaveMisses, playedTotal),
    },
    onsets: {
      meanAbsErrorMs: mean(errors),
      p95AbsErrorMs: percentile(errors, 0.95),
      missRate: ratio(missed, shouldHaveOnset.length),
      falseOnsetsPerNoiseClip: ratio(
        noiseClips.reduce((a, r) => a + r.onsetsFound, 0),
        noiseClips.length,
      ),
    },
    latency: { meanMs: mean(latencies), p95Ms: percentile(latencies, 0.95) },
  }
}

/** Per-category accept rates, to see where the verifier struggles. */
export function byCategory(
  results: ClipResult[],
): Record<string, { clips: number; accepted: number }> {
  const out: Record<string, { clips: number; accepted: number }> = {}
  for (const r of results) {
    const c = (out[r.category] ??= { clips: 0, accepted: 0 })
    c.clips++
    if (r.accepted) c.accepted++
  }
  return out
}

// --- regression thresholds -------------------------------------------------------------------

export type Flat = Record<string, number>

export function flatten(s: Summary): Flat {
  return {
    'verification.correctAcceptRate': s.verification.correctAcceptRate,
    'verification.falseAcceptRate': s.verification.falseAcceptRate,
    'notes.precision': s.notes.precision,
    'notes.recall': s.notes.recall,
    'notes.octaveErrorRate': s.notes.octaveErrorRate,
    'onsets.meanAbsErrorMs': s.onsets.meanAbsErrorMs,
    'onsets.p95AbsErrorMs': s.onsets.p95AbsErrorMs,
    'onsets.missRate': s.onsets.missRate,
    'onsets.falseOnsetsPerNoiseClip': s.onsets.falseOnsetsPerNoiseClip,
    'latency.meanMs': s.latency.meanMs,
    'latency.p95Ms': s.latency.p95Ms,
  }
}

const HIGHER_IS_BETTER = new Set([
  'verification.correctAcceptRate',
  'notes.precision',
  'notes.recall',
])

/** Tolerance before a change counts as a regression: 0.02 for rates, 5 ms for times. */
const tolerance = (key: string) => (key.endsWith('Ms') ? 5 : 0.02)

/** Metrics that got worse than baseline by more than their tolerance. */
export function regressions(current: Flat, baseline: Flat): string[] {
  const out: string[] = []
  for (const [key, base] of Object.entries(baseline)) {
    const now = current[key]
    if (now === undefined) continue
    const worse = HIGHER_IS_BETTER.has(key) ? base - now : now - base
    if (worse > tolerance(key)) out.push(`${key}: ${base.toFixed(3)} -> ${now.toFixed(3)}`)
  }
  return out
}
