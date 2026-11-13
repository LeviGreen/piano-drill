import type { KeyIdQuestion } from './questions'
import { keySignature } from '../theory/keys'
import { pitch } from '../theory/pitch'

/**
 * Answering a key-ID question by playing (PD-314): instead of one tonic note, the player plays the key's scale, up one
 * octave and back down, with the hand that reads the clef shown (treble: right hand, bass: left hand). A hand cannot be
 * told from a MIDI message, so the hand is enforced by register: the scale is played in one fixed octave on the
 * clef's side of middle C.
 */

/** Seconds added to a question's time limit when it is answered by playing the scale (15 more notes than one tap, since the scale is 16). */
export const SCALE_GRACE_SECONDS = 8

/** Semitones above the tonic, going up to the octave. Minor is natural minor, so it follows the key signature. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12]

/** Middle C: treble scales start at or above it, bass scales end at or below it. */
const MIDDLE_C = 60

/**
 * The notes to play, in order, as MIDI numbers: the tonic up to the octave, then back down to the tonic (16 notes; the
 * top note is struck twice). Treble clef: the lowest octave that starts at or above middle C. Bass clef: the highest octave that
 * ends at or below middle C.
 */
export function scaleNotes(q: KeyIdQuestion): number[] {
  const key = keySignature(q.answer.accidentals, q.answer.mode)
  const pc = pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12
  let tonic: number
  if (q.clef === 'treble') {
    tonic = MIDDLE_C + pc
  } else {
    tonic = MIDDLE_C - 24 + pc // C2 and up
    while (tonic + 24 <= MIDDLE_C) tonic += 12
  }
  const up = (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => tonic + s)
  return [...up, ...[...up].reverse()]
}

/** The hand that plays a question's scale. */
export const handFor = (q: KeyIdQuestion): 'left' | 'right' =>
  q.clef === 'bass' ? 'left' : 'right'
