import { mulberry32, type Rng } from '../theory/random'
import {
  systemClock,
  type BaseSnapshot,
  type Clock,
  type Presenter,
  type RepOutcome,
  type RepResult,
  type SessionState,
} from './types'

/** "Get ready" lasts 4 seconds to begin (long enough to settle and read it), then 1 second between targets. */
export const GET_READY_MS = { first: 4000, between: 1000 }

export type RepSessionOptions<Item> = {
  generator: { next(): Item }
  presenter: Presenter<Item>
  /** Seconds before an item times out, or null for no timeout. */
  timeoutSeconds: number | null
  clock?: Clock
  /** Reps in the session, or null to go on until `end()`. */
  totalReps?: number | null
  /**
   * The get-ready wait before a flash: 4 seconds at the start of a session (and after a resume), 1 second between
   * targets. Fixed in the product; tests set it shorter.
   */
  getReadyMs?: { first: number; between: number }
  /** How long a silent input must stay silent before a flash (only for sessions that listen to an input). */
  silenceMs?: number
  /** Flash anyway after waiting this long for silence (a noisy room), and mark the rep. */
  maxWaitMs?: number
  /** How long feedback stays after a correct rep, and how long the answer is revealed after a miss. */
  feedbackMs?: number
  revealMs?: number
  rng?: Rng
  sessionId?: string
}

const DEFAULTS = {
  totalReps: 20,
  getReadyMs: GET_READY_MS,
  silenceMs: 300,
  maxWaitMs: 8000,
  feedbackMs: 700,
  revealMs: 2500,
}

const SUCCESS: RepOutcome[] = ['correct', 'correct_with_errors']

let sessionCounter = 0

/**
 * A session id that is different every time: saved sessions and scores are keyed on it, so two sessions sharing one
 * would overwrite each other. (The seeded `rng` is for target generation and must not be used for this: with the same
 * seed it gives the same id every session.)
 */
export function newSessionId(): string {
  return `s${Date.now().toString(36)}-${(++sessionCounter).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

/**
 * The rep cycle every kind of session shares (design §9.3): get ready, flash an item, wait for the player to finish it
 * (or time out, skip), show feedback, repeat. No UI. What counts as finishing a rep is up to the subclass, which calls
 * `finishRep` when it decides; this class owns the timing, the states, pause/resume/end and the results.
 *
 * Time comes from an injected clock, so the whole thing runs deterministically in tests.
 */
export abstract class RepSession<Item, Snapshot extends BaseSnapshot<Item> = BaseSnapshot<Item>> {
  readonly results: RepResult[] = []
  protected readonly clock: Clock
  protected readonly rng: Rng
  protected readonly cfg: typeof DEFAULTS & { timeoutSeconds: number | null }
  protected readonly sessionId: string
  protected state: SessionState = 'IDLE'
  protected item: Item | null = null
  protected t0: number | null = null
  protected lastOutcome: RepOutcome | null = null
  protected failure: string | null = null
  private readonly opts: RepSessionOptions<Item>
  private upcoming: Item | null = null
  private flashing = false
  private startedWithoutSilence = false
  /** The next get-ready is the first of a run (session start or a resume), so it is the longer one. */
  private firstOfRun = true
  private readyIsFirst = false
  private readyAt = 0
  private readyEnteredAt = 0
  private timers: { ready: number | null; timeout: number | null; interstitial: number | null } = {
    ready: null,
    timeout: null,
    interstitial: null,
  }
  private generation = 0 // bumped whenever a rep is abandoned, so stale async results are ignored
  private readonly listeners = new Set<(s: Snapshot) => void>()

  constructor(opts: RepSessionOptions<Item>) {
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
      timeoutSeconds: opts.timeoutSeconds,
    }
    this.sessionId = opts.sessionId ?? newSessionId()
  }

  // ---------- what a kind of session provides ----------

  /** A new item has been chosen; reset whatever is tracked per rep. */
  protected abstract beginRep(item: Item): void
  /** Build the record of a finished rep. */
  protected abstract buildResult(
    item: Item,
    outcome: RepOutcome,
    t0: number,
    startedWithoutSilence: boolean,
  ): RepResult
  /** Called once the item is on screen (painted at t0). */
  protected onFlashed(_item: Item, _t0: number): void {}
  /** Start listening (open an input, etc.) when the session starts. */
  protected async onStart(): Promise<void> {}
  /** Stop listening when the session ends. */
  protected onStop(): void {}
  /**
   * Is the input quiet? Sessions that listen to a live input return its state so a flash waits for silence; sessions
   * that answer by tapping return null and flash as soon as the get-ready time is up.
   */
  protected quietState(): { active: boolean; silentSince: number | null } | null {
    return null
  }

  // ---------- public API ----------

  /** Everything the screen needs to draw the session right now. */
  abstract get snapshot(): Snapshot

  subscribe(cb: (s: Snapshot) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /**
   * Which rep the screen should say it is on. While the result of a rep is showing (the feedback or the reveal after
   * it), that is still the rep just finished; the next number appears when the next rep's get-ready begins.
   */
  private repNumber(): number {
    const showingResult =
      this.state === 'SUCCESS' ||
      this.state === 'TIMEOUT' ||
      this.state === 'SKIPPED' ||
      this.state === 'INCORRECT' ||
      this.state === 'INTERSTITIAL'
    return this.results.length + (showingResult || this.state === 'ENDED' ? 0 : 1)
  }

  protected baseSnapshot(): BaseSnapshot<Item> {
    return {
      state: this.state,
      repNumber: this.repNumber(),
      totalReps: this.cfg.totalReps,
      item: this.item,
      t0: this.t0,
      lastOutcome: this.lastOutcome,
      completedReps: this.results.length,
      failure: this.failure,
      ready:
        this.state === 'READY'
          ? { since: this.readyEnteredAt, at: this.readyAt, first: this.readyIsFirst }
          : null,
    }
  }

  /** Begin the session: start listening and get the first item ready. */
  async start(): Promise<void> {
    if (this.state !== 'IDLE') return
    await this.onStart()
    this.upcoming = this.opts.generator.next()
    this.opts.presenter.prepare(this.upcoming)
    this.enterReady()
  }

  /** Give up on the current item. */
  skip(): void {
    if (this.state === 'FLASHED') this.finishRep('skipped')
  }

  /**
   * Pause. A rep that is on screen is voided (not recorded), since the clock was running on the player; resuming starts
   * a fresh rep.
   */
  pause(): void {
    if (this.state !== 'READY' && this.state !== 'FLASHED' && this.state !== 'INTERSTITIAL') return
    this.abandonRep()
    this.opts.presenter.clear() // hide the item while paused
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
    this.onStop()
    this.opts.presenter.clear()
    this.setState('ENDED')
  }

  // ---------- readiness: get ready, then flash ----------

  private enterReady(): void {
    if (!this.upcoming) this.upcoming = this.opts.generator.next()
    this.item = this.upcoming
    this.upcoming = null
    this.t0 = null
    this.startedWithoutSilence = false
    this.beginRep(this.item)
    this.opts.presenter.clear() // back to the empty staff while the player settles
    this.readyEnteredAt = this.clock.now()
    this.readyIsFirst = this.firstOfRun
    const wait = this.firstOfRun ? this.cfg.getReadyMs.first : this.cfg.getReadyMs.between
    this.firstOfRun = false
    this.readyAt = this.readyEnteredAt + wait
    this.setState('READY')
    this.checkReady()
  }

  /** Subclasses call this when the input changes while getting ready. */
  protected recheckReady(): void {
    if (this.state === 'READY') this.checkReady()
  }

  private checkReady(): void {
    if (this.state !== 'READY' || this.flashing) return
    this.clearTimer('ready')
    const now = this.clock.now()
    const q = this.quietState()
    const quiet =
      q === null ||
      (!q.active && q.silentSince !== null && now - q.silentSince >= this.cfg.silenceMs)
    const waitedTooLong = now - this.readyEnteredAt >= this.cfg.maxWaitMs
    if ((now >= this.readyAt && quiet) || waitedTooLong) {
      this.flashNow(!quiet)
      return
    }
    // Come back when something could change: the delay ends, the quiet period completes, or we give up.
    const waits = [this.readyEnteredAt + this.cfg.maxWaitMs - now]
    if (this.readyAt > now) waits.push(this.readyAt - now)
    if (q && !q.active && q.silentSince !== null)
      waits.push(q.silentSince + this.cfg.silenceMs - now)
    const wait = Math.max(1, Math.min(...waits.filter((w) => w > 0)))
    this.timers.ready = this.clock.setTimeout(() => this.checkReady(), wait)
  }

  private flashNow(forced: boolean): void {
    const item = this.item!
    const generation = this.generation
    this.flashing = true
    this.startedWithoutSilence = forced
    this.opts.presenter
      .flash(item)
      .then((t0) => {
        this.flashing = false
        if (generation !== this.generation || this.state !== 'READY') return // abandoned while painting
        this.t0 = t0
        this.setState('FLASHED')
        this.onFlashed(item, t0)
        const seconds = this.cfg.timeoutSeconds
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

  // ---------- finishing a rep ----------

  protected finishRep(outcome: RepOutcome): void {
    if (this.state !== 'FLASHED' || this.t0 === null || this.item === null) return
    const item = this.item
    this.clearTimer('timeout')
    this.results.push(this.buildResult(item, outcome, this.t0, this.startedWithoutSilence))
    this.lastOutcome = outcome
    const success = SUCCESS.includes(outcome)
    this.setState(
      success
        ? 'SUCCESS'
        : outcome === 'timeout'
          ? 'TIMEOUT'
          : outcome === 'incorrect'
            ? 'INCORRECT'
            : 'SKIPPED',
    )
    if (!success) this.opts.presenter.reveal(item)
    this.setState('INTERSTITIAL')
    const pause = success ? this.cfg.feedbackMs : this.cfg.revealMs
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

  protected setState(s: SessionState): void {
    this.state = s
    this.emit()
  }

  protected emit(): void {
    const s = this.snapshot
    for (const cb of [...this.listeners]) cb(s)
  }
}
