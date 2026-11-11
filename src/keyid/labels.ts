import { keyName, keySignature } from '../theory/keys'
import type { KeyIdAnswer, KeyIdFormat } from './questions'

/** "No sharps or flats", "1 sharp", "3 flats". */
export function signatureLabel(accidentals: number): string {
  if (accidentals === 0) return 'No sharps or flats'
  const n = Math.abs(accidentals)
  return `${n} ${accidentals > 0 ? 'sharp' : 'flat'}${n > 1 ? 's' : ''}`
}

/** How an answer reads in a given format: "3 flats", "E♭ major", "A minor", "E♭ major / C minor". */
export function answerLabel(answer: KeyIdAnswer, format: KeyIdFormat): string {
  switch (format) {
    case 'signature':
      return signatureLabel(answer.accidentals)
    case 'major':
      return keyName(keySignature(answer.accidentals, 'major'))
    case 'key':
      return keyName(keySignature(answer.accidentals, answer.mode ?? 'major'))
    case 'pair':
      return `${keyName(keySignature(answer.accidentals, 'major'))} / ${keyName(keySignature(answer.accidentals, 'minor'))}`
  }
}
