import type { DifficultySettings } from '../levels/settings'
import type { NoteInput, NoteInputState } from '../audio/inputs/NoteInput'
import { mulberry32, type Rng } from '../theory/random'
import type { Target } from '../theory/target'
import {
  systemClock,
  type Clock,
  type Presenter,
  type RepOutcome,
  type RepResult,
  type SessionSnapshot,
  type SessionState,
} from './types'

export type SessionOptions = {
  /** Uses `timeoutSeconds` and `octaveStrictness`. */
  settings: DifficultySettings
  generator: { next(): Target }
  input: NoteInput
  presenter: Presenter
  clock?: Clock
  /** Reps in the session, or null to go on until `end()`. */
  totalReps?: number | null
  /**
   * The get-ready wait before a flash: 4 seconds at the start of a session (and after a resume), 1 second between
   * targets. Fixed in the product; tests set it shorter.
   */
  getReadyMs?: { first: number; between: number }
  /** How long the input must be silent before a target is flashed. */
  silenceMs?: number
  /** Flash anyway after waiting this long for silence (a noisy room), and mark the rep. */
  maxWaitMs?: number
  /** How long feedback stays after a correct rep, and how long the answer is revealed after a miss. */
  feedbackMs?: number
  revealMs?: number
  rng?: Rng
  sessionId?: string
}

/** "Get ready" lasts 4 seconds to begin (long enough to settle and read it), then 1 second between targets. */
export const GET_READY_MS = { first: 4000, between: 1000 }

const DEFAULTS = {
  totalReps: 20,
  getReadyMs: GET_READY_MS,
  silenceMs: 300,
  maxWaitMs: 8000,
  feedbackMs: 700,
  revealMs: 2500,
}

/** Which expected note (if any) an onset counts as: exact pitch, or any octave when strictness is 'any'. */
function matchExpected(
  midi: number,
  expected: number[],
  strictness: 'exact' | 'any',
): number | null {
  if (strictness === 'exact') return expected.includes(midi) ? midi : null
  return expected.find((e) => e % 12 === midi % 12) ?? null
}

/**
 * The drill loop (design §9.3), with no UI: wait for quiet, flash a target, listen, and finish the rep.
 *
 * Verification is per note and cumulative (design §6.2): each expected note counts once when heard after the
 * target was painted, and stays heard. The rep succeeds when all are heard, in any order and not necessarily
 * together. Wrong notes are logged but never undo notes already heard.
 *
 * Time comes from an injected clock, and onset times from the input are on that same clock, so everything is
 * deterministic in tests.
 */
export class DrillSession {
  readonly results: RepResult[] = []
  private readonly opts: SessionOptions
  private readonly clock: Clock
  private readonly rng: Rng
  private readonly cfg: typeof DEFAULTS
  private readonly sessionId: string
  private readonly listeners = new Set<(s: SessionSnapshot) => void>()
  private unsubscribeInput: (() => void) | null = null

  private state: SessionState = 'IDLE'
  private target: Target | null = null
  private upcoming: Target | null = null
  private expected: number[] = []
  private heard = new Map<number, number>() // expected midi -> onset time
  private errors: { t: number; notes: number[] }[] = []
  private t0: number | null = null
  private lastOutcome: RepOutcome | null = null
  private failure: string | null = null
  private flashing = false
  /** The next get-ready is the first of a run (session start or a resume), so it is the longer one. */
  private firstOfRun = true
  private readyIsFirst = false
  private startedWithoutSilence = false

  // readiness
  private readyAt = 0
  private readyEnteredAt = 0
  private silentSince: number | null = null
  private active = false // are notes currently sounding on the input?

  private timers: { ready: number | null; timeout: number | null; interstitial: number | null } = {
    ready: null,
    timeout: null,
    interstitial: null,
  }
  private generation = 0 // bumped whenever a rep is abandoned, so stale async results are ignored

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.clock = opts.clock ?? systemClock
    this.rng = opts.rng ?? mulberry32(1)
    this.cfg = {
      totalReps: opts.totalReps === undefined ? DEFAULTS.totalReps : (opts.totalReps as number),
      getReadyMs: opts.getReadyMs ?? DEFAULTS.getReadyMs,
      silenceMs: opts.silenceMs ?? DEFAULTS.silenceMs,
      maxWaitMs: opts.maxWaitMs ?? DEFAULTS.maxWaitMs,
      feedbackMs: opts.feedbackMs ?? DEFAULTS.feedbackMs,
      revealMs: opts.revealMs ?? DEFAULTS.revealMs,
    }
    this.sessionId = opts.sessionId ?? `s${Math.floor(this.rng() * 1e9).toString(36)}`
  }

  // ---------- public API ----------

  get snapshot(): SessionSnapshot {
    return {
      state: this.state,
      repNumber: this.results.length + (this.state === 'ENDED' ? 0 : 1),
      totalReps: this.cfg.totalReps,
      target: this.target,
      expected: [...this.expected],
      heard: [...this.heard.keys()],
      errors: this.errors.map((e) => ({ ...e, notes: [...e.notes] })),
      t0: this.t0,
      lastOutcome: this.lastOutcome,
      completedReps: this.results.length,
      failure: this.failure,
      ready: this.state === 'READY' ? { at: this.readyAt, first: this.readyIsFirst } : null,
    }
  }

  subscribe(cb: (s: SessionSnapshot) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Begin the session: start the input and get the first target ready. */
  async start(): Promise<void> {
    if (this.state !== 'IDLE') return
    this.unsubscribeInput = this.opts.input.onUpdate((s) => this.onInput(s))
    this.silentSince = this.clock.now() // assume the room is quiet until the input says otherwise
    await this.opts.input.start()
    this.upcoming = this.opts.generator.next()
    this.opts.presenter.prepare(this.upcoming)
    this.enterReady()
  }

  /** Give up on the current target. */
  skip(): void {
    if (this.state === 'FLASHED') this.finishRep('skipped')
  }

  /**
   * Pause. A rep that is on screen is voided (not recorded), since the clock was running on the user; resuming
   * starts a fresh rep.
   */
  pause(): void {
    if (this.state !== 'READY' && this.state !== 'FLASHED' && this.state !== 'INTERSTITIAL') return
    this.abandonRep()
    this.opts.presenter.clear() // hide the target while paused
    this.setState('PAUSED')
  }

  resume(): void {
    if (this.state !== 'PAUSED') return
    this.firstOfRun = true // hands are coming back to the keys: settle again
    this.afterRep()
  }

  end(): void {
    if (this.state === 'ENDED') return
    this.abandonRep()
    this.unsubscribeInput?.()
    this.unsubscribeInput = null
    this.opts.input.stop()
    this.opts.presenter.clear()
    this.setState('ENDED')
  }

  // ---------- readiness: wait for quiet, then flash ----------

  private enterReady(): void {
    if (!this.upcoming) this.upcoming = this.opts.generator.next()
    this.target = this.upcoming
    this.upcoming = null
    this.expected = this.target.parts.flatMap((p) => p.pitches.map((x) => x.midi))
    this.heard = new Map()
    this.errors = []
    this.t0 = null
    this.startedWithoutSilence = false
    this.opts.presenter.clear() // back to the empty staff while the player settles
    this.readyEnteredAt = this.clock.now()
    this.readyIsFirst = this.firstOfRun
    const wait = this.firstOfRun ? this.cfg.getReadyMs.first : this.cfg.getReadyMs.between
    this.firstOfRun = false
    this.readyAt = this.readyEnteredAt + wait
    this.setState('READY')
    this.checkReady()
  }

  private checkReady(): void {
    if (this.state !== 'READY' || this.flashing) return
    this.clearTimer('ready')
    const now = this.clock.now()
    const quiet =
      !this.active && this.silentSince !== null && now - this.silentSince >= this.cfg.silenceMs
    const waitedTooLong = now - this.readyEnteredAt >= this.cfg.maxWaitMs
    if ((now >= this.readyAt && quiet) || waitedTooLong) {
      this.flashNow(!quiet)
      return
    }
    // Come back when something could change: the random delay ends, the quiet period completes, or we give up.
    const waits = [this.readyEnteredAt + this.cfg.maxWaitMs - now]
    if (this.readyAt > now) waits.push(this.readyAt - now)
    if (!this.active && this.silentSince !== null)
      waits.push(this.silentSince + this.cfg.silenceMs - now)
    const wait = Math.max(1, Math.min(...waits.filter((w) => w > 0)))
    this.timers.ready = this.clock.setTimeout(() => this.checkReady(), wait)
  }

  private flashNow(forced: boolean): void {
    const target = this.target!
    const generation = this.generation
    this.flashing = true
    this.startedWithoutSilence = forced
    this.opts.presenter
      .flash(target)
      .then((t0) => {
        this.flashing = false
        if (generation !== this.generation || this.state !== 'READY') return // abandoned while painting
        this.t0 = t0
        this.setState('FLASHED')
        const seconds = this.opts.settings.timeoutSeconds
        if (seconds !== null) {
          const left = Math.max(0, t0 + seconds * 1000 - this.clock.now())
          this.timers.timeout = this.clock.setTimeout(() => this.finishRep('timeout'), left)
        }
        // While this one is on screen, get the next one ready so its flash is just a swap.
        if (this.cfg.totalReps === null || this.results.length + 1 < this.cfg.totalReps) {
          this.upcoming = this.opts.generator.next()
          this.opts.presenter.prepare(this.upcoming)
        }
      })
      .catch((e: unknown) => {
        this.flashing = false
        this.failure = e instanceof Error ? e.message : String(e)
        this.end()
      })
  }

  // ---------- listening ----------

  private onInput(update: NoteInputState): void {
    const wasActive = this.active
    this.active = update.activeNotes.size > 0
    if (this.active) this.silentSince = null
    else if (wasActive || this.silentSince === null) this.silentSince = this.clock.now()

    if (this.state === 'READY') {
      this.checkReady()
      return
    }
    if (this.state !== 'FLASHED' || this.t0 === null) return

    let changed = false
    const onsets = [...update.onsets].sort((a, b) => a.t - b.t)
    for (const onset of onsets) {
      if (onset.t < this.t0) continue // leftover ring-out from before the flash does not count
      const strictness = this.opts.settings.octaveStrictness
      const match = matchExpected(onset.midi, this.expected, strictness)
      if (match === null) {
        this.errors.push({ t: onset.t - this.t0, notes: [onset.midi] })
        changed = true
      } else if (!this.heard.has(match)) {
        this.heard.set(match, onset.t)
        changed = true
      } // a repeated expected note changes nothing
    }
    if (this.expected.every((m) => this.heard.has(m))) {
      this.finishRep(this.errors.length > 0 ? 'correct_with_errors' : 'correct')
    } else if (changed) {
      this.emit()
    }
  }

  // ---------- finishing a rep ----------

  private finishRep(outcome: RepOutcome): void {
    if (this.state !== 'FLASHED' || this.t0 === null || !this.target) return
    const t0 = this.t0
    const target = this.target
    this.clearTimer('timeout')
    const times = [...this.heard.values()]
    const complete = outcome === 'correct' || outcome === 'correct_with_errors'
    const result: RepResult = {
      sessionId: this.sessionId,
      mode: 'play',
      targetId: target.id,
      dims: dimsOf(target),
      reactionMs: times.length > 0 ? Math.min(...times) - t0 : null,
      completionMs: complete ? Math.max(...times) - t0 : null,
      errors: this.errors.map((e) => ({ ...e, notes: [...e.notes] })),
      heard: [...this.heard.entries()].map(([midi, t]) => ({ midi, t: t - t0 })),
      outcome,
      startedWithoutSilence: this.startedWithoutSilence,
      timestamp: new Date().toISOString(),
    }
    this.results.push(result)
    this.lastOutcome = outcome
    this.setState(complete ? 'SUCCESS' : outcome === 'timeout' ? 'TIMEOUT' : 'SKIPPED')
    if (!complete) this.opts.presenter.reveal(target)
    this.setState('INTERSTITIAL')
    const pause = complete ? this.cfg.feedbackMs : this.cfg.revealMs
    this.timers.interstitial = this.clock.setTimeout(() => this.afterRep(), pause)
  }

  private afterRep(): void {
    this.clearTimer('interstitial')
    if (this.cfg.totalReps !== null && this.results.length >= this.cfg.totalReps) {
      this.end()
      return
    }
    this.enterReady()
  }

  /** Drop whatever rep is in progress without recording it. */
  private abandonRep(): void {
    this.generation++
    this.flashing = false
    this.clearTimer('ready')
    this.clearTimer('timeout')
    this.clearTimer('interstitial')
    this.t0 = null
  }

  private clearTimer(name: 'ready' | 'timeout' | 'interstitial'): void {
    const id = this.timers[name]
    if (id !== null) this.clock.clearTimeout(id)
    this.timers[name] = null
  }

  private setState(s: SessionState): void {
    this.state = s
    this.emit()
  }

  private emit(): void {
    const snapshot = this.snapshot
    for (const cb of [...this.listeners]) cb(snapshot)
  }
}

function dimsOf(t: Target) {
  const clefs = new Set(t.parts.map((p) => p.clef))
  return {
    hands: t.parts.length === 2 ? ('both' as const) : t.parts[0].hand,
    clef: clefs.size === 2 ? ('both' as const) : t.parts[0].clef,
    key: `${t.key.tonic.letter}${['bb', 'b', '', '#', '##'][t.key.tonic.accidental + 2]} ${t.key.mode}`,
    noteCount: t.parts.reduce((n, p) => n + p.pitches.length, 0),
    contentType: t.content.type,
  }
}
