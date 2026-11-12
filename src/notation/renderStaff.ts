import { Accidental, Formatter, Renderer, Stave, Voice } from 'vexflow/bravura'
import type { KeySignature } from '../theory/keys'
import type { Pitch } from '../theory/pitch'
import type { Clef } from '../theory/staff'
import { drawNoteOverlays, type NoteState } from './overlays'
import {
  fitSvg,
  makeNote,
  MIN_MARGIN,
  signatureAccidentals,
  STAFF_HEIGHT,
  STAVE_PADDING_LINES,
  WIDTH,
} from './staffCommon'
import { vexKeySpec } from './vexKey'

export type StaffOptions = {
  clef: Clef
  key: KeySignature
  /** Pitches to show together as one note, interval or chord (optional). */
  notes?: Pitch[]
  /** Write each note's name beside it. */
  showNames?: boolean
  /** Per-note feedback, lowest note first (see overlays.ts). */
  states?: (NoteState | undefined)[]
  /**
   * How many ledger lines to leave room for above and below the staff (default 1, enough for the single-staff screens; the grand staff uses 2).
   * The drawing height grows with it; keep it constant for a given screen so the layout never jumps.
   */
  ledgerRoom?: number
}

/**
 * Drawing size for a given ledger-line allowance: a fixed margin above and below the staff, so the
 * layout never jumps between targets. Default (1 ledger line): 320 x 110, top line at y=35, bottom at y=75.
 */
export function staffSize(ledgerRoom = 1): { width: number; height: number; margin: number } {
  const margin = MIN_MARGIN + 10 * ledgerRoom
  return { width: WIDTH, height: STAFF_HEIGHT + 2 * margin, margin }
}

export const STAFF_SIZE = staffSize()

export type StaffHandle = {
  /** Where VexFlow drew each key-signature accidental: type ('#' or 'b') and staff line (0 = top line, 0.5 per step down). */
  signatureAccidentals: { type: string; line: number }[]
  /** Accidentals drawn next to the notes ('#', 'b', 'n', '##', 'bb'): only those the key signature doesn't imply. */
  noteAccidentals: string[]
  /** Where the top and bottom staff lines are in the drawing. */
  lineY: { top: number; bottom: number }
  /** Drawing size used (viewBox). */
  size: { width: number; height: number }
  /** Noteheads that VexFlow placed on the other side of the stem because they form a second (adjacent notes). */
  displacedNoteheads: number
}

/**
 * Draws one staff (clef, key signature and optional notes) as SVG into `container`, replacing its contents.
 * The SVG scales to the container's width via its viewBox and stays sharp on high-DPI screens.
 */
export function renderStaff(container: HTMLElement, opts: StaffOptions): StaffHandle {
  container.replaceChildren()
  const { width, height, margin } = staffSize(opts.ledgerRoom)
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle('currentColor')
  ctx.setStrokeStyle('currentColor')

  const spec = vexKeySpec(opts.key)
  // Stave y is the top of a box with `spaceAboveStaffLn` line spaces above the top line.
  const stave = new Stave(10, margin - 10 * STAVE_PADDING_LINES, width - 20, {
    spaceAboveStaffLn: STAVE_PADDING_LINES,
    spaceBelowStaffLn: STAVE_PADDING_LINES,
  })
  stave.addClef(opts.clef).addKeySignature(spec)
  stave.setContext(ctx).draw()

  const noteAccidentals: string[] = []
  let displacedNoteheads = 0
  if (opts.notes && opts.notes.length > 0) {
    const { note, sorted } = makeNote(opts.clef, opts.notes)
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note])
    Accidental.applyAccidentals([voice], spec) // shows only accidentals not implied by the key signature
    for (const m of note.getModifiers()) if (m instanceof Accidental) noteAccidentals.push(m.type)
    new Formatter()
      .joinVoices([voice])
      .format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20)
    voice.draw(ctx, stave)
    displacedNoteheads = note.getKeyProps().filter((k) => k.displaced).length
    drawNoteOverlays(container, note, sorted, { names: opts.showNames, states: opts.states })
  }

  fitSvg(container, width, height)

  return {
    signatureAccidentals: signatureAccidentals(stave),
    noteAccidentals,
    lineY: { top: stave.getYForLine(0), bottom: stave.getYForLine(4) },
    size: { width, height },
    displacedNoteheads,
  }
}
