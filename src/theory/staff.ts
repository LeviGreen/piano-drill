import { diatonicIndex, parsePitch, type Pitch } from './pitch'

export type Clef = 'treble' | 'bass'

/** Bottom staff line of each clef (treble: E4, bass: G2). Lines sit on even staff positions. */
const BOTTOM_LINE: Record<Clef, Pitch> = { treble: parsePitch('E4'), bass: parsePitch('G2') }

/** Position on the staff counted in steps (lines and spaces): bottom line = 0, first space = 1, top line = 8. */
export function staffPosition(p: Pitch, clef: Clef): number {
  return diatonicIndex(p) - diatonicIndex(BOTTOM_LINE[clef])
}

/** Number of ledger lines needed to draw the pitch (0 if it is on or just beside the staff). */
export function ledgerLines(p: Pitch, clef: Clef): number {
  const pos = staffPosition(p, clef)
  if (pos < 0) return Math.floor(-pos / 2)
  if (pos > 8) return Math.floor((pos - 8) / 2)
  return 0
}
