import {
  Accidental,
  Formatter,
  KeySignature as VexKeySignature,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from 'vexflow/bravura'
import type { KeySignature } from '../theory/keys'
import type { Pitch } from '../theory/pitch'
import type { Clef } from '../theory/staff'
import { vexKeySpec, vexNoteKey } from './vexKey'

export type StaffOptions = {
  clef: Clef
  key: KeySignature
  /** Pitches to show together as one whole note / chord (optional). */
  notes?: Pitch[]
}

/** Fixed drawing size so the layout never jumps between targets; room above and below for one ledger line and the clef. */
export const STAFF_SIZE = { width: 320, height: 110 }
/**
 * VexFlow's Stave y is the top of a box that includes `spaceAboveStaffLn` line spaces above the top
 * staff line. With 2 spaces, the top line sits at STAVE_Y + 20 = 35 and the bottom line at 75, leaving
 * 35 units above and below for the clef, accidentals and one or two ledger lines.
 */
const STAVE_Y = 15
const STAVE_PADDING_LINES = 2

export type StaffHandle = {
  /** Where VexFlow drew each key-signature accidental: type ('#' or 'b') and staff line (0 = top line, 0.5 per step down). */
  signatureAccidentals: { type: string; line: number }[]
  /** Accidentals drawn next to the notes ('#', 'b', 'n', '##', 'bb'): only those the key signature doesn't imply. */
  noteAccidentals: string[]
  /** Where the top and bottom staff lines are in the drawing (units of STAFF_SIZE). */
  lineY: { top: number; bottom: number }
}

/**
 * Draws one staff (clef, key signature and optional notes) as SVG into `container`, replacing its contents.
 * The SVG scales to the container's width via its viewBox and stays sharp on high-DPI screens.
 */
export function renderStaff(container: HTMLElement, opts: StaffOptions): StaffHandle {
  container.replaceChildren()
  const { width, height } = STAFF_SIZE
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle('currentColor')
  ctx.setStrokeStyle('currentColor')

  const spec = vexKeySpec(opts.key)
  const stave = new Stave(10, STAVE_Y, width - 20, {
    spaceAboveStaffLn: STAVE_PADDING_LINES,
    spaceBelowStaffLn: STAVE_PADDING_LINES,
  })
  stave.addClef(opts.clef).addKeySignature(spec)
  stave.setContext(ctx).draw()

  const noteAccidentals: string[] = []
  if (opts.notes && opts.notes.length > 0) {
    const note = new StaveNote({ clef: opts.clef, keys: opts.notes.map(vexNoteKey), duration: 'w' })
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note])
    Accidental.applyAccidentals([voice], spec) // shows only accidentals not implied by the key signature
    for (const m of note.getModifiers()) if (m instanceof Accidental) noteAccidentals.push(m.type)
    new Formatter()
      .joinVoices([voice])
      .format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20)
    voice.draw(ctx, stave)
  }

  const svg = container.querySelector('svg')
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    // VexFlow writes a fixed pixel size into the SVG's style; replace it so the staff fills its container.
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.style.width = '100%'
    svg.style.height = 'auto'
    svg.style.display = 'block'
    svg.style.maxWidth = `${width * 1.5}px`
    svg.setAttribute('role', 'img')
  }

  const sig = stave.getModifiers().find((m) => m instanceof VexKeySignature) as
    (VexKeySignature & { accList?: { type: string; line: number }[] }) | undefined
  return {
    signatureAccidentals: sig?.accList
      ? sig.accList.map((a) => ({ type: a.type, line: a.line }))
      : [],
    noteAccidentals,
    lineY: { top: stave.getYForLine(0), bottom: stave.getYForLine(4) },
  }
}
