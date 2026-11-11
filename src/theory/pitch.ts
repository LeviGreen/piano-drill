/**
 * Pitch spelling primitives (PD-101).
 *
 * Notation needs *spelled* pitches (F♯ is not G♭), so everything here carries a letter,
 * accidental and octave alongside the MIDI number. Octaves follow scientific pitch notation:
 * C4 = middle C = MIDI 60, and the octave number changes at C (so B♯3 is MIDI 60 and C♭4 is 59).
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]
export type Accidental = -2 | -1 | 0 | 1 | 2
/** 0 = C ... 11 = B. */
export type PitchClass = number

export type Spelling = { letter: Letter; accidental: Accidental; octave: number }
export type Pitch = { midi: number; spelling: Spelling }

const LETTER_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACCIDENTAL_SYMBOL: Record<Accidental, string> = {
  [-2]: '𝄫',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '𝄪',
}
const ACCIDENTAL_ASCII: Record<Accidental, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
}

const letterIndex = (l: Letter): number => LETTERS.indexOf(l)

function isAccidental(n: number): n is Accidental {
  return Number.isInteger(n) && n >= -2 && n <= 2
}

// ---------- construction & MIDI conversion ----------

/** Build a pitch from its spelling; MIDI is derived. */
export function pitch(letter: Letter, accidental: Accidental, octave: number): Pitch {
  const midi = 12 * (octave + 1) + LETTER_SEMITONES[letter] + accidental
  return { midi, spelling: { letter, accidental, octave } }
}

const SHARP_SPELLINGS: [Letter, Accidental][] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
]
const FLAT_SPELLINGS: [Letter, Accidental][] = [
  ['C', 0],
  ['D', -1],
  ['D', 0],
  ['E', -1],
  ['E', 0],
  ['F', 0],
  ['G', -1],
  ['G', 0],
  ['A', -1],
  ['A', 0],
  ['B', -1],
  ['B', 0],
]

/** Default spelling for a raw MIDI number (black keys as sharps or flats). */
export function pitchFromMidi(midi: number, prefer: 'sharp' | 'flat' = 'sharp'): Pitch {
  if (!Number.isInteger(midi)) throw new RangeError(`MIDI number must be an integer: ${midi}`)
  const [letter, accidental] = (prefer === 'sharp' ? SHARP_SPELLINGS : FLAT_SPELLINGS)[
    ((midi % 12) + 12) % 12
  ]
  return pitch(letter, accidental, Math.floor(midi / 12) - 1)
}

export const pitchClass = (p: Pitch | number): PitchClass =>
  (((typeof p === 'number' ? p : p.midi) % 12) + 12) % 12

// ---------- text ----------

/** "C♯4", "B𝄫3". */
export function formatPitch(p: Pitch): string {
  const s = p.spelling
  return `${s.letter}${ACCIDENTAL_SYMBOL[s.accidental]}${s.octave}`
}

/** ASCII form used in tests and data: "C#4", "Bb3", "F##2", "Dbb5". */
export function formatPitchAscii(p: Pitch): string {
  const s = p.spelling
  return `${s.letter}${ACCIDENTAL_ASCII[s.accidental]}${s.octave}`
}

/** Parse "C4", "C#4", "Bb3", "F##2", "Dbb5" (also ♯ ♭ 𝄪 𝄫). Throws on bad input. */
export function parsePitch(text: string): Pitch {
  const m = /^([A-G])(##|bb|#|b|♯|♭|𝄪|𝄫)?(-?\d+)$/.exec(text.trim())
  if (!m) throw new SyntaxError(`Cannot parse pitch: "${text}"`)
  const acc: Record<string, Accidental> = {
    '': 0,
    '#': 1,
    '♯': 1,
    '##': 2,
    '𝄪': 2,
    b: -1,
    '♭': -1,
    bb: -2,
    '𝄫': -2,
  }
  return pitch(m[1] as Letter, acc[m[2] ?? ''], Number(m[3]))
}

// ---------- enharmonics & comparison ----------

export const isEnharmonic = (a: Pitch, b: Pitch): boolean => a.midi === b.midi

/** Every spelling (accidental within ±2) that sounds the same as `p`, including `p` itself. */
export function enharmonicSpellings(p: Pitch): Pitch[] {
  const out: Pitch[] = []
  for (const letter of LETTERS) {
    for (const octave of [p.spelling.octave - 1, p.spelling.octave, p.spelling.octave + 1]) {
      const acc = p.midi - (12 * (octave + 1) + LETTER_SEMITONES[letter])
      if (isAccidental(acc)) out.push(pitch(letter, acc, octave))
    }
  }
  return out.sort(comparePitches)
}

/** Order by sounding pitch, then by written position (letter/octave), then accidental. */
export function comparePitches(a: Pitch, b: Pitch): number {
  return (
    a.midi - b.midi ||
    diatonicIndex(a) - diatonicIndex(b) ||
    a.spelling.accidental - b.spelling.accidental
  )
}

export const sortPitches = (ps: readonly Pitch[]): Pitch[] => [...ps].sort(comparePitches)

/** Letter-name position counted in steps from C0 (ignores accidentals). */
export const diatonicIndex = (p: Pitch): number =>
  p.spelling.octave * 7 + letterIndex(p.spelling.letter)

// ---------- pitch-class sets ----------

/** Sorted, de-duplicated pitch classes of the given pitches. */
export function pitchClassSet(ps: readonly (Pitch | number)[]): PitchClass[] {
  return [...new Set(ps.map(pitchClass))].sort((a, b) => a - b)
}

export function samePitchClassSet(
  a: readonly (Pitch | number)[],
  b: readonly (Pitch | number)[],
): boolean {
  const x = pitchClassSet(a)
  const y = pitchClassSet(b)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

// ---------- intervals ----------

export type Quality = 'dd' | 'd' | 'm' | 'P' | 'M' | 'A' | 'AA'
/** `steps` = letter-name distance (unison 0, second 1, ... octave 7); `semitones` = sounding distance. */
export type Interval = { steps: number; semitones: number }

const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
const isPerfectType = (steps: number): boolean => [0, 3, 4].includes(steps % 7)
const baseSemitones = (steps: number): number =>
  12 * Math.floor(steps / 7) + MAJOR_SCALE_SEMITONES[steps % 7]

const PERFECT_OFFSET: Partial<Record<Quality, number>> = { dd: -2, d: -1, P: 0, A: 1, AA: 2 }
const MAJOR_OFFSET: Partial<Record<Quality, number>> = { dd: -3, d: -2, m: -1, M: 0, A: 1, AA: 2 }

/** Build an interval from quality and ordinal size, e.g. interval('M', 3), interval('P', 8). */
export function interval(quality: Quality, number: number): Interval {
  if (!Number.isInteger(number) || number < 1) throw new RangeError(`Bad interval size: ${number}`)
  const steps = number - 1
  const offset = (isPerfectType(steps) ? PERFECT_OFFSET : MAJOR_OFFSET)[quality]
  if (offset === undefined) throw new RangeError(`${quality}${number} is not a valid interval`)
  return { steps, semitones: baseSemitones(steps) + offset }
}

/** Name an interval, e.g. "M3", "P5", "A4", "m10". */
export function intervalName(iv: Interval): string {
  const diff = iv.semitones - baseSemitones(iv.steps)
  const table = isPerfectType(iv.steps)
    ? { [-2]: 'dd', [-1]: 'd', 0: 'P', 1: 'A', 2: 'AA' }
    : { [-3]: 'dd', [-2]: 'd', [-1]: 'm', 0: 'M', 1: 'A', 2: 'AA' }
  const quality = (table as Record<number, string>)[diff]
  if (!quality) throw new RangeError(`Interval out of supported range: ${JSON.stringify(iv)}`)
  return `${quality}${iv.steps + 1}`
}

/** Interval from `lower` up to `upper` (the written order must not descend). */
export function intervalBetween(lower: Pitch, upper: Pitch): Interval {
  const steps = diatonicIndex(upper) - diatonicIndex(lower)
  if (steps < 0) throw new RangeError('upper pitch is written below lower pitch')
  return { steps, semitones: upper.midi - lower.midi }
}

/**
 * Transpose by an interval, keeping spelling correct (C♯ + M3 = E♯, not F).
 * Throws if the result would need a triple sharp/flat.
 */
export function transpose(p: Pitch, iv: Interval, direction: 'up' | 'down' = 'up'): Pitch {
  const sign = direction === 'up' ? 1 : -1
  const index = diatonicIndex(p) + sign * iv.steps
  const letter = LETTERS[((index % 7) + 7) % 7]
  const octave = Math.floor(index / 7)
  const targetMidi = p.midi + sign * iv.semitones
  const accidental = targetMidi - (12 * (octave + 1) + LETTER_SEMITONES[letter])
  if (!isAccidental(accidental)) {
    throw new RangeError(`Transposing ${formatPitchAscii(p)} gives a triple accidental`)
  }
  return pitch(letter, accidental, octave)
}
