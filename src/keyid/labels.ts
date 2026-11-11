import { keyName, keySignature } from '../theory/keys'
import type { KeyIdAnswer } from './questions'

/** "E♭ major", "A minor". */
export const answerLabel = (answer: KeyIdAnswer): string =>
  keyName(keySignature(answer.accidentals, answer.mode))

/** The short name used on buttons: "E♭" for a major key, "Cm" for a minor key. */
export function shortLabel(answer: KeyIdAnswer): string {
  const t = keySignature(answer.accidentals, answer.mode).tonic
  return `${t.letter}${['𝄫', '♭', '', '♯', '𝄪'][t.accidental + 2]}${answer.mode === 'minor' ? 'm' : ''}`
}
