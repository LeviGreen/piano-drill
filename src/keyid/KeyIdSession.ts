import type { NoteInput, NoteInputState } from '../audio/inputs/NoteInput'
import { RepSession, type RepSessionOptions } from '../session/RepSession'
import type { BaseSnapshot, RepOutcome, RepResult } from '../session/types'
import { keyName } from '../theory/keys'
import { checkAnswer, type KeyIdAnswer, type KeyIdQuestion } from './questions'
import { SCALE_GRACE_SECONDS, scaleNotes, startsScale } from './scalePlay'

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
  /** The right answer as tapped or typed, once the question is solved; null before that, and for a played note. */
  given: KeyIdAnswer | null
  /** For the play method: the scale to play (up and back down), and how many of its notes are done so far. */
  scale: number[]
  progress: number
  /** The wrong keys named so far for this question (tapped or typed), and the wrong notes played. */
  wrong: KeyIdAnswer[]
  wrongPlayed: number[]
  method: KeyIdAnswerMethod
}

/**
 * Key identification (design §7): a key signature is flashed and the player names the key. It shares the whole rep cycle
 * with play mode (RepSession) and, like it, lets the player keep trying. A wrong guess is recorded (and costs points)
 * but does not end the question or reveal the answer; the question ends when the player gets it (correct, or correct
 * with errors if they guessed wrong first), when time runs out, or when they skip. Only a timeout or a skip reveals
 * the answer.
 *
 * The player can answer in two ways and switch between them at any time: tapping or typing (`answer`), or playing the
 * key's scale on the piano, up one octave and back down in order (see scalePlay.ts). Any note struck after the question
 * appears is a try: the next note of the scale moves on, anything else is a wrong note and sends the player back to the
 * start. Playing takes longer than tapping, so a question answered that way gets a longer time limit.
 */
export class KeyIdSession extends RepSession<KeyIdQuestion, KeyIdSnapshot> {
  private readonly input: NoteInput | null
  private method: KeyIdAnswerMethod
  private unsubscribeInput: (() => void) | null = null
  private given: KeyIdAnswer | null = null
  private progress = 0
  /** The note the scale was started on (fixes its octave); null until the player starts one. */
  private tonic: number | null = null
  private wrong: KeyIdAnswer[] = []
  private wrongPlayed: number[] = []
  private errors: { t: number; notes: number[] }[] = []
  private firstGuessAt: number | null = null
  private solvedAt: number | null = null
  private solvedBy: KeyIdAnswerMethod | null = null
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
      scale: this.item ? scaleNotes(this.item, this.tonic ?? undefined) : [],
      progress: this.progress,
      wrong: [...this.wrong],
      wrongPlayed: [...this.wrongPlayed],
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

  /** The limit is set when the question appears, by the way it is being answered then. */
  protected limitSecondsFor(): number | null {
    const base = this.cfg.timeoutSeconds
    return base === null ? null : base + (this.method === 'play' ? SCALE_GRACE_SECONDS : 0)
  }

  protected beginRep(): void {
    this.given = null
    this.progress = 0
    this.tonic = null
    this.wrong = []
    this.wrongPlayed = []
    this.errors = []
    this.firstGuessAt = null
    this.solvedAt = null
    this.solvedBy = null
  }

  private solved(): void {
    this.finishRep(this.errors.length > 0 ? 'correct_with_errors' : 'correct')
  }

  /** The player answered by tapping or typing. A wrong answer is recorded and they can try again. */
  answer(given: KeyIdAnswer): void {
    if (this.state !== 'FLASHED' || !this.item || this.t0 === null || this.method !== 'tap') return
    const now = this.clock.now()
    if (checkAnswer(this.item, given)) {
      this.given = given
      this.firstGuessAt ??= now
      this.solvedAt = now
      this.solvedBy = 'tap'
      this.solved()
      return
    }
    // Naming the same wrong key again tells us nothing new.
    if (this.wrong.some((w) => w.accidentals === given.accidentals && w.mode === given.mode)) return
    this.wrong.push(given)
    this.errors.push({ t: now - this.t0, notes: [] })
    this.firstGuessAt ??= now
    this.emit()
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
    // Every note struck after the question appeared is a try, in order. The first note starts the scale: the key's tonic
    // in any octave on the clef's side of middle C. After that the next note of the scale moves on, and anything else is
    // a wrong note that sends the player back to the start (a wrong note that could itself start the scale counts as the start).
    const onsets = [...update.onsets].sort((a, b) => a.t - b.t).filter((o) => o.t >= this.t0!)
    for (const onset of onsets) {
      this.firstGuessAt ??= onset.t
      if (this.tonic === null) {
        if (startsScale(this.item, onset.midi)) {
          this.tonic = onset.midi
          this.progress = 1
          continue
        }
      } else {
        const scale = scaleNotes(this.item, this.tonic)
        if (onset.midi === scale[this.progress]) {
          this.progress++
          if (this.progress === scale.length) {
            this.solvedAt = onset.t
            this.solvedBy = 'play'
            this.solved()
            return
          }
          continue
        }
      }
      this.wrongPlayed.push(onset.midi)
      this.errors.push({ t: onset.t - this.t0, notes: [onset.midi] })
      const restart = startsScale(this.item, onset.midi)
      this.tonic = restart ? onset.midi : null
      this.progress = restart ? 1 : 0
    }
    if (onsets.length > 0) this.emit()
  }

  protected buildResult(
    q: KeyIdQuestion,
    outcome: RepOutcome,
    t0: number,
    startedWithoutSilence: boolean,
  ): RepResult {
    const solved = this.solvedAt !== null ? this.solvedAt - t0 : null
    return {
      sessionId: this.sessionId,
      mode: 'keyid',
      targetId: q.id,
      dims: { key: keyName(q.key), clef: q.clef, format: q.format, keyMode: q.key.mode },
      reactionMs: this.firstGuessAt !== null ? this.firstGuessAt - t0 : null,
      completionMs: solved,
      errors: this.errors.map((e) => ({ ...e, notes: [...e.notes] })),
      heard: [],
      outcome,
      startedWithoutSilence,
      keyId: {
        format: q.format,
        correct: q.answer,
        given: this.given,
        wrong: [...this.wrong],
        wrongPlayed: [...this.wrongPlayed],
        method: this.solvedBy ?? this.method,
      },
      timestamp: new Date().toISOString(),
    }
  }
}
