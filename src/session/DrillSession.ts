import type { NoteInput, NoteInputState } from '../audio/inputs/NoteInput'
import type { DifficultySettings } from '../levels/settings'
import type { Target } from '../theory/target'
import { RepSession, type RepSessionOptions } from './RepSession'
import type { BaseSnapshot, RepOutcome, RepResult } from './types'

export type { BaseSnapshot }

export type SessionOptions = Omit<RepSessionOptions<Target>, 'timeoutSeconds'> & {
  /** Uses `timeoutSeconds` and `octaveStrictness`. */
  settings: DifficultySettings
  input: NoteInput
}

/** What a screen needs to draw a play-mode session: the base state plus the notes heard so far. */
export type SessionSnapshot = BaseSnapshot<Target> & {
  target: Target | null
  expected: number[]
  heard: number[]
  errors: { t: number; notes: number[] }[]
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
 * Play mode (design §9.3): wait for quiet, flash a target, listen, and finish the rep. The rep cycle itself (timing,
 * states, pause, results) is in RepSession; this adds listening to notes.
 *
 * Verification is per note and cumulative (design §6.2): each expected note counts once when heard after the target was
 * painted, and stays heard. The rep succeeds when all are heard, in any order and not necessarily together. Wrong notes
 * are logged but never undo notes already heard.
 */
export class DrillSession extends RepSession<Target, SessionSnapshot> {
  private readonly input: NoteInput
  private readonly settings: DifficultySettings
  private unsubscribeInput: (() => void) | null = null
  private expected: number[] = []
  private heard = new Map<number, number>() // expected midi -> onset time
  private errors: { t: number; notes: number[] }[] = []
  private silentSince: number | null = null
  private active = false // are notes currently sounding on the input?

  constructor(opts: SessionOptions) {
    super({ ...opts, timeoutSeconds: opts.settings.timeoutSeconds })
    this.input = opts.input
    this.settings = opts.settings
  }

  get snapshot(): SessionSnapshot {
    return {
      ...this.baseSnapshot(),
      target: this.item,
      expected: [...this.expected],
      heard: [...this.heard.keys()],
      errors: this.errors.map((e) => ({ ...e, notes: [...e.notes] })),
    }
  }

  protected async onStart(): Promise<void> {
    this.unsubscribeInput = this.input.onUpdate((s) => this.onInput(s))
    this.silentSince = this.clock.now() // assume the room is quiet until the input says otherwise
    await this.input.start()
  }

  protected onStop(): void {
    this.unsubscribeInput?.()
    this.unsubscribeInput = null
    this.input.stop()
  }

  protected quietState() {
    return { active: this.active, silentSince: this.silentSince }
  }

  protected beginRep(target: Target): void {
    this.expected = target.parts.flatMap((p) => p.pitches.map((x) => x.midi))
    this.heard = new Map()
    this.errors = []
  }

  // ---------- listening ----------

  private onInput(update: NoteInputState): void {
    const wasActive = this.active
    this.active = update.activeNotes.size > 0
    if (this.active) this.silentSince = null
    else if (wasActive || this.silentSince === null) this.silentSince = this.clock.now()

    if (this.state === 'READY') {
      this.recheckReady()
      return
    }
    if (this.state !== 'FLASHED' || this.t0 === null) return

    let changed = false
    const onsets = [...update.onsets].sort((a, b) => a.t - b.t)
    for (const onset of onsets) {
      if (onset.t < this.t0) continue // leftover ring-out from before the flash does not count
      const match = matchExpected(onset.midi, this.expected, this.settings.octaveStrictness)
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

  // ---------- the result ----------

  protected buildResult(
    target: Target,
    outcome: RepOutcome,
    t0: number,
    startedWithoutSilence: boolean,
  ): RepResult {
    const times = [...this.heard.values()]
    const complete = outcome === 'correct' || outcome === 'correct_with_errors'
    return {
      sessionId: this.sessionId,
      mode: 'play',
      targetId: target.id,
      dims: dimsOf(target),
      reactionMs: times.length > 0 ? Math.min(...times) - t0 : null,
      completionMs: complete ? Math.max(...times) - t0 : null,
      errors: this.errors.map((e) => ({ ...e, notes: [...e.notes] })),
      heard: [...this.heard.entries()].map(([midi, t]) => ({ midi, t: t - t0 })),
      outcome,
      startedWithoutSilence,
      timestamp: new Date().toISOString(),
    }
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
