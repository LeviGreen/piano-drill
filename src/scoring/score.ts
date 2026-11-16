import { PLAY_GRACE_SECONDS } from '../keyid/checklist'
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
 * Key ID is worth more the less it shows you. A question answered on the wheel, which lays every key out in front of
 * you, is worth three quarters of one typed (a perfect session is 3000, the penalty scales too, so a miss costs the
 * same share of the question). Typed is the base (4000). A question answered by playing the checklist on a MIDI piano
 * (PD-315) is a lot more to play and is not a race: a flat 250 points for finishing it in time, with no speed bonus;
 * each wrong note still costs 25 (a perfect session is 5000).
 */
export const BASE_POINTS = 100
export const MAX_SPEED_BONUS = 100
export const WRONG_NOTE_PENALTY = 25
/** Used when a level has no goal time (a custom setup that did not start from a preset). */
export const FALLBACK_GOAL_SECONDS = 3
/** A session is scored and eligible for a high-score board only with this many targets. */
export const SESSION_TARGETS = 20

/** A question answered by playing the checklist, finished in time. */
export const PLAY_POINTS = 250
/** What a question answered on the wheel is worth, compared to one typed. */
export const WHEEL_WEIGHT = 0.75

const answeredBy = (r?: Pick<RepResult, 'keyId'>) => r?.keyId?.method

/** The most one target can earn; for a question not answered yet, the same as typed. */
const maxTargetScore = (r?: Pick<RepResult, 'keyId'>): number => {
  const method = answeredBy(r)
  if (method === 'play') return PLAY_POINTS
  const typed = BASE_POINTS + MAX_SPEED_BONUS
  return method === 'wheel' ? typed * WHEEL_WEIGHT : typed
}

/**
 * The most a session of `targets` targets can earn; finished ones are counted as they were answered, and the ones not
 * reached as the last one was.
 */
export const maxScore = (targets: number, results: Pick<RepResult, 'keyId'>[] = []): number =>
  results.reduce((sum, r) => sum + maxTargetScore(r), 0) +
  Math.max(0, targets - results.length) * maxTargetScore(results.at(-1))

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Points for one finished target. `goalSeconds` is the level's goal time. */
export function targetScore(
  r: Pick<RepResult, 'outcome' | 'completionMs' | 'errors' | 'keyId'>,
  goalSeconds: number,
): number {
  if ((r.outcome !== 'correct' && r.outcome !== 'correct_with_errors') || r.completionMs === null)
    return 0
  const penalty = WRONG_NOTE_PENALTY * r.errors.length
  if (answeredBy(r) === 'play') return Math.max(0, PLAY_POINTS - penalty)
  const goalMs = goalSeconds * 1000
  const bonus = MAX_SPEED_BONUS * clamp01((2 * goalMs - r.completionMs) / goalMs)
  const weight = answeredBy(r) === 'wheel' ? WHEEL_WEIGHT : 1
  return Math.max(0, Math.round(weight * (BASE_POINTS + bonus - penalty)))
}

export function sessionScore(results: RepResult[], goalSeconds: number): number {
  return results.reduce((sum, r) => sum + targetScore(r, goalSeconds), 0)
}

/**
 * How long the session took: the time to finish each target, counting a timeout or skip as the full time limit (which
 * is longer for a question answered by playing).
 */
export function totalTimeMs(results: RepResult[], timeoutSeconds: number | null): number {
  return results.reduce((sum, r) => {
    const limit =
      timeoutSeconds === null
        ? 0
        : timeoutSeconds + (answeredBy(r) === 'play' ? PLAY_GRACE_SECONDS : 0)
    return sum + (r.completionMs ?? limit * 1000)
  }, 0)
}

export function correctCount(results: RepResult[]): number {
  return results.filter((r) => r.outcome === 'correct' || r.outcome === 'correct_with_errors')
    .length
}
