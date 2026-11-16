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
  it('has the sharps in the order they are written, then flats in theirs', () => {
    const sharps = new Checklist(ask(2, 'major', 'treble')) // D major: F♯ C♯
    for (const m of midis('F#4', 'C#5')) sharps.strike(m, [])
    expect(sharps.rows().find((r) => r.id === 'accidentals')).toMatchObject({
      done: true,
      total: 2,
    })
    const wrongOrder = new Checklist(ask(2, 'major', 'treble'))
    for (const m of midis('C#4', 'F#4')) wrongOrder.strike(m, [])
    expect(wrongOrder.rows().find((r) => r.id === 'accidentals')?.done).toBe(false)
    const flats = new Checklist(ask(-2, 'major', 'treble')) // B♭ major: B♭ E♭
    for (const m of midis('Bb4', 'Eb4')) flats.strike(m, [])
    expect(flats.rows().find((r) => r.id === 'accidentals')?.done).toBe(true)
  })

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
