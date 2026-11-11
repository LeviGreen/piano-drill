import { KeySignature as VexKeySignature, StaveNote, type Stave } from 'vexflow/bravura'
import { sortPitches, type Pitch } from '../theory/pitch'
import type { Clef } from '../theory/staff'
import { vexNoteKey } from './vexKey'

export const WIDTH = 320
export const STAFF_HEIGHT = 40 // five lines, four spaces of 10
export const MIN_MARGIN = 25 // clef and accidentals poke out about this far
export const STAVE_PADDING_LINES = 2

/** Make the SVG scale to its container via a viewBox, replacing the fixed pixel size VexFlow writes. */
export function fitSvg(container: HTMLElement, width: number, height: number): void {
  const svg = container.querySelector('svg')
  if (!svg) return
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.height = 'auto'
  svg.style.display = 'block'
  svg.style.maxWidth = `${width * 1.5}px`
  svg.setAttribute('role', 'img')
}

/** A whole-note chord (no stems), pitches low to high, with ledger lines in the theme color. */
export function makeNote(clef: Clef, pitches: Pitch[]): { note: StaveNote; sorted: Pitch[] } {
  const sorted = sortPitches(pitches)
  const note = new StaveNote({ clef, keys: sorted.map(vexNoteKey), duration: 'w' })
  // VexFlow's default ledger lines are dark gray and thin: follow the theme color and make them clearer.
  note.setLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 2 })
  return { note, sorted }
}

/** Where VexFlow drew each key-signature accidental: type ('#' or 'b') and staff line (0 = top line). */
export function signatureAccidentals(stave: Stave): { type: string; line: number }[] {
  const sig = stave.getModifiers().find((m) => m instanceof VexKeySignature) as
    (VexKeySignature & { accList?: { type: string; line: number }[] }) | undefined
  return sig?.accList ? sig.accList.map((a) => ({ type: a.type, line: a.line })) : []
}
