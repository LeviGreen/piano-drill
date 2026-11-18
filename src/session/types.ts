import type { KeyIdAnswer, KeyIdFormat } from '../keyid/questions'
import type { Hand, Target } from '../theory/target'

/** The drill's states (design §9.3). A wrong note is an event recorded in `errors`, not a separate state. */
export type SessionState =
  | 'IDLE'
  | 'READY' // getting ready, then flashing the next target
  | 'FLASHED' // target on screen, waiting for the player
  | 'SUCCESS' // every expected note heard (shown briefly before INTERSTITIAL)
  | 'TIMEOUT'
  | 'SKIPPED'
  | 'INCORRECT' // key-ID: answered, but wrong
  | 'INTERSTITIAL' // feedback or reveal between reps
  | 'PAUSED'
  | 'ENDED'

export type RepOutcome = 'correct' | 'correct_with_errors' | 'timeout' | 'skipped' | 'incorrect'

/** Everything that identifies a rep for later analysis (design §8.1 dims). */
export type PlayDims = {
  hands: Hand | 'both'
  clef: 'treble' | 'bass' | 'both'
  key: string
  noteCount: number
  contentType: string
}

/** Key-signature reps are described by what was asked. */
export type KeyIdDims = {
  key: string
  clef: 'treble' | 'bass'
  format: KeyIdFormat
  keyMode: 'major' | 'minor'
}

export type RepDims = PlayDims | KeyIdDims

/**
 * Extra detail on a key-ID rep: what was right, and every wrong guess on the way (the data for a confusion matrix). A
 * wrong guess does not end the question: the player keeps guessing until they get it, time runs out, or they skip.
 */
/**
 * How a key-ID question was answered: tapped on the wheel, typed, or played on a MIDI piano ('tap' is from before the
 * wheel and typing were told apart; it is scored like typing).
 */
export type KeyIdMethod = 'wheel' | 'type' | 'play' | 'tap'

export type KeyIdDetail = {
  format: KeyIdFormat
  correct: KeyIdAnswer
  /** The right answer as the player gave it (tapped or typed); null if they never got it, or got it by playing the scale. */
  given: KeyIdAnswer | null
  /** Every wrong key named (tapped or typed), in order. */
  wrong: KeyIdAnswer[]
  /** Every wrong note played, in order (the play method: each one costs points). */
  wrongPlayed: number[]
  method: KeyIdMethod
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
  /** Key-signature reps only. */
  keyId?: KeyIdDetail
  timestamp: string
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
export interface Presenter<Item = Target> {
  /** Get the next item ready off-screen so the flash is just a swap. */
  prepare(item: Item): void
  flash(item: Item): Promise<number>
  /** Show the answer (after a timeout, skip or wrong answer). */
  reveal(item: Item): void
  /** Empty the staff (keep the staff itself): between targets, on pause and at the end. */
  clear(): void
}

/** What every kind of session reports, whatever it is asking. */
export type BaseSnapshot<Item> = {
  state: SessionState
  /**
   * Which rep the screen is on (1-based): the one being asked or got ready for, or, while its result is still showing,
   * the one just finished. And how many there will be (null = until ended).
   */
  repNumber: number
  totalReps: number | null
  item: Item | null
  /** Time the item was painted, when FLASHED. */
  t0: number | null
  lastOutcome: RepOutcome | null
  completedReps: number
  failure: string | null
  /** The time limit of the item on screen (null: none, or nothing is flashed). */
  limitSeconds: number | null
  /**
   * While READY: when the flash is due (on the session clock) and whether this is the long first wait (the one that
   * gets a visible countdown). Null in every other state.
   */
  ready: { since: number; at: number; first: boolean } | null
}
