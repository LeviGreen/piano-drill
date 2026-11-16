import { describe, expect, it } from 'vitest'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { Checklist, handFor, onClefSide, scaleToShow } from './checklist'
import { correctAnswer, type KeyIdQuestion } from './questions'

function ask(accidentals: number, mode: 'major' | 'minor', clef: 'treble' | 'bass'): KeyIdQuestion {
  const key = keySignature(accidentals, mode)
  return {
    id: 'x',
    key,
    clef,
    accidentals,
    format: 'key',
    hint: null,
    prompt: '',
    answer: correctAnswer('key', key),
  }
}
const midis = (...names: string[]) => names.map((n) => parsePitch(n).midi)

describe('the checklist rows', () => {
  it('a minor key has the minor tonic chord', () => {
    const c = new Checklist(ask(-3, 'minor', 'treble')) // C minor
    c.hold(midis('C4', 'Eb4', 'G4'))
    expect(c.rows().find((r) => r.id === 'root')?.done).toBe(true)
    const major = new Checklist(ask(-3, 'minor', 'treble'))
    major.hold(midis('C4', 'E4', 'G4')) // a major chord is not it
    expect(major.rows().find((r) => r.id === 'root')?.done).toBe(false)
  })

  it('a minor key is played as natural minor', () => {
    const c = new Checklist(ask(-3, 'minor', 'treble'))
    for (const m of midis('C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5')) c.strike(m, [])
    expect(c.rows().find((r) => r.id === 'up')?.done).toBe(true)
  })
})

describe('the clef sides', () => {
  it('treble is at or above middle C and bass is below it', () => {
    expect(onClefSide({ clef: 'treble' }, 60)).toBe(true)
    expect(onClefSide({ clef: 'treble' }, 59)).toBe(false)
    expect(onClefSide({ clef: 'bass' }, 59)).toBe(true)
    expect(onClefSide({ clef: 'bass' }, 60)).toBe(false)
    expect(handFor(ask(0, 'major', 'treble'))).toBe('right')
    expect(handFor(ask(0, 'major', 'bass'))).toBe('left')
  })

  it('the scale shown before you start is the tonic nearest middle C on the clef side', () => {
    expect(scaleToShow(ask(0, 'major', 'treble'))).toEqual(
      midis('C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'),
    )
    for (let a = -7; a <= 7; a++)
      for (const mode of ['major', 'minor'] as const) {
        expect(scaleToShow(ask(a, mode, 'treble'))[0]).toBeGreaterThanOrEqual(60)
        expect(scaleToShow(ask(a, mode, 'treble'))[0]).toBeLessThan(72)
        expect(scaleToShow(ask(a, mode, 'bass'))[0]).toBeLessThan(60)
        expect(scaleToShow(ask(a, mode, 'bass'))[0]).toBeGreaterThanOrEqual(48)
      }
  })

  it('F♯ and G♭ major are the same notes when played', () => {
    expect(scaleToShow(ask(6, 'major', 'treble'))).toEqual(scaleToShow(ask(-6, 'major', 'treble')))
  })
})
