import { keysUpTo } from '../theory/generator'
import { keySignature, type KeySignature, type Mode } from '../theory/keys'
import { pitch, type Pitch } from '../theory/pitch'
import { mulberry32, pick, randInt, type Rng } from '../theory/random'
import { ledgerLines } from '../theory/staff'

/**
 * Key identification questions (design §7): a key signature is flashed on a treble staff and the player names the key.
 * A signature alone fits two keys (a major and its relative minor), so each question is asked so that it has exactly one
 * right answer:
 *  - 'major': only major keys are asked, so the signature alone names the key ("which major key?")
 *  - 'minor': only minor keys are asked, so the signature alone names the key ("which minor key?")
 *  - 'key': major and minor are mixed, so a whole note on the tonic is shown with the signature (and only then: a note
 *    on the staff would give the answer away when the signature already settles it)
 * Which one applies follows from the keys in the level; it is never a choice. F♯ major and G♭ major sound the same but
 * have different signatures, so they are always different answers.
 */
export type KeyIdFormat = 'major' | 'minor' | 'key'

export type KeyIdAnswer = {
  /** Sharps (positive) or flats (negative): -7..7. */
  accidentals: number
  /** The mode of the key named. */
  mode: Mode
}

export type KeyIdConfig = {
  maxAccidentals: number
  /** Which keys the questions are drawn from. */
  modes: 'major' | 'minor' | 'both'
}

export const DEFAULT_KEY_ID_CONFIG: KeyIdConfig = { maxAccidentals: 2, modes: 'major' }

/** One mode asked: the signature alone names the key. Both: the tonic is shown too. */
export const formatFor = (modes: KeyIdConfig['modes']): KeyIdFormat =>
  modes === 'both' ? 'key' : modes

export type KeyIdQuestion = {
  id: string
  /** The key behind the question. Its signature is what is drawn. */
  key: KeySignature
  accidentals: number
  format: KeyIdFormat
  /** For format 'key': a whole note on the tonic, drawn on the staff. */
  hint: Pitch | null
  prompt: string
  answer: KeyIdAnswer
}

const PROMPTS: Record<KeyIdFormat, string> = {
  major: 'Which major key?',
  minor: 'Which minor key?',
  key: 'Which key? The note shown is the tonic.',
}

/** The right answer: the key named by the signature, in the mode asked (for 'key', the mode of the key itself). */
export function correctAnswer(format: KeyIdFormat, key: KeySignature): KeyIdAnswer {
  return { accidentals: key.accidentals, mode: format === 'key' ? key.mode : format }
}

/** Every answer a person could give in this format (what the answer buttons offer). */
export function answerSpace(format: KeyIdFormat): KeyIdAnswer[] {
  const counts = Array.from({ length: 15 }, (_, i) => i - 7)
  const modes: Mode[] = format === 'key' ? ['major', 'minor'] : [format]
  return counts.flatMap((accidentals) => modes.map((mode) => ({ accidentals, mode })))
}

/** Is `given` right? Same signature (so F♯ and G♭ differ) and the same mode. */
export const checkAnswer = (q: KeyIdQuestion, given: KeyIdAnswer): boolean =>
  given.accidentals === q.accidentals && given.mode === q.answer.mode

/**
 * Every answer in the format's answer space that fits what is actually drawn (the signature, and for 'key' the tonic
 * note), worked out from the picture alone. A well-formed question has exactly one.
 */
export function consistentAnswers(q: KeyIdQuestion): KeyIdAnswer[] {
  return answerSpace(q.format).filter((a) => {
    if (a.accidentals !== q.accidentals) return false
    if (q.format !== 'key') return true
    const tonic = keySignature(a.accidentals, a.mode).tonic
    return (
      !!q.hint &&
      q.hint.spelling.letter === tonic.letter &&
      q.hint.spelling.accidental === tonic.accidental
    )
  })
}

/**
 * Does this played note answer the question? The tonic of the key named, in any octave. A played note carries a pitch
 * but no spelling, so F♯ and G♭ are the same answer when played.
 */
export function tonicMatches(q: KeyIdQuestion, midi: number): boolean {
  const key = keySignature(q.answer.accidentals, q.answer.mode)
  return pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12 === ((midi % 12) + 12) % 12
}

/** A tonic note on the treble staff with no ledger lines, in a random octave that fits. */
function tonicOnStaff(key: KeySignature, rng: Rng): Pitch {
  const options: Pitch[] = []
  for (let octave = 1; octave <= 6; octave++) {
    const p = pitch(key.tonic.letter, key.tonic.accidental, octave)
    if (ledgerLines(p, 'treble') === 0) options.push(p)
  }
  // The staff holds a full octave and more, so there is always at least one place for a tonic.
  return options[randInt(rng, options.length)]
}

/**
 * Makes key-ID questions: keys drawn evenly, and never the same signature twice in a row (a major key and its
 * relative minor look identical, so they count as a repeat too).
 */
export class KeyIdGenerator {
  readonly config: KeyIdConfig
  private readonly rng: Rng
  private readonly pool: KeySignature[]
  private lastSignature: number | null = null
  private count = 0

  constructor(config: KeyIdConfig, seed = 1) {
    this.config = config
    this.rng = mulberry32(seed)
    this.pool = keysUpTo(
      config.maxAccidentals,
      config.modes === 'both' ? ['major', 'minor'] : [config.modes],
    )
    if (this.pool.length === 0) throw new RangeError('no keys match the settings')
  }

  next(): KeyIdQuestion {
    const candidates = this.pool.filter((k) => k.accidentals !== this.lastSignature)
    const key = pick(this.rng, candidates.length > 0 ? candidates : this.pool)
    const format = formatFor(this.config.modes)
    this.lastSignature = key.accidentals
    return {
      id: `k${++this.count}`,
      key,
      accidentals: key.accidentals,
      format,
      hint: format === 'key' ? tonicOnStaff(key, this.rng) : null,
      prompt: PROMPTS[format],
      answer: correctAnswer(format, key),
    }
  }
}
