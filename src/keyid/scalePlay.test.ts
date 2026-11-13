import { describe, expect, it } from 'vitest'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { correctAnswer, type KeyIdQuestion } from './questions'
import { handFor, scaleNotes } from './scalePlay'

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

describe('the scale to play', () => {
  it('goes up one octave and back down: 16 notes, the top note struck twice', () => {
    const notes = scaleNotes(ask(0, 'major', 'treble'))
    expect(notes).toEqual(
      midis(
        'C4',
        'D4',
        'E4',
        'F4',
        'G4',
        'A4',
        'B4',
        'C5',
        'C5',
        'B4',
        'A4',
        'G4',
        'F4',
        'E4',
        'D4',
        'C4',
      ),
    )
  })

  it('a minor key is its natural minor, as the key signature has it', () => {
    expect(scaleNotes(ask(-3, 'minor', 'treble'))).toEqual(
      midis(
        'C4',
        'D4',
        'Eb4',
        'F4',
        'G4',
        'Ab4',
        'Bb4',
        'C5',
        'C5',
        'Bb4',
        'Ab4',
        'G4',
        'F4',
        'Eb4',
        'D4',
        'C4',
      ),
    )
  })

  it('treble starts at or above middle C: the right hand', () => {
    expect(handFor(ask(0, 'major', 'treble'))).toBe('right')
    for (let a = -7; a <= 7; a++)
      for (const mode of ['major', 'minor'] as const) {
        const notes = scaleNotes(ask(a, mode, 'treble'))
        expect(Math.min(...notes), `${a} ${mode}`).toBeGreaterThanOrEqual(60)
        expect(Math.min(...notes)).toBeLessThan(72)
      }
  })

  it('bass ends at or below middle C: the left hand', () => {
    expect(handFor(ask(0, 'major', 'bass'))).toBe('left')
    expect(scaleNotes(ask(0, 'major', 'bass'))[0]).toBe(parsePitch('C3').midi)
    for (let a = -7; a <= 7; a++)
      for (const mode of ['major', 'minor'] as const) {
        const notes = scaleNotes(ask(a, mode, 'bass'))
        expect(Math.max(...notes), `${a} ${mode}`).toBeLessThanOrEqual(60)
        expect(Math.min(...notes)).toBeGreaterThanOrEqual(36) // C2: the piano's low end
        expect(Math.max(...notes)).toBeGreaterThan(47)
      }
  })

  it('every scale fits the on-screen piano, C2 to C6', () => {
    for (let a = -7; a <= 7; a++)
      for (const clef of ['treble', 'bass'] as const) {
        const notes = scaleNotes(ask(a, 'major', clef))
        expect(Math.min(...notes)).toBeGreaterThanOrEqual(36)
        expect(Math.max(...notes)).toBeLessThanOrEqual(84)
      }
  })

  it('F♯ and G♭ major are the same notes when played', () => {
    expect(scaleNotes(ask(6, 'major', 'treble'))).toEqual(scaleNotes(ask(-6, 'major', 'treble')))
  })
})
