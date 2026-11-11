import type { StaveNote } from 'vexflow/bravura'
import { formatPitch, type Pitch } from '../theory/pitch'

/** How far a note has got in the drill: heard by the mic, only weakly heard, or not heard yet. */
export type NoteState = 'heard' | 'almost' | 'missing'

export type OverlayOptions = {
  /** Write each note's name beside it. */
  names?: boolean
  /** One entry per note, lowest pitch first. Heard gets a solid halo and a check mark, almost a dashed ring. */
  states?: (NoteState | undefined)[]
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const MIN_LABEL_GAP = 8 // neighbours a second apart (5 units) step aside; a third apart (10 units) fits on one line

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

/**
 * Draws note-name labels and per-note state markers on top of an already-drawn chord. Everything is SVG
 * with CSS classes (note-name, note-halo, note-check), so the theme controls colors; state is also shown
 * by shape (a ring and a check mark), never by color alone.
 */
export function drawNoteOverlays(
  container: HTMLElement,
  note: StaveNote,
  sorted: Pitch[],
  opts: OverlayOptions,
): void {
  const svg = container.querySelector('svg')
  if (!svg || (!opts.names && !opts.states)) return
  const ys = note.getYs()
  const headLeft = note.getNoteHeadBeginX()
  const headRight = note.getNoteHeadEndX()
  const displaced = note.getKeyProps().some((k) => k.displaced)
  const cx = (headLeft + headRight) / 2

  const group = el('g', { class: 'note-overlays' })

  opts.states?.forEach((state, i) => {
    if (!state || state === 'missing' || ys[i] === undefined) return
    group.append(el('circle', { class: `note-halo ${state}`, cx, cy: ys[i], r: 9 }))
    if (state === 'heard') {
      const mark = el('text', { class: 'note-check', x: cx + 8, y: ys[i] - 7, stroke: 'none' })
      mark.textContent = '✓'
      group.append(mark)
    }
  })

  if (opts.names) {
    // Names go to the right of the chord. Close neighbours (seconds) step further right so they don't overlap.
    const baseX = headRight + (displaced ? 14 : 4) + (opts.states ? 8 : 0)
    let lastY = Infinity
    let offset = 0
    ;[...sorted].forEach((p, i) => {
      const y = ys[i]
      if (y === undefined) return
      offset = Math.abs(lastY - y) < MIN_LABEL_GAP ? offset + 26 : 0
      lastY = y
      // stroke: none matters: VexFlow's SVG root has stroke="black", which text would inherit as an outline
      // that swamps the glyph on a dark background.
      const label = el('text', {
        class: 'note-name',
        x: baseX + offset,
        y: y + 3.5,
        stroke: 'none',
      })
      label.textContent = formatPitch(p)
      group.append(label)
    })
  }
  svg.append(group)
}
