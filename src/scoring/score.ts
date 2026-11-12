import type { RepResult } from '../session/types'

/**
 * The arcade score for a session (PD-403). Per target:
 *  - a target you get right earns 100 points;
 *  - a speed bonus adds up to 100 more: full if you finish within the level's goal time, fading to nothing at twice the
 *    goal time;
 *  - each wrong note on the target costs 25 points (a target never goes below 0);
 *  - a timeout or a skip scores 0 (in key ID a wrong guess does not end the question; it costs 25 like a wrong note).
 * A perfect, fast 20-target session is 4000.
 */
export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 100
export const WRONG_NOTE_PENALTY = 25
/** Used when a level has no goal time (a custom setup that did not start from a preset). */
export const FALLBACK_GOAL_SECONDS = 3
/** A session is scored and eligible for a high-score board only with this many targets. */
export const SESSION_TARGETS = 20

export const maxScore = (targets: number): number => targets * (BASE_POINTS + MAX_SPEED_BONUS)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Points for one finished target. `goalSeconds` is the level's goal time. */
export function targetScore(
  r: Pick<RepResult, 'outcome' | 'completionMs' | 'errors'>,
  goalSeconds: number,
): number {
  if ((r.outcome !== 'correct' && r.outcome !== 'correct_with_errors') || r.completionMs === null)
    return 0
  const goalMs = goalSeconds * 1000
  const bonus = MAX_SPEED_BONUS * clamp01((2 * goalMs - r.completionMs) / goalMs)
  return Math.max(0, Math.round(BASE_POINTS + bonus - WRONG_NOTE_PENALTY * r.errors.length))
}

export function sessionScore(results: RepResult[], goalSeconds: number): number {
  return results.reduce((sum, r) => sum + targetScore(r, goalSeconds), 0)
}

/** How long the session took: the time to finish each target, counting a timeout or skip as the full time limit. */
export function totalTimeMs(results: RepResult[], timeoutSeconds: number | null): number {
  return results.reduce((sum, r) => sum + (r.completionMs ?? (timeoutSeconds ?? 0) * 1000), 0)
}

export function correctCount(results: RepResult[]): number {
  return results.filter((r) => r.outcome === 'correct' || r.outcome === 'correct_with_errors')
    .length
}
