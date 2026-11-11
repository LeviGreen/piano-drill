import { SpectrumAnalyzer } from '../audio/dsp/spectrum'
import { midiToHz } from '../test-utils/synthPiano'

/**
 * NAIVE BASELINE (PD-306), to be replaced by the target-aware verifier from PD-307.
 *
 * Looks at one 8192-sample window shortly after the onset, scores every piano note by how far its
 * first four partials stand above the median spectrum level, and drops notes that look like
 * harmonics of a stronger lower note. It knows nothing about the expected chord, so it has the
 * known weaknesses PD-307 is meant to fix: octave doublings get dropped as "harmonics", and weak
 * low fundamentals are missed.
 */
const FFT_SIZE = 8192
const LOW = 28
const HIGH = 96
/** A partial counts as present when it is a local peak this many times above its surroundings. */
const PEAK_RATIO = 8
/** Partials (of the first four) that must be present, including the fundamental. */
const MIN_PARTIALS = 3
const HARMONIC_OFFSETS = [12, 19, 24, 28, 31]

const analyzer = new SpectrumAnalyzer(FFT_SIZE)

/** Median of the spectrum around bin k, skipping the peak itself. */
function localLevel(mags: Float64Array, k: number): number {
  const vals: number[] = []
  for (let j = Math.max(1, k - 16); j <= Math.min(mags.length - 1, k + 16); j++) {
    if (Math.abs(j - k) > 2) vals.push(mags[j])
  }
  vals.sort((a, b) => a - b)
  return (vals[vals.length >> 1] ?? 0) + 1e-9
}

export function naiveDetectNotes(
  samples: Float32Array,
  sampleRate: number,
  onsetSec: number,
): number[] {
  const start = Math.round((onsetSec + 0.06) * sampleRate)
  const frame = new Float32Array(FFT_SIZE)
  frame.set(samples.subarray(start, start + FFT_SIZE))
  const mags = new Float64Array(analyzer.binCount)
  analyzer.magnitudes(frame, mags)
  const binHz = sampleRate / FFT_SIZE

  const scores = new Map<number, number>()
  for (let m = LOW; m <= HIGH; m++) {
    let partials = 0
    let fundamental = false
    let score = 0
    for (let h = 1; h <= 4; h++) {
      const f = h * midiToHz(m) * Math.sqrt(1 + 0.0004 * h * h)
      if (f > sampleRate * 0.45) break
      const k = Math.round(f / binHz)
      let best = k
      for (const j of [k - 1, k + 1]) if (mags[j] > mags[best]) best = j
      const ratio = mags[best] / localLevel(mags, best)
      if (ratio >= PEAK_RATIO && mags[best] >= mags[best - 1] && mags[best] >= mags[best + 1]) {
        partials++
        score += Math.log10(ratio)
        if (h === 1) fundamental = true
      }
    }
    if (fundamental && partials >= MIN_PARTIALS) scores.set(m, score)
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const kept: number[] = []
  for (const [m, score] of ranked) {
    const explained = kept.some(
      (lower) => HARMONIC_OFFSETS.includes(m - lower) && score < (scores.get(lower) ?? 0),
    )
    if (!explained) kept.push(m)
  }
  return kept.sort((a, b) => a - b)
}
