import { describe, expect, it } from 'vitest'
import {
  enharmonicSpellings,
  formatPitch,
  formatPitchAscii,
  interval,
  intervalBetween,
  intervalName,
  isEnharmonic,
  parsePitch,
  pitch,
  pitchClass,
  pitchClassSet,
  pitchFromMidi,
  samePitchClassSet,
  sortPitches,
  transpose,
} from './pitch'

const p = parsePitch
const asc = formatPitchAscii

describe('MIDI <-> spelling', () => {
  it('anchors: C4 = 60, A4 = 69, C-1 = 0', () => {
    expect(p('C4').midi).toBe(60)
    expect(p('A4').midi).toBe(69)
    expect(p('C-1').midi).toBe(0)
  })

  it('octave changes at C: B#3 = 60, Cb4 = 59', () => {
    expect(p('B#3').midi).toBe(60)
    expect(p('Cb4').midi).toBe(59)
  })

  it('round-trips every MIDI number 0..127 in both spelling styles', () => {
    for (let m = 0; m <= 127; m++) {
      for (const prefer of ['sharp', 'flat'] as const) {
        const x = pitchFromMidi(m, prefer)
        expect(x.midi).toBe(m)
        expect(pitch(x.spelling.letter, x.spelling.accidental, x.spelling.octave)).toEqual(x)
      }
    }
  })

  it('uses sharps or flats for black keys on request', () => {
    expect(asc(pitchFromMidi(61))).toBe('C#4')
    expect(asc(pitchFromMidi(61, 'flat'))).toBe('Db4')
    expect(asc(pitchFromMidi(70, 'flat'))).toBe('Bb4')
  })

  it('handles double sharps and flats', () => {
    expect(p('F##4').midi).toBe(67)
    expect(p('Dbb5').midi).toBe(72)
    expect(asc(p('F##4'))).toBe('F##4')
    expect(asc(p('Dbb5'))).toBe('Dbb5')
  })

  it('round-trips text for every letter/accidental/octave combination', () => {
    for (const letter of 'CDEFGAB') {
      for (const acc of ['bb', 'b', '', '#', '##']) {
        for (const oct of [-1, 0, 4, 9]) {
          const text = `${letter}${acc}${oct}`
          expect(asc(p(text))).toBe(text)
          expect(asc(p(formatPitch(p(text))))).toBe(text)
        }
      }
    }
  })

  it('rejects bad input', () => {
    expect(() => p('H4')).toThrow(SyntaxError)
    expect(() => p('C###4')).toThrow(SyntaxError)
    expect(() => pitchFromMidi(60.5)).toThrow(RangeError)
  })
})

describe('enharmonics and comparison', () => {
  it('knows F#4 and Gb4 sound the same but are different spellings', () => {
    expect(isEnharmonic(p('F#4'), p('Gb4'))).toBe(true)
    expect(p('F#4').spelling).not.toEqual(p('Gb4').spelling)
  })

  it('lists enharmonic spellings of middle C', () => {
    expect(enharmonicSpellings(p('C4')).map(asc)).toEqual(['B#3', 'C4', 'Dbb4'])
  })

  it('lists enharmonic spellings of C#4', () => {
    expect(enharmonicSpellings(p('C#4')).map(asc)).toEqual(['B##3', 'C#4', 'Db4'])
  })

  it('sorts by sounding pitch, then written position', () => {
    expect(sortPitches(['G4', 'C4', 'Gb4', 'F#4', 'B3'].map(p)).map(asc)).toEqual([
      'B3',
      'C4',
      'F#4',
      'Gb4',
      'G4',
    ])
  })

  it('does not mutate its input when sorting', () => {
    const input = [p('G4'), p('C4')]
    sortPitches(input)
    expect(input.map(asc)).toEqual(['G4', 'C4'])
  })
})

describe('pitch-class sets', () => {
  it('collapses octaves and enharmonics into a sorted set', () => {
    expect(pitchClassSet(['C4', 'E4', 'G4', 'C5', 'B#3'].map(p))).toEqual([0, 4, 7])
    expect(pitchClass(p('Cb4'))).toBe(11)
    expect(pitchClass(-1)).toBe(11)
  })

  it('compares sets regardless of order, octave and spelling', () => {
    expect(samePitchClassSet(['C4', 'E4', 'G4'].map(p), ['G3', 'C5', 'Fb5'].map(p))).toBe(true)
    expect(samePitchClassSet(['C4', 'E4'].map(p), ['C4', 'E4', 'G4'].map(p))).toBe(false)
  })
})

describe('intervals', () => {
  it('builds intervals by quality and size', () => {
    expect(interval('M', 3)).toEqual({ steps: 2, semitones: 4 })
    expect(interval('P', 5)).toEqual({ steps: 4, semitones: 7 })
    expect(interval('A', 4)).toEqual({ steps: 3, semitones: 6 })
    expect(interval('d', 5)).toEqual({ steps: 4, semitones: 6 })
    expect(interval('P', 8)).toEqual({ steps: 7, semitones: 12 })
    expect(interval('M', 10)).toEqual({ steps: 9, semitones: 16 })
  })

  it('rejects invalid quality/size pairs', () => {
    expect(() => interval('M', 5)).toThrow(RangeError)
    expect(() => interval('P', 3)).toThrow(RangeError)
    expect(() => interval('M', 0)).toThrow(RangeError)
  })

  it('names intervals, including round trips with interval()', () => {
    expect(intervalName({ steps: 2, semitones: 3 })).toBe('m3')
    for (const q of ['dd', 'd', 'm', 'M', 'A', 'AA'] as const) {
      for (const n of [2, 3, 6, 7, 9, 10]) expect(intervalName(interval(q, n))).toBe(`${q}${n}`)
    }
    for (const q of ['dd', 'd', 'P', 'A', 'AA'] as const) {
      for (const n of [1, 4, 5, 8, 11, 12]) expect(intervalName(interval(q, n))).toBe(`${q}${n}`)
    }
  })

  it('measures the interval between two pitches', () => {
    expect(intervalName(intervalBetween(p('C4'), p('E4')))).toBe('M3')
    expect(intervalName(intervalBetween(p('C4'), p('Eb4')))).toBe('m3')
    expect(intervalName(intervalBetween(p('C4'), p('F#4')))).toBe('A4')
    expect(intervalName(intervalBetween(p('C4'), p('Gb4')))).toBe('d5')
    expect(intervalName(intervalBetween(p('B3'), p('C4')))).toBe('m2')
    expect(intervalName(intervalBetween(p('C4'), p('C5')))).toBe('P8')
    expect(() => intervalBetween(p('E4'), p('C4'))).toThrow(RangeError)
  })

  it('keeps spelling correct when transposing up', () => {
    expect(asc(transpose(p('C4'), interval('M', 3)))).toBe('E4')
    expect(asc(transpose(p('E4'), interval('m', 3)))).toBe('G4')
    expect(asc(transpose(p('F#4'), interval('P', 5)))).toBe('C#5')
    expect(asc(transpose(p('C#4'), interval('M', 3)))).toBe('E#4')
    expect(asc(transpose(p('C4'), interval('A', 4)))).toBe('F#4')
    expect(asc(transpose(p('C4'), interval('d', 5)))).toBe('Gb4')
    expect(asc(transpose(p('B3'), interval('m', 2)))).toBe('C4')
    expect(asc(transpose(p('Bb3'), interval('M', 3)))).toBe('D4')
    expect(asc(transpose(p('C4'), interval('M', 10)))).toBe('E5')
    expect(asc(transpose(p('Gb3'), interval('P', 8)))).toBe('Gb4')
  })

  it('transposes down and is the inverse of transposing up', () => {
    expect(asc(transpose(p('C4'), interval('m', 3), 'down'))).toBe('A3')
    expect(asc(transpose(p('C4'), interval('P', 5), 'down'))).toBe('F3')
    expect(asc(transpose(p('E4'), interval('M', 3), 'down'))).toBe('C4')
    const start = p('Eb4')
    for (const iv of [interval('M', 2), interval('P', 4), interval('m', 6), interval('M', 9)]) {
      expect(transpose(transpose(start, iv, 'up'), iv, 'down')).toEqual(start)
    }
  })

  it('produces double accidentals when the spelling needs them', () => {
    expect(asc(transpose(p('F#4'), interval('A', 4)))).toBe('B#4')
    expect(asc(transpose(p('F##4'), interval('M', 2)))).toBe('G##4')
    expect(asc(transpose(p('Dbb4'), interval('m', 2), 'down'))).toBe('Cb4')
  })

  it('throws instead of returning a triple accidental', () => {
    expect(() => transpose(p('G##4'), interval('A', 3))).toThrow(RangeError)
  })
})
