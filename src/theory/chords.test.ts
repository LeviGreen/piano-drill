import { describe, expect, it } from 'vitest'
import {
  describePitches as d,
  diatonicChord,
  diatonicChords,
  diatonicInterval,
  preferredSubset,
  scalePitch,
  validSubsets,
} from './chords'
import { findKey, keySignature } from './keys'
import { formatPitchAscii } from './pitch'

const major = (n: number) => keySignature(n, 'major')
const minor = (n: number) => keySignature(n, 'minor')
const labels = (cs: { label: string }[]) => cs.map((c) => c.label)
const romans = (cs: { roman: string }[]) => cs.map((c) => c.roman)

describe('scale-degree helper', () => {
  it('continues into higher and lower octaves', () => {
    const c = major(0)
    expect(formatPitchAscii(scalePitch(c, 0))).toBe('C4')
    expect(formatPitchAscii(scalePitch(c, 7))).toBe('C5')
    expect(formatPitchAscii(scalePitch(c, 9))).toBe('E5')
    expect(formatPitchAscii(scalePitch(c, -1))).toBe('B3')
    expect(formatPitchAscii(scalePitch(c, -7))).toBe('C3')
  })

  it('uses the raised 7th in harmonic minor only when asked', () => {
    const a = minor(0)
    expect(formatPitchAscii(scalePitch(a, 6))).toBe('G5')
    expect(formatPitchAscii(scalePitch(a, 6, 4, 'harmonic'))).toBe('G#5')
  })
})

describe('diatonic triads', () => {
  it('C major: C Dm Em F G Am B°', () => {
    const cs = diatonicChords(major(0))
    expect(labels(cs)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'])
    expect(romans(cs)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
    expect(cs.map((c) => d(c.pitches))).toEqual([
      'C4 E4 G4',
      'D4 F4 A4',
      'E4 G4 B4',
      'F4 A4 C5',
      'G4 B4 D5',
      'A4 C5 E5',
      'B4 D5 F5',
    ])
  })

  it('G major (1 sharp): G Am Bm C D Em F♯°', () => {
    const cs = diatonicChords(major(1))
    expect(labels(cs)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°'])
    expect(d(cs[6].pitches)).toBe('F#5 A5 C6')
  })

  it('E♭ major (3 flats): E♭ Fm Gm A♭ B♭ Cm D°', () => {
    expect(labels(diatonicChords(major(-3)))).toEqual(['E♭', 'Fm', 'Gm', 'A♭', 'B♭', 'Cm', 'D°'])
  })

  it('F♯ major (6 sharps) spells the vii° with E♯ and the iii with A♯', () => {
    const cs = diatonicChords(major(6))
    expect(d(cs[6].pitches)).toBe('E#5 G#5 B5')
    expect(d(cs[2].pitches)).toBe('A#4 C#5 E#5')
  })

  it('G♭ major (6 flats) spells the IV as C♭ E♭ G♭', () => {
    expect(d(diatonicChord(major(-6), 4).pitches)).toBe('Cb5 Eb5 Gb5')
  })

  it('A natural minor: Am B° C Dm Em F G', () => {
    const cs = diatonicChords(minor(0))
    expect(labels(cs)).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'])
    expect(romans(cs)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
  })

  it('A harmonic minor: V is major, vii° diminished, III is augmented', () => {
    const cs = diatonicChords(minor(0), 'triad', { form: 'harmonic' })
    expect(labels(cs)).toEqual(['Am', 'B°', 'C+', 'Dm', 'E', 'F', 'G♯°'])
    expect(romans(cs)).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'])
    expect(d(cs[6].pitches)).toBe('G#5 B5 D6')
  })

  it('C♯ minor harmonic (4 sharps) needs a double sharp', () => {
    const cs = diatonicChords(minor(4), 'triad', { form: 'harmonic' })
    expect(d(cs[6].pitches)).toBe('B#4 D#5 F#5') // B# is the raised 7th
    expect(d(cs[4].pitches)).toBe('G#4 B#4 D#5') // V
  })

  it('G♯ minor harmonic (5 sharps) has the raised 7th F𝄪', () => {
    expect(d(diatonicChord(minor(5), 7, 'triad', { form: 'harmonic' }).pitches)).toBe(
      'F##5 A#5 C#6',
    )
  })
})

describe('diatonic seventh chords', () => {
  it('C major: Cmaj7 Dm7 Em7 Fmaj7 G7 Am7 Bø7', () => {
    const cs = diatonicChords(major(0), 'seventh')
    expect(labels(cs)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7'])
    expect(romans(cs)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'])
    expect(d(cs[4].pitches)).toBe('G4 B4 D5 F5')
  })

  it('B♭ major: B♭maj7 Cm7 Dm7 E♭maj7 F7 Gm7 Aø7', () => {
    expect(labels(diatonicChords(major(-2), 'seventh'))).toEqual([
      'B♭maj7',
      'Cm7',
      'Dm7',
      'E♭maj7',
      'F7',
      'Gm7',
      'Aø7',
    ])
  })

  it('A harmonic minor sevenths include mMaj7, +maj7, V7 and a fully diminished vii°7', () => {
    const cs = diatonicChords(minor(0), 'seventh', { form: 'harmonic' })
    expect(labels(cs)).toEqual(['AmMaj7', 'Bø7', 'C+maj7', 'Dm7', 'E7', 'Fmaj7', 'G♯°7'])
    expect(cs.map((c) => c.quality)).toEqual([
      'minor-major7',
      'half-diminished7',
      'augmented-major7',
      'minor7',
      'dominant7',
      'major7',
      'diminished7',
    ])
  })

  it('F♯ major (6 sharps) seventh chords are spelled correctly', () => {
    const cs = diatonicChords(major(6), 'seventh')
    expect(d(cs[4].pitches)).toBe('C#5 E#5 G#5 B5')
    expect(d(cs[6].pitches)).toBe('E#5 G#5 B5 D#6')
  })
})

describe('inversions', () => {
  it('moves the lowest tones up an octave and labels the bass', () => {
    const c = major(0)
    const first = diatonicChord(c, 1, 'triad', { inversion: 1 })
    expect(d(first.pitches)).toBe('E4 G4 C5')
    expect(first.label).toBe('C/E')
    const second = diatonicChord(c, 1, 'triad', { inversion: 2 })
    expect(d(second.pitches)).toBe('G4 C5 E5')
    expect(second.label).toBe('C/G')
  })

  it('handles seventh-chord inversions including the third inversion', () => {
    const g7 = (inv: number) => diatonicChord(major(0), 5, 'seventh', { inversion: inv })
    expect(d(g7(1).pitches)).toBe('B4 D5 F5 G5')
    expect(d(g7(2).pitches)).toBe('D5 F5 G5 B5')
    expect(d(g7(3).pitches)).toBe('F5 G5 B5 D6')
    expect(g7(3).label).toBe('G7/F')
  })

  it('keeps the chord-tone roles attached to the right pitches after inversion', () => {
    const t = diatonicChord(major(0), 1, 'triad', { inversion: 1 }).tones
    expect(t.map((x) => x.role)).toEqual(['third', 'fifth', 'root'])
  })

  it('pitches are always ascending, in every key and degree and inversion', () => {
    for (let n = -7; n <= 7; n++) {
      for (const mode of ['major', 'minor'] as const) {
        const key = keySignature(n, mode)
        for (const form of ['natural', 'harmonic'] as const) {
          for (let deg = 1; deg <= 7; deg++) {
            for (const size of ['triad', 'seventh'] as const) {
              for (let inv = 0; inv < (size === 'triad' ? 3 : 4); inv++) {
                const ps = diatonicChord(key, deg, size, { inversion: inv, form }).pitches
                for (let i = 1; i < ps.length; i++)
                  expect(ps[i].midi).toBeGreaterThan(ps[i - 1].midi)
              }
            }
          }
        }
      }
    }
  })

  it('rejects bad input', () => {
    expect(() => diatonicChord(major(0), 0)).toThrow(RangeError)
    expect(() => diatonicChord(major(0), 8)).toThrow(RangeError)
    expect(() => diatonicChord(major(0), 1, 'triad', { inversion: 3 })).toThrow(RangeError)
    expect(() => diatonicChord(major(0), 1, 'seventh', { inversion: 4 })).toThrow(RangeError)
  })
})

describe('every key yields a standard quality for every degree', () => {
  it('builds all 30 keys x 7 degrees x triads and sevenths (natural and harmonic minor) without error', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (let n = -7; n <= 7; n++) {
        const key = keySignature(n, mode)
        for (const form of ['natural', 'harmonic'] as const) {
          for (const size of ['triad', 'seventh'] as const) {
            expect(() => diatonicChords(key, size, { form })).not.toThrow()
          }
        }
      }
    }
  })

  it('major-key triad qualities follow the pattern M m m M M m dim in every major key', () => {
    for (let n = -7; n <= 7; n++) {
      expect(diatonicChords(major(n)).map((c) => c.quality)).toEqual([
        'major',
        'minor',
        'minor',
        'major',
        'major',
        'minor',
        'diminished',
      ])
    }
  })

  it('a chord root is always the key note it was built on', () => {
    const key = findKey('D', 0, 'major')!
    expect(diatonicChords(key).map((c) => c.pitches[0].spelling.letter)).toEqual([
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
      'C',
    ])
  })
})

describe('diatonic intervals in a key', () => {
  it('spells 2nds to octaves by scale step with correct quality names', () => {
    const c = major(0)
    expect(diatonicInterval(c, 1, 3).name).toBe('M3')
    expect(diatonicInterval(c, 2, 3).name).toBe('m3')
    expect(diatonicInterval(c, 4, 4).name).toBe('A4') // F up to B
    expect(diatonicInterval(c, 7, 5).name).toBe('d5') // B up to F
    expect(diatonicInterval(c, 1, 8).name).toBe('P8')
    expect(diatonicInterval(c, 3, 9).name).toBe('m9')
  })

  it('uses the key signature: in D major the 3rd above F# is A', () => {
    const r = diatonicInterval(major(2), 3, 3)
    expect(formatPitchAscii(r.lower)).toBe('F#4')
    expect(formatPitchAscii(r.upper)).toBe('A4')
    expect(r.name).toBe('m3')
  })
})

describe('partial chords (keep the chord recognisable)', () => {
  const cMajor = diatonicChord(major(0), 1)
  const g7 = diatonicChord(major(0), 5, 'seventh')

  it('2 notes from a triad: drop the 5th', () => {
    expect(preferredSubset(cMajor, 2).map((t) => t.role)).toEqual(['root', 'third'])
  })

  it('3 notes from a seventh chord: drop the 5th (a shell voicing)', () => {
    expect(preferredSubset(g7, 3).map((t) => t.role)).toEqual(['root', 'third', 'seventh'])
  })

  it('2 notes from a seventh chord: drop the 5th and then the 7th', () => {
    expect(preferredSubset(g7, 2).map((t) => t.role)).toEqual(['root', 'third'])
  })

  it('1 note keeps the root', () => {
    expect(preferredSubset(cMajor, 1).map((t) => t.role)).toEqual(['root'])
  })

  it('returns the whole chord when count equals its size', () => {
    expect(preferredSubset(cMajor, 3)).toHaveLength(3)
  })

  it('works on inversions, keeping the pitches that belong to the kept roles', () => {
    const inv = diatonicChord(major(0), 1, 'triad', { inversion: 1 }) // E4 G4 C5
    expect(d(preferredSubset(inv, 2).map((t) => t.pitch))).toBe('E4 C5')
  })

  it('validSubsets never drops both the root and the third', () => {
    for (const chord of [cMajor, g7]) {
      for (let count = 1; count <= chord.tones.length; count++) {
        for (const subset of validSubsets(chord, count)) {
          const roles = subset.map((t) => t.role)
          expect(roles.includes('root') || roles.includes('third')).toBe(true)
        }
      }
    }
    // 2 notes from a triad: root+third, root+fifth, third+fifth are allowed; nothing else exists
    expect(validSubsets(cMajor, 2)).toHaveLength(3)
    // 1 note: only the root or the third
    expect(
      validSubsets(cMajor, 1)
        .map((s) => s[0].role)
        .sort(),
    ).toEqual(['root', 'third'])
  })

  it('rejects counts outside the chord size', () => {
    expect(() => preferredSubset(cMajor, 0)).toThrow(RangeError)
    expect(() => validSubsets(cMajor, 4)).toThrow(RangeError)
  })
})
