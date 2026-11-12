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
  /** The right answer as tapped or typed, once the question is solved; null before that, and for a played note. */
  given: KeyIdAnswer | null
  /** For the play method: the note that was right. */
  playedMidi: number | null
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
 * tonic of the key on the piano (any note after the question appears is a guess; the tonic in any octave is right).
 */
export class KeyIdSession extends RepSession<KeyIdQuestion, KeyIdSnapshot> {
  private readonly input: NoteInput | null
  private method: KeyIdAnswerMethod
  private unsubscribeInput: (() => void) | null = null
  private given: KeyIdAnswer | null = null
  private playedMidi: number | null = null
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
      playedMidi: this.playedMidi,
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

  protected beginRep(): void {
    this.given = null
    this.playedMidi = null
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
    // Every note struck after the question appeared is a guess, in order: the tonic ends the question.
    const onsets = [...update.onsets].sort((a, b) => a.t - b.t).filter((o) => o.t >= this.t0!)
    for (const onset of onsets) {
      this.firstGuessAt ??= onset.t
      if (tonicMatches(this.item, onset.midi)) {
        this.playedMidi = onset.midi
        this.solvedAt = onset.t
        this.solvedBy = 'play'
        this.solved()
        return
      }
      this.wrongPlayed.push(onset.midi)
      this.errors.push({ t: onset.t - this.t0, notes: [onset.midi] })
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
        ...(this.playedMidi !== null && { playedMidi: this.playedMidi }),
      },
      timestamp: new Date().toISOString(),
    }
  }
}
