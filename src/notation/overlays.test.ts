import { beforeAll, describe, expect, it, vi } from 'vitest'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { renderGrandStaff } from './renderGrandStaff'
import { renderStaff } from './renderStaff'
import type { NoteState } from './overlays'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const C = keySignature(0, 'major')
const staff = (
  notes: string[],
  extra: { showNames?: boolean; states?: (NoteState | undefined)[] } = {},
) => {
  const div = document.createElement('div')
  renderStaff(div, { clef: 'treble', key: C, notes: notes.map(parsePitch), ...extra })
  return div
}
const names = (div: HTMLElement) =>
  [...div.querySelectorAll('.note-name')].map((e) => e.textContent)
const halos = (div: HTMLElement) =>
  [...div.querySelectorAll('.note-halo')].map((e) =>
    e.getAttribute('class')!.replace('note-halo ', ''),
  )

describe('note names', () => {
  it('are off by default', () => {
    expect(names(staff(['C4', 'E4', 'G4']))).toEqual([])
  })

  it('label every note, lowest first, with proper sharps and flats', () => {
    expect(names(staff(['C4', 'E4', 'G4'], { showNames: true }))).toEqual(['C4', 'E4', 'G4'])
    expect(names(staff(['F#4', 'Bb4'], { showNames: true }))).toEqual(['F♯4', 'B♭4'])
  })

  it('step apart horizontally when notes are neighbours so they do not overlap', () => {
    const div = staff(['E4', 'F4', 'G4'], { showNames: true })
    const xs = [...div.querySelectorAll('.note-name')].map((e) => Number(e.getAttribute('x')))
    expect(new Set(xs).size).toBe(3)
    // A third apart (E4 and G4, 10 units) fits on one line; only seconds (5 units) step aside.
    const thirds = [...staff(['E4', 'G4'], { showNames: true }).querySelectorAll('.note-name')].map(
      (e) => Number(e.getAttribute('x')),
    )
    expect(new Set(thirds).size).toBe(1)
    const spaced = [...staff(['C4', 'G4'], { showNames: true }).querySelectorAll('.note-name')].map(
      (e) => Number(e.getAttribute('x')),
    )
    expect(new Set(spaced).size).toBe(1) // far apart: all on one line
  })
})

describe('label legibility', () => {
  it("names and check marks never inherit the SVG root's black stroke (it blots them out in dark mode)", () => {
    const div = staff(['C4', 'E4'], { showNames: true, states: ['heard', 'heard'] })
    expect(div.querySelector('svg')!.getAttribute('stroke')).toBe('black') // what VexFlow stamps on the root
    for (const text of div.querySelectorAll('.note-name, .note-check')) {
      expect(text.getAttribute('stroke')).toBe('none')
    }
  })
})

describe('per-note feedback states', () => {
  it('draws nothing for missing notes, a solid halo and check for heard, a dashed ring for almost', () => {
    const div = staff(['C4', 'E4', 'G4'], { states: ['heard', 'almost', 'missing'] })
    expect(halos(div)).toEqual(['heard', 'almost'])
    expect(div.querySelectorAll('.note-check')).toHaveLength(1) // only the heard note gets the check mark
  })

  it('puts each halo at its own note', () => {
    const div = staff(['C4', 'G4'], { states: ['heard', 'heard'] })
    const ys = [...div.querySelectorAll('.note-halo')].map((e) => Number(e.getAttribute('cy')))
    expect(ys[0]).toBeGreaterThan(ys[1]) // C4 is lower on the staff (larger y) than G4
  })

  it('draws no overlay group when there is nothing to show', () => {
    expect(staff(['C4']).querySelectorAll('.note-overlays')).toHaveLength(0)
    expect(staff(['C4'], { states: [undefined] }).querySelectorAll('.note-halo')).toHaveLength(0)
  })

  it('works together with names', () => {
    const div = staff(['C4', 'E4'], { showNames: true, states: ['heard', undefined] })
    expect(names(div)).toEqual(['C4', 'E4'])
    expect(halos(div)).toEqual(['heard'])
  })
})

describe('on the grand staff', () => {
  it('labels and marks the notes of each hand separately', () => {
    const div = document.createElement('div')
    renderGrandStaff(div, {
      key: C,
      rh: ['E4', 'G4', 'C5'].map(parsePitch),
      lh: ['C3', 'G3'].map(parsePitch),
      showNames: true,
      rhStates: ['heard', 'heard', 'almost'],
      lhStates: ['missing', 'heard'],
    })
    expect(names(div).sort()).toEqual(['C3', 'C5', 'E4', 'G3', 'G4'])
    expect(halos(div).sort()).toEqual(['almost', 'heard', 'heard', 'heard'])
  })
})
