import { SpectralAnalyzer } from '../audio/dsp/SpectralAnalyzer'

/**
 * Cutting one long recording of several notes (played one at a time with rests between) into one clip per note, so a
 * whole range can be recorded in a single take. The note start times are found by the analyzer; the order the notes
 * were played in comes from the label.
 */

/**
 * One step of a sequence label: a single note ("C4"), notes played together joined with "+" ("C4+E4+G4"), and
 * optionally a remark about how it was played after "@" ("C4@soft").
 */
export type SequenceStep = { names: string[]; remark: string | null }

export function parseSequenceToken(token: string): SequenceStep {
  const [notes, remark] = token.split('@')
  return { names: notes.split('+'), remark: remark ?? null }
}

/** Is this take a sequence? Several single notes, or any step with notes joined by "+". */
export function isSequence(category: string, played: (string | number)[]): boolean {
  return (
    played.some((t) => String(t).includes('+')) || (category === 'single' && played.length >= 2)
  )
}

/** Onsets closer together than `minGapSec` are the same note (one note can trigger the detector twice). */
export function mergeOnsets(timesSec: number[], minGapSec = 1.5): number[] {
  const out: number[] = []
  for (const t of [...timesSec].sort((a, b) => a - b)) {
    if (out.length === 0 || t - out[out.length - 1] >= minGapSec) out.push(t)
  }
  return out
}

export type Segment = { startSec: number; endSec: number; onsetSec: number }

export type SegmentPlan =
  | {
      ok: true
      segments: Segment[]
      /** Note starts found after the last listed note, left out. */ ignored: number[]
    }
  | { ok: false; error: string }

/** Room tone kept before a note, and note plus decay kept after it. */
export const LEAD_SEC = 1.5
export const TAIL_SEC = 2.5
/** The least rest between notes that leaves each clip free of its neighbours. */
export const MIN_REST_SEC = 3

/**
 * Where to cut: each clip runs from LEAD_SEC before a note's start to TAIL_SEC after it, and is trimmed so it never
 * reaches the neighbouring notes. Anything found after the last listed note (the click of pressing Stop, say) is
 * ignored and reported in `ignored`, and the last clip stops short of it. Fails, saying why, if fewer notes were
 * found than listed, or two notes were played too close together.
 */
export function planSegments(
  onsetsSec: number[],
  noteCount: number,
  durationSec: number,
): SegmentPlan {
  const all = mergeOnsets(onsetsSec)
  const found = all.slice(0, noteCount)
  const ignored = all.slice(noteCount)
  if (found.length !== noteCount) {
    return {
      ok: false,
      error: `Found ${found.length} notes but the label lists ${noteCount}. Note starts found at: ${all.map((t) => `${t.toFixed(1)} s`).join(', ') || 'none'}.`,
    }
  }
  for (let i = 1; i < found.length; i++) {
    if (found[i] - found[i - 1] < MIN_REST_SEC) {
      return {
        ok: false,
        error: `Notes ${i} and ${i + 1} are only ${(found[i] - found[i - 1]).toFixed(1)} s apart (at ${found[i - 1].toFixed(1)} s and ${found[i].toFixed(1)} s). Leave at least ${MIN_REST_SEC} s between notes.`,
      }
    }
  }
  const segments = found.map((onsetSec, i) => {
    const prev = i > 0 ? found[i - 1] : -Infinity
    const next = i < found.length - 1 ? found[i + 1] : (ignored[0] ?? Infinity)
    return {
      onsetSec,
      startSec: Math.max(0, onsetSec - LEAD_SEC, prev + 1.0),
      endSec: Math.min(durationSec, onsetSec + TAIL_SEC, next - 0.5),
    }
  })
  return { ok: true, segments, ignored }
}

/** When the analyzer says a note started, in seconds (it may report one note more than once; see `mergeOnsets`). */
export function onsetTimes(samples: Float32Array, sampleRate: number): number[] {
  const analyzer = new SpectralAnalyzer({ sampleRate, spectra: false })
  const times: number[] = []
  for (let i = 0; i < samples.length; i += 512)
    for (const f of analyzer.push(samples.subarray(i, i + 512), i))
      for (const o of f.onsets) times.push(o.timeSec)
  return times
}
