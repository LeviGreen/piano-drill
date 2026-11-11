import { scale, type KeySignature } from './keys'
import {
  formatPitchAscii,
  intervalBetween,
  intervalName,
  pitch,
  sortPitches,
  type Accidental,
  type Pitch,
} from './pitch'

/** Which minor scale chords are built from: natural (v, VII) or harmonic (V, vii°). Ignored in major keys. */
export type MinorForm = 'natural' | 'harmonic'
export type ChordSize = 'triad' | 'seventh'
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'dominant7'
  | 'major7'
  | 'minor7'
  | 'half-diminished7'
  | 'diminished7'
  | 'minor-major7'
  | 'augmented-major7'
export type ChordRole = 'root' | 'third' | 'fifth' | 'seventh'

export type ChordTone = { role: ChordRole; pitch: Pitch }
export type Chord = {
  degree: number // 1..7
  size: ChordSize
  quality: ChordQuality
  inversion: number
  /** Chord tones from lowest to highest as played (after inversion). */
  tones: ChordTone[]
  /** Just the pitches, lowest to highest. */
  pitches: Pitch[]
  /** e.g. "Dm", "G7", "C/E", "B°". */
  label: string
  /** e.g. "ii", "V7", "vii°". */
  roman: string
}

export type ChordOptions = { inversion?: number; octave?: number; form?: MinorForm }

// ---------- scale degrees ----------

/**
 * The pitch at a (0-based) scale-degree index above the tonic, continuing into higher octaves
 * (index 7 is the tonic an octave up) and below (index -1 is the 7th degree below the tonic).
 */
export function scalePitch(
  key: KeySignature,
  index: number,
  tonicOctave = 4,
  form: MinorForm = 'natural',
): Pitch {
  const notes = scale(
    key,
    tonicOctave,
    key.mode === 'minor' && form === 'harmonic' ? 'harmonic' : 'natural',
  )
  const octaves = Math.floor(index / 7)
  const n = notes[((index % 7) + 7) % 7]
  return pitch(n.spelling.letter, n.spelling.accidental, n.spelling.octave + octaves)
}

/** Interval by diatonic size in a key: the note `size - 1` scale steps above scale degree `degree` (1-based). */
export function diatonicInterval(
  key: KeySignature,
  degree: number,
  size: number,
  tonicOctave = 4,
  form: MinorForm = 'natural',
): { lower: Pitch; upper: Pitch; name: string } {
  const lower = scalePitch(key, degree - 1, tonicOctave, form)
  const upper = scalePitch(key, degree - 1 + size - 1, tonicOctave, form)
  return { lower, upper, name: intervalName(intervalBetween(lower, upper)) }
}

// ---------- chord quality ----------

const TRIAD_QUALITIES: Record<string, ChordQuality> = {
  '4,7': 'major',
  '3,7': 'minor',
  '3,6': 'diminished',
  '4,8': 'augmented',
}
const SEVENTH_QUALITIES: Record<string, ChordQuality> = {
  '4,7,11': 'major7',
  '4,7,10': 'dominant7',
  '3,7,10': 'minor7',
  '3,6,10': 'half-diminished7',
  '3,6,9': 'diminished7',
  '3,7,11': 'minor-major7',
  '4,8,11': 'augmented-major7',
}

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: 'm',
  diminished: '°',
  augmented: '+',
  dominant7: '7',
  major7: 'maj7',
  minor7: 'm7',
  'half-diminished7': 'ø7',
  diminished7: '°7',
  'minor-major7': 'mMaj7',
  'augmented-major7': '+maj7',
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const LOWERCASE: ChordQuality[] = [
  'minor',
  'diminished',
  'minor7',
  'half-diminished7',
  'diminished7',
  'minor-major7',
]
const ROMAN_SUFFIX: Record<ChordQuality, string> = {
  major: '',
  minor: '',
  diminished: '°',
  augmented: '+',
  dominant7: '7',
  major7: 'maj7',
  minor7: '7',
  'half-diminished7': 'ø7',
  diminished7: '°7',
  'minor-major7': 'Maj7',
  'augmented-major7': 'maj7',
}

const ACC: Record<Accidental, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }

// ---------- building chords ----------

/**
 * The diatonic chord on a scale degree (1..7), built by stacking thirds from the key's scale.
 * `octave` is the octave of the key's tonic; inversions move the lowest tones up an octave.
 */
export function diatonicChord(
  key: KeySignature,
  degree: number,
  size: ChordSize = 'triad',
  opts: ChordOptions = {},
): Chord {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7)
    throw new RangeError(`degree must be 1..7: ${degree}`)
  const octave = opts.octave ?? 4
  const form = opts.form ?? 'natural'
  const count = size === 'triad' ? 3 : 4
  const inversion = opts.inversion ?? 0
  if (!Number.isInteger(inversion) || inversion < 0 || inversion >= count) {
    throw new RangeError(`inversion must be 0..${count - 1} for a ${size}`)
  }

  const roles: ChordRole[] = ['root', 'third', 'fifth', 'seventh']
  const stacked = Array.from({ length: count }, (_, i) =>
    scalePitch(key, degree - 1 + 2 * i, octave, form),
  )

  const semis = stacked.slice(1).map((p) => p.midi - stacked[0].midi)
  const table = size === 'triad' ? TRIAD_QUALITIES : SEVENTH_QUALITIES
  const quality = table[semis.join(',')]
  if (!quality)
    throw new RangeError(`No standard chord quality for semitone structure ${semis.join(',')}`)

  // Inversion n: the n lowest tones each move up an octave.
  const tones: ChordTone[] = stacked.map((p, i) => ({
    role: roles[i],
    pitch:
      i < inversion ? pitch(p.spelling.letter, p.spelling.accidental, p.spelling.octave + 1) : p,
  }))
  tones.sort((a, b) => a.pitch.midi - b.pitch.midi)

  const root = stacked[0].spelling
  const rootName = `${root.letter}${ACC[root.accidental]}`
  const bass = tones[0].pitch.spelling
  const slash = inversion > 0 ? `/${bass.letter}${ACC[bass.accidental]}` : ''
  const numeral = ROMAN[degree - 1]
  const roman =
    (LOWERCASE.includes(quality) ? numeral.toLowerCase() : numeral) + ROMAN_SUFFIX[quality]

  return {
    degree,
    size,
    quality,
    inversion,
    tones,
    pitches: tones.map((t) => t.pitch),
    label: `${rootName}${QUALITY_SUFFIX[quality]}${slash}`,
    roman,
  }
}

/** All seven diatonic chords of a key, root position. */
export const diatonicChords = (
  key: KeySignature,
  size: ChordSize = 'triad',
  opts: Omit<ChordOptions, 'inversion'> = {},
): Chord[] => [1, 2, 3, 4, 5, 6, 7].map((d) => diatonicChord(key, d, size, opts))

// ---------- partial chords (design §4.2) ----------

/** A subset is valid if it never drops both the root and the third (the chord keeps its identity). */
const isValidSubset = (roles: ChordRole[]): boolean =>
  roles.includes('root') || roles.includes('third')

/** Order in which tones are dropped to make a smaller chord: 5th, then 7th, then the 3rd; the root is kept longest. */
const DROP_ORDER: ChordRole[] = ['fifth', 'seventh', 'third', 'root']

/** Every valid way to keep `count` tones of the chord (pitches stay in chord order). */
export function validSubsets(chord: Chord, count: number): ChordTone[][] {
  const n = chord.tones.length
  if (!Number.isInteger(count) || count < 1 || count > n)
    throw new RangeError(`count must be 1..${n}`)
  const out: ChordTone[][] = []
  for (let mask = 1; mask < 1 << n; mask++) {
    const picked = chord.tones.filter((_, i) => mask & (1 << i))
    if (picked.length === count && isValidSubset(picked.map((t) => t.role))) out.push(picked)
  }
  return out
}

/** The preferred subset of `count` tones: drop the 5th first, then the 7th, then the 3rd, keeping the root longest. */
export function preferredSubset(chord: Chord, count: number): ChordTone[] {
  if (!Number.isInteger(count) || count < 1 || count > chord.tones.length) {
    throw new RangeError(`count must be 1..${chord.tones.length}`)
  }
  const keep = [...chord.tones]
  for (const role of DROP_ORDER) {
    while (keep.length > count) {
      const i = keep.findIndex((t) => t.role === role)
      if (i < 0) break
      const without = keep.filter((_, j) => j !== i)
      if (!isValidSubset(without.map((t) => t.role))) break
      keep.splice(i, 1)
    }
  }
  return keep
}

/** Compact text for tests and debugging: "E4 G4 C5". */
export const describePitches = (ps: Pitch[]): string =>
  sortPitches(ps).map(formatPitchAscii).join(' ')
