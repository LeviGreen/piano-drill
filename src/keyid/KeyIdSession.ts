import type { NoteInput, NoteInputState } from '../audio/inputs/NoteInput'
import { RepSession, type RepSessionOptions } from '../session/RepSession'
import type { BaseSnapshot, RepOutcome, RepResult } from '../session/types'
import { keyName } from '../theory/keys'
import { checkAnswer, tonicMatches, type KeyIdAnswer, type KeyIdQuestion } from './questions'

export type KeyIdSessionSettings = {
  /** Seconds before a question times out, or null for no timeout. */
  timeoutSeconds: number | null
}

export type KeyIdAnswerMethod = 'tap' | 'play'

export type KeyIdSessionOptions = Omit<RepSessionOptions<KeyIdQuestion>, 'timeoutSeconds'> & {
  settings: KeyIdSessionSettings
  /** Where played notes come from. Needed for the 'play' method (answering by playing the tonic). */
  input?: NoteInput
  /** How the player is answering to begin with (they can switch with `setMethod`). Default 'tap'. */
  method?: KeyIdAnswerMethod
}

export type KeyIdSnapshot = BaseSnapshot<KeyIdQuestion> & {
  question: KeyIdQuestion | null
  /** What was answered (tapped or typed) once the rep has ended; null before that, and for a played note. */
  given: KeyIdAnswer | null
  /** For the play method: the note that answered. */
  playedMidi: number | null
  method: KeyIdAnswerMethod
}

/**
 * Key identification (design §7): a key signature is flashed and the player names the key. It shares the whole rep cycle
 * with play mode (RepSession); what is different is one answer per rep. A right answer finishes the rep as correct, a
 * wrong one as incorrect (and the right answer is revealed), and each result records answered versus right.
 *
 * The player can answer in two ways and switch between them at any time: tapping or typing (`answer`), or playing the
 * tonic of the key on the piano (the first note struck after the question appears decides).
 */
export class KeyIdSession extends RepSession<KeyIdQuestion, KeyIdSnapshot> {
  private readonly input: NoteInput | null
  private method: KeyIdAnswerMethod
  private unsubscribeInput: (() => void) | null = null
  private given: KeyIdAnswer | null = null
  private playedMidi: number | null = null
  private answeredAt: number | null = null
  private answeredBy: KeyIdAnswerMethod | null = null
  private silentSince: number | null = null
  private active = false

  constructor(opts: KeyIdSessionOptions) {
    super({ ...opts, timeoutSeconds: opts.settings.timeoutSeconds })
    this.input = opts.input ?? null
    this.method = opts.method ?? 'tap'
    if (this.method === 'play' && !this.input)
      throw new RangeError('The play answer method needs an input')
  }

  get snapshot(): KeyIdSnapshot {
    return {
      ...this.baseSnapshot(),
      question: this.item,
      given: this.given,
      playedMidi: this.playedMidi,
      method: this.method,
    }
  }

  /** Switch between answering by tapping/typing and by playing the tonic. Playing needs an input. */
  setMethod(method: KeyIdAnswerMethod): void {
    if (method === 'play' && !this.input)
      throw new RangeError('The play answer method needs an input')
    this.method = method
    this.emit()
  }

  protected async onStart(): Promise<void> {
    if (!this.input) return
    this.unsubscribeInput = this.input.onUpdate((s) => this.onInput(s))
    this.silentSince = this.clock.now()
    await this.input.start()
  }

  protected onStop(): void {
    this.unsubscribeInput?.()
    this.unsubscribeInput = null
    this.input?.stop()
  }

  /** Waiting for quiet only matters when notes are the answer. */
  protected quietState() {
    return this.method === 'play' ? { active: this.active, silentSince: this.silentSince } : null
  }

  protected beginRep(): void {
    this.given = null
    this.playedMidi = null
    this.answeredAt = null
    this.answeredBy = null
  }

  /** The player answered by tapping or typing. */
  answer(given: KeyIdAnswer): void {
    if (this.state !== 'FLASHED' || !this.item || this.method !== 'tap') return
    this.given = given
    this.answeredAt = this.clock.now()
    this.answeredBy = 'tap'
    this.finishRep(checkAnswer(this.item, given) ? 'correct' : 'incorrect')
  }

  private onInput(update: NoteInputState): void {
    const wasActive = this.active
    this.active = update.activeNotes.size > 0
    if (this.active) this.silentSince = null
    else if (wasActive || this.silentSince === null) this.silentSince = this.clock.now()

    if (this.method !== 'play') return
    if (this.state === 'READY') {
      this.recheckReady()
      return
    }
    if (this.state !== 'FLASHED' || this.t0 === null || !this.item) return
    // The first note struck after the question appeared is the answer.
    const onset = [...update.onsets].sort((a, b) => a.t - b.t).find((o) => o.t >= this.t0!)
    if (!onset) return
    this.playedMidi = onset.midi
    this.answeredAt = onset.t
    this.answeredBy = 'play'
    this.finishRep(tonicMatches(this.item, onset.midi) ? 'correct' : 'incorrect')
  }

  protected buildResult(
    q: KeyIdQuestion,
    outcome: RepOutcome,
    t0: number,
    startedWithoutSilence: boolean,
  ): RepResult {
    const ms = this.answeredAt !== null ? this.answeredAt - t0 : null
    return {
      sessionId: this.sessionId,
      mode: 'keyid',
      targetId: q.id,
      dims: { key: keyName(q.key), format: q.format, keyMode: q.key.mode },
      reactionMs: ms,
      completionMs: outcome === 'correct' ? ms : null,
      errors: [],
      heard: [],
      outcome,
      startedWithoutSilence,
      keyId: {
        format: q.format,
        correct: q.answer,
        given: this.given,
        method: this.answeredBy ?? this.method,
        ...(this.playedMidi !== null && { playedMidi: this.playedMidi }),
      },
      timestamp: new Date().toISOString(),
    }
  }
}
