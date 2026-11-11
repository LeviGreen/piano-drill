import type { Hand, Target } from '../theory/target'

/** The drill's states (design §9.3). A wrong note is an event recorded in `errors`, not a separate state. */
export type SessionState =
  | 'IDLE'
  | 'READY' // waiting for quiet, then flashing the next target
  | 'FLASHED' // target on screen, listening
  | 'SUCCESS' // every expected note heard (shown briefly before INTERSTITIAL)
  | 'TIMEOUT'
  | 'SKIPPED'
  | 'INTERSTITIAL' // feedback or reveal between reps
  | 'PAUSED'
  | 'ENDED'

export type RepOutcome = 'correct' | 'correct_with_errors' | 'timeout' | 'skipped'

/** Everything that identifies a rep for later analysis (design §8.1 dims). */
export type RepDims = {
  hands: Hand | 'both'
  clef: 'treble' | 'bass' | 'both'
  key: string
  noteCount: number
  contentType: string
}

/** One finished rep. `mode` lets key-ID reps share this shape (PD-503). */
export type RepResult = {
  sessionId: string
  mode: 'play' | 'keyid'
  targetId: string
  dims: RepDims
  /** First expected note heard, ms after the target was painted (null if none). */
  reactionMs: number | null
  /** The last expected note heard (the one that completed the set), ms after painted; null if not completed. */
  completionMs: number | null
  /** Wrong notes: `t` is ms after the target was painted. */
  errors: { t: number; notes: number[] }[]
  /** Expected notes heard, with their onset times (ms after painted). */
  heard: { midi: number; t: number }[]
  outcome: RepOutcome
  /** True if the rep began without the input having been quiet (noisy room, held pedal). */
  startedWithoutSilence: boolean
  timestamp: string
}

export type SessionSnapshot = {
  state: SessionState
  /** Which rep is current (1-based) and how many there will be (null = until ended). */
  repNumber: number
  totalReps: number | null
  target: Target | null
  expected: number[]
  heard: number[]
  errors: { t: number; notes: number[] }[]
  /** performance-clock time the target was painted, when FLASHED. */
  t0: number | null
  lastOutcome: RepOutcome | null
  completedReps: number
  failure: string | null
  /**
   * While READY: when the flash is due (on the session clock) and whether this is the long first wait (the one that
   * gets a visible countdown). Null in every other state.
   */
  ready: { at: number; first: boolean } | null
}

/** Time and timers, injectable so the state machine can run on a fake clock in tests. */
export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}

export const systemClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
}

/** How targets reach the screen. `flash` resolves with t0, the moment the target was painted. */
export interface Presenter {
  /** Get the next target ready off-screen so the flash is just a swap. */
  prepare(target: Target): void
  flash(target: Target): Promise<number>
  /** Show the answer (after a timeout or skip). */
  reveal(target: Target): void
  /** Empty the staff (keep the staff itself): between targets, on pause and at the end. */
  clear(): void
}
