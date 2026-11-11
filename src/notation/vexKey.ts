import type { KeySignature } from '../theory/keys'
import type { Accidental, Pitch } from '../theory/pitch'

const SPEC_ACCIDENTAL: Record<Accidental, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
}

/** VexFlow key-signature spec for a key: "F#", "Bb", "C#m", "Abm". */
export function vexKeySpec(key: KeySignature): string {
  const { letter, accidental } = key.tonic
  return `${letter}${SPEC_ACCIDENTAL[accidental]}${key.mode === 'minor' ? 'm' : ''}`
}

/** VexFlow note key for a pitch: "c/4", "f#/4", "bb/3". */
export function vexNoteKey(p: Pitch): string {
  const { letter, accidental, octave } = p.spelling
  return `${letter.toLowerCase()}${SPEC_ACCIDENTAL[accidental]}/${octave}`
}
