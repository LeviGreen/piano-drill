import { interval, LETTERS, parsePitch, pitch, transpose } from './pitch'
import type { Accidental, Letter, Pitch } from './pitch'
import type { Clef } from './staff'

export type Mode = 'major' | 'minor'
export type TonicSpelling = { letter: Letter; accidental: Accidental }
/** `accidentals`: -7..-1 flats, 0 none, 1..7 sharps (the position on the circle of fifths). */
export type KeySignature = { tonic: TonicSpelling; mode: Mode; accidentals: number }

const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Where each signature accidental is drawn, in order of appearance (standard engraving). */
const PLACEMENT: Record<Clef, { sharps: string[]; flats: string[] }> = {
  treble: {
    sharps: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'],
    flats: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'],
  },
  bass: {
    sharps: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'],
    flats: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'],
  },
}

// Major tonic for each position on the circle of fifths, built by stacking perfect fifths from C.
function majorTonic(fifths: number): TonicSpelling {
  let p = parsePitch('C4')
  for (let i = 0; i < Math.abs(fifths); i++)
    p = transpose(p, interval('P', 5), fifths > 0 ? 'up' : 'down')
  return { letter: p.spelling.letter, accidental: p.spelling.accidental }
}

function minorTonic(fifths: number): TonicSpelling {
  const m = majorTonic(fifths)
  const p = transpose(pitch(m.letter, m.accidental, 4), interval('m', 3), 'down')
  return { letter: p.spelling.letter, accidental: p.spelling.accidental }
}

function checkFifths(fifths: number): void {
  if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) {
    throw new RangeError(`accidentals must be an integer from -7 to 7: ${fifths}`)
  }
}

export function keySignature(fifths: number, mode: Mode): KeySignature {
  checkFifths(fifths)
  return {
    tonic: mode === 'major' ? majorTonic(fifths) : minorTonic(fifths),
    mode,
    accidentals: fifths,
  }
}

/** All 30 keys: majors from 7 flats to 7 sharps, then minors in the same order. */
export const ALL_KEYS: readonly KeySignature[] = (['major', 'minor'] as const).flatMap((mode) =>
  Array.from({ length: 15 }, (_, i) => keySignature(i - 7, mode)),
)

/** Keys of one mode ordered around the circle of fifths, from 7 flats to 7 sharps. */
export const circleOfFifths = (mode: Mode): KeySignature[] =>
  ALL_KEYS.filter((k) => k.mode === mode)

export function findKey(letter: Letter, accidental: Accidental, mode: Mode): KeySignature | null {
  return (
    ALL_KEYS.find(
      (k) => k.mode === mode && k.tonic.letter === letter && k.tonic.accidental === accidental,
    ) ?? null
  )
}

export const relativeMinor = (k: KeySignature): KeySignature => {
  if (k.mode !== 'major') throw new RangeError('relativeMinor needs a major key')
  return keySignature(k.accidentals, 'minor')
}

export const relativeMajor = (k: KeySignature): KeySignature => {
  if (k.mode !== 'minor') throw new RangeError('relativeMajor needs a minor key')
  return keySignature(k.accidentals, 'major')
}

/** The same-sounding key spelled with a different signature (B major <-> C♭ major), or null. */
export function enharmonicKey(k: KeySignature): KeySignature | null {
  for (const shift of [12, -12]) {
    const n = k.accidentals + shift
    if (n >= -7 && n <= 7) return keySignature(n, k.mode)
  }
  return null
}

const ACC_SYMBOL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }

/** "E♭ major", "F♯ minor". */
export function keyName(k: KeySignature): string {
  return `${k.tonic.letter}${ACC_SYMBOL[k.tonic.accidental]} ${k.mode}`
}

/** Accidental the signature gives to a letter (0 if none). */
export function signatureAccidental(k: KeySignature, letter: Letter): Accidental {
  if (k.accidentals > 0 && SHARP_ORDER.indexOf(letter) < k.accidentals) return 1
  if (k.accidentals < 0 && FLAT_ORDER.indexOf(letter) < -k.accidentals) return -1
  return 0
}

/**
 * Staff positions of the signature's accidentals for a clef, in order of appearance.
 * Each pitch carries the accidental ♯ or ♭ it represents.
 */
export function signaturePlacement(k: KeySignature, clef: Clef): Pitch[] {
  const sharp = k.accidentals > 0
  const table = sharp ? PLACEMENT[clef].sharps : PLACEMENT[clef].flats
  return table.slice(0, Math.abs(k.accidentals)).map((t) => {
    const p = parsePitch(t)
    return pitch(p.spelling.letter, sharp ? 1 : -1, p.spelling.octave)
  })
}

/**
 * Seven-note scale starting on the tonic in `tonicOctave`. Minor is natural minor unless
 * `variant` is 'harmonic' (raised 7th).
 */
export function scale(
  k: KeySignature,
  tonicOctave = 4,
  variant: 'natural' | 'harmonic' = 'natural',
): Pitch[] {
  if (variant === 'harmonic' && k.mode !== 'minor')
    throw new RangeError('harmonic variant is for minor keys')
  const start = LETTERS.indexOf(k.tonic.letter)
  return Array.from({ length: 7 }, (_, degree) => {
    const letter = LETTERS[(start + degree) % 7]
    const octave = tonicOctave + Math.floor((start + degree) / 7)
    let accidental: number = signatureAccidental(k, letter)
    if (variant === 'harmonic' && degree === 6) accidental += 1
    return pitch(letter, accidental as Accidental, octave)
  })
}
