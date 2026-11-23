import { keysUpTo } from '../theory/generator'
import { type KeySignature, type Mode } from '../theory/keys'
import { mulberry32, pick, type Rng } from '../theory/random'
import type { Clef } from '../theory/staff'

/**
 * Key identification questions (design §7): a key signature is flashed on a staff, treble or bass (one at a time, chosen
 * at random for each question; it is not a setting), and the player names the key.
 * A signature alone fits two keys (a major and its relative minor), so each question is asked so that it has exactly one
 * right answer:
 *  - 'major': only major keys are asked, so the signature alone names the key ("which major key?")
 *  - 'minor': only minor keys are asked, so the signature alone names the key ("which minor key?")
 *  - 'key': major and minor are mixed, so the answer is a major or a minor key
 * Whatever the format, the screen says under the staff which mode is wanted ("Major" or "Minor"), so the signature and
 * that label always name exactly one key. The tonic is never shown.
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

/** One mode asked, or both mixed (the question then says which mode it wants). */
export const formatFor = (modes: KeyIdConfig['modes']): KeyIdFormat =>
  modes === 'both' ? 'key' : modes

export type KeyIdQuestion = {
  id: string
  /** The key behind the question. Its signature is what is drawn. */
  key: KeySignature
  /** The clef the signature is drawn in: treble or bass, so the sharps and flats are read in both. */
  clef: Clef
  accidentals: number
  format: KeyIdFormat
  prompt: string
  answer: KeyIdAnswer
}

const CLEFS: Clef[] = ['treble', 'bass']

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
 * Every answer in the format's answer space that fits what is asked (the signature drawn, and the mode named under the
 * staff), worked out from the question alone. A well-formed question has exactly one.
 */
export const consistentAnswers = (q: KeyIdQuestion): KeyIdAnswer[] =>
  answerSpace(q.format).filter((a) => a.accidentals === q.accidentals && a.mode === q.answer.mode)

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
    const clef = pick(this.rng, CLEFS)
    this.lastSignature = key.accidentals
    const answer = correctAnswer(format, key)
    return {
      id: `k${++this.count}`,
      key,
      clef,
      accidentals: key.accidentals,
      format,
      prompt: `Which ${answer.mode} key?`,
      answer,
    }
  }
}
