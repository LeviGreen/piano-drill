import type { NoteInput, NoteInputState } from '../audio/inputs/NoteInput'
import { RepSession, type RepSessionOptions } from '../session/RepSession'
import type { BaseSnapshot, RepOutcome, RepResult } from '../session/types'
import { keyName } from '../theory/keys'
import { checkAnswer, type KeyIdAnswer, type KeyIdQuestion } from './questions'
import { Checklist, onClefSide, PLAY_GRACE_SECONDS, type ChecklistRow } from './checklist'

export type KeyIdSessionSettings = {
  /** Seconds before a question times out, or null for no timeout. */
  timeoutSeconds: number | null
}

/** The view the player is answering in: the wheel, the text box, or a MIDI piano. */
export type KeyIdAnswerMethod = 'wheel' | 'type' | 'play'

export type KeyIdSessionOptions = Omit<RepSessionOptions<KeyIdQuestion>, 'timeoutSeconds'> & {
  settings: KeyIdSessionSettings
  /** Where played notes come from. Needed for the 'play' method (answering by playing the checklist). */
  input?: NoteInput
  /** How the player is answering to begin with (they can switch with `setMethod`). Default 'wheel'. */
  method?: KeyIdAnswerMethod
}

export type KeyIdSnapshot = BaseSnapshot<KeyIdQuestion> & {
  question: KeyIdQuestion | null
  /** The right answer as tapped or typed, once the question is solved; null before that, and for a played note. */
  given: KeyIdAnswer | null
  /** For the play method: the checklist to play and what is done so far (empty for tapping), and the keys held right now. */
  checklist: ChecklistRow[]
  held: { midi: number; wrong: boolean }[]
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
 * The player can answer in two ways and switch between them at any time: tapping or typing (`answer`), or playing
 * the key on a MIDI piano (see checklist.ts): a checklist of the scale up and down, the tonic chord with its
 * inversions, and the sharps or flats, done in any order. A slip resets only the row it was in. Playing takes much
 * longer than tapping, so a question answered that way gets a longer time limit.
 */
export class KeyIdSession extends RepSession<KeyIdQuestion, KeyIdSnapshot> {
  private readonly input: NoteInput | null
  private method: KeyIdAnswerMethod
  private unsubscribeInput: (() => void) | null = null
  private given: KeyIdAnswer | null = null
  private checklist: Checklist | null = null
  private held: number[] = []
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
    this.method = opts.method ?? 'wheel'
    if (this.method === 'play' && !this.input)
      throw new RangeError('The play answer method needs an input')
  }

  get snapshot(): KeyIdSnapshot {
    return {
      ...this.baseSnapshot(),
      question: this.item,
      given: this.given,
      checklist: this.method === 'play' ? (this.checklist?.rows() ?? []) : [],
      held: this.held.map((midi) => ({ midi, wrong: this.checklist?.isWrongNote(midi) ?? false })),
      wrong: [...this.wrong],
      wrongPlayed: [...this.wrongPlayed],
      method: this.method,
    }
  }

  /** Switch between answering on the wheel, by typing and by playing. Playing needs an input. */
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
    return base === null ? null : base + (this.method === 'play' ? PLAY_GRACE_SECONDS : 0)
  }

  protected beginRep(item: KeyIdQuestion): void {
    this.given = null
    this.checklist = new Checklist(item)
    this.held = []
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
    if (this.state !== 'FLASHED' || !this.item || this.t0 === null || this.method === 'play') return
    const now = this.clock.now()
    if (checkAnswer(this.item, given)) {
      this.given = given
      this.firstGuessAt ??= now
      this.solvedAt = now
      this.solvedBy = this.method
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
    this.held = [...update.activeNotes.keys()]
    if (this.state === 'READY') {
      this.recheckReady()
      return
    }
    if (this.state !== 'FLASHED' || this.t0 === null || !this.item) return
    // Every note struck after the question appeared goes to the checklist, in order. A wrong note (on the clef's side of
    // middle C but not in the key) costs points; any other slip only resets the row it was in, and notes on the other
    // side of middle C are ignored.
    const checklist = this.checklist
    if (!checklist) return
    const onsets = [...update.onsets].sort((a, b) => a.t - b.t).filter((o) => o.t >= this.t0!)
    const held = [...update.activeNotes.keys()]
    for (const onset of onsets) {
      if (onClefSide(this.item, onset.midi)) this.firstGuessAt ??= onset.t
      if (checklist.isWrongNote(onset.midi)) {
        this.wrongPlayed.push(onset.midi)
        this.errors.push({ t: onset.t - this.t0, notes: [onset.midi] })
      }
      checklist.strike(onset.midi, held)
    }
    if (onsets.length > 0) checklist.hold(held) // only when a key goes down, not as a bigger chord is let go of
    if (checklist.complete) {
      this.solvedAt = onsets.at(-1)?.t ?? update.t
      this.solvedBy = 'play'
      this.solved()
      return
    }
    this.emit()
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
