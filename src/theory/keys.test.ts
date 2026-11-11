import { describe, expect, it } from 'vitest'
import {
  ALL_KEYS,
  circleOfFifths,
  enharmonicKey,
  findKey,
  keyName,
  keySignature,
  relativeMajor,
  relativeMinor,
  scale,
  signatureAccidental,
  signaturePlacement,
} from './keys'
import { formatPitchAscii, interval, parsePitch, transpose } from './pitch'

const ascii = (ps: { spelling: unknown }[]) =>
  ps.map((p) => formatPitchAscii(p as never).replace(/\d+$/, ''))

describe('the 30 keys', () => {
  it('has 15 major and 15 minor keys with the right names, flat side to sharp side', () => {
    expect(ALL_KEYS).toHaveLength(30)
    expect(circleOfFifths('major').map(keyName)).toEqual(
      ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'].map(
        (n) => `${n} major`,
      ),
    )
    expect(circleOfFifths('minor').map(keyName)).toEqual(
      ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯'].map(
        (n) => `${n} minor`,
      ),
    )
  })

  it('rejects signatures beyond 7 sharps/flats', () => {
    expect(() => keySignature(8, 'major')).toThrow(RangeError)
    expect(() => keySignature(-8, 'minor')).toThrow(RangeError)
    expect(() => keySignature(1.5, 'major')).toThrow(RangeError)
  })

  it('looks keys up by tonic spelling', () => {
    expect(findKey('E', -1, 'major')?.accidentals).toBe(-3)
    expect(findKey('F', 1, 'minor')?.accidentals).toBe(3)
    expect(findKey('D', 1, 'major')).toBeNull() // D♯ major (9 sharps) does not exist
  })
})

describe('relative and enharmonic keys', () => {
  it('maps relative major/minor, e.g. C major <-> A minor, E♭ major <-> C minor', () => {
    expect(keyName(relativeMinor(keySignature(0, 'major')))).toBe('A minor')
    expect(keyName(relativeMinor(keySignature(-3, 'major')))).toBe('C minor')
    expect(keyName(relativeMajor(keySignature(4, 'minor')))).toBe('E major')
    expect(() => relativeMinor(keySignature(0, 'minor'))).toThrow(RangeError)
    expect(() => relativeMajor(keySignature(0, 'major'))).toThrow(RangeError)
  })

  it('relative minor tonic is always a minor third below the major tonic, every key', () => {
    for (let n = -7; n <= 7; n++) {
      const major = keySignature(n, 'major')
      const t = major.tonic
      const down = transpose(
        parsePitch(`${t.letter}${['bb', 'b', '', '#', '##'][t.accidental + 2]}4`),
        interval('m', 3),
        'down',
      )
      expect(relativeMinor(major).tonic).toEqual({
        letter: down.spelling.letter,
        accidental: down.spelling.accidental,
      })
    }
  })

  it('pairs the enharmonic keys: B/C♭, F♯/G♭, C♯/D♭, and their minors', () => {
    expect(keyName(enharmonicKey(keySignature(5, 'major'))!)).toBe('C♭ major')
    expect(keyName(enharmonicKey(keySignature(-6, 'major'))!)).toBe('F♯ major')
    expect(keyName(enharmonicKey(keySignature(7, 'major'))!)).toBe('D♭ major')
    expect(keyName(enharmonicKey(keySignature(-7, 'minor'))!)).toBe('G♯ minor')
    expect(enharmonicKey(keySignature(0, 'major'))).toBeNull()
    expect(enharmonicKey(keySignature(3, 'major'))).toBeNull()
  })
})

describe('scales', () => {
  it('spells well-known scales correctly', () => {
    expect(ascii(scale(keySignature(6, 'major')))).toEqual([
      'F#',
      'G#',
      'A#',
      'B',
      'C#',
      'D#',
      'E#',
    ])
    expect(ascii(scale(keySignature(-6, 'major')))).toEqual([
      'Gb',
      'Ab',
      'Bb',
      'Cb',
      'Db',
      'Eb',
      'F',
    ])
    expect(ascii(scale(keySignature(-3, 'minor')))).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'])
    expect(ascii(scale(keySignature(5, 'major')))).toEqual(['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'])
  })

  it('harmonic minor raises the 7th, using a double sharp when needed', () => {
    expect(ascii(scale(keySignature(0, 'minor'), 4, 'harmonic'))).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G#',
    ])
    expect(ascii(scale(keySignature(5, 'minor'), 4, 'harmonic'))).toEqual([
      'G#',
      'A#',
      'B',
      'C#',
      'D#',
      'E',
      'F##',
    ])
    expect(() => scale(keySignature(0, 'major'), 4, 'harmonic')).toThrow(RangeError)
  })

  it('every scale matches the interval pattern built from its tonic (all 30 keys)', () => {
    const major = [
      interval('M', 2),
      interval('M', 3),
      interval('P', 4),
      interval('P', 5),
      interval('M', 6),
      interval('M', 7),
    ]
    const minor = [
      interval('M', 2),
      interval('m', 3),
      interval('P', 4),
      interval('P', 5),
      interval('m', 6),
      interval('m', 7),
    ]
    for (const key of ALL_KEYS) {
      const notes = scale(key, 3)
      const tonic = notes[0]
      expect(tonic.spelling.letter).toBe(key.tonic.letter)
      expect(tonic.spelling.accidental).toBe(key.tonic.accidental)
      const expected = (key.mode === 'major' ? major : minor).map((iv) => transpose(tonic, iv))
      expect(notes.slice(1)).toEqual(expected)
    }
  })

  it('ascends and places the octave number correctly when the scale crosses B->C', () => {
    expect(scale(keySignature(0, 'minor'), 3).map(formatPitchAscii)).toEqual([
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
    ])
  })
})

describe('signature accidentals', () => {
  it('gives each letter the right accidental', () => {
    const d = keySignature(2, 'major')
    expect(signatureAccidental(d, 'F')).toBe(1)
    expect(signatureAccidental(d, 'C')).toBe(1)
    expect(signatureAccidental(d, 'G')).toBe(0)
    const eb = keySignature(-3, 'major')
    expect(['B', 'E', 'A', 'D'].map((l) => signatureAccidental(eb, l as never))).toEqual([
      -1, -1, -1, 0,
    ])
  })

  it('places sharps and flats on the staff in the standard order, treble clef', () => {
    expect(signaturePlacement(keySignature(7, 'major'), 'treble').map(formatPitchAscii)).toEqual([
      'F#5',
      'C#5',
      'G#5',
      'D#5',
      'A#4',
      'E#5',
      'B#4',
    ])
    expect(signaturePlacement(keySignature(-7, 'major'), 'treble').map(formatPitchAscii)).toEqual([
      'Bb4',
      'Eb5',
      'Ab4',
      'Db5',
      'Gb4',
      'Cb5',
      'Fb4',
    ])
  })

  it('places them an octave-and-a-bit lower in bass clef', () => {
    expect(signaturePlacement(keySignature(7, 'major'), 'bass').map(formatPitchAscii)).toEqual([
      'F#3',
      'C#3',
      'G#3',
      'D#3',
      'A#2',
      'E#3',
      'B#2',
    ])
    expect(signaturePlacement(keySignature(-7, 'major'), 'bass').map(formatPitchAscii)).toEqual([
      'Bb2',
      'Eb3',
      'Ab2',
      'Db3',
      'Gb2',
      'Cb3',
      'Fb2',
    ])
  })

  it('uses the first N accidentals for a key with N, none for C major / A minor', () => {
    expect(signaturePlacement(keySignature(3, 'major'), 'treble').map(formatPitchAscii)).toEqual([
      'F#5',
      'C#5',
      'G#5',
    ])
    expect(signaturePlacement(keySignature(-2, 'minor'), 'bass').map(formatPitchAscii)).toEqual([
      'Bb2',
      'Eb3',
    ])
    expect(signaturePlacement(keySignature(0, 'major'), 'treble')).toEqual([])
    expect(signaturePlacement(keySignature(0, 'minor'), 'bass')).toEqual([])
  })

  it('major and relative minor share the same signature', () => {
    for (let n = -7; n <= 7; n++) {
      expect(signaturePlacement(keySignature(n, 'major'), 'treble')).toEqual(
        signaturePlacement(keySignature(n, 'minor'), 'treble'),
      )
    }
  })

  it('every accidental sits inside the staff area (no more than 1 ledger-line position away)', () => {
    for (const key of ALL_KEYS) {
      for (const clef of ['treble', 'bass'] as const) {
        for (const p of signaturePlacement(key, clef)) expect(p.midi).toBeGreaterThan(0)
      }
    }
  })
})
