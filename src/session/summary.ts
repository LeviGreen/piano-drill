import { answerLabel } from '../keyid/labels'
import type { RepResult } from './types'

/** The numbers an end-of-session summary shows, the same for play and key-ID reps. */
export type SessionSummary = {
  reps: number
  /** Correct (with or without stray notes). */
  correct: number
  incorrect: number
  timedOut: number
  skipped: number
  /** correct / reps, 0 to 1 (0 for no reps). */
  accuracy: number
  /** Median and mean of the time to finish, in ms, over reps that were completed correctly (null if none). */
  medianMs: number | null
  meanMs: number | null
  /** The slowest completed reps, slowest first (up to 3). */
  slowest: { targetId: string; ms: number }[]
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function summarize(results: RepResult[]): SessionSummary {
  const done = results.filter((r) => r.completionMs !== null) as (RepResult & {
    completionMs: number
  })[]
  const times = done.map((r) => r.completionMs)
  const count = (pred: (r: RepResult) => boolean) => results.filter(pred).length
  const correct = count((r) => r.outcome === 'correct' || r.outcome === 'correct_with_errors')
  return {
    reps: results.length,
    correct,
    incorrect: count((r) => r.outcome === 'incorrect'),
    timedOut: count((r) => r.outcome === 'timeout'),
    skipped: count((r) => r.outcome === 'skipped'),
    accuracy: results.length === 0 ? 0 : correct / results.length,
    medianMs: times.length ? median(times) : null,
    meanMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    slowest: [...done]
      .sort((a, b) => b.completionMs - a.completionMs)
      .slice(0, 3)
      .map((r) => ({ targetId: r.targetId, ms: r.completionMs })),
  }
}

/** Which wrong guesses were made for which keys, most frequent first (the data for a confusion matrix). */
export type Confusion = { correct: string; given: string; count: number }

export function confusions(results: RepResult[]): Confusion[] {
  const counts = new Map<string, Confusion>()
  for (const r of results) {
    if (r.mode !== 'keyid' || !r.keyId) continue
    const correct = answerLabel(r.keyId.correct)
    for (const guess of r.keyId.wrong) {
      const given = answerLabel(guess)
      const k = `${correct}→${given}`
      const c = counts.get(k) ?? { correct, given, count: 0 }
      c.count++
      counts.set(k, c)
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.correct.localeCompare(b.correct),
  )
}
