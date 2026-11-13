import type { KeyIdQuestion } from './questions'
import { keySignature } from '../theory/keys'
import { pitch } from '../theory/pitch'

/**
 * Answering a key-ID question by playing (PD-314): instead of one tonic note, the player plays the key's scale, up one
 * octave and back down, with the hand that reads the clef shown (treble: right hand, bass: left hand). A hand cannot be
 * told from a MIDI message, so the hand is enforced by register: the scale starts on the tonic in any octave on the
 * clef's side of middle C (treble: C4 or above; bass: below C4).
 */

/** Seconds added to a question's time limit when it is answered by playing the scale (15 more notes than one tap, since the scale is 16). */
export const SCALE_GRACE_SECONDS = 8

/** Semitones above the tonic, going up to the octave. Minor is natural minor, so it follows the key signature. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12]

/** Middle C: a treble scale starts at or above it, a bass scale starts below it. */
const MIDDLE_C = 60

const tonicPitchClass = (q: KeyIdQuestion): number => {
  const key = keySignature(q.answer.accidentals, q.answer.mode)
  return pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12
}

/**
 * Can this note start the question's scale? It must be the key's tonic, in any octave on the clef's side of middle C:
 * treble, middle C or higher; bass, lower than middle C. The first note struck fixes the octave of the whole scale.
 */
export function startsScale(q: KeyIdQuestion, midi: number): boolean {
  if (midi % 12 !== tonicPitchClass(q)) return false
  return q.clef === 'treble' ? midi >= MIDDLE_C : midi < MIDDLE_C
}

/** The tonic nearest middle C on the clef's side: where the scale is shown to start before the player has struck a note. */
function defaultTonic(q: KeyIdQuestion): number {
  const pc = tonicPitchClass(q)
  if (q.clef === 'treble') return MIDDLE_C + pc
  return MIDDLE_C - 12 + pc
}

/**
 * The notes to play, in order, as MIDI numbers: the tonic up to the octave, then back down to the tonic (16 notes; the
 * top note is struck twice). `tonic` is the note the player started on (see `startsScale`); without it, the tonic
 * nearest middle C on the clef's side.
 */
export function scaleNotes(q: KeyIdQuestion, tonic: number = defaultTonic(q)): number[] {
  const key = keySignature(q.answer.accidentals, q.answer.mode)
  const up = (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => tonic + s)
  return [...up, ...[...up].reverse()]
}

/** The hand that plays a question's scale. */
export const handFor = (q: KeyIdQuestion): 'left' | 'right' =>
  q.clef === 'bass' ? 'left' : 'right'
