import { SCALE_GRACE_SECONDS } from '../keyid/scalePlay'
import type { RepResult } from '../session/types'

/**
 * The arcade score for a session (PD-403). Per target:
 *  - a target you get right earns 100 points;
 *  - a speed bonus adds up to 100 more: full if you finish within the level's goal time, fading to nothing at twice the
 *    goal time;
 *  - each wrong note on the target costs 25 points (a target never goes below 0);
 *  - a timeout or a skip scores 0 (in key ID a wrong guess does not end the question; it costs 25 like a wrong note).
 * A perfect, fast 20-target session is 4000.
 *
 * A key-ID question answered by playing the scale is harder and slower (16 notes in order), so it is weighted:
 * 150 points for getting it right, and the speed bonus is measured against the goal time plus the grace period the
 * question was given. A perfect, fast session of those is 5000.
 */
export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 100
export const WRONG_NOTE_PENALTY = 25
/** Used when a level has no goal time (a custom setup that did not start from a preset). */
export const FALLBACK_GOAL_SECONDS = 3
/** A session is scored and eligible for a high-score board only with this many targets. */
export const SESSION_TARGETS = 20

export const SCALE_BASE_POINTS = 150

const playedScale = (r: Pick<RepResult, 'keyId'>): boolean => r.keyId?.method === 'play'

/** The most one target can earn. */
const maxTargetScore = (r?: Pick<RepResult, 'keyId'>): number =>
  (r && playedScale(r) ? SCALE_BASE_POINTS : BASE_POINTS) + MAX_SPEED_BONUS

/** The most a session of `targets` targets can earn; finished ones are counted as they were answered. */
export const maxScore = (targets: number, results: Pick<RepResult, 'keyId'>[] = []): number =>
  results.reduce((sum, r) => sum + maxTargetScore(r), 0) +
  Math.max(0, targets - results.length) * maxTargetScore()

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Points for one finished target. `goalSeconds` is the level's goal time. */
export function targetScore(
  r: Pick<RepResult, 'outcome' | 'completionMs' | 'errors' | 'keyId'>,
  goalSeconds: number,
): number {
  if ((r.outcome !== 'correct' && r.outcome !== 'correct_with_errors') || r.completionMs === null)
    return 0
  const scale = playedScale(r)
  const goalMs = (goalSeconds + (scale ? SCALE_GRACE_SECONDS : 0)) * 1000
  const bonus = MAX_SPEED_BONUS * clamp01((2 * goalMs - r.completionMs) / goalMs)
  const base = scale ? SCALE_BASE_POINTS : BASE_POINTS
  return Math.max(0, Math.round(base + bonus - WRONG_NOTE_PENALTY * r.errors.length))
}

export function sessionScore(results: RepResult[], goalSeconds: number): number {
  return results.reduce((sum, r) => sum + targetScore(r, goalSeconds), 0)
}

/**
 * How long the session took: the time to finish each target, counting a timeout or skip as the full time limit (which
 * is longer for a question answered by playing the scale).
 */
export function totalTimeMs(results: RepResult[], timeoutSeconds: number | null): number {
  return results.reduce((sum, r) => {
    const limit =
      timeoutSeconds === null ? 0 : timeoutSeconds + (playedScale(r) ? SCALE_GRACE_SECONDS : 0)
    return sum + (r.completionMs ?? limit * 1000)
  }, 0)
}

export function correctCount(results: RepResult[]): number {
  return results.filter((r) => r.outcome === 'correct' || r.outcome === 'correct_with_errors')
    .length
}
