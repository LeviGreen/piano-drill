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

describe('the turning notes of the scales', () => {
  const upNotes = (q: KeyIdQuestion) => scaleToShow(q)
  const downNotes = (q: KeyIdQuestion) => [...scaleToShow(q)].reverse()
  const done = (c: Checklist, id: string) => c.rows().find((r) => r.id === id)?.done
  /** Plays notes one at a time; `legato` keeps the previous key held while the next goes down. */
  const play = (c: Checklist, notes: number[], legato: boolean) =>
    notes.forEach((m, i) => c.strike(m, legato && i > 0 ? [notes[i - 1]] : []))

  for (const clef of ['treble', 'bass'] as const)
    for (const mode of ['major', 'minor'] as const)
      for (const legato of [false, true]) {
        const name = `${clef}, ${mode}, ${legato ? 'smooth' : 'detached'}`

        it(`up then down: the top note struck once ticks both rows (${name})`, () => {
          const q = ask(mode === 'major' ? 2 : -1, mode, clef)
          const c = new Checklist(q)
          play(c, upNotes(q), legato)
          expect(done(c, 'up')).toBe(true)
          play(c, downNotes(q).slice(1), legato)
          expect(done(c, 'down')).toBe(true)
        })

        it(`up then down: the top note struck twice also ticks both rows (${name})`, () => {
          const q = ask(mode === 'major' ? 2 : -1, mode, clef)
          const c = new Checklist(q)
          play(c, upNotes(q), legato)
          play(c, downNotes(q), legato)
          expect(done(c, 'up')).toBe(true)
          expect(done(c, 'down')).toBe(true)
        })

        it(`down then up: the bottom note struck once, or twice, ticks both rows (${name})`, () => {
          const q = ask(mode === 'major' ? 2 : -1, mode, clef)
          const once = new Checklist(q)
          play(once, downNotes(q), legato)
          play(once, upNotes(q).slice(1), legato)
          expect(done(once, 'down')).toBe(true)
          expect(done(once, 'up')).toBe(true)
          const twice = new Checklist(q)
          play(twice, downNotes(q), legato)
          play(twice, upNotes(q), legato)
          expect(done(twice, 'down')).toBe(true)
          expect(done(twice, 'up')).toBe(true)
        })
      }

  it('a wrong note still resets only the row in progress', () => {
    const q = ask(0, 'major', 'treble')
    const c = new Checklist(q)
    play(c, upNotes(q), false) // up done, down started by the top note
    c.strike(midis('D4')[0], []) // not the next note down (B4)
    expect(c.rows().find((r) => r.id === 'up')?.done).toBe(true)
    expect(c.rows().find((r) => r.id === 'down')?.progress).toBe(0)
  })
})
