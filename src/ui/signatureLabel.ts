import { keyName, keySignature } from '../theory/keys'

/** A key signature by the keys it belongs to: "E♭ major / C minor (3 flats)". `n` is sharps (+) or flats (-). */
export const signatureLabel = (n: number): string => {
  const names = `${keyName(keySignature(n, 'major'))} / ${keyName(keySignature(n, 'minor'))}`
  const count =
    n === 0
      ? 'no sharps or flats'
      : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}`
  return `${names} (${count})`
}

/** Every key signature, flats to sharps. */
export const SIGNATURES = Array.from({ length: 15 }, (_, i) => i - 7)
