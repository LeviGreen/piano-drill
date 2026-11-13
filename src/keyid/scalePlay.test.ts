import { describe, expect, it } from 'vitest'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { correctAnswer, type KeyIdQuestion } from './questions'
import { handFor, scaleNotes, startsScale } from './scalePlay'

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

  it('the shown scale is the tonic nearest middle C on the clef side: the right hand for treble, the left for bass', () => {
    expect(handFor(ask(0, 'major', 'treble'))).toBe('right')
    expect(handFor(ask(0, 'major', 'bass'))).toBe('left')
    expect(scaleNotes(ask(0, 'major', 'bass'))[0]).toBe(parsePitch('C3').midi)
    for (let a = -7; a <= 7; a++)
      for (const mode of ['major', 'minor'] as const) {
        const treble = scaleNotes(ask(a, mode, 'treble'))
        expect(treble[0], `${a} ${mode}`).toBeGreaterThanOrEqual(60)
        expect(treble[0]).toBeLessThan(72)
        const bass = scaleNotes(ask(a, mode, 'bass'))
        expect(bass[0]).toBeLessThan(60)
        expect(bass[0]).toBeGreaterThanOrEqual(48)
      }
  })

  it('a scale can start on its tonic in any octave on the clef side of middle C', () => {
    const treble = ask(0, 'major', 'treble') // C major
    for (const c of ['C4', 'C5', 'C6']) expect(startsScale(treble, parsePitch(c).midi)).toBe(true)
    expect(startsScale(treble, parsePitch('C3').midi)).toBe(false)
    expect(startsScale(treble, parsePitch('D4').midi)).toBe(false)
    const bass = ask(0, 'major', 'bass')
    for (const c of ['C2', 'C3']) expect(startsScale(bass, parsePitch(c).midi)).toBe(true)
    expect(startsScale(bass, parsePitch('C4').midi)).toBe(false) // middle C is not below C4
    expect(startsScale(bass, parsePitch('C5').midi)).toBe(false)
    const b = ask(0, 'major', 'bass')
    expect(scaleNotes(b, parsePitch('C2').midi)[7]).toBe(parsePitch('C3').midi)
    // B in the bass: B3 is below middle C, so it can start; the scale goes up past it
    expect(startsScale(ask(5, 'major', 'bass'), parsePitch('B3').midi)).toBe(true)
  })

  it('F♯ and G♭ major are the same notes when played', () => {
    expect(scaleNotes(ask(6, 'major', 'treble'))).toEqual(scaleNotes(ask(-6, 'major', 'treble')))
  })
})
