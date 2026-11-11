import { Accidental, Formatter, Renderer, Stave, StaveConnector, Voice } from 'vexflow/bravura'
import type { KeySignature } from '../theory/keys'
import type { Pitch } from '../theory/pitch'
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

export type GrandStaffOptions = {
  key: KeySignature
  /** Right-hand notes, drawn on the treble staff (optional). */
  rh?: Pitch[]
  /** Left-hand notes, drawn on the bass staff (optional). */
  lh?: Pitch[]
  /** Write each note's name beside it. */
  showNames?: boolean
  /** Per-note feedback for each hand, lowest note first (see overlays.ts). */
  rhStates?: (NoteState | undefined)[]
  lhStates?: (NoteState | undefined)[]
  /** Ledger lines to leave room for above, below and between the staves (default 1, the MVP range). */
  ledgerRoom?: number
}

/**
 * Drawing size of a grand staff. The two staves, the gap between them (which holds the ledger lines of both
 * hands) and the margins are all fixed for a given `ledgerRoom`, so the layout never jumps between targets.
 */
export function grandStaffSize(ledgerRoom = 1): {
  width: number
  height: number
  margin: number
  gap: number
} {
  const margin = MIN_MARGIN + 10 * ledgerRoom
  const gap = 30 + 20 * ledgerRoom // treble bottom line to bass top line
  return { width: WIDTH, height: 2 * margin + 2 * STAFF_HEIGHT + gap, margin, gap }
}

export type GrandStaffHandle = {
  trebleSignature: { type: string; line: number }[]
  bassSignature: { type: string; line: number }[]
  noteAccidentals: { rh: string[]; lh: string[] }
  /** x of the notes on each staff, for checking they line up. */
  noteX: { rh?: number; lh?: number }
  lineY: { trebleTop: number; trebleBottom: number; bassTop: number; bassBottom: number }
  size: { width: number; height: number }
  displacedNoteheads: number
}

/**
 * Draws a grand staff (treble over bass, joined by a brace) with the key signature on both staves and the
 * right- and left-hand notes aligned on one beat, as SVG into `container`.
 */
export function renderGrandStaff(
  container: HTMLElement,
  opts: GrandStaffOptions,
): GrandStaffHandle {
  container.replaceChildren()
  const { width, height, margin, gap } = grandStaffSize(opts.ledgerRoom)
  const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const ctx = renderer.getContext()
  ctx.setFillStyle('currentColor')
  ctx.setStrokeStyle('currentColor')

  const spec = vexKeySpec(opts.key)
  const x0 = 24 // room for the brace
  const options = { spaceAboveStaffLn: STAVE_PADDING_LINES, spaceBelowStaffLn: STAVE_PADDING_LINES }
  const trebleTopLine = margin
  const bassTopLine = margin + STAFF_HEIGHT + gap
  const treble = new Stave(x0, trebleTopLine - 10 * STAVE_PADDING_LINES, width - x0 - 10, options)
  const bass = new Stave(x0, bassTopLine - 10 * STAVE_PADDING_LINES, width - x0 - 10, options)
  treble.addClef('treble').addKeySignature(spec)
  bass.addClef('bass').addKeySignature(spec)
  // The two clefs have different widths: start the notes at the same x on both staves.
  const startX = Math.max(treble.getNoteStartX(), bass.getNoteStartX())
  treble.setNoteStartX(startX)
  bass.setNoteStartX(startX)
  treble.setContext(ctx).draw()
  bass.setContext(ctx).draw()
  for (const type of ['brace', 'singleLeft', 'singleRight'] as const) {
    new StaveConnector(treble, bass).setType(type).setContext(ctx).draw()
  }

  const noteAccidentals = { rh: [] as string[], lh: [] as string[] }
  const noteX: GrandStaffHandle['noteX'] = {}
  let displacedNoteheads = 0
  const voices: { voice: Voice; stave: Stave }[] = []
  const parts = [
    { pitches: opts.rh, clef: 'treble' as const, stave: treble, hand: 'rh' as const },
    { pitches: opts.lh, clef: 'bass' as const, stave: bass, hand: 'lh' as const },
  ]
  const notes = parts.map((p) => {
    if (!p.pitches || p.pitches.length === 0) return null
    const { note, sorted } = makeNote(p.clef, p.pitches)
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note])
    voices.push({ voice, stave: p.stave })
    return { note, voice, hand: p.hand, sorted }
  })
  if (voices.length > 0) {
    Accidental.applyAccidentals(
      voices.map((v) => v.voice),
      spec,
    )
    const formatter = new Formatter()
    for (const v of voices) formatter.joinVoices([v.voice])
    formatter.format(
      voices.map((v) => v.voice),
      treble.getNoteEndX() - startX - 20,
    )
    for (const v of voices) v.voice.draw(ctx, v.stave)
    for (const n of notes) {
      if (!n) continue
      for (const m of n.note.getModifiers())
        if (m instanceof Accidental) noteAccidentals[n.hand].push(m.type)
      noteX[n.hand] = n.note.getAbsoluteX()
      displacedNoteheads += n.note.getKeyProps().filter((k) => k.displaced).length
      drawNoteOverlays(container, n.note, n.sorted, {
        names: opts.showNames,
        states: n.hand === 'rh' ? opts.rhStates : opts.lhStates,
      })
    }
  }

  fitSvg(container, width, height)
  return {
    trebleSignature: signatureAccidentals(treble),
    bassSignature: signatureAccidentals(bass),
    noteAccidentals,
    noteX,
    lineY: {
      trebleTop: treble.getYForLine(0),
      trebleBottom: treble.getYForLine(4),
      bassTop: bass.getYForLine(0),
      bassBottom: bass.getYForLine(4),
    },
    size: { width, height },
    displacedNoteheads,
  }
}
