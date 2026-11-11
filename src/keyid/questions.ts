import { keysUpTo } from '../theory/generator'
import { keySignature, type KeySignature, type Mode } from '../theory/keys'
import { pitch, type Pitch } from '../theory/pitch'
import { mulberry32, pick, randInt, type Rng } from '../theory/random'
import { ledgerLines, type Clef } from '../theory/staff'

/**
 * Key identification questions (design §7). A key signature alone fits two keys, a major and its relative
 * minor, so each question asks in a way that has exactly one right answer:
 *  - 'signature': how many sharps or flats (the answer is the count, -7..7)
 *  - 'major': name the major key (a minor-key signature has the same answer: its relative major)
 *  - 'key': a tonic note is shown with the signature, so the answer is one specific major or minor key
 *  - 'pair': pick the major/relative-minor pair (the answer is the signature)
 */
export type KeyIdFormat = 'signature' | 'major' | 'key' | 'pair'

/** F♯ major and G♭ major sound the same but have different signatures. Strict: the spelling must match. */
export type EnharmonicStrictness = 'strict' | 'lenient'

export type KeyIdAnswer = {
  /** Sharps (positive) or flats (negative): -7..7. */
  accidentals: number
  /** Required for 'major' (always major) and 'key' formats. */
  mode?: Mode
}

export type KeyIdConfig = {
  maxAccidentals: number
  /** Which keys the questions are drawn from. */
  modes: 'major' | 'minor' | 'both'
  clefs: Clef[]
  format: KeyIdFormat
  enharmonic: EnharmonicStrictness
}

export const DEFAULT_KEY_ID_CONFIG: KeyIdConfig = {
  maxAccidentals: 2,
  modes: 'both',
  clefs: ['treble', 'bass'],
  format: 'major',
  enharmonic: 'strict',
}

export type KeyIdQuestion = {
  id: string
  clef: Clef
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
  signature: 'How many sharps or flats?',
  major: 'Which major key?',
  key: 'Which key? The note shown is the tonic.',
  pair: 'Which major and minor key?',
}

/** The right answer for a question's format. */
export function correctAnswer(format: KeyIdFormat, key: KeySignature): KeyIdAnswer {
  switch (format) {
    case 'signature':
    case 'pair':
      return { accidentals: key.accidentals }
    case 'major':
      return { accidentals: key.accidentals, mode: 'major' }
    case 'key':
      return { accidentals: key.accidentals, mode: key.mode }
  }
}

/** Every answer a person could give in this format (what the answer buttons offer). */
export function answerSpace(format: KeyIdFormat): KeyIdAnswer[] {
  const counts = Array.from({ length: 15 }, (_, i) => i - 7)
  switch (format) {
    case 'signature':
    case 'pair':
      return counts.map((accidentals) => ({ accidentals }))
    case 'major':
      return counts.map((accidentals) => ({ accidentals, mode: 'major' as const }))
    case 'key':
      return counts.flatMap((accidentals) => [
        { accidentals, mode: 'major' as const },
        { accidentals, mode: 'minor' as const },
      ])
  }
}

/** The same signature spelled the other way: 5 sharps (B major) and 7 flats (C♭ major) sound alike. */
export function enharmonicAccidentals(n: number): number | null {
  for (const alt of [n + 12, n - 12]) if (alt >= -7 && alt <= 7) return alt
  return null
}

/** Is `given` right for the question? Strict needs the same signature; lenient also accepts the enharmonic one. */
export function checkAnswer(
  q: KeyIdQuestion,
  given: KeyIdAnswer,
  strictness: EnharmonicStrictness,
): boolean {
  const sameSignature =
    given.accidentals === q.accidentals ||
    (strictness === 'lenient' && given.accidentals === enharmonicAccidentals(q.accidentals))
  if (!sameSignature) return false
  if (q.format === 'major') return (given.mode ?? 'major') === 'major'
  if (q.format === 'key') return given.mode === q.key.mode
  return true
}

/**
 * Every answer in the format's answer space that fits what is actually drawn (the signature, and for 'key' the
 * tonic note), worked out from the picture alone. A well-formed question has exactly one.
 */
export function consistentAnswers(q: KeyIdQuestion): KeyIdAnswer[] {
  return answerSpace(q.format).filter((a) => {
    if (a.accidentals !== q.accidentals) return false
    if (q.format !== 'key') return true
    const tonic = keySignature(a.accidentals, a.mode!).tonic
    return (
      !!q.hint &&
      q.hint.spelling.letter === tonic.letter &&
      q.hint.spelling.accidental === tonic.accidental
    )
  })
}

/** A tonic note placed on the staff with no ledger lines, in a random octave that fits. */
function tonicOnStaff(key: KeySignature, clef: Clef, rng: Rng): Pitch {
  const options: Pitch[] = []
  for (let octave = 1; octave <= 6; octave++) {
    const p = pitch(key.tonic.letter, key.tonic.accidental, octave)
    if (ledgerLines(p, clef) === 0 && p.midi >= 40 && p.midi <= 79) options.push(p)
  }
  // The staff holds a full octave and more, so there is always at least one place for a tonic.
  return options[randInt(rng, options.length)]
}

/**
 * Makes key-ID questions: keys drawn evenly, never the same signature twice in a row (a major key and its
 * relative minor look identical, so they count as a repeat too), clef chosen at random from the allowed ones.
 */
export class KeyIdGenerator {
  readonly config: KeyIdConfig
  private readonly rng: Rng
  private readonly pool: KeySignature[]
  private lastSignature: number | null = null
  private count = 0

  constructor(config: KeyIdConfig, seed = 1) {
    if (config.clefs.length === 0) throw new RangeError('config.clefs must not be empty')
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
    const clef = pick(this.rng, this.config.clefs)
    const { format } = this.config
    this.lastSignature = key.accidentals
    return {
      id: `k${++this.count}`,
      clef,
      key,
      accidentals: key.accidentals,
      format,
      hint: format === 'key' ? tonicOnStaff(key, clef, this.rng) : null,
      prompt: PROMPTS[format],
      answer: correctAnswer(format, key),
    }
  }
}
